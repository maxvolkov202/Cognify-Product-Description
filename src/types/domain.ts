// ——— Scoring dimensions (v3.0.0 rubric — DNA reconciliation 2026-05-01) ——
// Aligned with Cognify DNA spec (May 2026). Grouped into Content (what you
// said) and Delivery (how you said it). Tone replaces Adaptability per DNA;
// Delivery is now Pacing-flavored (rate, pauses, fillers). Historical reps
// with the legacy `adaptability` dimension are surfaced through
// `src/lib/scoring/dimension-aliases.ts` and rubricVersion < v3.

export const SKILL_DIMENSIONS = [
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "tone",
] as const;

export type SkillDimension = (typeof SKILL_DIMENSIONS)[number];

export const SKILL_DIMENSION_GROUPS = {
  content: ["clarity", "structure", "conciseness", "thinking_quality"],
  delivery: ["delivery", "tone"],
} as const satisfies Record<string, readonly SkillDimension[]>;

export type SkillDimensionGroup = keyof typeof SKILL_DIMENSION_GROUPS;

export const DIMENSION_LABELS: Record<SkillDimension, string> = {
  clarity: "Clarity",
  structure: "Structure",
  conciseness: "Conciseness",
  thinking_quality: "Thinking Quality",
  delivery: "Delivery",
  tone: "Tone",
};

export const DIMENSION_GROUP_LABELS: Record<SkillDimensionGroup, string> = {
  content: "Content",
  delivery: "Delivery",
};

/**
 * Per-dimension composite weights — Cognify DNA spec.
 * Single source of truth: composite math (score.ts), UI bars, calibration
 * harness all read from here. Sums to 1.00.
 */
export const DIMENSION_WEIGHTS: Record<SkillDimension, number> = {
  clarity: 0.25,
  structure: 0.2,
  thinking_quality: 0.2,
  conciseness: 0.15,
  delivery: 0.1,
  tone: 0.1,
};

/**
 * Score band definitions per DNA spec. The starting band for new users is
 * Competent (60-75); 95+ should be exceptional and trigger human review.
 * UI labels read from `label`, threshold checks from `min`/`max`. The
 * `description` field (Ch.13) is the user-visible band copy rendered
 * under the composite in ScoreHero — it answers "what does this score
 * actually mean about my rep?". Distinct from the per-dimension rubric
 * anchors in `src/lib/scoring/rubric-anchors.ts`, which guide the LLM
 * scoring path and live behind FF_BAND_ANCHORS.
 */
export const BAND_DEFINITIONS = [
  {
    id: "poor",
    label: "Poor",
    min: 0,
    max: 40,
    description:
      "The response missed the prompt or fundamental skills broke down. The listener was lost — clarity, structure, or thinking didn't land. This isn't where you stay; this is where the next rep starts.",
  },
  {
    id: "below_standard",
    label: "Below Standard",
    min: 40,
    max: 60,
    description:
      "Ideas were there but they didn't fully land. One or two skills carried the rep; one or two more dragged it down. The fix is usually structural — name the point, then build it.",
  },
  {
    id: "competent",
    label: "Competent",
    min: 60,
    max: 75,
    description:
      "A working response. The listener got the point. Polish on one specific skill — usually pacing, hedge density, or a missing close — would lift this into Strong territory.",
  },
  {
    id: "strong",
    label: "Strong",
    min: 75,
    max: 85,
    description:
      "Doing most things right. The idea is clear, reasonably well structured, and delivered with intentionality. One or two sub-skills still leak — the next rep narrows in on which.",
  },
  {
    id: "excellent",
    label: "Excellent",
    min: 85,
    max: 95,
    description:
      "Calibrated, confident, and tight. Every dimension is firing. The headroom left is at the polish layer — a sharper close, a more specific quote, tone that holds across the whole arc.",
  },
  {
    id: "exceptional",
    label: "Exceptional",
    min: 95,
    max: 100,
    description:
      "Reference-grade. The response would land in any room. Score this rare — replay the rep to extract what made it work, then push for a harder prompt to keep stretching.",
  },
] as const;

