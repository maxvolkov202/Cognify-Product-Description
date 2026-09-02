/**
 * Grading plan WS5 — deterministic Tone core from Praat prosody features.
 *
 * Tone grades the VOICE (PRD: vocal expressiveness — pitch variation,
 * downward inflection on statements, volume dynamics, articulation). When
 * the prosody worker measured the audio, those measurements set the core
 * score here; the model writes the narrative and may adjust within ±10 for
 * context (score-shared assembleRepScore, behind FF_TONE_PROSODY_CORE).
 *
 * v2 (prosody-v2 plan P3, worker contract main_v2.py): `monotoneRatio` is
 * truly WINDOWED (share of 1s windows under 1.5 st) and counts as an
 * INDEPENDENT signal alongside pitch std; upspeak prefers the scoring-time
 * ALIGNED ratio (statement ends ∩ segment tails) over the silence heuristic;
 * `finalFallRatio` (falling statement endings) earns a small bonus — on the
 * PSOLA fixtures it separates flat (≈0) from expressive (0.5-1.0) cleanly.
 * Curves are anchored to the measured 2026-09-02 distributions: fixture
 * ground truth (tests/fixtures/audio-grading/features-v2.json) + the
 * 100-rep in-system sweep (rmsStd p50 ≈ 22 dB on this measurement's scale,
 * articulation proxy p50 ≈ 0.13 — its weight is halved pending validation).
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
  /** Pitch variability (std in semitones): the main signal. */
  variety: number;
  /** Windowed monotone share — independent of global std in v2: a voice can
   *  have expressive bursts (high std) yet stay flat most of the time. */
  monotonePenalty: number;
  /** Upspeak (aligned ratio preferred; silence-heuristic fallback). */
  upspeakPenalty: number;
  /** Falling statement endings — decided, confident contours. */
  finalFallBonus: number;
  /** Volume dynamics: intensity std in dB. */
  dynamics: number;
  /** Articulation proxy, weight halved pending validation. */
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

/** Pitch std (semitones) → variety core. v2 anchors: fixture flat clips are
 *  0.07-0.25 st (→ floor), expressive 2.9-3.4 (→ 65-70 before modifiers);
 *  in-system v2 sweep runs p10 1.6 / p50 3.1 / p90 4.2. */
const PITCH_STD_TO_VARIETY: readonly Anchor[] = [
  [0.25, 22],
  [0.75, 30],
  [1.5, 42],
  [2.0, 50],
  [2.5, 58],
  [3.0, 66],
  [3.5, 72],
  [4.5, 78],
  [5.5, 80],
];
/** Windowed monotone share → penalty. In-system p50 is 0.41 (≈ −1.6), p90
 *  0.88 (≈ −12); a fully-flat voice (fixtures: 1.0) pays the full −14. */
const MONOTONE_TO_PENALTY: readonly Anchor[] = [
  [0.3, 0],
  [0.5, 3],
  [0.7, 7],
  [0.85, 11],
  [1.0, 14],
];
/** Below 0.2 the silence-heuristic ratio is noise (TTS fixtures with ZERO
 *  aligned upspeak still read up to 0.25 raw); the aligned ratio, when
 *  present, is the trusted input. */
const UPSPEAK_TO_PENALTY: readonly Anchor[] = [
  [0.2, 0],
  [0.35, 8],
  [0.5, 18],
  [0.65, 25],
];
const FINAL_FALL_TO_BONUS: readonly Anchor[] = [
  [0, 0],
  [0.25, 2],
  [0.5, 4],
  [0.8, 6],
];
/** Intensity std (dB) → dynamics modifier, anchored to the MEASURED scale
 *  of this worker (50ms windows incl. silence dips: in-system p10 14,
 *  p50 22, p90 45 — v1's 2-10 dB anchors were an order off). */
const RMS_STD_DB_TO_DYNAMICS: readonly Anchor[] = [
  [8, -4],
  [14, -1],
  [20, 0],
  [26, 2],
  [40, 4],
];
/** Articulation proxy re-anchored to observed values (p50 0.13) and halved
 *  in weight (±3 vs the old ±6): a crude high-frequency-energy heuristic. */
const ARTICULATION_TO_MOD: readonly Anchor[] = [
  [0, -3],
  [0.05, -2],
  [0.15, 0],
  [0.3, 2],
  [0.5, 3],
];

