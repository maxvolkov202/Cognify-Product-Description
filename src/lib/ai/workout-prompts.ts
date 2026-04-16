import type { Framework, SkillDimension } from "@/types/domain";
import type { ImprovementGoalId } from "@/lib/onboarding/constants";
import { findFrameworkById } from "./frameworks-library";
import {
  REP_TYPES,
  getRepType,
  pickRepTypes,
  type RepType,
  type RepTypeFramework,
  type RepTypeId,
} from "./rep-types";
import { pickWorkoutPrompts } from "./prompts/workout";
import { getFrameworkPool } from "./frameworks-rep-variants";

/**
 * ============================================================
 * Cognify Daily Workout — v2-beta.1 (team replan)
 * ============================================================
 *
 * The team spec defines a Daily Workout as 4–5 reps of different rep
 * types, each showing 5 prompts the user can pick from (with a Refresh
 * button for 5 more). Prompts are general, not vertical-specific.
 *
 * The new shape is exposed as `planTodaysWorkout()` + `WorkoutSessionPlan`.
 *
 * The legacy shape (`todaysWorkout()` + `WorkoutPromptWithFramework`) is
 * preserved behind a shim so existing callers (WorkoutSession.tsx,
 * /workout/page.tsx) keep working until Phase 4 migrates them to the new
 * UX. The shim under the hood picks rep types via `pickRepTypes`, pulls
 * the first prompt from each rep type's bank, and attaches a default
 * framework for each (since the legacy UX still renders frameworks).
 *
 * Phase 4 migrates all callers to `planTodaysWorkout`. Phase 6 deletes
 * the legacy exports.
 * ============================================================
 */

// ——— NEW API ——————————————————————————————————————————————

/**
 * A single rep slot in a Daily Workout session. Contains the rep type
 * metadata and 5 prompt options the user picks from.
 */
export type WorkoutRepSlot = {
  repType: RepType;
  prompts: string[];
  timeBudgetMs: number;
  /** The speech-structure scaffold for this rep. Primary for the first
   *  occurrence of a rep type in a session; rotates to alternates from
   *  `frameworks-rep-variants.ts` on repeat. */
  framework: RepTypeFramework;
  /** Populated by planNextRep when the slot was adjusted to target a
   *  weakness from the previous rep. Surfaced to the user as "Focusing on X"
   *  on the prompt-select screen. Null/absent when no adjustment happened. */
  focusReason?: FocusReason | null;
};

/** A human-readable explanation of why the next rep was adjusted, plus the
 *  raw data the UI can render however it likes. */
export type FocusReason = {
  dimension: SkillDimension;
  previousScore: number;
  previousRepTypeName: string;
  /** "Last rep scored 52 on structure — this one stresses structure." */
  summary: string;
  wasTypeSwapped: boolean;
};

/**
 * A full Daily Workout session — 4–5 rep slots and metadata.
 */
export type WorkoutSessionPlan = {
  id: string;
  reps: WorkoutRepSlot[];
  estimatedDurationSec: number;
};

/**
 * Generate today's Daily Workout plan.
 *
 * Picks rep types weighted by the user's improvement goals, then
 * presents 5 prompts per rep type for the user to choose from. Prompts
 * are general (not vertical-specific) per the team spec.
 */
