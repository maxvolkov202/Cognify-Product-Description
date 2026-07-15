"use server";

// System Change v2 Phase 2B.3 (D23) — catalog-backed lab session planner.
//
// Server counterpart of src/lib/workout/lab-plan.ts: resolves catalog
// exercises + prompt slates from the DB (the only prompt system) and
// assembles a WorkoutSessionPlan for the legacy Skill Lab surfaces
// (/drills Focus Drills under FF_SKILL_LAB_APPS, /skill-lab flag-off).
//
// Replaces the retired client-side planners planFocusWorkout /
// planMixedSession / planPressureSession, whose prompts came from the
// hardcoded System A banks.

import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { exercises } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { log } from "@/lib/log";
import {
  PRESSURE_ARCHETYPES,
  selectPressureArchetype,
  type PressureArchetype,
  type PressureArchetypeId,
} from "@/lib/ai/pressure-archetypes";
import {
  buildLabSessionPlan,
  focusForFocusMode,
  focusForMixedRep0,
  focusForPressureRep,
  type LabCatalogExercise,
  type LabSlotSeed,
  type WorkoutSessionPlan,
} from "@/lib/workout/lab-plan";
import type { SkillDimension } from "@/types/domain";
import type { SubSkillId } from "@/types/sub-skills";
import { fetchPromptCandidates } from "@/server/actions/prompt-selection";

/** Code dim → DB enum value (the enum is append-only; 'pacing' is the
 *  legacy spelling of code 'delivery' — D6). */
function toDbDimension(dim: SkillDimension): string {
  return dim === "delivery" ? "pacing" : dim;
}
function fromDbDimension(dim: string): SkillDimension {
  return (dim === "pacing" ? "delivery" : dim) as SkillDimension;
}

export type PlanLabSessionInput =
  | {
      style: "focus";
      dimension: SkillDimension;
      count: number;
      preferSubSkill?: SubSkillId;
      excludePromptIds?: string[];
    }
  | {
      style: "mixed";
      skillReps: { dimension: SkillDimension; reps: number }[];
      excludePromptIds?: string[];
    }
  | {
      style: "pressure";
      count: number;
      excludePromptIds?: string[];
    };

type ExerciseRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  dimension: string;
  secondaryCoreSkills: string[] | null;
  responseWindow: { minSec: number; maxSec: number } | null;
  hiddenSkills: string[] | null;
  applicationSkills: string[] | null;
};

function toLabExercise(row: ExerciseRow): LabCatalogExercise {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    rule: row.description,
    dimension: fromDbDimension(row.dimension),
    secondaryCoreSkills: row.secondaryCoreSkills as SkillDimension[] | null,
    responseWindow: row.responseWindow,
    hiddenSkills: row.hiddenSkills,
  };
}

