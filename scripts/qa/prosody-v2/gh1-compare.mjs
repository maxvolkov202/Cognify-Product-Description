/**
 * Prosody v2 — GH1 evaluator (plan §4): model tone vs HUMAN tone labels.
 * Built ahead of the sheets being filled so Phase 6 is one command:
 *
 *   npx tsx scripts/qa/prosody-v2/gh1-compare.mjs
 *
 * Inputs (HUMAN_LABELING_DIR overridable, defaults to the frozen packet dir):
 *   labeling-sheet-A.csv / -B.csv    tone_band 1-5 on the 11 packet audio reps
 *   model-scores.hidden.json         the CURRENT-pipeline tone at label time
 *   fixture-mini-sheet-A/B.csv       tone_0_100 on the 15 masked fixture clips
 *   fixture-mini-key.hidden.json     clip → fixture mapping (opened ONLY here)
 *   tests/fixtures/audio-grading/features-v2.json   v2 vectors for the fixtures
 *
 * v2 candidate per rep = blendToneWithModel(tone-core v2 on v2 features, the
 * stored LLM tone) — exactly what prod produces with the flag on. Packet reps'
 * v2 features come from the DEPLOYED worker at run time (fresh extraction —
 * their cache rows may predate v2).
 *
 * GH1 passes when: band agreement ≥70% AND v2 MAE ≤12 AND v2 MAE ≤ current MAE.
 * Humans: mean of A and B per rep (run scoring.mjs adjudication first if the
 * raters were >1 band apart; this script warns on those rows).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { OUT_DIR as PACKET_DIR, BAND_MIDPOINT, bandOf, parseCsv } from "../../calibration/human-labeling/_shared.mjs";
import { env, ROOT, OUT_DIR, mean } from "./db.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, xs) => (a.startsWith("--") ? [a.slice(2), xs[i + 1]] : [])).filter((p) => p.length));
const WORKER_URL = args["worker-url"] ?? env.PROSODY_WORKER_URL;
const WORKER_TOKEN = args["worker-token"] ?? env.PROSODY_WORKER_TOKEN;

// tone-core is TS — run this file with tsx (see header usage).
const { scoreToneFromProsody, blendToneWithModel } = await import("../../../src/lib/scoring/tone-core.ts");

const mae = (pairs) => mean(pairs.map(([a, b]) => Math.abs(a - b)));
const readSheet = (name) => {
  const p = resolve(PACKET_DIR, name);
  if (!existsSync(p)) throw new Error(`${name} missing — sheets not distributed/filled yet?`);
  return parseCsv(readFileSync(p, "utf8"));
};

const rows = [];

// ── Packet audio reps (sheets A/B, tone_band 1-5) ──
{
  const A = readSheet("labeling-sheet-A.csv");
  const B = readSheet("labeling-sheet-B.csv");
  const hidden = JSON.parse(readFileSync(resolve(PACKET_DIR, "model-scores.hidden.json"), "utf8"));
  const sample = JSON.parse(readFileSync(resolve(PACKET_DIR, "sample.json"), "utf8"));
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const bById = new Map(B.map((r) => [r.rep_id, r]));
  for (const a of A) {
    const rep = sample.reps.find((r) => r.rep_id === a.rep_id);
    if (!rep?.audio_path) continue; // GH1 is audio-only
    const b = bById.get(a.rep_id);
    const bandA = parseInt(a.tone_band, 10);
    const bandB = parseInt(b?.tone_band ?? "", 10);
    if (!Number.isFinite(bandA) || !Number.isFinite(bandB)) continue; // unfilled row
    if (Math.abs(bandA - bandB) > 1) console.warn(`[gh1] raters >1 band apart on ${a.rep_id} — adjudicate before trusting`);
    const human = mean([BAND_MIDPOINT[bandA], BAND_MIDPOINT[bandB]]);
    const current = hidden[a.rep_id]?.scores?.tone ?? null;
    // Fresh v2 extraction for the rep's audio.
    let core = null;
    const { data } = await admin.storage.from("rep-audio").createSignedUrl(rep.audio_path, 3600);
    if (data?.signedUrl && WORKER_URL) {
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "content-type": "application/json", ...(WORKER_TOKEN ? { authorization: `Bearer ${WORKER_TOKEN}` } : {}) },
        body: JSON.stringify({ audioUrl: data.signedUrl, durationMs: Math.round(rep.duration_s * 1000) }),
      });
      if (res.ok) core = scoreToneFromProsody(await res.json())?.score ?? null;
    }
    const v2 = core != null ? blendToneWithModel(core, current ?? undefined) : null;
    rows.push({ source: "packet", id: a.rep_id, human, current, v2, core });
  }
}

// ── Fixture mini-sheet (tone_0_100 on masked clips) ──
{
  const A = readSheet("fixture-mini-sheet-A.csv");
  const B = readSheet("fixture-mini-sheet-B.csv");
  const key = JSON.parse(readFileSync(resolve(PACKET_DIR, "fixture-mini-key.hidden.json"), "utf8"));
  const vectors = JSON.parse(readFileSync(resolve(ROOT, "tests/fixtures/audio-grading/features-v2.json"), "utf8")).fixtures;
  // Current-pipeline tone for fixtures = the newest seed batch's stored LLM tone.
  const seedTag = args["seed-batch"] ?? "phase4-panel";
  const seed = JSON.parse(readFileSync(resolve(OUT_DIR, `seed-batch-${seedTag}.json`), "utf8"));
  const seedTone = new Map(seed.reps.map((r) => [r.file, r.tone]));
  const bByClip = new Map(B.map((r) => [r.clip_id, r]));
  for (const a of A) {
    const b = bByClip.get(a.clip_id);
    const tA = parseFloat(a.tone_0_100);
    const tB = parseFloat(b?.tone_0_100 ?? "");
    if (!Number.isFinite(tA) || !Number.isFinite(tB)) continue;
    const clip = key.clips.find((c) => c.clip_id === a.clip_id);
    const vec = clip && vectors[clip.file];
    if (!vec) continue;
    const human = mean([tA, tB]);
    const current = seedTone.get(clip.file) ?? null;
    const core = scoreToneFromProsody(vec.features)?.score ?? null;
    const v2 = core != null ? blendToneWithModel(core, current ?? undefined) : null;
    rows.push({ source: "fixture", id: clip.file, style: clip.style, human, current, v2, core });
  }
}

const usable = rows.filter((r) => r.human != null && r.v2 != null && r.current != null);
if (usable.length === 0) {
  console.error("[gh1] no usable labeled rows — are the sheets filled?");
  process.exit(2);
}
const v2Mae = mae(usable.map((r) => [r.v2, r.human]));
const currentMae = mae(usable.map((r) => [r.current, r.human]));
const bandAgree = usable.filter((r) => bandOf(r.v2) === bandOf(r.human)).length / usable.length;
const verdict = {
  n: usable.length,
  band_agreement: +bandAgree.toFixed(3),
  v2_mae: +v2Mae.toFixed(2),
  current_mae: +currentMae.toFixed(2),
  gh1_pass: bandAgree >= 0.7 && v2Mae <= 12 && v2Mae <= currentMae,
  gates: "band agreement >=70% AND v2 MAE <=12 AND v2 MAE <= current MAE",
};
writeFileSync(resolve(OUT_DIR, "gh1-verdict.json"), JSON.stringify({ ...verdict, rows }, null, 2));
console.log(JSON.stringify(verdict, null, 2));
for (const r of rows) console.log(`${r.source} ${String(r.id).slice(0, 44)} human=${r.human} current=${r.current} core=${r.core} v2=${r.v2}`);
console.log(`GH1: ${verdict.gh1_pass ? "PASS" : "FAIL"} → ${resolve(OUT_DIR, "gh1-verdict.json")}`);
process.exit(verdict.gh1_pass ? 0 : 1);
