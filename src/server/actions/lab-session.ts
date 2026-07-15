"use server";

// System Change v2 Phase 2B.3 (D23) — catalog-backed lab session planner.
//
// Server counterpart of src/lib/workout/lab-plan.ts: resolves catalog
// exercises + prompt slates from the DB (the only prompt system) and
// assembles a WorkoutSessionPlan for the legacy Skill Lab surfaces
// (/drills Focus Drills under FF_SKILL_LAB_APPS, /skill-lab flag-off).
//
// The deterministic planning logic (interleave, pressure placement,
// rotation, flow ramp) lives in src/server/lib/lab-session-planning.ts
// (pure + unit-tested); this file owns only the DB reads and assembly.

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { exercises } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { log } from "@/lib/log";
import {
  PRESSURE_ARCHETYPES,
  type PressureArchetype,
  type PressureArchetypeId,
} from "@/lib/ai/pressure-archetypes";
import { seededShuffle } from "@/server/lib/workout/assignment";
import {
  clampFocusCount,
  interleaveMixedDims,
  pressureArchetypeSequence,
  pressureIndexFor,
  rotateExercises,
  FLOW_RAMP,
} from "@/server/lib/lab-session-planning";
import {
  buildLabSessionPlan,
  focusForFocusMode,
  focusForMixedRep0,
  focusForPressureRep,
  type LabCatalogExercise,
  type LabSlotSeed,
  type WorkoutSessionPlan,
} from "@/lib/workout/lab-plan";
import {
  muscleGroupToSkillDim,
  skillDimToDbDimension,
} from "@/lib/scoring/dimension-aliases";
import type { SkillDimension } from "@/types/domain";
import type { SubSkillId } from "@/types/sub-skills";
import { fetchPromptCandidates } from "@/server/actions/prompt-selection";

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
    dimension: muscleGroupToSkillDim(row.dimension) ?? "clarity",
    secondaryCoreSkills: row.secondaryCoreSkills,
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

const shuffle = <T,>(arr: T[]): T[] => seededShuffle(arr, randomUUID());

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
 * Slate every slot. Prompt ids are exercise-scoped (`${slug}-${sha8}`),
 * so slates for DISTINCT exercises can never collide — fetch exercise
 * groups in parallel and thread the exclusion list only WITHIN a group
 * (repeat slots on the same exercise must not repeat prompts).
 */
async function slateSlots(
  slotExercises: LabCatalogExercise[],
  exclude: string[],
): Promise<{ prompts: string[]; promptIds: string[] }[] | null> {
  const groups = new Map<string, number[]>();
  slotExercises.forEach((ex, i) => {
    const list = groups.get(ex.id) ?? [];
    list.push(i);
    groups.set(ex.id, list);
  });

  const results: ({ prompts: string[]; promptIds: string[] } | null)[] =
    new Array(slotExercises.length).fill(null);
  await Promise.all(
    [...groups.entries()].map(async ([exerciseId, slotIndexes]) => {
      const seen = [...exclude];
      for (const i of slotIndexes) {
        const slate = await slateFor(exerciseId, seen);
        if (slate.prompts.length === 0) return; // leaves results[i] null
        seen.push(...slate.promptIds);
        results[i] = slate;
      }
    }),
  );
  if (results.some((r) => r === null)) {
    const missing = results.findIndex((r) => r === null);
    log.warn({
      event: "lab_session.empty_slate",
      exerciseId: slotExercises[missing]?.id,
    });
    return null;
  }
  return results as { prompts: string[]; promptIds: string[] }[];
}

/** Look up the relocated pressure bank: catalog exercises with
 *  application='pressure' keyed by archetype id in application_skills.
 *  One query per plan. */
async function loadPressureExercises(): Promise<
  Map<PressureArchetypeId, LabCatalogExercise>
