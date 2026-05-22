"use server";

// Phase 6 — prompt selection server actions.
//
// Three actions for the picker UI:
//   fetchPromptCandidates({ exerciseId, preferEasier }) →
//     5 candidates for the Shuffle tab + a one-prompt "Surprise me" pick.
//   listAllPrompts({ exerciseId, difficulty? })        →
//     full bank for the All-prompts tab.
//   logPromptSelection({ ... })                        →
//     writes one prompt_selection_events row.

import { and, eq, sql as drizzleSql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  exercisePrompts,
  exercises,
  promptSelectionEvents,
  reps,
  users,
} from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";
import { pickPromptCandidates } from "@/server/lib/workout/assignment";

export type PromptCandidate = {
  id: string;
  promptId: string;
  text: string;
  difficulty: number; // 1=intro, 2=core, 3=stretch
  tags: string[];
};

export type FetchCandidatesResult = {
  candidates: PromptCandidate[]; // up to 5 for Shuffle
  surprise: PromptCandidate | null; // single auto-pick for Surprise Me
  recentDimComposite: number | null;
};

const PROMPT_BIAS_WINDOW = 30;
/** Slide to the next-wider filter tier if the current tier returns fewer
 *  than this many prompts. Matches the Shuffle candidate count (k=5) so we
 *  never lock onto a too-thin bank when a wider one would give real rotation. */
const MIN_BANK_SIZE = 5;

/**
 * Legacy tag map — the original 864 vertical-flavored prompts (Phase 2 seed)
 * were tagged with single keys like "finance", "business", "leadership",
 * "healthcare", "science". The Wave 1 vertical bank (4,320 prompts) uses the
 * vertical id itself as the first tag ("sales", "leadership", etc.) plus
 * persona + goal ids. The vertical filter unions both schemes so the legacy
 * bank stays in rotation.
 *
 * "other" maps to an empty array; vertical filtering for "other" users
 * relies entirely on the new vertical-id tag.
 */
const LEGACY_VERTICAL_TAGS: Record<string, string[]> = {
  sales: ["business", "leadership"],
  consulting: ["business", "leadership"],
  finance: ["finance", "business"],
  healthcare: ["healthcare", "science"],
  law: ["business", "current events"],
  education: ["education", "science"],
  leadership: ["leadership", "business"],
  other: [],
};

