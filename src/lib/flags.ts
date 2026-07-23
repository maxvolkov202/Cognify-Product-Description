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

// ---------------------------------------------------------------------------
// PRD v3 rebuild flags (plans/prd-implementation-progress.md).
//
// Same contract as FF_MUSCLE_GROUP_WORKOUT: explicit env value wins, unset
// defaults ON everywhere except real production. Unlike the older flag,
// these consult VERCEL_ENV first — NODE_ENV is "production" on Vercel
// *preview* builds too, and previews must behave like dev for phase testing.

function defaultOnOutsideProduction(name: string): boolean {
  const env = process.env[name];
  if (env === "true" || env === "1") return true;
  if (env === "false" || env === "0") return false;
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv) return vercelEnv !== "production";
  return process.env.NODE_ENV !== "production";
}

/** Phase 1-2 — Universal Training Engine loop (Insight → Rep → Feedback → Retry → Improvement Review). */
export function isTrainingEngineV2Enabled(): boolean {
  return defaultOnOutsideProduction("FF_TRAINING_ENGINE_V2");
}

/** Phase 4 — Skill Lab application mode (Storytelling / Presenting / Teaching / Interviewing / Persuasion). */
export function isSkillLabAppsEnabled(): boolean {
  return defaultOnOutsideProduction("FF_SKILL_LAB_APPS");
}

/** Phase 5 — Build a Rep event preparation (context uploads, Critical Moments, Full Simulation). */
export function isBuildARepV2Enabled(): boolean {
  return defaultOnOutsideProduction("FF_BUILD_A_REP_V2");
}

/** Phase 6 — permanent Rank ladder (Bronze I-IV → Grandmaster) replacing Level 1-100. */
export function isRankSystemEnabled(): boolean {
  return defaultOnOutsideProduction("FF_RANK_SYSTEM");
}

/** Phase 8 — runtime prompt generation (hybrid bank + AI top-up per decision D3). */
export function isPromptGenEnabled(): boolean {
  return defaultOnOutsideProduction("FF_PROMPT_GEN");
}

/**
 * UI overhaul Phase 10 — expose the Daily Workout General|Personalized switch.
 *
 * NOTE the intentional inversion vs the other overhaul flags: OFF-in-prod is
 * the *shipped* state. When off we hide the PersonalizeSwitch and force
 * General (vertical-neutral) prompts for everyone. Visible in dev/preview so
 * vertical-specific prompts can still be tested. To restore the switch in
 * production later, set FF_WORKOUT_PERSONALIZE_SWITCH=true on Vercel — no code
 * change. The personalization pipeline (profile/vertical) stays intact either
 * way; this only gates the toggle + its default.
 */
export function isWorkoutPersonalizeSwitchEnabled(): boolean {
  return defaultOnOutsideProduction("FF_WORKOUT_PERSONALIZE_SWITCH");
}

/**
 * UI overhaul Phase 4 — Friends activity card on the dashboard.
 *
 * Same contract as the other overhaul flags: ON in dev/preview, OFF in prod
 * until Max promotes. Gates only the new dashboard social card (4.1); the
 * live-feed data fixes (4.2-4.5) ship unflagged as corrections.
 */
export function isDashboardSocialEnabled(): boolean {
  return defaultOnOutsideProduction("FF_DASHBOARD_SOCIAL");
}

/**
 * UI overhaul Phase 5 — Suggested-Framework shuffle + inline edit.
 *
 * Same contract as the other overhaul flags: ON in dev/preview, OFF in prod
 * until Max promotes. Gates ONLY the shuffle/edit affordances on the Daily
 * Workout framework strip (tasks 5.3-5.4). The "Abort rep" control (5.1) and
 * the "Suggested Framework" relabel (5.2) ship unflagged — abort is a safety
 * feature and the relabel is copy. The framework strip is display-only and
 * never reaches scoring, so this flag has no calibration impact.
 */
export function isRepFrameworkEditEnabled(): boolean {
  return defaultOnOutsideProduction("FF_REP_FRAMEWORK_EDIT");
}
