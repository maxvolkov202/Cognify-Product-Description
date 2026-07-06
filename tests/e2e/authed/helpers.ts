/**
 * Phase 11.B — shared helpers for the authed live-loop specs.
 *
 * Recording uses Chromium's fake microphone (spoken-rep.wav loops), so
 * "record for N seconds" captures N seconds of real speech; Deepgram
 * transcribes it and the live scorer grades it.
 */

import { expect, type Page } from "@playwright/test";

/** Record one rep: start → countdown → capture → submit, clicking
 *  through the too-short gate when it appears (test reps are shorter
 *  than the target window on purpose — the gate is part of the flow). */
export async function recordRep(page: Page, seconds = 12): Promise<void> {
  const start = page.getByRole("button", { name: "Start recording" });
  await expect(start).toBeVisible({ timeout: 30_000 });
  await start.click();

  // 3s countdown, then capture.
  await page.waitForTimeout(3_500 + seconds * 1_000);

  // Recording controls animate continuously (mic pulses with the audio
  // level) — Playwright's stability check never settles, so force.
  // Daily Workout renders the 3-tile row (Submit); other modes keep the
  // mic-stop button.
  const submitTile = page.getByRole("button", { name: /Submit/ });
  if (await submitTile.count()) {
    await submitTile.first().click({ force: true, timeout: 15_000 });
  } else {
    await page
      .getByRole("button", { name: "Stop recording" })
      .click({ force: true, timeout: 15_000 });
  }

  // Speaking-threshold gate (ratio floor) — proceed deliberately.
  const proceed = page.getByRole("button", { name: /Proceed anyway/i });
  try {
    await proceed.waitFor({ state: "visible", timeout: 8_000 });
    await proceed.click();
  } catch {
    // No gate (long-enough rep or mode without a threshold) — fine.
  }
}

/** Wait out live transcription + scoring until the feedback CTA shows. */
export async function awaitFeedback(
  page: Page,
  ctaPattern: RegExp,
  timeout = 240_000,
): Promise<void> {
  // RepSurface renders the nav CTA at both the top and bottom of the
  // feedback panel — first() avoids the strict-mode duplicate.
  await expect(
    page.getByRole("button", { name: ctaPattern }).first(),
  ).toBeVisible({ timeout });
}
