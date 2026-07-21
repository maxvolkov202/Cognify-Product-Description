/**
 * Regression smoke for the 2026-07-21 workout-loop fixes
 * (branch fix/workout-loop-score-reveal-notes-resume):
 *
 *   1. Score reveal must HOLD after a rep is scored — the app must not jump
 *      back to the record screen. The old bug remounted RepSurface when the
 *      machine flipped recording→score-reveal; the prior loop e2e never
 *      caught it because it clicked "Start your Retry" inside the ~0.32s exit
 *      window. This spec PAUSES like a human, then asserts the feedback is
 *      still there — the assertion that actually reproduces the bug.
 *   2. Every rep reaches scoring — both a proper-length rep AND a short rep
 *      that goes through the "Proceed anyway" gate.
 *   3. Jotted notes are cleared once the rep is scored (no bleed into the
 *      next rep at that station).
 *   4. Leaving mid-day and coming back RESUMES at the next rep, not rep 1.
 *
 * Run: AUTHED=1 npx playwright test tests/e2e/authed/zz-workout-fix-smoke.spec.ts
 * Costs live transcription + scoring credits (~4 reps).
 */

import { test, expect, type Page } from "@playwright/test";
import { recordRep, awaitFeedback } from "./helpers";

test.describe.configure({ timeout: 600_000 });

/** Symptom 1 guard: after scoring, the feedback CTA must survive a
 *  human-length pause and the record screen must NOT reappear. */
async function assertScoreRevealHolds(page: Page): Promise<void> {
  const cta = page.getByRole("button", { name: /Start your Retry/i }).first();
  await expect(cta).toBeVisible();
  // Pause well past the exit animation (~0.32s) + the tagWorkoutRep
  // round-trip (~200ms) that delayed SCORE_DONE in the bug.
  await page.waitForTimeout(4_000);
  await expect(cta, "score reveal must not jump back to the record screen").toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start recording" }),
    "record screen must not reappear after scoring",
  ).toHaveCount(0);
}

async function pickPromptThenInsight(page: Page): Promise<void> {
  const promptCard = page.getByTestId("prompt-card").first();
  await expect(promptCard).toBeVisible({ timeout: 60_000 });
  await promptCard.click();
  const ready = page.getByTestId("insight-ready");
  try {
    await ready.waitFor({ state: "visible", timeout: 10_000 });
    await ready.click();
  } catch {
    // Resumed past the insight — fine.
  }
}

/** Full v2 station: first rep → feedback (held) → retry → improvement
 *  review → advance. `seconds` controls whether we hit the too-short gate. */
async function completeStationHoldingFeedback(
  page: Page,
  seconds: number,
): Promise<void> {
  await pickPromptThenInsight(page);

  // First rep — reaches scoring (short reps route through Proceed anyway
  // inside recordRep; long reps skip the gate). Either way: feedback.
  await recordRep(page, seconds);
  await awaitFeedback(page, /Start your Retry/i);
  await assertScoreRevealHolds(page);

  // Required retry.
  await page
    .getByRole("button", { name: /Start your Retry/i })
    .last()
    .click({ force: true, timeout: 30_000 });
  await expect(
    page.getByText(/What one change creates the biggest improvement/i),
  ).toBeVisible({ timeout: 20_000 });
  await recordRep(page, seconds);

  // Improvement review → advance to the next station.
  await expect(page.getByTestId("improvement-review")).toBeVisible({
    timeout: 240_000,
  });
  await page.getByTestId("review-advance").click();
}

