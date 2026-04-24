import type { SkillDimension } from "@/types/domain";

/**
 * Legacy dimension identifiers from rubric versions prior to v2.0.0.
 * Used ONLY to read historical reps — never to write. Reps stored under
 * their original rubric_version keep pointers to these names; this
 * module maps them onto the v2.0.0 vocabulary for display + trend lines.
 */
export type LegacySkillDimension =
  | "clarity" // unchanged
  | "structure" // unchanged
  | "relevance" // removed from user-facing; now an internal off-topic gate
  | "confidence" // → thinking_quality
  | "pacing" // → delivery
  | "tone"; // → adaptability

/**
 * Best-effort mapping from a legacy dimension name to its v2.0.0
 * equivalent. `relevance` has no direct user-facing successor — callers
 * rendering historical scores should either omit it or label it as
 * "Relevance (legacy)".
 */
export const LEGACY_TO_V2_DIMENSION: Partial<
  Record<LegacySkillDimension, SkillDimension>
> = {
  clarity: "clarity",
  structure: "structure",
  confidence: "thinking_quality",
  pacing: "delivery",
  tone: "adaptability",
  // relevance: intentionally absent
};

/**
 * Renders a rep's per-dimension scores in the current dimension vocabulary
 * regardless of which rubric version produced them. Returns an object
 * keyed by v2.0.0 dimensions only — legacy-only scores (like relevance)
 * are silently dropped so charts don't render bogus axes.
 */
export function projectScoresToV2(
  rubricVersion: string | null | undefined,
  scores: Partial<Record<string, number>>,
): Partial<Record<SkillDimension, number>> {
  if (rubricVersion === "v2.0.0" || rubricVersion == null) {
    // rubricVersion null/undefined → assume this rep uses current names
    return scores as Partial<Record<SkillDimension, number>>;
  }
  const projected: Partial<Record<SkillDimension, number>> = {};
  for (const [legacyDim, value] of Object.entries(scores)) {
    const v2Dim = LEGACY_TO_V2_DIMENSION[legacyDim as LegacySkillDimension];
    if (v2Dim !== undefined && value !== undefined) {
      projected[v2Dim] = value;
    } else if (legacyDim === "clarity" || legacyDim === "structure") {
      // Clarity + Structure kept their names; pass through.
      projected[legacyDim as SkillDimension] = value as number;
    }
  }
  return projected;
}

/**
 * Map a legacy dimension identifier (as it might appear in historical
 * DB rows) to the current v2.0.0 dimension, or null if there's no
 * mapping (e.g. `relevance`).
 */
export function aliasLegacyDimension(
  legacy: string,
): SkillDimension | null {
  return LEGACY_TO_V2_DIMENSION[legacy as LegacySkillDimension] ?? null;
}

/**
 * Human-readable legacy dimension labels for rare surfaces that must
 * render old scores verbatim (debug / admin / compare views).
 */
export const LEGACY_DIMENSION_LABELS: Record<LegacySkillDimension, string> = {
  clarity: "Clarity",
  structure: "Structure",
  relevance: "Relevance (legacy)",
  confidence: "Confidence (legacy → Thinking Quality)",
  pacing: "Pacing (legacy → Delivery)",
  tone: "Tone (legacy → Adaptability)",
};
