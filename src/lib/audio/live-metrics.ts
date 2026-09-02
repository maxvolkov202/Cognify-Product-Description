/**
 * Prosody v2 Phase 4 — pure formatting for the "Measured delivery" strip.
 * Plain language only (PRD §11.3). Every number here is computed with the
 * SAME machinery the Delivery score uses — the scored filler lexicon, the
 * rate-measurable floor, the well-paced band, and tone-core's pitch tiers —
 * imported, never copied, so the strip cannot contradict the score.
 */
import type { ProsodyFeatures } from "./prosody";
import { countScoredFillers } from "@/lib/scoring/signals/audio";
import { RATE_MEASURABLE_MIN_MS, WELL_PACED_BAND } from "@/lib/scoring/deterministic";
import { classifyPitchVariety } from "@/lib/scoring/tone-core";

export type LiveDeliveryMetrics = {
  paceLabel: string;
  fillerLabel: string;
  pauseLabel: string | null;
};

export function buildLiveDeliveryMetrics(
  inline: ProsodyFeatures,
  input: { words: { word: string }[]; durationMs: number },
): LiveDeliveryMetrics {
  // The scorer refuses a rate verdict under 8s (neutral 85, "too short to
  // measure"); the strip must not pronounce one either.
  const paceLabel =
    input.durationMs < RATE_MEASURABLE_MIN_MS
      ? "Too short to measure a steady pace"
      : (() => {
          const wpm = inline.wordsPerMinute;
          const qualifier =
            wpm > WELL_PACED_BAND.max ? "fast" : wpm < WELL_PACED_BAND.min ? "unhurried" : "on pace";
          return `Pace ${Math.round(wpm)} wpm, ${qualifier} (well-paced is ${WELL_PACED_BAND.min}-${WELL_PACED_BAND.max})`;
        })();
  // Fillers via the SCORED lexicon (signals/audio.ts) — prosody-inline's own
  // broader list counts "like"/"so", which the Delivery feedback does not.
  const fillers = countScoredFillers(input.words.map((w) => w.word).join(" "));
  const minutes = input.durationMs / 60_000;
  const fillerLabel =
    fillers === 0
      ? "No fillers"
      : `${fillers} filler${fillers === 1 ? "" : "s"} (${(minutes > 0 ? fillers / minutes : 0).toFixed(1)} per minute)`;
  // Only LONG pauses are worth flagging — ordinary clause breaths are
  // credited by the pacing score, not criticized.
  const pauseLabel =
    inline.pauseDataAvailable === false
      ? null
      : inline.longPauseCount === 0
        ? "No long pauses"
        : `${inline.longPauseCount} long pause${inline.longPauseCount === 1 ? "" : "s"} (over 1.5s)`;
  return { paceLabel, fillerLabel, pauseLabel };
}

/** Copy for tone-core's pitch tiers (one definition of the tiers, there). */
export function describePitchVariety(
  pitchStdSemitones: number | null | undefined,
  monotoneRatio: number | null | undefined,
  monotoneWindowed: boolean | null | undefined,
): string | null {
  const tier = classifyPitchVariety({
    pitchStdSemitones: pitchStdSemitones ?? null,
    monotoneRatio: monotoneRatio ?? null,
    monotoneWindowed,
    featureVersion: 2,
  });
  if (tier === null) return null;
  return tier === "flat"
    ? "Pitch stayed flat"
    : tier === "level"
      ? "Pitch moved a little"
      : "Pitch varied well";
}
