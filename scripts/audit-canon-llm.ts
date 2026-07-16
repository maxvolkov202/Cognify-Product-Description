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
 *   - Prompts whose text appears in the CURATED manifests (core
 *     v1/*.json + applications/*.json) are skipped: that content is
 *     doc-sourced / human-reviewed against the canon (Phase 2B.1) and is
 *     authoritative over the LLM judge — the judge false-positives on
 *     doc-canonical "Explain what X is" prompts. The audit targets the
 *     unreviewed bulk: Wave-era general/vertical banks + runtime-
 *     generated rows.
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

/** Normalized texts of every prompt in the curated manifests (core
 *  dimension files + application files — NOT the general/vertical wave
 *  dirs, which are exactly what this audit exists to screen). */
async function loadCuratedTexts(
  normalizeText: (t: string) => string,
): Promise<Set<string>> {
  const { readFileSync, readdirSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const dir = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "exercise-catalog",
    "v1",
  );
  const out = new Set<string>();
  const files = [
    ...readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => resolve(dir, f)),
    ...readdirSync(resolve(dir, "applications"))
      .filter((f) => f.endsWith(".json"))
      .map((f) => resolve(dir, "applications", f)),
  ];
  for (const file of files) {
    const manifest = JSON.parse(readFileSync(file, "utf8"));
    for (const ex of manifest.exercises ?? []) {
      for (const p of ex.prompts ?? []) out.add(normalizeText(p.text));
    }
  }
  return out;
}

async function main() {
  const { db } = await import("@/lib/db/client");
  const { exercises, exercisePrompts } = await import("@/lib/db/schema");
  const { and, eq, inArray } = await import("drizzle-orm");
  const { verifyPromptsCanon, normalizePromptText } = await import(
    "@/lib/ai/prompt-gen"
  );
  // Same normalizer as the generator's dedupe — the exemption set must
  // match with identical semantics or curated prompts stop matching.
  const curated = await loadCuratedTexts(normalizePromptText);

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
  let skippedCurated = 0;
  for (const row of rows) {
    if (row.application === "pressure") {
      skippedPressure++;
      continue;
    }
    if (DIM && row.dimension !== DIM && row.application !== DIM) continue;
    if (curated.has(normalizePromptText(row.text))) {
      skippedCurated++;
      continue;
    }
    const list = byExercise.get(row.exerciseId) ?? [];
    list.push(row);
    byExercise.set(row.exerciseId, list);
  }

  const total = [...byExercise.values()].reduce((s, l) => s + l.length, 0);
  console.log(
    `[audit-canon] ${total} active prompts across ${byExercise.size} exercises` +
      ` (exempt: ${skippedPressure} pressure-bank, ${skippedCurated} curated-manifest)`,
  );

  const violationCounts = new Map<string, number>();
  const toDeactivate: { promptRowId: string; promptId: string; text: string; violations: string[] }[] = [];
  let judged = 0;
  let skippedBatches = 0;

  for (const [, list] of byExercise) {
    const ex = list[0]!;
    for (let i = 0; i < list.length; i += BATCH_SIZE) {
      const batch = list.slice(i, i + BATCH_SIZE);
      const judgeInput = {
        prompts: batch.map((b) => b.text),
        exercise: {
          name: ex.exerciseName,
          dimension: ex.dimension as string,
          rule: ex.rule,
          application: ex.application,
          responseWindow: ex.responseWindow,
        },
      };
      // One retry, then skip the batch (fail closed — never deactivate
      // on judge failure).
      const verdicts =
        (await verifyPromptsCanon(judgeInput)) ??
        (await verifyPromptsCanon(judgeInput));
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
