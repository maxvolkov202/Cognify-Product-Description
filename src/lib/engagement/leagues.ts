/**
 * Cognify DNA Ch.9b — leagues.
 *
 * 6-tier ladder: Bronze → Silver → Gold → Sapphire → Ruby → Diamond.
 * Each tier holds cohorts of ~30 users who compete on weekly XP earned.
 * At week reset (Sunday 00:00 UTC):
 *   - Top 30% promote to the next tier
 *   - Bottom 30% relegate (Bronze can't relegate; Diamond can't promote)
 *   - Middle 40% stay
 *   - All XP resets; new cohorts assigned
 *
 * Authoring rule for handles: anonymous adjective+noun handle pool, deterministic
 * per (user_id, week_start) so the same user has the same handle for a
 * given week's leaderboard view (different week = different handle, no
 * tracking across weeks).
 */

const COHORT_SIZE = 30;
const PROMOTE_FRACTION = 0.3;
const RELEGATE_FRACTION = 0.3;

export const TIERS = [
  "bronze",
  "silver",
  "gold",
  "sapphire",
  "ruby",
  "diamond",
] as const;

export type Tier = (typeof TIERS)[number];

export const TIER_LABELS: Record<Tier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  sapphire: "Sapphire",
  ruby: "Ruby",
  diamond: "Diamond",
};

/** Hex accent per tier — UI badges read from this. */
export const TIER_COLORS: Record<Tier, string> = {
  bronze: "#a07a52",
  silver: "#a0a4ad",
  gold: "#d4a843",
  sapphire: "#3b6db8",
  ruby: "#b8425c",
  diamond: "#7fb6d8",
};

export function nextTier(t: Tier): Tier | null {
  const i = TIERS.indexOf(t);
  if (i < 0 || i === TIERS.length - 1) return null;
  return TIERS[i + 1]!;
}

export function prevTier(t: Tier): Tier | null {
  const i = TIERS.indexOf(t);
  if (i <= 0) return null;
  return TIERS[i - 1]!;
}

/** Sunday UTC for the week containing `d`. Returns YYYY-MM-DD. */
export function weekStartUtc(d: Date = new Date()): string {
  const dt = new Date(d);
  dt.setUTCHours(0, 0, 0, 0);
  const dow = dt.getUTCDay(); // 0 = Sunday
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}

/** Days remaining in the current week (until the next Sunday 00:00 UTC). */
export function daysRemainingInWeek(d: Date = new Date()): number {
  const dow = d.getUTCDay();
  return 7 - dow;
}

// ——— Cohort assignment ————————————————————————————————

/** Compute promote/stay/relegate buckets for a cohort sorted by weekly_xp
 *  descending. Pure function — caller writes the membership table updates. */
export function computeWeekSettlement(
  cohort: { userId: string; tier: Tier; weeklyXp: number }[],
): Array<{ userId: string; result: "promote" | "stay" | "relegate" }> {
  if (cohort.length === 0) return [];
  const sorted = [...cohort].sort((a, b) => b.weeklyXp - a.weeklyXp);
  const promoteN = Math.max(1, Math.floor(sorted.length * PROMOTE_FRACTION));
  const relegateN = Math.max(1, Math.floor(sorted.length * RELEGATE_FRACTION));
  const out: ReturnType<typeof computeWeekSettlement> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i < promoteN) out.push({ userId: sorted[i]!.userId, result: "promote" });
    else if (i >= sorted.length - relegateN)
      out.push({ userId: sorted[i]!.userId, result: "relegate" });
    else out.push({ userId: sorted[i]!.userId, result: "stay" });
  }
  return out;
}

// ——— Anonymous handle generator ————————————————————————

const ADJECTIVES = [
  "Quick", "Sharp", "Bright", "Calm", "Clever", "Bold",
  "Steady", "Keen", "Vivid", "Crisp", "Swift", "Deep",
  "Solid", "Lucid", "Wry", "Earnest",
];

const ANIMALS = [
  "Hawk", "Otter", "Lynx", "Fox", "Heron", "Wolf",
  "Falcon", "Stag", "Marten", "Crane", "Mantis", "Tern",
  "Owl", "Badger", "Eagle", "Salmon",
];

/** Deterministic anonymous handle for (userId, weekStart). Same user gets
 *  a different handle each week so leaderboard activity isn't trackable
 *  across weeks. */
export function anonymousHandle(userId: string, weekStart: string): string {
  let h = 2166136261;
  const s = `${userId}::${weekStart}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  const adj = ADJECTIVES[h % ADJECTIVES.length]!;
  const noun = ANIMALS[Math.floor(h / ADJECTIVES.length) % ANIMALS.length]!;
  return `${adj} ${noun}`;
}

export const LEAGUE_COHORT_SIZE = COHORT_SIZE;
