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
import { preferredFinalFallRatio, type ProsodyFeatures } from "@/lib/audio/prosody";

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
  /** Pre-clamp sum — gates assert margins on this so a retune that erodes
   *  flat detection cannot hide behind the [20,95] clamp. */
  raw: number;
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
/** The two upspeak estimators run on different scales, so each gets its own
 *  curve: the ALIGNED ratio (statement ends ∩ tails, ≥2 declaratives) is
 *  trusted from 0.1; the silence-heuristic RAW fallback reads up to 0.25 on
 *  clips with ZERO aligned upspeak, so it is uncharged below 0.3. */
const ALIGNED_UPSPEAK_TO_PENALTY: readonly Anchor[] = [
  [0.1, 0],
  [0.25, 8],
  [0.45, 18],
  [0.6, 25],
];
const RAW_UPSPEAK_TO_PENALTY: readonly Anchor[] = [
  [0.3, 0],
  [0.45, 8],
  [0.6, 18],
  [0.75, 25],
];
/** Falling statement finals. The raw variant is produced by the same noisy
 *  segmentation as raw upspeak, so its bonus is damped. */
const ALIGNED_FINAL_FALL_TO_BONUS: readonly Anchor[] = [
  [0, 0],
  [0.25, 2],
  [0.5, 4],
  [0.8, 6],
];
const RAW_FINAL_FALL_TO_BONUS: readonly Anchor[] = [
  [0, 0],
  [0.5, 2],
  [0.8, 3],
];
/** Intensity std (dB), anchored to the MEASURED scale of this worker (50ms
 *  windows INCLUDING silence dips: in-system p10 14 / p50 22 / p90 45).
 *  Honest note: on this measurement the statistic is dominated by
 *  speech-vs-silence contrast, not vocal volume dynamics — the PSOLA
 *  constant-volume fixtures read 16-21 dB — so its weight is small (±2)
 *  pending a real dynamics measure (voiced-only intensity std). */
