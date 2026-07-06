/**
 * PRD v3 Phase 8.2 — offline prompt-bank expansion (Hunter C15).
 *
 * Batch-runs the same runtime generation + QA + cache-back pipeline the
 * live picker uses (src/lib/ai/prompt-gen.ts → prompt-gen-cache.ts) over
 * the whole catalog, so banks thicken per Hidden Skill without waiting
 * for users to run them dry.
 *
 *   npx tsx scripts/expand-prompt-bank.ts --dry-run
 *   npx tsx scripts/expand-prompt-bank.ts --per-exercise 10 --apply
 *   npx tsx scripts/expand-prompt-bank.ts --dim clarity --apply
 *   npx tsx scripts/expand-prompt-bank.ts --app storytelling --apply
 *
 * Requires live ANTHROPIC/OPENAI credits — generation returns 0 rows on
 * provider failure and the script reports it (never partial garbage).
 */

import { config } from "dotenv";
config({ path: ".env.local" });

// Dynamic imports AFTER dotenv — the AI shim snapshots provider keys at
// module-init (same caveat as smoke-engine-v2.ts).

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const PER_EXERCISE = (() => {
  const i = args.indexOf("--per-exercise");
  return i >= 0 ? Math.max(1, Math.min(20, Number(args[i + 1]))) : 10;
})();
const DIM = (() => {
  const i = args.indexOf("--dim");
  return i >= 0 ? args[i + 1] : null;
})();
const APP = (() => {
  const i = args.indexOf("--app");
  return i >= 0 ? args[i + 1] : null;
})();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[expand-prompt-bank] DATABASE_URL not set");
    process.exit(1);
  }
  const { db } = await import("@/lib/db/client");
  const { exercises } = await import("@/lib/db/schema");
  const { eq, and, isNull } = await import("drizzle-orm");
  const { generateAndCachePrompts } = await import(
    "@/server/lib/prompt-gen-cache"
  );

  const conditions = [eq(exercises.isActive, true)];
  if (DIM) conditions.push(eq(exercises.dimension, DIM as never));
  if (APP) conditions.push(eq(exercises.application, APP));
  if (!DIM && !APP) conditions.push(isNull(exercises.application));

  const rows = await db
    .select({ id: exercises.id, slug: exercises.slug })
    .from(exercises)
    .where(and(...conditions));

  console.log(
    `[expand-prompt-bank] ${rows.length} exercises × ${PER_EXERCISE} prompts${APPLY ? "" : " (DRY RUN — nothing will be generated)"}`,
  );
  if (!APPLY) {
    console.log("[expand-prompt-bank] pass --apply to run generation.");
    return;
  }

  let total = 0;
  let failures = 0;
  for (const ex of rows) {
    const cached = await generateAndCachePrompts({
      exerciseId: ex.id,
      count: PER_EXERCISE,
    });
    if (cached.length === 0) {
      failures++;
      console.log(`  ✗ ${ex.slug}: 0 generated (provider/QA failure)`);
    } else {
      total += cached.length;
      console.log(`  ✓ ${ex.slug}: +${cached.length}`);
    }
  }
  console.log(
    `[expand-prompt-bank] done — ${total} prompts cached, ${failures} exercises failed.`,
  );
  process.exit(failures === rows.length && rows.length > 0 ? 1 : 0);
}

void main();
