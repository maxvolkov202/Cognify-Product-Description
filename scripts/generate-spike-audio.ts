/**
 * Phase 3.1 (D22) — generate the audio tone-grading spike fixtures.
 *
 * 5 scripts (transcripts reused from calibration reference reps so text
 * dims are held constant per pair and already have authored expectations)
 * × 3 delivery styles = 15 clips:
 *   flat       — monotone, low energy, even volume
 *   expressive — varied intonation, warm, emphatic, ~150-160 WPM
 *   rushed     — fast (~190-210 WPM), breathless, clipped pauses
 *
 * TTS: gpt-4o-mini-tts with the `instructions` field for styling.
 * Output: tests/fixtures/audio-grading/<repId>__<style>.mp3 + manifest.json
 * with ground-truth pair labels. Fixtures must then be OBJECTIVELY
 * validated (pitch std / WPM) before the spike trusts them — see
 * scripts/spike-audio-grading.ts --validate.
 *
 *   npx tsx scripts/generate-spike-audio.ts            # all 15
 *   npx tsx scripts/generate-spike-audio.ts --only band-strong-clean-pitch
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT_DIR = resolve("tests/fixtures/audio-grading");
const SCRIPT_IDS = [
  "band-strong-clean-pitch",
  "band-competent-okay-pitch",
  "qa-strong-pricing-question",
  "interview-competent-tell-me-about-yourself",
  "persuasive-strong-budget-cut-defense",
] as const;

type StyleId = "flat" | "expressive" | "rushed";

const STYLES: Record<StyleId, { instructions: string; speed: number }> = {
  flat: {
    instructions:
      "Speak in a completely flat, bored monotone. No pitch variation at all, low energy, even volume throughout, no emphasis on any word. Sound disengaged, like reading a list you don't care about. Keep a normal moderate speaking rate.",
    speed: 1.0,
  },
  expressive: {
    instructions:
      "Speak with warm, expressive, varied intonation. Emphasize the key words, let your pitch rise and fall naturally with the meaning, pause briefly before important points, and sound genuinely engaged and confident. Moderate pace, around 150 words per minute.",
    speed: 1.0,
  },
  rushed: {
    instructions:
      "Speak very fast and breathless, like you're out of time. Rush through every sentence, clip the pauses between ideas to almost nothing, and run sentences together. Keep the volume even but the pace urgent throughout.",
    speed: 1.25,
  },
};

/** Ground-truth relational labels the spike gates check (manifest). */
const PAIR_RULES = {
  tonePairs: {
    compare: ["flat", "expressive"],
    rule: "tone(expressive) - tone(flat) >= 15, correct sign mandatory",
  },
  pacingPairs: {
    compare: ["rushed", "expressive"],
    rule: "delivery(expressive) - delivery(rushed) >= 10",
  },
  invariance:
    "clarity/structure/conciseness/thinking_quality within +/-8 across styles of the same script",
} as const;

async function tts(
  key: string,
  text: string,
  style: StyleId,
): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: text,
      instructions: STYLES[style].instructions,
      response_format: "mp3",
      speed: STYLES[style].speed,
    }),
  });
  if (!res.ok) {
    throw new Error(`TTS ${style} failed: ${res.status} ${await res.text()}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error("[spike-audio] OPENAI_API_KEY not set");
    process.exit(1);
  }
  const only = (() => {
    const i = process.argv.indexOf("--only");
    return i >= 0 ? process.argv[i + 1] : null;
  })();

  const bank = JSON.parse(
    readFileSync(resolve("scripts/calibration/reference-reps.json"), "utf8"),
  );
  const reps: { id: string; transcript: string; durationMs: number }[] =
    Array.isArray(bank) ? bank : bank.reps;

  mkdirSync(OUT_DIR, { recursive: true });
  const manifest: Record<string, unknown>[] = [];

  for (const scriptId of SCRIPT_IDS) {
    if (only && scriptId !== only) continue;
    const rep = reps.find((r) => r.id === scriptId);
    if (!rep) {
      console.error(`[spike-audio] reference rep not found: ${scriptId}`);
      process.exit(1);
    }
    for (const style of Object.keys(STYLES) as StyleId[]) {
      const file = `${scriptId}__${style}.mp3`;
      process.stdout.write(`[spike-audio] ${file} … `);
      const buf = await tts(key, rep.transcript, style);
      writeFileSync(resolve(OUT_DIR, file), buf);
      console.log(`${Math.round(buf.length / 1024)} KB`);
      manifest.push({
        file,
        scriptId,
        style,
        transcript: rep.transcript,
        sourceDurationMs: rep.durationMs,
      });
    }
  }

  writeFileSync(
    resolve(OUT_DIR, "manifest.json"),
    JSON.stringify({ pairRules: PAIR_RULES, fixtures: manifest }, null, 2),
  );
  console.log(
    `[spike-audio] wrote ${manifest.length} fixtures + manifest to ${OUT_DIR}`,
  );
  console.log(
    "[spike-audio] NEXT: validate objectively — npx tsx scripts/spike-audio-grading.ts --validate",
  );
}

void main();
