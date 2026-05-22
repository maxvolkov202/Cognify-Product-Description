// Phase 13 — voice-system types.

import type { MuscleGroupId } from "@/types/domain";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "late-night";

export type ScoreBandKey = "poor" | "below" | "ok" | "strong" | "excellent";

export type DeltaBand =
  | "first-ever"
  | "regression"
  | "flat"
  | "improvement"
  | "breakthrough";

export type RepFeelBucket = "neutral" | "strong-rep" | "weak-rep";

export type ErrorReason =
  | "no_transcript"
  | "too_short"
  | "scoring_failed"
  | "timeout"
  | "unknown";

/** Context passed into pickVoiceLine. Optional fields are bucket-specific
 *  — the picker resolves the right sub-array based on what's set. */
export type VoiceCtx = {
  userId?: string;
  /** Date stamp YYYY-MM-DD used by the seeded shuffle. Defaults to today. */
  dateKey?: string;
  firstName?: string | null;
  timeOfDay?: TimeOfDay;
  band?: ScoreBandKey;
  deltaBand?: DeltaBand;
  feel?: RepFeelBucket;
  dim?: MuscleGroupId;
  exerciseId?: string;
  exerciseSlug?: string;
  /** First rep of the day vs later. */
  firstOfDay?: boolean;
  /** Reason code for error fallbacks. */
  errorReason?: ErrorReason;
  /** Slots for templated lines. */
  slots?: Record<string, string | number | null | undefined>;
};
