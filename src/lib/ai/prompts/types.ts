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

/**
 * Cognify DNA Ch.6b — focus-drill prompts for Thinking Quality / Delivery /
 * Tone. These are NOT topic prompts (those live in workout-prompts) — they
 * pair a topic with a SPECIFIC mechanic constraint that forces the
 * dimension's training intent.
 *
 *   topic            : the rep's subject ("argue both sides of remote work")
 *   drillInstruction : the mechanic constraint surfaced before the rep
 *                      ("speak this for 60 seconds without using 'um' or 'like'")
 *   targetSubSkill   : which sub-skill the AI should weight most heavily
 *                      when scoring; also drives RepHintsBar's hint pool
 *
 * Stratified at picker time across `targetSubSkill` so a slate of 5 hits
 * a balanced spread of sub-skills within the dimension.
 */
import type { SubSkillId } from "@/types/sub-skills";

export type DrillPrompt = {
  readonly id: string;
  readonly topic: string;
  readonly drillInstruction: string;
  readonly targetSubSkill: SubSkillId;
};
