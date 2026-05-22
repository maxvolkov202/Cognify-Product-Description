// Phase 15 — feature flags for the muscle-group pivot.
//
// Server-side only (env-var reads). The flag value resolves once per
// request via Next's `process.env`. Defaults below are conservative:
// new product on in dev/preview, off in production until Max signs
// off on the smoke matrix.
//
// To enable in production: set FF_MUSCLE_GROUP_WORKOUT=true on Vercel.
// To roll back: unset the env var (or set to false). The flag-off
// state renders the BetaSoon placeholder, NOT a legacy fallback —
// the pre-pivot WorkoutSession lives at src/components/_archive/ and
// has stale imports; reanimating it is bigger than the rollback
// scenario warrants. If a true legacy serve becomes mandatory, the
// archived file is the starting point for a restore PR.

/**
 * Muscle-group adventure-path Workout shell.
 * - production: false unless FF_MUSCLE_GROUP_WORKOUT=true
 * - dev / preview / test: true unless FF_MUSCLE_GROUP_WORKOUT=false
 */
export function isMuscleGroupWorkoutEnabled(): boolean {
  const env = process.env.FF_MUSCLE_GROUP_WORKOUT;
  if (env === "true" || env === "1") return true;
  if (env === "false" || env === "0") return false;
  // Unset → default-by-environment.
  return process.env.NODE_ENV !== "production";
}
