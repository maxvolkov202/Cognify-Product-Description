/**
 * PRD v3 Phase 8.3 — content flywheel: engagement-driven prompt pruning.
 *
 * A prompt that keeps being SHOWN but never PICKED is dead weight in the
 * slate — every appearance costs the user a refresh. This script finds
 * them via prompt_engagement and deactivates the worst offenders, with a
 * floor so no exercise's active bank drops below MIN_ACTIVE_PER_EXERCISE.
 *
 *   node scripts/prune-prompts.mjs             # report only (dry run)
 *   node scripts/prune-prompts.mjs --apply     # deactivate
 *
 * Deactivation is reversible (is_active=false, rows kept). Re-run after
 * bank expansions; intended as an ops task post-launch (weekly-ish).
 */

import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });

const args = process.argv.slice(2);
const DRY_RUN = !args.includes("--apply");

/** A prompt must have real exposure before we judge it. */
const MIN_SHOWN = 20;
/** Picked/shown below this = users actively refresh past it. */
const MAX_PICK_RATE = 0.05;
/** Never shrink an exercise's ACTIVE bank below this. */
const MIN_ACTIVE_PER_EXERCISE = 12;

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("[prune-prompts] DATABASE_URL not set");
    process.exit(1);
  }
  const sql = postgres(dbUrl, { max: 1, prepare: false });
  try {
    const candidates = await sql`
      SELECT ep.id, ep.prompt_id, ep.exercise_id, ep.prompt_text,
             g.shown_count, g.picked_count,
             e.slug AS exercise_slug,
             (SELECT COUNT(*) FROM cognify_v2.exercise_prompts p2
               WHERE p2.exercise_id = ep.exercise_id AND p2.is_active) AS active_count
      FROM cognify_v2.prompt_engagement g
      JOIN cognify_v2.exercise_prompts ep ON ep.prompt_id = g.prompt_id
      JOIN cognify_v2.exercises e ON e.id = ep.exercise_id
      WHERE ep.is_active
        AND g.shown_count >= ${MIN_SHOWN}
        AND g.picked_count::float / NULLIF(g.shown_count, 0) < ${MAX_PICK_RATE}
      ORDER BY g.picked_count::float / NULLIF(g.shown_count, 0) ASC,
               g.shown_count DESC
    `;

    if (candidates.length === 0) {
      console.log(
        `[prune-prompts] nothing to prune (shown ≥ ${MIN_SHOWN}, pick rate < ${MAX_PICK_RATE * 100}%).`,
      );
      return;
    }

    // Respect the per-exercise floor while walking worst-first.
    const activeLeft = new Map();
    const toPrune = [];
    for (const c of candidates) {
      const left = activeLeft.get(c.exercise_id) ?? Number(c.active_count);
      if (left <= MIN_ACTIVE_PER_EXERCISE) continue;
      activeLeft.set(c.exercise_id, left - 1);
      toPrune.push(c);
    }

    console.log(
      `[prune-prompts] ${candidates.length} low-engagement prompts; ${toPrune.length} prunable after the ${MIN_ACTIVE_PER_EXERCISE}-per-exercise floor:`,
    );
    for (const c of toPrune) {
      const rate = ((c.picked_count / c.shown_count) * 100).toFixed(1);
      console.log(
        `  [${c.exercise_slug}] shown ${c.shown_count}, picked ${c.picked_count} (${rate}%): ${c.prompt_text.slice(0, 80)}…`,
      );
    }

    if (DRY_RUN) {
      console.log("[prune-prompts] dry run — pass --apply to deactivate.");
      return;
    }
    if (toPrune.length > 0) {
      await sql`
        UPDATE cognify_v2.exercise_prompts
        SET is_active = false
        WHERE id IN ${sql(toPrune.map((c) => c.id))}
      `;
    }
    console.log(`[prune-prompts] deactivated ${toPrune.length} prompts.`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[prune-prompts] failed:", err);
  process.exit(1);
});
