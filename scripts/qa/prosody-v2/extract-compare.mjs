/**
 * Prosody v2 harness — per in-system audio rep: sign the stored audio, call one or two
 * prosody workers, and diff features (worker A vs worker B, and A vs the cached row).
 * Read-only + signed-URL reads. GW1 evaluation when --worker-b-url is given: every rep
 * where A yields pitch must also yield pitch under B.
 *
 *   PROSODY_ENV_FILE=<pulled env> node scripts/qa/prosody-v2/extract-compare.mjs
 *   ... [--worker-b-url URL --worker-b-token TOK] [--limit N] [--test-only|--real-only]
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { env, sql, maskEmail, OUT_DIR, pctl } from "./db.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, xs) => (a.startsWith("--") ? [a.slice(2), xs[i + 1]] : [])).filter((p) => p.length));
const A = { url: args["worker-url"] ?? env.PROSODY_WORKER_URL, token: args["worker-token"] ?? env.PROSODY_WORKER_TOKEN, label: "A" };
const B = args["worker-b-url"] ? { url: args["worker-b-url"], token: args["worker-b-token"] ?? env.PROSODY_WORKER_TOKEN, label: "B" } : null;
if (!A.url) throw new Error("worker URL missing — set PROSODY_WORKER_URL or pass --worker-url");
const LIMIT = parseInt(args.limit ?? "200", 10);

const reps = await sql`
  select r.id, r.audio_url, r.duration_ms, r.created_at, u.email
  from cognify_v2.reps r join cognify_v2.users u on u.id = r.user_id
  where r.audio_url is not null order by r.created_at desc limit ${LIMIT}`;
const cacheRows = await sql`
  select path, status, features from cognify_v2.audio_prosody_cache
  where path in ${sql(reps.map((r) => r.audio_url))}`;
await sql.end();
const cacheByPath = new Map(cacheRows.map((c) => [c.path, c]));
const isTest = (e) => (e ?? "").endsWith("@cognify.test");
const targets = reps.filter((r) => ("test-only" in args ? isTest(r.email) : "real-only" in args ? !isTest(r.email) : true));

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
async function callWorker(w, audioUrl, durationMs) {
  const t0 = Date.now();
  const res = await fetch(w.url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(w.token ? { authorization: `Bearer ${w.token}` } : {}) },
    body: JSON.stringify({ audioUrl, durationMs: durationMs ?? 30_000 }),
  });
  if (!res.ok) return { error: `${res.status}`, latency_ms: Date.now() - t0 };
  return { features: await res.json(), latency_ms: Date.now() - t0 };
}

const NUMERIC = ["pitchMeanHz", "pitchStdSemitones", "pitchRangeSemitones", "monotoneRatio", "upspeakRatio", "rmsMean", "rmsStd", "articulationScore"];
const rows = [];
for (const r of targets) {
  const { data, error } = await admin.storage.from("rep-audio").createSignedUrl(r.audio_url, 3600);
  if (error || !data?.signedUrl) { rows.push({ rep_id: r.id, error: `sign: ${error?.message}` }); continue; }
  const a = await callWorker(A, data.signedUrl, r.duration_ms);
  const b = B ? await callWorker(B, data.signedUrl, r.duration_ms) : null;
  const cached = cacheByPath.get(r.audio_url)?.features ?? null;
  const diffAB = b?.features && a.features ? Object.fromEntries(NUMERIC.map((k) => [k, a.features[k] != null && b.features[k] != null ? +(b.features[k] - a.features[k]).toFixed(4) : { a: a.features[k], b: b.features[k] }])) : null;
  rows.push({
    rep_id: r.id, email: maskEmail(r.email), test: isTest(r.email), audio_path: r.audio_url, created_at: r.created_at,
    cached_status: cacheByPath.get(r.audio_url)?.status ?? "absent",
    cached_feature_version: cached?.featureVersion ?? (cached ? 1 : null),
    a, ...(b ? { b, diff_b_minus_a: diffAB } : {}),
    cache_drift: cached && a.features ? Object.fromEntries(NUMERIC.filter((k) => cached[k] != null && a.features[k] != null && Math.abs(cached[k] - a.features[k]) > 0.05).map((k) => [k, { cached: cached[k], fresh: a.features[k] }])) : null,
  });
  console.log(`${r.id.slice(0, 8)} ${isTest(r.email) ? "test" : "real"} A:${a.features ? "ok" : a.error} ${a.latency_ms}ms${b ? ` B:${b.features ? "ok" : b.error} ${b.latency_ms}ms` : ""}`);
}
const gw1 = B ? { pass: rows.every((r) => !(r.a?.features?.pitchStdSemitones != null) || r.b?.features?.pitchStdSemitones != null), reps_with_a_pitch: rows.filter((r) => r.a?.features?.pitchStdSemitones != null).length, of_those_with_b_pitch: rows.filter((r) => r.a?.features?.pitchStdSemitones != null && r.b?.features?.pitchStdSemitones != null).length } : null;
const lats = rows.map((r) => r.a?.latency_ms).filter(Boolean);
const summary = { generated_at: new Date().toISOString(), worker_a: A.url, worker_b: B?.url ?? null, n: rows.length, gw1, a_latency_ms: { p50: pctl(lats, 50), p90: pctl(lats, 90) }, rows };
const out = resolve(OUT_DIR, `extract-compare-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(out, JSON.stringify(summary, null, 2));
console.log(`n=${rows.length}${gw1 ? ` GW1 ${gw1.pass ? "PASS" : "FAIL"} (${gw1.of_those_with_b_pitch}/${gw1.reps_with_a_pitch})` : ""} → ${out}`);
