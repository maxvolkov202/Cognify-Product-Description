/**
 * PRD v3 Phase 6 — Weekly Challenges (PRD §10.10).
 *
 * Short-term goals that reset weekly (Sunday UTC, same week math as
 * leagues). Unlike daily quests (per-rep boolean checks), challenge
 * targets span many reps, so each challenge counts EVENTS: a rep save
 * produces increment signals ("one rep", "one implemented retry", …)
 * and progress is a running counter per challenge id.
 *
 * "Challenges should focus on meaningful communication behaviors rather
 * than arbitrary activity" — the bank leans on implementation, quality,
 * and cadence, not raw volume alone.
 *
 * Pure module — persistence in src/lib/db/queries/weekly-challenges.ts.
 */

export type WeeklyChallengeEvent = {
  mode: string;
  composite: number;
  /** Retry implemented the coaching (verdict nailed). */
  implementedRetry: boolean;
  /** First rep of a new user-local training day this week. */
  newTrainingDay: boolean;
};

export type WeeklyChallenge = {
  id: string;
  title: string;
  description: string;
  target: number;
  bonusXp: number;
  /** How many units this rep event contributes (0 or 1 today). */
  increment: (e: WeeklyChallengeEvent) => number;
};

export const WEEKLY_CHALLENGE_BANK: readonly WeeklyChallenge[] = [
  {
    id: "wc_reps_20",
    title: "Twenty in the bank",
    description: "Complete 20 communication reps this week.",
    target: 20,
    bonusXp: 120,
    increment: () => 1,
  },
  {
    id: "wc_workout_reps_12",
    title: "Daily driver",
    description: "Complete 12 Daily Workout reps this week.",
    target: 12,
    bonusXp: 100,
    increment: (e) => (e.mode === "daily_workout" ? 1 : 0),
  },
  {
    id: "wc_lab_reps_6",
    title: "Lab hours",
    description: "Complete 6 Skill Lab reps this week.",
    target: 6,
    bonusXp: 100,
    increment: (e) => (e.mode === "skill_lab" ? 1 : 0),
  },
  {
    id: "wc_implemented_5",
    title: "Coachable",
    description: "Implement your coach's focus on 5 retries this week.",
    target: 5,
    bonusXp: 150,
    increment: (e) => (e.implementedRetry ? 1 : 0),
  },
  {
    id: "wc_strong_reps_8",
    title: "Quality streak",
    description: "Land 8 reps scoring 75+ this week.",
    target: 8,
    bonusXp: 120,
    increment: (e) => (e.composite >= 75 ? 1 : 0),
  },
  {
    id: "wc_excellent_3",
    title: "Peak form",
    description: "Land 3 reps scoring 85+ this week.",
    target: 3,
    bonusXp: 140,
    increment: (e) => (e.composite >= 85 ? 1 : 0),
  },
  {
    id: "wc_days_4",
    title: "Show up",
    description: "Train on 4 different days this week.",
    target: 4,
    bonusXp: 130,
    increment: (e) => (e.newTrainingDay ? 1 : 0),
  },
];

const BY_ID = new Map(WEEKLY_CHALLENGE_BANK.map((c) => [c.id, c]));

export function getWeeklyChallenge(id: string): WeeklyChallenge | null {
  return BY_ID.get(id) ?? null;
}

/** Sunday-UTC week key, matching leagues' weekStartUtc — YYYY-MM-DD. */
export function weekStartYmd(now: Date = new Date()): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

/** Pick 3 challenges for the user/week. Stable per (userId, weekStart). */
export function pickChallengesForWeek(
  userId: string,
  weekStart: string,
): WeeklyChallenge[] {
  const seed = `${userId}::wk::${weekStart}`;
  const indices = stablePickN(WEEKLY_CHALLENGE_BANK.length, 3, seed);
  return indices.map((i) => WEEKLY_CHALLENGE_BANK[i]!);
}

/** Apply one rep event to the week's counters. Returns the new progress
 *  map plus which challenges flipped to complete (and their XP). */
export function applyChallengeEvent(input: {
  challenges: { id: string; target: number; bonusXp: number }[];
  progress: Record<string, number>;
  alreadyCompletedIds: ReadonlySet<string>;
  event: WeeklyChallengeEvent;
}): {
  progress: Record<string, number>;
  newlyCompletedIds: string[];
  bonusXp: number;
} {
  const progress = { ...input.progress };
  const newlyCompletedIds: string[] = [];
  let bonusXp = 0;
  for (const c of input.challenges) {
    const def = BY_ID.get(c.id);
    if (!def) continue;
    const inc = def.increment(input.event);
    if (inc <= 0) continue;
    const next = Math.min(c.target, (progress[c.id] ?? 0) + inc);
    progress[c.id] = next;
    if (next >= c.target && !input.alreadyCompletedIds.has(c.id)) {
      newlyCompletedIds.push(c.id);
      bonusXp += c.bonusXp;
    }
  }
  return { progress, newlyCompletedIds, bonusXp };
}

// FNV-1a stable pick, mirroring quests.ts.
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

// ── Team challenges (PRD §10.11) ────────────────────────────────────────

export type TeamChallengeDef = {
  id: string;
  title: string;
  /** Target per team member — scaled by team size at creation. */
  targetPerMember: number;
};

/** V1: one shared rep goal per week. More kinds (team streak, avg score)
 *  layer on the same table later. */
export const TEAM_CHALLENGE: TeamChallengeDef = {
  id: "tc_team_reps",
  title: "Team reps this week",
  targetPerMember: 15,
};

export function teamChallengeTarget(memberCount: number): number {
  return Math.max(15, TEAM_CHALLENGE.targetPerMember * Math.max(1, memberCount));
}
