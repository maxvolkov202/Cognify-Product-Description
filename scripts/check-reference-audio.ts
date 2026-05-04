#!/usr/bin/env tsx
/**
 * Ch.D3 — Reference rep audio sanity check.
 *
 * For a given reference rep id, downloads its uploaded audio from
 * Supabase Storage, re-transcribes via Deepgram, runs the deterministic
 * text-signal extractors + the inline prosody features, and prints the
 * actuals as JSON so an operator can hand-verify against the rep's
 * expected scores.
 *
 * Does NOT call the prosody worker (FF_PROSODY_WORKER); that path is
 * exercised by Ch.S5's calibrate-prosody.mjs once the worker is wired.
 *
 * Usage:
 *   npx tsx scripts/check-reference-audio.ts <repId>
 *   npx tsx scripts/check-reference-audio.ts --all       # every rep with audio
 *
 * Env required:
 *   DEEPGRAM_API_KEY        for transcription
 *   SUPABASE_URL            for storage access
 *   SUPABASE_SERVICE_KEY    for storage access
 */

import {
  loadReferenceBank,
  getReferenceRepAudioStatus,
  listReferenceRepAudio,
} from "../src/lib/calibration/reference-bank.js";
import { transcribeAudio } from "../src/lib/audio/transcribe.js";
import { extractAllTextSignals } from "../src/lib/scoring/signals/index.js";

type Result = {
  repId: string;
  audioPath: string;
  audioSizeBytes: number | null;
  durationMsExpected: number;
  transcript: {
    provider: string;
    text: string;
    wordCount: number;
  };
  signals: ReturnType<typeof extractAllTextSignals>;
};

async function checkRep(repId: string): Promise<Result | { repId: string; error: string }> {
  const bank = loadReferenceBank();
  const rep = bank.reps.find((r) => r.id === repId);
  if (!rep) return { repId, error: "rep not found in bank" };

  const status = await getReferenceRepAudioStatus(repId);
  if (!status.signedUrl || !status.path) {
    return { repId, error: "no audio uploaded for this rep" };
  }

  const audioRes = await fetch(status.signedUrl);
  if (!audioRes.ok) {
    return { repId, error: `audio fetch failed: HTTP ${audioRes.status}` };
  }
  const audioBuf = Buffer.from(await audioRes.arrayBuffer());
  const mime = audioRes.headers.get("content-type") ?? "audio/webm";

  const transcription = await transcribeAudio(audioBuf, mime);
  const signals = extractAllTextSignals({
    transcript: transcription.transcript,
    durationMs: rep.durationMs,
    words: transcription.words.map((w) => ({
      word: w.word,
      startMs: w.startMs,
      endMs: w.endMs,
    })),
  });

  return {
    repId,
    audioPath: status.path,
    audioSizeBytes: status.sizeBytes,
    durationMsExpected: rep.durationMs,
    transcript: {
      provider: transcription.provider,
      text: transcription.transcript,
      wordCount: transcription.words.length,
    },
    signals,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      "Usage: npx tsx scripts/check-reference-audio.ts <repId> | --all",
    );
    process.exit(1);
  }

  const ids: string[] = [];
  if (args[0] === "--all") {
    const audioMap = await listReferenceRepAudio();
    ids.push(...audioMap.keys());
    if (ids.length === 0) {
      console.error("No reference reps have audio uploaded.");
      process.exit(0);
    }
  } else {
    ids.push(...args);
  }

  const results: Array<Result | { repId: string; error: string }> = [];
  for (const id of ids) {
    process.stderr.write(`Checking ${id}…\n`);
    const r = await checkRep(id);
    results.push(r);
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
