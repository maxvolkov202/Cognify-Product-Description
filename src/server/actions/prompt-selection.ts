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
import { log, serializeErr } from "@/lib/log";
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
  /** PRD v3 Phase 2.6 (PRD §9.4.2) — prompt ids already DISPLAYED this
   *  session (accumulated client-side across refreshes). Excluded from
   *  the pick so a refresh never re-shows a slate the user already
   *  rejected. Relaxed automatically when exclusion would starve the
   *  bank below one full slate; a NEW session starts with an empty list,
   *  so skipped prompts return to the pool tomorrow. Capped server-side. */
  sessionSeenPromptIds?: string[];
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

    // Resolve user's vertical + goals (NULL for anon + skipped).
    // Personas were dropped from the cascade — they layered an extra
    // AND that narrowed banks below the MIN_BANK_SIZE threshold without
    // adding meaningful personalization beyond vertical+goals. Vertical
    // is the strongest signal; goals refine within it.
    let userVertical: string | null = null;
    let userGoals: string[] = [];
    if (input.personalize && user) {
      const [userRow] = await db
        .select({
          vertical: users.vertical,
          improvementGoals: users.improvementGoals,
        })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      userVertical = userRow?.vertical ?? null;
      userGoals = Array.isArray(userRow?.improvementGoals)
        ? (userRow.improvementGoals as string[])
        : [];
    }

    // Recent dim composite drives the difficulty bias hint.
    // Recent prompt ids drive bias-away from already-used prompts.
    // Both queries are gated to authenticated users — for anonymous guests
    // the userId placeholder is the literal string "anonymous", and the
    // reps.user_id column is a uuid. Passing a non-uuid string fails the
    // query, which historically tripped safeDb's fallback and surfaced as
    // "No prompts available". Skip the queries for guests instead.
    let recentDimComposite: number | null = null;
    let recentPromptIds: string[] = [];
    if (user) {
      try {
        const [compRow] = await db.execute<{ avg: number | null }>(drizzleSql`
          SELECT AVG(r.composite_score)::real AS avg
          FROM cognify_v2.reps r
          JOIN cognify_v2.exercises e ON e.id = r.exercise_id
          WHERE r.user_id = ${userId}
            AND e.dimension = ${exerciseRow.dimension}
            AND r.created_at >= NOW() - INTERVAL '14 days'
        `);
        recentDimComposite = compRow?.avg ?? null;

        const recentRows = await db.execute<{ prompt_id: string | null }>(drizzleSql`
          SELECT r.prompt_text, ep.prompt_id
          FROM cognify_v2.reps r
          LEFT JOIN cognify_v2.exercise_prompts ep ON ep.prompt_text = r.prompt_text
          WHERE r.user_id = ${userId}
            AND r.exercise_id = ${input.exerciseId}
          ORDER BY r.created_at DESC
          LIMIT ${PROMPT_BIAS_WINDOW}
        `);
        recentPromptIds = recentRows
          .map((row) => row.prompt_id)
          .filter((id): id is string => id != null);
      } catch (err) {
        // Bias signals are nice-to-have. If the queries fail (rare —
        // network blip, query timeout) the picker still hands the user a
        // fresh shuffle from the bank instead of crashing.
        log.warn({
          event: "prompt_selection.bias_signal_failed",
          userId,
          exerciseId: input.exerciseId,
          err: serializeErr(err),
        });
      }
    }

    // Tag filter cascade — try the most-specific filter first, slide to a
    // wider one if the bank is too thin for real rotation. Cascade ends at
    // "any active prompt", so the picker can never show "no prompts available"
    // when the exerciseId points at a real row.
    //
    // Tiers when personalize=true and a vertical is set:
    //   1. vertical ∧ any-of-goals       (most personalized)
    //   2. vertical only                  (still personalized, broader bank)
    //   3. general                        (universal bank)
    //   4. any active                     (final safety net)
    //
    // Tier "vertical" unions the new vertical-id tag (Wave 1 bank) with the
    // legacy tag map (Phase 2 bank). "other" users have no legacy mapping,
    // so for them the vertical filter is just `tags ? 'other'`.
    //
    // NOTE — using jsonb_exists / jsonb_exists_any function calls instead
    // of the `?` and `?|` operators. Postgres treats them identically, but
    // Drizzle/pg's parameter binder can confuse a bare `?` with a positional
    // placeholder when the same query also carries bound params from the
    // surrounding `and(eq(...), eq(...), ...)` builder. Function calls
    // sidestep that ambiguity and keep the cascade reliable.
    // Postgres array literal helper — binds each element individually via
    // drizzle's sql.join so the array renders as `ARRAY['a','b']::text[]`
    // instead of being bound as a single composite/record value (which
    // fails with "cannot cast type record to text[]"). Without this every
    // personalized tier query throws and the cascade silently falls
    // through to general — the exact dark-Wave-2 bug from 2026-05-23.
    const textArrayLit = (arr: readonly string[]) =>
      drizzleSql`ARRAY[${drizzleSql.join(
        arr.map((x) => drizzleSql`${x}`),
        drizzleSql`, `,
      )}]::text[]`;

    const legacy = userVertical ? LEGACY_VERTICAL_TAGS[userVertical] ?? [] : [];
    const verticalFilter =
      input.personalize && userVertical
        ? legacy.length > 0
          ? drizzleSql`(jsonb_exists(${exercisePrompts.tags}, ${userVertical}) OR jsonb_exists_any(${exercisePrompts.tags}, ${textArrayLit(legacy)}))`
          : drizzleSql`jsonb_exists(${exercisePrompts.tags}, ${userVertical})`
        : null;
    const goalFilter =
      input.personalize && userGoals.length > 0
        ? drizzleSql`jsonb_exists_any(${exercisePrompts.tags}, ${textArrayLit(userGoals)})`
        : null;
    const generalFilter = drizzleSql`jsonb_exists(${exercisePrompts.tags}, 'general')`;
    /** Unconditional safety net. Matches every active prompt for the
     *  exercise regardless of tag. */
    const anyActiveFilter = drizzleSql`true`;

    const tiers: Array<{ label: string; filter: ReturnType<typeof drizzleSql> }> = [];
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
    tiers.push({ label: "any", filter: anyActiveFilter });

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
      // Per-tier try/catch — one bad filter (Drizzle composition quirk,
      // jsonb operator edge case) MUST NOT take down the whole cascade.
      // We log it and continue; the "any" tier at the end guarantees a
      // non-empty bank even if every personalized tier fails.
      let rows: Awaited<ReturnType<typeof selectBank>> = [];
      try {
        rows = await selectBank(tier.filter);
      } catch (err) {
        log.warn({
          event: "prompt_selection.tier_query_failed",
          userId,
          exerciseId: input.exerciseId,
          tier: tier.label,
          err: serializeErr(err),
        });
        continue;
      }
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
    if (bankTier !== "vertical+goal" && tiers.length > 1) {
      log.info({
        event: "prompt_selection.bank_tier",
        userId,
        exerciseId: input.exerciseId,
        tier: bankTier,
        size: bankRows.length,
        vertical: userVertical,
        goals: userGoals,
      });
    }

    const preferEasier =
      input.preferEasier ?? (recentDimComposite != null && recentDimComposite < 60);

    // PRD v3 Phase 2.6 — hard in-session exclusion (distinct from the
    // soft cross-session recentPromptIds bias). Cap the incoming list
    // defensively; relax when exclusion would starve a full slate.
    const sessionSeen = new Set(
      (input.sessionSeenPromptIds ?? []).slice(0, 500),
    );
    let available = bankRows.map((b) => ({
      id: b.id,
      promptId: b.promptId,
      text: b.text,
      difficulty: b.difficulty,
      tags: Array.isArray(b.tags) ? (b.tags as string[]) : [],
    }));
    if (sessionSeen.size > 0) {
      const unseen = available.filter((p) => !sessionSeen.has(p.promptId));
      if (unseen.length >= 5) {
        available = unseen;
      } else {
        log.info({
          event: "prompt_selection.session_exclusion_relaxed",
          userId,
          exerciseId: input.exerciseId,
          bankSize: available.length,
          seenSize: sessionSeen.size,
        });
      }
    }

    const picked = pickPromptCandidates({
      available,
      recentPromptIds,
      k: 5,
      preferEasier,
      seed: `${userId}:${input.exerciseId}:${Date.now()}`,
    });

    // PRD v3 Phase 7.5 (Hunter C18) — fitness vs variety guardrail. When
    // the whole slate came from a PERSONALIZED bank, swap the last two
    // slots for general-bank prompts: relevance sells the rep, variety
    // prevents the profile from overfitting the user into a bubble.
    const VARIETY_SLOTS = 2;
    if (
      (bankTier === "vertical+goal" || bankTier === "vertical") &&
      picked.length === 5
    ) {
      try {
        const generalRows = await selectBank(generalFilter);
        const pickedIds = new Set(picked.map((p) => p.promptId));
        const generalAvailable = generalRows
          .map((b) => ({
            id: b.id,
            promptId: b.promptId,
            text: b.text,
            difficulty: b.difficulty,
            tags: Array.isArray(b.tags) ? (b.tags as string[]) : [],
          }))
          .filter(
            (p) => !pickedIds.has(p.promptId) && !sessionSeen.has(p.promptId),
          );
        if (generalAvailable.length >= VARIETY_SLOTS) {
          const varietyPicks = pickPromptCandidates({
            available: generalAvailable,
            recentPromptIds,
            k: VARIETY_SLOTS,
            preferEasier,
            seed: `${userId}:${input.exerciseId}:${Date.now()}:variety`,
          });
          picked.splice(5 - VARIETY_SLOTS, VARIETY_SLOTS, ...varietyPicks);
        }
      } catch {
        // Guardrail is best-effort — a fully personalized slate is the
        // graceful degradation, not an error.
      }
    }

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
