// PRD v3 Phase 8.1 — runtime prompt generation cache-back (D3 hybrid).
//
// Called when a bank runs thin (heavy refreshers, long sessions). The
// generated prompts are validated (prompt-gen QA filter), inserted into
// exercise_prompts with a "generated" tag, and become permanent bank
// members — every generation makes the curated backbone thicker (the
// PRD's content flywheel). Failures return [] and the caller serves
// whatever the curated bank still has.

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { exercisePrompts, exercises } from "@/lib/db/schema";
import { log, serializeErr } from "@/lib/log";
import { generatePrompts, type PromptGenUserContext } from "@/lib/ai/prompt-gen";

function sha8(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 8);
}

export type CachedGeneratedPrompt = {
  id: string;
  promptId: string;
  text: string;
  difficulty: number;
  tags: string[];
};

/** Generate up to `count` fresh prompts for an exercise and cache them
 *  into the bank. Best-effort: any failure → []. */
export async function generateAndCachePrompts(input: {
  exerciseId: string;
  userContext?: PromptGenUserContext;
  count: number;
}): Promise<CachedGeneratedPrompt[]> {
  try {
    const [ex] = await db
      .select({
        id: exercises.id,
        slug: exercises.slug,
        name: exercises.name,
        dimension: exercises.dimension,
        description: exercises.description,
        instructions: exercises.instructions,
        objective: exercises.objective,
        promptRules: exercises.promptRules,
        hiddenSkills: exercises.hiddenSkills,
        application: exercises.application,
        responseWindow: exercises.responseWindow,
      })
      .from(exercises)
      .where(eq(exercises.id, input.exerciseId))
      .limit(1);
    if (!ex) return [];

    const bank = await db
      .select({ text: exercisePrompts.promptText })
      .from(exercisePrompts)
      .where(eq(exercisePrompts.exerciseId, input.exerciseId));

    const generated = await generatePrompts({
      exercise: {
        slug: ex.slug,
        name: ex.name,
        dimension: ex.dimension as string,
        rule: ex.description,
        why: ex.instructions,
        objective: ex.objective,
        promptRules: ex.promptRules,
        hiddenSkills: ex.hiddenSkills,
        application: ex.application,
        responseWindow: ex.responseWindow,
      },
      userContext: input.userContext,
      existingTexts: bank.map((b) => b.text),
      count: input.count,
    });
    if (generated.length === 0) return [];

    const out: CachedGeneratedPrompt[] = [];
    for (const text of generated) {
      const promptId = `${ex.slug}-${sha8(text.trim().toLowerCase())}`;
      const tags = ["general", "generated"];
      const [row] = await db
        .insert(exercisePrompts)
        .values({
          exerciseId: ex.id,
          promptText: text,
          promptId,
          difficulty: 2,
          tags,
        })
        .onConflictDoNothing({ target: exercisePrompts.promptId })
        .returning({ id: exercisePrompts.id });
      if (row) {
        out.push({ id: row.id, promptId, text, difficulty: 2, tags });
      }
    }
    if (out.length > 0) {
      log.info({
        event: "prompt_gen.cached",
        exerciseId: ex.id,
        slug: ex.slug,
        generated: out.length,
      });
    }
    return out;
  } catch (err) {
    log.warn({
      event: "prompt_gen.failed",
      exerciseId: input.exerciseId,
      err: serializeErr(err),
    });
    return [];
  }
}
