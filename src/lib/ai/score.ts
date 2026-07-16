import { z } from "zod";
import { anthropic, MODELS, MODEL_VERSIONS, type AnthropicCallMetrics } from "./claude";
import {
  retrieveKnowledgeForRep,
  renderRagContextBlock,
} from "./rag/retrieve";
import {
  ALL_DIMENSIONS,
  DIMENSION_RUBRIC,
  RUBRIC_VERSION,
  composite,
} from "@/lib/scoring/rubric";
import { renderAnchorsForDimension } from "@/lib/scoring/rubric-anchors";
import type {
  FeedbackBullet,
  NextRepFocusItem,
  RepScore,
  ScoreRepEventContext,
  SkillDimension,
} from "@/types/domain";
import { FEEDBACK_VERSION } from "@/types/domain";
import {
  getPressureArchetype,
  type PressureArchetypeId,
} from "./pressure-archetypes";
import { loadSkill, renderBlocks } from "./knowledge";
import {
  extractSignals,
  extractAllTextSignals,
  mapSignalsToSubSkillScores,
  renderTextSignalsBlock,
  toScoresOnly,
  type TextSignals,
} from "@/lib/scoring/signals";
import {
  scorePacing,
  scoreThinkingQualityDeterministic,
  blendScores,
} from "@/lib/scoring/deterministic";
import {
  ALL_SUB_SKILLS,
  SUB_SKILL_TO_DIMENSION,
  SUB_SKILL_LABELS,
  SUB_SKILLS,
  canonicalizeSubSkillId,
  renderSubSkillReference,
  renderSubSkillReferenceWithDefinitions,
  type SubSkillId,
} from "@/types/sub-skills";
import { createHash } from "node:crypto";
import {
  extractInlineProsody,
  mergeProsody,
} from "@/lib/audio/prosody-inline";
import {
  hasWorkerProsody,
  renderProsodyBlock,
  type ProsodyFeatures,
} from "@/lib/audio/prosody";
import { extractWorkerProsody } from "@/lib/audio/prosody-worker";

const dimensionScoreSchema = z.object({
  dimension: z.enum([
    "clarity",
    "structure",
    "conciseness",
    "thinking_quality",
    "delivery",
    "tone",
  ]),
  score: z.number().min(0).max(100),
  signals: z.array(z.string()),
});

const calloutSchema = z.object({
  dimension: z.enum([
    "clarity",
    "structure",
    "conciseness",
    "thinking_quality",
    "delivery",
    "tone",
    "structural_adherence",
  ]),
  tone: z.enum(["positive", "neutral", "warn", "critical"]),
  title: z.string().max(80),
  body: z.string().max(320),
  quote: z.string().max(320).nullable(),
  suggestedRewrite: z.string().max(360).nullable(),
  // Nullable to match the Callout domain type. Missing keys (undefined)
  // are coerced to null upstream by normalizeProviderQuirks() before
  // the schema parse — that handles the gpt-4o "field omitted entirely"
  // case which was the dominant validation_failed cause (2026-05-21).
  transcriptStart: z.number().min(0).nullable(),
  transcriptEnd: z.number().min(0).nullable(),
});

const dimensionEnumSchema = z.enum([
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "tone",
  "structural_adherence",
]);

const subSkillEnumSchema = z.enum(
  ALL_SUB_SKILLS as unknown as [SubSkillId, ...SubSkillId[]],
);

const feedbackBulletSchema = z.object({
  text: z.string().min(1).max(280),
  dimension: dimensionEnumSchema,
  /** Ch.2 sub-skill grading. Optional in input; sanitizer fills/strips. */
  subSkill: subSkillEnumSchema.nullable().optional(),
  quote: z.string().max(320).nullable(),
  transcriptStart: z.number().min(0).nullable(),
  transcriptEnd: z.number().min(0).nullable(),
});

const nextRepFocusItemSchema = feedbackBulletSchema.extend({
  exampleLine: z.string().max(360).nullable(),
});

/** PRD v3 engine — the implementationReview schema. Present only on
 *  retry reps.
 *
 *  Phase 15 I-8 — `technique`: which coaching technique the coached
 *  focus used (taxonomy: CoachingTechnique in coach-focus.ts). LENIENT
 *  by design — any value outside the taxonomy is coerced to undefined;
 *  a bad tag must never fail the whole score parse. */
export const implementationReviewSchema = z
  .object({
    verdict: z.enum(["nailed", "partial", "missed"]),
    // Phase 11.A — GPT-4o (the OpenAI-primary path) sometimes omits
    // the note where Haiku always wrote one; the verdict is the
    // load-bearing field, so the note is optional.
    note: z.string().max(280).optional(),
    technique: z
      .enum([
        "smaller_step",
        "transcript_example",
        "related_hidden_skill",
        "reframe",
      ])
      .optional()
      .catch(undefined),
  })
  .nullable()
  .optional();

const scoringResponseSchema = z.object({
  dimensions: z.array(dimensionScoreSchema).length(ALL_DIMENSIONS.length),
  structuralAdherence: z.number().min(0).max(100).nullable().optional(),
  callouts: z.array(calloutSchema).min(3).max(3),
  /** One-line diagnostic verdict — see HEADLINE RULES in systemPrompt.
   * Cap was 120 but prod logs (May 2026) showed Haiku regularly emitting
   * 130-150 char headlines on rich-signal reps; rejecting them dropped
   * /api/score into mock-fallback. 200 keeps the headline visibly
   * one-line on the ScoreHero (~2 lines on mobile worst-case) without
   * weaponizing the cap. */
  headline: z.string().min(1).max(200),
  /** Phase 2 first-class bullets. Allow 0–2 so junk reps (composite < 25)
   *  can omit didWell without manufacturing praise. The prompt enforces
   *  "exactly 2" in the normal case. */
  didWell: z.array(feedbackBulletSchema).max(2),
  didntLand: z.array(feedbackBulletSchema).max(2),
  nextRepFocus: z.array(nextRepFocusItemSchema).max(2),
  primaryFocusDimension: z.enum([
    "clarity",
    "structure",
    "conciseness",
    "thinking_quality",
    "delivery",
    "tone",
  ]),
  /** Phase 3 calibration scaffold — tone band the AI thinks it wrote in. */
  headlineTone: z.enum(["blunt", "directive", "praise", "celebratory"]),
  /** Phase 3 scaffold — short tail phrase for the NEXT rep's
   *  LastRepFocusBanner. 3-8 words, no period. */
  nextRepHint: z.string().min(2).max(60),
  /** PRD v3 engine — implementation review, requested ONLY when the user
   *  message carries a RETRY EVALUATION block. Optional so first reps,
   *  legacy calls, and calibration runs validate unchanged; when the
   *  model omits it on a retry, deriveImplementationVerdict() fills in
   *  deterministically. */
  implementationReview: implementationReviewSchema,
});

/** Phase 2: per-mode signals plumbed into the scoring prompt so the AI can
 *  write mode-aware feedback. Without modeContext, scoreRep falls back to
 *  the Phase 1 "mode-blind" behavior (still produces a headline + bullets
 *  but no archetype framing or carry-over reference). */
export type ScoreRepModeContext = {
  /** Which orchestrator built the rep. Drives headline framing rules. */
  sessionType: "focus" | "combined" | "flow";
  /** When sessionType="focus", the dimension being drilled this session. */
  focusDimension?: SkillDimension;
  /** Promoted from top-level so Phase 2 can use the archetype's tagline +
   *  stressedDimensions in the headline framing. The archetype's weight
   *  profile is still applied via `weights` on ScoreRepInput. */
  pressureArchetypeId?: PressureArchetypeId;
  /** What the previous rep was about. Lets the AI write continuation copy
   *  ("you cleaned up structure from last rep"). */
  previousRepFocus?: {
    dimension: SkillDimension;
    headline: string;
    score: number;
  };
  /** PRD v3 engine — present when THIS rep is the required Retry (or an
   *  optional "again" attempt) of a first rep. Switches feedback into
   *  implementation-review framing and requests the implementationReview
   *  field. Absent on first reps and all legacy/calibration paths, so
   *  reference-rep drift runs are unaffected. */
  retryContext?: {
    attempt: "retry" | "again";
    /** Transcript of the FIRST attempt at this prompt. */
    firstTranscript: string;
    firstComposite: number | null;
    /** The single Coach's Focus the user was asked to implement. */
    coachFocus: {
      dimension: SkillDimension;
      subSkill?: string | null;
      text: string;
    };
  };
  /** PRD v3 §7.5 — Build a Rep: the real event this rep is preparing
   *  for (guided moments AND the Full Simulation). Grounds coaching in
   *  the event's description + uploaded context. Rendered ONLY when set
   *  (see renderEventContextBlock), so every non-prep prompt stays
   *  byte-identical — calibration reference runs never carry it. */
  eventContext?: ScoreRepEventContext;
  /** 0-based rep index in the session. */
  repIndex: number;
  totalReps: number;
};

