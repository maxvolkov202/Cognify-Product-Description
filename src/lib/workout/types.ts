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
  /** PRD v3 Phase 2.2 — Exercise Framework fields surfaced to the shell.
   *  Null for pre-enrichment catalog rows; the UI falls back to rule/why
   *  and the ADR-001 default window. */
  objective: z.string().nullable().default(null),
  responseWindow: z
    .object({ minSec: z.number(), maxSec: z.number() })
    .nullable()
    .default(null),
  /** I-7 (PRD §8.5.3 step 4) — non-null when responseWindow was
   *  adaptively tightened (profile dim estimate ≥80) or loosened
   *  (confidence-builder day). Optional (not defaulted) for the same
   *  reason as recentFocus below: existing ShellStation literal
   *  constructors stay valid; absent ≡ null ≡ window as authored. */
  windowAdjusted: z.enum(["tightened", "loosened"]).nullable().optional(),
  /** ADR-001 Decision 2 — the framework's constraint types (time |
   *  structure | tone | complexity | none), revealed on the insight
   *  screen so the rep's "one primary constraint" is explicit. */
  constraintTypes: z.array(z.string()).nullable().default(null),
  /** Phase 11.D2 — Lab Engine V1 Coach's Insight. When set, it leads on
   *  the Insight screen; rule/objective become the enforcement lines. */
  coachInsight: z.string().nullable().default(null),
  /** I5 (PRD §8.6.4) — the user's most recent Coach's Focus on this
   *  station's dimension (coaching_events), rendered as one quiet
   *  "last time" line on the Insight screen. Optional (not defaulted)
   *  so existing ShellStation literal constructors stay valid. */
  recentFocus: z
    .object({ text: z.string(), verdict: z.string().nullable() })
    .nullable()
    .optional(),
});
export type ShellStation = z.infer<typeof StationSchema>;

/** The bottom-half panel knows which "phase" of the rep we're in. */
export const SessionPhaseSchema = z.enum([
  "idle", // pre-workout, "Start workout" button
  "prompt-selecting", // Phase 6 picker (stubbed in shell)
  "insight", // PRD v3 engine — Coach's Insight + constraint reveal (post-pick)
  "recording", // mic active
  "transcribing", // post-record, awaiting transcript
  "scoring", // Stage 1+2 running
  "score-reveal", // results visible
  "improvement-review", // PRD v3 engine — retry vs first-rep comparison
  "walking", // mascot moving between stations
  "day-complete-prompt", // "Want a graduation rep?"
  "graduation-rep", // pressure rep
  "day-complete", // all reps done
  "quit-summary", // PRD v3 engine — early exit w/ real-life tip (C9)
  "paused", // user paused
]);
export type SessionPhase = z.infer<typeof SessionPhaseSchema>;

/** Which learning loop the session machine runs.
 *  - "v1": legacy muscle-group flow (one rep per station).
 *  - "v2": PRD Universal Training Engine (Insight → First Rep → Feedback →
 *    required Retry → Improvement Review). Chosen server-side from
 *    isTrainingEngineV2Enabled() and passed into the machine so the
 *    reducer stays pure/flag-agnostic. */
export const LoopVariantSchema = z.enum(["v1", "v2"]);
export type LoopVariant = z.infer<typeof LoopVariantSchema>;

/** Attempt position within one exercise's learning loop. */
export const AttemptKindSchema = z.enum(["first", "retry", "again"]);
export type AttemptKind = z.infer<typeof AttemptKindSchema>;

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
  /** Active practice_sessions.id — what reps.session_id actually FKs.
   *  Phase 12 F-4: passing workoutSessionId into saveRep FK-failed EVERY
   *  resumed-day rep save silently. */
  practiceSessionId: z.string().uuid().nullable(),
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
  /** Phase 10 — engagement-loop signals for the header pill. */
  streakDays: z.number().int().nullable(),
  streakFreezes: z.number().int().nullable(),
  /** Sparse: only present once today's day is complete. */
  todaysComposite: z.number().nullable(),
  rationale: z.string().nullable(),
  /** Whether the user has completed onboarding (vertical set). Drives
   *  the personalize-toggle default — onboarded users get personalize=ON
   *  by default since they took the time to fill it in. localStorage
   *  override still wins if the user explicitly chose. */
  hasPersonalizationProfile: z.boolean().default(false),
  /** Surfaced label for the toggle. e.g. "Law · Partner/GC · Negotiation". */
  personalizationSummary: z.string().nullable().default(null),
  /** UI overhaul Phase 10 — whether the General|Personalized switch is
   *  exposed. Resolved server-side from isWorkoutPersonalizeSwitchEnabled().
   *  When false (the shipped prod state) the shell hides the switch and
   *  forces personalize=false (general, vertical-neutral prompts). Defaults
   *  true so the switch shows if a caller forgets to set it (pre-P10 behavior). */
  personalizeSwitchEnabled: z.boolean().default(true),
  /** UI overhaul Phase 5 (5.3/5.4) — whether the Suggested Framework strip
   *  exposes shuffle + inline edit. Resolved server-side from
   *  isRepFrameworkEditEnabled(). Display-only affordance (the framework never
   *  reaches scoring); defaults false so a caller that forgets to set it gets
   *  the plain read-only strip. */
  repFrameworkEditEnabled: z.boolean().default(false),
  /** PRD v3 engine — which learning loop the session machine runs.
   *  Resolved server-side from isTrainingEngineV2Enabled(). */
  loopVariant: LoopVariantSchema.default("v1"),
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
  practiceSessionId: null,
  previousDayComposite: null,
  lastDay: null,
  streakDays: null,
  streakFreezes: null,
  todaysComposite: null,
  rationale: null,
  hasPersonalizationProfile: false,
  personalizationSummary: null,
  personalizeSwitchEnabled: true,
  repFrameworkEditEnabled: false,
  loopVariant: "v1",
};
