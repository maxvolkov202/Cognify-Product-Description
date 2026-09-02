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
import { sql, maskEmail, OUT_DIR, pctl, mean, sd, isRealRep } from "./db.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, xs) => (a.startsWith("--") ? [a.slice(2), xs[i + 1]] : [])).filter((p) => p.length));
const LIMIT = parseInt(args.limit ?? "50", 10);

const rows = await sql`
  select r.id, r.created_at, r.model_version, u.email, d.score as tone,
         t.graded_from_audio, t.prosody_ms, t.total_server_duration_ms,
         c.features->>'featureVersion' as feature_version,
         (d.signals::text like '%[toneCore:%') as tone_core_tagged
  from cognify_v2.reps r
  join cognify_v2.users u on u.id = r.user_id
  left join cognify_v2.dimension_scores d on d.rep_id = r.id and d.dimension = 'tone'
  left join cognify_v2.scoring_telemetry t on t.rep_id = r.id
  left join cognify_v2.audio_prosody_cache c on c.path = r.audio_url
  where r.audio_url is not null
    ${args.since ? sql`and r.created_at >= ${args.since}` : sql``}
  order by r.created_at desc limit ${LIMIT}`;
await sql.end();

const real = rows.filter(isRealRep);
const tones = real.map((r) => r.tone).filter((v) => v != null);
const modeShare = (xs) => { const c = new Map(); xs.forEach((x) => c.set(x, (c.get(x) ?? 0) + 1)); return xs.length ? Math.max(...c.values()) / xs.length : null; };
const summary = {
  generated_at: new Date().toISOString(),
  window: { since: args.since ?? null, limit: LIMIT },
  real: {
    n: real.length,
    users: new Set(real.map((r) => r.email)).size,
    tone: { n: tones.length, mean: mean(tones), sd: sd(tones), p50: pctl(tones, 50), mode_share: modeShare(tones) },
    graded_from_audio_rate: real.length ? real.filter((r) => r.graded_from_audio).length / real.length : null,
    tone_core_tagged_rate: real.length ? real.filter((r) => r.tone_core_tagged).length / real.length : null,
    anthropic_fallback_share: real.length ? real.filter((r) => (r.model_version ?? "").includes("anthropic") || (r.model_version ?? "").includes("claude")).length / real.length : null,
    warm_hit_rate: real.filter((r) => r.prosody_ms != null).length
      ? real.filter((r) => r.prosody_ms != null && r.prosody_ms < 500).length / real.filter((r) => r.prosody_ms != null).length
      : null,
    feature_version_mix: Object.fromEntries([...new Set(real.map((r) => r.feature_version ?? "none"))].map((v) => [v, real.filter((r) => (r.feature_version ?? "none") === v).length])),
  },
  reps: rows.map((r) => ({ id: r.id, at: r.created_at, real: isRealRep(r), email: maskEmail(r.email), tone: r.tone, graded_from_audio: r.graded_from_audio, tone_core_tagged: r.tone_core_tagged, prosody_ms: r.prosody_ms, fv: r.feature_version ?? null })),
};
writeFileSync(resolve(OUT_DIR, "flip-watch.json"), JSON.stringify(summary, null, 2));
const { reps: _r, ...head } = summary;
console.log(JSON.stringify(head, null, 2));
console.log(`→ ${resolve(OUT_DIR, "flip-watch.json")}`);
