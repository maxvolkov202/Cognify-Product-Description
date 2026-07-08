// Phase 8 — scoring-side exercise context for the muscle-group catalog.
//
// Distinct from src/lib/ai/exercises.ts (legacy pre-pivot "drill"
// concept). The muscle-group catalog seeded into
// `cognify_v2.exercises` (Phase 2) keys off slugs like
// "headline-first" / "the-word-budget" / "kill-the-filler". When a rep
// originates from a workout-day station, the scoring pipeline reads
// the row from `cognify_v2.exercises`, builds the per-exercise XML
// block + optional rubric-augmentation hint, and passes them into the
// LLM prompt.
//
// CRITICAL: every code path here must be SKIPPED when exerciseId is
// undefined. The 48-rep calibration replay must produce byte-identical
// composites for legacy / Skill Lab reps that have no exerciseId.

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { exercises } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";

/** Per-exercise constraint hint appended to Stage 2's user message.
 *  Surgical operator-facing prompt strings — no encouragement, no
 *  fluff. Phrased as rubric instructions so the LLM treats them as
 *  scoring rules, not feedback to render verbatim.
 *
 *  Coverage rule (Phase 8 DoD): at least one exercise per dimension.
 *  Unknown slugs return null → no augmentation. */
export const EXERCISE_RUBRIC_HINTS: Record<string, string> = {
  // ── Clarity ───────────────────────────────────────────────────────
  "explain-like-im-12":
    "Constraint: any word a 12-year-old wouldn't recognize counts as jargon. Clarity score MUST reflect jargon density.",
  "headline-first":
    "Constraint: if sentence 1 does not carry the thesis, clarity feedback MUST call it out and the clarity score MUST reflect a failure to lead with the point.",
  "the-word-budget":
    "Constraint: if the transcript exceeds 30 words, the primary clarity feedback MUST call it out and the conciseness score MUST reflect the budget violation.",

  // ── Structure ─────────────────────────────────────────────────────
  "the-3-point-rule":
    "Constraint: if the response does not present exactly three supporting points, structure score MUST reflect the breach.",
  "bottom-line-first":
    "Constraint: if the conclusion is not in sentence 1, structure score MUST reflect the lack of bottom-line-first framing.",
  "signpost-first":
    "Constraint: if the response does not announce its structure before delivering it, structure score MUST reflect missing signposting.",

  // ── Conciseness ───────────────────────────────────────────────────
  "kill-the-filler":
    "Constraint: filler words (um, uh, like, basically, literally) count against conciseness. Each filler over 2/min should drag conciseness toward the floor.",
  "the-30-second-rule":
    "Constraint: if rep duration exceeds 30s, conciseness MUST reflect the over-budget delivery; primary feedback bullet should name the wall-clock breach.",
  "no-hedging":
    "Constraint: hedge words (might, kinda, maybe, sort of, I think) count against both conciseness and thinking_quality (low conviction).",
  "the-single-sentence":
    "Constraint: if the response uses more than one sentence (one period), conciseness MUST reflect the breach.",

  // ── Thinking Quality ──────────────────────────────────────────────
  "the-claim-and-proof":
    "Constraint: every claim must be paired with evidence in the same breath. Unsupported claims drag thinking_quality.",
  "the-so-what-test":
    "Constraint: every point must answer 'so what' before moving on. Listings without stakes drag thinking_quality.",
  "the-steel-man":
    "Constraint: the response must seriously engage the strongest opposing view before its own. Strawman framing drags thinking_quality.",

  // ── Pacing ────────────────────────────────────────────────────────
  "strategic-pause":
    "Constraint: pacing/prosody signals MUST reach the score. Deliberate pauses at beat boundaries lift delivery; rushed-through claims drag it.",
  "silence-over-filler":
    "Constraint: replacing filler with silence is the rule. Filler rate above 2/min and short pauses < 200ms drag delivery.",
  "beat-the-buzzer":
    "Constraint: the rep should land between 35s and 55s. Outside that window, delivery score MUST reflect the timing breach.",

  // ── Tone ──────────────────────────────────────────────────────────
  "the-monotone-breaker":
    "Constraint: pitch/volume variance across sentences is the signal. Flat monotone drags tone score.",
  "downward-landing":
    "Constraint: every statement must end with falling intonation. Rising terminals on claims of fact drag tone score.",
  "authority-voice":
    "Constraint: tone score reflects the audible 'floor' under claims of fact. Upward inflection on claims drags tone.",
};

/** Scoring-time hydration of an exercise row + its rubric hint. Called
 *  once per rep when exerciseId is set; cheap and uncached for now (one
 *  small SELECT). The Anthropic prompt cache amortizes the textual
 *  content across reps anyway. */
export type ExerciseScoringContext = {
  id: string;
  slug: string;
  name: string;
  dimension: string;
  /** From exercises.description — surfaced as the rule attribute. */
  rule: string;
  /** Scoring constraint. PRD v3 Phase 2.2: the DB row's scoring_lens
   *  (framework-owned) wins; the code-side EXERCISE_RUBRIC_HINTS map is
   *  the fallback for rows seeded before the enrichment. */
  hint: string | null;
  /** PRD v3 Phase 2.2 — Hidden Skills this exercise targets. Null for
   *  pre-enrichment rows. */
  hiddenSkills: string[] | null;
  /** ADR-001 response window. Null for pre-enrichment rows. */
  responseWindow: { minSec: number; maxSec: number } | null;
  /** Phase 11.D3 — Lab Engine V1 pack fields. Null pre-enrichment; when
   *  null the rendered prompt stays byte-identical to pre-D3 output. */
  secondaryCoreSkills: string[] | null;
  commonFailureModes: string[] | null;
  scoringEmphasis: string | null;
};

