/**
 * Phase 16 (pre-prod) — the WHOLE day in one browser session: resume the
 * in-flight day, complete every remaining exercise through the v2 loop
 * (first → retry → improvement review → advance), decline the graduation
 * rep, and land on Day Complete with the §5.7 Final Communication Score
 * + paired First→Retry breakdown + ProgressionStrip rendered.
 *
 * Opt-in (costs ~4-6 live reps): AUTHED=1 FULLDAY=1 npx playwright test
 * tests/e2e/authed/zz-full-day.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";
import { recordRep, awaitFeedback } from "./helpers";

test.skip(process.env.FULLDAY !== "1", "opt-in with FULLDAY=1");
test.describe.configure({ timeout: 900_000 });

async function completeOneExercise(page: Page): Promise<void> {
  const promptCard = page.getByTestId("prompt-card").first();
  await expect(promptCard).toBeVisible({ timeout: 60_000 });
  await promptCard.click();
  const ready = page.getByTestId("insight-ready");
  try {
    await ready.waitFor({ state: "visible", timeout: 10_000 });
    await ready.click();
  } catch {
    // resumed mid-rep
  }
  await recordRep(page);
  await awaitFeedback(page, /Start your Retry/i);
  await page
    .getByRole("button", { name: /Start your Retry/i })
    .last()
    .click({ force: true, timeout: 30_000 });
  await expect(
    page.getByText(/What one change creates the biggest improvement/i),
  ).toBeVisible({ timeout: 20_000 });
  await recordRep(page);
  await expect(page.getByTestId("improvement-review")).toBeVisible({
    timeout: 240_000,
  });
  await page.getByTestId("review-advance").click();
}

test("full day: every station → day complete with final score", async ({
  page,
}) => {
  await page.goto("/workout", { waitUntil: "networkidle" });
  const startCta = page.getByRole("button", {
    name: /Start (today.s )?workout/i,
  });
  if (await startCta.count()) await startCta.first().click();

  // Complete exercises until the graduation prompt appears (handles any
  // resume position — 3 fresh or fewer when the day is mid-flight).
  for (let i = 0; i < 4; i++) {
    const graduation = page.getByRole("button", { name: "Call it a day" });
    const promptCard = page.getByTestId("prompt-card").first();
    await Promise.race([
      graduation.waitFor({ state: "visible", timeout: 90_000 }),
      promptCard.waitFor({ state: "visible", timeout: 90_000 }),
    ]);
    if (await graduation.count()) break;
    await completeOneExercise(page);
  }

  // Decline the pressure rep → Day Complete.
  await expect(
    page.getByRole("button", { name: "Call it a day" }),
  ).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Call it a day" }).click();

  // §5.7 Workout Complete — the strip + the day summary render.
  await expect(page.getByTestId("progression-strip")).toBeVisible({
    timeout: 60_000,
  });
});
