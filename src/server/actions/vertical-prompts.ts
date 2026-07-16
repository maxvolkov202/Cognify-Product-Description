"use server";

// Phase 2B.3 (D23) — catalog-backed vertical prompt picking for the
// legacy Build-a-Rep scenario flow (flag-off path). Replaces the retired
// System A vertical bank (src/lib/ai/prompts/verticals.ts): prompts come
// from cognify_v2.exercise_prompts rows carrying the vertical's tags,
// falling back to the general bank when the vertical tier is thin.

import { and, eq, notInArray, sql as drizzleSql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { exercisePrompts } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { LEGACY_VERTICAL_TAGS } from "@/lib/workout/vertical-tags";
import { textArrayLit } from "@/lib/db/sql-helpers";

export type VerticalPromptPick = {
  /** exercise_prompts.prompt_id — stable string id for prompt-history +
   *  prompt-events (same id space the modern surfaces use). */
  id: string;
  text: string;
};

export async function pickVerticalPrompts(input: {
  vertical: string;
  count: number;
  excludePromptIds?: string[];
}): Promise<VerticalPromptPick[]> {
  const count = Math.max(1, Math.min(10, input.count));
  const exclude = (input.excludePromptIds ?? []).slice(0, 1000);

  return safeDb<VerticalPromptPick[]>(async () => {
    const legacy = LEGACY_VERTICAL_TAGS[input.vertical] ?? [];
    const verticalFilter =
      legacy.length > 0
        ? drizzleSql`(jsonb_exists(${exercisePrompts.tags}, ${input.vertical}) OR jsonb_exists_any(${exercisePrompts.tags}, ${textArrayLit(legacy)}))`
        : drizzleSql`jsonb_exists(${exercisePrompts.tags}, ${input.vertical})`;
    const generalFilter = drizzleSql`jsonb_exists(${exercisePrompts.tags}, 'general')`;
    /** Final safety net — any active prompt, matching the tier cascade
     *  contract of fetchPromptCandidates (never empty on a seeded DB). */
    const anyActiveFilter = drizzleSql`true`;

    const query = (filter: ReturnType<typeof drizzleSql>, excluded: boolean) =>
      db
        .select({
          id: exercisePrompts.promptId,
          text: exercisePrompts.promptText,
        })
        .from(exercisePrompts)
        .where(
          and(
            eq(exercisePrompts.isActive, true),
            filter,
            ...(excluded && exclude.length > 0
              ? [notInArray(exercisePrompts.promptId, exclude)]
              : []),
          ),
        )
        .orderBy(drizzleSql`random()`)
        .limit(count);

    // Tier cascade: vertical → general → any active; within each tier
    // try exclusions first, then relaxed (a tier ZEROED by exclusions is
    // exactly when relaxing matters — heavy refreshers keep vertical
    // topics instead of falling to general). Keep the best partial so a
    // thin bank returns what exists rather than nothing.
    let best: VerticalPromptPick[] = [];
    for (const filter of [verticalFilter, generalFilter, anyActiveFilter]) {
      const rows = await query(filter, true);
      if (rows.length >= count) return rows;
      if (rows.length > best.length) best = rows;
      if (exclude.length > 0) {
        const relaxed = await query(filter, false);
        if (relaxed.length >= count) return relaxed;
        if (relaxed.length > best.length) best = relaxed;
      }
    }
    return best;
  }, []);
}
