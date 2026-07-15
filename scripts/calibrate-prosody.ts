#!/usr/bin/env tsx
/**
 * Cognify Ch.S5 — Per-sub-skill Tone calibration against the audio
 * reference bank.
 *
 * For each reference rep that has audio attached (D3 upload path):
 *   1. Re-fetch via signed URL from Supabase storage
 *   2. Call extractWorkerProsody (Hume.ai when HUME_API_KEY set, or the
 *      Praat worker via PROSODY_WORKER_URL)
 *   3. Run mapSignalsToSubSkillScores with the prosody output
 *   4. Compare each Tone sub-skill score against an expected band
 *      (loose: ±10 per sub-skill is acceptable for prosody-derived
 *      signals — emotion classification has more variance than text
 *      lexicon matching)
 *
 * Acceptance gate per the master plan: ≥80% of audio reference reps
 * have all 6 Tone sub-skills within ±10 of expectation.
 *
 * Usage:
 *   FF_PROSODY_WORKER=true HUME_API_KEY=... npx tsx scripts/calibrate-prosody.ts
 *   FF_PROSODY_WORKER=true HUME_API_KEY=... npx tsx scripts/calibrate-prosody.ts --rep <id>
 *
 * Output: JSON to stdout, progress to stderr.
 */

import {
  loadReferenceBank,
  listReferenceRepAudio,
  type ReferenceRep,
} from "../src/lib/calibration/reference-bank.js";
import { extractWorkerProsody } from "../src/lib/audio/prosody-worker.js";
import { extractAllTextSignals, mapSignalsToSubSkillScores } from "../src/lib/scoring/signals/index.js";
import { extractInlineProsody } from "../src/lib/audio/prosody-inline.js";
import { mergeProsody } from "../src/lib/audio/prosody-inline.js";
import { transcribeAudio } from "../src/lib/audio/transcribe.js";
import { SUB_SKILLS } from "../src/types/sub-skills.js";

const TONE_TOLERANCE = 10;

type RepResult = {
  repId: string;
  audioPath: string;
  prosodyProvider: string | null;
  toneSubSkills: Partial<Record<string, { actual: number; signalSource: string }>>;
  failures: string[];
};

async function calibrateRep(rep: ReferenceRep, audioUrl: string): Promise<RepResult> {
  // 1. Pull audio for transcription (Hume fetches it itself for analysis).
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) {
    return {
      repId: rep.id,
      audioPath: audioUrl,
      prosodyProvider: null,
      toneSubSkills: {},
      failures: [`audio fetch failed: HTTP ${audioRes.status}`],
    };
  }
  const audioBuf = Buffer.from(await audioRes.arrayBuffer());
  const mime = audioRes.headers.get("content-type") ?? "audio/webm";

  // 2. Re-transcribe for word timings (inline prosody needs them).
  const transcription = await transcribeAudio(audioBuf, mime);

  // 3. Extract inline prosody from word timings.
  const inline = extractInlineProsody({
    words: transcription.words,
    durationMs: rep.durationMs,
  });

  // 4. Call worker prosody (Hume or Praat).
  const worker = await extractWorkerProsody({
    audioUrl,
    durationMs: rep.durationMs,
    timeoutMs: 90_000,
  });

  // 5. Merge inline + worker into ProsodyFeatures.
  const prosodyFeatures = mergeProsody(inline, worker);

  // 6. Build text signals from the re-transcribed text.
  const textSignals = extractAllTextSignals({
    transcript: transcription.transcript,
    durationMs: rep.durationMs,
    words: transcription.words.map((w) => ({
      word: w.word,
      startMs: w.startMs,
      endMs: w.endMs,
    })),
  });

  // 7. Map to sub-skills with prosody.
  const subSkillMap = mapSignalsToSubSkillScores(textSignals, prosodyFeatures);

  // 8. Pull Tone sub-skills.
  const toneSubSkillIds = SUB_SKILLS.tone;
  const toneSubSkills: Partial<Record<string, { actual: number; signalSource: string }>> = {};
  const failures: string[] = [];

  for (const id of toneSubSkillIds) {
    const entry = subSkillMap[id];
    if (!entry) {
      failures.push(`${id}: not populated by mapper`);
      continue;
    }
    toneSubSkills[id] = {
      actual: entry.score,
      signalSource: entry.signalSource,
    };
    // If the rep has expected sub-skill scores, compare.
    if (rep.expected?.subSkills && rep.expected.subSkills[id] != null) {
      const expected = rep.expected.subSkills[id]!;
      if (Math.abs(entry.score - expected) > TONE_TOLERANCE) {
        failures.push(
          `${id} drift: actual=${entry.score} expected=${expected} (>±${TONE_TOLERANCE})`,
        );
      }
    }
  }

  return {
    repId: rep.id,
    audioPath: audioUrl,
    prosodyProvider: prosodyFeatures?.prosodyProvider ?? null,
    toneSubSkills,
    failures,
  };
}

async function main() {
  if (process.env.FF_PROSODY_WORKER !== "true") {
    console.error(
      "ABORT: FF_PROSODY_WORKER must be set to true to run prosody calibration.",
    );
    process.exit(1);
  }
  if (!process.env.HUME_API_KEY && !process.env.PROSODY_WORKER_URL) {
    console.error(
      "ABORT: Either HUME_API_KEY (Ch.S5 Hume.ai path) or PROSODY_WORKER_URL (Ch.3b Praat path) must be set.",
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const onlyRep = (() => {
    const idx = args.indexOf("--rep");
    return idx >= 0 ? args[idx + 1] : null;
  })();

  const bank = loadReferenceBank();
  const audioMap = await listReferenceRepAudio();

  const candidates = bank.reps.filter((r) => {
    if (onlyRep && r.id !== onlyRep) return false;
    return audioMap.has(r.id) && audioMap.get(r.id)?.signedUrl != null;
  });

  if (candidates.length === 0) {
    console.error(
      "No reference reps have audio uploaded. Use /ops/reference-bank to upload.",
    );
    process.exit(0);
  }

  process.stderr.write(
    `Calibrating prosody on ${candidates.length} reference reps...\n`,
  );

  const results: RepResult[] = [];
  for (const rep of candidates) {
    const url = audioMap.get(rep.id)!.signedUrl!;
    process.stderr.write(`  → ${rep.id}\n`);
    try {
      const r = await calibrateRep(rep, url);
      results.push(r);
    } catch (err) {
      results.push({
        repId: rep.id,
        audioPath: url,
        prosodyProvider: null,
        toneSubSkills: {},
        failures: [`exception: ${err instanceof Error ? err.message : String(err)}`],
      });
    }
  }

  const passed = results.filter((r) => r.failures.length === 0).length;
  const summary = {
    totalReps: results.length,
    passedReps: passed,
    passRate: results.length > 0 ? passed / results.length : 0,
    acceptanceGate: results.length > 0 && passed / results.length >= 0.8,
    perRep: results,
  };
  console.log(JSON.stringify(summary, null, 2));

  process.exit(summary.acceptanceGate ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
