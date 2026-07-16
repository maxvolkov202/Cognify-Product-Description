// System Change v2 Phase 2B.3 (D23) — catalog-backed lab session planning.
//
// Replaces the retired System A planners (src/lib/ai/workout-prompts.ts):
// prompts now come exclusively from the DB catalog (cognify_v2.exercises /
// exercise_prompts); this module holds the PURE plan types + slot builders
// so they stay unit-testable and client-importable (types only — the DB
// side lives in src/server/actions/lab-session.ts).
//
// What survives from the legacy system on purpose:
//   - rep types (src/lib/ai/rep-types.ts) — the speech-structure scaffolds
//     (RepTypeFramework sections) and time budgets the session UI renders.
//     Catalog exercises overlay their own identity (name/rule/dimensions)
//     on a dimension-matched base rep type via buildCatalogRepType.
//   - pressure archetypes (src/lib/ai/pressure-archetypes.ts) — scoring
//     weight profiles + session framing. Their prompt bank moved into the
//     catalog (exercises with application='pressure').

import {
  getRepType,
  type RepType,
  type RepTypeId,
  type RepTypeFramework,
} from "@/lib/ai/rep-types";
import { getFrameworkPool } from "@/lib/ai/frameworks-rep-variants";
import type { PressureArchetype } from "@/lib/ai/pressure-archetypes";
import {
  DIMENSION_LABELS,
  type RepFocusContext,
  type SkillDimension,
} from "@/types/domain";
import { muscleGroupToSkillDim } from "@/lib/scoring/dimension-aliases";

/**
 * The three session types a user can run (WS-6):
 *   - `focus`    — all reps share one primary dimension ("Clarity Day")
 *   - `combined` — mix across dimensions (mixed sessions)
 *   - `flow`     — pressure ramp through archetypes, compressed feedback
 */
export type SessionType = "focus" | "combined" | "flow";

export type WorkoutRepSlot = {
  repType: RepType;
  prompts: string[];
  /** Stable prompt ids parallel to `prompts` (lockstep — `promptIds[i]`
   *  identifies `prompts[i]`). Catalog `exercise_prompts.prompt_id`
   *  strings; used by the UI for /api/prompt-history + prompt-events. */
  promptIds: string[];
  timeBudgetMs: number;
  /** The speech-structure scaffold for this rep. Rotates through the rep
   *  type's framework pool on repeat occurrences within a session. */
  framework: RepTypeFramework;
  /** Why this rep has the focus it has. Null when the rep has no
   *  specific focus signal. */
  focus: RepFocusContext | null;
  /** Set when the slot is a pressure rep — drives UI differentiation,
   *  time budget delta, and the scoring weight profile. */
  pressureArchetype?: PressureArchetype;
  /** Catalog exercise (exercises.id uuid) whose bank feeds this slot.
   *  The prompt-select Refresh re-slates from this exercise so refreshes
   *  keep the training objective and vary only the topic (PRD §9.3).
   *  Null only when the catalog was unreachable and the slot is running
   *  on its fallback prompts (refresh disabled). */
  exerciseId: string | null;
};

/** A full lab session — rep slots and metadata. */
export type WorkoutSessionPlan = {
  id: string;
  reps: WorkoutRepSlot[];
  estimatedDurationSec: number;
  /** Which planner built this plan. Drives UI routing (e.g. flow
   *  sessions use compressed feedback between reps) and analytics. */
  sessionType: SessionType;
  /** Only populated for `sessionType: 'focus'`. */
  focusDimension?: SkillDimension;
};

/** Base rep type per dimension — supplies the framework scaffold pool and
 *  default time budget that catalog exercises don't carry themselves. */
export const DIMENSION_BASE_REP_TYPE: Record<SkillDimension, RepTypeId> = {
  clarity: "simplify",
  structure: "structure",
  conciseness: "be_concise",
  thinking_quality: "think_fast",
  delivery: "deliver",
  tone: "adapt",
};

/** The slice of a catalog exercise row the planner needs. */
export type LabCatalogExercise = {
  id: string;
  slug: string;
  name: string;
  /** exercises.description — the user-facing rule. */
  rule: string;
  dimension: SkillDimension;
  /** Raw from the DB — may contain the legacy 'pacing' spelling, which
   *  buildCatalogRepType aliases to 'delivery'. */
  secondaryCoreSkills: string[] | null;
  responseWindow: { minSec: number; maxSec: number } | null;
  hiddenSkills: string[] | null;
};

/**
 * Overlay a catalog exercise's identity onto its dimension's base rep
 * type. The result renders exactly like a legacy rep type (name, header
 * copy, scaffold, budget) while the exercise defines the objective —
 * PRD §9.2: the Exercise Framework is the unit, the prompt is the topic.
 */
