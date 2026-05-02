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
import type { SubSkillId } from "@/types/sub-skills";
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
    "SIGNALS (objective text-derived measurements — score the four LLM-scored content dimensions PRIMARILY against these numbers; the transcript is for verification + bullet grounding only):",
    `  Clarity: jargon ${c.jargonRatePerMinute}/min (target <1) | assumed-context ${c.assumedContextMarkers} | sentence complexity ${c.sentenceComplexityIndex} clauses/sentence (target <2.0) | abstraction-without-example ${c.abstractionMarkerCount}`,
    `  Structure: transitions ${s.transitionMarkerCount} (rate ${s.transitionMarkerRate}/min, target ≥3 per minute) | opening-position ${s.openingPositionScore}/100 | hierarchy markers ${s.pointHierarchyMarkers} | arc opening=${arc.clearOpening ? "Y" : "N"} middle=${arc.developedMiddle ? "Y" : "N"} close=${arc.definitiveClose ? "Y" : "N"}`,
    `  Conciseness: hedge ${cn.hedgeRatePerMinute}/min (target <1) | n-gram repetition ${cn.repetitionScore} (target <0.20) | words-per-distinct-idea ${cn.wordsPerDistinctIdea}`,
    `  Thinking Quality: claim-support ${(t.claimSupportRate * 100).toFixed(0)}% (target >70%) | counterargument ${t.counterargumentMarkers} | depth markers ${t.depthOfAnalysisMarkers} | honesty markers ${t.intellectualHonestyMarkers}`,
    "",
    "Use the signals as your PRIMARY scoring input for clarity, structure, conciseness, and thinking_quality. Read the transcript to verify, to ground bullet quotes, and to catch context the regex extractors miss (e.g. circular reasoning that contains the word \"because\" but provides no real support). If your dimension score disagrees with the signal-implied score by more than 10 points, name the specific override reason in the dimension's `signals` array (e.g. \"signpost rate 0/min looks low, but the speaker uses implicit narrative structure end-to-end\").",
  ].join("\n");
}

// ——— Storage encode / decode ————————————————————————————————

/**
 * Persisted shape for the `dimension_scores.signals` jsonb column.
 *
 * Two on-disk shapes coexist:
 *
 *  - **Legacy** (pre-Ch.11): the LLM's narrative signals only, stored
 *    as a plain `string[]`. Reps written before this chapter — and
 *    reps written by FF-off code paths — use this shape.
 *  - **v3.1 (Ch.11c)**: an object carrying both narratives AND the per-
 *    sub-skill scores from `mapSignalsToSubSkillScores`. Used whenever
 *    a `DimensionScore` carries a `subSkillScores` field.
 *
 * Readers must accept both shapes — see `decodeDimensionSignals`.
 */
export type DimensionSignalsBlob =
  | string[]
  | {
      narratives: string[];
      subSkillScores: Partial<Record<SubSkillId, number>>;
    };

/** Encode a `DimensionScore`'s `signals` + optional `subSkillScores` for
 *  persistence in the `dimension_scores.signals` jsonb column. Falls
 *  back to the legacy `string[]` shape when no sub-skill scores are
 *  present, so legacy code paths keep producing the legacy on-disk
 *  shape and back-compat is preserved. */
export function encodeDimensionSignals(
  narratives: readonly string[],
  subSkillScores?: Partial<Record<SubSkillId, number>>,
): DimensionSignalsBlob {
  if (
    subSkillScores &&
    Object.keys(subSkillScores).length > 0
  ) {
    return {
      narratives: [...narratives],
      subSkillScores: { ...subSkillScores },
    };
  }
  return [...narratives];
}

/** Decode the `dimension_scores.signals` jsonb back into narratives +
 *  optional sub-skill scores. Robust to legacy `string[]` rows. */
export function decodeDimensionSignals(value: unknown): {
  narratives: string[];
  subSkillScores?: Partial<Record<SubSkillId, number>>;
} {
  if (Array.isArray(value)) {
    return { narratives: value.filter((v): v is string => typeof v === "string") };
  }
  if (value && typeof value === "object" && "narratives" in value) {
    const obj = value as {
      narratives?: unknown;
      subSkillScores?: unknown;
    };
    const narratives = Array.isArray(obj.narratives)
      ? obj.narratives.filter((v): v is string => typeof v === "string")
      : [];
    const sub =
      obj.subSkillScores && typeof obj.subSkillScores === "object"
        ? (obj.subSkillScores as Partial<Record<SubSkillId, number>>)
        : undefined;
    return sub ? { narratives, subSkillScores: sub } : { narratives };
  }
  return { narratives: [] };
}
