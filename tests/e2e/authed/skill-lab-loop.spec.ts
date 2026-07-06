/**
 * Phase 11.B4 — Skill Lab application session, LIVE:
 * hub → Storytelling → length pick → prompt → insight → First Rep →
 * required Retry → Improvement Review → quit banks the session →
 * §6.8 Session Complete renders.
 *
 * Run: AUTHED=1 npx playwright test tests/e2e/authed/skill-lab-loop.spec.ts
 */

import { test, expect } from "@playwright/test";
import { recordRep, awaitFeedback } from "./helpers";

test("skill lab session: application loop → banked session complete", async ({
  page,
}) => {
  await page.goto("/skill-lab/storytelling", { waitUntil: "networkidle" });

  // Length pick (3 recommended).
  await page.getByRole("button", { name: /3 exercises/i }).click();

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
