import type { VerticalId } from "@/lib/onboarding/constants";

/**
 * Typed prompt shapes for the workout / pressure / vertical banks.
 *
 * Stable `id` exists so per-user prompt history (Phase B) can match by id
 * instead of by `text`, which is fragile under typo fixes.
 *
 * `theme` (workout) and `setting` (pressure) drive stratified sampling at
 * picker time so a slate of 5 always feels balanced — without tags, big
 * banks tend to surface whatever topic was most-authored on a given day.
 */

export type WorkoutTheme = "work" | "life" | "abstract";

export type PressureSetting = "work" | "public" | "personal";

export type WorkoutPrompt = {
  readonly id: string;
  readonly text: string;
  readonly theme: WorkoutTheme;
};

export type PressurePrompt = {
  readonly id: string;
  readonly text: string;
  readonly setting: PressureSetting;
};

export type VerticalPrompt = {
  readonly id: string;
  readonly text: string;
  readonly vertical: VerticalId;
  /** Optional — populated when authoring lets us. Picker can stratify on
   *  this when present so the same stakeholder doesn't fill a slate. */
  readonly stakeholder?: string;
};
