/**
 * Prosody v2 harness — run the prosody worker over the 15 audio-grading fixtures
 * (served from the bucket's calibration-audio/ copies) and assert against
 * tests/fixtures/audio-grading/features.json ground truth. Records per-call latency
 * (part of the GL1 baseline). Read-only + signed-URL reads; no DB writes.
 *
 *   PROSODY_ENV_FILE=<pulled prod env> node scripts/qa/prosody-v2/fixtures-run.mjs
 *   ... [--worker-url URL] [--worker-token TOK] [--label v2]   # point at a candidate worker
 *
 * Ground-truth comparisons (v1 EXPECTATIONS — these are baseline records, not the
 * GW gates; GW2/GW3 pass/fail applies to worker v2 in Phase 2):
 *   pitchStdSemitones within ±0.5 st of features.json
 *   monotoneRatio: flat ≥0.8, expressive ≤0.3 (features.json values)
 *   all fields non-null for every fixture
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { env, ROOT, OUT_DIR, pctl } from "./db.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, xs) => (a.startsWith("--") ? [a.slice(2), xs[i + 1]] : [])).filter((p) => p.length));
const WORKER_URL = args["worker-url"] ?? env.PROSODY_WORKER_URL;
const WORKER_TOKEN = args["worker-token"] ?? env.PROSODY_WORKER_TOKEN;
const LABEL = args.label ?? "v1";
if (!WORKER_URL) throw new Error("worker URL missing — pass --worker-url or set PROSODY_WORKER_URL (PROSODY_ENV_FILE=<vercel env pull file> works too)");

const manifest = JSON.parse(readFileSync(resolve(ROOT, "tests/fixtures/audio-grading/manifest.json"), "utf8"));
const truth = JSON.parse(readFileSync(resolve(ROOT, "tests/fixtures/audio-grading/features.json"), "utf8"));
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const results = [];
for (const fx of manifest.fixtures) {
  const path = `calibration-audio/${fx.file}`;
  const { data, error } = await admin.storage.from("rep-audio").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw new Error(`sign ${path}: ${error?.message ?? "no url"}`);
  const t0 = Date.now();
  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...(WORKER_TOKEN ? { authorization: `Bearer ${WORKER_TOKEN}` } : {}) },
    body: JSON.stringify({ audioUrl: data.signedUrl, durationMs: Math.round((truth[fx.file]?.durationSec ?? 30) * 1000) }),
  });
  const ms = Date.now() - t0;
  if (!res.ok) throw new Error(`worker ${res.status} on ${fx.file}: ${(await res.text()).slice(0, 200)}`);
  const features = await res.json();
  const gt = truth[fx.file] ?? {};
  const checks = {
    all_fields_present: ["pitchMeanHz", "pitchStdSemitones", "pitchRangeSemitones", "monotoneRatio", "upspeakRatio", "rmsMean", "rmsStd", "articulationScore"].every((k) => features[k] != null),
    pitch_std_close: features.pitchStdSemitones != null && gt.pitchStdSemitones != null && Math.abs(features.pitchStdSemitones - gt.pitchStdSemitones) <= 0.5,
    monotone_direction: fx.style === "flat" ? features.monotoneRatio >= 0.8 : fx.style === "expressive" ? features.monotoneRatio <= 0.3 : true,
  };
  results.push({ file: fx.file, style: fx.style, scriptId: fx.scriptId, latency_ms: ms, features, ground_truth: gt, checks, ok: Object.values(checks).every(Boolean) });
  console.log(`${checks.all_fields_present && checks.pitch_std_close && checks.monotone_direction ? "ok  " : "FAIL"} ${fx.file} std=${features.pitchStdSemitones} (gt ${gt.pitchStdSemitones}) mono=${features.monotoneRatio} up=${features.upspeakRatio} ${ms}ms`);
}
const lat = results.map((r) => r.latency_ms);
const summary = { generated_at: new Date().toISOString(), worker: { url: WORKER_URL, label: LABEL }, pass: results.filter((r) => r.ok).length, total: results.length, latency_ms: { p50: pctl(lat, 50), p90: pctl(lat, 90) }, results };
const out = resolve(OUT_DIR, `fixtures-${LABEL}-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(out, JSON.stringify(summary, null, 2));
console.log(`${summary.pass}/${summary.total} fixtures ok · worker latency p50 ${summary.latency_ms.p50}ms p90 ${summary.latency_ms.p90}ms → ${out}`);
process.exit(summary.pass === summary.total ? 0 : 1);
