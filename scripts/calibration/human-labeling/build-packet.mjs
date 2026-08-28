/**
 * Grading plan WS2 — build the human-labeling packet. DB read-only.
 *
 *   node scripts/calibration/human-labeling/build-packet.mjs [--n 60] [--seed 20260901]
 *
 * Reads prod `cognify_v2` via DATABASE_URL in .env.local (that IS prod —
 * SELECT only here). Writes to plans/calibration/human-labeling-2026-09/:
 *   sample.json                 rep ids + strata + prompt/transcript/audio path
 *   labeling-sheet-A.csv / -B.csv   blind sheets for rater A (Max) and B (Owen Brown)
 *   model-scores.hidden.json    the six model scores + headline + coach focus, kept OUT of the sheets
 *   strata.md                   the strata actually used and the cell counts
 * All four contain user transcripts and are gitignored (public repo).
 *
 * Sampling: exclude @cognify.test accounts, seed-demo-v1, mock-fallback-v1,
 * reps under 5 words. Stratify composite band (<50 / 50-65 / 65-75 / 75+) ×
 * duration tercile × audio present. Audio reps are scarce (11 of 71 at build
 * time) so every audio rep is taken; the remaining slots go to text reps
 * proportionally to their band × tercile cell, seeded PRNG.
 */
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { OUT_DIR, DIMS, compositeBand, loadEnvLocal, mulberry32, toCsv } from "./_shared.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, xs) => (a.startsWith("--") ? [a.slice(2), xs[i + 1]] : [])).filter((p) => p.length));
const N = parseInt(args.n ?? "60", 10);
const SEED = parseInt(args.seed ?? "20260901", 10);
const AUDIO_TTL_S = 7 * 24 * 3600;

const env = { ...loadEnvLocal(), ...process.env };
env.SUPABASE_URL ??= env.NEXT_PUBLIC_SUPABASE_URL;
if (!env.DATABASE_URL) throw new Error("DATABASE_URL missing");
const sql = postgres(env.DATABASE_URL, { ssl: "require", max: 2, prepare: false, idle_timeout: 5 });

const reps = await sql`
  select r.id, r.prompt_text, r.transcript->>'text' as transcript, r.duration_ms, r.audio_url,
         r.composite_score, r.model_version, r.rubric_version, r.created_at, r.user_id,
         r.coach_focus, r.feedback, r.attempt_kind,
         array_length(regexp_split_to_array(coalesce(r.transcript->>'text',''), '\s+'), 1) as word_count
  from cognify_v2.reps r
  join cognify_v2.users u on u.id = r.user_id
  where coalesce(u.email, '') not like '%@cognify.test'
    and r.model_version not in ('seed-demo-v1', 'mock-fallback-v1')
    and r.composite_score is not null
    and coalesce(r.transcript->>'text', '') <> '(seeded demo rep)'
  order by r.created_at`;
const longEnough = reps.filter((r) => (r.word_count ?? 0) >= 5);
const dimRows = await sql`
  select rep_id, dimension::text as dimension, score
  from cognify_v2.dimension_scores where rep_id in ${sql(longEnough.map((r) => r.id))}`;
const dimsByRep = new Map();
for (const d of dimRows) {
  if (!dimsByRep.has(d.rep_id)) dimsByRep.set(d.rep_id, {});
  dimsByRep.get(d.rep_id)[d.dimension] = { score: d.score };
}
await sql.end();
// Only reps graded on the current six dimensions are comparable (v3.2.0+).
// v2-era reps scored relevance/confidence/pacing instead and are skipped.
const eligible = longEnough.filter((r) => DIMS.every((k) => dimsByRep.get(r.id)?.[k]?.score != null));
console.log(`[packet] ${reps.length} real reps → ${longEnough.length} with ≥5 words → ${eligible.length} on the six current dimensions`);

// ── strata ──
const durs = eligible.map((r) => r.duration_ms).sort((a, b) => a - b);
const t1 = durs[Math.floor(durs.length / 3)], t2 = durs[Math.floor((2 * durs.length) / 3)];
const tercile = (ms) => (ms < t1 ? "short" : ms < t2 ? "mid" : "long");
const strataOf = (r) => ({ band: compositeBand(r.composite_score), tercile: tercile(r.duration_ms), audio: r.audio_url ? "audio" : "text" });
const cellKey = (s) => `${s.band}|${s.tercile}|${s.audio}`;

const rng = mulberry32(SEED);
const shuffle = (xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const audioReps = eligible.filter((r) => r.audio_url);
const textReps = eligible.filter((r) => !r.audio_url);
const picked = [...audioReps];
const remaining = Math.max(0, N - picked.length);
// proportional allocation over band×tercile cells of the text pool, largest-remainder rounding
const cells = new Map();
for (const r of textReps) { const k = `${compositeBand(r.composite_score)}|${tercile(r.duration_ms)}`; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(r); }
const quotas = [...cells.entries()].map(([k, rs]) => ({ k, rs: shuffle(rs), exact: (rs.length / textReps.length) * remaining }));
for (const q of quotas) q.take = Math.min(q.rs.length, Math.floor(q.exact));
let left = remaining - quotas.reduce((s, q) => s + q.take, 0);
for (const q of quotas.sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)))) {
  while (left > 0 && q.take < q.rs.length) { q.take++; left--; }
}
for (const q of quotas) picked.push(...q.rs.slice(0, q.take));
const sample = shuffle(picked).slice(0, N);