export type BandId = (typeof BAND_DEFINITIONS)[number]["id"];

export function bandFor(score: number): (typeof BAND_DEFINITIONS)[number] {
  // Tail fallback is the "exceptional" band so any out-of-range score
  // (or a score == 100) lands meaningfully instead of returning undefined.
  const exceptional = BAND_DEFINITIONS[BAND_DEFINITIONS.length - 1]!;
  return (
    BAND_DEFINITIONS.find((b) => score >= b.min && score < b.max) ??
    exceptional
  );
}

export function getDimensionGroup(dim: SkillDimension): SkillDimensionGroup {
  if ((SKILL_DIMENSION_GROUPS.content as readonly string[]).includes(dim)) {
    return "content";
  }
  return "delivery";
}

export const MODE_IDS = ["daily_workout", "skill_lab", "scenario_training"] as const;
export type ModeId = (typeof MODE_IDS)[number];

// ——— Muscle groups (muscle-group adventure-path pivot — Phase 3 ————————
//
// The product surfaces 6 "muscle groups" the user trains daily. These map
// 1:1 to the canonical 6 SKILL_DIMENSIONS except for one explicit rename:
// the product uses `pacing` where the scoring rubric uses `delivery`.
//
// Rationale: the product team chose "Pacing" as user-facing language
// (rate / pauses / fillers), but the v3 rubric (DNA reconciliation
// 2026-05-01) consolidated under `delivery`. The DB dimension enum is
// append-only and keeps both values, so we tag muscle-group rows with
// `pacing` and rely on Phase 8's scoring-side aliasing to bridge to
// `delivery` when reading dimension_scores.
//
// DO NOT collapse these — the product UI reads MUSCLE_GROUP_IDS,
// scoring reads SKILL_DIMENSIONS. They diverge by design.
export const MUSCLE_GROUP_IDS = [
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "pacing",
  "tone",
] as const;
export type MuscleGroupId = (typeof MUSCLE_GROUP_IDS)[number];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroupId, string> = {
  clarity: "Clarity",
  structure: "Structure",
  conciseness: "Conciseness",
  thinking_quality: "Thinking Quality",
  pacing: "Pacing",
  tone: "Tone",
};

/** One of the 4 stations in a muscle-group day. */
export type Station = {
  index: number; // 0..3
  exerciseId: string;
  exerciseSlug: string;
  exerciseName: string;
  rule: string; // exercises.description in the DB
  why: string | null; // exercises.instructions in the DB
  /** PRD v3 Phase 2.2 — Exercise Framework fields (null pre-enrichment). */
  objective: string | null;
  responseWindow: { minSec: number; maxSec: number } | null;
};

/** Fully-hydrated muscle-group day for the Workout shell to render. */
export type HydratedMuscleGroupDay = {
  dayId: string;
  userId: string;
  dayDate: string; // YYYY-MM-DD
  dimension: MuscleGroupId;
  status: "planned" | "in_progress" | "complete" | "abandoned" | "frozen_skip";
  completedReps: number;
  stations: Station[];
  previousDayId: string | null;
  previousComposite: number | null; // composite_at_close from the prior same-dim day
  startedAt: string | null;
  completedAt: string | null;
};

export type Callout = {
  dimension: SkillDimension | "structural_adherence";
  tone: "positive" | "neutral" | "warn" | "critical";
  title: string;
  body: string;
  quote: string | null;
  suggestedRewrite: string | null;
  /** Nullable: LLMs occasionally omit the timestamps when they can't
   *  ground the callout. UI renders without jump-to-moment when null. */
  transcriptStart: number | null;
  transcriptEnd: number | null;
};

