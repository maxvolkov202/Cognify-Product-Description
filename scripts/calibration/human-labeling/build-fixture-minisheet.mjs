/**
 * Prosody v2 Phase 0 — tone-only mini-sheet over the 15 audio-grading fixtures
 * (plans/prosody-v2-plan-2026-09.md §3.4: >11 human tone points early, GH1 fuel).
 *
 *   node scripts/calibration/human-labeling/build-fixture-minisheet.mjs [--ttl-days 7] [--seed 20260901]
 *
 * Fixture filenames encode the style (__flat / __expressive / __rushed), so linking them
 * directly would unblind the raters. This script uploads the clips to the rep-audio bucket
 * under masked names (fixtures/tone-mini-2026-09/clip-NN, seeded shuffle), signs URLs, and
 * writes to plans/calibration/human-labeling-2026-09/ (gitignored except README):
 *   fixture-mini-sheet-A.csv / -B.csv   blind sheets for Max (A) and Owen (B)
 *   fixture-mini-key.hidden.json        clip id → fixture file/script/style — do NOT open until both sheets are filled
 *
 * No DB access at all. Storage writes are additive uploads under the fixtures/ prefix only
 * (upsert: re-running overwrites the same masked objects, never user audio).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, OUT_DIR, loadEnvLocal, mulberry32, toCsv } from "./_shared.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, xs) => (a.startsWith("--") ? [a.slice(2), xs[i + 1]] : [])).filter((p) => p.length));
const SEED = parseInt(args.seed ?? "20260901", 10);
const TTL_S = parseFloat(args["ttl-days"] ?? "7") * 24 * 3600;
const FIXTURES_DIR = resolve(ROOT, "tests/fixtures/audio-grading");
const STORAGE_PREFIX = "fixtures/tone-mini-2026-09";

const env = { ...loadEnvLocal(), ...process.env };
env.SUPABASE_URL ??= env.NEXT_PUBLIC_SUPABASE_URL;
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const manifest = JSON.parse(readFileSync(resolve(FIXTURES_DIR, "manifest.json"), "utf8"));
const features = JSON.parse(readFileSync(resolve(FIXTURES_DIR, "features.json"), "utf8"));
if (manifest.fixtures.length !== 15) throw new Error(`expected 15 fixtures, manifest has ${manifest.fixtures.length}`);

const rng = mulberry32(SEED);
const shuffled = [...manifest.fixtures];
for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }

const CONTENT_TYPE = { wav: "audio/wav", mp3: "audio/mpeg" };
const clips = [];
for (const [i, fx] of shuffled.entries()) {
  const ext = fx.file.split(".").pop();
  const clipId = `clip-${String(i + 1).padStart(2, "0")}`;
  const storagePath = `${STORAGE_PREFIX}/${clipId}.${ext}`;
  const { error } = await admin.storage.from("rep-audio").upload(storagePath, readFileSync(resolve(FIXTURES_DIR, fx.file)), { contentType: CONTENT_TYPE[ext] ?? "application/octet-stream", upsert: true });
  if (error) throw new Error(`upload ${fx.file} → ${storagePath}: ${error.message}`);
  clips.push({ order: i + 1, clip_id: clipId, storage_path: storagePath, file: fx.file, script_id: fx.scriptId, style: fx.style, duration_s: features[fx.file]?.durationSec ?? null });
}

const { data, error } = await admin.storage.from("rep-audio").createSignedUrls(clips.map((c) => c.storage_path), TTL_S);
if (error) throw new Error(`signing failed: ${error.message}`);
const signed = new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
if (signed.size !== clips.length) throw new Error(`signed ${signed.size}/${clips.length} clips — aborting`);

const sheetCols = ["order", "clip_id", "clip_link", "duration_s", "tone_0_100", "rationale_one_word"];
const sheetRows = clips.map((c) => ({ order: c.order, clip_id: c.clip_id, clip_link: signed.get(c.storage_path), duration_s: c.duration_s }));
for (const rater of ["A", "B"]) writeFileSync(resolve(OUT_DIR, `fixture-mini-sheet-${rater}.csv`), toCsv(sheetRows, sheetCols));
writeFileSync(resolve(OUT_DIR, "fixture-mini-key.hidden.json"), JSON.stringify({ built_at: new Date().toISOString(), seed: SEED, clips: clips.map(({ order, clip_id, file, script_id, style }) => ({ order, clip_id, file, script_id, style })) }, null, 2));
console.log(`[mini-sheet] ${clips.length} clips uploaded under ${STORAGE_PREFIX}/, signed (ttl ${TTL_S / 86400}d) → fixture-mini-sheet-A/B.csv + hidden key in ${OUT_DIR}`);
