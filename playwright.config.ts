import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — mobile-readiness E2E gates for the muscle-group
 * pivot. Single project for now: Mobile Safari emulation at iPhone 14
 * viewport (390×844). Add desktop projects once we have desktop-
 * specific assertions.
 *
 * To run locally:
 *   1. npx playwright install chromium    # ~150MB browser binary
 *   2. npm run dev                         # in a separate terminal
 *   3. npm run test:e2e
 *
 * CI: same sequence; browsers cached between runs.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: process.env.PW_BASE_URL ?? "http://127.0.0.1:3333",
    trace: "retain-on-failure",
    actionTimeout: 8_000,
  },
  projects: [
    {
      name: "iPhone-14",
      use: { ...devices["iPhone 14"] },
    },
  ],
});
