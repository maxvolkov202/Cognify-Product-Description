/**
 * Prosody v2 harness — GW3: aligned upspeakRatio sanity on the declarative fixture
 * scripts, computed exactly as the scorer will (plan P2): worker v2 segmentTails ∩
 * statement ends from the rep's STORED Deepgram punctuated words, through the real
 * prosody-align.ts. Runs against the seeded example reps (they carry fixture audio
 * plus genuine word timings). Pass: aligned upspeak ≤ 0.25 on declarative scripts
 * (log-only if flaky per the plan's gate table).
 *
 *   npx tsx scripts/qa/prosody-v2/gw3-aligned.ts --seed-batch out/seed-batch-<tag>.json \
 *       [--worker-url http://127.0.0.1:8082]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
// @ts-ignore untyped .mjs helper
import { env, sql, OUT_DIR } from "./db.mjs";
import { alignSegmentTails, statementEndsFromWords } from "../../../src/lib/audio/prosody-align";

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map((a, i, xs) => (a.startsWith("--") ? [a.slice(2), xs[i + 1]] : [])).filter((p) => p.length > 0));
  const WORKER_URL = String(args["worker-url"] ?? env.PROSODY_WORKER_URL ?? "http://127.0.0.1:8082");
  const WORKER_TOKEN = env.PROSODY_WORKER_TOKEN;
  const batch = JSON.parse(readFileSync(resolve(String(args["seed-batch"])), "utf8"));
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const ids = batch.reps.map((r: any) => r.id);
  const rows = await sql`
    select id, audio_url, duration_ms, transcript->'words' as words
    from cognify_v2.reps where id in ${sql(ids)}`;
  await sql.end();
  const byId = new Map(rows.map((r: any) => [r.id, r]));

  const results: any[] = [];
  for (const rep of batch.reps) {
    const row = byId.get(rep.id) as any;
    if (!row?.words?.length) { results.push({ file: rep.file, error: "no stored words" }); continue; }
    const { data, error } = await admin.storage.from("rep-audio").createSignedUrl(row.audio_url, 3600);
    if (error || !data?.signedUrl) { results.push({ file: rep.file, error: `sign: ${error?.message}` }); continue; }
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "content-type": "application/json", ...(WORKER_TOKEN ? { authorization: `Bearer ${WORKER_TOKEN}` } : {}) },
      body: JSON.stringify({ audioUrl: data.signedUrl, durationMs: row.duration_ms ?? 30_000 }),
    });
    if (!res.ok) { results.push({ file: rep.file, error: `worker ${res.status}` }); continue; }
    const features = await res.json();
    const words = (row.words as any[]).map((w) => ({ word: w.word ?? w.punctuated_word ?? "", endMs: w.endMs ?? Math.round((w.end ?? 0) * 1000) }));
    const ends = statementEndsFromWords(words);
    const aligned = alignSegmentTails(features.segmentTails ?? null, ends);
    results.push({
      file: rep.file, style: rep.style, script_id: rep.script_id,
      statement_ends: ends.length, questions: ends.filter((e) => e.isQuestion).length,
      segment_tails: (features.segmentTails ?? []).length,
      raw_upspeak: features.upspeakRatio,
      aligned: aligned ?? null,
    });
    console.log(`${rep.file}: ends=${ends.length} (q=${ends.filter((e: any) => e.isQuestion).length}) tails=${(features.segmentTails ?? []).length} raw=${features.upspeakRatio} alignedUp=${aligned?.upspeakRatioAligned ?? "null"} fall=${aligned?.finalFallRatioAligned ?? "null"} (n=${aligned?.declarativeCount ?? 0})`);
  }
  const evaluable = results.filter((r) => r.aligned);
  const pass = evaluable.filter((r) => r.aligned.upspeakRatioAligned <= 0.25);
  const summary = {
    generated_at: new Date().toISOString(), worker: WORKER_URL,
    gw3: { evaluable: evaluable.length, within_025: pass.length, note: "log-only allowed per plan if TTS artifacts make it flaky" },
    results,
  };
  writeFileSync(resolve(OUT_DIR, "gw3-aligned.json"), JSON.stringify(summary, null, 2));
  console.log(`GW3: ${pass.length}/${evaluable.length} evaluable clips within ≤0.25 → ${resolve(OUT_DIR, "gw3-aligned.json")}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
