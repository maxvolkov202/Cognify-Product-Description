import { sql } from './db.mjs';
const rows = await sql`select created_at, source, model_used, failure_reason, left(error_detail,300) err, total_server_duration_ms ms, arm
  from cognify_v2.scoring_telemetry where created_at>='2026-08-10' and (failure_reason in ('timeout','validation_failed') or created_at between '2026-08-11 23:00' and '2026-08-12 05:00') order by created_at`;
for (const r of rows) console.log(r.created_at.toISOString().slice(0,19), r.source, r.model_used, r.failure_reason, r.ms+'ms', r.arm, '|', r.err);
const unk = await sql`select distinct left(error_detail,200) err, count(*) from cognify_v2.scoring_telemetry where created_at>='2026-08-10' and failure_reason='unknown' group by 1`;
console.log('\nUNKNOWN error_detail:'); console.table(unk);
const src = await sql`select source, arm, count(*) from cognify_v2.scoring_telemetry where created_at>='2026-08-10' group by 1,2 order by 3 desc`;
console.table(src);
await sql.end();
