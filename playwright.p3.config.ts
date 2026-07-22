/**
 * Throwaway config for the Overhaul Phase 3 smoke — reuses the persisted
 * authed session (no `setup` dependency, so no re-sign-in → dodges the
 * Supabase auth rate limit, per the authed-smoke-rate-limit note). Points
 * at the local dev server; override with PW_BASE_URL.
 *
 *   npx playwright test --config playwright.p3.config.ts
 */
import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

export default defineConfig({
  testDir: "./tests/e2e/authed",
  testMatch: /p3-rank-bug\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.PW_BASE_URL ?? "http://127.0.0.1:3333",
    storageState: resolve(__dirname, "tests/e2e/authed/.auth/user.json"),
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
    actionTimeout: 10_000,
  },
});
