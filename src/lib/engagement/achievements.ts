/**
 * Cognify DNA Ch.9c — achievement definitions.
 *
 * Static bank — IDs are stable forever once shipped (DB rows reference
 * them by string). Editing copy is fine; renaming an `id` requires a
 * data migration.
 *
 * Buckets per DNA spec:
 *   - volume      : rep count milestones
 *   - skill       : score thresholds per dimension + composite
 *   - streak      : consecutive-day milestones
 *   - exploration : drilling all 6 dims, completing each rep type, etc.
 */

import type { SkillDimension } from "@/types/domain";
import { DIMENSION_LABELS } from "@/types/domain";

export type AchievementBucket = "volume" | "skill" | "streak" | "exploration";

export type Achievement = {
  readonly id: string;
  readonly bucket: AchievementBucket;
  readonly name: string;
  readonly description: string;
  /** Optional display-time metadata; UI may use to render a tier badge. */
  readonly tier?: "bronze" | "silver" | "gold" | "platinum";
};

export const ACHIEVEMENTS: readonly Achievement[] = [
  // ——— Volume ————————————————————————————————————————
  { id: "vol_first_rep", bucket: "volume", name: "First Rep", description: "Run your first rep.", tier: "bronze" },
  { id: "vol_10_reps", bucket: "volume", name: "Warm-up", description: "Complete 10 reps.", tier: "bronze" },
  { id: "vol_50_reps", bucket: "volume", name: "Showing Up", description: "Complete 50 reps.", tier: "silver" },
  { id: "vol_250_reps", bucket: "volume", name: "Practice Habit", description: "Complete 250 reps.", tier: "gold" },
  { id: "vol_1000_reps", bucket: "volume", name: "Four Figures", description: "Complete 1,000 reps.", tier: "platinum" },

  // ——— Skill — first 80+ in each dimension ———————————————
  { id: "skill_80_clarity", bucket: "skill", name: "Crystal — Clarity", description: "Score 80+ on Clarity.", tier: "silver" },
  { id: "skill_80_structure", bucket: "skill", name: "Architect — Structure", description: "Score 80+ on Structure.", tier: "silver" },
  { id: "skill_80_conciseness", bucket: "skill", name: "Tight — Conciseness", description: "Score 80+ on Conciseness.", tier: "silver" },
  { id: "skill_80_thinking_quality", bucket: "skill", name: "Sharp — Thinking", description: "Score 80+ on Thinking Quality.", tier: "silver" },
  { id: "skill_80_delivery", bucket: "skill", name: "Tempo — Delivery", description: "Score 80+ on Delivery.", tier: "silver" },
  { id: "skill_80_tone", bucket: "skill", name: "Voice — Tone", description: "Score 80+ on Tone.", tier: "silver" },
  // ——— Skill — first 90+ on composite ——
  { id: "skill_90_composite", bucket: "skill", name: "Excellent Rep", description: "Hit a composite of 90+.", tier: "gold" },
  { id: "skill_95_composite", bucket: "skill", name: "Exceptional", description: "Hit a composite of 95+.", tier: "platinum" },

  // ——— Streak ————————————————————————————————————————
  { id: "streak_3", bucket: "streak", name: "Two Days In", description: "Maintain a 3-day streak.", tier: "bronze" },
  { id: "streak_7", bucket: "streak", name: "Full Week", description: "Maintain a 7-day streak.", tier: "silver" },
  { id: "streak_30", bucket: "streak", name: "Habit Locked", description: "Maintain a 30-day streak.", tier: "gold" },
  { id: "streak_90", bucket: "streak", name: "Quarter", description: "Maintain a 90-day streak.", tier: "platinum" },
  { id: "streak_365", bucket: "streak", name: "A Year of Reps", description: "Maintain a 365-day streak.", tier: "platinum" },

  // ——— Exploration ————————————————————————————————————
  { id: "explore_all_dims", bucket: "exploration", name: "All Six", description: "Score every dimension at least once.", tier: "silver" },
  { id: "explore_pressure", bucket: "exploration", name: "Under Pressure", description: "Complete a pressure-mode rep.", tier: "bronze" },
  { id: "explore_focus_drill", bucket: "exploration", name: "Focused", description: "Complete a Skill Lab focus drill.", tier: "bronze" },
  { id: "explore_build_a_rep", bucket: "exploration", name: "Tailored", description: "Use Build-a-Rep for a real moment.", tier: "bronze" },
  { id: "explore_first_perfect", bucket: "exploration", name: "No Notes", description: "Hit 95+ on every dimension in a single rep.", tier: "platinum" },
];

/** Unique achievement ids — type-narrowing helper for runtime checks. */
export const ACHIEVEMENT_IDS = ACHIEVEMENTS.map((a) => a.id);
export type AchievementId = (typeof ACHIEVEMENTS)[number]["id"];

const BY_ID = new Map<string, Achievement>(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

export function getAchievement(id: string): Achievement | null {
  return BY_ID.get(id) ?? null;
}

/** Skill achievement id for first 80+ in a dimension. Centralized so the
 *  rules engine + the achievements page generate identical strings. */
export function skill80AchievementId(dim: SkillDimension): string {
  return `skill_80_${dim}`;
}

/** Human-readable name for a generated id. Used as a fallback when the
 *  static map doesn't contain the id (shouldn't happen in practice). */
export function deriveAchievementName(id: string): string {
  const m = BY_ID.get(id);
  if (m) return m.name;
  // Fallback: try to infer from generated ids.
  const skill80 = id.match(/^skill_80_(.+)$/);
  if (skill80) {
    const dim = skill80[1] as SkillDimension;
    return `${DIMENSION_LABELS[dim] ?? dim} 80+`;
  }
  return id;
}