export type DimensionScore = {
  dimension: SkillDimension;
  score: number;
  signals: string[];
  /** Ch.11b: per-sub-skill scores derived from text-signal extractors
   *  (15 sub-skills covered) + dimension_fallback for the remaining 21.
   *  Optional for legacy-rep compat — reps scored before Ch.11 / with
   *  FF_DETERMINISTIC_SIGNALS off omit this field entirely. The UI
   *  surfaces a sub-skill breakdown card (Ch.12) when present and
   *  falls back to dimension-only display when absent. */
  subSkillScores?: Partial<
    Record<import("./sub-skills").SubSkillId, number>
  >;
};

/**
 * One bullet in the post-rep "what you did well" / "what didn't land" /
 * "next rep focus" lists. Generated server-side by the scoring AI under
 * strict grounding rules: every non-null `quote` must be a verbatim
 * substring of the rep transcript (validated by sanitizeBullets in
 * src/lib/ai/score.ts). UI renders quote-anchored bullets with a
 * pull-quote treatment; un-anchored bullets render plain so users
 * implicitly trust grounded ones more.
 */
export type FeedbackBullet = {
  /** Action-oriented, second-person. ≤140 chars. */
  text: string;
  /** The rubric dimension this bullet ties to. Drives icon + accent. */
  dimension: SkillDimension | "structural_adherence";
  /** Phase 2 (Ch.2 sub-skill grading): which specific sub-skill within
   *  the dimension broke down (or shone). Drives the chip rendered next
   *  to the bullet. Nullable so legacy reps and structural_adherence
   *  bullets remain valid; sanitizer drops mismatched sub-skills to null. */
  subSkill?: import("./sub-skills").SubSkillId | null;
  /** Verbatim transcript phrase the bullet is grounded in. Required when
   *  transcriptStart != null. Anti-hallucination anchor. */
  quote: string | null;
  /** Required for didWell / didntLand bullets. Allowed null only for
   *  generic nextRepFocus guidance. */
  transcriptStart: number | null;
  transcriptEnd: number | null;
};

export type NextRepFocusItem = FeedbackBullet & {
  /** Short, speakable model line the user can imitate next rep. Same
   *  constraint as Callout.suggestedRewrite. Null when the bullet is
   *  posture/structure guidance with no specific phrase to imitate. */
  exampleLine: string | null;
};

/**
 * Why this rep has the focus it has. Replaces the legacy `focusReason`
 * field on rep slots. Sources:
 *   - session_intent : top-of-session frame ("Today: clarity focus" /
 *     "Today: balanced workout" / "Today: under pressure — pushback").
 *     Always set on rep 0 of every session.
 *   - carryover      : the previous rep scored low on `dimension`, so
 *     the next slot is biased toward fixing it. Mixed mode mostly.
 *   - pressure_residue : the rep AFTER a pressure rep — the stressed
 *     dimension that got hit hardest carries forward.
 */
export type RepFocusContext = {
  source: "session_intent" | "carryover" | "pressure_residue";
  dimension: SkillDimension;
  /** Pre-rendered banner copy for the LastRepFocusBanner. Server-set so
   *  the UI is dumb (no client-side dimension → string lookup). */
  bannerText: string;
  /** Verbatim previous-rep headline. Plumbed to the next rep's
   *  modeContext.previousRepFocus.headline so the AI can write
   *  continuation copy ("you cleaned up the open from last rep"). */
  previousHeadline?: string;
};