export async function fetchPromptCandidates(input: {
  exerciseId: string;
  preferEasier?: boolean;
  /** Phase HB-3 — when true, the picker cascades through the user's
   *  vertical + personas + goals to find a personalized bank, falling
   *  through to general only if every personalized tier is too thin.
   *  When false / unset, draws from general-tagged prompts only. */
  personalize?: boolean;
}): Promise<FetchCandidatesResult> {
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";

  const fallback: FetchCandidatesResult = {
    candidates: [],
    surprise: null,
    recentDimComposite: null,
  };

  return safeDb<FetchCandidatesResult>(async () => {
    const [exerciseRow] = await db
      .select({
        id: exercises.id,
        dimension: exercises.dimension,
      })
      .from(exercises)
      .where(eq(exercises.id, input.exerciseId))
      .limit(1);
    if (!exerciseRow) return fallback;

    // Resolve user's vertical / personas / goals (NULL for anon + skipped).
    let userVertical: string | null = null;
    let userPersonas: string[] = [];
    let userGoals: string[] = [];
    if (input.personalize && user) {
      const [userRow] = await db
        .select({
          vertical: users.vertical,
          personas: users.personas,
          improvementGoals: users.improvementGoals,
        })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      userVertical = userRow?.vertical ?? null;
      userPersonas = Array.isArray(userRow?.personas)
        ? (userRow.personas as string[])
        : [];
      userGoals = Array.isArray(userRow?.improvementGoals)
        ? (userRow.improvementGoals as string[])
        : [];
    }

    // Recent dim composite drives the difficulty bias hint.
    const [compRow] = await db.execute<{ avg: number | null }>(drizzleSql`
      SELECT AVG(r.composite_score)::real AS avg
      FROM cognify_v2.reps r
      JOIN cognify_v2.exercises e ON e.id = r.exercise_id
      WHERE r.user_id = ${userId}
        AND e.dimension = ${exerciseRow.dimension}
        AND r.created_at >= NOW() - INTERVAL '14 days'
    `);
    const recentDimComposite = compRow?.avg ?? null;

    // The user's last 30 prompt_ids for this exercise (for bias-away).
    const recentRows = await db.execute<{ prompt_id: string | null }>(drizzleSql`
      SELECT r.prompt_text, ep.prompt_id
      FROM cognify_v2.reps r
      LEFT JOIN cognify_v2.exercise_prompts ep ON ep.prompt_text = r.prompt_text
      WHERE r.user_id = ${userId}
        AND r.exercise_id = ${input.exerciseId}
      ORDER BY r.created_at DESC
      LIMIT ${PROMPT_BIAS_WINDOW}
    `);
    const recentPromptIds = recentRows
      .map((row) => row.prompt_id)
      .filter((id): id is string => id != null);

    // Tag filter cascade — try the most-specific filter first, slide to a
    // wider one if the bank is too thin for real rotation. The picker never
    // shows "no prompts available" because the cascade ends at general,
    // which has full 54-exercise coverage.
    //
    // Tiers when personalize=true and a vertical is set:
    //   1. vertical ∧ any-of-personas ∧ any-of-goals
    //   2. vertical ∧ any-of-personas
    //   3. vertical ∧ any-of-goals
    //   4. vertical only
    //   5. general
    //
    // Tier "vertical" unions the new vertical-id tag (Wave 1 bank) with the
    // legacy tag map (Phase 2 bank). "other" users have no legacy mapping,
    // so for them the vertical filter is just `tags ? 'other'`.
    const legacy = userVertical ? LEGACY_VERTICAL_TAGS[userVertical] ?? [] : [];
    const verticalFilter =
      input.personalize && userVertical
        ? legacy.length > 0
          ? drizzleSql`(${exercisePrompts.tags} ? ${userVertical} OR ${exercisePrompts.tags} ?| ${legacy}::text[])`
          : drizzleSql`${exercisePrompts.tags} ? ${userVertical}`
        : null;
    const personaFilter =
      input.personalize && userPersonas.length > 0
        ? drizzleSql`${exercisePrompts.tags} ?| ${userPersonas}::text[]`
        : null;
    const goalFilter =
      input.personalize && userGoals.length > 0
        ? drizzleSql`${exercisePrompts.tags} ?| ${userGoals}::text[]`
        : null;
    const generalFilter = drizzleSql`${exercisePrompts.tags} ? 'general'`;

    const tiers: Array<{ label: string; filter: ReturnType<typeof drizzleSql> }> = [];
    if (verticalFilter && personaFilter && goalFilter) {
      tiers.push({
        label: "vertical+persona+goal",
        filter: drizzleSql`${verticalFilter} AND ${personaFilter} AND ${goalFilter}`,
      });
    }
    if (verticalFilter && personaFilter) {
      tiers.push({
        label: "vertical+persona",
        filter: drizzleSql`${verticalFilter} AND ${personaFilter}`,
      });
    }
    if (verticalFilter && goalFilter) {
      tiers.push({
        label: "vertical+goal",
        filter: drizzleSql`${verticalFilter} AND ${goalFilter}`,
      });
    }
    if (verticalFilter) {
      tiers.push({ label: "vertical", filter: verticalFilter });
    }
    tiers.push({ label: "general", filter: generalFilter });

    const selectBank = (filter: ReturnType<typeof drizzleSql>) =>
      db
        .select({
          id: exercisePrompts.id,
          promptId: exercisePrompts.promptId,
          text: exercisePrompts.promptText,
          difficulty: exercisePrompts.difficulty,
          tags: exercisePrompts.tags,
        })
        .from(exercisePrompts)
        .where(
          and(
            eq(exercisePrompts.exerciseId, input.exerciseId),
            eq(exercisePrompts.isActive, true),
            filter,
          ),
        );

    let bankRows: Awaited<ReturnType<typeof selectBank>> = [];
    let bankTier = "none";
    for (const tier of tiers) {
      const rows = await selectBank(tier.filter);
      if (rows.length >= MIN_BANK_SIZE) {
        bankRows = rows;
        bankTier = tier.label;
        break;
      }
      // Keep the largest non-empty bank seen so far as a defensive default,
      // in case every tier comes back below MIN_BANK_SIZE.
      if (rows.length > bankRows.length) {
        bankRows = rows;
        bankTier = tier.label;
      }
    }
    if (bankTier !== "vertical+persona+goal" && tiers.length > 1) {
      console.log(
        JSON.stringify({
          event: "prompt_selection.bank_tier",
          ts: new Date().toISOString(),
          userId,
          exerciseId: input.exerciseId,
          tier: bankTier,
          size: bankRows.length,
          vertical: userVertical,
          personas: userPersonas,
          goals: userGoals,
        }),
      );
    }

    const preferEasier =
      input.preferEasier ?? (recentDimComposite != null && recentDimComposite < 60);

    const picked = pickPromptCandidates({
      available: bankRows.map((b) => ({
        id: b.id,
        promptId: b.promptId,
        text: b.text,
        difficulty: b.difficulty,
        tags: Array.isArray(b.tags) ? (b.tags as string[]) : [],
      })),
      recentPromptIds,
      k: 5,
      preferEasier,
      seed: `${userId}:${input.exerciseId}:${Date.now()}`,
    });

    return {
      candidates: picked,
      surprise: picked[0] ?? null,
      recentDimComposite,
    };
  }, fallback);
}

