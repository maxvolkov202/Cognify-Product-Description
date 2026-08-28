/**
 * Grading plan WS5 — deterministic Tone core from Praat prosody features.
 *
 * Tone grades the VOICE (PRD: vocal expressiveness — pitch variation,
 * downward inflection on statements, volume dynamics, articulation). When
 * the prosody worker measured the audio, those measurements set the core
 * score here; the model writes the narrative and may adjust within ±10 for
 * context (score-shared assembleRepScore, behind FF_TONE_PROSODY_CORE).
 *
 * Worker contract (infra/prosody-worker/main.py): pitch std/range are in
 * semitones; `monotoneRatio` is DERIVED from pitch std (1.0 at ≤1.5 st,
 * 0.0 at ≥4.5 st) so it is not a second signal; `rmsMean`/`rmsStd` are
 * Praat intensity in dB (std ≈ 4-10 dB is normal speech); upspeak and
 * articulation are 0-1.
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
  /** Pitch variability (std + range in semitones): the main signal. The
   *  worker's monotoneRatio is a function of the same std, so it is not
   *  counted again. */
  variety: number;
  /** Upspeak ratio (rising inflection on statements). */
  upspeakPenalty: number;
  /** Volume dynamics: intensity std in dB. */
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
// Tuned so that with ordinary modifiers (volume std ~6 dB, articulation
// ~0.7, no upspeak → about +7) the totals land on the prompt's bands:
// 0.25 st ≈ 33, 1 st ≈ 43, 2.5 st ≈ 63, 3 st ≈ 72, 4 st ≈ 81.
const PITCH_STD_TO_VARIETY: readonly Anchor[] = [
  [0.25, 26],
  [0.75, 32],
  [1.0, 36],
  [2.0, 49],
  [2.5, 56],
  [3.0, 65],
  [4.0, 74],
  [5.5, 80],
];
const UPSPEAK_TO_PENALTY: readonly Anchor[] = [
  [0.15, 0],
  [0.3, 8],
  [0.45, 18],
  [0.6, 25],
];
/** Intensity std (dB) → dynamics modifier. Below 2 dB is locked-flat
 *  volume (the tone knowledge rule); 4 dB is ordinary; 7-10 dB is lively. */
const RMS_STD_DB_TO_DYNAMICS: readonly Anchor[] = [
  [2, -6],
  [4, 0],
  [7, 5],
  [10, 8],
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
  // A wide range with a modest std still means the voice moves; give a
  // small lift so a speaker with a few strong emphases is not read as flat.
  if (range != null && range >= 8 && pitchStd < 3) variety += 4;

  const upspeak = finiteOrNull(features.upspeakRatio);
  const upspeakPenalty = upspeak != null ? interp(upspeak, UPSPEAK_TO_PENALTY) : 0;
  const rmsStdDb = finiteOrNull(features.rmsStd);
  const dynamics = rmsStdDb != null ? interp(rmsStdDb, RMS_STD_DB_TO_DYNAMICS) : 0;
  const artic = finiteOrNull(features.articulationScore);
  const articulation = artic != null ? interp(artic, ARTICULATION_TO_MOD) : 0;

  const raw = variety - upspeakPenalty + dynamics + articulation;
  const score = Math.max(20, Math.min(95, Math.round(raw)));
  const evidence = [
    `pitch std ${pitchStd.toFixed(2)} st`,
    range != null ? `range ${range.toFixed(1)} st` : null,
    upspeak != null ? `upspeak ${(upspeak * 100).toFixed(0)}%` : null,
    rmsStdDb != null ? `volume std ${rmsStdDb.toFixed(1)} dB` : null,
    artic != null ? `articulation ${(artic * 100).toFixed(0)}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return {
    score,
    subScores: { variety, upspeakPenalty, dynamics, articulation },
    evidence,
  };
}

/** Plain-language Tone sentence from the measurements, used when the
 *  model's narrative explains a number the core has replaced. */
export function buildToneFeedback(features: ProsodyFeatures): string {
  const std = features.pitchStdSemitones ?? 0;
  const pitch =
    std >= 3
      ? "Your pitch moved well across the answer"
      : std >= 1.5
        ? "Your pitch moved a little but stayed mostly level"
        : "Your pitch barely moved, so the delivery sounded flat";
  const extras: string[] = [];
  if ((features.upspeakRatio ?? 0) > 0.3) extras.push("statements kept rising at the end like questions");
  if (features.rmsStd != null && features.rmsStd < 2) extras.push("your volume stayed at one level");
  if (features.articulationScore != null && features.articulationScore < 0.5) extras.push("word endings were soft");
  const action =
    std < 3
      ? "Land the key words harder and let the pitch drop at the end of each statement."
      : (features.upspeakRatio ?? 0) > 0.3
        ? "Finish statements on a falling note so they sound decided."
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
