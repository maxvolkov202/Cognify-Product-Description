/**
 * Grading plan WS6 — relevance check, disfluency line, thinking off the blend.
 * Run: npx tsx tests/relevance-and-thinking.test.ts
 */
import { cosineSimilarity, relevanceBelowFloor, applyRelevanceFloor, RELEVANCE_FLOOR_CAP, RELEVANCE_HEADLINE_PREFIX } from "@/lib/scoring/relevance";
import { renderDisfluencyLine, applyHybridLayer, DEFAULT_HYBRID_CONFIG, buildSystemBlocks } from "@/lib/ai/score-shared";
import type { DimensionScore } from "@/types/domain";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) pass++;
  else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── cosine ──
{
  check("identical → 1", Math.abs(cosineSimilarity([1, 2, 3], [1, 2, 3])! - 1) < 1e-9);
  check("orthogonal → 0", Math.abs(cosineSimilarity([1, 0], [0, 1])!) < 1e-9);
  check("length mismatch → null", cosineSimilarity([1, 2], [1]) === null);
  check("zero vector → null", cosineSimilarity([0, 0], [1, 1]) === null);
  check("below floor at 0.1", relevanceBelowFloor(0.1) && !relevanceBelowFloor(0.35) && !relevanceBelowFloor(null));
}

// ── floor ──
{
  const dims: DimensionScore[] = (["clarity", "structure", "conciseness", "thinking_quality", "delivery", "tone"] as const).map((d) => ({ dimension: d, score: 72, signals: [] }));
  const r = applyRelevanceFloor({ dimensions: dims, headline: "You made a clear case.", similarity: 0.08 });
  check("content dims capped", r.dimensions.filter((d) => ["clarity", "structure", "conciseness", "thinking_quality"].includes(d.dimension)).every((d) => d.score === RELEVANCE_FLOOR_CAP));
  check("delivery/tone untouched", r.dimensions.find((d) => d.dimension === "delivery")!.score === 72 && r.dimensions.find((d) => d.dimension === "tone")!.score === 72);
  check("headline prefixed", r.headline.startsWith(RELEVANCE_HEADLINE_PREFIX) && r.headline.includes("You made a clear case."));
  check("capped dims carry a signal", r.dimensions.find((d) => d.dimension === "clarity")!.signals.some((s) => /relevance floor/.test(s)));
  check("already-low dims unchanged", applyRelevanceFloor({ dimensions: [{ dimension: "clarity", score: 30, signals: [] }], headline: "x", similarity: 0.05 }).dimensions[0]!.score === 30);
  check("idempotent headline", applyRelevanceFloor({ dimensions: dims, headline: r.headline, similarity: 0.08 }).headline === r.headline);
}

// ── disfluency line ──
{
  const w = (word: string, startMs: number, endMs: number) => ({ word, startMs, endMs });
  const words = [w("I", 0, 200), w("think", 300, 600), w("maybe", 700, 1000), w("we", 3200, 3400), w("should", 3500, 3800), w("ship.", 3900, 4200)];
  const line = renderDisfluencyLine({ words, transcript: "I think maybe we should ship.", durationMs: 8000 })!;
  check("renders when words exist", /^DISFLUENCY \(measured from word timings/.test(line), line);
  check("has hedges/min, restarts, long pauses, stalls, pace change", /hedges [\d.]+\/min · restarts \d+ · long pauses >1\.5s \d+ · stalls >3s \d+ · end-of-rep pace change [+-]\d+%/.test(line), line);
  check("counts the 2.2 s gap as a long pause", /long pauses >1\.5s 1/.test(line), line);
  check("null without words", renderDisfluencyLine({ transcript: "x", durationMs: 8000 }) === null);
  check("deterministic", renderDisfluencyLine({ words, transcript: "I think maybe we should ship.", durationMs: 8000 }) === line);
}

// ── thinking: default config is the model's score ──
{
  check("default hybrid config has thinkingMode llm", DEFAULT_HYBRID_CONFIG.thinkingMode === "llm" && DEFAULT_HYBRID_CONFIG.deliveryMode === "deterministic");
  const w = (word: string, startMs: number, endMs: number) => ({ word, startMs, endMs });
  const words = Array.from({ length: 30 }, (_, i) => w(`w${i}`, i * 400, i * 400 + 200));
  const dims: DimensionScore[] = [{ dimension: "thinking_quality", score: 25, signals: [] }, { dimension: "delivery", score: 70, signals: [] }];
  const llm = applyHybridLayer({ dims, input: { transcript: words.map((x) => x.word).join(" "), promptText: "p", durationMs: 12000, words } as never, config: { deliveryMode: "deterministic", thinkingMode: "llm" } });
  check("llm mode keeps the model's 25 (blend would show 61)", llm.dimensionMap.thinking_quality === 25, String(llm.dimensionMap.thinking_quality));
  const blend = applyHybridLayer({ dims, input: { transcript: words.map((x) => x.word).join(" "), promptText: "p", durationMs: 12000, words } as never, config: { deliveryMode: "deterministic", thinkingMode: "blend" } });
  check("blend mode still available for arms", blend.dimensionMap.thinking_quality! > 25);
  // output contract: evidence before score (read from the rendered system prompt)
  const sys = buildSystemBlocks({ rubricBlock: "" }).map((b) => (typeof b === "string" ? b : (b as { text?: string }).text ?? "")).join("\n");
  const contract = sys.split("Return ONLY a JSON object")[1]!.slice(0, 900);
  check("contract lists quote and signals before score", contract.indexOf('"quote"') < contract.indexOf('"score"') && contract.indexOf('"signals"') < contract.indexOf('"score"'), contract.slice(0, 120));
}

console.log("────────────────────────────");
console.log(`pass: ${pass} fail: ${fail}`);
if (fail === 0) console.log("✓ all relevance-and-thinking tests pass");
else process.exitCode = 1;
