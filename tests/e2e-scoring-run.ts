/**
 * End-to-end scoring run — sends fixtures through the full LLM + deterministic
 * hybrid pipeline to validate real scoring output with the tightened rubric.
 *
 * Run: npx dotenv -e .env.local -- tsx tests/e2e-scoring-run.ts
 *   or: ANTHROPIC_API_KEY=sk-... npx tsx tests/e2e-scoring-run.ts
 */

import { scoreRep } from "@/lib/ai/score";
import { ALL_FIXTURES } from "./fixtures/scoring";

const PROMPT_TEXT =
  "Give a 60-second summary of our quarterly revenue performance and your recommendation for next quarter.";

async function run() {
  console.log("\n=== Cognify E2E Scoring Run (v2-beta.2 rubric) ===\n");

  for (const fixture of ALL_FIXTURES) {
    console.log(`─── ${fixture.name} ───`);
    console.log(`  Description: ${fixture.description}`);

    try {
      const result = await scoreRep({
        transcript: fixture.transcript,
        promptText: PROMPT_TEXT,
        durationMs: fixture.durationMs,
        timeBudgetMs: fixture.timeBudgetMs,
        words: fixture.words,
      });

      console.log(`  Composite: ${result.composite}`);
      console.log(`  Dimensions:`);
      for (const d of result.dimensions) {
        console.log(`    ${d.dimension.padEnd(12)} ${d.score}  [${d.signals.join(", ")}]`);
      }
      console.log(`  Callouts:`);
      for (const c of result.callouts) {
        console.log(`    [${c.tone}] ${c.dimension}: ${c.title}`);
        if (c.quote) console.log(`      quote: "${c.quote}"`);
        if (c.suggestedRewrite) console.log(`      rewrite: "${c.suggestedRewrite}"`);
      }
      console.log(`  Model: ${result.modelVersion}  Rubric: ${result.rubricVersion}`);
    } catch (err) {
      console.log(`  ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }

    console.log("");
  }
}

run().catch(console.error);
