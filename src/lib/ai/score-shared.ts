import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  anthropic,
  MODELS,
  MODEL_VERSIONS,
  type AnthropicCallMetrics,
} from "./claude";
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
  RepScore,
  DimensionScore,
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
  synthesizeProsodyBaseline,
} from "@/lib/audio/prosody-inline";
import { getWordCount, durationToMinutes } from "@/lib/scoring/signals/_helpers";
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
  // Grading Engine V2 (lean-output arm) — the LLM `signals` narratives are
  // persisted to `dimension_scores.signals` but NEVER rendered in any UI
  // (they round-trip into RepScore and stop there). The lean-output prompt
  // drops the field from its output contract to cut decode tokens, so the
  // schema must tolerate its absence. Optional-with-default is byte-neutral
  // for control: control still emits `signals`, so the value is used and the
  // default never triggers — the parsed object is identical to before.
  // `.default(() => [])` (function form) returns a FRESH array each parse, so
  // defaulted dimensions never alias a shared instance.
  signals: z.array(z.string()).optional().default(() => []),
  /** Grading v3 (§4.5.3) — 1-2 sentence per-skill feedback for the
   *  expanded Core Skill Breakdown card. Lenient: absent on quirky
   *  provider outputs; the card falls back to a neutral line. */
  feedback: z.string().min(1).max(400).optional(),
  /** Grading v3 — the hidden skill that most drove the score. LENIENT:
   *  invalid ids coerce to null (label→id mapping happens in
   *  normalizeProviderQuirks first). */
  subSkill: z
    .string()
    .nullable()
    .optional()
    .catch(null),
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

/** Grading v3 (§4.5.2 + §8.6.2) — THE single Coach's Focus. */
const coachFocusSchema = z.object({
  dimension: z.enum([
    "clarity",
    "structure",
    "conciseness",
    "thinking_quality",
    "delivery",
    "tone",
  ]),
  /** LENIENT — label→id mapping happens in normalizeProviderQuirks;
   *  anything still invalid coerces to null (sanitizer also strips
   *  dimension mismatches). */
  subSkill: z.string().nullable().optional().catch(null),
  behavior: z.string().min(1).max(200),
  why: z.string().min(1).max(280),
  action: z.string().min(1).max(220),
});

/** Grading v3 (§4.6, Edit #5) — Stronger Version: the user's own content,
 *  upgraded. quote is substring-validated post-parse; a mismatch nulls
 *  the WHOLE object (never an invented quote on screen). */
const strongerVersionSchema = z
  .object({
    // quote is a verbatim substring of the transcript (post-validated
    // character-for-character below), so its only real bound is the
    // transcript length. The prompt asks for a focused "moment" phrase and
    // never states a char cap, so the model can't self-limit — on
    // comma-spliced run-on answers gpt-4o legitimately quotes a long span.
    // A 400 cap rejected those responses outright and dropped /api/score
    // into mock-fallback (same failure the `headline` cap hit in May 2026).
    // 1000 covers realistic long-moment quotes without weaponizing the cap;
    // the "phrase" instruction keeps the normal case short.
    quote: z.string().min(1).max(1000),
    // rewrite is instructed to a ≤600 hard cap in the prompt; the schema
    // keeps a small margin so an occasional overshoot doesn't mock-fallback.
    rewrite: z.string().min(1).max(700),
  })
  .nullable();

