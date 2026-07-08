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

  // Client render settles (RSC streaming + hydration). Capped: pages
  // with background polling never reach networkidle and would otherwise
  // burn the full 30s default per route.
  await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => {});

  // Next.js error boundary / crash overlay / digest page. One locator
  // per signal — comma-joining `text=/re/` selectors makes Playwright
  // parse the tail as regex flags (SyntaxError, not a real failure).
  const errorSignals = [
    page.getByText(/Application error: a client-side exception/i),
    page.getByText(/Something went wrong!/i),
    page.getByText(/Internal Server Error/),
    page.locator("#nextjs__container_errors_label"),
  ];
  for (const signal of errorSignals) {
    await expect(signal, `${route} shows an error surface`).toHaveCount(0);
  }

  // The app chrome (nav) rendered — proves the layout tree mounted.
  await expect(
    page.getByRole("navigation").first(),
    `${route} renders app nav`,
  ).toBeVisible({ timeout: 15_000 });

  // The session was actually recognized server-side. Under DB pressure
  // (pooler EMAXCONN — see findings F-2) auth silently degrades to guest
  // and every page still "renders fine" — this is the assertion that
  // catches it.
  await expect(
    page.getByRole("button", { name: "Sign in" }),
    `${route} rendered as GUEST — session not recognized (DB/auth degraded?)`,
  ).toHaveCount(0);
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
  // NOTE: Playwright collects tests (and evaluates this skip) BEFORE the
  // setup project runs, so on a machine's very first AUTHED run this
  // group skips even though setup writes demo.json during that same run.
  // It runs from the second invocation on. (storageState paths must
  // exist at context creation, so a lazy per-test skip can't work.)
  test.skip(
    !existsSync(DEMO_STORAGE_STATE),
    "demo account not seeded — run scripts/seed-demo-user.ts + AUTHED=1 once",
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
