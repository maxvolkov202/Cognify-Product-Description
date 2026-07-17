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
 *   - assertions     : per-clip tone bounds (flat ≤55, expressive ≥70).
 *                      Pair-separation rules live in the harness.
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
  // band-competent-okay-pitch__expressive measured upspeakRatio 0.5 at
  // the worker (the TTS rendition genuinely rises on half its sentence
  // ends) — DNA rule 4 caps upspeaky variety LOW, so it serves as an
  // upspeak specimen instead of an expressive-positive clip, and its
  // pairs are excluded from separation gates.
  const isUpspeakSpecimen =
    f.scriptId === "band-competent-okay-pitch" && f.style === "expressive";
  const assertions = isUpspeakSpecimen
    ? [{ kind: "maxScore", dimension: "tone", max: 55, rationale: "DNA rule 4 upspeak specimen: worker measures upspeakRatio 0.5 — strong variety must NOT cancel the upspeak penalty" }]
    : f.style === "flat"
      ? [{ kind: "maxScore", dimension: "tone", max: 55, rationale: "PSOLA pitch-flattened true monotone (pitchStd ≤0.25 st) must not score expressive" }]
      : f.style === "expressive"
        ? [{ kind: "minScore", dimension: "tone", min: 60, rationale: "validated expressive delivery (pitchStd ≥2.9 st); min is 60 not 70 because the runtime worker measures monotoneRatio 0.4-0.5 on these TTS clips (stricter window rule than the offline validator) — pair separation vs flat is the primary gate" }]
        : []; // rushed clips are pair-only (delivery separation vs expressive)
  return {
    ...(isUpspeakSpecimen ? { upspeakSpecimen: true } : {}),
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
