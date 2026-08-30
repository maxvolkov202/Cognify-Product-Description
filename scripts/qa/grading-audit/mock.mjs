import { sql, maskEmail } from './db.mjs';
const users = await sql`select r.id, r.created_at, u.email, r.attempt_kind, r.duration_ms, length(r.transcript->>'text') tlen, r.composite_score
  from cognify_v2.reps r left join cognify_v2.users u on u.id=r.user_id
  where r.model_version='mock-fallback-v1' and r.created_at >= '2026-08-10' order by r.created_at`;
console.log('MOCK REPS since 08-10:'); for (const u of users) console.log(u.created_at.toISOString().slice(0,16), maskEmail(u.email), u.attempt_kind, Math.round(u.duration_ms/1000)+'s', u.tlen+'ch', u.composite_score);
const byEmail = await sql`select u.email, count(*) filter (where r.model_version='mock-fallback-v1') mock, count(*) total
  from cognify_v2.reps r left join cognify_v2.users u on u.id=r.user_id where r.created_at>='2026-08-10' group by 1 order by 3 desc`;
console.log('\nBY USER since 08-10:'); console.table(byEmail.map((r) => ({ ...r, email: maskEmail(r.email) })));
const tel = await sql`select date_trunc('day',created_at)::date d, model_used, failure_reason, count(*), round(avg(total_server_duration_ms)) avg_ms, max(total_server_duration_ms) max_ms
  from cognify_v2.scoring_telemetry where created_at>='2026-08-10' and (model_used like 'mock%' or failure_reason not in ('none')) group by 1,2,3 order by 1`;
console.log('\nTELEMETRY failures since 08-10:'); console.table(tel);
const cols = await sql`select column_name from information_schema.columns where table_schema='cognify_v2' and table_name='scoring_telemetry'`;
console.log(cols.map(c=>c.column_name).join(', '));
const sample = await sql`select created_at, model_used, failure_reason, total_server_duration_ms, model_duration_ms, input_tokens, output_tokens, arm from cognify_v2.scoring_telemetry where created_at>='2026-08-17' and model_used like 'mock%' order by created_at desc limit 12`;
console.table(sample);
await sql.end();
