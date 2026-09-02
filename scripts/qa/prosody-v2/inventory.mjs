/**
 * Prosody v2 harness — read-only inventory: audio reps, prosody cache statuses,
 * feature versions, telemetry coverage. Run any time; writes out/inventory-<date>.json.
 *
 *   node scripts/qa/prosody-v2/inventory.mjs
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql, maskEmail, OUT_DIR } from "./db.mjs";

const reps = await sql`
  select r.id, r.audio_url, r.created_at, r.composite_score, r.model_version, u.email,
         t.graded_from_audio, t.prosody_ms, t.total_server_duration_ms, t.client_e2e_ms
  from cognify_v2.reps r
  join cognify_v2.users u on u.id = r.user_id
  left join cognify_v2.scoring_telemetry t on t.rep_id = r.id
  where r.audio_url is not null
  order by r.created_at`;
const cache = await sql`
  select path, status, features->>'featureVersion' as feature_version,
         (features->>'pitchStdSemitones') is not null as has_pitch, created_at, updated_at
  from cognify_v2.audio_prosody_cache order by created_at`;
const tones = await sql`
  select d.rep_id, d.score from cognify_v2.dimension_scores d
  where d.dimension = 'tone' and d.rep_id in ${sql(reps.map((r) => r.id))}`;
await sql.end();

const toneByRep = new Map(tones.map((t) => [t.rep_id, t.score]));
const isTest = (e) => (e ?? "").endsWith("@cognify.test");
const real = reps.filter((r) => !isTest(r.email) && !["seed-demo-v1", "mock-fallback-v1"].includes(r.model_version));
const test = reps.filter((r) => isTest(r.email));
const byUser = new Map();
for (const r of reps) byUser.set(r.email, (byUser.get(r.email) ?? 0) + 1);

const summary = {
  generated_at: new Date().toISOString(),
  audio_reps: { total: reps.length, real: real.length, test: test.length, other: reps.length - real.length - test.length },
  users_with_audio: [...byUser.entries()].map(([e, n]) => ({ email: maskEmail(e), test: isTest(e), reps: n })),
  graded_from_audio: { real: real.filter((r) => r.graded_from_audio).length, test: test.filter((r) => r.graded_from_audio).length },
  tone_scores_real: real.map((r) => toneByRep.get(r.id)).filter((s) => s != null),
  cache: {
    total: cache.length,
    by_status: Object.fromEntries([...new Set(cache.map((c) => c.status))].map((s) => [s, cache.filter((c) => c.status === s).length])),
    by_feature_version: Object.fromEntries([...new Set(cache.map((c) => c.feature_version ?? "none"))].map((v) => [v, cache.filter((c) => (c.feature_version ?? "none") === v).length])),
    ready_with_pitch: cache.filter((c) => c.status === "ready" && c.has_pitch).length,
  },
  reps: reps.map((r) => ({
    id: r.id, created_at: r.created_at, email: maskEmail(r.email), test: isTest(r.email),
    audio_path: r.audio_url, tone: toneByRep.get(r.id) ?? null, graded_from_audio: r.graded_from_audio ?? null,
    prosody_ms: r.prosody_ms, total_server_ms: r.total_server_duration_ms, client_e2e_ms: r.client_e2e_ms,
    cached: cache.find((c) => c.path === r.audio_url)?.status ?? "absent",
  })),
};
const out = resolve(OUT_DIR, `inventory-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(out, JSON.stringify(summary, null, 2));
const { reps: _reps, tone_scores_real, ...console_summary } = summary;
console.log(JSON.stringify({ ...console_summary, tone_scores_real }, null, 2));
console.log(`→ ${out}`);