const RMS_STD_DB_TO_DYNAMICS: readonly Anchor[] = [
  [8, -2],
  [14, 0],
  [26, 1],
  [40, 2],
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

/** Windowed monotone counts as an independent signal ONLY when the worker
 *  explicitly marked it windowed. Strict opt-in: v1 rows (no flag) derived it
 *  from the same std the variety curve charges, worker v2's short-clip
 *  fallback marks false, and interim v2 cache rows warmed before the flag
 *  shipped stay uncharged rather than risk the double-count. */
export function hasWindowedMonotone(features: ProsodyFeatures): boolean {
  return features.monotoneWindowed === true;
}

export function scoreToneFromProsody(
  features: ProsodyFeatures | null,
): ToneCoreResult | null {
  if (!features) return null;
  const pitchStd = finiteOrNull(features.pitchStdSemitones);
  if (pitchStd == null) return null;
  const variety = interp(pitchStd, PITCH_STD_TO_VARIETY);

  const monotone = finiteOrNull(features.monotoneRatio);
  const monotoneIsIndependent = hasWindowedMonotone(features);
  const monotonePenalty =
    monotone != null && monotoneIsIndependent ? interp(monotone, MONOTONE_TO_PENALTY) : 0;

  const upspeakAligned = finiteOrNull(features.upspeakRatioAligned);
  const upspeakRaw = finiteOrNull(features.upspeakRatio);
  const upspeakPenalty =
    upspeakAligned != null
      ? interp(upspeakAligned, ALIGNED_UPSPEAK_TO_PENALTY)
      : upspeakRaw != null
        ? interp(upspeakRaw, RAW_UPSPEAK_TO_PENALTY)
        : 0;
  const fallAligned = finiteOrNull(features.finalFallRatioAligned);
  const fallRaw = finiteOrNull(features.finalFallRatio);
  const finalFallBonus =
    fallAligned != null
      ? interp(fallAligned, ALIGNED_FINAL_FALL_TO_BONUS)
      : fallRaw != null
        ? interp(fallRaw, RAW_FINAL_FALL_TO_BONUS)
        : 0;
  const rmsStdDb = finiteOrNull(features.rmsStd);
  const dynamics = rmsStdDb != null ? interp(rmsStdDb, RMS_STD_DB_TO_DYNAMICS) : 0;
  const artic = finiteOrNull(features.articulationScore);
  const articulation = artic != null ? interp(artic, ARTICULATION_TO_MOD) : 0;

  const raw =
    variety - monotonePenalty - upspeakPenalty + finalFallBonus + dynamics + articulation;
  const score = Math.max(20, Math.min(95, Math.round(raw)));
  const upspeakShown = upspeakAligned ?? upspeakRaw;
  const fallShown = fallAligned ?? fallRaw;
  const evidence = [
    `pitch std ${pitchStd.toFixed(2)} st`,
    monotone != null ? `monotone ${(monotone * 100).toFixed(0)}%${monotoneIsIndependent ? "" : " (std-derived)"}` : null,
    upspeakShown != null ? `upspeak ${(upspeakShown * 100).toFixed(0)}%${upspeakAligned != null ? " (aligned)" : ""}` : null,
    fallShown != null ? `falling finals ${(fallShown * 100).toFixed(0)}%${fallAligned != null ? " (aligned)" : ""}` : null,
    rmsStdDb != null ? `volume std ${rmsStdDb.toFixed(1)} dB` : null,
    artic != null ? `articulation ${(artic * 100).toFixed(0)}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return {
    score,
    raw,
    subScores: { variety, monotonePenalty, upspeakPenalty, finalFallBonus, dynamics, articulation },
    evidence,
  };
}

/** The pitch-variety tiers, on the SAME cuts the scoring curves use. Exported
 *  so display surfaces (the measured-delivery strip) can never disagree with
 *  the feedback tiers — one definition, several consumers. */
export function classifyPitchVariety(
  features: Pick<ProsodyFeatures, "pitchStdSemitones" | "monotoneRatio" | "monotoneWindowed" | "featureVersion">,
): "flat" | "level" | "varied" | null {
  const std = features.pitchStdSemitones;
  if (std == null || !Number.isFinite(std)) return null;
  const monotone = hasWindowedMonotone(features as ProsodyFeatures) ? (features.monotoneRatio ?? 0) : 0;
  if (monotone > 0.85 || std < 1.5) return "flat";
  if (monotone > 0.5 || std < 3) return "level";
  return "varied";
}

/** Plain-language Tone sentence from the measurements, used when the
 *  model's narrative explains a number the core has replaced. */
export function buildToneFeedback(features: ProsodyFeatures): string {
  const monotone = hasWindowedMonotone(features) ? (features.monotoneRatio ?? 0) : 0;
  const upspeakAligned = features.upspeakRatioAligned;
  const upspeak = upspeakAligned ?? features.upspeakRatio ?? 0;
  // Same noise floors as the scoring curves so the sentence never names a
  // behavior the score did not charge (and vice versa).
  const upspeaky = upspeakAligned != null ? upspeak > 0.1 : upspeak > 0.3;
  const finalFall = preferredFinalFallRatio(features);
  const tier = classifyPitchVariety(features);
  const flat = tier === "flat";
  const mid = tier === "level";
  const pitch = flat
    ? "Your pitch barely moved, so the delivery sounded flat"
    : mid
      ? "Your pitch moved a little but stayed mostly level"
      : "Your pitch moved well across the answer";
  const extras: string[] = [];
  if (mid && monotone > 0.5) extras.push("long stretches stayed on one note");
  if (upspeaky) extras.push("statements kept rising at the end like questions");
  if (features.rmsStd != null && features.rmsStd < 14) extras.push("your volume stayed at one level");
  const action = upspeaky
    ? "Finish statements on a falling note so they sound decided."
    : flat || mid
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
