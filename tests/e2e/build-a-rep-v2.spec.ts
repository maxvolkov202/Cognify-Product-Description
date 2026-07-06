/**
 * PRD v3 Phase 5 — Build a Rep v2 surfaces (route-shape spec).
 *
 * Unauthenticated coverage:
 *   • /build-a-rep renders the event-prep intake (flag ON in dev)
 *   • example chips populate the description
 *   • a bogus event id 404s rather than leaking
 *
 * Run:
 *   npm run dev               # in a separate terminal
 *   npx playwright install
 *   npx playwright test tests/e2e/build-a-rep-v2.spec.ts
 */

import { test, expect } from "@playwright/test";

test("intake renders under the v2 flag", async ({ page }) => {
  await page.goto("/build-a-rep", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("heading", {
      name: /Get ready for the moment in front of you/i,
    }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByRole("button", { name: /Build my prep/i }),
  ).toBeVisible();
});

test("example chip fills the description", async ({ page }) => {
  await page.goto("/build-a-rep", { waitUntil: "networkidle" });
  await page
    .getByRole("button", { name: /Best-man toast/i })
    .click();
  await expect(page.locator("#prep-description")).toHaveValue(
    /Best-man toast/i,
  );
  await expect(
    page.getByRole("button", { name: /Build my prep/i }),
  ).toBeEnabled();
});

test("bogus event id 404s", async ({ page }) => {
  const response = await page.goto(
    "/build-a-rep/00000000-0000-4000-8000-000000000000",
    { waitUntil: "networkidle" },
  );
  const status = response?.status() ?? 0;
  if (status !== 404) {
    await expect(page.getByText(/404|not found/i).first()).toBeVisible();
  }
});