export type ScoreRepInput = {
  transcript: string;
  promptText: string;
  durationMs: number;
  /** Ch.3a — prosody features for grounding Tone + Delivery scores.
   *  Inline path (rate / fillers / pauses) auto-derived from word timings
   *  when omitted; pass an explicit object to inject worker-extracted
   *  pitch/RMS metrics from Ch.3b. */
  prosodyFeatures?: ProsodyFeatures;
  /** Ch.3b — signed audio URL. When supplied AND FF_PROSODY_WORKER=true,
   *  scoreRep calls the prosody worker concurrently with the LLM
   *  scoring pass, then merges worker pitch/RMS results in. Skipped
   *  when omitted or when the worker is offline (graceful fallback to
   *  inline-only). */
  audioUrl?: string;
  /**
   * Expected rep time budget (ms). Used by the deterministic pacing
   * scorer to compute timeBudgetRatio. Defaults to durationMs if not
   * provided — which means no over/under budget penalty is applied.
   */
  timeBudgetMs?: number;
  frameworkNodes?: { label: string; description: string }[];
  weights?: Partial<Record<SkillDimension, number>>;
  words?: { word: string; startMs: number; endMs: number }[];
  /** Rendered calibration block from the user's past ratings + corrections
   *  (from `renderCalibrationForPrompt` in lib/db/queries/calibration.ts).
   *  Injected into the Claude system prompt so scoring adapts to the user's
   *  history. Null/absent when the user has no ratings yet. */
  userCalibration?: string | null;
  /** PRD v3 Phase 3 (PRD §8.6.4) — rendered COACHING MEMORY block from
   *  the user's coaching_events ledger (renderCoachingMemoryBlock in
   *  lib/profile/snapshot.ts). Injected uncached like userCalibration.
   *  Null/absent for first-time users + calibration reference reps —
   *  those prompts stay byte-identical. */
  coachingMemory?: string | null;
  /** Phase 2: mode/session/carry-over context. Optional — when absent,
   *  the scoring prompt runs in mode-blind mode (Phase 1 behavior). */
  modeContext?: ScoreRepModeContext;
  /** Ch.11c: optional userId for the FF_DETERMINISTIC_SIGNALS percentile
   *  rollout. When omitted (anonymous reps, internal scripts), the gate
   *  evaluates to false so the new SIGNALS-block path is never enabled
   *  — keeps trial / unauthenticated flows on the legacy path while we
   *  ramp. */
  userId?: string;
  /** Phase 8 — muscle-group exercise context. When set, the scoring
   *  pipeline injects a `<exercise/>` XML block into the user prompt
   *  and (if the exercise has a registered rubric hint) appends one
   *  operator-facing constraint sentence to the Stage 2 user message.
   *  When unset, scoring runs identically to today (Skill Lab / scenario
   *  reps are unaffected). */
  exerciseId?: string;
  /** Phase 8 — muscle-group day this rep belongs to. Telemetry-only;
   *  doesn't affect the prompt. */
  muscleGroupDayId?: string;
  /** Phase 8 — pressure-style graduation rep tag. Telemetry-only. */
  isGraduationRep?: boolean;
};

/** Ch.11c — Two-knob feature flag. `FF_DETERMINISTIC_SIGNALS=true` is
 *  the kill switch; `FF_DETERMINISTIC_SIGNALS_PERCENT` (0-100) is the
 *  rollout percentile.
 *
 *  Behavior by percent:
 *   - percent <= 0 (or unset / unparseable): always off.
 *   - percent >= 100: always on, regardless of userId — this lets the
 *     calibration harness (which POSTs unauthenticated) exercise the
 *     full signals path against a staging deployment configured at
 *     percent=100. Production ramp stops at percent=25/50 etc. before
 *     hitting 100, so the "anonymous always on at 100" carve-out is
 *     reachable only after the rollout has been fully validated.
 *   - 0 < percent < 100: requires userId. A stable SHA-256 hash buckets
 *     each user; ramping percent only ever ADDS users to the in-bucket
 *     so a user's path stays consistent across reps within a single
 *     setting (no flapping between legacy and new path). Anonymous
 *     reps fall through to legacy path during partial rollouts.
 *
 *  Master flag must be "true" for any of the above to evaluate to on. */
function isDeterministicSignalsOn(userId: string | undefined): boolean {
  if (process.env.FF_DETERMINISTIC_SIGNALS !== "true") return false;
  const percent = parseInt(
    process.env.FF_DETERMINISTIC_SIGNALS_PERCENT ?? "0",
    10,
  );
  if (Number.isNaN(percent) || percent <= 0) return false;
  if (percent >= 100) return true;
  if (!userId) return false;
  const hash = createHash("sha256").update(userId).digest();
  return hash.readUInt32BE(0) % 100 < percent;
}

/** Ch.13 — Band-anchors gate. Same two-knob shape as
 *  isDeterministicSignalsOn so a single user's bucket assignment is
 *  consistent across both rollouts (different env hashes; correlation
 *  is fine). When on, the score prompt's RUBRIC block carries the 30
 *  per-dim band anchors; off path renders the legacy rubric. The
 *  switch is pure path — no scoring math change, but the prompt size
 *  grows, so cache_control buys us back the latency cost on
 *  subsequent calls. */
function isBandAnchorsOn(userId: string | undefined): boolean {
  if (process.env.FF_BAND_ANCHORS !== "true") return false;
  const percent = parseInt(
    process.env.FF_BAND_ANCHORS_PERCENT ?? "0",
    10,
  );
  if (Number.isNaN(percent) || percent <= 0) return false;
  if (percent >= 100) return true;
  if (!userId) return false;
  const hash = createHash("sha256").update(`band-anchors::${userId}`).digest();
  return hash.readUInt32BE(0) % 100 < percent;
}

function renderTimedTranscript(
  transcript: string,
  words?: { word: string; startMs: number; endMs: number }[],
): string {
  // Full transcript is canonical. The compact timestamp index lets Claude
  // anchor callout ranges without bloating the prompt. Every ~5s is plenty
  // for callout granularity; tighter intervals burned tokens without
  // measurably improving anchoring quality.
  if (!words || words.length === 0) return transcript;
  const markers: string[] = [];
  let lastMark = -1;
  for (const w of words) {
    const sec = Math.floor(w.startMs / 1000);
    if (sec !== lastMark && sec % 5 === 0) {
      const stamp = `[${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}]`;
      markers.push(`${stamp} "${w.word}"`);
      lastMark = sec;
    }
  }
  if (markers.length === 0) return transcript;
  return `${transcript}\n\nTIMESTAMP INDEX (every ~5s):\n${markers.join("\n")}`;
}

