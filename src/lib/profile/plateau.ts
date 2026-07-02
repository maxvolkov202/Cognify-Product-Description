// PRD v3 Phase 3 — plateau detection (PRD §8.4.4).
//
// "If Cognify detects that progress within a Core Skill has slowed or
// stopped, it should adjust the training strategy rather than simply
// assigning additional repetitions." A plateau is NOT a weakness — it's
// enough evidence, no movement, and headroom left. The rotation engine
// answers a plateau with VARIETY (a different dim / different stimulus),
// not more of the same.
//
// Pure function — tested in tests/communication-profile.test.ts.

export type PlateauPoint = {
  /** ISO timestamp of the observation. */
  at: string;
  /** 0-100 score. */
  score: number;
};

/** Minimum observations inside the window before "no movement" means
 *  anything. Below this it's just sparse data. */
export const PLATEAU_MIN_SAMPLES = 8;
/** Observation window in days. */
export const PLATEAU_WINDOW_DAYS = 21;
/** |linear-regression slope| below this (points/day) = flat. */
export const PLATEAU_SLOPE_EPSILON = 0.15;
/** At or above this mean score a flat line is mastery-maintenance,
 *  not a plateau worth intervening on. */
export const PLATEAU_CEILING = 85;

export function detectPlateau(
  points: PlateauPoint[],
  now: Date = new Date(),
): boolean {
  const cutoff = now.getTime() - PLATEAU_WINDOW_DAYS * 86_400_000;
  const windowed = points
    .map((p) => ({ t: new Date(p.at).getTime(), score: p.score }))
    .filter((p) => Number.isFinite(p.t) && p.t >= cutoff)
    .sort((a, b) => a.t - b.t);
  if (windowed.length < PLATEAU_MIN_SAMPLES) return false;

  const mean = windowed.reduce((s, p) => s + p.score, 0) / windowed.length;
  if (mean >= PLATEAU_CEILING) return false;

  // Least-squares slope in points/day.
  const day = 86_400_000;
  const xs = windowed.map((p) => (p.t - windowed[0]!.t) / day);
  const meanX = xs.reduce((s, x) => s + x, 0) / xs.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < windowed.length; i++) {
    num += (xs[i]! - meanX) * (windowed[i]!.score - mean);
    den += (xs[i]! - meanX) ** 2;
  }
  if (den === 0) return true; // all same-day samples, no trend = flat
  const slope = num / den;
  return Math.abs(slope) < PLATEAU_SLOPE_EPSILON;
}
