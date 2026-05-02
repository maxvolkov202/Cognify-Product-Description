/**
 * Cognify DNA Ch.9d — daily quest definitions + selection.
 *
 * Three quests refresh per UTC day per user. Each quest has:
 *   - id          : stable string (DB stores it; rename = data migration)
 *   - title       : short user-facing label
 *   - description : one-line objective
 *   - bonusXp     : XP grant on completion (small — ~25-50 each)
 *   - check       : pure function over rep state → boolean (whether THIS
 *                   rep satisfies the quest)
 *
 * Selection: 3 quests per day, picked via stable per-user-per-day seed
 * so the choice is reproducible (the cron + the dashboard render see
 * the same set).
 */

import type { SkillDimension } from "@/types/domain";
import { ALL_DIMENSIONS } from "@/lib/scoring/rubric";

export type QuestState = {
  /** Set of quest ids the user has completed today. */
  completedIds?: string[];
  /** XP cumulatively earned today across quest completions. */
  xpEarnedToday?: number;
};

export type QuestCheckInput = {
  composite: number;
  dimensions: { dimension: SkillDimension; score: number }[];
  /** Whether this rep used a focus drill in Skill Lab. */
  isFocusDrill: boolean;
  /** Whether this rep was a pressure rep. */
  isPressureRep: boolean;
  /** Total reps the user has completed TODAY (including this one). */
  repsToday: number;
};

export type Quest = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly bonusXp: number;
  readonly check: (input: QuestCheckInput) => boolean;
};

export const QUEST_BANK: readonly Quest[] = [
  // ——— Volume quests
  {
    id: "q_one_rep",
    title: "Show up",
    description: "Complete one rep today.",
    bonusXp: 15,
    check: (i) => i.repsToday >= 1,
  },
  {
    id: "q_three_reps",
    title: "Hat trick",
    description: "Complete three reps today.",
    bonusXp: 30,
    check: (i) => i.repsToday >= 3,
  },
  {
    id: "q_full_workout",
    title: "Full workout",
    description: "Complete four reps today.",
    bonusXp: 40,
    check: (i) => i.repsToday >= 4,
  },
  // ——— Skill stretch
  {
    id: "q_above_70",
    title: "Solid floor",
    description: "Land a rep with composite ≥ 70.",
    bonusXp: 30,
    check: (i) => i.composite >= 70,
  },
  {
    id: "q_above_80",
    title: "Strong rep",
    description: "Land a rep with composite ≥ 80.",
    bonusXp: 40,
    check: (i) => i.composite >= 80,
  },
  // ——— Mode exploration
  {
    id: "q_focus_drill",
    title: "Drill day",
    description: "Complete a Skill Lab focus drill.",
    bonusXp: 25,
    check: (i) => i.isFocusDrill,
  },
  {
    id: "q_pressure",
    title: "Hold the line",
    description: "Complete a pressure rep.",
    bonusXp: 35,
    check: (i) => i.isPressureRep,
  },
  // ——— Per-dimension drills (templated)
  ...ALL_DIMENSIONS.map<Quest>((dim) => ({
    id: `q_dim_${dim}`,
    title: `Drill ${dim.replace("_", " ")}`,
    description: `Score ≥ 70 on ${dim.replace("_", " ")}.`,
    bonusXp: 30,
    check: (i) => i.dimensions.some((d) => d.dimension === dim && d.score >= 70),
  })),
];

const BY_ID = new Map<string, Quest>(QUEST_BANK.map((q) => [q.id, q]));

export function getQuest(id: string): Quest | null {
  return BY_ID.get(id) ?? null;
}

/** Pick 3 quests for the user/day. Stable per (userId, date) — same
 *  selection on every read so the cron + dashboard agree. */
export function pickQuestsForDay(userId: string, dateYmd: string): Quest[] {
  const seed = `${userId}::${dateYmd}`;
  const indices = stablePickN(QUEST_BANK.length, 3, seed);
  return indices.map((i) => QUEST_BANK[i]!);
}

/** Evaluate quest progress for a rep. Returns ids of quests that flipped
 *  from incomplete → complete, plus the bonus XP delta. Caller awards
 *  the XP and writes the new completion state. */
export function evaluateQuestProgress(input: {
  todaysQuests: Quest[];
  alreadyCompletedIds: ReadonlySet<string>;
  rep: QuestCheckInput;
}): { newlyCompletedIds: string[]; bonusXp: number } {
  const newlyCompletedIds: string[] = [];
  let bonusXp = 0;
  for (const q of input.todaysQuests) {
    if (input.alreadyCompletedIds.has(q.id)) continue;
    if (q.check(input.rep)) {
      newlyCompletedIds.push(q.id);
      bonusXp += q.bonusXp;
    }
  }
  return { newlyCompletedIds, bonusXp };
}

function stablePickN(poolSize: number, n: number, seed: string): number[] {
  if (poolSize <= n) {
    return Array.from({ length: poolSize }, (_, i) => i);
  }
  const used = new Set<number>();
  const out: number[] = [];
  let salt = 0;
  while (out.length < n) {
    let h = 2166136261;
    const s = `${seed}::${salt++}`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    const idx = h % poolSize;
    if (!used.has(idx)) {
      used.add(idx);
      out.push(idx);
    }
  }
  return out;
}