// System prompt is intentionally tight. Latency dominates UX here, so the
// rubric and dimension definitions live in a single cached block (knowledge)
// rather than being repeated inline. Output is bounded JSON with strict
// rules; verbose framing slowed things down without measurably improving
// quality in our internal calibration runs.
const systemPrompt = `You are the scoring model for Cognify, a communication training gym. Score a rep across six dimensions on 0-100 and write the post-rep feedback the user reads.

Dimensions, in order:
  CONTENT  : clarity, structure, conciseness, thinking_quality
  DELIVERY : delivery, tone

Be rigorous. 90+ is reserved for genuinely excellent reps. <40 means serious issues. Off-topic or junk reps (mic test, rambling, not answering the prompt) must score low on BOTH content and delivery dimensions; do not anchor to a default range.

Return ONLY a JSON object (no prose, no markdown fences):

{
  "dimensions": [
    { "dimension": "clarity"|"structure"|"conciseness"|"thinking_quality"|"delivery"|"tone", "score": 0-100, "signals": ["..."] }
  ],
  "structuralAdherence": 0-100 (only when frameworkNodes provided, else omit),
  "callouts": [
    { "dimension": "...", "tone": "positive"|"neutral"|"warn"|"critical", "title": "short label", "body": "why it mattered", "quote": "verbatim phrase from transcript"|null, "suggestedRewrite": "speakable rephrasing"|null, "transcriptStart": ms, "transcriptEnd": ms }
  ],
  "headline": "one-line verdict, see HEADLINE RULES below",
  "didWell": [{ "text": "...", "dimension": "...", "quote": "...", "transcriptStart": ms, "transcriptEnd": ms }, ...],
  "didntLand": [{ "text": "...", "dimension": "...", "quote": "...", "transcriptStart": ms, "transcriptEnd": ms }, ...],
  "nextRepFocus": [{ "text": "...", "dimension": "...", "quote": "..."|null, "transcriptStart": ms|null, "transcriptEnd": ms|null, "exampleLine": "..."|null }, ...],
  "primaryFocusDimension": "clarity"|"structure"|"conciseness"|"thinking_quality"|"delivery"|"tone",
  "headlineTone": "blunt"|"directive"|"praise"|"celebratory",
  "nextRepHint": "3-8 word continuation tail for the next rep's banner"
}

HEADLINE RULES (the single most important sentence the user reads):
  - One sentence, ≤90 chars, second-person ("you"), present-tense, no hedging.
  - It is the diagnostic verdict — the single most important truth about THIS rep. Not a stat number, not a list.
  - Tone scales with the composite score you assigned:
      composite < 50  → blunt diagnosis. Name what failed. Example: "Your ideas were there. Your structure collapsed before they landed."
      50–74           → directive. Name the one fix that moves the score most. Example: "You had the point — you just buried it under three setups."
      75–89           → specific praise + sharpening edge. Example: "Clean from open to ask. Tighten the middle and this is a 90."
      ≥ 90            → celebratory + raise the bar. Example: "Nothing to fix on this one. Try it again with a harder audience."
  - Junk reps / off-prompt rambles get an honest verdict, not coaching: "That wasn't the prompt. Try it again."
  - Banned in headline: any phrase from the BANNED list below; "great rep", "good rep", "nice rep", emoji, exclamation marks, score numbers, percentages.

PER-MODE HEADLINE FRAMING (when MODE block is supplied in the user message):
  - sessionType=focus, focusDimension=X:
      Default: headline targets X exclusively. Example: "Your structure still flips at the close — the ask is missing again."
      Pivot: if X >= 85 AND another dimension < 60, headline names the new weakest. Example: "Structure locked. Conciseness is now the leak — you doubled every point."
  - sessionType=combined:
      Headline targets the lowest-scoring dimension after weights. When composite ≥ 80, name the last remaining gap (don't praise the streak — reach for the next badge).
  - pressureArchetypeId=Y (in any sessionType):
      Headline references the archetype mechanism, not just a dim. Compare avg(stressedDimensions) vs avg(non-stressed):
        if stressed avg ≥ non-stressed + 10 → "you held the line under {mechanism}" framing
        else → "{mechanism} got past you" framing
  - previousRepFocus supplied: the headline must address whether that dimension improved or stayed flat compared to the previous rep's headline. Don't restate the previous headline — extend it.

CALLOUT RULES (responses violating these are rejected):
  - Exactly 3 callouts: 1 positive + 2 warn/critical. The two improvements target the TWO lowest-scoring dimensions (one each).
  - Every callout includes a \`quote\` copied verbatim from the transcript.
  - Warn/critical callouts include a \`suggestedRewrite\`: concrete, speakable, same length or shorter, in the user's voice. Positive callouts set suggestedRewrite=null.
  - dimension must be one of the six rubric dimensions (or "structural_adherence" when scoring against a framework).

BULLET RULES (didWell / didntLand / nextRepFocus — these are the user-facing summary bullets, distinct from callouts):
  - didWell:        exactly 2 bullets in the normal case. ALLOWED 0 only when composite < 25 (junk reps must not manufacture praise).
  - didntLand:      exactly 2 bullets, paired with the 2 nextRepFocus items (each gap gets a paired fix in the same array index).
  - nextRepFocus:   exactly 2 bullets, prescriptive ("Open with a direction-setting sentence so the listener knows where you're going.").
  - SUB-SKILL ATTRIBUTION (Ch.2 sub-skill grading): every bullet MUST set \`subSkill\` to the specific lever within the named dimension. The sub-skill must belong to the bullet's \`dimension\` (Vocabulary Precision belongs to Clarity, not Structure). Use the SUB-SKILL REFERENCE block in the user message to choose. Bullets with mismatched sub-skill / dimension are sanitized to subSkill=null.
  - text ≤140 chars, second-person ("you …"), action-oriented, no hedging.
  - Voice differs from callouts: callouts label what happened ("Rushed the setup"); bullets give actionable context ("You started talking without telling me where you were going.").
  - GROUNDING — non-negotiable for didWell + didntLand:
      Every bullet MUST cite a verbatim transcript phrase in \`quote\` and a timestamp range. If you cannot cite, do not write the bullet.
      The quote is character-for-character from the transcript. Paraphrasing or insertion is rejected by the post-validator.
  - GROUNDING — nextRepFocus only:
      Generic prescriptive guidance is allowed ONLY in nextRepFocus bullets, AND ONLY when transcriptStart, transcriptEnd, and quote are ALL explicitly null. The text must read as universal advice ("open with a direction-setting sentence"), not pseudo-specific.
      If a nextRepFocus bullet ties to a specific transcript moment, populate quote + timestamps the same as didntLand.
  - exampleLine (nextRepFocus only): a short, speakable line the user could imitate next rep. Same constraints as suggestedRewrite. At most ONE of the two nextRepFocus items may have exampleLine=null.
  - primaryFocusDimension: pick the single dimension you'd most want the user to focus on for the next rep. Surfaces in the UI's dimension grid.

COPY RULES:
  - title ≤80 chars: a label of what happened, not advice. Example: "Rushed the setup", "Landed the ask".
  - body ≤300 chars: 1-2 tight sentences on why the moment matters. The fix belongs in suggestedRewrite, not body.

BANNED in title, body, or any bullet text: "good job", "great job", "nice work", "nice job", "well done", "way to go", "keep it up", "you got this", "you're doing great", "you did well". Drop filler adverbs (really, very, quite). Avoid hype verbs (crushed, absolutely, completely nailed). Every positive callout and didWell bullet points at a specific transcript moment.

ANTI-HALLUCINATION RULES:
  - Never write "you said X" / "when you mentioned X" / "the part where you X" without populating the quote field with the verbatim phrase.
  - If you're tempted to reference a transcript moment but can't find the exact phrase, drop the reference entirely. Generic advice is honest; fabricated specifics break trust.
  - Bullets that reference transcript moments without verbatim quotes are rejected by the post-validator.

EDGE-CASE GRADING RULES (Ch.5 — DNA spec §"Edge Case Grading Guidelines" — these override the per-dimension rubric in the listed conflicts):
  1. Brevity-at-cost-of-meaning: a response that is concise but loses the meaning takes the hit on CLARITY, not as a Conciseness reward. Honest score: low Clarity (idea didn't land), neutral Conciseness (don't reward erasing meaning).
  2. Shallow-but-organized: a well-structured response with shallow ideas scores HIGH on Structure and LOW on Thinking Quality. Do NOT reward organization for compensating for weak reasoning. Numbered scaffolds without substance are still shallow.
  3. Fast-and-no-fillers: a response delivered at 220+ wpm without filler words still scores LOW on Delivery. Rate is part of pacing — speed isn't competence. Optimal range is 150-160 wpm.
  4. Variety-with-upspeak: a response with strong vocal variety BUT consistent rising inflection on statements scores LOW on Tone. Upspeak undercuts authority. Strong variety does NOT cancel out an upspeak pattern.
  5. Short-but-deep: a response under 30 seconds is NOT penalized for length alone. Evaluate whether the brevity served the prompt — if the rep fully engaged the prompt with strong thinking and no filler, it can score high. If it dodged depth, Thinking Quality drops regardless of other qualities.
  6. Composite ≥ 95: such a response should be exceptionally rare. Set primaryFocusDimension to the LOWEST-scoring dim regardless of focus mode (the only remaining work). The post-validator will set requiresHumanReview=true on responses scoring ≥95.

HEADLINE TONE BAND (calibration scaffold — pick the band you wrote the headline in):
  - "blunt"       — composite < 50, headline names what failed.
  - "directive"   — 50-74, headline names the one fix.
  - "praise"      — 75-89, specific praise + sharpening edge.
  - "celebratory" — ≥ 90, raise-the-bar framing.
  Pick the band that actually matches the headline you wrote, not the score range — they should align, but if you wrote softer copy than the band suggests, report what you wrote.

NEXT REP HINT:
  - 3-8 words, present-tense, second-person, no period.
  - Becomes the tail of the next rep's "Last rep focus: <dim> — <hint>" banner.
  - Tied to primaryFocusDimension. Specific over generic when possible:
      generic   : "keep building on it"
      specific  : "land the open before the ask"
  - No filler verbs ("focus on", "work on") — give an action.`;

