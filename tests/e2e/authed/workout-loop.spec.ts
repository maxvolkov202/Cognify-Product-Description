/**
 * Phase 11.B4 — the Daily Workout engine loop, LIVE end to end:
 * start day → prompt pick → Coach's Insight → First Rep (fake mic →
 * Deepgram → live scoring) → full feedback (ONE Coach's Focus) →
 * encouraged Retry → Improvement Review (verdict + breakdown) → next exercise.
 *
 * Run: AUTHED=1 npx playwright test tests/e2e/authed/workout-loop.spec.ts
 * Costs real transcription + scoring credits (~2 reps).
 */

import { test, expect } from "@playwright/test";
import { recordRep, awaitFeedback } from "./helpers";

test("daily workout loop: rep → focus → retry → improvement review", async ({
  page,
}) => {
  await page.goto("/workout", { waitUntil: "networkidle" });

  // Landing → start the day (skip if a day is already mid-flight).
  const startCta = page.getByRole("button", { name: /Start (today.s )?workout/i });
  if (await startCta.count()) {
    await startCta.first().click();
  }

  // Prompt picker → first candidate card.
  const promptCard = page.getByTestId("prompt-card").first();
  await expect(promptCard).toBeVisible({ timeout: 60_000 });
  await promptCard.click();

  // Coach's Insight (may be skipped when resuming mid-rep).
  const ready = page.getByTestId("insight-ready");
  try {
    await ready.waitFor({ state: "visible", timeout: 10_000 });
    await ready.click();
  } catch {
    // Already past the insight (resumed session) — continue.
  }

  // First Rep — live pipeline.
  await recordRep(page);
  await awaitFeedback(page, /Retry this rep/i);

  // D26 feedback contract: ONE Coach's Focus, no legacy split; Retry is
  // primary and Continue is available.
  await expect(page.getByText(/Coach's Focus/i).first()).toBeVisible();
  await expect(page.getByText("What you did well")).toHaveCount(0);
  await expect(page.getByText("What didn't land")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue" }).first()).toBeVisible();

  // PRD §4.5.3 — the six Core Skills are scored on THIS screen too, each
  // card collapsed until tapped, then showing why-this-score + how to
  // improve. Trimming this was the D26 overcorrection; it is back.
  const skillGrid = page.getByTestId("core-skill-grid");
  await expect(skillGrid).toBeVisible();
  const clarityCard = skillGrid.getByRole("button", { name: /Clarity/i }).first();
  await expect(clarityCard).toHaveAttribute("aria-expanded", "false");
  await clarityCard.click();
  await expect(clarityCard).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#dim-panel-clarity")).toBeVisible();

  // Playback is available before the retry as well.
  await expect(page.getByRole("button", { name: "Play" }).first()).toBeVisible();

  // Choose the encouraged Retry branch.
  // Two copies render (top nav + bottom); the bottom one is the
  // stable click target once the panel settles.
  await page
    .getByRole("button", { name: /Retry this rep/i })
    .first()
    .click({ timeout: 30_000 });
  // The FocusOverlay always renders the §4.6 framing line (host-agnostic).
  await expect(
    page.getByText(/What one change creates the biggest improvement/i),
  ).toBeVisible({ timeout: 20_000 });
  await recordRep(page);

  // Improvement Review: verdict + Core Skill breakdown (§4.7).
  await expect(page.getByTestId("improvement-review")).toBeVisible({
    timeout: 240_000,
  });
  await expect(page.getByTestId("implementation-verdict")).toBeVisible();
  await expect(page.getByText(/Core Skill breakdown/i)).toBeVisible();

  // Advance — the loop hands off to the next exercise's prompt picker.
  await page.getByTestId("review-advance").click();
  await expect(page.getByTestId("prompt-card").first()).toBeVisible({
    timeout: 60_000,
  });
});
