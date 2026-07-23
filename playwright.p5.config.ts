/**
 * Throwaway config for the Overhaul Phase 5 smoke — reuses the persisted
 * authed session (no `setup` dependency, so no re-sign-in → dodges the
 * Supabase auth rate limit, per the authed-smoke-rate-limit note) AND enables
 * Chromium's fake microphone so the full record → grade → feedback → retry
 * loop runs. Points at the local dev server; override with PW_BASE_URL.
 *
 *   npx playwright test --config playwright.p5.config.ts
 */
import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const FAKE_AUDIO = resolve(__dirname, "tests/fixtures/spoken-rep.wav");

export default defineConfig({
  testDir: "./tests/e2e/authed",
  testMatch: /p5-abort-framework\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  // Live scoring can take 10-30s/rep (mock fallback is near-instant); keep a
  // generous budget so the full loop + resume check completes.
  timeout: 420_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.PW_BASE_URL ?? "http://127.0.0.1:3333",
    storageState: resolve(__dirname, "tests/e2e/authed/.auth/user.json"),
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
    actionTimeout: 15_000,
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${FAKE_AUDIO}`,
      ],
    },
    permissions: ["microphone"],
  },
});
