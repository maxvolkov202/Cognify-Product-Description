"use client";

import type { WorkoutSessionPlan } from "@/lib/ai/workout-prompts";
import type { RepScore } from "@/types/domain";

/**
 * Daily Workout pause/resume persistence.
 *
 * Between-rep pause state stored in localStorage. Mid-rep pause is
 * explicitly NOT supported (per the team spec interpretation: tap Done
 * to finish the current rep, then the pause kicks in at prompt-select).
 *
 * Expiry: 24 hours. Stale pause state is cleared automatically on load.
 *
 * Schema:
 *   key   : cognify_workout_pause_v1
 *   value : { plan, currentRepIndex, scores, selectedPrompts, pausedAt }
 */

const KEY = "cognify_workout_pause_v1";
const EXPIRY_MS = 24 * 60 * 60 * 1000;

export type PauseState = {
  plan: WorkoutSessionPlan;
  currentRepIndex: number;
  scores: RepScore[];
  selectedPrompts: string[];
  pausedAt: number;
};

type SaveInput = Omit<PauseState, "pausedAt">;

export function savePauseState(state: SaveInput): void {
  if (typeof window === "undefined") return;
  try {
    const full: PauseState = { ...state, pausedAt: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(full));
  } catch {
    // localStorage unavailable (Safari private mode, quota exceeded) —
    // pause/resume becomes a no-op. The workout still runs.
  }
}

export function loadPauseState(): PauseState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PauseState;
    if (!parsed || typeof parsed.pausedAt !== "number") return null;
    if (Date.now() - parsed.pausedAt > EXPIRY_MS) {
      clearPauseState();
      return null;
    }
    // Basic shape validation — don't resume into a malformed plan
    if (!parsed.plan || !Array.isArray(parsed.plan.reps)) {
      clearPauseState();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPauseState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * Check if the speaking threshold was met for a rep attempt. Per team
 * spec: user should speak ≥ 75% of allotted time. We enforce via BOTH
 * word count (harder to game than pure duration — mic-open-but-silent
 * still fails the word check) AND duration ratio (catches mic-dead-silent).
 *
 * Thresholds (from Cognify Home + Daily team spec):
 *   - word count >= max(15, timeBudgetSec * 1.5)
 *   - duration >= 75% of time budget
 *
 * Both must pass. Failing either triggers the "Try to speak for most of
 * the time to get meaningful feedback" modal with Retry / Discard options.
 */
export function meetsSpeakingThreshold(params: {
  transcript: string;
  wordCount?: number;
  durationMs: number;
  timeBudgetMs: number;
}): { passed: boolean; wordCount: number; minWords: number; durationRatio: number } {
  const { transcript, durationMs, timeBudgetMs } = params;
  const wordCount =
    params.wordCount ??
    transcript.trim().split(/\s+/).filter(Boolean).length;
  const timeBudgetSec = timeBudgetMs / 1000;
  const minWords = Math.max(15, Math.round(timeBudgetSec * 1.5));
  const durationRatio = durationMs / timeBudgetMs;
  const passed = wordCount >= minWords && durationRatio >= 0.75;
  return { passed, wordCount, minWords, durationRatio };
}
