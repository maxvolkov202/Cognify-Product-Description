/**
 * Phase 11.B4 / Overhaul P1 — Application Lab application session, LIVE:
 * hub → Storytelling → 1–5 rep stepper → prompt → insight → First Rep →
 * required Retry → Improvement Review → quit banks the session →
 * §6.8 Session Complete renders.
 *
 * Parametrized over the stepper's range extremes (1 and 5) so the P1
 * smoke test exercises both clamp ends driving real session length.
 *
 * Run: AUTHED=1 npx playwright test tests/e2e/authed/skill-lab-loop.spec.ts
 */

import { test, expect } from "@playwright/test";
import { recordRep, awaitFeedback } from "./helpers";

/** Drive the stepper (default 3) to `count` via its +/- buttons. */
async function setRepCount(page: import("@playwright/test").Page, count: number) {
  const dec = page.getByRole("button", { name: /Decrease How many reps\?/i });
  const inc = page.getByRole("button", { name: /Increase How many reps\?/i });
  for (let i = 3; i > count; i--) await dec.click();
  for (let i = 3; i < count; i++) await inc.click();
  await expect(page.getByText(String(count), { exact: true })).toBeVisible();
}

for (const count of [1, 5]) {
  test(`application lab session (${count} reps): loop → banked session complete`, async ({
    page,
  }) => {
    await page.goto("/application-lab/storytelling", {
      waitUntil: "networkidle",
    });

    // 1–5 rep stepper (default 3) → set to the target → Start.
    await setRepCount(page, count);
    await page.getByRole("button", { name: /Start session/i }).click();

    // Prompt → insight → first rep.
  const promptCard = page.getByTestId("prompt-card").first();
  await expect(promptCard).toBeVisible({ timeout: 60_000 });
  await promptCard.click();
  await page.getByTestId("insight-ready").click();

  await recordRep(page);
  await awaitFeedback(page, /Start your Retry/i);
  await expect(page.getByText(/Coach's Focus/i).first()).toBeVisible();

  // Required retry → Improvement Review.
  // Two copies render (top nav + bottom); the bottom one is the
  // stable click target once the panel settles.
  await page
    .getByRole("button", { name: /Start your Retry/i })
    .last()
    // force: the gradient CTA animates continuously, so Playwright's
    // stability check never settles; visibility is asserted above.
    .click({ force: true, timeout: 30_000 });
  await recordRep(page);
  await expect(page.getByTestId("improvement-review")).toBeVisible({
    timeout: 240_000,
  });

  // Quit banks the session → §6.8 Session Complete.
  await page.getByTestId("review-quit").click();
  await expect(page.getByText(/Storytelling session banked/i)).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText(/Coach's call/i)).toBeVisible({
    timeout: 30_000,
  });
  });
}
