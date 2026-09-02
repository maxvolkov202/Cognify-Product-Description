/**
 * Prosody v2 Phase 6 — the flip watch (plan §5 Phase 6): read-only snapshot of
 * the first N real beta audio reps after FF_TONE_PROSODY_CORE goes on.
 *
 *   node scripts/qa/prosody-v2/flip-watch.mjs [--since 2026-09-XX] [--limit 50]
 *
 * Reports: tone spread (sd / mode share — GP1 in the wild), graded_from_audio
 * rate, anthropic-fallback share, warm-hit rate (prosody_ms < 500 means the
 * cache served; the in-request fallback runs 1.5-4s), featureVersion mix.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "../../calibration/human-labeling/_shared.mjs";
import { sql, maskEmail, OUT_DIR, pctl, mean, sd, MOCK_MODEL_VERSIONS } from "./db.mjs";

const args = parseArgs(process.argv.slice(2), { flags: [], options: ["since", "limit"] });
const LIMIT = parseInt(args.limit ?? "50", 10);

// The real-rep filter lives in SQL so LIMIT counts REAL reps — on flip day the
// newest rows are dominated by @cognify.test seed/e2e reps, which would
// otherwise dilute or empty the window this table exists to judge.
const rows = await sql`
  select r.id, r.created_at, r.model_version, u.email, d.score as tone,
         t.graded_from_audio, t.prosody_ms, t.model_used,
         c.features->>'featureVersion' as feature_version,
         (d.signals::text like '%[toneCore:%') as tone_core_tagged
  from cognify_v2.reps r
  join cognify_v2.users u on u.id = r.user_id
  left join cognify_v2.dimension_scores d on d.rep_id = r.id and d.dimension = 'tone'
  left join cognify_v2.scoring_telemetry t on t.rep_id = r.id
  left join cognify_v2.audio_prosody_cache c on c.path = r.audio_url
  where r.audio_url is not null
    and coalesce(u.email, '') not like '%@cognify.test'
    and coalesce(r.model_version, '') not in ${sql(MOCK_MODEL_VERSIONS)}
    ${args.since ? sql`and r.created_at >= ${args.since}` : sql``}
  order by r.created_at desc limit ${LIMIT}`;
const [{ n: totalAudio }] = await sql`
  select count(*)::int as n from cognify_v2.reps r
  where r.audio_url is not null ${args.since ? sql`and r.created_at >= ${args.since}` : sql``}`;
await sql.end();

const real = rows;
const tones = real.map((r) => r.tone).filter((v) => v != null);
const modeShare = (xs) => { const c = new Map(); xs.forEach((x) => c.set(x, (c.get(x) ?? 0) + 1)); return xs.length ? Math.max(...c.values()) / xs.length : null; };
const summary = {
  generated_at: new Date().toISOString(),
  window: { since: args.since ?? null, limit: LIMIT, total_audio_reps_in_window: totalAudio },
  real: {
    n: real.length,
    users: new Set(real.map((r) => r.email)).size,
    tone: { n: tones.length, mean: mean(tones), sd: sd(tones), p50: pctl(tones, 50), mode_share: modeShare(tones) },
    graded_from_audio_rate: real.length ? real.filter((r) => r.graded_from_audio).length / real.length : null,
    tone_core_tagged_rate: real.length ? real.filter((r) => r.tone_core_tagged).length / real.length : null,
    // Canonical fallback classification (telemetry.ts): the model_used tag.
    anthropic_fallback_share: real.length ? real.filter((r) => (r.model_used ?? "").startsWith("anthropic-fallback:")).length / real.length : null,
    warm_hit_rate: (() => {
      const withMs = real.filter((r) => r.prosody_ms != null);
      return withMs.length ? withMs.filter((r) => r.prosody_ms < 500).length / withMs.length : null;
    })(),
    feature_version_mix: real.reduce((acc, r) => {
      const v = r.feature_version ?? "none";
      acc[v] = (acc[v] ?? 0) + 1;
      return acc;
    }, {}),
  },
  reps: rows.map((r) => ({ id: r.id, at: r.created_at, email: maskEmail(r.email), tone: r.tone, graded_from_audio: r.graded_from_audio, tone_core_tagged: r.tone_core_tagged, prosody_ms: r.prosody_ms, fv: r.feature_version ?? null })),
};
writeFileSync(resolve(OUT_DIR, "flip-watch.json"), JSON.stringify(summary, null, 2));
const { reps: _r, ...head } = summary;
console.log(JSON.stringify(head, null, 2));
console.log(`→ ${resolve(OUT_DIR, "flip-watch.json")}`);
