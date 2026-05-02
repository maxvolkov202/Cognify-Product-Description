/**
 * Level curve + band labels — Cognify DNA Ch.7.
 *
 * Hyperbolic curve so early levels reward momentum (gym-day-one
 * dopamine) and late levels are nearly unreachable (level 100 is
 * designed as the chase). The exponent + multiplier were tuned so:
 *   level 5   ≈ 240 XP
 *   level 15  ≈ 1900 XP
 *   level 30  ≈ 7200 XP
 *   level 50  ≈ 21000 XP
 *   level 75  ≈ 53000 XP
 *   level 100 ≈ 100000+ XP
 *
 * Tune in one place — every level-related calculation reads from
 * `xpForLevel` so the curve is consistent across UI + backfill +
 * achievements.
 */

const LEVEL_EXPONENT = 1.6;
const LEVEL_MULTIPLIER = 50;
export const MAX_LEVEL = 100;

/** Cumulative XP required to reach a given level. Level 1 = 0 XP. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level > MAX_LEVEL) level = MAX_LEVEL;
  return Math.floor(LEVEL_MULTIPLIER * Math.pow(level, LEVEL_EXPONENT));
}

/** Inverse: which level does this XP total qualify for? */
export function levelFromXp(xp: number): number {
  if (xp <= 0) return 1;
  // Bounded; closed-form would work but the loop reads cleanly and
  // hits at most MAX_LEVEL iterations.
  let lvl = 1;
  while (lvl < MAX_LEVEL && xpForLevel(lvl + 1) <= xp) lvl += 1;
  return lvl;
}

/** Progress (0-1) toward the next level. Returns 1.0 at level cap. */
export function levelProgress(xp: number, currentLevel?: number): number {
  const level = currentLevel ?? levelFromXp(xp);
  if (level >= MAX_LEVEL) return 1;
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  if (ceil <= floor) return 1;
  return Math.max(0, Math.min(1, (xp - floor) / (ceil - floor)));
}

/** XP from now to next level. Negative if already past (shouldn't happen). */
export function xpToNextLevel(xp: number, currentLevel?: number): number {
  const level = currentLevel ?? levelFromXp(xp);
  if (level >= MAX_LEVEL) return 0;
  return Math.max(0, xpForLevel(level + 1) - xp);
}

export type LevelBand = {
  id: string;
  label: string;
  min: number;
  max: number;
};

/** DNA spec level bands. UI shows the band label alongside the number. */
export const LEVEL_BANDS: readonly LevelBand[] = [
  { id: "foundations", label: "Foundations", min: 1, max: 15 },
  { id: "developing", label: "Developing", min: 16, max: 30 },
  { id: "competent", label: "Competent", min: 31, max: 45 },
  { id: "proficient", label: "Proficient", min: 46, max: 60 },
  { id: "strong", label: "Strong", min: 61, max: 74 },
  { id: "advanced", label: "Advanced", min: 75, max: 85 },
  { id: "elite", label: "Elite", min: 86, max: 95 },
  { id: "world_class", label: "World Class", min: 96, max: 100 },
];

export function bandForLevel(level: number): LevelBand {
  return (
    LEVEL_BANDS.find((b) => level >= b.min && level <= b.max) ??
    LEVEL_BANDS[LEVEL_BANDS.length - 1]!
  );
}
