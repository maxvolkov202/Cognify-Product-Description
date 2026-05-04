// Delete the synthetic rep seeded for /ops/review-queue testing.
// Cleanup of CTO-sweep finding #3.

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const SEEDED_REP_ID = "76adbef1-1118-4ab1-b5ed-02e204b69e3c";

const c = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
try {
  // Cascade-aware delete: dimension_scores has FK ON DELETE CASCADE
  // (per schema), so deleting the rep also drops its dim rows.
  const result = await c`
    DELETE FROM cognify_v2.reps WHERE id = ${SEEDED_REP_ID}
  `;
  console.log(`Deleted ${result.count} rep row(s) for id=${SEEDED_REP_ID}`);
} finally {
  await c.end();
}
