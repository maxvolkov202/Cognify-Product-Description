/**
 * Prosody v2 harness — deterministic tone-core score vs the stored LLM tone score,
 * per audio rep with cached prosody features, plus distribution stats (GP1 material).
 * Read-only. Run with tsx (imports the real tone-core):
 *
 *   npx tsx scripts/qa/prosody-v2/score-compare.ts [--fixtures <fixtures-run output.json>]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
// @ts-ignore .mjs helper without types
import { sql, maskEmail, OUT_DIR, pctl, sd, mean, isRealRep, isTestEmail } from "./db.mjs";
import { scoreToneFromProsody, blendToneWithModel } from "../../../src/lib/scoring/tone-core";

async function main() {
const args = Object.fromEntries(process.argv.slice(2).map((a, i, xs) => (a.startsWith("--") ? [a.slice(2), xs[i + 1]] : [])).filter((p) => p.length > 0));

const reps = await sql`
  select r.id, r.audio_url, r.created_at, r.model_version, u.email, d.score as tone_llm,
         c.features, t.graded_from_audio
  from cognify_v2.reps r
  join cognify_v2.users u on u.id = r.user_id
  left join cognify_v2.dimension_scores d on d.rep_id = r.id and d.dimension = 'tone'
  left join cognify_v2.audio_prosody_cache c on c.path = r.audio_url and c.status = 'ready'
  left join cognify_v2.scoring_telemetry t on t.rep_id = r.id
  where r.audio_url is not null
  order by r.created_at desc`;
await sql.end();

const rows = reps.map((r: any) => {
  const core = r.features ? scoreToneFromProsody(r.features) : null;
  return {
    rep_id: r.id, email: maskEmail(r.email), test: isTestEmail(r.email), real: isRealRep(r), created_at: r.created_at,
    tone_llm: r.tone_llm, graded_from_audio: r.graded_from_audio,
    has_cached_features: r.features != null,
    tone_core: core?.score ?? null,
    tone_blended: core && r.tone_llm != null ? blendToneWithModel(core.score, r.tone_llm) : null,
    core_sub: core?.subScores ?? null,
    delta_core_minus_llm: core && r.tone_llm != null ? core.score - r.tone_llm : null,
  };
});
const stats = (xs: number[]) => ({ n: xs.length, mean: mean(xs), sd: sd(xs), min: Math.min(...xs), max: Math.max(...xs), p50: pctl(xs, 50) });
const llmReal = rows.filter((r: any) => r.real && r.tone_llm != null).map((r: any) => r.tone_llm);
const coreAll = rows.filter((r: any) => r.tone_core != null).map((r: any) => r.tone_core);
const modeShare = (xs: number[]) => { const c = new Map<number, number>(); xs.forEach((x) => c.set(x, (c.get(x) ?? 0) + 1)); return xs.length ? Math.max(...c.values()) / xs.length : null; };

let fixtures = null as any;
if (args.fixtures) {
  const fr = JSON.parse(readFileSync(resolve(String(args.fixtures)), "utf8"));
  fixtures = fr.results.map((x: any) => ({ file: x.file, style: x.style, scriptId: x.scriptId, tone_core: scoreToneFromProsody(x.features)?.score ?? null }));
  const byScript = new Map<string, any>();
  for (const f of fixtures) { if (!byScript.has(f.scriptId)) byScript.set(f.scriptId, {}); byScript.get(f.scriptId)[f.style] = f.tone_core; }
  const pairs = [...byScript.entries()].map(([s, v]) => ({ scriptId: s, flat: v.flat ?? null, expressive: v.expressive ?? null, separation: v.expressive != null && v.flat != null ? v.expressive - v.flat : null }));
  // A null tone_core means the extraction yielded no usable pitch — report it as a
  // failure, never coerce it into the aggregates (Math.max/min would read it as 0).
  const flatVals = fixtures.filter((f: any) => f.style === "flat" && f.tone_core != null).map((f: any) => f.tone_core);
  const exprVals = fixtures.filter((f: any) => f.style === "expressive" && f.tone_core != null).map((f: any) => f.tone_core);
  const seps = pairs.map((p) => p.separation).filter((s): s is number => s != null);
  fixtures = { per_fixture: fixtures, extraction_failures: fixtures.filter((f: any) => f.tone_core == null).map((f: any) => f.file), gf1_baseline: { pairs, flat_max: flatVals.length ? Math.max(...flatVals) : null, expressive_min: exprVals.length ? Math.min(...exprVals) : null, min_separation: seps.length ? Math.min(...seps) : null, pairs_evaluable: seps.length } };
}

const summary = {
  generated_at: new Date().toISOString(),
  llm_tone_real: stats(llmReal), llm_tone_mode_share: modeShare(llmReal),
  core_on_cached: stats(coreAll), core_mode_share: modeShare(coreAll),
  gp1_note: "GP1 (sd>=8, no value >40%) applies to the v2 core at Phase 3; these are v1-curve baselines",
  fixtures, rows,
};
const out = resolve(OUT_DIR, `score-compare-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(out, JSON.stringify(summary, null, 2));
const { rows: _r, fixtures: _f, ...head } = summary;
console.log(JSON.stringify(head, null, 2));
if (fixtures) console.log("GF1 baseline (v1 curves on v1 features):", JSON.stringify(fixtures.gf1_baseline, null, 2));
console.log(`→ ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
