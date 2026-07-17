// PRD v3 Phase 1 — Coach's Focus contract + retry-evaluation helpers.
//
// The PRD's Coach's Focus is "the single highest-impact improvement
// opportunity" (§4.5.2): exactly one per rep, tied to a Hidden Skill when
// available, and it becomes the objective of the required Retry. The
// scoring pipeline already emits the ingredients (primaryFocusDimension +
// nextRepFocus bullets); this module formalizes them into one persisted
// object so the retry flow, coaching_events ledger, and Phase 3 coaching
// memory all read the same shape.
//
// Pure functions only — tested in tests/coach-focus.test.ts.

import type { RepScore, SkillDimension } from "@/types/domain";

/**
 * Phase 15 I-8 — the coaching-technique taxonomy (PRD §8.3.9). The
 * coaching memory already tells the model to "switch technique" when
 * coaching keeps missing, but nothing recorded WHICH technique was in
 * play — so effectiveness could never be verified per technique. These
 * four match the angles the EFFECTIVENESS prompt line already suggests.
 */
export const COACHING_TECHNIQUES = [
  "smaller_step",
  "transcript_example",
  "related_hidden_skill",
  "reframe",
] as const;

export type CoachingTechnique = (typeof COACHING_TECHNIQUES)[number];

export function isCoachingTechnique(v: unknown): v is CoachingTechnique {
  return (
    typeof v === "string" &&
    (COACHING_TECHNIQUES as readonly string[]).includes(v)
  );
}

export type CoachFocus = {
  dimension: SkillDimension;
  /** Hidden Skill id (src/types/sub-skills.ts). Null when the focus is
   *  dimension-level only. */
  subSkill: string | null;
  /** The actionable focus line the user is asked to implement. On v4
   *  (grading v3) reps this is composed from behavior + action so every
   *  legacy consumer (coaching_events.focusText, retry context,
   *  coaching-memory rendering) keeps working unchanged. */
  text: string;
  /** Grading v3 (§8.6.2) three-question structure — model-emitted on v4
   *  reps, absent on legacy-derived focuses. */
  behavior?: string;
  /** Why the behavior matters. */
  why?: string;
  /** The one thing to do on the retry. */
  action?: string;
  /** Phase 15 I-8 — the coaching technique in play for this focus.
   *  Sourced from the retry response's implementationReview.technique
   *  (first-rep responses don't emit one → null). */
  technique?: CoachingTechnique | null;
};

export type ImplementationVerdict = "nailed" | "partial" | "missed";

/** The model's own implementation review, present only on retry-evaluated
 *  reps (schema-optional; see RETRY EVALUATION block in score.ts). */
export type ImplementationReview = {
  verdict: ImplementationVerdict;
  /** One sentence on HOW the implementation landed. */
  note: string;
  /** Phase 15 I-8 — which coaching technique the coached focus used
   *  (model-classified on the retry; lenient schema → invalid tags
   *  become undefined, never a parse failure). */
  technique?: CoachingTechnique;
};

/**
 * Derive the Coach's Focus a rep should carry forward from its score.
 * Prefers the nextRepFocus bullet matching primaryFocusDimension, then the
 * first nextRepFocus bullet, then a bare-dimension fallback. Null only
 * when the score has neither a focus dimension, focus bullets, nor
 * dimension scores (mock-fallback reps).
 *
 * structural_adherence is a framework grade, not a Core Skill — it can't
 * be the ledger's focus dimension. It used to hard-null the whole focus,
 * which SILENTLY dropped the Coach's Focus card, the retry overlay, the
 * retryContext, and the coaching-ledger row on every framework-heavy rep
 * where the model picked it as primary (Phase 12 F-5). Now it redirects
 * to the best core carrier instead: first non-structural bullet, else
 * the weakest core dimension.
 */
export function deriveCoachFocus(score: RepScore): CoachFocus | null {
  // Grading v3 (v4 contract): the model emits the Coach's Focus
  // first-class — no derivation needed. Everything below is the legacy
  // chain for pre-v4 reps (historical rows, mock fallback).
  if (score.coachFocus) {
    const cf = score.coachFocus;
    const technique = isCoachingTechnique(
      score.implementationReview?.technique,
    )
      ? score.implementationReview.technique
      : null;
    return {
      dimension: cf.dimension,
      subSkill: cf.subSkill ?? null,
      text: cf.text,
      behavior: cf.behavior,
      why: cf.why,
      action: cf.action,
      technique,
    };
  }

  const bullets = (score.nextRepFocus ?? []).filter(
    (b) => b.dimension !== "structural_adherence",
  );
  let primary: string | null =
    score.primaryFocusDimension ?? bullets[0]?.dimension ?? null;
  if (primary === "structural_adherence") {
    primary = bullets[0]?.dimension ?? weakestCoreDimension(score);
  }
  if (!primary) return null;

  // Phase 15 I-8 — carry the technique tag through to the ledger. Only
  // retry-evaluated scores carry an implementationReview, so first-rep
  // focuses get technique=null (their technique is classified later, by
  // the retry that evaluates them — see saveRep's verdict backfill).
  const technique = isCoachingTechnique(score.implementationReview?.technique)
    ? score.implementationReview.technique
    : null;

  const matching =
    bullets.find((b) => b.dimension === primary) ?? bullets[0] ?? null;
  if (matching) {
    return {
      dimension: matching.dimension as SkillDimension,
      subSkill: matching.subSkill ?? null,
      text: matching.text,
      technique,
    };
  }
  return {
    dimension: primary as SkillDimension,
    subSkill: null,
    text: `Improve ${primary.replace(/_/g, " ")} on your next attempt.`,
    technique,
  };
}

