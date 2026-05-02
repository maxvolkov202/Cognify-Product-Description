/**
 * Cognify Ch.11 — Signals barrel module.
 *
 * Public surface for the scoring signals layer. Two families live here:
 *
 *   1. Text-derived signals (Ch.11) — `extractAllTextSignals()` plus the
 *      per-dimension extractors. Pure functions over (transcript,
 *      durationMs). Feed the SIGNALS block in the score prompt.
 *   2. Audio/prosody signals (Ch.3a, pre-existing) — `extractSignals()`
 *      and `WordTiming` re-exported transparently from `./audio.ts` so
 *      legacy callers (`@/lib/scoring/signals` import path) keep
 *      working unchanged.
 */

import type { TextSignals } from "./types";
import { extractClaritySignals } from "./clarity";
import { extractStructureSignals } from "./structure";
import { extractConcisenessSignals } from "./conciseness";
import { extractThinkingQualitySignals } from "./thinking-quality";
import { getWordCount } from "./_helpers";

// ——— Public re-exports ————————————————————————————————————

// Audio/prosody — backward-compatible. Existing consumers do
// `import { extractSignals, WordTiming } from "@/lib/scoring/signals"`.
export { extractSignals } from "./audio";
export type { SignalBundle, WordTiming } from "./audio";

// Text-signal types.
export type {
  ClarityTextSignals,
  StructureTextSignals,
  ConcisenessTextSignals,
  ThinkingQualityTextSignals,
  TextSignals,
} from "./types";

// Per-dimension extractors.
export { extractClaritySignals } from "./clarity";
export { extractStructureSignals } from "./structure";
export { extractConcisenessSignals } from "./conciseness";
export { extractThinkingQualitySignals } from "./thinking-quality";

// Sub-skill mapper (Ch.11b).
export {
  mapSignalsToSubSkillScores,
  toScoresOnly,
  type SubSkillScoreEntry,
  type SubSkillScoreMap,
} from "./sub-skill-mapper";

// ——— Composer ————————————————————————————————————————————

/**
 * Run all four text-signal extractors and return the composed bundle
 * plus meta (word count + duration).
 *
 * The four LLM-scored content dimensions (clarity, structure,
 * conciseness, thinking_quality) all read from this bundle when the
 * SIGNALS block is rendered into the score prompt.
 *
 * Pure: same (transcript, durationMs) → same TextSignals.
 */
export function extractAllTextSignals(input: {
  transcript: string;
  durationMs: number;
  words?: readonly { word: string; startMs?: number; endMs?: number }[];
}): TextSignals {
  const { transcript, durationMs } = input;
  const wordCount = getWordCount(
    transcript,
    input.words as readonly { word: string }[] | undefined,
  );
  const durationMinutes = Math.max(0.001, durationMs / 60_000);

  return {
    clarity: extractClaritySignals({ transcript, durationMs }),
    structure: extractStructureSignals({ transcript, durationMs }),
    conciseness: extractConcisenessSignals({ transcript, durationMs }),
    thinking_quality: extractThinkingQualitySignals({ transcript, durationMs }),
    meta: {
      wordCount,
      durationMs,
      durationMinutes,
    },
  };
}

// ——— Prompt rendering ————————————————————————————————————

/**
 * Render the SIGNALS block injected into the score prompt before the
 * transcript. Mirrors `renderProsodyBlock` from `@/lib/audio/prosody`.
 *
 * Format is human-readable (operators frequently inspect score-prompt
 * logs in /ops) and Claude-readable (clear dimension headings + target
 * thresholds in parentheses so the LLM has the calibration context the
 * thresholds in `sub-skill-mapper.ts` were tuned against).
 *
 * Returns null when called with null (no signals) so the score prompt
 * builder can just `[modeBlock, signalsBlock, prosodyBlock, …]` filter
 * out absent blocks.
 */
export function renderTextSignalsBlock(signals: TextSignals | null): string | null {
  if (!signals) return null;
  const c = signals.clarity;
  const s = signals.structure;
  const cn = signals.conciseness;
  const t = signals.thinking_quality;
  const arc = s.arcCompletion;

  return [
    "SIGNALS (objective text-derived measurements — score AGAINST these, do not re-derive from the transcript):",
    `  Clarity: jargon ${c.jargonRatePerMinute}/min (target <1) | assumed-context ${c.assumedContextMarkers} | sentence complexity ${c.sentenceComplexityIndex} clauses/sentence (target <2.0) | abstraction-without-example ${c.abstractionMarkerCount}`,
    `  Structure: transitions ${s.transitionMarkerCount} (rate ${s.transitionMarkerRate}/min, target ≥3 per minute) | opening-position ${s.openingPositionScore}/100 | hierarchy markers ${s.pointHierarchyMarkers} | arc opening=${arc.clearOpening ? "Y" : "N"} middle=${arc.developedMiddle ? "Y" : "N"} close=${arc.definitiveClose ? "Y" : "N"}`,
    `  Conciseness: hedge ${cn.hedgeRatePerMinute}/min (target <1) | n-gram repetition ${cn.repetitionScore} (target <0.20) | words-per-distinct-idea ${cn.wordsPerDistinctIdea} (target <25)`,
    `  Thinking Quality: claim-support ${(t.claimSupportRate * 100).toFixed(0)}% (target >70%) | counterargument ${t.counterargumentMarkers} | depth markers ${t.depthOfAnalysisMarkers} | honesty markers ${t.intellectualHonestyMarkers}`,
    "",
    "If your dimension score disagrees with the signal-implied score by more than 10 points, justify the disagreement in the dimension's `signals` array.",
  ].join("\n");
}
