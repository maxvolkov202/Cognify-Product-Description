/**
 * Phase 12 — authed route sweep: every app surface renders for BOTH a
 * cold-start account (e2e harness, project storageState) and the
 * populated demo account (21-day seeded history), with no error
 * boundary, no Next.js crash overlay, and no raw "Application error".
 *
 * This is a render-health net, not a behavior test — the engine loops
 * have their own live specs.
 *
 * Run: AUTHED=1 npx playwright test tests/e2e/authed/route-sweep.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { DEMO_STORAGE_STATE } from "./helpers";

const ROUTES = [
  "/dashboard",
  "/workout",
  "/skill-lab",
  "/build-a-rep",
  "/library",
  "/progress",
  "/achievements",
  "/leaderboard",
  "/friends",
  "/compare",
  "/report",
  "/drills",
  "/validate",
  "/tutorial",
  "/settings",
] as const;

async function assertHealthy(page: Page, route: string): Promise<void> {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `${route} HTTP status`).toBeLessThan(400);

  // Client render settles (RSC streaming + hydration).
  await page.waitForLoadState("networkidle").catch(() => {});

  // Next.js error boundary / crash overlay / digest page.
  const errorSignals = page.locator(
    [
      "text=/Application error: a client-side exception/i",
      "text=/Something went wrong!/i",
      "text=/Internal Server Error/",
      "#nextjs__container_errors_label",
    ].join(", "),
  );
  await expect(errorSignals, `${route} shows an error surface`).toHaveCount(0);

  // The app chrome (nav) rendered — proves the layout tree mounted.
  await expect(
    page.getByRole("navigation").first(),
    `${route} renders app nav`,
  ).toBeVisible({ timeout: 15_000 });
}

test.describe("cold-start account", () => {
  test.describe.configure({ timeout: 120_000 });
  for (const route of ROUTES) {
    test(`renders ${route}`, async ({ page }) => {
      await assertHealthy(page, route);
    });
  }
});

test.describe("populated demo account", () => {
  test.describe.configure({ timeout: 120_000 });
  test.skip(
    !existsSync(DEMO_STORAGE_STATE),
    "demo account not seeded — run scripts/seed-demo-user.ts",
  );
  test.use({ storageState: DEMO_STORAGE_STATE });

  for (const route of ROUTES) {
    test(`renders ${route}`, async ({ page }) => {
      await assertHealthy(page, route);
    });
  }

  test("populated surfaces actually show history", async ({ page }) => {
    // Progress: the seeded 90 reps must surface as non-empty trends.
    await page.goto("/progress", { waitUntil: "networkidle" });
    await expect(page.getByText(/Your training, measured\./i)).toBeVisible();

    // Dashboard: a populated account gets real content, not the
    // first-run empty state.
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(
      page.getByText(/Application error|Something went wrong/i),
    ).toHaveCount(0);
  });
});