/**
 * Compact rubric block — definitions + signals for the four LLM-scored
 * dimensions only (delivery + thinking_quality are deterministic, no
 * need to spend tokens describing them to the model). Capped to keep
 * the system prompt under ~3KB after caching.
 *
 * Ch.13 — when `withAnchors=true`, interleaves the per-dim band anchors
 * from `rubric-anchors.ts`. The anchored variant is cached separately
 * and rendered into the score prompt only when FF_BAND_ANCHORS is on,
 * so the legacy prompt + cache key stays untouched on the off path.
 */
const LLM_SCORED_DIMENSIONS: SkillDimension[] = [
  "clarity",
  "structure",
  "conciseness",
  "tone",
];

function renderRubric(withAnchors = false): string {
  return LLM_SCORED_DIMENSIONS.map((d) => {
    const r = DIMENSION_RUBRIC[d];
    const anchorBlock = withAnchors
      ? `\n\nBands (pick the band first, then place the score within its range):\n${renderAnchorsForDimension(d)}`
      : "";
    return `## ${d}
${r.definition}
Low: ${r.lowScoreSignals.slice(0, 3).join("; ")}
High: ${r.highScoreSignals.slice(0, 3).join("; ")}${anchorBlock}`;
  }).join("\n\n");
}

// Cached at module scope so we don't re-render on every request. Two
// variants: the legacy (no band anchors) and the Ch.13 anchored
// version. Both are kept warm so the FF flip is a pure path switch
// with no first-request render cost.
const COMPACT_RUBRIC = renderRubric(false);
const COMPACT_RUBRIC_WITH_ANCHORS = renderRubric(true);
const SUB_SKILL_REFERENCE = renderSubSkillReference();
/** Taxonomy v2 — definition blocks are pure module data; precompute the
 *  six variants once so renderModeBlock never rebuilds them per rep, and
 *  each dimension's block stays byte-stable by construction. */
const FOCUS_SKILL_REFS: Record<SkillDimension, string> = Object.fromEntries(
  (Object.keys(SUB_SKILLS) as SkillDimension[]).map((d) => [
    d,
    renderSubSkillReferenceWithDefinitions(d),
  ]),
) as Record<SkillDimension, string>;

/** Knowledge for ONLY the LLM-scored skills. delivery + thinking_quality
 *  are deterministic so we don't ship their knowledge to the model. */
function loadLlmScoredSkillKnowledge(): string {
  const blocks = LLM_SCORED_DIMENSIONS.map((d) => loadSkill(d)).filter(
    (b): b is NonNullable<typeof b> => b !== null,
  );
  return renderBlocks(blocks);
}
const COMPACT_KNOWLEDGE = loadLlmScoredSkillKnowledge();

/**
 * Banned phrases that disqualify a callout from the user-visible feed.
 * When found, the callout's copy is rewritten to a neutral-but-specific
 * fallback so the 1+2 shape holds. Pattern: case-insensitive substring
 * match against title + body combined. Short, high-signal list —
 * expanding it is cheap but false-positive risk grows fast, so tune
 * against real outputs if/when needed.
 */
const CALLOUT_BANNED_PHRASES = [
  "good job",
  "great job",
  "nice work",
  "nice job",
  "well done",
  "way to go",
  "keep it up",
  "you got this",
  "you're doing great",
  "you did well",
];

type RawCallout = {
  dimension:
    | "clarity"
    | "structure"
    | "conciseness"
    | "thinking_quality"
    | "delivery"
    | "tone"
    | "structural_adherence";
  tone: "positive" | "neutral" | "warn" | "critical";
  title: string;
  body: string;
  quote: string | null;
  suggestedRewrite: string | null;
  transcriptStart: number | null;
  transcriptEnd: number | null;
};

function calloutContainsBanned(c: RawCallout): boolean {
  const hay = `${c.title} ${c.body}`.toLowerCase();
  return CALLOUT_BANNED_PHRASES.some((p) => hay.includes(p));
}

/** Phase 2 grounding validator. Mirrors sanitizeCallouts' belt-and-suspenders
 *  approach: trust the prompt rules but verify post-LLM. For each bullet:
 *    - If quote != null, verify it's a substring of the rep transcript
 *      (case-insensitive, whitespace-collapsed). Mismatch → strip quote +
 *      timestamps so the UI renders the bullet without quote-mark styling
 *      and without the timestamp jump affordance. Don't drop the bullet —
 *      the text alone is still useful guidance.
 *    - Verify transcriptStart < transcriptEnd <= durationMs. Out-of-range
 *      timestamps get nulled out (same UI consequence as bad quote).
 *    - Banned-phrase sweep: bullets containing pseudo-specific phrases
 *      ("you said", "when you mentioned", "the part where you") with
 *      quote=null are also stripped of any timestamp data — they were
 *      claiming to ground in transcript without actually doing so. */
const PSEUDO_GROUND_PHRASES = [
  "you said",
  "when you mentioned",
  "when you said",
  "the part where you",
  "the moment where you",
  "the bit where you",
];

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function sanitizeBullets<T extends FeedbackBullet>(opts: {
  bullets: T[];
  transcript: string;
  durationMs: number;
  /** Tag for log output ("didWell" / "didntLand" / "nextRepFocus"). */
  label: string;
}): T[] {
  const { bullets, transcript, durationMs, label } = opts;
  const haystack = normalizeForMatch(transcript);
  return bullets.map((b) => {
    let quote = b.quote;
    let start = b.transcriptStart;
    let end = b.transcriptEnd;

    // Quote substring check.
    if (quote != null) {
      const needle = normalizeForMatch(quote);
      if (needle.length === 0 || !haystack.includes(needle)) {
        console.warn(
          `[score] ${label} bullet quote not found in transcript; stripping anchor:`,
          { quote: quote.slice(0, 80) },
        );
        quote = null;
        start = null;
        end = null;
      }
    }

    // Timestamp range check.
    if (start != null && end != null) {
      if (start < 0 || end <= start || end > durationMs) {
        console.warn(
          `[score] ${label} bullet timestamps out of range; stripping anchor:`,
          { start, end, durationMs },
        );
        quote = null;
        start = null;
        end = null;
      }
    }

    // Pseudo-ground sweep: text claims a transcript moment but no quote.
    const lowerText = b.text.toLowerCase();
    const claimsTranscriptMoment = PSEUDO_GROUND_PHRASES.some((p) =>
      lowerText.includes(p),
    );
    if (claimsTranscriptMoment && quote == null) {
      console.warn(
        `[score] ${label} bullet claims transcript moment without quote; nulling timestamps:`,
        { text: b.text.slice(0, 80) },
      );
      start = null;
      end = null;
    }

    return { ...b, quote, transcriptStart: start, transcriptEnd: end };
  });
}

