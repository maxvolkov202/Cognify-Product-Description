/**
 * Prosody v2 — GH1 evaluator (plan §4): model tone vs HUMAN tone labels.
 * Built ahead of the sheets being filled so Phase 6 is one command:
 *
 *   PROSODY_ENV_FILE=<vercel env pull file> npx tsx scripts/qa/prosody-v2/gh1-compare.mjs
 *
 * Inputs (HUMAN_LABELING_DIR overridable):
 *   labeling-sheet-A/B.csv + optional adjudicated.csv (AUTHORITATIVE where present)
 *   model-scores.hidden.json      the CURRENT-pipeline tone at label time
 *   fixture-mini-sheet-A/B.csv + fixture-mini-key.hidden.json
 *   out/seed-batch-<tag>.json     fixture "current" baseline — must be a PROD
 *                                 batch (this script VERIFIES the stored tones
 *                                 carry no [toneCore: tag; a dev-seeded batch
 *                                 would be core-blended and self-referential)
 *
 * The v2 candidate reproduces prod's full path: fresh worker-v2 extraction →
 * withAlignedTailRatios against the rep's STORED Deepgram words →
 * scoreToneFromProsody → blendToneWithModel with the stored LLM tone.
 *
 * Pre-registered scoring details (fixed 2026-09-02, before any sheet was
 * filled): human value = adjudicated band midpoint where adjudicated, else the
 * mean of the two raters' midpoints; band agreement = bandOf(v2) equals the
 * adjudicated band, or (unadjudicated) equals EITHER rater's band — the
 * midpoint-mean of an adjacent split lands exactly on a band boundary, and
 * resolving that by bandOf's <= would systematically favor a low-scoring
 * model. Rows failing extraction/signing are REPORTED, never silently
 * dropped; the verdict aborts unless both arms contributed rows.
 *
 * GH1 passes when: band agreement ≥70% AND v2 MAE ≤12 AND v2 MAE ≤ current MAE.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  OUT_DIR as PACKET_DIR, BAND_MIDPOINT, bandOf, parseCsv, parseArgs, mae,
} from "../../calibration/human-labeling/_shared.mjs";
import { env, sql, ROOT, OUT_DIR, mean } from "./db.mjs";

const args = parseArgs(process.argv.slice(2), { flags: [], options: ["worker-url", "worker-token", "seed-batch"] });
const WORKER_URL = args["worker-url"] ?? env.PROSODY_WORKER_URL;
const WORKER_TOKEN = args["worker-token"] ?? env.PROSODY_WORKER_TOKEN;
if (!WORKER_URL) throw new Error("worker URL missing — set PROSODY_ENV_FILE or pass --worker-url (the v2 candidate needs fresh extractions)");

const { scoreToneFromProsody, blendToneWithModel } = await import("../../../src/lib/scoring/tone-core.ts");
const { withAlignedTailRatios } = await import("../../../src/lib/audio/prosody-align.ts");

const readSheet = (name, required = true) => {
  const p = resolve(PACKET_DIR, name);
  if (!existsSync(p)) {
    if (required) throw new Error(`${name} missing — sheets not distributed/filled yet?`);
    return null;
  }
  return parseCsv(readFileSync(p, "utf8"));
};
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
async function extractAligned(audioPath, words, durationMs) {
  const { data, error } = await admin.storage.from("rep-audio").createSignedUrl(audioPath, 3600);
  if (error || !data?.signedUrl) throw new Error(`sign: ${error?.message ?? "no url"}`);
  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...(WORKER_TOKEN ? { authorization: `Bearer ${WORKER_TOKEN}` } : {}) },
    body: JSON.stringify({ audioUrl: data.signedUrl, durationMs }),
  });
  if (!res.ok) throw new Error(`worker ${res.status}`);
  const features = await res.json();
  // Prod's exact scoring-time step (P2): align segment tails with stored words.
  return withAlignedTailRatios(features, words ?? null);
}
const bandIn = (v) => { const b = parseInt(v, 10); return b >= 1 && b <= 5 ? b : null; };

const rows = [];
const dropped = [];

// ── Packet audio reps ──
{
  const A = readSheet("labeling-sheet-A.csv");
  const B = readSheet("labeling-sheet-B.csv");
  const adjudicated = readSheet("adjudicated.csv", false);
  const hidden = JSON.parse(readFileSync(resolve(PACKET_DIR, "model-scores.hidden.json"), "utf8"));
  const sample = JSON.parse(readFileSync(resolve(PACKET_DIR, "sample.json"), "utf8"));
  const audioReps = sample.reps.filter((r) => r.audio_path);
  const wordRows = await sql`
    select id, transcript->'words' as words, duration_ms from cognify_v2.reps
    where id in ${sql(audioReps.map((r) => r.rep_id))}`;
  const wordsById = new Map(wordRows.map((r) => [r.id, r]));
  const bById = new Map(B.map((r) => [r.rep_id, r]));
  const adjById = new Map((adjudicated ?? []).map((r) => [r.rep_id, r]));
  for (const rep of audioReps) {
    const a = A.find((r) => r.rep_id === rep.rep_id);
    const adj = adjById.get(rep.rep_id);
    const adjBand = adj ? bandIn(adj.tone_band) : null;
    const bandA = bandIn(a?.tone_band);
    const bandB = bandIn(bById.get(rep.rep_id)?.tone_band);
    if (adjBand == null && (bandA == null || bandB == null)) {
      if (a?.tone_band || bById.get(rep.rep_id)?.tone_band)
        dropped.push({ source: "packet", id: rep.rep_id, reason: `tone_band outside 1-5 (A=${a?.tone_band} B=${bById.get(rep.rep_id)?.tone_band})` });
      continue; // unfilled or invalid
    }
    if (adjBand == null && Math.abs(bandA - bandB) > 1)
      console.warn(`[gh1] raters ${Math.abs(bandA - bandB)} bands apart on ${rep.rep_id} and no adjudicated.csv row — adjudicate before trusting`);
    const human = adjBand != null ? BAND_MIDPOINT[adjBand] : mean([BAND_MIDPOINT[bandA], BAND_MIDPOINT[bandB]]);
    const humanBands = adjBand != null ? [adjBand] : [bandA, bandB];
    const current = hidden[rep.rep_id]?.scores?.tone ?? null;
    try {
      const w = wordsById.get(rep.rep_id);
      const aligned = await extractAligned(rep.audio_path, w?.words ?? null, w?.duration_ms ?? Math.round(rep.duration_s * 1000));
      const core = scoreToneFromProsody(aligned)?.score ?? null;
      if (core == null) throw new Error("no pitch extracted");
      rows.push({ source: "packet", id: rep.rep_id, human, humanBands, current, core, v2: blendToneWithModel(core, current ?? undefined) });
    } catch (err) {
      dropped.push({ source: "packet", id: rep.rep_id, reason: String(err).slice(0, 120) });
    }
  }
}

// ── Fixture mini-sheet ──
{
  const A = readSheet("fixture-mini-sheet-A.csv");
  const B = readSheet("fixture-mini-sheet-B.csv");
  const key = JSON.parse(readFileSync(resolve(PACKET_DIR, "fixture-mini-key.hidden.json"), "utf8"));
  const seedTag = args["seed-batch"] ?? "phase4-panel";
  const seedPath = resolve(OUT_DIR, `seed-batch-${seedTag}.json`);
  if (!existsSync(seedPath)) {
    const avail = readdirSync(OUT_DIR).filter((f) => f.startsWith("seed-batch-"));
    throw new Error(`seed batch ${seedPath} missing (available: ${avail.join(", ") || "none"}) — re-seed or pass --seed-batch`);
  }
  const seed = JSON.parse(readFileSync(seedPath, "utf8"));
  // The fixture "current" baseline must be PURE LLM tone: a batch seeded where
  // FF_TONE_PROSODY_CORE was on would be core-blended (self-referential gate).
  const tagCheck = await sql`
    select count(*)::int as n from cognify_v2.dimension_scores
    where dimension = 'tone' and rep_id in ${sql(seed.reps.map((r) => r.id))}
      and signals::text like '%[toneCore:%'`;
  if (tagCheck[0].n > 0) throw new Error(`seed batch ${seedTag} has ${tagCheck[0].n} core-blended tone scores — use a batch seeded with FF_TONE_PROSODY_CORE off (prod)`);
  const seedByFile = new Map(seed.reps.map((r) => [r.file, r]));
  const bByClip = new Map(B.map((r) => [r.clip_id, r]));
  for (const a of A) {
    const b = bByClip.get(a.clip_id);
    const tA = parseFloat(a.tone_0_100);
    const tB = parseFloat(b?.tone_0_100 ?? "");
    if (!Number.isFinite(tA) || !Number.isFinite(tB)) continue; // unfilled
    if (tA < 0 || tA > 100 || tB < 0 || tB > 100) {
      dropped.push({ source: "fixture", id: a.clip_id, reason: `tone_0_100 outside 0-100 (A=${tA} B=${tB})` });
      continue;
    }
    if (Math.abs(tA - tB) > 20) console.warn(`[gh1] raters ${Math.abs(tA - tB)} points apart on ${a.clip_id} — discuss before trusting`);
    const clip = key.clips.find((c) => c.clip_id === a.clip_id);
    const seedRep = clip && seedByFile.get(clip.file);
    if (!seedRep) { dropped.push({ source: "fixture", id: a.clip_id, reason: "no seed-batch rep for clip" }); continue; }
    try {
      const w = (await sql`select transcript->'words' as words, audio_url, duration_ms from cognify_v2.reps where id = ${seedRep.id}`)[0];
      const aligned = await extractAligned(w.audio_url, w.words ?? null, w.duration_ms ?? 30_000);
      const core = scoreToneFromProsody(aligned)?.score ?? null;
      if (core == null) throw new Error("no pitch extracted");
      const human = mean([tA, tB]);
      rows.push({ source: "fixture", id: clip.file, style: clip.style, human, humanBands: [bandOf(human)], current: seedRep.tone, core, v2: blendToneWithModel(core, seedRep.tone ?? undefined) });
    } catch (err) {
      dropped.push({ source: "fixture", id: a.clip_id, reason: String(err).slice(0, 120) });
    }
  }
}
await sql.end();

const usable = rows.filter((r) => r.human != null && Number.isFinite(r.human) && r.v2 != null && r.current != null);
const packetN = usable.filter((r) => r.source === "packet").length;
const fixtureN = usable.filter((r) => r.source === "fixture").length;
for (const d of dropped) console.warn(`[gh1] DROPPED ${d.source} ${d.id}: ${d.reason}`);
if (packetN === 0 || fixtureN === 0) {
  console.error(`[gh1] INVALID RUN: packet rows=${packetN} fixture rows=${fixtureN} (dropped=${dropped.length}) — both arms must contribute; are the sheets filled and the worker reachable?`);
  process.exit(2);
}
const v2Mae = mae(usable.map((r) => r.v2), usable.map((r) => r.human));
const currentMae = mae(usable.map((r) => r.current), usable.map((r) => r.human));
const bandAgree = usable.filter((r) => r.humanBands.includes(bandOf(r.v2))).length / usable.length;
const verdict = {
  n: usable.length, packet_n: packetN, fixture_n: fixtureN, dropped: dropped.length,
  band_agreement: +bandAgree.toFixed(3),
  v2_mae: +v2Mae.toFixed(2),
  current_mae: +currentMae.toFixed(2),
  gh1_pass: bandAgree >= 0.7 && v2Mae <= 12 && v2Mae <= currentMae,
  gates: "band agreement >=70% AND v2 MAE <=12 AND v2 MAE <= current MAE (agreement counts a match with the adjudicated band, or either rater's band when unadjudicated)",
};
writeFileSync(resolve(OUT_DIR, "gh1-verdict.json"), JSON.stringify({ ...verdict, rows, dropped }, null, 2));
console.log(JSON.stringify(verdict, null, 2));
for (const r of rows) console.log(`${r.source} ${String(r.id).slice(0, 44)} human=${r.human} current=${r.current} core=${r.core} v2=${r.v2}`);
console.log(`GH1: ${verdict.gh1_pass ? "PASS" : "FAIL"} → ${resolve(OUT_DIR, "gh1-verdict.json")}`);
process.exit(verdict.gh1_pass ? 0 : 1);
