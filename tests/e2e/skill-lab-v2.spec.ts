/**
 * PRD v3 Phase 4 — Skill Lab application surfaces (route-shape spec).
 *
 * Unauthenticated coverage (no storage-state fixture exists yet — the
 * full authed engine-loop spec is tracked as the Phase 1 open item):
 *   • /skill-lab hub renders all 5 PRD applications
 *   • application card navigates to the session route (length pick)
 *   • legacy ?focus= deep-links land on /drills (D9 relocation)
 *   • exemplars survive the [dimension]→[slug] segment rename
 *
 * Run:
 *   npm run dev               # in a separate terminal
 *   npx playwright install chromium
 *   npm run test:e2e
 */

import { test, expect } from "@playwright/test";

const APPLICATIONS = [
  "Storytelling",
  "Presenting",
  "Teaching",
  "Interviewing",
  "Persuasion",
];

test("hub renders all five applications", async ({ page }) => {
  await page.goto("/skill-lab", { waitUntil: "networkidle" });
  for (const label of APPLICATIONS) {
    await expect(
      page.getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
  }
});

test("application card opens the session length pick", async ({ page }) => {
  await page.goto("/skill-lab", { waitUntil: "networkidle" });
  await page.locator('a[href="/skill-lab/storytelling"]').click();
  // Generous timeout: first hit compiles the route on the dev server.
  await expect(page).toHaveURL(/\/skill-lab\/storytelling$/, {
    timeout: 30_000,
  });
  await expect(
    page.getByRole("button", { name: /3 exercises/i }),
  ).toBeVisible({ timeout: 15_000 });
});

test("legacy ?focus= deep-link lands on /drills", async ({ page }) => {
  await page.goto("/skill-lab?focus=clarity", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/drills\?focus=clarity/);
});

test("dimension slug redirects to its drill home", async ({ page }) => {
  await page.goto("/skill-lab/clarity", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/drills\?focus=clarity/);
});

test("exemplars survive the segment rename", async ({ page }) => {
  await page.goto("/skill-lab/clarity/exemplars", {
    waitUntil: "networkidle",
  });
  await expect(
    page.getByRole("heading", { name: /What each band sounds like/i }),
  ).toBeVisible();
});

test("unknown application slug 404s", async ({ page }) => {
  const response = await page.goto("/skill-lab/not-an-app", {
    waitUntil: "networkidle",
  });
  // Next dev may stream the not-found boundary with a 200; assert the
  // 404 UI either way.
  const status = response?.status() ?? 0;
  if (status !== 404) {
    await expect(page.getByText(/404|not found/i).first()).toBeVisible();
  }
});
