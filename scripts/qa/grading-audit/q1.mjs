import { sql, maskEmail } from "./db.mjs";
console.log(await sql`select date_trunc('week',created_at)::date wk, model_version, rubric_version, count(*)::int n, count(distinct user_id)::int users, round(avg(composite_score)::numeric,1) comp from cognify_v2.reps group by 1,2,3 order by 1,2`);
console.log(await sql`select model_version, count(*)::int n, count(distinct user_id)::int users, min(created_at)::date mn, max(created_at)::date mx from cognify_v2.reps group by 1 order by 1`);
console.log(await sql`select attempt_kind, count(*)::int n, count(parent_rep_id)::int with_parent from cognify_v2.reps group by 1`);
console.log(await sql`select count(*)::int n_users, count(*) filter (where email ilike '%test%' or email ilike '%demo%' or email ilike '%seed%')::int testish from cognify_v2.users`);
console.log((await sql`select u.id, u.email, count(r.id)::int reps, min(r.created_at)::date mn, max(r.created_at)::date mx, count(*) filter (where r.model_version='seed-demo-v1')::int seed, count(*) filter (where r.model_version='mock-fallback-v1')::int mock from cognify_v2.users u join cognify_v2.reps r on r.user_id=u.id group by 1,2 order by 3 desc`).map((r) => ({ ...r, email: maskEmail(r.email) })));
await sql.end();
