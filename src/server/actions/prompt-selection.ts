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

export async function fetchPromptCandidates(input: {
  exerciseId: string;
  preferEasier?: boolean;
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

    const bankRows = await db
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
        ),
      );

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
