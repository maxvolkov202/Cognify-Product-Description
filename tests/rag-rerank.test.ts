/**
 * Phase B — RAG coverage rerank tests.
 *
 * Run: npx tsx tests/rag-rerank.test.ts
 *
 * Asserts:
 *  1. Legacy (no preferredDim) behavior unchanged — per-dim coverage
 *     in scoredDims order, then similarity fill.
 *  2. preferredDim pins the highest-similarity matching chunk at slot 0
 *     even when its skill dim falls later in scoredDims.
 *  3. preferredDim with no matching chunk falls through silently.
 *  4. preferredDim already top-of-list is idempotent.
 *  5. returnCount cap honored.
 */

import {
  __rerankForCoverageForTests as rerank,
  type RetrievedChunk,
} from "@/lib/ai/rag/retrieve";
import type { SkillDimension } from "@/types/domain";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(cond: unknown, message: string): void {
  if (cond) pass++;
  else {
    fail++;
    failures.push(message);
    console.log(`  ✗ ${message}`);
  }
}
function section(label: string): void {
  console.log(`\n── ${label} ──`);
}

function chunk(
  id: string,
  topic: string,
  similarity: number,
): RetrievedChunk {
  return {
    id,
    sourceFile: `${topic}.md`,
    section: "test",
    content: `chunk ${id} for ${topic}`,
    tokenCount: 100,
    tags: { topic },
    similarity,
  };
}

const SCORED: SkillDimension[] = [
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
];

section("legacy coverage (no preferredDim)");
{
  // Rows ordered by similarity desc — clarity is best, but conciseness
  // and structure should still each win a slot via coverage.
  const rows = [
    chunk("clar-a", "clarity", 0.9),
    chunk("clar-b", "clarity", 0.85),
    chunk("struct-a", "structure", 0.7),
    chunk("conc-a", "conciseness", 0.65),
    chunk("think-a", "thinking_quality", 0.55),
    chunk("clar-c", "clarity", 0.5),
  ];
  const picked = rerank(rows, SCORED, 4, null);
  assert(picked.length === 4, `picks 4 (got ${picked.length})`);
  // Coverage order: clarity, structure, conciseness, thinking_quality.
  assert(picked[0]?.id === "clar-a", "slot 0 = clar-a");
  assert(picked[1]?.id === "struct-a", "slot 1 = struct-a");
  assert(picked[2]?.id === "conc-a", "slot 2 = conc-a");
  assert(picked[3]?.id === "think-a", "slot 3 = think-a");
}

section("preferredDim pins slot 0 (overrides scoredDims order)");
{
  const rows = [
    chunk("clar-a", "clarity", 0.9),
    chunk("struct-a", "structure", 0.7),
    chunk("conc-a", "conciseness", 0.65),
    chunk("think-a", "thinking_quality", 0.55),
  ];
  // preferredDim = conciseness — falls 3rd in coverage normally, but
  // should win slot 0 here.
  const picked = rerank(rows, SCORED, 4, "conciseness");
  assert(picked[0]?.id === "conc-a", "slot 0 = conc-a (preferred)");
  // Remaining 3 slots cover the other dims in scoredDims order.
  assert(picked[1]?.id === "clar-a", "slot 1 = clar-a");
  assert(picked[2]?.id === "struct-a", "slot 2 = struct-a");
  assert(picked[3]?.id === "think-a", "slot 3 = think-a");
}

section("preferredDim picks HIGHEST-similarity matching chunk");
{
  const rows = [
    chunk("conc-low", "conciseness", 0.4),
    chunk("clar-a", "clarity", 0.9),
    chunk("conc-high", "conciseness", 0.8),
    chunk("struct-a", "structure", 0.7),
  ];
  // rows ordered by similarity:
  // clar-a (0.9), conc-high (0.8), struct-a (0.7), conc-low (0.4)
  // So when sorted by similarity descending (caller pre-sorts), the
  // first matching conciseness chunk encountered is conc-high.
  // Synthesize that order:
  const sorted = [...rows].sort((a, b) => b.similarity - a.similarity);
  // Tighten returnCount to 2 so we test ONLY coverage behavior (slot 0
  // is the preferred dim's best match; slot 1 is clarity). With a
  // larger returnCount the fill pass would pull conc-low in anyway,
  // which is correct but not what this assertion is checking.
  const picked = rerank(sorted, SCORED, 2, "conciseness");
  assert(picked[0]?.id === "conc-high", "slot 0 = conc-high (best conc match)");
  assert(picked[1]?.id === "clar-a", "slot 1 = clar-a (next-best by coverage)");
}

section("preferredDim with no matching chunk → fallthrough");
{
  const rows = [
    chunk("clar-a", "clarity", 0.9),
    chunk("struct-a", "structure", 0.7),
  ];
  // delivery has no matching chunk; should fall through to legacy
  // coverage.
  const picked = rerank(rows, SCORED, 4, "delivery");
  assert(picked[0]?.id === "clar-a", "slot 0 = clar-a (no preferred match)");
  assert(picked[1]?.id === "struct-a", "slot 1 = struct-a");
  assert(picked.length === 2, "only 2 rows available, picked 2");
}

section("preferredDim already first by similarity → idempotent");
{
  const rows = [
    chunk("clar-a", "clarity", 0.95),
    chunk("struct-a", "structure", 0.7),
    chunk("conc-a", "conciseness", 0.6),
  ];
  const picked = rerank(rows, SCORED, 3, "clarity");
  assert(picked[0]?.id === "clar-a", "slot 0 = clar-a");
  assert(picked[1]?.id === "struct-a", "slot 1 = struct-a");
  assert(picked[2]?.id === "conc-a", "slot 2 = conc-a");
}

section("returnCount cap honored");
{
  const rows = [
    chunk("clar-a", "clarity", 0.9),
    chunk("struct-a", "structure", 0.7),
    chunk("conc-a", "conciseness", 0.65),
  ];
  const picked = rerank(rows, SCORED, 1, "structure");
  assert(picked.length === 1, "picks exactly 1");
  assert(picked[0]?.id === "struct-a", "slot 0 = struct-a");
}

section("fill pass after coverage");
{
  // 4 scored dims, only 2 represented by chunks; returnCount=6 so the
  // 4 extra slots fill by similarity from remaining chunks.
  const rows = [
    chunk("clar-a", "clarity", 0.95),
    chunk("clar-b", "clarity", 0.9),
    chunk("clar-c", "clarity", 0.85),
    chunk("struct-a", "structure", 0.7),
    chunk("clar-d", "clarity", 0.6),
  ];
  const picked = rerank(rows, SCORED, 4, null);
  // Pass 1: clarity (clar-a), structure (struct-a). No conciseness or
  // thinking_quality chunks → pass 2 fills with next-best clarity dups.
  assert(picked[0]?.id === "clar-a", "slot 0 = clar-a");
  assert(picked[1]?.id === "struct-a", "slot 1 = struct-a");
  assert(picked[2]?.id === "clar-b", "slot 2 = clar-b (fill)");
  assert(picked[3]?.id === "clar-c", "slot 3 = clar-c (fill)");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("\nFAILURES:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
