import type { SkillDimension } from "@/types/domain";

/**
 * Per-framework dimension weight adjustments.
 *
 * Different frameworks should weight dimensions differently based on what
 * that framework is trying to produce. A tough-feedback framework (BIE)
 * cares more about tone than a decision explainer (CDI) does.
 *
 * Keys are framework IDs from src/lib/ai/frameworks-library.ts.
 * Values override DIMENSION_RUBRIC[dim].defaultWeight in composite().
 * Multiplier of 1.0 = no change. Values typically 0.8–1.3.
 *
 * Pattern adopted from CTO's v1 (FRAMEWORK_SCORING_PROFILES in
 * cognify-v1-cto/src/app/types/framework.ts). Remapped to our 6 dimensions:
 *   his clarity     → our clarity
 *   his structure   → our structure
 *   his specificity → our relevance
 *   his pacing      → our pacing
 *   his presence    → our confidence + tone
 */
export const FRAMEWORK_SCORING_PROFILES: Record<
  string,
  Partial<Record<SkillDimension, number>>
> = {
  // —— Decision / technical explanation ——————————————————
  cdi: { clarity: 1.2, structure: 1.1, relevance: 1.1 },
  adr: { structure: 1.3, clarity: 1.1, confidence: 1.1 },

  // —— Executive / top-down ——————————————————
  scqa: { structure: 1.3, clarity: 1.2 },
  minto: { structure: 1.3, confidence: 1.2, clarity: 1.1 },
  bluf: { clarity: 1.3, confidence: 1.2, structure: 1.1 },

  // —— Sales / persuasion ——————————————————
  pspa: { relevance: 1.3, confidence: 1.2, clarity: 1.1 },
  fab: { relevance: 1.3, tone: 1.2 },
  aida: { tone: 1.3, confidence: 1.2, relevance: 1.1 },

  // —— Feedback / interpersonal ——————————————————
  bie: { tone: 1.3, clarity: 1.2, confidence: 1.1 },

  // —— Interview / behavioral ——————————————————
  star: { structure: 1.3, pacing: 1.2, clarity: 1.1 },

  // —— Narrative / status ——————————————————
  ppf: { structure: 1.2, tone: 1.2, pacing: 1.1 },
  ppp: { structure: 1.3, pacing: 1.2, clarity: 1.1 },

  // —— Argument / reasoning ——————————————————
  cei: { structure: 1.2, confidence: 1.2, relevance: 1.1 },
  wsw: { structure: 1.2, clarity: 1.2 },

  // —— Impromptu / on-the-spot ——————————————————
  prep: { clarity: 1.2, pacing: 1.3, structure: 1.1 },
};

/**
 * Resolve a framework's weight profile, or undefined if no profile exists.
 * When undefined, composite() falls back to DIMENSION_RUBRIC defaultWeights.
 */
export function getFrameworkWeights(
  frameworkId: string | null | undefined,
): Partial<Record<SkillDimension, number>> | undefined {
  if (!frameworkId) return undefined;
  return FRAMEWORK_SCORING_PROFILES[frameworkId];
}
