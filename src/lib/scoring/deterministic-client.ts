/**
 * Phase 2 — client-safe re-exports of the deterministic scoring layer.
 *
 * The pure-function deterministic scorers in `./deterministic.ts` have no
 * Node-only imports (no node:crypto / fs / process) and compose cleanly
 * with `./signals/audio.ts` which is also pure. This file exists as the
 * explicit public surface a React component can import without
 * accidentally pulling in a server-only dep down the import graph.
 *
 * Why a separate file: makes the contract explicit. Anyone touching
 * `deterministic.ts` or `signals/audio.ts` is on notice that adding a
 * Node import would break the client-side optimistic-dim rendering in
 * Phase 2 (and any future component-level use). Keep both files
 * client-portable.
 *
 * What's exported:
 *   - extractSignals          : Deepgram word timings → SignalBundle
 *   - scorePacing             : Delivery (pure function over SignalBundle)
 *   - scoreThinkingQualityDeterministic : Thinking-quality baseline (pure)
 *   - SignalBundle / WordTiming / DeterministicScoreResult types
 *
 * What's NOT exported here:
 *   - Anything that calls the LLM (those live in src/lib/ai/*)
 *   - The hybrid blend logic (lives server-side in scoreRep)
 *   - Sub-skill mappers (not needed for the 2-dim optimistic preview)
 */

export { extractSignals } from "./signals/audio";
export type { SignalBundle, WordTiming } from "./signals/audio";

export {
  scorePacing,
  scoreThinkingQualityDeterministic,
  type DeterministicScoreResult,
} from "./deterministic";

/**
 * Convenience: given word timings + transcript, compute the two
 * deterministic dimension scores in one call. Returns null when there
 * aren't enough words to score meaningfully (matches the server's
 * pre-flight skip behavior in buildFallbackScore).
 *
 * Used by RepSurface to populate the scoring-phase optimistic preview
 * the moment Deepgram returns — well before /api/score resolves.
 */
import type { DimensionScore } from "@/types/domain";
import { extractSignals as _extract } from "./signals/audio";
import {
  scorePacing as _scorePacing,
  scoreThinkingQualityDeterministic as _scoreThinking,
} from "./deterministic";

export function computeOptimisticDims(input: {
  words: { word: string; startMs: number; endMs: number }[];
  transcript: string;
  durationMs: number;
  timeBudgetMs?: number;
}): DimensionScore[] | null {
  if (!input.words || input.words.length < 5) return null;
  const signals = _extract({
    words: input.words,
    transcript: input.transcript,
    durationMs: input.durationMs,
    timeBudgetMs: input.timeBudgetMs ?? input.durationMs,
  });
  const delivery = _scorePacing(signals);
  const thinking = _scoreThinking(signals);
  return [
    {
      dimension: "delivery",
      score: delivery.score,
      signals: delivery.signals,
    },
    {
      dimension: "thinking_quality",
      score: thinking.score,
      signals: thinking.signals,
    },
  ];
}
