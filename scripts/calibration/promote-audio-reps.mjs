#!/usr/bin/env node
/**
 * One-shot: promote the grading-v3 spike audio fixtures
 * (tests/fixtures/audio-grading/) into reference-reps.json as
 * kind="audio-tone" reference reps.
 *
 * Idempotent — re-running replaces the audio-tone section in place.
 * Kept in the repo so the bank regeneration is reproducible if the
 * fixture set changes (new scripts, re-recorded clips).
 *
 * Shape of an audio-tone rep:
 *   - localAudioFile : repo-relative path, served by
 *                      scripts/calibrate-audio-tone.mjs over local HTTP
 *   - storagePath    : object key in the `rep-audio` bucket
 *                      (uploaded by scripts/upload-calibration-audio.mjs);
 *                      consumers mint signed URLs at runtime — signed
 *                      URLs are never persisted here
 *   - durationMs     : measured clip duration (features.json), NOT the
 *                      source rep's duration — pacing math needs the
 *                      real WPM of the clip
 *   - assertions     : per-clip tone bounds (flat ≤55, expressive ≥60 —
 *                      60 leaves ±10 blend headroom). Pair-separation rules
 *                      live in the harness.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BANK = resolve(__dirname, "reference-reps.json");
const FIXTURES = resolve(__dirname, "..", "..", "tests", "fixtures", "audio-grading");

const bank = JSON.parse(readFileSync(BANK, "utf8"));
const manifest = JSON.parse(readFileSync(resolve(FIXTURES, "manifest.json"), "utf8"));
const features = JSON.parse(readFileSync(resolve(FIXTURES, "features.json"), "utf8"));

const promptByScript = new Map(bank.reps.map((r) => [r.id, r.promptText]));

const audioReps = manifest.fixtures.map((f) => {
  const promptText = promptByScript.get(f.scriptId);
  if (!promptText) throw new Error(`no bank rep for scriptId ${f.scriptId}`);
  const feat = features[f.file];
  if (!feat?.durationSec) throw new Error(`no measured duration for ${f.file}`);
  // 2026-09-02 (prosody v2 Phase 3): the former band-competent-expressive
  // "upspeak specimen" carve-out is RETIRED — v1's upspeakRatio 0.5 on that
  // clip was an artifact of segmentation that split on every unvoiced frame;
  // worker v2's pause-bounded tails all FALL on it (upspeak 0.0, finalFall
  // 1.0, verified directly). The upspeak-penalty regression it guarded lives
  // in tests/tone-core.test.ts as a deterministic assertion now.
  const assertions =
    f.style === "flat"
      ? [{ kind: "maxScore", dimension: "tone", max: 55, rationale: "PSOLA pitch-flattened true monotone (measured vectors: tests/fixtures/audio-grading/features-v2.json) must not score expressive" }]
      : f.style === "expressive"
        ? [{ kind: "minScore", dimension: "tone", min: 60, rationale: "validated expressive delivery under worker v2 (measured vectors: tests/fixtures/audio-grading/features-v2.json); min 60 leaves blend headroom — pair separation vs flat is the primary gate" }]
        : []; // rushed clips are pair-only (delivery separation vs expressive)
  return {
    id: `audio-tone__${f.scriptId}__${f.style}`,
    kind: "audio-tone",
    scriptId: f.scriptId,
    style: f.style,
    promptText,
    transcript: f.transcript,
    durationMs: Math.round(feat.durationSec * 1000),
    localAudioFile: `tests/fixtures/audio-grading/${f.file}`,
    storagePath: `calibration-audio/${f.file}`,
    assertions,
  };
});

bank.reps = bank.reps.filter((r) => r.kind !== "audio-tone").concat(audioReps);
writeFileSync(BANK, JSON.stringify(bank, null, 2) + "\n");
console.log(`wrote ${audioReps.length} audio-tone reps (bank total ${bank.reps.length})`);
