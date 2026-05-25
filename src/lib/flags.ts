// Phase 15 — feature flags for the muscle-group pivot.
//
// Server-side only (env-var reads). The flag value resolves once per
// request via Next's `process.env`. Defaults below are conservative:
// new product on in dev/preview, off in production until Max signs
// off on the smoke matrix.
//
// To enable in production: set FF_MUSCLE_GROUP_WORKOUT=true on Vercel.
// To roll back: unset the env var (or set to false). The flag-off
// state renders the BetaSoon placeholder; no legacy fallback exists.
// A true rollback means restoring the pre-pivot WorkoutSession from
// git history (commit a68aaddd or earlier).

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
