/**
 * Band thresholds shared by the calibration scripts. Keep in sync with
 * `BAND_DEFINITIONS` in src/types/domain.ts (the product source of
 * truth) — the .mjs harnesses can't import TS, so this is the one
 * script-side copy; both calibrate-scoring.mjs and
 * reauthor-expectations.mjs read from here so the harness and the bank
 * author can never disagree with each other.
 */
export function bandFor(score) {
  if (score < 40) return "poor";
  if (score < 60) return "below_standard";
  if (score < 75) return "competent";
  if (score < 85) return "strong";
  if (score < 95) return "excellent";
  return "exceptional";
}

export const BAND_ORDER = [
  "poor",
  "below_standard",
  "competent",
  "strong",
  "excellent",
  "exceptional",
];

export function bandsAdjacent(a, b) {
  return Math.abs(BAND_ORDER.indexOf(a) - BAND_ORDER.indexOf(b)) <= 1;
}
