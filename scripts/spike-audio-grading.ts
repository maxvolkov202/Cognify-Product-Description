/**
 * Phase 3.1 (D22) — audio tone-grading spike harness.
 *
 * Compares three evidence forms under ONE shared scoring-prompt frame so
 * the evidence form is the only variable:
 *   audio-gpt-audio   : input_audio part attached (gpt-audio, GA)
 *   audio-mini        : input_audio part (gpt-4o-mini-audio-preview)
 *   prosody           : DSP feature text block (parselmouth features.json)
 *                       on the current scoring model (gpt-4o)
 *   text              : no delivery evidence (baseline) on gpt-4o
 *
 * Each of the 15 fixtures runs REPEATS (default 3) per arm; medians feed
 * the pre-registered gates (G1 tone separation, G2 pacing separation,
 * G3 content invariance, G7 repeatability; G5 latency + G6 cost are
 * recorded per call). G4 (text sanity on band reps) runs the audio
 * models WITHOUT audio over the phase-baseline subset.
 *
 *   npx tsx scripts/spike-audio-grading.ts                 # full run
 *   npx tsx scripts/spike-audio-grading.ts --arms text,prosody --repeats 1
 *
 * Output: plans/spike-audio-grading-results.json + console gate table.
 * Deliberately bypasses the provider facade (spike-only code).
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const FIXTURE_DIR = resolve("tests/fixtures/audio-grading");
const REPEATS = (() => {
  const i = process.argv.indexOf("--repeats");
  return i >= 0 ? Math.max(1, Number(process.argv[i + 1])) : 3;
})();
const ARMS = (() => {
  const i = process.argv.indexOf("--arms");
  return i >= 0
    ? process.argv[i + 1]!.split(",")
    : ["audio-gpt-audio", "audio-mini", "prosody", "text"];
})();
const CONCURRENCY = 6;

// Probed 2026-07-16: `gpt-audio` IGNORES input audio in text-output
// mode (grades from transcript, refuses transcription asks) and only
// hears audio in speech-to-speech mode (unusable for structured JSON);
// `gpt-audio-mini` refuses voice analysis entirely (voice-ID guardrail
// misfire). `gpt-audio-1.5` hears audio in text mode and correctly
// identified a PSOLA-flattened clip as monotone.
const ARM_MODELS: Record<string, { model: string; audio: boolean }> = {
  "audio-gpt-audio": { model: "gpt-audio-1.5", audio: true },
  "audio-mini": { model: "gpt-audio-mini", audio: true },
  prosody: { model: process.env.OPENAI_SCORING_MODEL ?? "gpt-4o", audio: false },
  text: { model: process.env.OPENAI_SCORING_MODEL ?? "gpt-4o", audio: false },
};

// Compact 6-dim frame — a distilled version of the production rubric's
// dimension definitions + edge-case rules relevant to tone/delivery.
const SYSTEM = `You score a spoken communication rep on six dimensions, 0-100 each. Be rigorous: 90+ is rare excellence, <40 is seriously flawed.

Dimensions:
- clarity: would a smart listener get the idea immediately? Jargon, vagueness, abstraction hurt.
- structure: clear open, ordered points, deliberate close.
- conciseness: no repetition, no filler content, scoped to the point.
- thinking_quality: claims supported, reasoning visible, honest about limits.
- delivery: pacing. Optimal 150-160 WPM; rushing (190+) or dragging hurts; pauses used deliberately. Judge from the audio/evidence when available.
- tone: vocal expressiveness matched to content. Varied intonation, emphasis, warmth, confidence. A flat monotone reading scores LOW on tone regardless of content quality. Judge from the audio/evidence when available.

If AUDIO or a PROSODY EVIDENCE block is provided, ground delivery and tone in it. If neither is provided, grade tone/delivery conservatively from text alone toward band center (55-70) — do not invent vocal qualities.

Return ONLY JSON: {"dimensions":{"clarity":N,"structure":N,"conciseness":N,"thinking_quality":N,"delivery":N,"tone":N},"toneRationale":"one sentence"}`;

function prosodyBlock(f: Record<string, number>): string {
  return [
    "PROSODY EVIDENCE (measured from the recording):",
    `- speaking rate: ${f.wordsPerMinute} WPM`,
    `- pitch variation: ${f.pitchStdSemitones} semitones std (>=3 varied, <1 monotone)`,
    `- pitch range (p5-p95): ${f.pitchRangeSemitones} semitones`,
    `- monotone ratio: ${Math.round((f.monotoneRatio ?? 0) * 100)}% of 1s windows near-flat`,
    `- volume variation: ${f.intensityStdDb} dB std`,
  ].join("\n");
}

type Verdict = {
  dimensions: Record<string, number>;
  toneRationale?: string;
};

async function callArm(
  arm: string,
  fixtureFile: string | null,
  transcript: string,
  promptText: string,
  features: Record<string, number> | null,
): Promise<{ verdict: Verdict; latencyMs: number; usage: unknown }> {
  const { model, audio } = ARM_MODELS[arm]!;
  const userParts: Record<string, unknown>[] = [];
  let evidence = "";
  if (arm === "prosody" && features) evidence = `\n\n${prosodyBlock(features)}`;
  const text = `PROMPT: ${promptText}\n\nTRANSCRIPT:\n${transcript}${evidence}\n\nScore the rep.`;
  if (audio && fixtureFile) {
    const buf = readFileSync(resolve(FIXTURE_DIR, fixtureFile));
    userParts.push({
      type: "input_audio",
      input_audio: {
        data: buf.toString("base64"),
        format: fixtureFile.endsWith(".wav") ? "wav" : "mp3",
      },
    });
  }
  userParts.push({ type: "text", text });

  const t0 = Date.now();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      ...(audio ? { modalities: ["text"] } : {}),
      temperature: 0.2,
      max_completion_tokens: 400,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userParts },
      ],
    }),
  });
  const latencyMs = Date.now() - t0;
  if (!res.ok) {
    throw new Error(`${arm}/${model}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
    usage: unknown;
  };
  const raw = json.choices[0]!.message.content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "");
  return { verdict: JSON.parse(raw) as Verdict, latencyMs, usage: json.usage };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}
function stdev(xs: number[]): number {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

async function runPool<T>(jobs: (() => Promise<T>)[]): Promise<T[]> {
  const results: T[] = new Array(jobs.length);
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const i = next++;
      results[i] = await jobs[i]!();
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker),
  );
  return results;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not set");
    process.exit(1);
  }
  const manifest = JSON.parse(
    readFileSync(resolve(FIXTURE_DIR, "manifest.json"), "utf8"),
  ) as { fixtures: { file: string; scriptId: string; style: string; transcript: string }[] };
  const features = JSON.parse(
    readFileSync(resolve(FIXTURE_DIR, "features.json"), "utf8"),
  ) as Record<string, Record<string, number>>;
  const bank = JSON.parse(
    readFileSync(resolve("scripts/calibration/reference-reps.json"), "utf8"),
  );
  const reps: { id: string; transcript: string; promptText?: string; prompt?: string; expected?: { composite?: number } }[] =
    Array.isArray(bank) ? bank : bank.reps;
  const promptFor = (scriptId: string) => {
    const rep = reps.find((r) => r.id === scriptId);
    return rep?.promptText ?? rep?.prompt ?? "Speak on the given topic.";
  };

  // ——— fixture runs ————————————————————————————————————————
  type Run = {
    file: string; scriptId: string; style: string; arm: string; repeat: number;
    dims: Record<string, number>; toneRationale?: string; latencyMs: number; usage: unknown;
  };
  const jobs: (() => Promise<Run | null>)[] = [];
  for (const fx of manifest.fixtures) {
    for (const arm of ARMS) {
      for (let r = 0; r < REPEATS; r++) {
        jobs.push(async () => {
          try {
            const { verdict, latencyMs, usage } = await callArm(
              arm, ARM_MODELS[arm]!.audio ? fx.file : null,
              fx.transcript, promptFor(fx.scriptId),
              features[fx.file] ?? null,
            );
            return { file: fx.file, scriptId: fx.scriptId, style: fx.style, arm, repeat: r,
              dims: verdict.dimensions, toneRationale: verdict.toneRationale, latencyMs, usage };
          } catch (err) {
            console.error(`FAIL ${arm} ${fx.file} r${r}:`, (err as Error).message.slice(0, 200));
            return null;
          }
        });
      }
    }
  }
  console.log(`running ${jobs.length} fixture calls (${ARMS.join(", ")}, x${REPEATS})…`);
  const runs = (await runPool(jobs)).filter((r): r is Run => r !== null);

  // ——— G4 text-sanity leg: band-rep subset, audio arms WITHOUT audio ——
  const SUBSET = reps.filter((r) => r.expected?.composite != null).slice(0, 10);
  const sanityJobs: (() => Promise<{ id: string; arm: string; dims: Record<string, number>; expected: number } | null>)[] = [];
  for (const rep of SUBSET) {
    for (const arm of ARMS.filter((a) => ARM_MODELS[a]!.audio || a === "text")) {
      sanityJobs.push(async () => {
        try {
          const { verdict } = await callArm(arm, null, rep.transcript, promptFor(rep.id), null);
          return { id: rep.id, arm, dims: verdict.dimensions, expected: rep.expected!.composite! };
        } catch (err) {
          console.error(`SANITY FAIL ${arm} ${rep.id}:`, (err as Error).message.slice(0, 150));
          return null;
        }
      });
    }
  }
  console.log(`running ${sanityJobs.length} text-sanity calls…`);
  const sanity = (await runPool(sanityJobs)).filter((x): x is NonNullable<typeof x> => x !== null);

  // ——— gate evaluation ————————————————————————————————————
  const armStats: Record<string, Record<string, unknown>> = {};
  for (const arm of ARMS) {
    const armRuns = runs.filter((r) => r.arm === arm);
    const byFixture = new Map<string, Run[]>();
    for (const r of armRuns) {
      const list = byFixture.get(r.file) ?? [];
      list.push(r);
      byFixture.set(r.file, list);
    }
    const med = (file: string, dim: string): number | null => {
      const list = byFixture.get(file);
      if (!list || list.length === 0) return null;
      return median(list.map((r) => r.dims[dim] ?? NaN).filter((x) => !Number.isNaN(x)));
    };

    const scripts = [...new Set(manifest.fixtures.map((f) => f.scriptId))];
    const tonePairs = scripts.map((s) => {
      const flat = manifest.fixtures.find((f) => f.scriptId === s && f.style === "flat")!;
      const exp = manifest.fixtures.find((f) => f.scriptId === s && f.style === "expressive")!;
      return { script: s, sep: (med(exp.file, "tone") ?? NaN) - (med(flat.file, "tone") ?? NaN) };
    });
    const pacingPairs = scripts.map((s) => {
      const rushed = manifest.fixtures.find((f) => f.scriptId === s && f.style === "rushed")!;
      const exp = manifest.fixtures.find((f) => f.scriptId === s && f.style === "expressive")!;
      return { script: s, sep: (med(exp.file, "delivery") ?? NaN) - (med(rushed.file, "delivery") ?? NaN) };
    });
    const textDims = ["clarity", "structure", "conciseness", "thinking_quality"];
    const invariance = scripts.map((s) => {
      const files = manifest.fixtures.filter((f) => f.scriptId === s).map((f) => f.file);
      let maxSpread = 0;
      for (const dim of textDims) {
        const vals = files.map((f) => med(f, dim)).filter((v): v is number => v != null);
        if (vals.length >= 2) maxSpread = Math.max(maxSpread, Math.max(...vals) - Math.min(...vals));
      }
      return { script: s, maxSpread };
    });
    const repeatability = manifest.fixtures.map((f) => {
      const list = byFixture.get(f.file) ?? [];
      const tones = list.map((r) => r.dims.tone ?? NaN).filter((x) => !Number.isNaN(x));
      return tones.length >= 2 ? stdev(tones) : 0;
    });
    const latencies = armRuns.map((r) => r.latencyMs).sort((a, b) => a - b);
    const sanityArm = sanity.filter((s) => s.arm === arm);
    const sanityDeltas = sanityArm.map((s) => {
      const composite = (s.dims.clarity + s.dims.structure + s.dims.conciseness + s.dims.thinking_quality + s.dims.delivery + s.dims.tone) / 6;
      return Math.abs(composite - s.expected);
    });

    armStats[arm] = {
      model: ARM_MODELS[arm]!.model,
      runs: armRuns.length,
      G1_tonePairs: tonePairs,
      G1_pass: tonePairs.filter((p) => p.sep >= 10).length >= Math.ceil(tonePairs.length * 0.9) &&
        tonePairs.reduce((a, p) => a + p.sep, 0) / tonePairs.length >= 15,
      G2_pacingPairs: pacingPairs,
      G2_pass: pacingPairs.filter((p) => p.sep >= 8).length >= 4,
      G3_invariance: invariance,
      G3_pass: invariance.every((i) => i.maxSpread <= 8),
      G5_latency: { p50: latencies[Math.floor(latencies.length * 0.5)] ?? null, p95: latencies[Math.floor(latencies.length * 0.95)] ?? null },
      G7_toneStdevMax: Math.max(...repeatability, 0),
      G7_pass: Math.max(...repeatability, 0) <= 5,
      G4_sanity: sanityDeltas.length > 0
        ? { within5: sanityDeltas.filter((d) => d <= 5).length, of: sanityDeltas.length }
        : null,
    };
  }

  const out = { generatedAt: new Date().toISOString(), repeats: REPEATS, armStats, runs, sanity };
  writeFileSync(resolve("plans/spike-audio-grading-results.json"), JSON.stringify(out, null, 2));
  console.log("\n=== GATE SUMMARY ===");
  for (const [arm, s] of Object.entries(armStats)) {
    const a = s as Record<string, unknown>;
    console.log(
      `${arm.padEnd(16)} G1:${a.G1_pass ? "PASS" : "fail"} G2:${a.G2_pass ? "PASS" : "fail"} G3:${a.G3_pass ? "PASS" : "fail"} G7:${a.G7_pass ? "PASS" : "fail"}  latency p50/p95: ${JSON.stringify(a.G5_latency)}  sanity: ${JSON.stringify(a.G4_sanity)}`,
    );
  }
  console.log("\nresults → plans/spike-audio-grading-results.json");
}

void main();
