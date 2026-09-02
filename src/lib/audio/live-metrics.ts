/**
 * Prosody v2 Phase 4 — pure formatting for the "Measured delivery" strip.
 * Plain language only (PRD §11.3): the numbers come from the same inline
 * extraction the scorer uses; the words here are for the user.
 */
import type { ProsodyFeatures } from "./prosody";

export type LiveDeliveryMetrics = {
  paceLabel: string;
  fillerLabel: string;
  pauseLabel: string | null;
};

/** The rubric's well-paced band (WS9: one band everywhere). */
export const PACE_BAND = { min: 130, max: 165 } as const;

export function buildLiveDeliveryMetrics(inline: ProsodyFeatures): LiveDeliveryMetrics {
  const wpm = Math.round(inline.wordsPerMinute);
  const paceQualifier =
    wpm > PACE_BAND.max ? "fast" : wpm < PACE_BAND.min ? "unhurried" : "on pace";
  const fillers = inline.fillerCount;
  return {
    paceLabel: `Pace ${wpm} wpm, ${paceQualifier} (well-paced is ${PACE_BAND.min}-${PACE_BAND.max})`,
    fillerLabel:
      fillers === 0
        ? "No fillers"
        : `${fillers} filler${fillers === 1 ? "" : "s"} (${inline.fillerRatePerMinute.toFixed(1)} per minute)`,
    pauseLabel:
      inline.pauseDataAvailable === false
        ? null
        : inline.pauseCount === 0
          ? "No long pauses"
          : `${inline.pauseCount} pause${inline.pauseCount === 1 ? "" : "s"}${inline.longPauseCount > 0 ? `, ${inline.longPauseCount} over 1.5s` : ""}`,
  };
}

/** Qualitative pitch-variety phrase from the warm cache's measurements.
 *  Same cuts as the tone core's curves so the strip never disagrees with
 *  the eventual score. */
export function describePitchVariety(
  pitchStdSemitones: number | null | undefined,
  monotoneRatio: number | null | undefined,
  monotoneWindowed: boolean | null | undefined,
): string | null {
  if (pitchStdSemitones == null || !Number.isFinite(pitchStdSemitones)) return null;
  const monotone = monotoneWindowed === true ? (monotoneRatio ?? 0) : 0;
  if (monotone > 0.85 || pitchStdSemitones < 1.5) return "Pitch stayed flat";
  if (monotone > 0.5 || pitchStdSemitones < 3) return "Pitch moved a little";
  return "Pitch varied well";
}