/** Praat fields present (pitch std is the one that matters; Hume-only
 *  bundles return null and stay with the model). */
export function hasToneCoreEvidence(features: ProsodyFeatures | null): boolean {
  return features != null && features.pitchStdSemitones != null;
}

const finiteOrNull = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

export function scoreToneFromProsody(
  features: ProsodyFeatures | null,
): ToneCoreResult | null {
  if (!features) return null;
  const pitchStd = finiteOrNull(features.pitchStdSemitones);
  if (pitchStd == null) return null;
  const range = finiteOrNull(features.pitchRangeSemitones);
  let variety = interp(pitchStd, PITCH_STD_TO_VARIETY);
  // A wide cleaned range with a modest std still means the voice moves; the
  // v2 cleaned range runs 17-19 st on expressive clips (one flat fixture
  // reaches 10.9), so the lift starts at 12.
  if (range != null && range >= 12 && pitchStd < 3) variety += 4;

  const monotone = finiteOrNull(features.monotoneRatio);
  const monotonePenalty = monotone != null ? interp(monotone, MONOTONE_TO_PENALTY) : 0;
  const upspeak =
    finiteOrNull(features.upspeakRatioAligned) ?? finiteOrNull(features.upspeakRatio);
  const upspeakPenalty = upspeak != null ? interp(upspeak, UPSPEAK_TO_PENALTY) : 0;
  const finalFall =
    finiteOrNull(features.finalFallRatioAligned) ?? finiteOrNull(features.finalFallRatio);
  const finalFallBonus = finalFall != null ? interp(finalFall, FINAL_FALL_TO_BONUS) : 0;
  const rmsStdDb = finiteOrNull(features.rmsStd);
  const dynamics = rmsStdDb != null ? interp(rmsStdDb, RMS_STD_DB_TO_DYNAMICS) : 0;
  const artic = finiteOrNull(features.articulationScore);
  const articulation = artic != null ? interp(artic, ARTICULATION_TO_MOD) : 0;

  const raw =
    variety - monotonePenalty - upspeakPenalty + finalFallBonus + dynamics + articulation;
  const score = Math.max(20, Math.min(95, Math.round(raw)));
  const evidence = [
    `pitch std ${pitchStd.toFixed(2)} st`,
    monotone != null ? `monotone ${(monotone * 100).toFixed(0)}%` : null,
    upspeak != null ? `upspeak ${(upspeak * 100).toFixed(0)}%` : null,
    finalFall != null ? `falling finals ${(finalFall * 100).toFixed(0)}%` : null,
    rmsStdDb != null ? `volume std ${rmsStdDb.toFixed(1)} dB` : null,
    artic != null ? `articulation ${(artic * 100).toFixed(0)}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return {
    score,
    subScores: { variety, monotonePenalty, upspeakPenalty, finalFallBonus, dynamics, articulation },
    evidence,
  };
}

/** Plain-language Tone sentence from the measurements, used when the
 *  model's narrative explains a number the core has replaced. */
export function buildToneFeedback(features: ProsodyFeatures): string {
  const std = features.pitchStdSemitones ?? 0;
  const monotone = features.monotoneRatio ?? 0;
  const upspeak = features.upspeakRatioAligned ?? features.upspeakRatio ?? 0;
  const finalFall = features.finalFallRatioAligned ?? features.finalFallRatio ?? null;
  const pitch =
    std >= 3 && monotone <= 0.5
      ? "Your pitch moved well across the answer"
      : std >= 1.5 && monotone <= 0.85
        ? "Your pitch moved a little but stayed mostly level"
        : "Your pitch barely moved, so the delivery sounded flat";
  const extras: string[] = [];
  if (monotone > 0.85 && std >= 1.5) extras.push("long stretches stayed on one note");
  if (upspeak > 0.35) extras.push("statements kept rising at the end like questions");
  if (features.rmsStd != null && features.rmsStd < 10) extras.push("your volume stayed at one level");
  const action =
    upspeak > 0.35
      ? "Finish statements on a falling note so they sound decided."
      : std < 3 || monotone > 0.85
        ? "Land the key words harder and let the pitch drop at the end of each statement."
        : finalFall != null && finalFall >= 0.5
          ? "Keep that range and those decided endings; they carry the answer."
          : "Keep that vocal range; it is what makes the answer easy to listen to.";
  return `${pitch}${extras.length ? ", and " + extras.join(", ") : ""}. ${action}`;
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
