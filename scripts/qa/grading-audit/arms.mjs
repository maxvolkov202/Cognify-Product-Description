import { sql } from './db.mjs';
const r = await sql`select date_trunc('hour',created_at) h, arm, model_used, count(*), round(avg(total_server_duration_ms)) ms, round(avg(input_tokens)) inp, round(avg(output_tokens)) outp
  from cognify_v2.scoring_telemetry where created_at>='2026-08-10' group by 1,2,3 order by 1`;
for (const x of r) console.log(x.h.toISOString().slice(0,13), (x.arm??'null').padEnd(12), x.model_used.padEnd(28), String(x.count).padStart(4), x.ms+'ms', 'in', x.inp, 'out', x.outp);
const u = await sql`select u.email, count(*) from cognify_v2.scoring_telemetry t left join cognify_v2.users u on u.id=t.user_id where t.created_at>='2026-08-10' and t.arm='signals-drop' group by 1`;
console.table(u);
await sql.end();