/** Ch.2 sub-skill validator. For each bullet:
 *    - If subSkill is provided, verify it belongs to the bullet's dimension
 *      via SUB_SKILL_TO_DIMENSION. Mismatch → null out the subSkill (leave
 *      the bullet otherwise intact; UI gracefully renders no chip).
 *    - structural_adherence dimension never carries a sub-skill (it's a
 *      separate framework-scoring dim). Strip if set.
 *    - Missing subSkill is allowed (legacy, edge-case bullets) — handled
 *      by Zod's `.optional()`. */
function sanitizeSubSkills<T extends FeedbackBullet>(opts: {
  bullets: T[];
  label: string;
}): T[] {
  const { bullets, label } = opts;
  return bullets.map((b) => {
    const sub = b.subSkill;
    if (sub == null || sub === undefined) return b;
    if (b.dimension === "structural_adherence") {
      console.warn(
        `[score] ${label} bullet on structural_adherence had subSkill; stripping:`,
        { subSkill: sub },
      );
      return { ...b, subSkill: null };
    }
    const expectedDim = SUB_SKILL_TO_DIMENSION[sub as SubSkillId];
    if (expectedDim !== b.dimension) {
      console.warn(
        `[score] ${label} bullet sub-skill / dimension mismatch; stripping subSkill:`,
        { subSkill: sub, dimension: b.dimension, expectedDim },
      );
      return { ...b, subSkill: null };
    }
    return b;
  });
}

function sanitizeCallouts(callouts: RawCallout[]): RawCallout[] {
  return callouts.map((c) => {
    if (!calloutContainsBanned(c)) return c;
    // Log so we can audit prompt drift. Don't drop — we need to keep
    // the 1+2 shape intact.
    console.warn(
      "[score] callout tripped banned-phrase filter; sanitizing:",
      { dimension: c.dimension, tone: c.tone, title: c.title },
    );
    if (c.tone === "positive") {
      return {
        ...c,
        title: "Landed a specific moment",
        body:
          c.quote
            ? `The line "${c.quote}" hit clearly — keep that specificity.`
            : "A specific moment landed cleanly. Keep that specificity.",
      };
    }
    return {
      ...c,
      title: "Tighten this moment",
      body:
        c.quote
          ? `"${c.quote}" could land cleaner. See the suggested rewrite below.`
          : "This moment could land cleaner. See the suggested rewrite below.",
    };
  });
}

/** Render the MODE block injected into the user prompt before the
 *  transcript so the AI knows what frame to write the headline + bullets
 *  in. Returns null when no modeContext is provided (Phase 1 behavior). */
function renderModeBlock(ctx: ScoreRepModeContext | undefined): string | null {
  if (!ctx) return null;
  const lines: string[] = [];
  lines.push(`MODE: ${ctx.sessionType}`);
  if (ctx.sessionType === "focus" && ctx.focusDimension) {
    lines.push(`FOCUS DIMENSION: ${ctx.focusDimension}`);
    // Taxonomy v2 (D20) — definitions for ONLY the focused dimension so
    // sub-skill attribution inside the trained dimension is definition-
    // guided. All 148 definitions would blow the token budget; the
    // labels-only SUB-SKILL REFERENCE block still covers the other
    // dimensions. Deterministic per focusDimension (calibration-safe).
    lines.push(
      `FOCUS DIMENSION HIDDEN SKILLS (prefer these for ${ctx.focusDimension} bullets' subSkill):`,
      FOCUS_SKILL_REFS[ctx.focusDimension],
    );
  }
  if (ctx.pressureArchetypeId) {
    const arch = getPressureArchetype(ctx.pressureArchetypeId);
    lines.push(
      `PRESSURE ARCHETYPE: ${arch.id} ("${arch.tagline}")`,
      `STRESSED DIMENSIONS (priority order): ${arch.stressedDimensions.join(", ")}`,
      `Frame the headline around how the user handled the ${arch.name.toLowerCase()} mechanism. Bias didWell/didntLand toward the stressed dimensions.`,
    );
  }
  if (ctx.previousRepFocus) {
    const { dimension, headline, score } = ctx.previousRepFocus;
    lines.push(
      `PREVIOUS REP FOCUS: ${dimension} (${Math.round(score)}). Headline was: "${headline}"`,
      `Your headline must address whether ${dimension} improved or stayed flat compared to that — extend, don't restate.`,
    );
  }
  const retryBlock = renderRetryEvaluationBlock(ctx.retryContext);
  if (retryBlock) lines.push(retryBlock);
  // PRD v3 §7.5 — event-preparation context, same guardrail as the retry
  // block: appended ONLY when eventContext is set, so all non-prep
  // prompts stay byte-identical (calibration guardrail).
  const eventBlock = renderEventContextBlock(ctx.eventContext);
  if (eventBlock) lines.push(eventBlock);
  lines.push(`This is rep ${ctx.repIndex + 1} of ${ctx.totalReps}.`);
  return lines.join("\n");
}

/** PRD v3 engine — the RETRY EVALUATION block. Shared by the single-call
 *  path (via renderModeBlock) and the two-stage path (prepareContext),
 *  which otherwise doesn't render MODE context. Returns null when the rep
 *  isn't a retry, keeping non-retry prompts byte-identical — calibration
 *  reference runs never carry retryContext. */
export function renderRetryEvaluationBlock(
  rc: ScoreRepModeContext["retryContext"] | undefined,
): string | null {
  if (!rc) return null;
  // Taxonomy v2 — the persisted coach focus may carry a pre-v2 id;
  // canonicalize so the model sees (and echoes) a live taxonomy id.
  const focusSkillId = rc.coachFocus.subSkill
    ? (canonicalizeSubSkillId(rc.coachFocus.subSkill) ?? rc.coachFocus.subSkill)
    : null;
  const focusSkill = focusSkillId ? ` (hidden skill: ${focusSkillId})` : "";
  return [
    `RETRY EVALUATION: this is the user's ${rc.attempt === "again" ? "third-or-later" : "second"} attempt at the SAME prompt.`,
    `They were coached to implement ONE change: [${rc.coachFocus.dimension}${focusSkill}] "${rc.coachFocus.text}"`,
    rc.firstComposite != null
      ? `First attempt composite: ${Math.round(rc.firstComposite)}.`
      : `First attempt composite unavailable (scoring hiccup).`,
    `FIRST ATTEMPT TRANSCRIPT (for comparison only — score ONLY the new transcript below):`,
    `<first_attempt>${rc.firstTranscript.slice(0, 4000)}</first_attempt>`,
    `Write feedback as an IMPLEMENTATION REVIEW, not a fresh critique:`,
    `  - The headline answers: did they implement the coached change?`,
    `  - REQUIRED: your JSON MUST contain a top-level "implementationReview" object — {"implementationReview": {"verdict": "nailed" | "partial" | "missed", "note": "<one sentence on how it landed>"}}. "nailed" = clear behavioral change, "partial" = attempted but inconsistent, "missed" = no behavioral change. Judge the BEHAVIOR, not the score delta. A response without this field is INVALID.`,
    // Phase 15 I-8 — CALIBRATION GUARDRAIL: this line changes the v2
    // scoring prompt for RETRY reps only (non-retry prompts stay
    // byte-identical). Any prompt change batches with a calibration
    // replay — the orchestrator runs it; do not re-baseline here.
    `  - In implementationReview also set "technique" — which coaching technique the coached change above used: "smaller_step" (one small concrete action), "transcript_example" (a before/after example from the user's own words), "related_hidden_skill" (coaching an adjacent hidden skill), "reframe" (the same fix under a new framing). Omit the field if none clearly fits.`,
    `  - Acknowledge what carried over from the first attempt before naming the next opportunity.`,
    `  - Score the new transcript on its own merits with the normal rubric — do not inflate for effort or deflate for repetition of the same prompt.`,
  ].join("\n");
}