> {
  const rows = await db
    .select(exerciseColumns)
    .from(exercises)
    .where(
      and(
        eq(exercises.application, "pressure"),
        eq(exercises.isActive, true),
      ),
    );
  const out = new Map<PressureArchetypeId, LabCatalogExercise>();
  for (const row of rows) {
    for (const key of row.applicationSkills ?? []) {
      if (key in PRESSURE_ARCHETYPES) {
        out.set(key as PressureArchetypeId, toLabExercise(row));
      }
    }
  }
  return out;
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
    const exclude = (input.excludePromptIds ?? []).slice(-500);

    if (input.style === "pressure") {
      return planPressure(clampFocusCount(input.count), exclude);
    }

    const dims =
      input.style === "focus"
        ? Array.from(
            { length: clampFocusCount(input.count) },
            () => input.dimension,
          )
        : interleaveMixedDims(input.skillReps);
    if (dims.length === 0) return null;

    const pressureIndex = pressureIndexFor(input.style, dims.length);
    const pressureArchetype =
      pressureIndex >= 0
        ? PRESSURE_ARCHETYPES[
            shuffle([...FLOW_RAMP])[0] ?? "pushback"
          ]
        : null;

    const dbDims = [...new Set(dims.map(skillDimToDbDimension))];
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
    // exercises (bank permitting). The pressure slot is excluded — its
    // exercise comes from the pressure catalog (or a same-dim fallback).
    const perDimCounts = new Map<SkillDimension, number>();
    dims.forEach((d, i) => {
      if (i === pressureIndex) return;
      perDimCounts.set(d, (perDimCounts.get(d) ?? 0) + 1);
    });
    const perDimQueues = new Map<SkillDimension, LabCatalogExercise[]>();
    for (const [dim, count] of perDimCounts) {
      const { picks, preferredMatched } = rotateExercises(
        byDim.get(dim) ?? [],
        count,
        shuffle,
        input.style === "focus" ? input.preferSubSkill : undefined,
      );
      if (picks.length === 0) {
        log.warn({ event: "lab_session.no_exercises", dimension: dim });
        return null;
      }
      if (!preferredMatched) {
        // Deep-linked sub-skill has no tagged exercise — session still
        // runs, but the bias was a no-op. Loud so the gap is visible.
        log.warn({
          event: "lab_session.prefer_sub_skill_unmatched",
          dimension: dim,
          subSkill: input.style === "focus" ? input.preferSubSkill : null,
        });
      }
      perDimQueues.set(dim, picks);
    }

    const pressureByArchetype =
      pressureArchetype !== null
        ? await loadPressureExercises()
        : new Map<PressureArchetypeId, LabCatalogExercise>();

    const slotExercises: LabCatalogExercise[] = dims.map((dim, i) => {
      if (i === pressureIndex && pressureArchetype) {
        return (
          pressureByArchetype.get(pressureArchetype.id) ??
          // Pressure catalog not seeded yet — fall back to the slot
          // dimension's own bank; the archetype framing still applies.
          shuffle(byDim.get(dim) ?? [])[0]!
        );
      }
      return perDimQueues.get(dim)!.shift()!;
    });
    if (slotExercises.some((ex) => !ex)) return null;

    const slates = await slateSlots(slotExercises, exclude);
    if (!slates) return null;

    const slots: LabSlotSeed[] = slotExercises.map((exercise, i) => {
      const isPressure = i === pressureIndex && pressureArchetype !== null;
      return {
        exercise,
        prompts: slates[i]!.prompts,
        promptIds: slates[i]!.promptIds,
        focus: isPressure
          ? focusForPressureRep(pressureArchetype!)
          : input.style === "focus"
            ? focusForFocusMode(input.dimension)
            : i === 0
              ? focusForMixedRep0(dims[0]!)
              : null,
        ...(isPressure ? { pressureArchetype: pressureArchetype! } : {}),
      };
    });

    return buildLabSessionPlan({
      slots,
      sessionType: input.style === "focus" ? "focus" : "combined",
      ...(input.style === "focus"
        ? { focusDimension: input.dimension }
        : {}),
    });
  }, null);
}

/** Pressure sessions ramp through the five archetypes in design order,
 *  entered at a rotating start (legacy behavior — consecutive short
 *  sessions shouldn't replay the same intro archetype). Prompts come
 *  from the relocated pressure bank, falling back to the archetype's
 *  top stressed dimension's core bank when it hasn't been seeded. */
async function planPressure(
  count: number,
  exclude: string[],
): Promise<WorkoutSessionPlan | null> {
  const archetypeIds = pressureArchetypeSequence(
    count,
    Math.floor(Math.random() * FLOW_RAMP.length),
  );
  const pressureByArchetype = await loadPressureExercises();

  // Fallback pool (pressure catalog missing): core exercises across the
  // archetypes' top stressed dimensions only.
  let fallbackByDim: Map<SkillDimension, LabCatalogExercise[]> | null = null;
  async function fallbackFor(
    archetype: PressureArchetype,
  ): Promise<LabCatalogExercise | null> {
    if (!fallbackByDim) {
      const dbDims = [
        ...new Set(
          archetypeIds.map((id) =>
            skillDimToDbDimension(
              PRESSURE_ARCHETYPES[id].stressedDimensions[0] ?? "tone",
            ),
          ),
        ),
      ];
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
    return pool.length > 0 ? (shuffle(pool)[0] ?? null) : null;
  }

  const slotExercises: LabCatalogExercise[] = [];
  const archetypes: PressureArchetype[] = [];
  for (const archetypeId of archetypeIds) {
    const archetype = PRESSURE_ARCHETYPES[archetypeId];
    const exercise =
      pressureByArchetype.get(archetypeId) ?? (await fallbackFor(archetype));
    if (!exercise) {
      log.warn({
        event: "lab_session.no_pressure_exercise",
        archetype: archetypeId,
      });
      return null;
    }
    slotExercises.push(exercise);
    archetypes.push(archetype);
  }

  const slates = await slateSlots(slotExercises, exclude);
  if (!slates) return null;

  const slots: LabSlotSeed[] = slotExercises.map((exercise, i) => ({
    exercise,
    prompts: slates[i]!.prompts,
    promptIds: slates[i]!.promptIds,
    focus: focusForPressureRep(archetypes[i]!),
    pressureArchetype: archetypes[i]!,
  }));

  return buildLabSessionPlan({ slots, sessionType: "flow" });
}
