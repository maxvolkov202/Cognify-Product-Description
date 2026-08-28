/**
 * Grading plan WS5 — deterministic Tone core from Praat prosody features.
 *
 * Tone grades the VOICE (PRD: vocal expressiveness — pitch variation,
 * downward inflection on statements, volume dynamics, articulation). When
 * the prosody worker measured the audio, those measurements set the core
 * score here; the model writes the narrative and may adjust within ±10 for
 * context (score-shared applyHybridLayer, behind FF_TONE_PROSODY_CORE).
 * When there is no audio, this returns null and Tone stays with the model,
 * tagged text-only in the UI.
 *
 * Field names here are the ones the PROSODY block shows the model
 * (`pitchStdSemitones`, `pitchRangeSemitones`, `monotoneRatio`,
 * `upspeakRatio`, `rmsMean`/`rmsStd`, `articulationScore`) — the audit found
 * the tone knowledge MD cited fields that do not exist.
 */
import type { ProsodyFeatures } from "@/lib/audio/prosody";

export type ToneCoreSubScores = {
  /** Pitch variability (std + range in semitones): the main signal. */
  variety: number;
  /** Monotone ratio (share of speech with sustained flat pitch). */
  monotonePenalty: number;
  /** Upspeak ratio (rising inflection on statements). */
  upspeakPenalty: number;
  /** Volume dynamics (rms std relative to rms mean). */
  dynamics: number;
  /** Articulation score 0-1. */
  articulation: number;
};

export type ToneCoreResult = {
  score: number;
  subScores: ToneCoreSubScores;
  /** One line of evidence for logs / signals. */
  evidence: string;
};

type Anchor = readonly [x: number, y: number];
function interp(x: number, anchors: readonly Anchor[]): number {
  const first = anchors[0]!;
  const last = anchors[anchors.length - 1]!;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1]!;
    const [x1, y1] = anchors[i]!;
    if (x <= x1) return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
  }
  return last[1];
}

/** Pitch std (semitones) → variety core. The prompt rule maps ≥3 st with
 *  low monotone to 70-85 and <1 st to ≤45; this curve is the same map. */
const PITCH_STD_TO_VARIETY: readonly Anchor[] = [
  [0.25, 28],
  [0.75, 38],
  [1.0, 44],
  [2.0, 60],
  [3.0, 74],
  [4.0, 82],
  [5.5, 88],
];
const MONOTONE_TO_PENALTY: readonly Anchor[] = [
  [0.1, -4], // very little flat speech: small lift
  [0.2, 0],
  [0.4, 10],
  [0.6, 22],
  [0.8, 32],
];
const UPSPEAK_TO_PENALTY: readonly Anchor[] = [
  [0.15, 0],
  [0.3, 8],
  [0.45, 18],
  [0.6, 25],
];
/** rms std / rms mean (coefficient of variation) → dynamics modifier. */
const RMS_CV_TO_DYNAMICS: readonly Anchor[] = [
  [0.1, -6],
  [0.2, 0],
  [0.4, 5],
  [0.6, 8],
];
const ARTICULATION_TO_MOD: readonly Anchor[] = [
  [0.3, -6],
  [0.5, 0],
  [0.7, 4],
  [0.9, 6],
];

/** Praat fields present (pitch std is the one that matters; Hume-only
 *  bundles return null and stay with the model). */
export function hasToneCoreEvidence(features: ProsodyFeatures | null): boolean {
  return features != null && features.pitchStdSemitones != null;
}

export function scoreToneFromProsody(
  features: ProsodyFeatures | null,
): ToneCoreResult | null {
  if (!features || features.pitchStdSemitones == null) return null;
  const pitchStd = features.pitchStdSemitones;
  const range = features.pitchRangeSemitones ?? null;
  let variety = interp(pitchStd, PITCH_STD_TO_VARIETY);
  // A wide range with a modest std still means the voice moves; give a
  // small lift so a speaker with a few strong emphases is not read as flat.
  if (range != null && range >= 8 && pitchStd < 3) variety += 4;

  const monotonePenalty =
    features.monotoneRatio != null ? interp(features.monotoneRatio, MONOTONE_TO_PENALTY) : 0;
  const upspeakPenalty =
    features.upspeakRatio != null ? interp(features.upspeakRatio, UPSPEAK_TO_PENALTY) : 0;
  const rmsCv =
    features.rmsMean != null && features.rmsStd != null && features.rmsMean > 0
      ? features.rmsStd / features.rmsMean
      : null;
  const dynamics = rmsCv != null ? interp(rmsCv, RMS_CV_TO_DYNAMICS) : 0;
  const articulation =
    features.articulationScore != null ? interp(features.articulationScore, ARTICULATION_TO_MOD) : 0;

  const raw = variety - monotonePenalty - upspeakPenalty + dynamics + articulation;
  const score = Math.max(20, Math.min(95, Math.round(raw)));
  const evidence = [
    `pitch std ${pitchStd.toFixed(2)} st`,
    range != null ? `range ${range.toFixed(1)} st` : null,
    features.monotoneRatio != null ? `monotone ${(features.monotoneRatio * 100).toFixed(0)}%` : null,
    features.upspeakRatio != null ? `upspeak ${(features.upspeakRatio * 100).toFixed(0)}%` : null,
    rmsCv != null ? `volume cv ${rmsCv.toFixed(2)}` : null,
    features.articulationScore != null ? `articulation ${(features.articulationScore * 100).toFixed(0)}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return {
    score,
    subScores: { variety, monotonePenalty, upspeakPenalty, dynamics, articulation },
    evidence,
  };
}

/** Model narrative may move the measured core by at most this much. */
export const TONE_LLM_ADJUST_MAX = 10;

/** Final tone when the core exists: the measurement, adjusted toward the
 *  model's score by at most ±TONE_LLM_ADJUST_MAX. */
export function blendToneWithModel(core: number, llm: number | undefined): number {
  if (llm == null || !Number.isFinite(llm)) return core;
  const delta = Math.max(-TONE_LLM_ADJUST_MAX, Math.min(TONE_LLM_ADJUST_MAX, llm - core));
  return Math.round(core + delta);
}