export function planTodaysWorkout(
  opts: {
    goals?: readonly ImprovementGoalId[];
    count?: number;
    /** Framework names the user has seen in recent sessions (last ~5 reps),
     *  so we rotate away from them. Oldest allowed; these are just
     *  deprioritized, not excluded. */
    recentFrameworkNames?: readonly string[];
  } = {},
): WorkoutSessionPlan {
  const count = opts.count ?? 4;
  const goals = opts.goals ?? [];
  const repTypeIds = pickRepTypes({ goals, count });

  const usedThisSession = new Set<string>(opts.recentFrameworkNames ?? []);

  const reps: WorkoutRepSlot[] = repTypeIds.map((id) => {
    const repType = getRepType(id);
    const framework = pickRotatingFramework(id, repType.framework, usedThisSession);
    usedThisSession.add(framework.name);
    return {
      repType,
      prompts: pickWorkoutPrompts(id, 5),
      timeBudgetMs: repType.timeBudgetSec * 1000,
      framework,
    };
  });

  const estimatedDurationSec = reps.reduce(
    // rep duration + ~20s feedback/transition window per rep
    (sum, r) => sum + r.repType.timeBudgetSec + 20,
    0,
  );

  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `workout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    reps,
    estimatedDurationSec,
  };
}

/**
 * Refresh the 5 prompts for a single rep slot. Used by the Refresh
 * button on the prompt-selection screen — pulls a fresh shuffle from
 * the same rep type's bank.
 */
export function refreshRepPrompts(repTypeId: RepTypeId): string[] {
  return pickWorkoutPrompts(repTypeId, 5);
}

/**
 * Pick a framework for a rep type, rotating away from names in `exclude`
 * if possible. The rep type's primary framework is included in the pool
 * via `getFrameworkPool`. Deterministic fallback: first item from the
 * pool that isn't in `exclude`; if all are excluded, returns the primary.
 */
export function pickRotatingFramework(
  repTypeId: RepTypeId,
  primary: RepTypeFramework,
  exclude: ReadonlySet<string>,
): RepTypeFramework {
  const pool = getFrameworkPool(primary, repTypeId);
  // Prefer an unseen framework; shuffle for variety within that set.
  const unseen = pool.filter((f) => !exclude.has(f.name));
  const candidates = unseen.length > 0 ? unseen : pool;
  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx]!;
}

// ——— Rep-to-rep adjustment (A1) ——————————————————————————
//
// "Each rep builds off the last one post feedback." When rep N completes,
// we detect the weakest dimension and adjust rep N+1 to stress that
// dimension — either by swapping the rep type outright or by keeping the
// current rep type if it already targets the weakness.
//
// The next rep's prompts are re-drawn fresh so the user sees the adjustment
// on the prompt-select screen, alongside a short "Focusing on X" callout.

/**
 * Which rep types best train each skill dimension. First entry is the
 * rep type whose PRIMARY focus is that dimension; later entries have it
 * as a secondary. Derived from REP_TYPES' primary/secondaryDimensions.
 */
const DIMENSION_TO_REP_TYPES: Record<SkillDimension, readonly RepTypeId[]> = {
  clarity: ["simplify", "reinforce", "structure", "think_fast", "be_concise", "adapt"],
  structure: ["structure", "simplify", "reinforce", "persuade"],
  relevance: ["persuade", "simplify", "structure", "be_concise", "adapt", "handle_pressure"],
  confidence: ["think_fast", "handle_pressure", "deliver"],
  pacing: ["be_concise", "deliver", "think_fast", "reinforce"],
  tone: ["adapt", "persuade", "deliver", "handle_pressure"],
};

/** Minimum score above which we DON'T bother adjusting — the user is
 *  holding that dimension well enough. Tuned to match the rubric's
 *  "solid" band. */
const WEAKNESS_ADJUST_THRESHOLD = 70;

export type PreviousRepDimScore = {
  dimension: SkillDimension;
  score: number;
};

export type PreviousRepContext = {
  repTypeId: RepTypeId;
  repTypeName: string;
  dimensions: readonly PreviousRepDimScore[];
};

/**
 * Adjust the next rep slot in a workout plan based on the previous rep's
 * weakest dimension. Returns a new WorkoutSessionPlan with the next slot
 * potentially swapped to a better-matched rep type and annotated with a
 * focusReason the UI can display.
 *
 * Rules:
 *   1. If no previous rep, return plan unchanged.
 *   2. Find the lowest-scoring dimension in the previous rep.
 *   3. If that score >= threshold, don't adjust.
 *   4. Otherwise, look up rep types that train that dimension. Prefer
 *      ones not already used in this session. If the currently-planned
 *      next slot's rep type is already a good match, keep it but mark
 *      the reason. Otherwise swap to the best available alternative and
 *      pull fresh prompts from that type's bank.
 *
 * Deterministic ordering (primary before secondary) so the same input
 * always produces the same decision — easier to test and explain.
 */
export function planNextRep(opts: {
  plan: WorkoutSessionPlan;
  nextIndex: number;
  previousRep: PreviousRepContext;
  /** Rep type ids the user has already completed this session; the
   *  function won't swap to one of these so the workout stays varied. */
  usedRepTypeIds: readonly RepTypeId[];
}): WorkoutSessionPlan {
  const { plan, nextIndex, previousRep, usedRepTypeIds } = opts;
  const nextSlot = plan.reps[nextIndex];
  if (!nextSlot) return plan;

  const weakest = findWeakestDimension(previousRep.dimensions);
  if (!weakest || weakest.score >= WEAKNESS_ADJUST_THRESHOLD) {
    return plan;
  }

  const candidates = DIMENSION_TO_REP_TYPES[weakest.dimension];
  const currentTypeId = nextSlot.repType.id;

  // If the current next slot already targets the weakness, keep it —
  // just annotate and refresh prompts.
  const currentIsGoodMatch = candidates.includes(currentTypeId);

  // Look for an alternative that isn't already in use and isn't the
  // current slot (so a swap actually changes something).
  const alternative = candidates.find(
    (id) =>
      id !== currentTypeId &&
      !usedRepTypeIds.includes(id) &&
      // Also not already queued in a later slot (variety)
      !plan.reps.slice(nextIndex + 1).some((r) => r.repType.id === id),
  );

  let chosenTypeId: RepTypeId;
  let wasSwapped: boolean;
  if (currentIsGoodMatch) {
    chosenTypeId = currentTypeId;
    wasSwapped = false;
  } else if (alternative) {
    chosenTypeId = alternative;
    wasSwapped = true;
  } else {
    // Best we can do is keep the current slot and let the UI show the reason.
    chosenTypeId = currentTypeId;
    wasSwapped = false;
  }

  const chosenType = getRepType(chosenTypeId);
  const nextPrompts = pickWorkoutPrompts(chosenTypeId, 5);
  // Rotate framework too. We don't have access to the full session's
  // framework history here without threading it through — the caller
  // (WorkoutSession) can replace this with a history-aware pick if needed.
  // For now we rotate against only the current slot's existing framework name.
  const previousFramework = nextSlot.framework?.name
    ? new Set([nextSlot.framework.name])
    : new Set<string>();
  const chosenFramework = pickRotatingFramework(
    chosenTypeId,
    chosenType.framework,
    previousFramework,
  );

  const summary = buildFocusSummary({
    weakDimension: weakest.dimension,
    previousScore: weakest.score,
    previousRepTypeName: previousRep.repTypeName,
    nextRepTypeName: chosenType.name,
    wasSwapped,
  });

  const updatedSlot: WorkoutRepSlot = {
    repType: chosenType,
    prompts: nextPrompts,
    timeBudgetMs: chosenType.timeBudgetSec * 1000,
    framework: chosenFramework,
    focusReason: {
      dimension: weakest.dimension,
      previousScore: weakest.score,
      previousRepTypeName: previousRep.repTypeName,
      summary,
      wasTypeSwapped: wasSwapped,
    },
  };

  const newReps = plan.reps.slice();
  newReps[nextIndex] = updatedSlot;
  return { ...plan, reps: newReps };
}

function findWeakestDimension(
  dimensions: readonly PreviousRepDimScore[],
): PreviousRepDimScore | null {
  if (dimensions.length === 0) return null;
  let worst = dimensions[0]!;
  for (const d of dimensions) {
    if (d.score < worst.score) worst = d;
  }
  return worst;
}

function buildFocusSummary(opts: {
  weakDimension: SkillDimension;
  previousScore: number;
  previousRepTypeName: string;
  nextRepTypeName: string;
  wasSwapped: boolean;
}): string {
  const { weakDimension, previousScore, nextRepTypeName, wasSwapped } = opts;
  const roundedScore = Math.round(previousScore);
  if (wasSwapped) {
    return `Last rep scored ${roundedScore} on ${weakDimension}. This rep (${nextRepTypeName}) stresses ${weakDimension} directly.`;
  }
  return `Last rep scored ${roundedScore} on ${weakDimension}. Staying on ${nextRepTypeName} — same dimension, fresh prompts.`;
}

// ——— LEGACY SHIM ——————————————————————————————————————————
// Existing callers (WorkoutSession.tsx, /workout/page.tsx) still use the
// old framework-centric shape. The shim below preserves that shape so
// typecheck stays clean until Phase 4 migrates them to the new UX.

export type WorkoutPrompt = {
  id: string;
  text: string;
  frameworkId: string;
  skillFocus: SkillDimension[];
  timeLimitMs: number;
};

export type WorkoutPromptWithFramework = WorkoutPrompt & {
  framework: Framework;
};

// Default framework per rep type for the legacy shim. These are the
// frameworks the legacy UX associated with each prompt style. Phase 4
// drops framework exposure entirely in Daily Workout.
const LEGACY_DEFAULT_FRAMEWORK: Record<RepTypeId, string> = {
  simplify: "prep",
  structure: "minto",
  think_fast: "prep",
  be_concise: "bluf",
  reinforce: "prep",
  persuade: "pspa",
  adapt: "wsw",
  deliver: "scqa",
  handle_pressure: "cei",
};

// Default dimension focus per rep type for the legacy shim. These match
// each rep type's primary + secondary dimensions from rep-types.ts.
const LEGACY_DEFAULT_FOCUS: Record<RepTypeId, SkillDimension[]> = {
  simplify: ["clarity", "structure", "relevance"],
  structure: ["structure", "clarity", "relevance"],
  think_fast: ["confidence", "clarity", "pacing"],
  be_concise: ["pacing", "clarity", "relevance"],
  reinforce: ["clarity", "structure", "pacing"],
  persuade: ["relevance", "structure", "tone"],
  adapt: ["tone", "clarity", "relevance"],
  deliver: ["pacing", "confidence", "tone"],
  handle_pressure: ["confidence", "relevance", "tone"],
};

/**
 * Legacy entry point. Returns a framework-attached prompt list in the
 * old shape. Under the hood, picks rep types + one prompt each and
 * attaches a default framework so the old WorkoutSession UX still works.
 *
 * @deprecated Use `planTodaysWorkout` instead. This will be removed in Phase 6.
 */
export function todaysWorkout(count = 4): WorkoutPromptWithFramework[] {
  const repTypeIds = pickRepTypes({ goals: [], count });

  const out: WorkoutPromptWithFramework[] = [];
  for (const id of repTypeIds) {
    const repType = getRepType(id);
    const prompts = pickWorkoutPrompts(id, 1);
    const promptText = prompts[0];
    if (!promptText) continue;
    const frameworkId = LEGACY_DEFAULT_FRAMEWORK[id];
    const framework = findFrameworkById(frameworkId);
    if (!framework) continue;
    out.push({
      id: `${id}-${Date.now()}`,
      text: promptText,
      frameworkId,
      skillFocus: [...LEGACY_DEFAULT_FOCUS[id]],
      timeLimitMs: repType.timeBudgetSec * 1000,
      framework,
    });
  }
  return out;
}

/**
 * Legacy helper — used nowhere in current code but preserved for
 * completeness. Maps a set of framework ids to legacy prompts.
 *
 * @deprecated Will be removed in Phase 6.
 */
export function workoutByFrameworkIds(
  frameworkIds: string[],
): WorkoutPromptWithFramework[] {
  const out: WorkoutPromptWithFramework[] = [];
  for (const id of frameworkIds) {
    // Find any rep type that defaults to this framework
    const repTypeId = (Object.entries(LEGACY_DEFAULT_FRAMEWORK) as [
      RepTypeId,
      string,
    ][]).find(([, f]) => f === id)?.[0];
    if (!repTypeId) continue;
    const repType = getRepType(repTypeId);
    const prompts = pickWorkoutPrompts(repTypeId, 1);
    const promptText = prompts[0];
    if (!promptText) continue;
    const framework = findFrameworkById(id);
    if (!framework) continue;
    out.push({
      id: `${repTypeId}-${Date.now()}`,
      text: promptText,
      frameworkId: id,
      skillFocus: [...LEGACY_DEFAULT_FOCUS[repTypeId]],
      timeLimitMs: repType.timeBudgetSec * 1000,
      framework,
    });
  }
  return out;
}

/**
 * @deprecated Use `WORKOUT_PROMPTS` from src/lib/ai/prompts/workout.ts
 * or rep-types metadata from src/lib/ai/rep-types.ts instead.
 */
export const ALL_REP_TYPES = REP_TYPES;