export function buildCatalogRepType(
  ex: LabCatalogExercise,
  opts?: { pressure?: boolean },
): RepType {
  // Pressure slots keep the dedicated handle_pressure scaffold
  // (Acknowledge → Redirect → Land) — the dimension-default scaffold
  // would contradict what the pressure exercise's rule/lens score.
  // Unknown dims (a future enum append) fall back to clarity's base
  // instead of crashing getRepType.
  const baseId = opts?.pressure
    ? ("handle_pressure" as RepTypeId)
    : (DIMENSION_BASE_REP_TYPE[ex.dimension] ??
      DIMENSION_BASE_REP_TYPE.clarity);
  const base = getRepType(baseId);
  // Catalog rows use the DB enum's legacy 'pacing'; code dims use
  // 'delivery' (D6). Alias via the canonical map before filtering so
  // secondary dims survive.
  const secondary = (ex.secondaryCoreSkills ?? [])
    .map((d) => muscleGroupToSkillDim(d))
    .filter((d): d is SkillDimension => d !== null && d !== ex.dimension);
  return {
    ...base,
    name: ex.name,
    displayTitle: ex.name,
    tagline: ex.rule,
    behavior: ex.rule,
    primaryDimension: ex.dimension,
    secondaryDimensions:
      secondary.length > 0 ? secondary : base.secondaryDimensions,
    ...(ex.responseWindow
      ? { timeBudgetSec: ex.responseWindow.maxSec }
      : {}),
  };
}

// ——— Focus-context builders (ported from the retired planners) ————

export function focusForFocusMode(
  focusDimension: SkillDimension,
): RepFocusContext {
  return {
    source: "session_intent",
    dimension: focusDimension,
    bannerText: `Focus: ${DIMENSION_LABELS[focusDimension]}.`,
  };
}

export function focusForMixedRep0(
  firstSlotDim: SkillDimension,
): RepFocusContext {
  return {
    source: "session_intent",
    dimension: firstSlotDim,
    bannerText: `Today: mixed set — opening on ${DIMENSION_LABELS[firstSlotDim].toLowerCase()}.`,
  };
}

export function focusForPressureRep(
  archetype: PressureArchetype,
): RepFocusContext {
  const dim = archetype.stressedDimensions[0] ?? "tone";
  return {
    source: "session_intent",
    dimension: dim,
    bannerText: `Pressure: ${archetype.tagline.toLowerCase()}`,
  };
}

// ——— Pure slot/plan assembly ————————————————————————————————

export type LabSlotSeed = {
  exercise: LabCatalogExercise;
  prompts: string[];
  promptIds: string[];
  focus: RepFocusContext | null;
  pressureArchetype?: PressureArchetype;
};

/** Per-rep overhead beyond speaking time (read prompt, feedback, retry
 *  decision) used for the session duration estimate. */
const PER_REP_OVERHEAD_SEC = 75;

/**
 * Assemble a session plan from resolved slot seeds. Pure — all DB work
 * (exercise choice, prompt slates) happens in the server action; this
 * function owns rep-type synthesis, framework rotation, budgets, and the
 * duration estimate so it can be unit-tested without a database.
 */
export function buildLabSessionPlan(input: {
  slots: LabSlotSeed[];
  sessionType: SessionType;
  focusDimension?: SkillDimension;
  /** Injectable for deterministic tests; defaults to a random id. */
  planId?: string;
}): WorkoutSessionPlan {
  const frameworkCursor = new Map<RepTypeId, number>();
  const reps: WorkoutRepSlot[] = input.slots.map((seed) => {
    const isPressure = Boolean(seed.pressureArchetype);
    const repType = buildCatalogRepType(seed.exercise, {
      pressure: isPressure,
    });
    // Rotate the framework pool per BASE rep type: the second slot that
    // lands on the same scaffold family gets the next variant, exactly
    // like the legacy planners did across repeat rep types.
    const baseId = isPressure
      ? ("handle_pressure" as RepTypeId)
      : (DIMENSION_BASE_REP_TYPE[seed.exercise.dimension] ??
        DIMENSION_BASE_REP_TYPE.clarity);
    const pool = getFrameworkPool(getRepType(baseId).framework, baseId);
    const cursor = frameworkCursor.get(baseId) ?? 0;
    frameworkCursor.set(baseId, cursor + 1);
    const framework = pool[cursor % pool.length] ?? repType.framework;

    // The archetype's duration delta exists to compress/stretch the BASE
    // rep-type budget. A pressure exercise's own response_window already
    // encodes its time pressure (e.g. Time Compression's 20-45s), so the
    // delta applies only when the exercise has no explicit window.
    const budgetSec = seed.exercise.responseWindow
      ? repType.timeBudgetSec
      : repType.timeBudgetSec +
        (seed.pressureArchetype?.durationDeltaSec ?? 0);
    return {
      repType,
      prompts: seed.prompts,
      promptIds: seed.promptIds,
      timeBudgetMs: Math.max(15, budgetSec) * 1000,
      framework,
      focus: seed.focus,
      ...(seed.pressureArchetype
        ? { pressureArchetype: seed.pressureArchetype }
        : {}),
      exerciseId: seed.exercise.id || null,
    };
  });

  const estimatedDurationSec = reps.reduce(
    (sum, r) => sum + Math.round(r.timeBudgetMs / 1000) + PER_REP_OVERHEAD_SEC,
    0,
  );

  return {
    id:
      input.planId ??
      `lab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    reps,
    estimatedDurationSec,
    sessionType: input.sessionType,
    ...(input.focusDimension ? { focusDimension: input.focusDimension } : {}),
  };
}