export async function getExerciseScoringContext(
  exerciseId: string,
): Promise<ExerciseScoringContext | null> {
  return safeDb<ExerciseScoringContext | null>(async () => {
    const [row] = await db
      .select({
        id: exercises.id,
        slug: exercises.slug,
        name: exercises.name,
        dimension: exercises.dimension,
        description: exercises.description,
        scoringLens: exercises.scoringLens,
        hiddenSkills: exercises.hiddenSkills,
        responseWindow: exercises.responseWindow,
        secondaryCoreSkills: exercises.secondaryCoreSkills,
        commonFailureModes: exercises.commonFailureModes,
        scoringEmphasis: exercises.scoringEmphasis,
      })
      .from(exercises)
      .where(eq(exercises.id, exerciseId))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      dimension: row.dimension as string,
      rule: row.description,
      hint: row.scoringLens ?? EXERCISE_RUBRIC_HINTS[row.slug] ?? null,
      hiddenSkills: row.hiddenSkills ?? null,
      responseWindow: row.responseWindow ?? null,
      secondaryCoreSkills: row.secondaryCoreSkills ?? null,
      commonFailureModes: row.commonFailureModes ?? null,
      scoringEmphasis: row.scoringEmphasis ?? null,
    };
  }, null);
}

/** Render the compact `<exercise/>` XML block injected into the
 *  scoring prompt. Attribute values are XML-escaped because the rule
 *  text can contain quotes / ampersands. */
export function renderExerciseXmlBlock(ctx: ExerciseScoringContext): string {
  const el = `<exercise name="${xmlAttr(ctx.name)}" dimension="${xmlAttr(ctx.dimension)}" rule="${xmlAttr(ctx.rule)}" />`;
  // Phase 11.D3 — Lab Engine pack fields, appended ONLY when authored so
  // pre-enrichment rows keep producing byte-identical prompts (protects
  // the calibration baseline).
  const extras: string[] = [];
  if (ctx.secondaryCoreSkills && ctx.secondaryCoreSkills.length > 0) {
    extras.push(
      `SECONDARY DIMENSIONS this exercise also trains (weigh them just below ${ctx.dimension}): ${ctx.secondaryCoreSkills.join(", ")}`,
    );
  }
  if (ctx.commonFailureModes && ctx.commonFailureModes.length > 0) {
    extras.push(
      `COMMON FAILURE MODES for this exercise — if the rep exhibits one, name that specific failure in feedback; do NOT invent one that is not present:\n${ctx.commonFailureModes.map((m) => `- ${m}`).join("\n")}`,
    );
  }
  return extras.length > 0 ? [el, ...extras].join("\n") : el;
}

function xmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── Deterministic fast-fail overrides ──────────────────────────────────
//
// For a small set of exercises, a hard deterministic signal trumps the
// LLM's judgment. Kill the Filler is the canonical case: if the rep is
// drowning in fillers, no amount of clever copy from the LLM should
// push conciseness up.
//
// Returns a partial override mapping dim → score. The caller layers the
// override on top of the Stage 1 output and rebuilds the composite.

export type ExerciseFastFailInput = {
  slug: string;
  /** From extractSignals(): fillerRate is fillers per minute. */
  fillerRate?: number;
  /** ms. Used for the 30-second-rule + beat-the-buzzer fast-fail. */
  durationMs?: number;
};
export type ExerciseFastFailOutput = {
  /** Dim → score override. Caller blends into Stage 1's dimensions. */
  overrides: Partial<Record<string, number>>;
  /** Operator-facing reason string for telemetry / debug. */
  reason: string;
} | null;

/** Threshold above which Kill-the-Filler fast-fails. */
export const KILL_THE_FILLER_THRESHOLD_PER_MIN = 4;
/** Floor score that fast-fail floods conciseness to. */
export const FAST_FAIL_CONCISENESS_FLOOR = 25;

export function tryExerciseFastFail(
  input: ExerciseFastFailInput,
): ExerciseFastFailOutput {
  if (input.slug === "kill-the-filler") {
    if (
      input.fillerRate != null &&
      input.fillerRate > KILL_THE_FILLER_THRESHOLD_PER_MIN
    ) {
      return {
        overrides: { conciseness: FAST_FAIL_CONCISENESS_FLOOR },
        reason: `Kill-the-Filler fast-fail: filler rate ${input.fillerRate.toFixed(1)}/min > ${KILL_THE_FILLER_THRESHOLD_PER_MIN}/min threshold; conciseness floored to ${FAST_FAIL_CONCISENESS_FLOOR}.`,
      };
    }
  }
  if (input.slug === "the-30-second-rule") {
    if (input.durationMs != null && input.durationMs > 45_000) {
      return {
        overrides: { conciseness: FAST_FAIL_CONCISENESS_FLOOR },
        reason: `30-Second-Rule fast-fail: rep ran ${(input.durationMs / 1000).toFixed(1)}s (>45s budget); conciseness floored to ${FAST_FAIL_CONCISENESS_FLOOR}.`,
      };
    }
  }
  return null;
}

