/**
 * Prosody v2 Phase 0 — tone-only mini-sheet over the 15 audio-grading fixtures
 * (plans/prosody-v2-plan-2026-09.md §3.4: >11 human tone points early, GH1 fuel).
 *
 *   node scripts/calibration/human-labeling/build-fixture-minisheet.mjs [--ttl-days 7] [--seed 20260901]
 *   node scripts/calibration/human-labeling/build-fixture-minisheet.mjs --resign [--ttl-days 7]
 *
 * Fixture filenames encode the style (__flat / __expressive / __rushed), so linking them
 * directly would unblind the raters. The build uploads the clips to the rep-audio bucket
 * under masked names (fixtures/tone-mini-2026-09/clip-NN, seeded shuffle), signs URLs, and
 * writes to plans/calibration/human-labeling-2026-09/ (gitignored except README):
 *   fixture-mini-sheet-A.csv / -B.csv   blind sheets for Max (A) and Owen (B)
 *   fixture-mini-key.hidden.json        clip id → fixture file/script/style — do NOT open until both sheets are filled
 * The sheets deliberately carry no duration column: flat/expressive twins share exact durations
 * and rushed clips are visibly shorter, so durations would partially unblind the set.
 *
 * Guards: once the key file exists the full build refuses to run without --force (a re-run with a
 * different seed would silently swap the audio behind still-valid links and rewrite the only
 * mapping record); --force clears the storage prefix first so no stale objects survive. --resign
 * refreshes the signed URLs from the existing key only — no uploads, key untouched — and a sheet
 * that already holds rater data is never rewritten.
 *
 * No DB access at all. Storage writes are additive uploads under the fixtures/ prefix only.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT, OUT_DIR, loadEnvLocal, mulberry32, parseArgs, parseTtlDays, seededShuffle, sheetHasLabels, signStoragePaths, toCsv } from "./_shared.mjs";

const args = parseArgs(process.argv.slice(2), { flags: ["resign", "force"], options: ["seed", "ttl-days"] });
const SEED = parseInt(args.seed ?? "20260901", 10);
const TTL_S = parseTtlDays(args["ttl-days"]);
const FIXTURES_DIR = resolve(ROOT, "tests/fixtures/audio-grading");
const STORAGE_PREFIX = "fixtures/tone-mini-2026-09";
const KEY_PATH = resolve(OUT_DIR, "fixture-mini-key.hidden.json");
const SHEET_COLS = ["order", "clip_id", "clip_link", "tone_0_100", "rationale_one_word"];
const RATER_COLS = ["tone_0_100", "rationale_one_word"];

const env = { ...loadEnvLocal(), ...process.env };
env.SUPABASE_URL ??= env.NEXT_PUBLIC_SUPABASE_URL;
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
mkdirSync(OUT_DIR, { recursive: true });

function storagePathOf(clip) { return `${STORAGE_PREFIX}/${clip.clip_id}.${clip.file.split(".").pop()}`; }

function writeSheets(clips, signed) {
  const rows = clips.map((c) => ({ order: c.order, clip_id: c.clip_id, clip_link: signed.get(storagePathOf(c)) }));
  for (const rater of ["A", "B"]) {
    const p = resolve(OUT_DIR, `fixture-mini-sheet-${rater}.csv`);
    if (existsSync(p) && sheetHasLabels(p, RATER_COLS)) {
      console.warn(`[mini-sheet] fixture-mini-sheet-${rater}.csv has filled cells — left untouched (copy fresh links over manually if that sheet is still in use)`);
      continue;
    }
    writeFileSync(p, toCsv(rows, SHEET_COLS));
  }
}

// ── --resign: refresh URLs from the frozen key; no uploads, key untouched ──
if (args.resign === true) {
  const key = JSON.parse(readFileSync(KEY_PATH, "utf8"));
  const signed = await signStoragePaths(admin, "rep-audio", key.clips.map(storagePathOf), TTL_S, { strict: true });
  writeSheets(key.clips, signed);
  console.log(`[mini-sheet] --resign: refreshed ${signed.size} clip links (ttl ${TTL_S / 86400}d); key untouched`);
  process.exit(0);
}

if (existsSync(KEY_PATH) && args.force !== true)
  throw new Error("fixture-mini-key.hidden.json exists — the mini-sheet is FROZEN. A rebuild reshuffles the masked names and silently swaps the audio behind any distributed links. Use --resign to refresh links, or --force only to deliberately rebuild.");

const manifest = JSON.parse(readFileSync(resolve(FIXTURES_DIR, "manifest.json"), "utf8"));
if (manifest.fixtures.length !== 15) throw new Error(`expected 15 fixtures, manifest has ${manifest.fixtures.length}`);

// clear the prefix so a rebuild can't leave stale objects (e.g. old extensions) behind
const { data: existing, error: listErr } = await admin.storage.from("rep-audio").list(STORAGE_PREFIX, { limit: 100 });
if (listErr) throw new Error(`listing ${STORAGE_PREFIX}: ${listErr.message}`);
if (existing?.length) {
  const { error } = await admin.storage.from("rep-audio").remove(existing.map((o) => `${STORAGE_PREFIX}/${o.name}`));
  if (error) throw new Error(`clearing ${STORAGE_PREFIX}: ${error.message}`);
}

const shuffled = seededShuffle(manifest.fixtures, mulberry32(SEED));
const CONTENT_TYPE = { wav: "audio/wav", mp3: "audio/mpeg" };
const clips = [];
for (const [i, fx] of shuffled.entries()) {
  const clip = { order: i + 1, clip_id: `clip-${String(i + 1).padStart(2, "0")}`, file: fx.file, script_id: fx.scriptId, style: fx.style };
  const ext = fx.file.split(".").pop();
  const { error } = await admin.storage.from("rep-audio").upload(storagePathOf(clip), readFileSync(resolve(FIXTURES_DIR, fx.file)), { contentType: CONTENT_TYPE[ext] ?? "application/octet-stream", upsert: true });
  if (error) throw new Error(`upload ${fx.file} → ${storagePathOf(clip)}: ${error.message}`);
  clips.push(clip);
}

const signed = await signStoragePaths(admin, "rep-audio", clips.map(storagePathOf), TTL_S, { strict: true });
writeSheets(clips, signed);
writeFileSync(KEY_PATH, JSON.stringify({ built_at: new Date().toISOString(), seed: SEED, clips }, null, 2));
console.log(`[mini-sheet] ${clips.length} clips uploaded under ${STORAGE_PREFIX}/, signed (ttl ${TTL_S / 86400}d) → fixture-mini-sheet-A/B.csv + hidden key in ${OUT_DIR}`);
