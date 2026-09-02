/**
 * Prosody v2 harness — assemble the Phase 1 BASELINE (the GL1 anchor + feature/score
 * snapshot) from the other harness outputs plus read-only telemetry latency stats.
 *
 *   node scripts/qa/prosody-v2/baseline.mjs --fixtures out/fixtures-v1-<d>.json \
 *     --scores out/score-compare-<d>.json --inventory out/inventory-<d>.json \
 *     --seed-batch out/seed-batch-<tag>.json
 *
 * Writes out/baseline-2026-09.json (gitignored) and prints the tracker summary table.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql, OUT_DIR, pctl, isRealRep, isTestEmail } from "./db.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, xs) => (a.startsWith("--") ? [a.slice(2), xs[i + 1]] : [])).filter((p) => p.length));
const load = (k) => (args[k] ? JSON.parse(readFileSync(resolve(args[k]), "utf8")) : null);
const fixtures = load("fixtures"), scores = load("scores"), inventory = load("inventory"), seedBatch = load("seed-batch");

// Audio-path scoring latency from telemetry (server + client), real vs test.
const tel = await sql`
  select t.total_server_duration_ms as server_ms, t.client_e2e_ms, t.prosody_ms, t.graded_from_audio,
         u.email, r.model_version, t.created_at
  from cognify_v2.scoring_telemetry t
  join cognify_v2.reps r on r.id = t.rep_id
  left join cognify_v2.users u on u.id = r.user_id
  where r.audio_url is not null`;
await sql.end();
const lat = (rows, key) => { const xs = rows.map((r) => r[key]).filter((v) => v != null && v > 0); return { n: xs.length, p50: pctl(xs, 50), p90: pctl(xs, 90) }; };
// real = the full definition (email AND model_version) — mock/seed reps take a
// different scoring path and would contaminate the GL1 anchor.
const real = tel.filter((t) => isRealRep(t)), test = tel.filter((t) => isTestEmail(t.email));
const seedRows = seedBatch?.reps ?? [];

const baseline = {
  generated_at: new Date().toISOString(),
  phase: "1 — pre-worker-v2 baseline (v1 worker, v1 tone-core curves, FF_TONE_PROSODY_CORE off in prod)",
  worker_v1: {
    url: fixtures?.worker?.url ?? null,
    fixtures_ground_truth: fixtures ? { pass: fixtures.pass, total: fixtures.total, extraction_latency_ms: fixtures.latency_ms } : null,
  },
  tone_scores: scores ? { llm_real: scores.llm_tone_real, llm_mode_share: scores.llm_tone_mode_share, core_v1_on_cached: scores.core_on_cached, core_mode_share: scores.core_mode_share, gf1_v1_curves: scores.fixtures?.gf1_baseline ?? null } : null,
  audio_reps: inventory?.audio_reps ?? null,
  gl1_anchor: {
    note: "audio-path scoring latency; GL1 = worker v2 adds <= +200ms to server p50",
    server_ms: { real: lat(real, "server_ms"), test: lat(test, "server_ms"), seed_batch: lat(seedRows, "total_server_duration_ms") },
    client_e2e_ms: { real: lat(real, "client_e2e_ms"), test: lat(test, "client_e2e_ms"), seed_batch: lat(seedRows, "client_e2e_ms") },
    prosody_ms: { all: lat(tel, "prosody_ms"), seed_batch: lat(seedRows, "prosody_ms") },
    graded_from_audio_rate: { real: real.length ? real.filter((t) => t.graded_from_audio).length / real.length : null, seed_batch: seedRows.length ? seedRows.filter((r) => r.graded_from_audio).length / seedRows.length : null },
  },
  seed_batch: seedBatch ? { tag: seedBatch.tag, succeeded: seedBatch.succeeded, attempted: seedBatch.attempted, tones: seedRows.map((r) => ({ file: r.file ?? null, style: r.style ?? null, tone: r.tone, graded_from_audio: r.graded_from_audio })) } : null,
};
const out = resolve(OUT_DIR, "baseline-2026-09.json");
writeFileSync(out, JSON.stringify(baseline, null, 2));
console.log(JSON.stringify(baseline, null, 2));
console.log(`→ ${out}`);
