/**
 * Grading audit WS1 (§3.1.6) — exclude mock-fallback reps from score
 * aggregates.
 *
 * A mock-fallback rep (`model_version = 'mock-fallback-v1'`) is a rep whose
 * scoring FAILED; its composite (~74) is a fixed placeholder that sits above
 * 95% of real reps, so any average that includes it is inflated. Counts of
 * activity (reps today, streaks) still include them — the user did the rep —
 * but nothing that averages a score should.
 *
 * `seed-demo-v1` rows are intentionally NOT excluded from user-facing
 * aggregates: they exist so the demo account has a populated dashboard.
 * Ops / calibration analytics exclude both (see `isRealLlmGradedRep`).
 */
import { sql, type SQL } from "drizzle-orm";
import { reps } from "@/lib/db/schema";

export const MOCK_MODEL_VERSION = "mock-fallback-v1";
export const SEED_MODEL_VERSION = "seed-demo-v1";

/** Drizzle predicate on the `reps` table: not a mock-fallback row. NULL
 *  model_version (legacy rows) is kept. */
export function isScoredRep(): SQL {
  return sql`(${reps.modelVersion} is null or ${reps.modelVersion} <> ${MOCK_MODEL_VERSION})`;
}

/** Drizzle predicate: real LLM-graded rep (excludes mock AND seed rows).
 *  For ops / calibration analytics. */
export function isRealLlmGradedRep(): SQL {
  return sql`(${reps.modelVersion} is null or ${reps.modelVersion} not in (${MOCK_MODEL_VERSION}, ${SEED_MODEL_VERSION}))`;
}

/** Raw-SQL fragment for `db.execute(drizzleSql\`...\`)` call sites where the
 *  reps table is aliased. Pass the alias used in the query (default `r`). */
export function scoredRepSqlFragment(alias = "r"): SQL {
  return sql.raw(
    `(${alias}.model_version IS NULL OR ${alias}.model_version <> '${MOCK_MODEL_VERSION}')`,
  );
}
