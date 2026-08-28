"use client";

import type { WorkoutSessionPlan } from "@/lib/workout/lab-plan";
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
 * Grading plan WS3 (§4.2) — the ONE silent floor below which there is
 * nothing to grade: fewer than 5 recognised words AND under 3 s of speech.
 * Everything above it is scored; length is never a reason to block, warn,
 * or dock (the old word-count / duration-ratio gate and its modal are
 * gone). 5 words is a starting value; tune from `scoring_telemetry.short_rep`.
 */
export const SCORING_FLOOR_MIN_WORDS = 5;
export const SCORING_FLOOR_MIN_MS = 3_000;

export function isBelowScoringFloor(params: {
  transcript: string;
  wordCount?: number;
  durationMs: number;
}): { belowFloor: boolean; wordCount: number } {
  const wordCount =
    params.wordCount ??
    params.transcript.trim().split(/\s+/).filter(Boolean).length;
  return {
    belowFloor:
      wordCount < SCORING_FLOOR_MIN_WORDS &&
      params.durationMs < SCORING_FLOOR_MIN_MS,
    wordCount,
  };
}
