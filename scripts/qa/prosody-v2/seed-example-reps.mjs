/**
 * Prosody v2 harness — seed the 15 audio-grading fixtures as REAL reps through the
 * live product (upload → prosody warm → transcribe → score → saveRep), by driving the
 * app UI with Playwright and Chromium's fake-microphone capture (the proven authed
 * e2e pattern; tracker: "harness reps grade from audio 5/5").
 *
 *   SEED_BASE_URL=https://cognify-v2-<deploy>.vercel.app \
 *     node scripts/qa/prosody-v2/seed-example-reps.mjs [--filter substr] [--headed] [--tag label]
 *
 * P8 discipline: the ONLY writes go through the real app under a @cognify.test
 * account (excluded by every real-rep filter). Re-running seeds a FRESH batch
 * (fresh upload → new audio path → fresh warm under the currently-serving worker) —
 * that is the point (plan §3.3): re-scoring would replay stale cache rows. Each run
 * is recorded as out/seed-batch-<tag>.json listing exactly its rep ids.
 *
 * Guards: SEED_BASE_URL is required (no default); the shell DATABASE_URL must match
 * .env.local's host (same interlock as auth.setup.ts); the account must be @cognify.test.
 */
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { env, sql, ROOT, OUT_DIR, loadEnvFile } from "./db.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, xs) => (a.startsWith("--") ? [a.slice(2), xs[i + 1]] : [])).filter((p) => p.length));
const BASE_URL = process.env.SEED_BASE_URL;
if (!BASE_URL) throw new Error("SEED_BASE_URL required (use the deployment URL, e.g. https://cognify-v2-<id>.vercel.app)");
const HEADED = "headed" in args;
const FILTER = args.filter ?? "";
const TAG = args.tag ?? new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const SEED_EMAIL = process.env.SEED_EMAIL ?? "e2e-harness@cognify.test";
// No default and NO provisioning: the account must already exist, and a password
// committed to this public repo must never be the credential for a prod account.
// (auth.setup.ts's committed default predates this script and is dev/preview-only.)
const SEED_PASSWORD = process.env.SEED_PASSWORD;
if (!SEED_PASSWORD) throw new Error("SEED_PASSWORD required — this script never provisions accounts and carries no default credential");
if (!SEED_EMAIL.endsWith("@cognify.test")) throw new Error("seeding account must be @cognify.test (P8)");

// DB-host interlock (mirrors tests/e2e/authed/auth.setup.ts): compare the SHELL
// value against the value parsed from the .env.local FILE — process.env wins the
// env merge, so comparing against env.DATABASE_URL would compare it to itself.
const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return u?.match(/@\[?([^/@\s:\]?]+)/)?.[1]?.toLowerCase() ?? null; } };
const fileDbUrl = loadEnvFile(resolve(ROOT, ".env.local")).DATABASE_URL;
if (process.env.DATABASE_URL && fileDbUrl && hostOf(process.env.DATABASE_URL) !== hostOf(fileDbUrl))
  throw new Error("shell DATABASE_URL host differs from .env.local — unset it first");

const manifest = JSON.parse(readFileSync(resolve(ROOT, "tests/fixtures/audio-grading/manifest.json"), "utf8"));
const truth = JSON.parse(readFileSync(resolve(ROOT, "tests/fixtures/audio-grading/features.json"), "utf8"));
const fixtures = manifest.fixtures.filter((f) => f.file.includes(FILTER));

