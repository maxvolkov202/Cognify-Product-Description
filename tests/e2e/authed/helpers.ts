/**
 * Phase 11.B — shared helpers for the authed live-loop specs.
 *
 * Recording uses Chromium's fake microphone (spoken-rep.wav loops), so
 * "record for N seconds" captures N seconds of real speech; Deepgram
 * transcribes it and the live scorer grades it.
 */

import { expect, type Page } from "@playwright/test";
import { resolve } from "node:path";

/** Phase 12 — storageState for the populated demo account (written by
 *  auth.setup when demo@cognify.test exists; seed via seed-demo-user.ts).
 *  Lives here, not in auth.setup.ts — Playwright forbids test files
 *  importing other test files. */
export const DEMO_STORAGE_STATE = resolve(__dirname, ".auth/demo.json");

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

/** Wait out live transcription + scoring until the feedback CTA shows.
 *  Slow transcription can surface the speaking-threshold gate AFTER
 *  recordRep's own 8s proceed-window — so this also clicks through a
 *  late "Proceed anyway" instead of dying on a gate nobody dismissed. */
export async function awaitFeedback(
  page: Page,
  ctaPattern: RegExp,
  timeout = 240_000,
): Promise<void> {
  const deadline = Date.now() + timeout;
  const cta = page.getByRole("button", { name: ctaPattern }).first();
  const proceed = page.getByRole("button", { name: /Proceed anyway/i });
  for (;;) {
    if (await cta.isVisible().catch(() => false)) return;
    if (await proceed.isVisible().catch(() => false)) {
      await proceed.click().catch(() => {});
    }
    if (Date.now() > deadline) break;
    await page.waitForTimeout(500);
  }
  // Final assertion for a proper error message on true timeout.
  await expect(cta).toBeVisible({ timeout: 1_000 });
}
