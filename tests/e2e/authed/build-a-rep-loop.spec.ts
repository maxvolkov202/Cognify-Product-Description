/**
 * Phase 11.B4 — Build a Rep event prep, LIVE:
 * intake → generated Preparation Plan → guided moment (insight w/
 * editable time → rep → feedback) → back to plan → Readiness Review.
 *
 * Run: AUTHED=1 npx playwright test tests/e2e/authed/build-a-rep-loop.spec.ts
 */

import { test, expect } from "@playwright/test";
import { recordRep, awaitFeedback } from "./helpers";

test("build a rep: intake → plan → guided moment → readiness review", async ({
  page,
}) => {
  await page.goto("/build-a-rep", { waitUntil: "networkidle" });

  // Intake — plan generation is a live model call.
  await page
    .locator("#prep-description")
    .fill("SDR interview at a mid-size software company next week");
  await page.getByRole("button", { name: /Build my prep/i }).click();

  // Plan screen: Critical Moments with Practice buttons.
  const practiceBtn = page.getByRole("button", { name: "Practice" }).first();
  await expect(practiceBtn).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Preparation Plan/i)).toBeVisible();

  // Guided moment: insight shows the EDITABLE recommended time (§7.7).
  await practiceBtn.click();
  await expect(page.getByText(/Coach's Insight/i)).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByLabel(/Recommended speaking time in seconds/i),
  ).toBeVisible();
  await page.getByRole("button", { name: /start the rep/i }).click();

  await recordRep(page);
  await awaitFeedback(page, /Start your Retry/i);

  // Retry is OPTIONAL here (§7.7) — return to the plan instead.
  await page
    .getByRole("button", { name: /Back to plan/i })
    .first()
    .click();
  await expect(page.getByText(/Preparation Plan/i)).toBeVisible({
    timeout: 30_000,
  });

  // Readiness Review (live generation).
  await page
    .getByRole("button", { name: /Finish & get my Readiness Review/i })
    .click();
  // "Readiness Review" also appears in the transition spinner and the
  // plan's recap — anchor on labels unique to the review screen, with
  // generation-length timeouts.
  await expect(page.getByText(/Overall Communication Score/i)).toBeVisible({
    timeout: 180_000,
  });
  await expect(page.getByText(/your one focus/i)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Readiness summary/i)).toBeVisible({
    timeout: 30_000,
  });
});
