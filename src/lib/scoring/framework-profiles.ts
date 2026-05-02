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
 * Mappings (v3.0.0 rubric, DNA reconciliation 2026-05-01):
 *   his clarity     → our clarity
 *   his structure   → our structure
 *   his specificity → our conciseness (signal-per-word density)
 *   his pacing      → our delivery
 *   his presence    → our thinking_quality + tone
 */
export const FRAMEWORK_SCORING_PROFILES: Record<
  string,
  Partial<Record<SkillDimension, number>>
> = {
  // —— Decision / technical explanation ——————————————————
  cdi: { clarity: 1.2, structure: 1.1, conciseness: 1.1 },
  adr: { structure: 1.3, clarity: 1.1, thinking_quality: 1.1 },

  // —— Executive / top-down ——————————————————
  scqa: { structure: 1.3, clarity: 1.2 },
  minto: { structure: 1.3, thinking_quality: 1.2, clarity: 1.1 },
  bluf: { clarity: 1.3, conciseness: 1.2, structure: 1.1 },

  // —— Sales / persuasion ——————————————————
  pspa: { tone: 1.3, thinking_quality: 1.2, clarity: 1.1 },
  fab: { tone: 1.3, conciseness: 1.2 },
  aida: { tone: 1.3, thinking_quality: 1.2, conciseness: 1.1 },

  // —— Feedback / interpersonal ——————————————————
  bie: { tone: 1.3, clarity: 1.2, thinking_quality: 1.1 },

  // —— Interview / behavioral ——————————————————
  star: { structure: 1.3, delivery: 1.2, clarity: 1.1 },

  // —— Narrative / status ——————————————————
  ppf: { structure: 1.2, tone: 1.2, delivery: 1.1 },
  ppp: { structure: 1.3, delivery: 1.2, clarity: 1.1 },

  // —— Argument / reasoning ——————————————————
  cei: { structure: 1.2, thinking_quality: 1.2, conciseness: 1.1 },
  wsw: { structure: 1.2, clarity: 1.2 },

  // —— Impromptu / on-the-spot ——————————————————
  prep: { clarity: 1.2, delivery: 1.3, structure: 1.1 },
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