// ── audio signed links (7 days) ──
let signed = new Map();
if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const paths = sample.filter((r) => r.audio_url).map((r) => r.audio_url);
  if (paths.length) {
    const { data, error } = await admin.storage.from("rep-audio").createSignedUrls(paths, AUDIO_TTL_S);
    if (error) console.warn("[packet] signing failed:", error.message);
    for (const d of data ?? []) if (d.signedUrl) signed.set(d.path, d.signedUrl);
  }
} else console.warn("[packet] SUPABASE_URL / SERVICE_ROLE_KEY missing — audio links left blank");

// ── outputs ──
mkdirSync(OUT_DIR, { recursive: true });
const sampleOut = sample.map((r, i) => ({
  order: i + 1,
  rep_id: r.id,
  strata: strataOf(r),
  prompt: r.prompt_text,
  transcript: r.transcript,
  duration_s: Math.round(r.duration_ms / 100) / 10,
  word_count: r.word_count,
  audio_path: r.audio_url,
  audio_link: r.audio_url ? signed.get(r.audio_url) ?? null : null,
  attempt_kind: r.attempt_kind,
  created_at: r.created_at,
}));
writeFileSync(resolve(OUT_DIR, "sample.json"), JSON.stringify({ built_at: new Date().toISOString(), seed: SEED, n: sample.length, terciles_ms: [t1, t2], reps: sampleOut }, null, 2));

const hidden = {};
for (const r of sample) {
  const d = dimsByRep.get(r.id) ?? {};
  hidden[r.id] = {
    composite: r.composite_score,
    model_version: r.model_version,
    rubric_version: r.rubric_version,
    scores: Object.fromEntries(DIMS.map((k) => [k, d[k]?.score ?? null])),
    dim_feedback: Object.fromEntries(DIMS.map((k) => [k, r.feedback?.skillFeedback?.[k]?.feedback ?? null])),
    headline: r.feedback?.headline ?? null,
    coach_focus: r.coach_focus ?? null,
    stronger_version: r.feedback?.strongerVersion ?? null,
  };
}
writeFileSync(resolve(OUT_DIR, "model-scores.hidden.json"), JSON.stringify(hidden, null, 2));

const sheetCols = ["order", "rep_id", "prompt", "transcript", "audio_link", "duration_s", "headline", "coach_focus",
  "clarity_band", "structure_band", "conciseness_band", "thinking_band", "pacing_band", "tone_band",
  "headline_accurate", "coach_focus_right_lever", "hallucinated_claim", "notes"];
const sheetRows = sampleOut.map((s) => {
  const h = hidden[s.rep_id];
  const cf = h.coach_focus;
  return {
    order: s.order, rep_id: s.rep_id, prompt: s.prompt, transcript: s.transcript, audio_link: s.audio_link ?? "",
    duration_s: s.duration_s,
    headline: h.headline ?? "",
    coach_focus: cf ? [cf.behavior, cf.why, cf.action].filter(Boolean).join(" ") || cf.text || "" : "",
  };
});
for (const rater of ["A", "B"]) writeFileSync(resolve(OUT_DIR, `labeling-sheet-${rater}.csv`), toCsv(sheetRows, sheetCols));

const cellCounts = {};
for (const r of sample) { const k = cellKey(strataOf(r)); cellCounts[k] = (cellCounts[k] ?? 0) + 1; }
const popCounts = {};
for (const r of eligible) { const k = cellKey(strataOf(r)); popCounts[k] = (popCounts[k] ?? 0) + 1; }
const lines = [
  `# Strata used (built ${new Date().toISOString().slice(0, 10)}, seed ${SEED})`, "",
  `Eligible population: ${eligible.length} reps (${audioReps.length} with audio) from ${new Set(eligible.map((r) => r.user_id)).size} users.`,
  `Sample: ${sample.length}. Every audio rep is included; text slots allocated proportionally over composite band × duration tercile.`,
  `Duration terciles: < ${(t1 / 1000).toFixed(1)} s / < ${(t2 / 1000).toFixed(1)} s / longer.`, "",
  "| cell (band \\| tercile \\| audio) | population | sampled |", "|---|---|---|",
  ...Object.keys(popCounts).sort().map((k) => `| ${k} | ${popCounts[k]} | ${cellCounts[k] ?? 0} |`), "",
  "Thin cells: the 75+ band has " + eligible.filter((r) => compositeBand(r.composite_score) === "75+").length + " reps in the whole population; all are candidates, none were backfilled from neighbours (the sample is proportional, not equal-cell).",
];
writeFileSync(resolve(OUT_DIR, "strata.md"), lines.join("\n") + "\n");
console.log(`[packet] eligible=${eligible.length} audio=${audioReps.length} sampled=${sample.length} signed=${signed.size} → ${OUT_DIR}`);
