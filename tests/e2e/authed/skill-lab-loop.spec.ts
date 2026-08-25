/**
 * Phase 11.B4 / Overhaul P1 — Application Lab application session, LIVE:
 * hub → Storytelling → 1–5 rep stepper → prompt → insight → First Rep →
 * compact feedback → Continue or Retry → optional Improvement Review →
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
  test(`application lab session (${count} reps): optional retry flow completes`, async ({
    page,
  }) => {
    await page.goto("/application-lab/storytelling", {
      waitUntil: "networkidle",
    });
    const startFresh = page.getByRole("button", { name: /Start fresh/i });
    if (await startFresh.count()) await startFresh.first().click();

    // 1–5 rep stepper (default 3) → set to the target → Start.
    await setRepCount(page, count);
    await page.getByRole("button", { name: /Start session/i }).click();

    // Prompt → insight → first rep.
  const promptCard = page.getByTestId("prompt-card").first();
  await expect(promptCard).toBeVisible({ timeout: 60_000 });
  await promptCard.click();
  await page.getByTestId("insight-ready").click();

    await recordRep(page);
    await awaitFeedback(page, /Retry this rep/i);
    await expect(page.getByText(/Coach's Focus/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" }).first()).toBeVisible();
    // PRD §4.5.3 — six-skill breakdown is on the first feedback screen too.
    await expect(page.getByTestId("core-skill-grid")).toBeVisible();

    if (count === 1) {
      // D26 Continue branch: skip the retry and complete the one-rep session.
      await page.getByRole("button", { name: "Continue" }).first().click();
      await expect(page.getByText(/Storytelling session complete/i)).toBeVisible({
        timeout: 60_000,
      });
    } else {
      // Encouraged Retry branch → Improvement Review.
      await page
        .getByRole("button", { name: /Retry this rep/i })
        .first()
        .click({ timeout: 30_000 });
      await expect(page).toHaveURL(/\/application-lab\/storytelling/);
      await recordRep(page);
      await expect(page.getByTestId("improvement-review")).toBeVisible({
        timeout: 240_000,
      });
      await expect(page.getByText(/Listen back/i)).toBeVisible();
      await expect(page.getByText(/Core Skill breakdown/i)).toBeVisible();

      // Advance into exercise 2: its first-attempt breakdown carries
      // movement chips vs exercise 1's latest attempt (§4.5.3 movement,
      // C10-softened). Chip presence depends on real score movement, so
      // it's evidenced (count + screenshot artifact), not hard-asserted.
      await page.getByTestId("review-advance").click();
      const nextPrompt = page.getByTestId("prompt-card").first();
      await expect(nextPrompt).toBeVisible({ timeout: 60_000 });
      await nextPrompt.click();
      await page.getByTestId("insight-ready").click();
      await recordRep(page);
      await awaitFeedback(page, /Retry this rep/i);
      await expect(page.getByTestId("core-skill-grid")).toBeVisible();
      const chipCount = await page
        .locator('[data-testid^="dim-delta-"]')
        .count();
      console.log(`[delta-chips] exercise 2 first-attempt chips: ${chipCount}`);
      await page.screenshot({
        path: "test-results/delta-chips-exercise2.png",
        fullPage: true,
      });

      // Retry exercise 2, then quit from its review (the picker has no
      // quit affordance) and bank the session.
      await page
        .getByRole("button", { name: /Retry this rep/i })
        .first()
        .click({ timeout: 30_000 });
      await recordRep(page);
      await expect(page.getByTestId("improvement-review")).toBeVisible({
        timeout: 240_000,
      });
      await page.getByTestId("review-quit").click();
      await expect(page.getByText(/Storytelling session banked/i)).toBeVisible({
        timeout: 60_000,
      });
    }
    await expect(page.getByText(/Coach's call/i)).toBeVisible({
      timeout: 30_000,
    });
  });
}
