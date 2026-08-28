/**
 * Grading plan WS2.5 — harness mode: re-score the human-labeled sample
 * through the live pipeline and report the same metrics as scoring.mjs.
 *
 *   BASE_URL=http://localhost:3000 CALIBRATION_GUEST_ID=<uuid> \
 *   node scripts/calibration/human-labeling/rescore.mjs --label <name> [--runs 1]
 *
 * Every later workstream that changes scores runs this and compares
 * metrics.<label>.json against metrics.baseline.json. Audio reps are sent
 * with a fresh 1-hour signed URL so tone/pacing grade from audio exactly as
 * in prod. Never writes to the DB.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { OUT_DIR, DIMS, loadEnvLocal } from "./_shared.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, xs) => (a.startsWith("--") ? [a.slice(2), xs[i + 1]] : [])).filter((p) => p.length));
const label = args.label ?? "rescore";
const runs = parseInt(args.runs ?? "1", 10);
const env = { ...loadEnvLocal(), ...process.env };
env.SUPABASE_URL ??= env.NEXT_PUBLIC_SUPABASE_URL;
const BASE_URL = env.BASE_URL ?? "http://localhost:3000";
const sample = JSON.parse(readFileSync(resolve(OUT_DIR, "sample.json"), "utf8"));

let admin = null;
if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function scoreOne(rep) {
  const body = { transcript: rep.transcript, promptText: rep.prompt, durationMs: Math.round(rep.duration_s * 1000) };
  if (rep.audio_path && admin) {
    const { data } = await admin.storage.from("rep-audio").createSignedUrl(rep.audio_path, 3600);
    if (data?.signedUrl) body.audioUrl = data.signedUrl;
  }
  const res = await fetch(`${BASE_URL}/api/score`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(env.CALIBRATION_GUEST_ID ? { cookie: `cognify_guest_id=${env.CALIBRATION_GUEST_ID}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${rep.rep_id}`);
  const score = await res.json();
  if (score.modelVersion === "mock-fallback-v1") throw new Error(`mock fallback for ${rep.rep_id} — provider down; aborting run`);
  return score;
}

const out = {};
for (const rep of sample.reps) {
  const scores = [];
  for (let i = 0; i < runs; i++) scores.push(await scoreOne(rep));
  const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  out[rep.rep_id] = {
    composite: med(scores.map((s) => s.composite)),
    model_version: scores[0].modelVersion,
    rubric_version: scores[0].rubricVersion,
    scores: Object.fromEntries(DIMS.map((d) => [d, med(scores.map((s) => s.dimensions.find((x) => x.dimension === d)?.score ?? NaN))])),
    headline: scores[0].headline ?? null,
    coach_focus: scores[0].coachFocus ?? null,
    graded_from_audio: scores.map((s) => !!s.prosodyAvailable),
    runs: scores.length,
  };
  process.stdout.write(`.${rep.order % 10 === 0 ? ` ${rep.order}\n` : ""}`);
}
const file = `model-scores.${label}.json`;
writeFileSync(resolve(OUT_DIR, file), JSON.stringify(out, null, 2));
console.log(`\nwrote ${file}; scoring against the human labels…`);
try {
  execFileSync(process.execPath, [resolve(OUT_DIR, "../../../scripts/calibration/human-labeling/scoring.mjs"), "--model", file, "--label", label], { stdio: "inherit" });
} catch { console.log("(labels not complete yet — run scoring.mjs once both sheets are filled)"); }