/** What the retry surfaces render: a short title, the actionable body,
 *  and the Stronger Version pulled from the user's own words. */
export type RetryFocus = {
  title: string;
  body: string;
  strongerVersion: { quote: string | null; rewrite: string } | null;
};

/**
 * Grading v3 — ONE derivation for the retry overlay/banner, shared by
 * every surface (workout shell, Skill Lab, Build-a-Rep, prep events).
 * Before this helper each surface hand-rolled its own v4/legacy
 * precedence and they had already forked (two surfaces lost the legacy
 * Stronger Version entirely). v4 fields first; legacy warn/critical
 * callout scavenge as fallback. Null when the score carries no focus.
 */
export function deriveRetryFocus(score: RepScore): RetryFocus | null {
  const focus = deriveCoachFocus(score);
  if (!focus) return null;
  const legacyCallout =
    (score.callouts ?? []).find(
      (c) =>
        (c.tone === "warn" || c.tone === "critical") &&
        c.dimension === focus.dimension &&
        c.suggestedRewrite,
    ) ??
    (score.callouts ?? []).find(
      (c) => (c.tone === "warn" || c.tone === "critical") && c.suggestedRewrite,
    ) ??
    null;
  const strongerVersion = score.strongerVersion
    ? { quote: score.strongerVersion.quote, rewrite: score.strongerVersion.rewrite }
    : legacyCallout?.suggestedRewrite
      ? { quote: legacyCallout.quote ?? null, rewrite: legacyCallout.suggestedRewrite }
      : null;
  return {
    title: focus.behavior ?? focus.text,
    body: focus.action ?? focus.text,
    strongerVersion,
  };
}

/** Matches progression's RepSummary.topWeakness shape. */
export type TopWeakness = {
  dimension: SkillDimension | "structural_adherence";
  title: string;
  body: string;
  quote: string | null;
  suggestedRewrite: string | null;
};

/**
 * Grading v3 — the previous rep's "top weakness" for progression
 * context. v4 reps carry it on coachFocus (callouts are empty by
 * contract, so the old callout scavenge returned null on EVERY v4 rep
 * and progression silently lost its weakness line); legacy reps keep
 * the worst warn/critical callout.
 */
export function deriveTopWeakness(score: RepScore): TopWeakness | null {
  if (score.coachFocus) {
    const cf = score.coachFocus;
    return {
      dimension: cf.dimension,
      title: cf.behavior ?? cf.text,
      body: cf.why ?? cf.action ?? cf.text,
      quote: score.strongerVersion?.quote ?? null,
      suggestedRewrite: score.strongerVersion?.rewrite ?? null,
    };
  }
  const callout = (score.callouts ?? []).find(
    (c) => c.tone === "critical" || c.tone === "warn",
  );
  return callout
    ? {
        dimension: callout.dimension,
        title: callout.title,
        body: callout.body,
        quote: callout.quote ?? null,
        suggestedRewrite: callout.suggestedRewrite ?? null,
      }
    : null;
}

/** Weakest scored dimension that is a real Core Skill (framework grades
 *  excluded). Null when the score carries no core dimensions at all. */
function weakestCoreDimension(score: RepScore): SkillDimension | null {
  const core = (score.dimensions ?? []).filter(
    // The domain type narrows dimensions to core skills, but live scores
    // carry structural_adherence rows when a framework was graded.
    (d) => (d.dimension as string) !== "structural_adherence",
  );
  if (core.length === 0) return null;
  return core.reduce((weakest, d) => (d.score < weakest.score ? d : weakest))
    .dimension as SkillDimension;
}

/**
 * Deterministic implementation verdict from score movement on the focus
 * dimension. Fallback for when the model omits `implementationReview`
 * (and the ground truth for calibrating it later).
 *
 * Thresholds are deliberately generous per Owen C10 — score noise between
 * two takes of the same prompt is real, and a harsh "missed" on a flat
 * retry erodes trust in the loop.
 */
export function deriveImplementationVerdict(params: {
  focusDimension: SkillDimension;
  firstDimensions: { dimension: SkillDimension; score: number }[];
  retryDimensions: { dimension: SkillDimension; score: number }[];
}): ImplementationVerdict {
  const first = params.firstDimensions.find(
    (d) => d.dimension === params.focusDimension,
  );
  const retry = params.retryDimensions.find(
    (d) => d.dimension === params.focusDimension,
  );
  if (!first || !retry) return "partial";
  const delta = retry.score - first.score;
  if (delta >= 5) return "nailed";
  if (delta >= -2) return "partial";
  return "missed";
}

/**
 * Score-movement display rule (Owen C10): be liberal on negative movement.
 * A −2 reads as "focus next time"; a −12 reads as "this system is bogus".
 *
 * - delta >= 0            → show the number, celebrate proportionally.
 * - -3 <= delta < 0       → show the small number, neutral framing.
 * - delta < -3            → hide the number; soft copy instead.
 */
export function softenScoreDelta(delta: number): {
  showNumeric: boolean;
  tone: "celebrate" | "neutral" | "soft";
} {
  if (delta >= 1) return { showNumeric: true, tone: "celebrate" };
  if (delta >= -3) return { showNumeric: true, tone: "neutral" };
  return { showNumeric: false, tone: "soft" };
}
