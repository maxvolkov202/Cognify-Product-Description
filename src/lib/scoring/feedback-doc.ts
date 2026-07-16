// Grading v3 — build the persisted `reps.feedback` jsonb document from a
// RepScore (the render-shaped doc: PRD §4.5-4.6 fields). Pure so the
// sync saveRep path, the async score-internal path, and tests share one
// builder; getRepResult's reconstruction is the inverse.

import type { RepScore } from "@/types/domain";

export type RepFeedbackDoc = {
  version: string;
  headline?: string;
  headlineTone?: string;
  strongerVersion?: { quote: string | null; rewrite: string } | null;
  nextRepHint?: string;
  skillFeedback?: Record<string, { feedback: string; subSkill?: string | null }>;
  implementationReview?: {
    verdict: string;
    note?: string;
    technique?: string;
  } | null;
};

/**
 * Null when the score carries nothing worth persisting (mock fallback,
 * legacy shapes with no v4 fields and no headline) — callers skip the
 * column entirely so pre-v4 reads stay on their legacy reconstruction.
 */
export function buildFeedbackDoc(score: RepScore): RepFeedbackDoc | null {
  if (score.modelVersion === "mock-fallback-v1") return null;

  const skillFeedback: RepFeedbackDoc["skillFeedback"] = {};
  for (const d of score.dimensions ?? []) {
    if (d.feedback) {
      skillFeedback[d.dimension] = {
        feedback: d.feedback,
        ...(d.subSkill !== undefined ? { subSkill: d.subSkill } : {}),
      };
    }
  }
  const hasSkillFeedback = Object.keys(skillFeedback).length > 0;

  if (
    !score.headline &&
    !score.strongerVersion &&
    !score.nextRepHint &&
    !hasSkillFeedback &&
    !score.implementationReview
  ) {
    return null;
  }

  return {
    version: score.feedbackVersion ?? "unknown",
    ...(score.headline ? { headline: score.headline } : {}),
    ...(score.headlineTone ? { headlineTone: score.headlineTone } : {}),
    ...(score.strongerVersion !== undefined
      ? { strongerVersion: score.strongerVersion }
      : {}),
    ...(score.nextRepHint ? { nextRepHint: score.nextRepHint } : {}),
    ...(hasSkillFeedback ? { skillFeedback } : {}),
    ...(score.implementationReview
      ? {
          implementationReview: {
            verdict: score.implementationReview.verdict,
            ...(score.implementationReview.note
              ? { note: score.implementationReview.note }
              : {}),
            ...(score.implementationReview.technique
              ? { technique: score.implementationReview.technique }
              : {}),
          },
        }
      : {}),
  };
}

/**
 * Merge a persisted feedback doc back onto a reconstructed RepScore
 * (getRepResult / progress read paths). Mutates nothing; returns the
 * enriched copy. Absent doc → the input unchanged (legacy rows).
 */
export function applyFeedbackDoc<T extends RepScore>(
  score: T,
  doc: RepFeedbackDoc | null | undefined,
): T {
  if (!doc) return score;
  const dimensions = score.dimensions.map((d) => {
    const sf = doc.skillFeedback?.[d.dimension];
    return sf
      ? { ...d, feedback: sf.feedback, subSkill: sf.subSkill ?? null }
      : d;
  });
  return {
    ...score,
    dimensions,
    ...(doc.headline ? { headline: doc.headline } : {}),
    ...(doc.headlineTone
      ? { headlineTone: doc.headlineTone as RepScore["headlineTone"] }
      : {}),
    ...(doc.strongerVersion !== undefined
      ? { strongerVersion: doc.strongerVersion }
      : {}),
    ...(doc.nextRepHint ? { nextRepHint: doc.nextRepHint } : {}),
    ...(doc.implementationReview
      ? {
          implementationReview: {
            verdict: doc.implementationReview
              .verdict as NonNullable<RepScore["implementationReview"]>["verdict"],
            ...(doc.implementationReview.note
              ? { note: doc.implementationReview.note }
              : {}),
            ...(doc.implementationReview.technique
              ? {
                  technique: doc.implementationReview
                    .technique as NonNullable<
                    RepScore["implementationReview"]
                  >["technique"],
                }
              : {}),
          },
        }
      : {}),
    ...(doc.version !== "unknown" ? { feedbackVersion: doc.version } : {}),
  };
}