test("workout loop fix: score reveal holds, both gates score, notes clear, resume advances", async ({
  page,
}) => {
  await page.goto("/workout", { waitUntil: "networkidle" });
  const startCta = page.getByRole("button", {
    name: /Start (today.s )?workout/i,
  });
  if (await startCta.count()) await startCta.first().click();

  // ── Station 1: jot a note, short rep + Proceed anyway, feedback holds,
  //    note is cleared once scored. ───────────────────────────────────────
  await pickPromptThenInsight(page);

  // Jot a distinctive note (best-effort — only when the framework strip +
  // notes toggle are present for this dimension).
  const jotToggle = page.getByRole("button", { name: /Jot notes/i });
  let notesKey: string | null = null;
  if (await jotToggle.count()) {
    await jotToggle.first().click();
    const firstNote = page.locator('input[type="text"]').first();
    if (await firstNote.count()) {
      await firstNote.fill("SMOKE-NOTE-KEEPME");
      // Debounced auto-save is 300ms.
      await page.waitForTimeout(500);
      notesKey = await page.evaluate(() => {
        const k = Object.keys(localStorage).find(
          (key) =>
            key.startsWith("cognify.rep-notes.") &&
            (localStorage.getItem(key) ?? "").includes("SMOKE-NOTE-KEEPME"),
        );
        return k ?? null;
      });
      expect(notesKey, "jotted note should persist to localStorage").toBeTruthy();
    }
  }

  // Short rep → the speaking-threshold gate → Proceed anyway → scoring.
  await recordRep(page, 12);
  await awaitFeedback(page, /Start your Retry/i);
  await assertScoreRevealHolds(page);

  // Symptom 2: the jotted note is cleared once the rep is scored.
  if (notesKey) {
    await expect
      .poll(
        async () =>
          await page.evaluate((k) => localStorage.getItem(k), notesKey),
        { timeout: 10_000, message: "jotted note must be cleared after scoring" },
      )
      .toBeFalsy();
  }

  // Finish station 1 (retry → review → advance).
  await page
    .getByRole("button", { name: /Start your Retry/i })
    .last()
    .click({ force: true, timeout: 30_000 });
  await expect(
    page.getByText(/What one change creates the biggest improvement/i),
  ).toBeVisible({ timeout: 20_000 });
  await recordRep(page, 12);
  await expect(page.getByTestId("improvement-review")).toBeVisible({
    timeout: 240_000,
  });
  await page.getByTestId("review-advance").click();

  // Now on station 2's prompt picker. Capture the resume position.
  await expect(page.getByTestId("prompt-card").first()).toBeVisible({
    timeout: 60_000,
  });
  const progressBefore = await page
    .getByText(/Rep \d+ of \d+/i)
    .first()
    .textContent();
  expect(progressBefore, "should be past rep 1 after finishing station 1").not.toMatch(
    /Rep 1 of/i,
  );

  // ── Symptom 3: leave mid-day, come back, and resume at THIS rep — not
  //    rep 1. ────────────────────────────────────────────────────────────
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await page.goto("/workout", { waitUntil: "networkidle" });
  const resumeCta = page.getByRole("button", {
    name: /Start (today.s )?workout/i,
  });
  if (await resumeCta.count()) await resumeCta.first().click();

  await expect(
    page.getByText(/Rep \d+ of \d+/i).first(),
    "resume must not restart at rep 1",
  ).not.toHaveText(/Rep 1 of/i, { timeout: 60_000 });

  // ── Station 2: a longer rep (aims to clear the gate) still reaches
  //    scoring and holds. Proves "a rep always gets to scoring" on the
  //    proper-length path too. ─────────────────────────────────────────────
  await completeStationHoldingFeedback(page, 45);

  // Landed somewhere valid after two full stations: either the next
  // station's picker or the graduation prompt (day nearly done).
  const nextPrompt = page.getByTestId("prompt-card").first();
  const graduation = page.getByRole("button", { name: "Call it a day" });
  await Promise.race([
    nextPrompt.waitFor({ state: "visible", timeout: 60_000 }),
    graduation.waitFor({ state: "visible", timeout: 60_000 }),
  ]);
  expect(
    (await nextPrompt.count()) + (await graduation.count()),
    "loop should hand off cleanly after two stations",
  ).toBeGreaterThan(0);
});