const exerciseColumns = {
  id: exercises.id,
  slug: exercises.slug,
  name: exercises.name,
  description: exercises.description,
  dimension: exercises.dimension,
  secondaryCoreSkills: exercises.secondaryCoreSkills,
  responseWindow: exercises.responseWindow,
  hiddenSkills: exercises.hiddenSkills,
  applicationSkills: exercises.applicationSkills,
} as const;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Pick `count` exercises for a dimension, rotating without repeats until
 *  the pool is exhausted. When `preferSubSkill` is set, exercises tagged
 *  with that hidden skill lead the rotation (deep-link "drill this
 *  sub-skill" routing). */
function rotateExercises(
  pool: LabCatalogExercise[],
  count: number,
  preferSubSkill?: SubSkillId,
): LabCatalogExercise[] {
  if (pool.length === 0) return [];
  const preferred = preferSubSkill
    ? pool.filter((e) => e.hiddenSkills?.includes(preferSubSkill))
    : [];
  const rest = shuffle(pool.filter((e) => !preferred.includes(e)));
  const ordered = [...shuffle(preferred), ...rest];
  const out: LabCatalogExercise[] = [];
  for (let i = 0; i < count; i++) out.push(ordered[i % ordered.length]!);
  return out;
}

/** Slate one slot's prompts from its exercise's catalog bank. Reuses the
 *  prompt-selection picker (tier cascade, difficulty bias, session
 *  exclusion, generated top-up when the bank runs thin). */
async function slateFor(
  exerciseId: string,
  sessionSeen: string[],
): Promise<{ prompts: string[]; promptIds: string[] }> {
  const result = await fetchPromptCandidates({
    exerciseId,
    personalize: false,
    sessionSeenPromptIds: sessionSeen,
  });
  return {
    prompts: result.candidates.map((c) => c.text),
    promptIds: result.candidates.map((c) => c.promptId),
  };
}

/**
 * Plan a lab session from the DB catalog. Returns null when the catalog
 * is unreachable or empty for the requested dimensions — the client
 * surfaces a retry state instead of a broken session.
 */
export async function planLabSession(
  input: PlanLabSessionInput,
): Promise<WorkoutSessionPlan | null> {
  return safeDb<WorkoutSessionPlan | null>(async () => {
    const exclude = (input.excludePromptIds ?? []).slice(0, 500);

    if (input.style === "pressure") {
      return planPressure(input.count, exclude);
    }

    const dims =
      input.style === "focus"
        ? Array.from({ length: input.count }, () => input.dimension)
        : input.skillReps.flatMap((sr) =>
            Array.from({ length: Math.max(0, sr.reps) }, () => sr.dimension),
          );
    if (dims.length === 0) return null;

    // Build → Stress → Reinforce arc (WS-3): sessions of 4+ reps carry
    // one pressure rep at position N-1, exactly like the retired
    // planners. Shorter sessions skip it (the arc needs a build + a
    // reinforce on either side).
    const pressureIndex = dims.length >= 4 ? dims.length - 2 : -1;
    const pressureArchetype =
      pressureIndex >= 0 ? selectPressureArchetype() : null;

    const dbDims = [...new Set(dims.map(toDbDimension))];
    const rows = await db
      .select(exerciseColumns)
      .from(exercises)
      .where(
        and(
          inArray(exercises.dimension, dbDims as never[]),
          eq(exercises.isActive, true),
          isNull(exercises.application),
        ),
      );
    const byDim = new Map<SkillDimension, LabCatalogExercise[]>();
    for (const row of rows) {
      const ex = toLabExercise(row);
      const list = byDim.get(ex.dimension) ?? [];
      list.push(ex);
      byDim.set(ex.dimension, list);
    }

    // Per-dimension rotation so a 5-rep focus session sees 5 different
    // exercises (bank permitting) and mixed sessions rotate within each
    // of their dimensions. The pressure slot is excluded — its exercise
    // comes from the pressure catalog (or a fallback pick below).
    const perDimCounts = new Map<SkillDimension, number>();
    dims.forEach((d, i) => {
      if (i === pressureIndex) return;
      perDimCounts.set(d, (perDimCounts.get(d) ?? 0) + 1);
    });
    const perDimPicks = new Map<SkillDimension, LabCatalogExercise[]>();
    for (const [dim, count] of perDimCounts) {
      const picks = rotateExercises(
        byDim.get(dim) ?? [],
        count,
        input.style === "focus" ? input.preferSubSkill : undefined,
      );
      if (picks.length === 0) {
        log.warn({ event: "lab_session.no_exercises", dimension: dim });
        return null;
      }
      perDimPicks.set(dim, picks);
    }

    const cursor = new Map<SkillDimension, number>();
    const seen = [...exclude];
    const slots: LabSlotSeed[] = [];
    for (let i = 0; i < dims.length; i++) {
      const dim = dims[i]!;
      let exercise: LabCatalogExercise;
      let slotArchetype: PressureArchetype | undefined;
      if (i === pressureIndex && pressureArchetype) {
        slotArchetype = pressureArchetype;
        exercise =
          (await findPressureExercise(pressureArchetype.id)) ??
          // Pressure catalog not seeded yet — fall back to the slot
          // dimension's own bank; the archetype framing still applies.
          shuffle(byDim.get(dim) ?? [])[0]!;
        if (!exercise) {
          log.warn({ event: "lab_session.no_exercises", dimension: dim });
          return null;
        }
      } else {
        const idx = cursor.get(dim) ?? 0;
        cursor.set(dim, idx + 1);
        exercise = perDimPicks.get(dim)![idx]!;
      }
      const { prompts, promptIds } = await slateFor(exercise.id, seen);
      if (prompts.length === 0) {
        log.warn({
          event: "lab_session.empty_slate",
          exerciseId: exercise.id,
        });
        return null;
      }
      seen.push(...promptIds);
      slots.push({
        exercise,
        prompts,
        promptIds,
        focus: slotArchetype
          ? focusForPressureRep(slotArchetype)
          : input.style === "focus"
            ? focusForFocusMode(input.dimension)
            : i === 0
              ? focusForMixedRep0(dims[0]!)
              : null,
        ...(slotArchetype ? { pressureArchetype: slotArchetype } : {}),
      });
    }

    return buildLabSessionPlan({
      slots,
      sessionType: input.style === "focus" ? "focus" : "combined",
      ...(input.style === "focus"
        ? { focusDimension: input.dimension }
        : {}),
    });
  }, null);
}

/** Look up the relocated pressure bank: a catalog exercise with
 *  application='pressure' keyed by archetype id in application_skills.
 *  Null when the pressure catalog hasn't been seeded. */
async function findPressureExercise(
  archetypeId: PressureArchetypeId,
): Promise<LabCatalogExercise | null> {
  const rows = await db
    .select(exerciseColumns)
    .from(exercises)
    .where(
      and(
        eq(exercises.application, "pressure"),
        eq(exercises.isActive, true),
      ),
    );
  const row = rows.find((r) => r.applicationSkills?.includes(archetypeId));
  return row ? toLabExercise(row) : null;
}

/** The flow ramp's designed archetype order (Direction.md): time pressure
 *  first, stakes last. Counts >5 cycle the ramp. */
const FLOW_RAMP: readonly PressureArchetypeId[] = [
  "time_compression",
  "audience_switch",
  "pushback",
  "clarifying_interrupt",
  "stakes_raise",
];

/** Pressure sessions ramp through the five archetypes in design order.
 *  Prompts come from the relocated pressure bank, falling back to the
 *  archetype's top stressed dimension's core bank when the pressure
 *  catalog hasn't been seeded yet. */
async function planPressure(
  count: number,
  exclude: string[],
): Promise<WorkoutSessionPlan | null> {
  const n = Math.max(1, Math.min(10, count));

  // Fallback pool (pressure catalog missing): core exercises across the
  // stressed dimensions.
  let fallbackByDim: Map<SkillDimension, LabCatalogExercise[]> | null = null;
  async function fallbackFor(
    archetype: PressureArchetype,
  ): Promise<LabCatalogExercise | null> {
    if (!fallbackByDim) {
      const rows = await db
        .select(exerciseColumns)
        .from(exercises)
        .where(
          and(eq(exercises.isActive, true), isNull(exercises.application)),
        );
      fallbackByDim = new Map();
      for (const row of rows) {
        const ex = toLabExercise(row);
        const list = fallbackByDim.get(ex.dimension) ?? [];
        list.push(ex);
        fallbackByDim.set(ex.dimension, list);
      }
    }
    const dim = archetype.stressedDimensions[0] ?? "tone";
    const pool = fallbackByDim.get(dim) ?? [];
    return pool.length > 0 ? shuffle(pool)[0]! : null;
  }

  const seen = [...exclude];
  const slots: LabSlotSeed[] = [];
  for (let i = 0; i < n; i++) {
    const archetypeId = FLOW_RAMP[i % FLOW_RAMP.length]!;
    const archetype = PRESSURE_ARCHETYPES[archetypeId];
    const exercise =
      (await findPressureExercise(archetypeId)) ??
      (await fallbackFor(archetype));
    if (!exercise) {
      log.warn({
        event: "lab_session.no_pressure_exercise",
        archetype: archetypeId,
      });
      return null;
    }
    const { prompts, promptIds } = await slateFor(exercise.id, seen);
    if (prompts.length === 0) return null;
    seen.push(...promptIds);
    slots.push({
      exercise,
      prompts,
      promptIds,
      focus: focusForPressureRep(archetype),
      pressureArchetype: archetype,
    });
  }

  return buildLabSessionPlan({ slots, sessionType: "flow" });
}