export type ListAllPromptsResult = {
  prompts: PromptCandidate[];
};

export async function listAllPrompts(input: {
  exerciseId: string;
  difficulty?: number; // 1|2|3
}): Promise<ListAllPromptsResult> {
  return safeDb<ListAllPromptsResult>(async () => {
    const baseWhere = input.difficulty
      ? and(
          eq(exercisePrompts.exerciseId, input.exerciseId),
          eq(exercisePrompts.isActive, true),
          eq(exercisePrompts.difficulty, input.difficulty),
        )
      : and(
          eq(exercisePrompts.exerciseId, input.exerciseId),
          eq(exercisePrompts.isActive, true),
        );

    const rows = await db
      .select({
        id: exercisePrompts.id,
        promptId: exercisePrompts.promptId,
        text: exercisePrompts.promptText,
        difficulty: exercisePrompts.difficulty,
        tags: exercisePrompts.tags,
      })
      .from(exercisePrompts)
      .where(baseWhere);

    return {
      prompts: rows.map((r) => ({
        id: r.id,
        promptId: r.promptId,
        text: r.text,
        difficulty: r.difficulty,
        tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
      })),
    };
  }, { prompts: [] });
}

export type LogPromptSelectionInput = {
  workoutSessionId: string;
  exerciseId: string;
  /** exercise_prompts.id (uuid). NULL when the picker auto-aborts. */
  promptId: string | null;
  mode: "shuffle" | "list" | "surprise" | "auto_idle";
  reshuffles: number;
  msToSelect: number;
};

export async function logPromptSelection(
  input: LogPromptSelectionInput,
): Promise<{ persisted: boolean }> {
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";

  return safeDb<{ persisted: boolean }>(async () => {
    await db.insert(promptSelectionEvents).values({
      userId,
      workoutSessionId: input.workoutSessionId,
      exerciseId: input.exerciseId,
      promptId: input.promptId,
      mode: input.mode,
      reshuffles: input.reshuffles,
      msToSelect: input.msToSelect,
    });
    return { persisted: true };
  }, { persisted: false });
}

// reps import isn't used directly but is needed to keep the type-level
// dependency graph honest (Phase 7 logs reps from the same module).
void reps;
