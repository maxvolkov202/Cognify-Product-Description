/**
 * Prosody v2 harness — GF2: no content-dim movement from prosody changes.
 * Scores the kind="audio-tone" calibration reps through a LOCAL dev server
 * (which points at worker v1 or v2 via PROSODY_WORKER_URL) and records ALL six
 * dimensions per clip; --diff compares two runs against the ±15 per-dim noise
 * floor on the content dims (clarity/structure/conciseness/thinking_quality).
 * Tone/delivery movement is recorded for the tracker but does NOT fail GF2
 * (tone is EXPECTED to move — that is the point of worker v2; Phase 3 retunes).
 *
 *   CALIBRATION_GUEST_ID=<uuid> node scripts/qa/prosody-v2/gf2-compare.mjs --label v1
 *   node scripts/qa/prosody-v2/gf2-compare.mjs --diff out/gf2-v1.json out/gf2-v2.json
 *
 * DB read-only (signs bucket clips); /api/score writes only telemetry rows,
 * under the fixed calibration guest.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { env, ROOT, OUT_DIR } from "./env.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, xs) => (a.startsWith("--") ? [a.slice(2), xs[i + 1]] : [])).filter((p) => p.length));
const BASE_URL = env.DEV_BASE_URL ?? "http://127.0.0.1:3333";
const CONTENT_DIMS = ["clarity", "structure", "conciseness", "thinking_quality"];
const ALL_DIMS = [...CONTENT_DIMS, "delivery", "tone"];
const NOISE_FLOOR = 15;

if ("diff" in args) {
  const [aPath, bPath] = process.argv.slice(process.argv.indexOf("--diff") + 1);
  const a = JSON.parse(readFileSync(resolve(aPath), "utf8"));
  const b = JSON.parse(readFileSync(resolve(bPath), "utf8"));
  const rows = [];
  let contentViolations = 0;
  for (const ra of a.results) {
    const rb = b.results.find((r) => r.id === ra.id);
    if (!rb || ra.error || rb.error) { rows.push({ id: ra.id, error: ra.error ?? rb?.error ?? "missing in B" }); continue; }
    const deltas = Object.fromEntries(ALL_DIMS.map((d) => [d, rb.dims[d] != null && ra.dims[d] != null ? rb.dims[d] - ra.dims[d] : null]));
    const violations = CONTENT_DIMS.filter((d) => deltas[d] != null && Math.abs(deltas[d]) > NOISE_FLOOR);
    contentViolations += violations.length;
    rows.push({ id: ra.id, deltas, content_violations: violations });
  }
  const maxAbs = (d) => Math.max(0, ...rows.filter((r) => r.deltas?.[d] != null).map((r) => Math.abs(r.deltas[d])));
  const summary = {
    a: a.label, b: b.label, noise_floor: NOISE_FLOOR,
    gf2_pass: contentViolations === 0,
    content_violations: contentViolations,
    max_abs_delta: Object.fromEntries(ALL_DIMS.map((d) => [d, maxAbs(d)])),
    rows,
  };
  const out = resolve(OUT_DIR, `gf2-diff-${a.label}-vs-${b.label}.json`);
  writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ...summary, rows: undefined }, null, 2));
  for (const r of rows) console.log(r.id, r.error ?? JSON.stringify(r.deltas));
  console.log(`GF2 ${summary.gf2_pass ? "PASS" : "FAIL"} (${contentViolations} content-dim moves > ±${NOISE_FLOOR}) → ${out}`);
  process.exit(summary.gf2_pass ? 0 : 1);
}

const LABEL = args.label;
if (!LABEL) throw new Error("--label required (e.g. v1 / v2)");
if (!process.env.CALIBRATION_GUEST_ID) throw new Error("CALIBRATION_GUEST_ID required (one FIXED uuid across compared runs)");
const bank = JSON.parse(readFileSync(resolve(ROOT, "scripts/calibration/reference-reps.json"), "utf8"));
const reps = bank.reps.filter((r) => r.kind === "audio-tone");
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const results = [];
for (const rep of reps) {
  const { data, error } = await admin.storage.from("rep-audio").createSignedUrl(rep.storagePath, 3600);
  if (error || !data?.signedUrl) { results.push({ id: rep.id, error: `sign: ${error?.message}` }); continue; }
  try {
    const res = await fetch(`${BASE_URL}/api/score`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `cognify_guest_id=${process.env.CALIBRATION_GUEST_ID}` },
      body: JSON.stringify({ transcript: rep.transcript, promptText: rep.promptText, durationMs: rep.durationMs, audioUrl: data.signedUrl }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const score = await res.json();
    const dims = Object.fromEntries(ALL_DIMS.map((d) => [d, (score.dimensions ?? []).find((x) => x.dimension === d)?.score ?? null]));
    const toneSignals = (score.dimensions ?? []).find((x) => x.dimension === "tone")?.signals ?? [];
    const toneSource = (toneSignals.find((s) => typeof s === "string" && s.includes("[toneSource:")) ?? "").match(/\[toneSource:\s*(\w+)\]/)?.[1] ?? "unknown";
    results.push({ id: rep.id, scriptId: rep.scriptId, style: rep.style, dims, toneSource });
    console.log(`${rep.id} tone=${dims.tone} toneSource=${toneSource}`);
  } catch (err) {
    results.push({ id: rep.id, error: String(err).slice(0, 200) });
    console.log(`${rep.id} ERROR ${String(err).slice(0, 120)}`);
  }
}
const invalid = results.filter((r) => !r.error && r.toneSource !== "prosody");
if (invalid.length) console.warn(`[gf2] WARNING: ${invalid.length} clips graded from text — run is not measuring the worker`);
const out = resolve(OUT_DIR, `gf2-${LABEL}.json`);
writeFileSync(out, JSON.stringify({ label: LABEL, base_url: BASE_URL, generated_at: new Date().toISOString(), results }, null, 2));
console.log(`→ ${out}`);