/** PRD v3 §7.5 — the EVENT CONTEXT block for Build a Rep preparation
 *  reps (rendered via renderModeBlock), mirroring
 *  renderRetryEvaluationBlock exactly. Returns null when the rep isn't
 *  a prep rep, keeping non-prep prompts byte-identical — this is the
 *  calibration guardrail: reference runs never carry eventContext. */
export function renderEventContextBlock(
  ec: ScoreRepModeContext["eventContext"] | undefined,
): string | null {
  if (!ec) return null;
  return [
    `EVENT CONTEXT (the user is preparing for this real event — ground coaching in it, do NOT render verbatim):`,
    `Event: ${ec.title} (${ec.eventType})`,
    `What the user told us about it: ${ec.description.slice(0, 2000)}`,
    ec.contextSummary
      ? `From their uploaded materials:\n${ec.contextSummary.slice(0, 1500)}`
      : null,
    // L4 (§7.7/§8.4.6) — the practiced Critical Moment's scoring lens.
    // One extra line inside this SAME only-when-present block: non-prep
    // prompts and hint-less prep prompts stay byte-identical, so the
    // calibration guardrail above still holds.
    ec.momentHint
      ? `Scoring lens for this moment (operator note): ${ec.momentHint.slice(0, 300)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Provider-quirk normalizer. Runs before Zod validation. Today's
 *  quirks:
 *    - sub-skill labels vs ids: some models return "Word Choice"
 *      instead of "word_choice". Map labels → ids using the
 *      SUB_SKILL_LABELS table.
 *    - "structural_adherence" sub-skill: schema doesn't accept it; null
 *      it out so the bullet still validates and the sanitizer picks up.
 *  Pass-through for shapes we don't recognize. */
const SUB_SKILL_LABEL_TO_ID: Record<string, SubSkillId> = (() => {
  const out: Record<string, SubSkillId> = {};
  for (const [id, label] of Object.entries(SUB_SKILL_LABELS) as [
    SubSkillId,
    string,
  ][]) {
    out[label] = id;
    out[label.toLowerCase()] = id;
  }
  return out;
})();

function normalizeSubSkillField(value: unknown): unknown {
  if (typeof value !== "string") return value;
  // Already a v2 id, or a pre-v2 id the model echoed back (retry context
  // and coaching memory can inject persisted legacy ids) — canonicalize.
  const canonical = canonicalizeSubSkillId(value);
  if (canonical) return canonical;
  // Try human-label match (case-insensitive).
  const mapped = SUB_SKILL_LABEL_TO_ID[value] ?? SUB_SKILL_LABEL_TO_ID[value.toLowerCase()];
  if (mapped) return mapped;
  // Try snake_case'd label. v2 labels are hyphen-heavy ("Filler-to-Pause
  // Substitution", "Real-Time Editing") so hyphens fold to underscores too.
  const snake = value.toLowerCase().replace(/[\s-]+/g, "_");
  const canonicalSnake = canonicalizeSubSkillId(snake);
  if (canonicalSnake) return canonicalSnake;
  // Unknown string — null it out so the optional schema field accepts.
  return null;
}

function normalizeBulletArray(arr: unknown): unknown {
  if (!Array.isArray(arr)) return arr;
  return arr.map((b) => {
    if (!b || typeof b !== "object") return b;
    const obj = { ...(b as Record<string, unknown>) };
    if ("subSkill" in obj) obj.subSkill = normalizeSubSkillField(obj.subSkill);
    // Coerce missing-or-undefined transcript anchors to null so the
    // nullable Zod field accepts. LLMs sometimes drop these entirely.
    if (!("transcriptStart" in obj) || obj.transcriptStart === undefined) {
      obj.transcriptStart = null;
    }
    if (!("transcriptEnd" in obj) || obj.transcriptEnd === undefined) {
      obj.transcriptEnd = null;
    }
    if (!("quote" in obj) || obj.quote === undefined) {
      obj.quote = null;
    }
    return obj;
  });
}

/** Coerce missing transcript anchors on callouts to null. gpt-4o sometimes
 *  omits the fields entirely when it can't ground the callout — that lands
 *  as `undefined` after JSON.parse, which the nullable Zod schema rejects.
 *  This was the dominant validation_failed → mock-fallback cause in
 *  2026-05-21 telemetry. */
function normalizeCalloutsArray(arr: unknown): unknown {
  if (!Array.isArray(arr)) return arr;
  return arr.map((c) => {
    if (!c || typeof c !== "object") return c;
    const obj = { ...(c as Record<string, unknown>) };
    if (!("transcriptStart" in obj) || obj.transcriptStart === undefined) {
      obj.transcriptStart = null;
    }
    if (!("transcriptEnd" in obj) || obj.transcriptEnd === undefined) {
      obj.transcriptEnd = null;
    }
    if (!("quote" in obj) || obj.quote === undefined) {
      obj.quote = null;
    }
    if (
      !("suggestedRewrite" in obj) ||
      obj.suggestedRewrite === undefined
    ) {
      obj.suggestedRewrite = null;
    }
    return obj;
  });
}

function normalizeProviderQuirks(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const obj = { ...(parsed as Record<string, unknown>) };
  if ("callouts" in obj) obj.callouts = normalizeCalloutsArray(obj.callouts);
  if ("didWell" in obj) obj.didWell = normalizeBulletArray(obj.didWell);
  if ("didntLand" in obj) obj.didntLand = normalizeBulletArray(obj.didntLand);
  if ("nextRepFocus" in obj)
    obj.nextRepFocus = normalizeBulletArray(obj.nextRepFocus);
  return obj;
}

/** Ch.11c — Extract the per-dimension subset of `subSkillScores` for a
 *  single dimension. Returns undefined when no sub-skills are populated
 *  for that dim (so the field stays `undefined` on the DimensionScore,
 *  matching its optional shape — a `{}` would be persisted as an
 *  empty object and clutter the jsonb). */
function pickSubSkillsForDim(
  scores: Partial<Record<SubSkillId, number>>,
  dimension: SkillDimension,
): Partial<Record<SubSkillId, number>> | undefined {
  const out: Partial<Record<SubSkillId, number>> = {};
  let any = false;
  for (const subSkill of SUB_SKILLS[dimension]) {
    const score = scores[subSkill];
    if (score != null) {
      out[subSkill] = score;
      any = true;
    }
  }
  return any ? out : undefined;
}

/**
 * Phase 0 — merged metrics from a single scoring call. Joins the
 * upstream LLM-call metrics from anthropic.messages.createWithMetrics
 * with the validation+sanitization timing that happens here in scoreRep.
 * Total server duration of the scoring step is the sum, captured at the
 * scoreRep boundary.
 *
 * Route handlers wrap their own outer timing (which includes auth +
 * rate-limit + DB writes) and merge into a scoring_telemetry row.
 */
export type ScoreRepMetrics = AnthropicCallMetrics & {
  validationDurationMs: number;
  /** scoreRep boundary total — model + validation, EXCLUDING route-level
   *  auth / rate-limit / DB writes. */
  scoreRepTotalMs: number;
  /** Phase 4 — RAG retrieval wall-clock. Includes the OpenAI embed call
   *  + pgvector query. 0 when RAG was disabled or returned empty. */
  ragDurationMs: number;
  /** Phase 4 — number of chunks injected into the user prompt. 0 when
   *  RAG was disabled, failed, or returned no chunks. */
  ragChunkCount: number;
};

export type ScoreRepResult = {
  score: RepScore;
  metrics: ScoreRepMetrics;
};

/**
 * Phase 0 — backward-compat wrapper. Existing callers (e.g. test scripts)
 * keep using the legacy single-return shape; production route handlers
 * use scoreRepWithMetrics directly so they can write a scoring_telemetry
 * row at request end.
 */
export async function scoreRep(input: ScoreRepInput): Promise<RepScore> {
  const { score } = await scoreRepWithMetrics(input);
  return score;
}

export async function scoreRepWithMetrics(input: ScoreRepInput): Promise<ScoreRepResult> {
  const timedTranscript = renderTimedTranscript(input.transcript, input.words);
  const hasWordTimestamps = input.words && input.words.length > 0;

  const modeBlock = renderModeBlock(input.modeContext);

  // Ch.11c — Text-derived deterministic signals. Gate is per-user via
  // SHA-256 percentile bucket so we can ramp 25→100 via env var without
  // code changes. When the flag is off OR the userId is absent, the
  // SIGNALS block isn't rendered and subSkillScores aren't computed —
  // the response shape is byte-identical to the pre-Ch.11 path.
  const signalsFlagOn = isDeterministicSignalsOn(input.userId);
  let textSignals: TextSignals | null = null;
  let signalsBlock: string | null = null;
  if (signalsFlagOn) {
    textSignals = extractAllTextSignals({
      transcript: input.transcript,
      durationMs: input.durationMs,
      words: input.words,
    });
    signalsBlock = renderTextSignalsBlock(textSignals);
  }

  // Ch.13 — Band-anchors gate. When on, the cached rubric block in the
  // system prompt carries the 30 per-dim band anchors. Off path keeps
  // the legacy compact rubric — and an unchanged cache_control key for
  // the system prompt block — so untouched users see no latency
  // regression while the anchors ramp.
  const bandAnchorsOn = isBandAnchorsOn(input.userId);
  const rubricBlock = bandAnchorsOn
    ? COMPACT_RUBRIC_WITH_ANCHORS
    : COMPACT_RUBRIC;

  // Phase 4 — RAG retrieval. Embed the transcript, fetch top-K chunks
  // from pgvector, inject as supplemental anchors in the user prompt.
  // Concurrent with prosody worker call below — neither blocks the
  // other. Gated by FF_RAG_RETRIEVE so we can ramp safely; falls back
  // to no-RAG path on any failure or when disabled.
  const ragEnabled = process.env.FF_RAG_RETRIEVE !== "false"; // default ON in Phase 4
  const ragPromise = ragEnabled
    ? retrieveKnowledgeForRep({
        transcript: input.transcript,
        scoredDims: LLM_SCORED_DIMENSIONS,
      })
    : Promise.resolve<Awaited<ReturnType<typeof retrieveKnowledgeForRep>>>({
        chunks: [],
        durationMs: 0,
        failureReason: null,
      });

  // Ch.3a: derive inline prosody features from word timings when caller
  // didn't supply pre-computed features. Ch.3b: concurrently call the
  // external prosody worker (when configured) and merge its pitch/RMS
  // results into the inline features. Worker call is fire-and-await with
  // a 5s timeout; failure returns null and we proceed with inline-only.
  const inlineProsody = input.prosodyFeatures
    ? null
    : hasWordTimestamps
      ? extractInlineProsody({
          words: input.words!,
          durationMs: input.durationMs,
        })
      : null;
  const workerPromise =
    input.audioUrl != null
      ? extractWorkerProsody({
          audioUrl: input.audioUrl,
          durationMs: input.durationMs,
        })
      : Promise.resolve(null);
  // Await both concurrently — RAG retrieval and prosody worker have no
  // dependency on each other.
  const [workerProsody, ragResult] = await Promise.all([
    workerPromise,
    ragPromise,
  ]);
  const ragBlock = renderRagContextBlock(ragResult.chunks);
  const prosodyFeatures =
    input.prosodyFeatures ??
    (inlineProsody ? mergeProsody(inlineProsody, workerProsody) : null);
  const prosodyBlock = renderProsodyBlock(prosodyFeatures);

  const userPrompt = [
    modeBlock,
    `PROMPT: ${input.promptText}`,
    `REP DURATION: ${(input.durationMs / 1000).toFixed(1)}s`,
    input.frameworkNodes
      ? `FRAMEWORK (score structural_adherence against these nodes in order):\n${input.frameworkNodes
          .map((n, i) => `${i + 1}. ${n.label}: ${n.description}`)
          .join("\n")}`
      : null,
    // Phase 4 — RAG context block. Injected BEFORE deterministic signals
    // so the model has access to the rich anchors for the four
    // LLM-scored dims before reading the numerical signals + transcript.
    // Uncached (changes per rep based on transcript similarity).
    ragBlock,
    // Ch.11c — text-derived signals (FF-gated). Placed BEFORE prosody +
    // transcript so Claude sees the objective measurements first and
    // can score the four LLM-scored content dimensions AGAINST the
    // numbers rather than re-deriving them from the transcript.
    signalsBlock,
    prosodyBlock,
    hasWordTimestamps
      ? `TRANSCRIPT (inline [m:ss] markers are real timestamps; use them for callout ranges):\n${timedTranscript}`
      : `TRANSCRIPT:\n${timedTranscript}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Compute prompt size in bytes BEFORE the call so the metrics row
  // records what we actually shipped (cache_control blocks count even
  // when they're cache-read). Sums system blocks + user message text.
  const systemTextBytes = [systemPrompt, rubricBlock, COMPACT_KNOWLEDGE, SUB_SKILL_REFERENCE, input.userCalibration ?? "", input.coachingMemory ?? ""]
    .reduce((acc, s) => acc + Buffer.byteLength(s ?? "", "utf8"), 0);
  const userTextBytes = Buffer.byteLength(userPrompt, "utf8");
  const promptSizeBytes = systemTextBytes + userTextBytes;

  const scoreRepStart = Date.now();
  const { response, metrics: callMetrics } = await anthropic.messages.createWithMetrics({
    model: MODELS.scoring,
    // Bounded output: 6 dimension scores + ~3 callouts + didWell/didntLand/
    // nextRepFocus arrays. Phase 8 (2026-05-21) — Anthropic console logs
    // showed Haiku 4.5 hitting EXACTLY 2400 output tokens on every
    // production scoring call, meaning the response was truncating
    // mid-JSON and falling through to mock-fallback. 2400 was NOT the
    // 99th percentile in practice — it was the censoring ceiling. 4000
    // gives the model real room to finish; cost increase is ~$0.005
    // worst-case per call ($16 / 1M output × 1600 extra tokens) which
    // is rounding error vs. the 0% mock-fallback rate it buys us.
    max_tokens: 4000,
    // Calibration stability: Anthropic SDK defaults temperature to 1.0,
    // which causes 30-50pt run-to-run swings on the same input (documented
    // in docs/calibration-baseline-2026-05-d2.md). Dropping to 0.2 keeps
    // some output variation (helpful for callout phrasing diversity) but
    // tightens dim-score variance to ±2-5pt across runs — within the ±5
    // tolerance the harness gates against. We deliberately don't go to 0
    // because at temp=0 the LLM produces near-identical callouts on
    // similar reps, which surfaces in the user UI as repetitive feedback.
    temperature: 0.2,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text" as const,
        text: `RUBRIC (only the four LLM-scored dimensions; delivery and thinking_quality are scored separately):\n\n${rubricBlock}`,
        cache_control: { type: "ephemeral" as const },
      },
      ...(COMPACT_KNOWLEDGE
        ? [
            {
              type: "text" as const,
              text: `SCORING KNOWLEDGE (clarity, structure, conciseness, tone):\n\n${COMPACT_KNOWLEDGE}`,
              cache_control: { type: "ephemeral" as const },
            },
          ]
        : []),
      {
        type: "text" as const,
        text: `SUB-SKILL REFERENCE (for bullet \`subSkill\` field — must match the bullet's \`dimension\`):\n\n${SUB_SKILL_REFERENCE}`,
        cache_control: { type: "ephemeral" as const },
      },
      ...(input.userCalibration
        ? [
            {
              type: "text" as const,
              text: input.userCalibration,
              // NOT cache-controlled — user-specific.
            },
          ]
        : []),
      ...(input.coachingMemory
        ? [
            {
              type: "text" as const,
              text: input.coachingMemory,
              // NOT cache-controlled — user-specific (PRD §8.6.4).
            },
          ]
        : []),
    ],
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: userPrompt }],
      },
    ],
  }, promptSizeBytes);

  const validationStart = Date.now();
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  // CTO-scan C4 — defensive JSON parse:
  //   1. Size cap (64KB) before parse so a misbehaving model can't
  //      DOS the parser via deeply-nested arrays.
  //   2. Strip code fences, then extract the FIRST top-level {...}
  //      so a model that emits "Here's the JSON: {...}" parses cleanly
  //      instead of throwing.
  const MAX_JSON_BYTES = 64 * 1024;
  if (textBlock.text.length > MAX_JSON_BYTES) {
    throw new Error(
      `Scoring response exceeded ${MAX_JSON_BYTES}B size cap (${textBlock.text.length}B). First 500 chars: ${textBlock.text.slice(0, 500)}`,
    );
  }
  const stripped = textBlock.text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  // Greedy match for the outermost JSON object — handles "preamble {..} postamble"
  // shapes some non-Anthropic providers emit.
  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  const cleaned =
    firstBrace !== -1 && lastBrace > firstBrace
      ? stripped.slice(firstBrace, lastBrace + 1)
      : stripped;

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      `Scoring response was not valid JSON. Got: ${textBlock.text.slice(0, 500)}`,
    );
  }

  // Normalize provider quirks before validation. Anthropic + OpenAI
  // agree on the JSON shape but disagree on enum casing — when the
  // prompt instructs "use the snake_case sub-skill id" some models
  // return the human label ("Word Choice") instead. Map labels back
  // to ids so the schema parses cleanly. Idempotent: ids pass
  // through untouched.
  parsed = normalizeProviderQuirks(parsed);

  const validated = scoringResponseSchema.parse(parsed);

  // WS-4: post-LLM callout validator. The scoring prompt has BANNED
  // rules but belt-and-suspenders — we also check client-side and
  // filter any callouts whose title/body contain banned filler. Rather
  // than drop the whole response, we sanitize: filtered callouts get
  // replaced by a neutral-tone fallback so the 1-positive + 2-improvement
  // shape stays intact. In practice this is rare because the prompt's
  // authoring rules are strict.
  validated.callouts = sanitizeCallouts(validated.callouts);

  // Phase 2: anti-hallucination grounding. Strip quote/timestamp anchors
  // when the AI claims a transcript moment we can't verify. Bullets
  // remain in the response — only the false specificity is removed.
  const sanitizedDidWell = sanitizeSubSkills({
    bullets: sanitizeBullets({
      bullets: validated.didWell as FeedbackBullet[],
      transcript: input.transcript,
      durationMs: input.durationMs,
      label: "didWell",
    }),
    label: "didWell",
  });
  const sanitizedDidntLand = sanitizeSubSkills({
    bullets: sanitizeBullets({
      bullets: validated.didntLand as FeedbackBullet[],
      transcript: input.transcript,
      durationMs: input.durationMs,
      label: "didntLand",
    }),
    label: "didntLand",
  });
  const sanitizedNextRepFocus = sanitizeSubSkills({
    bullets: sanitizeBullets({
      bullets: validated.nextRepFocus as NextRepFocusItem[],
      transcript: input.transcript,
      durationMs: input.durationMs,
      label: "nextRepFocus",
    }),
    label: "nextRepFocus",
  });

  const dimensionMap: Partial<Record<SkillDimension, number>> = {};
  for (const d of validated.dimensions) {
    dimensionMap[d.dimension] = d.score;
  }

  // ——— Hybrid scoring layer ——————————————————————————————
  // Pacing is OVERRIDDEN by the deterministic scorer (pure function)
  // so its trend lines are mathematically stable across time. This is
  // the calibration-ready layer that David flagged in the advisory
  // meeting — re-scoring the same audio returns the same pacing number.
  //
  // Confidence is BLENDED (60% deterministic / 40% LLM) because the
  // semantic "did they sound sharp" layer genuinely adds signal
  // on top of the measurable hedge/restart/pause baseline.
  //
  // Clarity, structure, conciseness, and tone stay LLM-scored as-is.
  let finalDimensions = validated.dimensions.map((d) => ({ ...d }));
  if (input.words && input.words.length > 0) {
    const signalBundle = extractSignals({
      words: input.words,
      transcript: input.transcript,
      durationMs: input.durationMs,
      timeBudgetMs: input.timeBudgetMs ?? input.durationMs,
    });

    // Delivery — pure deterministic override (was "pacing" in v2-beta.*)
    const deliveryResult = scorePacing(signalBundle);
    dimensionMap.delivery = deliveryResult.score;
    finalDimensions = finalDimensions.map((d) =>
      d.dimension === "delivery"
        ? {
            dimension: "delivery" as const,
            score: deliveryResult.score,
            signals: deliveryResult.signals,
          }
        : d,
    );

    // Thinking Quality — hybrid blend with LLM layer (was "confidence")
    const thinkingDet = scoreThinkingQualityDeterministic(signalBundle);
    const llmThinking = dimensionMap.thinking_quality ?? 60;
    const thinkingBlended = blendScores(thinkingDet.score, llmThinking, 0.6);
    dimensionMap.thinking_quality = thinkingBlended;
    finalDimensions = finalDimensions.map((d) =>
      d.dimension === "thinking_quality"
        ? {
            dimension: "thinking_quality" as const,
            score: thinkingBlended,
            signals: [
              ...thinkingDet.signals,
              `(LLM semantic layer: ${llmThinking})`,
            ],
          }
        : d,
    );
  }

  // Ch.11c — attach per-sub-skill scores from the signal mapper. Runs
  // ONLY when the FF gated SIGNALS block was rendered above
  // (textSignals != null).
  if (signalsFlagOn && textSignals) {
    // Ch.S5: pass prosody features so the mapper can populate the
    // voice-measured skills (filler/wpm DSP + Hume emotion vectors) when
    // available. Taxonomy v2 (D20): only genuinely-measured skills get
    // entries — no dimension_fallback copies.
    const subSkillMap = mapSignalsToSubSkillScores(
      textSignals,
      prosodyFeatures,
    );
    const allScores = toScoresOnly(subSkillMap);
    finalDimensions = finalDimensions.map((d) => {
      const subScores = pickSubSkillsForDim(allScores, d.dimension);
      return subScores ? { ...d, subSkillScores: subScores } : d;
    });
  }

  const compositeScore = composite(dimensionMap, input.weights);

  const validationDurationMs = Date.now() - validationStart;
  const scoreRepTotalMs = Date.now() - scoreRepStart;

  const score: RepScore = {
    composite: compositeScore,
    dimensions: finalDimensions,
    ...(validated.structuralAdherence != null
      ? { structuralAdherence: validated.structuralAdherence }
      : {}),
    callouts: validated.callouts,
    // Grading v3 (3.2) — record the ACTUAL serving model (already
    // provider-tagged by the shim: "gpt-4o", "openai-fallback:gpt-4o",
    // "anthropic-fallback:claude-…"), not the role constant that used
    // to misreport gpt-4o reps as claude-scored.
    modelVersion: callMetrics.modelUsed ?? MODEL_VERSIONS.scoring,
    rubricVersion: RUBRIC_VERSION,
    headline: validated.headline,
    didWell: sanitizedDidWell,
    didntLand: sanitizedDidntLand,
    nextRepFocus: sanitizedNextRepFocus,
    primaryFocusDimension: validated.primaryFocusDimension,
    headlineTone: validated.headlineTone,
    nextRepHint: validated.nextRepHint,
    // PRD v3 engine — present only on retry-evaluated reps. Null-coalesced
    // so first reps / legacy calls keep an absent field.
    ...(validated.implementationReview
      ? { implementationReview: validated.implementationReview }
      : {}),
    feedbackVersion: FEEDBACK_VERSION,
    prosodyAvailable: hasWorkerProsody(prosodyFeatures),
    // Ch.5 — composite ≥ 95 triggers operator review. We do NOT hold
    // back the score from the user; they see it immediately. The flag
    // surfaces in /ops so operators can retroactively confirm or correct.
    requiresHumanReview: compositeScore >= 95,
  };

  return {
    score,
    metrics: {
      ...callMetrics,
      validationDurationMs,
      scoreRepTotalMs,
      ragDurationMs: ragResult.durationMs,
      ragChunkCount: ragResult.chunks.length,
    },
  };
}
