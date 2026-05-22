// Shared types + Zod schemas for the muscle-group workout shell.
//
// Phase 5 ships these so the server/client boundary has a single
// contract. Phase 7's session runtime reads the same schema for state
// machine transitions. Phase 3's server actions return data that fits
// `WorkoutShellHydratedPayloadSchema`.

import { z } from "zod";
import { MUSCLE_GROUP_IDS, type MuscleGroupId } from "@/types/domain";

// Cast through a tuple literal so z.enum infers the literal-union type
// instead of widening to `string`.
const MUSCLE_GROUP_TUPLE = [...MUSCLE_GROUP_IDS] as [
  MuscleGroupId,
  ...MuscleGroupId[],
];
export const MuscleGroupIdSchema = z.enum(MUSCLE_GROUP_TUPLE);

export const StationStatusSchema = z.enum(["locked", "current", "complete"]);
export type StationStatus = z.infer<typeof StationStatusSchema>;

export const StationSchema = z.object({
  index: z.number().int().min(0).max(3),
  exerciseId: z.string().uuid(),
  exerciseSlug: z.string(),
  exerciseName: z.string(),
  rule: z.string(),
  why: z.string().nullable(),
  status: StationStatusSchema,
  /** When complete, the rep's composite score (0-100). */
  compositeScore: z.number().min(0).max(100).nullable(),
});
export type ShellStation = z.infer<typeof StationSchema>;

/** The bottom-half panel knows which "phase" of the rep we're in. */
export const SessionPhaseSchema = z.enum([
  "idle", // pre-workout, "Start workout" button
  "prompt-selecting", // Phase 6 picker (stubbed in shell)
  "recording", // mic active
  "transcribing", // post-record, awaiting transcript
  "scoring", // Stage 1+2 running
  "score-reveal", // results visible
  "walking", // mascot moving between stations
  "day-complete-prompt", // "Want a graduation rep?"
  "graduation-rep", // pressure rep
  "day-complete", // all reps done
  "paused", // user paused
]);
export type SessionPhase = z.infer<typeof SessionPhaseSchema>;

/** Snapshot of the active muscle-group day for the shell to render. */
export const WorkoutShellHydratedPayloadSchema = z.object({
  hasActiveDay: z.boolean(),
  dayId: z.string().uuid().nullable(),
  dimension: MuscleGroupIdSchema.nullable(),
  dayDate: z.string().nullable(),
  stations: z.array(StationSchema),
  sessionPhase: SessionPhaseSchema,
  currentStationIndex: z.number().int().min(0).max(3),
  /** Active workout_sessions.id. Required for prompt_selection_events FK. */
  workoutSessionId: z.string().uuid().nullable(),
  /** From the prior same-dim day; drives Phase 9's banner. */
  previousDayComposite: z.number().nullable(),
  /** Phase 9 — full prior-day comparison context. Supersedes
   *  previousDayComposite when present. */
  lastDay: z
    .object({
      lastComposite: z.number().nullable(),
      daysSince: z.number().int().min(0),
    })
    .nullable(),
  /** Sparse: only present once today's day is complete. */
  todaysComposite: z.number().nullable(),
  rationale: z.string().nullable(),
});
export type WorkoutShellHydratedPayload = z.infer<
  typeof WorkoutShellHydratedPayloadSchema
>;

/** Empty-day placeholder so the shell can render before the user starts
 *  today's workout. */
export const EMPTY_SHELL_PAYLOAD: WorkoutShellHydratedPayload = {
  hasActiveDay: false,
  dayId: null,
  dimension: null,
  dayDate: null,
  stations: [],
  sessionPhase: "idle",
  currentStationIndex: 0,
  workoutSessionId: null,
  previousDayComposite: null,
  lastDay: null,
  todaysComposite: null,
  rationale: null,
};
