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
import {
  generatePrompts,
  verifyPromptsCanon,
  type PromptGenUserContext,
} from "@/lib/ai/prompt-gen";

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
        coachInsight: exercises.coachInsight,
        scoringLens: exercises.scoringLens,
        retryObjective: exercises.retryObjective,
        commonFailureModes: exercises.commonFailureModes,
        secondaryCoreSkills: exercises.secondaryCoreSkills,
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
        coachInsight: ex.coachInsight,
        scoringLens: ex.scoringLens,
        retryObjective: ex.retryObjective,
        commonFailureModes: ex.commonFailureModes,
        secondaryCoreSkills: ex.secondaryCoreSkills,
      },
      userContext: input.userContext,
      existingTexts: bank.map((b) => b.text),
      count: input.count,
    });
    if (generated.length === 0) return [];

    // Phase 2A.2 — LLM canon QA before cache-back. Generated prompts
    // become PERMANENT bank members, so they get the same canon bar as
    // authored content. Fail OPEN on judge outage (null): a verify
    // failure must never empty a user's slate — log and serve.
    let vetted = generated;
    const verdicts = await verifyPromptsCanon({
      prompts: generated,
      exercise: {
        name: ex.name,
        dimension: ex.dimension as string,
        rule: ex.description,
        application: ex.application,
        responseWindow: ex.responseWindow,
      },
    });
    if (verdicts) {
      vetted = generated.filter((_, i) => verdicts[i]?.ok);
      const rejected = verdicts.filter((v) => !v.ok);
      if (rejected.length > 0) {
        log.info({
          event: "prompt_gen.canon_rejected",
          exerciseId: ex.id,
          slug: ex.slug,
          rejected: rejected.length,
          violations: rejected.flatMap((v) => v.violations).slice(0, 12),
        });
      }
    } else {
      log.warn({
        event: "prompt_gen.canon_verify_unavailable",
        exerciseId: ex.id,
        slug: ex.slug,
      });
    }
    if (vetted.length === 0) return [];

    const out: CachedGeneratedPrompt[] = [];
    for (const text of vetted) {
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