/** Exported for tests/grading-v3-contract.test.ts only. */
export const scoringResponseSchema = z.object({
  dimensions: z.array(dimensionScoreSchema).length(ALL_DIMENSIONS.length),
  structuralAdherence: z.number().min(0).max(100).nullable().optional(),
  /** One-line diagnostic verdict — see HEADLINE RULES in systemPrompt.
   * Cap was 120 but prod logs (May 2026) showed Haiku regularly emitting
   * 130-150 char headlines on rich-signal reps; rejecting them dropped
   * /api/score into mock-fallback. 200 keeps the headline visibly
   * one-line on the ScoreHero (~2 lines on mobile worst-case) without
   * weaponizing the cap. */
  headline: z.string().min(1).max(200),
  coachFocus: coachFocusSchema,
  strongerVersion: strongerVersionSchema,
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

SCORE CALIBRATION (apply before writing any feedback):
  - Use the FULL 0-100 range in both directions. A rep that fully accomplishes the prompt with visible structure, concrete support, and clean pacing MUST land 85+ on the dimensions it nails. Do not withhold the top band because "there is always something to improve" — there always is, and 90 already means that.
  - Anchors: mic-test ramble = ~20. Generic answer that addresses the prompt without evidence or shape = ~55. Solid answer with real structure and support but visible rough edges = ~72. Tight, evidenced, well-paced answer = ~85. An elite answer that sizes the problem, proves it with specifics, and closes with a clear ask or vision = 88-93 on the dimensions it nails. Flawless with a memorable close = ~93+.
  - ANTI-COMPRESSION (the top failure mode of this model): do NOT let scores pile up in the 68-78 band. That range is only for reps with a real, nameable rough edge in that dimension. If you cannot name a specific deficiency in a dimension, you are already in the 80s or 90s — place the score there; do not hedge it down to 75 out of caution. A genuinely excellent rep should show several dimensions in the high 80s or low 90s. Capping strong work at 72-78 "to be safe" is a scoring error, not rigor. The middle band must be EARNED by a flaw you can point at, never assigned as a default.
  - CLARITY and STRUCTURE ceilings specifically: a rep with a clean, complete arc — main point lands early, ideas are sequenced, a real close — has clarity AND structure in the mid-to-high 80s (85-90), NOT parked at 78. "I could imagine a slightly better version" is not a deficiency; 78 means a rough edge you can name out loud. A clean, complete, well-sequenced answer has none, so score it 85+. (This does NOT lift CLARITY on reps that rely on audience-mismatched jargon, nor STRUCTURE on reps that actually miss a close or wander in the middle — those keep their real lower scores. It does NOT change edge rule 2: a hollow-but-clearly-scaffolded rep still scores Structure 70+ — the hollowness comes out of Thinking Quality, never Structure. And edge rule 2b still governs disorganized-but-deep reps.)
  - Pick each dimension's BAND first (from the Bands lists in the rubric), then the point score inside it. The feedback line you write must agree with the band: if your feedback names no real deficiency for that dimension, the score must be ≥80 — never invent a nitpick to justify a middle score.
  - You will ALWAYS name a coachFocus and per-skill feedback, even on a 95 rep. Having something to coach is NOT evidence the rep is mediocre — do not let the coaching requirement drag scores toward the middle.
  - DIMENSION INDEPENDENCE: score each dimension in ISOLATION. Mixed profiles (90 on one dimension, 25 on another) are common and intentional in training reps. Never let one dimension's failure bleed into another's score: hollow content does not lower Structure, a meandering shape does not lower Thinking Quality, and brilliant insight does not raise Structure.
  - THINKING QUALITY — depth is NOT evidence-count: score thinking_quality on the QUALITY OF REASONING, not the presence of numbers, citations, or explicit counterarguments. A causal chain, correctly framing the problem, naming the load-bearing variable, distinguishing the cases that flip the answer, or reasoning about non-replicability and second-order effects are all HIGH thinking (75+) — even in brief, number-free, or disorganized speech. Never write "lacks depth" or "add evidence" about a response whose real defect is disorganization (that hits Structure) or padding/length (that hits Conciseness). Insight packaged in two sentences is still insight. When a response carries the FULL reasoning arc its format demands — a pitch that sizes the problem, names the mechanism, proves it, and closes; an answer that infers a cause from evidence and acts on it; a reframe that dissolves the objection — thinking_quality is 85-92, NOT 75-78. Do not park strong reasoning at 78 out of habit.

Return ONLY a JSON object (no prose, no markdown fences):

{
  "dimensions": [
    { "dimension": "clarity"|"structure"|"conciseness"|"thinking_quality"|"delivery"|"tone", "score": 0-100, "signals": ["..."], "feedback": "1-2 sentences, see PER-SKILL FEEDBACK RULES", "subSkill": "snake_case id from the SUB-SKILL REFERENCE that most drove this score"|null }
  ],
  "structuralAdherence": 0-100 (only when frameworkNodes provided, else omit),
  "headline": "one-line verdict, see HEADLINE RULES below",
  "coachFocus": { "dimension": "...", "subSkill": "snake_case id"|null, "behavior": "...", "why": "...", "action": "..." },
  "strongerVersion": { "quote": "verbatim phrase copied character-for-character from the transcript", "rewrite": "the user's own content, upgraded" } | null,
  "headlineTone": "blunt"|"directive"|"praise"|"celebratory",
  "nextRepHint": "3-8 word continuation tail for the next rep's banner"
}

HEADLINE RULES (the single most important sentence the user reads):
  - One sentence, ≤90 chars, second-person ("you"), present-tense, no hedging.
  - It is the diagnostic verdict — the single most important truth about THIS rep. Not a stat number, not a list.
  - Tone scales with the composite score you assigned:
      composite < 50  → blunt diagnosis: name what actually failed in this rep.
      50–74           → directive: name the one fix that moves the score most for this rep.
      75–89           → specific praise + sharpening edge: name what worked, then the one thing between it and a 90.
      ≥ 90            → celebratory + raise the bar: nothing to fix, so push them to a harder variation.
  - The headline MUST be specific to THIS transcript: reference the actual content, moment, or move this speaker made. The four lines above are tone guidance, NOT text to output.
  - CRITICAL — never output a stock sentence. If the same headline could be pasted onto a different rep, it is too generic: rewrite it around what THIS speaker specifically said or did — one concrete detail, still within the ≤90-char limit (specific does not mean long). A reader who never saw the transcript should still be able to tell which rep it describes.
  - Junk reps / off-prompt rambles get an honest verdict, not coaching — state plainly that it did not answer the prompt.
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

PER-SKILL FEEDBACK RULES (dimensions[].feedback — the expandable Core Skill Breakdown copy):
  - 1-2 tight sentences per dimension: WHY this score, in terms of what the speaker actually did.
  - Strong scores (≥75) name the effective behavior worth keeping. Weak scores name the gap and what closing it sounds like.
  - Second-person, present-tense, no hedging, ≤400 chars.
  - Must NOT introduce a second coaching objective that competes with coachFocus — per-skill feedback explains the score; coachFocus owns "what to change next".
  - dimensions[].subSkill: the snake_case id of the hidden skill that most drove the score. It must belong to that dimension (use the SUB-SKILL REFERENCE). Mismatches are sanitized to null.

COACH'S FOCUS RULES (exactly ONE per rep — this is the most important output):
  - The single highest-leverage behavior change for the next attempt. Never multiple objectives.
  - Three parts, each answering one question (coach behaviors, not scores):
      behavior : what specific behavior held the user back (≤200 chars, names what they DID, not a score)
      why      : why that behavior matters for the listener (≤280 chars)
      action   : the ONE thing to do differently on the retry (≤220 chars, imperative, immediately performable)
  - When a MODE block names a focusDimension, the coachFocus must come from that dimension unless it scored ≥85 and another dimension is <60 (mirror the headline pivot rule).
  - On a RETRY (RETRY EVALUATION block present): coachFocus is the NEXT development opportunity — acknowledge what carried over in \`why\` when the coached behavior improved.
  - subSkill: the specific lever within the dimension, from the SUB-SKILL REFERENCE. Must belong to coachFocus.dimension.

STRONGER VERSION RULES (§4.6 — "a stronger version based off what I said"):
  - Pick the single transcript moment where an upgrade teaches the most (usually the coachFocus dimension's weakest moment).
  - quote: copied CHARACTER-FOR-CHARACTER from the transcript. Paraphrasing is rejected by the post-validator and the whole strongerVersion is discarded.
  - rewrite: the user's OWN content and ideas, upgraded — same message, same facts, their voice, speakable out loud. NEVER a generic exemplar, NEVER invented facts or claims they didn't make. Same length or shorter than the quote where possible (≤600 chars hard cap).
  - null ONLY for junk reps (composite < 25, off-prompt rambles) where no real content exists to upgrade.

BANNED in headline, feedback, coachFocus, or strongerVersion: "good job", "great job", "nice work", "nice job", "well done", "way to go", "keep it up", "you got this", "you're doing great", "you did well". Drop filler adverbs (really, very, quite). Avoid hype verbs (crushed, absolutely, completely nailed).

ANTI-HALLUCINATION RULES:
  - Never write "you said X" / "when you mentioned X" without X being verbatim from the transcript.
  - strongerVersion.quote is validated character-for-character (whitespace-insensitive) — a fabricated quote discards the whole strongerVersion.
  - If you can't find the exact phrase, write dimension-level feedback instead. Generic-but-honest beats fabricated-specific.

PROSODY EVIDENCE SCOPE:
  - When a PROSODY block is present in the user message, ground the delivery and tone scores (and their feedback lines) in it.
  - PROSODY EVIDENCE informs delivery and tone ONLY. Never let vocal measurements move clarity, structure, conciseness, or thinking_quality.
  - The reverse also holds: Tone grades the VOICE, not the words. Mediocre content delivered with genuinely expressive prosody is HIGH tone + low content scores — do not drag tone down because the argument was weak.
  - Map the measurements to tone bands directly: pitch std ≥3 semitones with monotone ratio <20% and no upspeak pattern = healthy vocal variety, tone 70-85 (higher when volume also varies and articulation is crisp). Sustained monotone (monotone ratio >60% or pitch std <1 semitone) = tone ≤45. Between those, interpolate. Vocal variety AT target is strong tone — do not hold it in the 50s out of rigor.
  - When NO prosody/audio evidence is present, grade tone conservatively toward band center (55-70) from text alone — do not invent vocal qualities.
  - When NO prosody/audio evidence is present, grade DELIVERY from the MEASURED RATE line and transcript fluency — and be CONSISTENT: any rep with a measured rate in ~130-165 and clean, non-repetitive, low-filler sentences lands delivery 76-82 (default 78). Do NOT floor delivery into the 40s-50s, and do NOT scatter it 55-84 run to run, merely because you cannot hear pauses — you CAN read rate, filler, and repetition from the transcript, and those are what you score. Go BELOW 70 only when you can point to a specific cause: a measured rate well outside 130-165, or transcript evidence of heavy filler / restarts / off-prompt rambling.

EDGE-CASE GRADING RULES (Ch.5 — DNA spec §"Edge Case Grading Guidelines" — these override the per-dimension rubric in the listed conflicts):
  1. Brevity-at-cost-of-meaning: a response that is concise but loses the meaning takes the hit on CLARITY, not as a Conciseness reward. Honest score: low Clarity (idea didn't land), neutral Conciseness (don't reward erasing meaning).
  2. Shallow-but-organized: Structure grades the SCAFFOLD ONLY — opening direction, ordering, transitions, close. If the scaffold is clearly visible, Structure scores 70+ even when every point inside it is hollow, tautological, or absurd; the hollowness is Thinking Quality's hit (LOW), not Structure's. Explicit signposting — "First… Second… Third… So the conclusion is…" — IS clearly-visible scaffolding BY DEFINITION: score Structure 70+ (never below 65) even when the numbered points are circular, evidence-free, or don't logically connect. The broken logic BETWEEN the points is Thinking Quality's hit, never Structure's — a rep that overtly numbers its sections and states a conclusion has strong structure and weak thinking, and those two scores must diverge, not converge. A hollow-but-scaffolded rep that addresses the prompt is NOT a junk rep — junk means mic-test/off-prompt. Do NOT let weak reasoning bleed into the Structure score, and do NOT reward organization on the Thinking side.
  2b. Disorganized-but-deep (the mirror case — and the one you most often get WRONG): score the REASONING on its own merits even when the packaging meanders. False starts, loops, run-on comma-splices, and missing scaffolds hit Structure (LOW), not Thinking Quality. Insight that reframes the problem — naming the load-bearing variable, distinguishing cases that change the answer (e.g. "at ten thousand requests maybe fine, at a hundred thousand it breaks"), surfacing a hidden cost, or landing on the real deciding factor — is HIGH thinking (75+) regardless of how untidy the shape is. CRITICAL: when a rep rambles but the CONTENT discriminates cases and finds what actually matters, thinking_quality MUST land ABOVE structure — often well above (thinking 70-80 while structure sits 40-50). Do NOT let the messy delivery drag the thinking score down toward the structure score; that is the exact bleed DIMENSION INDEPENDENCE forbids. In a thinking-out-loud format, exploratory phrasing ("my read is", "the part I keep coming back to", "now that I say it out loud") is analysis in progress, NOT weak conviction — judge whether the underlying reasoning discriminates cases and finds what matters, not how confidently it is packaged.
  3. Fast-and-no-fillers: a response delivered at 220+ wpm without filler words still scores LOW on Delivery. Rate is part of pacing — speed isn't competence. The well-paced range is roughly 130-165 wpm (150-160 is the center); measured speech anywhere in 130-165 reads as well-paced and is NOT docked on rate. BUT the widened band is symmetric only at the low end: rates ABOVE ~170 wpm are rushed and DO dock Delivery (the faster past 170, the lower — ~180-200 wpm caps Delivery around 45-55, and 220+ is a hard low in the 30s), even with zero fillers.
  4. Variety-with-upspeak: a response with strong vocal variety BUT consistent rising inflection on statements scores LOW on Tone. Upspeak undercuts authority. Strong variety does NOT cancel out an upspeak pattern.
  5. Short-but-deep: a response under 30 seconds is NOT penalized for length alone. Evaluate whether the brevity served the prompt — if the rep fully engaged the prompt with strong thinking and no filler, it can score high. If it dodged depth, Thinking Quality drops regardless of other qualities.
  7. Depth-appropriate-to-format: judge Thinking Quality against what the FORMAT calls for. A 30-second pitch or objection response with a causal chain, correct framing, and a clear ask is 85+ thinking — do NOT dock it for missing counterarguments or hedged nuance that the format has no room for. A FULLY-REALIZED pitch or persuasive answer that sizes the problem, names the mechanism, proves it with specifics, works the unit economics, and closes with an ask and a vision is 88+ thinking — that IS the top band for the format; do not settle it at 75-78. Causal insight, correct problem-framing, and non-replicability / second-order reasoning COUNT AS DEPTH even with zero numbers: a two-sentence answer that identifies WHY a result won't generalize (a selection effect, a hidden cost, the deciding variable) is high thinking (75+), not "lacks depth." Reserve the counterargument expectation for formats that invite it (defenses, recommendations, debates).
  8. Padding-is-not-concise: Conciseness is signal-per-word, not just low filler. A rep that enumerates every instance where a summary would do (walking through each day/item one by one), restates the same point in fresh words, or stacks redundant examples scores LOW on Conciseness (40s-50s) even with zero hedges and zero fillers. Clean sentences do not redeem redundant content.
  6. Composite ≥ 95: such a response should be exceptionally rare. Point coachFocus at the LOWEST-scoring dimension regardless of focus mode (it is the only remaining work). The post-validator will set requiresHumanReview=true on responses scoring ≥95.

HEADLINE TONE BAND (calibration scaffold — pick the band you wrote the headline in):
  - "blunt"       — composite < 50, headline names what failed.
  - "directive"   — 50-74, headline names the one fix.
  - "praise"      — 75-89, specific praise + sharpening edge.
  - "celebratory" — ≥ 90, raise-the-bar framing.
  Pick the band that actually matches the headline you wrote, not the score range — they should align, but if you wrote softer copy than the band suggests, report what you wrote.

NEXT REP HINT:
  - 3-8 words, present-tense, second-person, no period.
  - Becomes the tail of the next rep's "Last rep focus: <dim> — <hint>" banner.
  - Tied to the coachFocus dimension. Specific over generic when possible:
      generic   : "keep building on it"
      specific  : "land the open before the ask"
  - No filler verbs ("focus on", "work on") — give an action.`;

/**
 * Grading Engine V2 — the lean-output scoring prompt. DERIVED from the
 * control `systemPrompt` by surgical, anchored substitutions rather than a
 * forked copy, so every rule the lean arm does NOT touch (scoring
 * calibration, edge cases, headline/coachFocus/strongerVersion contracts)
 * tracks the control prompt automatically and can never silently drift.
 *
 * It cuts ONLY the accuracy-neutral output-token sources — the never-
 * rendered per-dimension `signals` array and the over-long per-dimension
 * `feedback` cap (400→160 chars, 1-2 sentences → 1). Dimension SCORES,
 * headline, coachFocus, and strongerVersion are all left byte-identical, so
 * the numbers the user sees are produced by exactly the same reasoning — the
 * arm trims prose the model writes, not the judgment behind the scores.
 *
 * If an anchor no longer matches, `leanEdit` logs and returns the source
 * UNCHANGED rather than throwing. This is deliberate: throwing here would run
 * at module load and take down the whole scoring module — 500ing the CONTROL
 * path (the shipped default) for a break in the dormant lean arm's transform.
 * Instead the lean prompt degrades toward the control prompt (worst case: the
 * lean arm stops cutting tokens but still produces valid scores), and the unit
 * tests that assert each edit landed (tests/scoring-arms.test.ts) turn red in
 * CI before any such break can merge. Graceful in prod, loud in CI.
 */
function leanEdit(source: string, find: string, replace: string): string {
  if (!source.includes(find)) {
    console.error(
      `LEAN_SYSTEM_PROMPT: anchor not found in systemPrompt — a base edit broke a lean transform (lean arm will not cut this token source). Missing anchor: ${JSON.stringify(
        find.slice(0, 60),
      )}...`,
    );
    return source;
  }
  return source.replace(find, replace);
}

/**
 * Grading Engine V2 (latency, PIVOT 2026-07-21) — build a lean system prompt
 * at a PARAMETERIZED per-dimension feedback char cap. The 2026-07-21 lean
 * sweep shipped a fixed 160-char cap; Max judged that "too lean to get to
 * prod" (feedback must stay helpful). This factory lets the bench sweep
 * milder caps (400→320/280/240) to find the least-aggressive trim that still
 * saves tokens without a quality loss.
 *
 * Two independent levers, composed by `feedbackCap`:
 *   - `signals`-drop: ALWAYS applied (the field is never rendered in any UI —
 *     pure dead output, zero quality cost). `feedbackCap === 400` therefore
 *     yields the strictly-safe "signals-only" floor: the invisible field is
 *     gone, but the feedback prose is byte-identical to control (same ≤400
 *     cap, same "1-2 sentences").
 *   - feedback-cap: applied only when `feedbackCap < 400`. Below ~200 chars a
 *     single sentence is the honest instruction, so the "1-2 sentences" hints
 *     tighten to "1 sentence" too; at 240-320 the two-sentence framing is
 *     kept (there is room for it) and ONLY the char ceiling drops.
 *
 * Derived from control's `systemPrompt` by anchored `leanEdit` subs (guarded:
 * a broken anchor logs + returns source unchanged rather than throwing at
 * module load — see leanEdit), so every untouched rule tracks control.
 */
function buildLeanSystemPrompt(feedbackCap: number): string {
  let p = systemPrompt;
  const oneSentence = feedbackCap <= 200;
  // 1) Output schema line: ALWAYS drop the never-rendered `signals` field;
  //    tighten the feedback-count hint only when the cap is single-sentence.
  p = leanEdit(
    p,
    `, "signals": ["..."], "feedback": "1-2 sentences, see PER-SKILL FEEDBACK RULES"`,
    `, "feedback": "${oneSentence ? "1 sentence" : "1-2 sentences"}, see PER-SKILL FEEDBACK RULES"`,
  );
  // 2) PER-SKILL FEEDBACK RULES — collapse to one sentence only at tight caps.
  if (oneSentence) {
    p = leanEdit(
      p,
      `  - 1-2 tight sentences per dimension: WHY this score`,
      `  - 1 tight sentence per dimension: WHY this score`,
    );
  }
  // 3) PER-SKILL FEEDBACK RULES — drop the char cap only when tighter than
  //    control's 400 (feedbackCap===400 is signals-only, prose untouched).
  if (feedbackCap < 400) {
    p = leanEdit(
      p,
      `  - Second-person, present-tense, no hedging, ≤400 chars.`,
      `  - Second-person, present-tense, no hedging, ≤${feedbackCap} chars.`,
    );
  }
  return p;
}

/** The `lean-output` arm's feedback cap. NOTE: 160 is the ORIGINAL lean arm
 *  that Max judged "too lean to ship". The bench since decided the shippable
 *  variant is `signals-drop` (=leanFeedbackCap 400 — drop the invisible
 *  `signals` field, keep control's full feedback prose); see the `signals-drop`
 *  arm in score-arms.ts. This constant remains the cap for the dormant
 *  `lean-output`/`lean-split` building blocks only. */
export const LEAN_FEEDBACK_CAP_DEFAULT = 160;

const leanPromptCache = new Map<number, string>();
/** Memoized lean-prompt builder — one string per cap, rendered once. */
export function leanSystemPromptFor(feedbackCap: number): string {
  let cached = leanPromptCache.get(feedbackCap);
  if (cached === undefined) {
    cached = buildLeanSystemPrompt(feedbackCap);
    leanPromptCache.set(feedbackCap, cached);
  }
  return cached;
}

/** The default (160-char) lean prompt — the shipped lean-output arm + all
 *  existing `lean: true` call sites. Byte-identical to the pre-parameterized
 *  IIFE. */
export const LEAN_SYSTEM_PROMPT: string = leanSystemPromptFor(
  LEAN_FEEDBACK_CAP_DEFAULT,
);

/** Resolve which system prompt a scoring call uses from the two lean knobs.
 *  `leanFeedbackCap` (explicit cap, for the milder-trim sweep) wins over the
 *  boolean `lean` (=default 160 cap). Returns null when neither is set → the
 *  caller uses the control `systemPrompt` (byte-identical control path). */
function resolveLeanPrompt(opts: {
  lean?: boolean;
  leanFeedbackCap?: number;
}): string | null {
  if (opts.leanFeedbackCap != null) return leanSystemPromptFor(opts.leanFeedbackCap);
  if (opts.lean) return LEAN_SYSTEM_PROMPT;
  return null;
}

/**
 * Compact rubric block — definitions + signals for the four LLM-scored
 * dimensions only (delivery + thinking_quality are deterministic, no
 * need to spend tokens describing them to the model). Capped to keep
 * the system prompt under ~3KB after caching.
 *
 * Ch.13 — when `withAnchors=true`, interleaves the per-dim band anchors
 * from `rubric-anchors.ts`. Since rubric v4.0.0 the anchored variant is
 * the only one rendered (band compression on gpt-4o without it); the
 * FF_BAND_ANCHORS gate is retired.
 */
const LLM_SCORED_DIMENSIONS: SkillDimension[] = [
  "clarity",
  "structure",
  "conciseness",
  "tone",
];

/** Grading v3 — the rubric block covers ALL SIX dims: even though the
 *  delivery NUMBER is deterministically overridden and thinking_quality
 *  is blended, the model must justify a per-skill `feedback` line for
 *  every dimension (§4.5.3). Knowledge blocks stay scoped to
 *  LLM_SCORED_DIMENSIONS (they're an order of magnitude bigger). */
const RUBRIC_DIMENSIONS: SkillDimension[] = [
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "tone",
];

function renderRubric(withAnchors = false): string {
  return RUBRIC_DIMENSIONS.map((d) => {
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


function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}


/** Generic banned-phrase check for the v4 copy fields. */
export function containsBannedPhrase(text: string): boolean {
  const hay = text.toLowerCase();
  return CALLOUT_BANNED_PHRASES.some((p) => hay.includes(p));
}

/** Log for prompt-drift auditing; the copy itself is kept (praise filler
 *  in a feedback line is awkward, not harmful — unlike a fabricated
 *  quote). Returns {} so it composes into object spreads. */
function logBannedAndKeep(field: string, text: string): Record<string, never> {
  console.warn(`[score] ${field} tripped banned-phrase filter (kept):`, {
    text: text.slice(0, 80),
  });
  return {};
}

/** Sub-skill attribution must belong to the dimension it's attached to
 *  (Vocabulary Precision belongs to Clarity, not Structure). Mismatches
 *  and unknown ids strip to null. */
export function sanitizeDimSubSkill(
  dimension: SkillDimension,
  subSkill: string | null | undefined,
): SubSkillId | null {
  if (!subSkill) return null;
  const canonical = canonicalizeSubSkillId(subSkill);
  if (!canonical) return null;
  if (SUB_SKILL_TO_DIMENSION[canonical] !== dimension) {
    console.warn(
      `[score] dimension subSkill mismatch; stripping:`,
      { dimension, subSkill: canonical },
    );
    return null;
  }
  return canonical;
}

type RawCoachFocus = {
  dimension: SkillDimension;
  subSkill?: string | null;
  behavior: string;
  why: string;
  action: string;
};

/** Grading v3 — sanitize the Coach's Focus: sub-skill mismatch strips to
 *  null; banned phrases log; `text` (the composed one-liner every legacy
 *  consumer reads: coaching_events.focusText, retry context, coaching
 *  memory) is the action line. */
export function sanitizeCoachFocus(cf: RawCoachFocus): NonNullable<
  RepScore["coachFocus"]
> {
  for (const [field, value] of [
    ["behavior", cf.behavior],
    ["why", cf.why],
    ["action", cf.action],
  ] as const) {
    if (containsBannedPhrase(value)) {
      logBannedAndKeep(`coachFocus.${field}`, value);
    }
  }
  return {
    dimension: cf.dimension,
    subSkill: sanitizeDimSubSkill(cf.dimension, cf.subSkill),
    behavior: cf.behavior,
    why: cf.why,
    action: cf.action,
    text: cf.action,
  };
}

/** Grading v3 (§4.6) anti-hallucination — the Stronger Version quote must
 *  be a verbatim (whitespace-collapsed, case-insensitive) transcript
 *  substring; otherwise the WHOLE object is discarded. */
export function sanitizeStrongerVersion(opts: {
  strongerVersion: { quote: string; rewrite: string } | null;
  transcript: string;
}): { quote: string; rewrite: string } | null {
  const sv = opts.strongerVersion;
  if (!sv) return null;
  const haystack = normalizeForMatch(opts.transcript);
  const needle = normalizeForMatch(sv.quote);
  if (needle.length === 0 || !haystack.includes(needle)) {
    console.warn(
      "[score] strongerVersion quote not found in transcript; discarding:",
      { quote: sv.quote.slice(0, 80) },
    );
    return null;
  }
  if (containsBannedPhrase(sv.rewrite)) {
    logBannedAndKeep("strongerVersion.rewrite", sv.rewrite);
  }
  return sv;
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
    `  - coachFocus in your output is the NEXT development opportunity (it may stay on the same behavior only if the implementation was missed).`,
    `  - strongerVersion must quote the NEW transcript below, never the first attempt.`,
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
    // Edit #7 — coaching for prep reps must be about SUCCEEDING AT THIS
    // EVENT. Same only-when-present block ⇒ calibration-safe.
    `Coaching relevance rule: the coachFocus (behavior/why/action), strongerVersion, and per-skill feedback must be written for succeeding at THIS ${ec.eventType} — reference its stakes and audience, never generic communication advice that ignores the event.`,
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



/**
 * Grading v3 — normalize provider quirks on the v4 shape before Zod.
 * The gpt-4o omission class (fields dropped entirely → undefined →
 * nullable schema rejects) caused the 2026-05-21 validation_failed
 * wave; every nullable v4 field gets the same missing→null coercion,
 * and sub-skill ids get label→id mapping.
 */
export function normalizeProviderQuirks(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  const obj = { ...(parsed as Record<string, unknown>) };

  if (Array.isArray(obj.dimensions)) {
    obj.dimensions = obj.dimensions.map((d) => {
      if (!d || typeof d !== "object") return d;
      const dim = { ...(d as Record<string, unknown>) };
      if ("subSkill" in dim) {
        dim.subSkill = normalizeSubSkillField(dim.subSkill);
      } else {
        dim.subSkill = null;
      }
      // Some providers emit feedback:null instead of omitting — the
      // optional (not nullable) schema wants it absent.
      if (dim.feedback === null) delete dim.feedback;
      return dim;
    });
  }

  if (obj.coachFocus && typeof obj.coachFocus === "object") {
    const cf = { ...(obj.coachFocus as Record<string, unknown>) };
    if ("subSkill" in cf) {
      cf.subSkill = normalizeSubSkillField(cf.subSkill);
    } else {
      cf.subSkill = null;
    }
    obj.coachFocus = cf;
  }

  // Missing strongerVersion (undefined) → null; also treat an object
  // with a missing/empty quote or rewrite as null rather than failing
  // the whole parse.
  if (!("strongerVersion" in obj) || obj.strongerVersion === undefined) {
    obj.strongerVersion = null;
  } else if (obj.strongerVersion && typeof obj.strongerVersion === "object") {
    const sv = obj.strongerVersion as Record<string, unknown>;
    if (
      typeof sv.quote !== "string" ||
      sv.quote.length === 0 ||
      typeof sv.rewrite !== "string" ||
      sv.rewrite.length === 0
    ) {
      obj.strongerVersion = null;
    }
  }

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
  /** Grading Engine V2 — the A/B scoring arm that produced this result.
   *  Stamped by the scoreRepWithMetrics dispatcher; telemetry reads it.
   *  "control" for the default single-call path. */
  scoringArm?: string;
  /** Grading Engine V2 — number of LLM scoring calls made (1 for control,
   *  N for median-of-n, 2-3 for grouped fan-out). Lets the bench reason
   *  about cost/latency without re-deriving from token sums. */
  llmCallCount?: number;
};

export type ScoreRepResult = {
  score: RepScore;
  metrics: ScoreRepMetrics;
};

// ───── Grading Engine V2 — shared scoring pipeline (§0 extraction) ─────
//
// buildUserPrompt / buildSystemBlocks / computeScoringPromptBytes /
// parseAndValidate / applyHybridLayer / assembleRepScore reproduce the exact
// steps the control scorer (scoreRepControl in score.ts) used to inline. Every
// scoring arm reuses these, so prompt construction, parsing and score assembly
// stay byte-identical to the single-call control path — which is what preserves
// the calibration guardrail. Do NOT add arm-specific branches here; arms
// compose these helpers instead.

export type PreparedScoringPrompt = {
  userPrompt: string;
  rubricBlock: string;
  prosodyFeatures: ProsodyFeatures | null;
  ragResult: Awaited<ReturnType<typeof retrieveKnowledgeForRep>>;
  textSignals: TextSignals | null;
  signalsFlagOn: boolean;
  hasWordTimestamps: boolean;
};

/** Build the user message + all per-rep derived context (RAG, prosody,
 *  signals). Extracted verbatim from the control scorer so the user prompt
 *  bytes are unchanged for reference reps. */
export async function buildUserPrompt(
  input: ScoreRepInput,
): Promise<PreparedScoringPrompt> {
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

  // Grading v3 (rubric v4.0.0) — band anchors are UNCONDITIONAL. The
  // Ch.13 FF_BAND_ANCHORS ramp never left 0%, and the v4.0.0 replay
  // without anchors showed severe band compression on gpt-4o (the
  // reference exceptional rep scored 62; everything clustered 40–65),
  // which breaks the PRD band semantics users see. The anchors give
  // the model concrete band placement ("pick the band first, then the
  // score within it"); expectations in reference-reps.json are
  // authored against the anchored prompt.
  const rubricBlock = COMPACT_RUBRIC_WITH_ANCHORS;

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
  // Grading v3 (3.6) — worker prosody must survive even when word
  // timings are absent (async retries, calibration clips): the old
  // `inlineProsody ? merge(...)` gate silently discarded the worker's
  // pitch/monotone/volume evidence and dropped tone to the text tier.
  // synthesizeProsodyBaseline derives rate + fillers from the
  // transcript with the SAME tokenizer + filler lexicon as the timed
  // path, so grading semantics don't fork by transport.
  const prosodyFeatures =
    input.prosodyFeatures ??
    (inlineProsody
      ? mergeProsody(inlineProsody, workerProsody)
      : workerProsody
        ? mergeProsody(
            synthesizeProsodyBaseline({
              transcript: input.transcript,
              durationMs: input.durationMs,
            }),
            workerProsody,
          )
        : null);
  const prosodyBlock = renderProsodyBlock(prosodyFeatures);

  const userPrompt = [
    modeBlock,
    `PROMPT: ${input.promptText}`,
    // Grading v3 (3.6) — computed rate line. The model reliably applies
    // the 220+wpm edge rule only when the division is done for it;
    // word timings aren't always present (async retries, calibration
    // reps), so derive WPM via the shared signals tokenizer (same one
    // that feeds the SIGNALS block, so the prompt never carries two
    // disagreeing WPM values). Deterministic function of (transcript,
    // durationMs) → byte-stable for reference reps (calibration
    // guardrail).
    `REP DURATION: ${(input.durationMs / 1000).toFixed(1)}s · MEASURED RATE: ~${Math.round(
      getWordCount(input.transcript) / durationToMinutes(input.durationMs),
    )} wpm (well-paced ~130-165)`,
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

  return {
    userPrompt,
    rubricBlock,
    prosodyFeatures,
    ragResult,
    textSignals,
    signalsFlagOn,
    hasWordTimestamps: !!hasWordTimestamps,
  };
}

/** Prompt-byte accounting for telemetry. Reproduces the control path's sum
 *  exactly: raw system-block constants (NOT their in-prompt prefixes) plus
 *  the user message bytes. */
export function computeScoringPromptBytes(opts: {
  rubricBlock: string;
  userCalibration?: string | null;
  coachingMemory?: string | null;
  userPrompt: string;
  /** Arm A — REFERENCE ANCHORS cached block, counted when present so
   *  per-arm telemetry reflects the real payload it shipped. Absent (null)
   *  on the control path, so control's byte accounting is unchanged. */
  anchorsBlock?: string | null;
  /** lean-output arm — count the (shorter) lean system prompt so per-arm
   *  telemetry reflects the real payload. Absent/false on control. */
  lean?: boolean;
  /** milder-trim sweep — explicit lean feedback char cap (wins over `lean`).
   *  Absent on control + the default lean arm. */
  leanFeedbackCap?: number;
}): number {
  const systemTextBytes = [
    resolveLeanPrompt(opts) ?? systemPrompt,
    opts.rubricBlock,
    COMPACT_KNOWLEDGE,
    SUB_SKILL_REFERENCE,
    opts.anchorsBlock ?? "",
    opts.userCalibration ?? "",
    opts.coachingMemory ?? "",
  ].reduce((acc, s) => acc + Buffer.byteLength(s ?? "", "utf8"), 0);
  const userTextBytes = Buffer.byteLength(opts.userPrompt, "utf8");
  return systemTextBytes + userTextBytes;
}

/** The cached + uncached system blocks. Byte-identical to the control path's
 *  `system` array. Arms MUST keep these blocks identical across parallel
 *  calls to preserve prompt-prefix caching. */
export function buildSystemBlocks(opts: {
  rubricBlock: string;
  userCalibration?: string | null;
  coachingMemory?: string | null;
  /** Arm A — REFERENCE ANCHORS. When present, inserted as an additional
   *  CACHED block AFTER the four static cached blocks and BEFORE the
   *  user-specific (uncached) calibration/memory blocks. This extends the
   *  shared cache prefix (blocks 1-4 still cache-hit unchanged) at ~0
   *  marginal cost. Absent (null/undefined) on the control path, so the
   *  control `system` array is byte-identical to the pre-refactor scorer. */
  anchorsBlock?: string | null;
  /** lean-output arm — swap the first (cached) system block for the lean
   *  prompt, which drops the never-rendered `signals` field and tightens the
   *  per-dim feedback cap to cut decode tokens. All other blocks (rubric,
   *  knowledge, sub-skills, calibration, memory) are unchanged, so only the
   *  cache prefix's first block differs. Absent/false on control → the
   *  control `system` array stays byte-identical. */
  lean?: boolean;
  /** milder-trim sweep — explicit lean feedback char cap (wins over `lean`).
   *  Absent on control + the default lean arm. */
  leanFeedbackCap?: number;
}): Anthropic.Messages.TextBlockParam[] {
  const rubricBlock = opts.rubricBlock;
  const input = {
    userCalibration: opts.userCalibration ?? null,
    coachingMemory: opts.coachingMemory ?? null,
  };
  const blocks: Anthropic.Messages.TextBlockParam[] = [
      {
        type: "text",
        text: resolveLeanPrompt(opts) ?? systemPrompt,
        cache_control: { type: "ephemeral" },
      },
      {
        type: "text" as const,
        text: `RUBRIC (all six dimensions — score each and write its per-skill feedback; delivery and thinking_quality numbers may additionally be grounded by deterministic measurement server-side):\n\n${rubricBlock}`,
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
  ];

  // Arm A — splice the REFERENCE ANCHORS block in after the last cached
  // block and before the first user-specific (uncached) block. Placing it
  // among the cached blocks keeps the 1-4 prefix identical (still a cache
  // hit) while adding one new static cached block. No-op on control.
  if (opts.anchorsBlock) {
    const anchorBlock: Anthropic.Messages.TextBlockParam = {
      type: "text",
      text: opts.anchorsBlock,
      cache_control: { type: "ephemeral" },
    };
    const firstUncached = blocks.findIndex(
      (b) => !("cache_control" in b) || b.cache_control == null,
    );
    if (firstUncached === -1) blocks.push(anchorBlock);
    else blocks.splice(firstUncached, 0, anchorBlock);
  }

  return blocks;
}

/** Parse + validate the model's JSON, then run the grading-v3 sanitizers.
 *  Extracted verbatim from the control scorer. */
export function parseAndValidate(
  responseText: string,
  transcript: string,
): {
  validated: z.infer<typeof scoringResponseSchema>;
  sanitizedCoachFocus: NonNullable<RepScore["coachFocus"]>;
  sanitizedStrongerVersion: { quote: string; rewrite: string } | null;
  sanitizedDimFeedback: DimensionScore[];
} {
  const textBlock = { text: responseText };
  const input = { transcript };
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

  // Grading v3 sanitizers — belt-and-suspenders over the prompt rules.
  // Sub-skill attributions with a dimension mismatch strip to null;
  // Stronger Version quotes that aren't verbatim discard the whole
  // object (an invented quote must never reach the screen); banned
  // phrases are logged for prompt-drift auditing.
  const sanitizedCoachFocus = sanitizeCoachFocus(validated.coachFocus);
  const sanitizedStrongerVersion = sanitizeStrongerVersion({
    strongerVersion: validated.strongerVersion,
    transcript: input.transcript,
  });
  const sanitizedDimFeedback = validated.dimensions.map((d) => ({
    ...d,
    subSkill: sanitizeDimSubSkill(d.dimension, d.subSkill),
    ...(d.feedback && containsBannedPhrase(d.feedback)
      ? logBannedAndKeep("dimensions.feedback", d.feedback)
      : {}),
  }));

  return {
    validated,
    sanitizedCoachFocus,
    sanitizedStrongerVersion,
    sanitizedDimFeedback,
  };
}

/** Config so arms can flip determinism on/off head-to-head. Control uses
 *  {deliveryMode:"deterministic", thinkingMode:"blend"} — the deterministic
 *  pacing override + 60/40 thinking blend. An all-LLM arm sets both to "llm".
 */
export type HybridConfig = {
  deliveryMode: "deterministic" | "llm";
  thinkingMode: "blend" | "llm";
};

/** Apply the hybrid scoring layer (deterministic delivery override + thinking
 *  blend) under a config. With the control config and word timings present
 *  this is byte-identical to the inline control path. */
export function applyHybridLayer(opts: {
  dims: DimensionScore[];
  input: ScoreRepInput;
  config: HybridConfig;
}): {
  finalDimensions: DimensionScore[];
  dimensionMap: Partial<Record<SkillDimension, number>>;
} {
  const { input, config } = opts;
  const dimensionMap: Partial<Record<SkillDimension, number>> = {};
  for (const d of opts.dims) {
    dimensionMap[d.dimension] = d.score;
  }
  let finalDimensions: DimensionScore[] = opts.dims.map((d) => ({ ...d }));
  if (input.words && input.words.length > 0) {
    const signalBundle = extractSignals({
      words: input.words,
      transcript: input.transcript,
      durationMs: input.durationMs,
      timeBudgetMs: input.timeBudgetMs ?? input.durationMs,
    });

    if (config.deliveryMode === "deterministic") {
    // Delivery — pure deterministic override (was "pacing" in v2-beta.*)
    const deliveryResult = scorePacing(signalBundle);
    dimensionMap.delivery = deliveryResult.score;
    finalDimensions = finalDimensions.map((d) => {
      if (d.dimension !== "delivery") return d;
      // Spread keeps the model's per-skill feedback + subSkill
      // (grading v3) while the NUMBER stays deterministic — but when
      // the override moves the number far from what the model graded,
      // the model's feedback line explains a score that no longer
      // exists (§4.5.3: feedback explains THIS score). Swap in the
      // deterministic narrative instead of showing e.g. Delivery 45
      // with copy praising the pacing.
      const overrideDiverges =
        typeof d.score === "number" &&
        Math.abs(d.score - deliveryResult.score) > 10;
      return {
        ...d,
        score: deliveryResult.score,
        signals: deliveryResult.signals,
        ...(overrideDiverges
          ? {
              feedback: `Your measured pace was ${Math.round(signalBundle.wpm)} words per minute with ${signalBundle.fillerRate.toFixed(1)} fillers per minute${signalBundle.longPauseCount > 0 ? ` and ${signalBundle.longPauseCount} long pause${signalBundle.longPauseCount === 1 ? "" : "s"}` : ""}. ${deliveryResult.score >= 75 ? "That sits in the 130-165 range listeners follow best." : "Aim for the 130-165 range with a deliberate pause after each key point."}`,
            }
          : {}),
      };
    });
    }

    if (config.thinkingMode === "blend") {
    // Thinking Quality — hybrid blend with LLM layer (was "confidence")
    const thinkingDet = scoreThinkingQualityDeterministic(signalBundle);
    const llmThinking = dimensionMap.thinking_quality ?? 60;
    const thinkingBlended = blendScores(thinkingDet.score, llmThinking, 0.6);
    dimensionMap.thinking_quality = thinkingBlended;
    finalDimensions = finalDimensions.map((d) =>
      d.dimension === "thinking_quality"
        ? {
            ...d,
            score: thinkingBlended,
            signals: [
              ...thinkingDet.signals,
              `(LLM semantic layer: ${llmThinking})`,
            ],
          }
        : d,
    );
    }
  }
  return { finalDimensions, dimensionMap };
}

/** Attach sub-skill scores, tag the tone evidence source, recompute the
 *  composite, and build the final RepScore. Extracted verbatim from the
 *  control scorer (timing is captured by the caller). */
export function assembleRepScore(opts: {
  finalDimensions: DimensionScore[];
  dimensionMap: Partial<Record<SkillDimension, number>>;
  validated: z.infer<typeof scoringResponseSchema>;
  input: ScoreRepInput;
  sanitizedCoachFocus: NonNullable<RepScore["coachFocus"]>;
  sanitizedStrongerVersion: { quote: string; rewrite: string } | null;
  prosodyFeatures: ProsodyFeatures | null;
  signalsFlagOn: boolean;
  textSignals: TextSignals | null;
  modelUsed: string | null | undefined;
}): RepScore {
  const { validated, input, sanitizedCoachFocus, sanitizedStrongerVersion, prosodyFeatures, signalsFlagOn, textSignals } = opts;
  const dimensionMap = opts.dimensionMap;
  let finalDimensions = opts.finalDimensions;

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

  // Grading v3 (spike 3.1) — tag what evidence grounded the tone score
  // so profile/trend consumers can tell prosody-grounded tone from
  // text-conservative tone (PRD §11.5 consistency across performances).
  // "audio" tier reserved for a future audio-in grader; the spike chose
  // DSP prosody.
  const toneSource = hasWorkerProsody(prosodyFeatures) ? "prosody" : "text";
  finalDimensions = finalDimensions.map((d) =>
    d.dimension === "tone"
      ? { ...d, signals: [...d.signals, `[toneSource: ${toneSource}]`] }
      : d,
  );

  const compositeScore = composite(dimensionMap, input.weights);

  const score: RepScore = {
    composite: compositeScore,
    dimensions: finalDimensions,
    ...(validated.structuralAdherence != null
      ? { structuralAdherence: validated.structuralAdherence }
      : {}),
    // Grading v3 — the model emits no callouts; the array stays required
    // on RepScore (dozens of consumers index it) but empty on v4 reps.
    callouts: [],
    // Grading v3 (3.2) — record the ACTUAL serving model (already
    // provider-tagged by the shim: "gpt-4o", "openai-fallback:gpt-4o",
    // "anthropic-fallback:claude-…"), not the role constant that used
    // to misreport gpt-4o reps as claude-scored.
    modelVersion: opts.modelUsed ?? MODEL_VERSIONS.scoring,
    rubricVersion: RUBRIC_VERSION,
    headline: validated.headline,
    coachFocus: sanitizedCoachFocus,
    strongerVersion: sanitizedStrongerVersion,
    // §4.5.2 — the Coach's Focus dimension IS the primary focus (drives
    // DimensionGrid emphasis + exemplar pick).
    primaryFocusDimension: sanitizedCoachFocus.dimension,
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

  return score;
}

/**
 * Grading Engine V2 — the single-LLM-call scoring flow, composed from the
 * shared helpers. The CONTROL path is exactly `runSingleCallScore(input)`
 * (no opts): default control config, no reference anchors → byte-identical
 * prompt + score assembly to the pre-refactor scorer. Arm A
 * (reference-anchored) passes an `anchorsBlock`; an all-LLM arm would pass a
 * `config` with determinism off. Every single-call arm shares this body so
 * they can never drift on parsing, sanitizing, or metrics accounting.
 */
export async function runSingleCallScore(
  input: ScoreRepInput,
  opts?: {
    anchorsBlock?: string | null;
    config?: HybridConfig;
    lean?: boolean;
    /** milder-trim sweep — explicit lean feedback char cap (wins over
     *  `lean`). Absent on control + the default lean arm. */
    leanFeedbackCap?: number;
  },
): Promise<ScoreRepResult> {
  const config: HybridConfig =
    opts?.config ?? { deliveryMode: "deterministic", thinkingMode: "blend" };
  const anchorsBlock = opts?.anchorsBlock ?? null;
  const lean = opts?.lean ?? false;
  const leanFeedbackCap = opts?.leanFeedbackCap;

  const prep = await buildUserPrompt(input);
  const system = buildSystemBlocks({
    rubricBlock: prep.rubricBlock,
    userCalibration: input.userCalibration,
    coachingMemory: input.coachingMemory,
    anchorsBlock,
    lean,
    leanFeedbackCap,
  });
  const promptSizeBytes = computeScoringPromptBytes({
    rubricBlock: prep.rubricBlock,
    userCalibration: input.userCalibration,
    coachingMemory: input.coachingMemory,
    userPrompt: prep.userPrompt,
    anchorsBlock,
    lean,
    leanFeedbackCap,
  });

  const scoreRepStart = Date.now();
  const { response, metrics: callMetrics } =
    await anthropic.messages.createWithMetrics(
      {
        model: MODELS.scoring,
        // Bounded output (grading-v3): the v4 contract typically decodes
        // 1,100-1,500 tokens; 2500 leaves ~1.6x headroom over the observed
        // ceiling without weaponizing the cap into mock-fallback.
        max_tokens: 2500,
        // Calibration stability: temp 0.2 tightens dim-score variance to
        // ±2-5pt across runs (temp 1.0 swung 30-50pt) while keeping some
        // callout-phrasing diversity.
        temperature: 0.2,
        system,
        messages: [
          { role: "user", content: [{ type: "text", text: prep.userPrompt }] },
        ],
      },
      promptSizeBytes,
    );

  const validationStart = Date.now();
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  const {
    validated,
    sanitizedCoachFocus,
    sanitizedStrongerVersion,
    sanitizedDimFeedback,
  } = parseAndValidate(textBlock.text, input.transcript);

  const { finalDimensions, dimensionMap } = applyHybridLayer({
    dims: sanitizedDimFeedback,
    input,
    config,
  });

  const score = assembleRepScore({
    finalDimensions,
    dimensionMap,
    validated,
    input,
    sanitizedCoachFocus,
    sanitizedStrongerVersion,
    prosodyFeatures: prep.prosodyFeatures,
    signalsFlagOn: prep.signalsFlagOn,
    textSignals: prep.textSignals,
    modelUsed: callMetrics.modelUsed,
  });

  const validationDurationMs = Date.now() - validationStart;
  const scoreRepTotalMs = Date.now() - scoreRepStart;

  return {
    score,
    metrics: {
      ...callMetrics,
      validationDurationMs,
      scoreRepTotalMs,
      ragDurationMs: prep.ragResult.durationMs,
      ragChunkCount: prep.ragResult.chunks.length,
    },
  };
}

