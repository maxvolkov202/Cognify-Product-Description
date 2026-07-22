/**
 * Overhaul P1 — Application Lab application surfaces (route-shape spec).
 * (Renamed from Skill Lab; route moved /skill-lab → /application-lab
 * with a 308 redirect. DB mode='skill_lab' + code identifiers unchanged.)
 *
 * Unauthenticated coverage (no storage-state fixture exists yet — the
 * full authed engine-loop spec lives in authed/skill-lab-loop.spec.ts):
 *   • old /skill-lab* paths 308-redirect to /application-lab*
 *   • /application-lab hub renders all 5 PRD applications
 *   • application card navigates to the session route (1–5 rep stepper)
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

test("old /skill-lab redirects to /application-lab", async ({ page }) => {
  await page.goto("/skill-lab", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/application-lab$/);
});

test("hub renders all five applications", async ({ page }) => {
  await page.goto("/application-lab", { waitUntil: "networkidle" });
  for (const label of APPLICATIONS) {
    await expect(
      page.getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
  }
});

test("application card opens the session rep-count stepper", async ({ page }) => {
  await page.goto("/application-lab", { waitUntil: "networkidle" });
  await page.locator('a[href="/application-lab/storytelling"]').click();
  // Generous timeout: first hit compiles the route on the dev server.
  await expect(page).toHaveURL(/\/application-lab\/storytelling$/, {
    timeout: 30_000,
  });
  // The 1–5 stepper (default 3) + Start CTA replaces the old fixed
  // 3/5/10 length buttons.
  await expect(page.getByText("How many reps?")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByRole("button", { name: /Start session/i }),
  ).toBeVisible();
});

test("legacy ?focus= deep-link lands on /drills", async ({ page }) => {
  await page.goto("/skill-lab?focus=clarity", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/drills\?focus=clarity/);
});

test("dimension slug redirects to its drill home", async ({ page }) => {
  await page.goto("/application-lab/clarity", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/drills\?focus=clarity/);
});

test("exemplars survive the segment rename", async ({ page }) => {
  await page.goto("/application-lab/clarity/exemplars", {
    waitUntil: "networkidle",
  });
  await expect(
    page.getByRole("heading", { name: /What each band sounds like/i }),
  ).toBeVisible();
});

test("unknown application slug 404s", async ({ page }) => {
  const response = await page.goto("/application-lab/not-an-app", {
    waitUntil: "networkidle",
  });
  // Next dev may stream the not-found boundary with a 200; assert the
  // 404 UI either way.
  const status = response?.status() ?? 0;
  if (status !== 404) {
    await expect(page.getByText(/404|not found/i).first()).toBeVisible();
  }
});
