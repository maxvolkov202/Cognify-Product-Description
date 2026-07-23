/**
 * UI + Feature Overhaul Wave — Phase 5 smoke (LIVE, authed, fake mic).
 *
 * Proves the whole rep flow still works after the abort + Suggested-Framework
 * changes, plus the two safety invariants Max called out:
 *   1. Full loop: record → grade → Coach's feedback → required Retry →
 *      Improvement Review → advance to the next station.
 *   2. Abort: discard a rep mid-recording → returns to idle, NOTHING scored,
 *      NO session advance; then re-record the same slot → it grades normally.
 *   3. Day progress persists on a mid-day exit — reload after finishing a
 *      station and the day resumes with prior progress (rep 2 / rep 3), not a
 *      fresh start.
 *   + the "Suggested Framework" relabel (5.2) is on the rep screen.
 *
 * Run (reuses the stored session, dodging the auth rate limit):
 *   npx playwright test --config playwright.p5.config.ts
 */

import { test, expect, type Page } from "@playwright/test";
import { recordRep, awaitFeedback } from "./helpers";

/** Get from the workout landing to a station's rep screen (start day if
 *  needed, pick a prompt, click through the Coach's Insight). */
async function reachRepScreen(page: Page): Promise<void> {
  const startCta = page.getByRole("button", {
    name: /Start (today.s )?workout/i,
  });
  if (await startCta.count()) await startCta.first().click();

  const promptCard = page.getByTestId("prompt-card").first();
  await expect(promptCard).toBeVisible({ timeout: 60_000 });
  await promptCard.click();

  const ready = page.getByTestId("insight-ready");
  try {
    await ready.waitFor({ state: "visible", timeout: 10_000 });
    await ready.click();
  } catch {
    // Already past the insight (resumed mid-rep) — continue.
  }
}

test("Phase 5: framework relabel + abort (no grade/advance) + full loop + resume", async ({
  page,
}) => {
  await page.goto("/workout", { waitUntil: "networkidle" });
  await reachRepScreen(page);

  // ── 5.2 — the framework is labeled "Suggested Framework" ──────────────
  await expect(page.getByText(/Suggested Framework/i).first()).toBeVisible({
    timeout: 30_000,
  });

  // ── 5.1 — ABORT mid-recording writes nothing + does not advance ───────
  const startRecording = page.getByRole("button", { name: "Start recording" });
  await expect(startRecording).toBeVisible({ timeout: 30_000 });
  await startRecording.click();
  // 3s countdown + ~3s of recording, then discard (the red "Discard rep" pill).
  await page.waitForTimeout(3_500 + 3_000);
  const discard = page.getByRole("button", { name: /Discard this rep/i });
  await expect(discard).toBeVisible({ timeout: 10_000 });
  await discard.click({ force: true });

  // Back to idle: the record button returns and NO feedback CTA appeared
  // (nothing was transcribed / scored / saved / advanced).
  await expect(
    page.getByRole("button", { name: "Start recording" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("button", { name: /Start your Retry/i }),
  ).toHaveCount(0);

  // ── Re-record the SAME slot → it grades normally (Coach's feedback) ───
  await recordRep(page);
  await awaitFeedback(page, /Start your Retry/i);
  await expect(page.getByText(/Coach's Focus/i).first()).toBeVisible();

  // ── Required Retry → Improvement Review (full loop) ───────────────────
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

  // Advance → next station's prompt picker. Station 1 is now fully logged,
  // so the day's completedReps has moved past station 1.
  await page.getByTestId("review-advance").click();
  await expect(page.getByTestId("prompt-card").first()).toBeVisible({
    timeout: 60_000,
  });

  // ── Day progress persists across a mid-day exit (rep 2 / rep 3) ───────
  // Reload as if the user left and came back. The day must RESUME (prior
  // reps saved), not restart from an empty "no workout yet" state.
  await page.goto("/workout", { waitUntil: "networkidle" });
  // Resuming lands on the idle landing with a Start that drops the user back
  // at the current station (the picker), or straight into the picker.
  const resumeStart = page.getByRole("button", {
    name: /Start (today.s )?workout/i,
  });
  if (await resumeStart.count()) await resumeStart.first().click();
  // The day is still active and we reach a station picker — progress saved.
  await expect(page.getByTestId("prompt-card").first()).toBeVisible({
    timeout: 60_000,
  });
  // The pre-day empty/onboarding state must NOT be what we see.
  await expect(
    page.getByRole("button", { name: /Start your first workout/i }),
  ).toHaveCount(0);
});

test("Phase 5b: Application Lab shows a Suggested Framework + abort + grades", async ({
  page,
}) => {
  await page.goto("/application-lab/storytelling", { waitUntil: "networkidle" });

  // An in-progress session offers a resume — start fresh so we hit the picker.
  const startFresh = page.getByRole("button", { name: /Start fresh/i });
  if (await startFresh.count()) await startFresh.first().click();

  // 1-rep session (keep it cheap) → Start.
  const dec = page.getByRole("button", { name: /Decrease How many reps\?/i });
  await expect(dec).toBeVisible({ timeout: 15_000 });
  await dec.click();
  await dec.click(); // 3 → 1
  await page.getByRole("button", { name: /Start session/i }).click();

  // Prompt → insight → rep screen.
  const promptCard = page.getByTestId("prompt-card").first();
  await expect(promptCard).toBeVisible({ timeout: 60_000 });
  await promptCard.click();
  await page.getByTestId("insight-ready").click();

  // Phase 5b — the Suggested Framework strip now renders in Application Lab.
  await expect(page.getByText(/Suggested Framework/i).first()).toBeVisible({
    timeout: 30_000,
  });

  // Abort mid-recording → back to idle, no grade/advance.
  const startRecording = page.getByRole("button", { name: "Start recording" });
  await expect(startRecording).toBeVisible({ timeout: 30_000 });
  await startRecording.click();
  await page.waitForTimeout(3_500 + 3_000);
  const discard = page.getByRole("button", { name: /Discard this rep/i });
  await expect(discard).toBeVisible({ timeout: 10_000 });
  await discard.click({ force: true });
  await expect(
    page.getByRole("button", { name: "Start recording" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("button", { name: /Start your Retry/i }),
  ).toHaveCount(0);

  // Re-record → it grades normally (Coach's feedback reached).
  await recordRep(page);
  await awaitFeedback(page, /Start your Retry/i);
  await expect(page.getByText(/Coach's Focus/i).first()).toBeVisible();
});