// Chromium's fake capture needs wav; transcode the mp3 fixtures once (afconvert is
// macOS-native; ffmpeg works too if present).
const WAV_CACHE = resolve(OUT_DIR, "wav-cache");
mkdirSync(WAV_CACHE, { recursive: true });
function wavFor(file) {
  const src = resolve(ROOT, "tests/fixtures/audio-grading", file);
  if (file.endsWith(".wav")) return src;
  const dst = resolve(WAV_CACHE, file.replace(/\.[^.]+$/, ".wav"));
  if (!existsSync(dst)) {
    try { execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@44100", "-c", "1", src, dst]); }
    catch { execFileSync("ffmpeg", ["-y", "-i", src, "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", dst]); }
  }
  return dst;
}

// Log in once through the real UI; keep storageState for the per-clip launches.
const STATE = resolve(OUT_DIR, ".auth-seed.json");
{
  const browser = await chromium.launch({ headless: !HEADED });
  const page = await browser.newPage({ baseURL: BASE_URL });
  await page.goto("/signin", { waitUntil: "networkidle" });
  await page.locator("#email").fill(SEED_EMAIL);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in with email/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/signin"), { timeout: 30_000 });
  await page.context().storageState({ path: STATE });
  await browser.close();
  console.log(`[seed] signed in as ${SEED_EMAIL}`);
}

const runStart = new Date();
const results = [];
for (const fx of fixtures) {
  const durationS = truth[fx.file]?.durationSec ?? 30;
  const t0 = Date.now();
  const browser = await chromium.launch({
    headless: !HEADED,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wavFor(fx.file)}`],
  });
  try {
    const context = await browser.newContext({ baseURL: BASE_URL, storageState: STATE, permissions: ["microphone"] });
    const page = await context.newPage();
    await page.goto("/application-lab/storytelling", { waitUntil: "networkidle" });
    const startFresh = page.getByRole("button", { name: /Start fresh/i });
    if (await startFresh.count()) await startFresh.first().click();
    // 1-rep session: stepper defaults to 3.
    const dec = page.getByRole("button", { name: /Decrease How many reps\?/i });
    await dec.click(); await dec.click();
    await page.getByRole("button", { name: /Start session/i }).click();
    const promptCard = page.getByTestId("prompt-card").first();
    await promptCard.waitFor({ state: "visible", timeout: 60_000 });
    await promptCard.click();
    await page.getByTestId("insight-ready").click();
    // Record: 3s countdown, then the fake mic replays the fixture once.
    const start = page.getByRole("button", { name: "Start recording" });
    await start.waitFor({ state: "visible", timeout: 30_000 });
    await start.click();
    await page.waitForTimeout(3_500 + Math.ceil(durationS + 1) * 1_000);
    const submitTile = page.getByRole("button", { name: /Submit/ });
    if (await submitTile.count()) await submitTile.first().click({ force: true, timeout: 15_000 });
    else await page.getByRole("button", { name: "Stop recording" }).click({ force: true, timeout: 15_000 });
    // Feedback = rep saved + scored.
    const cta = page.getByRole("button", { name: /Retry this rep/i }).first();
    const deadline = Date.now() + 240_000;
    while (!(await cta.isVisible().catch(() => false))) {
      if (Date.now() > deadline) throw new Error("feedback timeout");
      await page.waitForTimeout(500);
    }
    const feedbackMs = Date.now() - t0;
    await page.getByRole("button", { name: "Continue" }).first().click();
    await page.getByText(/session complete/i).first().waitFor({ state: "visible", timeout: 60_000 }).catch(() => {});
    results.push({ file: fx.file, style: fx.style, scriptId: fx.scriptId, ok: true, wall_ms: feedbackMs });
    console.log(`[seed] ok   ${fx.file} (${Math.round(feedbackMs / 1000)}s)`);
  } catch (err) {
    results.push({ file: fx.file, style: fx.style, scriptId: fx.scriptId, ok: false, error: String(err).slice(0, 300) });
    console.log(`[seed] FAIL ${fx.file}: ${String(err).slice(0, 200)}`);
  } finally {
    await browser.close();
  }
}

// Verify from the DB (read-only) and attach rep rows to the batch, newest-first
// within the run window. Telemetry attaches asynchronously — poll briefly.
let rows = [];
for (let i = 0; i < 12; i++) {
  rows = await sql`
    select r.id, r.audio_url, r.created_at, r.transcript->>'text' as transcript, r.duration_ms,
           d.score as tone, t.graded_from_audio, t.prosody_ms, t.total_server_duration_ms, t.client_e2e_ms,
           c.status as cache_status, c.features->>'featureVersion' as feature_version
    from cognify_v2.reps r
    join cognify_v2.users u on u.id = r.user_id
    left join cognify_v2.dimension_scores d on d.rep_id = r.id and d.dimension = 'tone'
    left join cognify_v2.scoring_telemetry t on t.rep_id = r.id
    left join cognify_v2.audio_prosody_cache c on c.path = r.audio_url
    where u.email = ${SEED_EMAIL} and r.created_at >= ${runStart}
    order by r.created_at`;
  if (rows.length >= results.filter((r) => r.ok).length && rows.every((r) => r.client_e2e_ms != null)) break;
  await new Promise((res) => setTimeout(res, 5_000));
}
// Attribute rep rows to fixtures: seeding is sequential, so the k-th successful
// fixture produced the k-th rep (rows are created_at-ordered). Only attribute on
// an exact count match; otherwise leave rows unattributed rather than guess.
const okFixtures = results.filter((r) => r.ok);
if (rows.length === okFixtures.length)
  rows = rows.map((r, i) => ({ file: okFixtures[i].file, style: okFixtures[i].style, script_id: okFixtures[i].scriptId, ...r }));
else console.warn(`[seed] rep count (${rows.length}) != successful fixtures (${okFixtures.length}) — batch rows left unattributed`);
const batch = {
  tag: TAG, base_url: BASE_URL, seeded_at: runStart.toISOString(), account: SEED_EMAIL,
  attempted: results.length, succeeded: results.filter((r) => r.ok).length,
  fixtures: results, reps: rows,
};
const out = resolve(OUT_DIR, `seed-batch-${TAG}.json`);
writeFileSync(out, JSON.stringify(batch, null, 2));
await sql.end();
console.log(`[seed] ${batch.succeeded}/${batch.attempted} seeded · ${rows.length} rep rows verified (graded_from_audio: ${rows.filter((r) => r.graded_from_audio).length}) → ${out}`);
process.exit(batch.succeeded === batch.attempted && rows.length >= batch.succeeded ? 0 : 1);
