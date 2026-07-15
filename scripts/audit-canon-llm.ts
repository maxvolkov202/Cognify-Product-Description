/**
 * System Change v2 Phase 2B.2 — LLM universality audit of the ACTIVE
 * prompt catalog against docs/prompt-design-canon.md.
 *
 * Runs the same canon judge the runtime cache-back path uses
 * (verifyPromptsCanon in src/lib/ai/prompt-gen.ts) over every active
 * exercise_prompts row and deactivates violators (is_active=false —
 * reversible, never DELETE). Complements the regex pass in
 * scripts/dev/prune-canon-violators.mjs, which can only catch pattern
 * violations; the LLM pass judges required-setup / persona /
 * not-universal / jargon-wall / mechanic-mismatch.
 *
 *   npx tsx scripts/audit-canon-llm.ts --dry-run
 *   npx tsx scripts/audit-canon-llm.ts --apply
 *   npx tsx scripts/audit-canon-llm.ts --dim clarity --apply
 *
 * Exemptions:
 *   - application='pressure' exercises are skipped: the pressure genre
 *     intentionally carries a light scenario + interlocutor line (canon
 *     archetype C); those prompts were canon-screened at relocation time.
 *
 * Cost control: set OPENAI_FRAMEWORK_MODEL=gpt-4o-mini to run the judge
 * on the cheap tier (the judge role rides MODELS.framework). Requires
 * live provider credits — a failed batch is retried once and then
 * SKIPPED (fail closed: nothing is deactivated on judge failure).
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const DIM = (() => {
  const i = args.indexOf("--dim");
  return i >= 0 ? args[i + 1] : null;
})();
const BATCH_SIZE = 25;

async function main() {
  const { db } = await import("@/lib/db/client");
  const { exercises, exercisePrompts } = await import("@/lib/db/schema");
  const { and, eq, inArray } = await import("drizzle-orm");
  const { verifyPromptsCanon } = await import("@/lib/ai/prompt-gen");

  const rows = await db
    .select({
      exerciseId: exercises.id,
      exerciseName: exercises.name,
      dimension: exercises.dimension,
      rule: exercises.description,
      application: exercises.application,
      responseWindow: exercises.responseWindow,
      promptRowId: exercisePrompts.id,
      promptId: exercisePrompts.promptId,
      text: exercisePrompts.promptText,
    })
    .from(exercisePrompts)
    .innerJoin(exercises, eq(exercises.id, exercisePrompts.exerciseId))
    .where(
      and(eq(exercisePrompts.isActive, true), eq(exercises.isActive, true)),
    );

  const byExercise = new Map<string, typeof rows>();
  let skippedPressure = 0;
  for (const row of rows) {
    if (row.application === "pressure") {
      skippedPressure++;
      continue;
    }
    if (DIM && row.dimension !== DIM && row.application !== DIM) continue;
    const list = byExercise.get(row.exerciseId) ?? [];
    list.push(row);
    byExercise.set(row.exerciseId, list);
  }

  const total = [...byExercise.values()].reduce((s, l) => s + l.length, 0);
  console.log(
    `[audit-canon] ${total} active prompts across ${byExercise.size} exercises` +
      (skippedPressure > 0
        ? ` (${skippedPressure} pressure-bank prompts exempt)`
        : ""),
  );

  const violationCounts = new Map<string, number>();
  const toDeactivate: { promptRowId: string; promptId: string; text: string; violations: string[] }[] = [];
  let judged = 0;
  let skippedBatches = 0;

  for (const [, list] of byExercise) {
    const ex = list[0]!;
    for (let i = 0; i < list.length; i += BATCH_SIZE) {
      const batch = list.slice(i, i + BATCH_SIZE);
      let verdicts = await verifyPromptsCanon({
        prompts: batch.map((b) => b.text),
        exercise: {
          name: ex.exerciseName,
          dimension: ex.dimension as string,
          rule: ex.rule,
          application: ex.application,
          responseWindow: ex.responseWindow,
        },
      });
      if (!verdicts) {
        // One retry, then skip the batch (fail closed — never deactivate
        // on judge failure).
        verdicts = await verifyPromptsCanon({
          prompts: batch.map((b) => b.text),
          exercise: {
            name: ex.exerciseName,
            dimension: ex.dimension as string,
            rule: ex.rule,
            application: ex.application,
            responseWindow: ex.responseWindow,
          },
        });
      }
      if (!verdicts) {
        skippedBatches++;
        console.warn(
          `[audit-canon] judge failed twice — skipping batch (${ex.exerciseName}, ${batch.length} prompts)`,
        );
        continue;
      }
      judged += batch.length;
      for (const v of verdicts) {
        if (v.ok) continue;
        // "unjudged" = the judge response was truncated for this index —
        // treat like a judge failure (skip), not a violation.
        if (v.violations.length === 1 && v.violations[0] === "unjudged") {
          continue;
        }
        const row = batch[v.index]!;
        toDeactivate.push({
          promptRowId: row.promptRowId,
          promptId: row.promptId,
          text: row.text,
          violations: v.violations,
        });
        for (const tag of v.violations) {
          violationCounts.set(tag, (violationCounts.get(tag) ?? 0) + 1);
        }
      }
      process.stdout.write(
        `\r[audit-canon] judged ${judged}/${total}  violators so far: ${toDeactivate.length}   `,
      );
    }
  }
  console.log("");

  console.log(`[audit-canon] violators: ${toDeactivate.length}/${judged} judged`);
  for (const [tag, n] of [...violationCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tag}: ${n}`);
  }
  if (skippedBatches > 0) {
    console.log(`[audit-canon] ${skippedBatches} batches skipped on judge failure`);
  }

  // Full details for review.
  const { writeFileSync } = await import("node:fs");
  const outPath = `audit-canon-results-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(outPath, JSON.stringify(toDeactivate, null, 2));
  console.log(`[audit-canon] details written to ${outPath}`);

  if (!APPLY) {
    console.log("[audit-canon] --dry-run; nothing deactivated.");
    return;
  }
  if (toDeactivate.length > 0) {
    const CHUNK = 200;
    for (let i = 0; i < toDeactivate.length; i += CHUNK) {
      const ids = toDeactivate.slice(i, i + CHUNK).map((d) => d.promptRowId);
      await db
        .update(exercisePrompts)
        .set({ isActive: false })
        .where(inArray(exercisePrompts.id, ids));
    }
  }
  console.log(`[audit-canon] deactivated ${toDeactivate.length} prompts.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[audit-canon] fatal:", err);
    process.exit(1);
  });