export type RepScore = {
  composite: number;
  dimensions: DimensionScore[];
  /** Present only when the rep is scored against an externally-generated
   *  framework (scenario mode). Measures the user's structural adherence
   *  to the framework's nodes — a distinct dimension from the six rubric
   *  dimensions. */
  structuralAdherence?: number;
  callouts: Callout[];
  modelVersion: string;
  rubricVersion: string;
  /** One-line diagnostic verdict for the rep — second-person, present-tense,
   *  ≤90 chars, no hedging. Tone scales with composite: <50 blunt diagnosis,
   *  50-74 directive, 75-89 specific praise + sharpening edge, ≥90
   *  celebratory + raise-the-bar. Optional on read because legacy reps
   *  predate this field — UI computes a deterministic fallback when absent. */
  headline?: string;
  /** Phase 2: AI-authored "what you did well" bullets. Exactly 2, except
   *  for junk reps (composite < 25) which are allowed to be empty so the
   *  feedback doesn't manufacture praise. Optional for legacy compat. */
  didWell?: FeedbackBullet[];
  /** Phase 2: AI-authored "what didn't land" bullets. Exactly 2 in the
   *  normal case. Optional for legacy compat. */
  didntLand?: FeedbackBullet[];
  /** Phase 2: AI-authored "next rep focus" prescriptions. Exactly 2 in
   *  the normal case, each paired with a didntLand bullet (every gap gets
   *  a paired fix). Optional for legacy compat. */
  nextRepFocus?: NextRepFocusItem[];
  /** Phase 2: which dimension the AI considers most important to surface
   *  for this rep. Drives DimensionGrid emphasis when not overridden by
   *  mode (focus mode pins to focusDimension, pressure to stressed dims). */
  primaryFocusDimension?: SkillDimension;
  /** PRD v3 engine — present only on retry-evaluated reps (the scoring
   *  call carried modeContext.retryContext). Whether the user implemented
   *  the Coach's Focus from their first attempt; drives the Improvement
   *  Review verdict chip. Absent → deriveImplementationVerdict() fallback. */
  implementationReview?: {
    verdict: "nailed" | "partial" | "missed";
    note: string;
  } | null;
  /** Phase 3 calibration scaffold: the AI's self-classification of which
   *  tone band it landed in. Lets us measure tone-vs-score alignment in
   *  the existing `userCalibration` block — if 60% of "blunt" headlines
   *  are landing on composites between 60-75 (where they should be
   *  "directive"), the threshold needs tuning. Not user-visible. */
  headlineTone?: "blunt" | "directive" | "praise" | "celebratory";
  /** Phase 3 scaffold: short continuation phrase (3-8 words, e.g.
   *  "tighten the runway again", "stay sharp under pushback") the next
   *  rep's LastRepFocusBanner uses as its tail. AI-generated for
   *  specificity; UI falls back to the static copy.ts lookup when
   *  absent. Distinct from `headline` — this is the next-rep guidance,
   *  not the current-rep verdict. */
  nextRepHint?: string;
  /** Bumped when the user-facing feedback contract changes (new fields,
   *  new copy rules) independently of the scoring rubric. */
  feedbackVersion?: string;
  /** Ch.3b: true when the prosody worker returned populated pitch/RMS
   *  fields. False (or undefined for legacy reps) means Tone scoring fell
   *  back to text + inline-metric heuristics — UI badges Tone scores as
   *  low-confidence in that state so users implicitly trust prosody-grounded
   *  Tone scores more. */
  prosodyAvailable?: boolean;
  /** Ch.5: composite ≥ 95 sets this flag. Surfaces in /ops as a review
   *  queue. The user-facing flow does NOT block on review — they see the
   *  score immediately. Operators retroactively confirm or correct so we
   *  catch model over-confidence early. Always undefined on RubricVersion
   *  before v3.0.1 (Ch.5 introduced the flag). */
  requiresHumanReview?: boolean;
};

/** Bumped when the shape of user-facing feedback changes (new RepScore
 *  fields, new copy rules) — distinct from RUBRIC_VERSION which tracks
 *  scoring math.
 *  - v1.0.0 introduced `headline`.
 *  - v2.0.0 adds `didWell` / `didntLand` / `nextRepFocus` /
 *    `primaryFocusDimension`, replaces `focusReason` with `RepFocusContext`.
 *  - v2.1.0 adds `headlineTone` calibration scaffold and `nextRepHint`
 *    AI-generated banner tail.
 *  - v3.0.0 swaps Adaptability → Tone, locks DIMENSION_WEIGHTS and
 *    BAND_DEFINITIONS to DNA spec. */
export const FEEDBACK_VERSION = "v3.0.0";

export type FrameworkNode = {
  id: string;
  label: string;
  description: string;
};

export type Framework = {
  id: string;
  name: string;
  description: string;
  nodes: FrameworkNode[];
  source: "library" | "generated";
};
