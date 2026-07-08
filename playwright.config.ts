import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

/**
 * Playwright config.
 *
 * Projects:
 *  - iPhone-14 (WebKit): unauthenticated route-shape + tap-target specs.
 *  - setup: provisions + logs in the E2E test user (storageState).
 *  - authed-chromium: Phase 11.B — the REAL engine loops with a fake
 *    microphone (Chromium-only flags) and LIVE transcription + scoring.
 *    Costs real API credits per run; opt in with AUTHED=1.
 *
 * To run locally:
 *   1. npx playwright install chromium webkit
 *   2. npm run dev                         # in a separate terminal
 *   3. npx playwright test                 # route-shape suites
 *   4. AUTHED=1 npx playwright test        # + live authed loops
 */
const FAKE_AUDIO = resolve(__dirname, "tests/fixtures/spoken-rep.wav");

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
      testIgnore: /authed[\/]/,
    },
    ...(process.env.AUTHED === "1"
      ? [
          {
            name: "setup",
            testMatch: /authed[\/]auth\.setup\.ts/,
            use: { ...devices["Desktop Chrome"] },
          },
          {
            name: "authed-chromium",
            dependencies: ["setup"],
            testMatch: /authed[\/].*\.spec\.ts/,
            // Live scoring takes 10-30s per rep — generous budgets.
            timeout: 420_000,
            use: {
              ...devices["Desktop Chrome"],
              storageState: resolve(
                __dirname,
                "tests/e2e/authed/.auth/user.json",
              ),
              launchOptions: {
                args: [
                  "--use-fake-ui-for-media-stream",
                  "--use-fake-device-for-media-stream",
                  `--use-file-for-fake-audio-capture=${FAKE_AUDIO}`,
                ],
              },
              permissions: ["microphone"],
            },
          },
        ]
      : []),
  ],
});
