// ——— Scoring dimensions (v2.0.0 rubric — WS-1 2026-04-24) ———————————
// Grouped into Content (what you said) and Delivery (how you said it).
// Dimension names aligned with strategy team + V2 mockups. Historical
// reps retain their original `rubric_version` tag; use the
// `src/lib/scoring/dimension-aliases.ts` helper to read them.
// See docs/SCORING_METHODOLOGY.md and src/lib/scoring/rubric.ts.

export const SKILL_DIMENSIONS = [
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "adaptability",
] as const;

export type SkillDimension = (typeof SKILL_DIMENSIONS)[number];

export const SKILL_DIMENSION_GROUPS = {
  content: ["clarity", "structure", "conciseness"],
  delivery: ["thinking_quality", "delivery", "adaptability"],
} as const satisfies Record<string, readonly SkillDimension[]>;

export type SkillDimensionGroup = keyof typeof SKILL_DIMENSION_GROUPS;

export const DIMENSION_LABELS: Record<SkillDimension, string> = {
  clarity: "Clarity",
  structure: "Structure",
  conciseness: "Conciseness",
  thinking_quality: "Thinking Quality",
  delivery: "Delivery",
  adaptability: "Adaptability",
};

export const DIMENSION_GROUP_LABELS: Record<SkillDimensionGroup, string> = {
  content: "Content",
  delivery: "Delivery",
};

export function getDimensionGroup(dim: SkillDimension): SkillDimensionGroup {
  if ((SKILL_DIMENSION_GROUPS.content as readonly string[]).includes(dim)) {
    return "content";
  }
  return "delivery";
}

export const MODE_IDS = ["daily_workout", "skill_lab", "scenario_training"] as const;
export type ModeId = (typeof MODE_IDS)[number];

export type Callout = {
  dimension: SkillDimension | "structural_adherence";
  tone: "positive" | "neutral" | "warn" | "critical";
  title: string;
  body: string;
  quote: string | null;
  suggestedRewrite: string | null;
  transcriptStart: number;
  transcriptEnd: number;
};

export type DimensionScore = {
  dimension: SkillDimension;
  score: number;
  signals: string[];
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
};

/** Bumped when the shape of user-facing feedback changes (new RepScore
 *  fields, new copy rules) — distinct from RUBRIC_VERSION which tracks
 *  scoring math.
 *  - v1.0.0 introduced `headline`.
 *  - v2.0.0 adds `didWell` / `didntLand` / `nextRepFocus` /
 *    `primaryFocusDimension`, replaces `focusReason` with `RepFocusContext`.
 *  - v2.1.0 adds `headlineTone` calibration scaffold and `nextRepHint`
 *    AI-generated banner tail. */
export const FEEDBACK_VERSION = "v2.1.0";

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
