import { SKILL_DIMENSIONS, type SkillDimension } from "@/types/domain";

/**
 * Legacy dimension identifiers from prior rubric versions.
 * Used ONLY to read historical reps — never to write. Reps stored under
 * their original rubric_version keep pointers to these names; this
 * module maps them onto the current v3 vocabulary for display + trend lines.
 *
 * v1: clarity, structure, relevance, confidence, pacing, tone
 * v2: clarity, structure, conciseness, thinking_quality, delivery, adaptability
 * v3 (current): clarity, structure, conciseness, thinking_quality, delivery, tone
 */
export type LegacySkillDimension =
  | "clarity" // unchanged across versions
  | "structure" // unchanged across versions
  | "relevance" // v1 only — no v3 successor
  | "confidence" // v1 → v3.thinking_quality
  | "pacing" // v1 → v3.delivery
  | "adaptability" // v2 → v3.tone (DNA reconciliation 2026-05-01)
  | "tone"; // v1 name reused as v3 canonical name

/**
 * Best-effort mapping from a legacy dimension name to its current v3
 * equivalent. `relevance` has no direct user-facing successor — callers
 * rendering historical scores should either omit it or label it as
 * "Relevance (legacy)".
 */
export const LEGACY_TO_CURRENT_DIMENSION: Partial<
  Record<LegacySkillDimension, SkillDimension>
> = {
  clarity: "clarity",
  structure: "structure",
  confidence: "thinking_quality",
  pacing: "delivery",
  adaptability: "tone",
  tone: "tone",
  // relevance: intentionally absent — no current successor
};

/**
 * Renders a rep's per-dimension scores in the current dimension vocabulary
 * regardless of which rubric version produced them. Returns an object
 * keyed by current dimensions only — legacy-only scores (like relevance)
 * are silently dropped so charts don't render bogus axes.
 *
 * Note: v2 `adaptability` scores are remapped to v3 `tone` in chart space
 * for trend continuity, even though the underlying signals were trained
 * against a different rubric. The `prosodyAvailable: false` flag on the
 * rep distinguishes pre- and post-Tone-prosody-pipeline scores.
 */
export function projectScoresToCurrent(
  rubricVersion: string | null | undefined,
  scores: Partial<Record<string, number>>,
): Partial<Record<SkillDimension, number>> {
  if (rubricVersion?.startsWith("v3") || rubricVersion == null) {
    // v3 or unknown → assume current names
    return scores as Partial<Record<SkillDimension, number>>;
  }
  const projected: Partial<Record<SkillDimension, number>> = {};
  for (const [legacyDim, value] of Object.entries(scores)) {
    const currentDim =
      LEGACY_TO_CURRENT_DIMENSION[legacyDim as LegacySkillDimension];
    if (currentDim !== undefined && value !== undefined) {
      projected[currentDim] = value;
    }
  }
  return projected;
}

/**
 * Backwards-compatible alias retained for callers still on the v2 name.
 * @deprecated Use `projectScoresToCurrent` instead.
 */
export const projectScoresToV2 = projectScoresToCurrent;

/**
 * Map a legacy dimension identifier (as it might appear in historical
 * DB rows) to the current dimension, or null if there's no mapping
 * (e.g. v1 `relevance`).
 */
export function aliasLegacyDimension(
  legacy: string,
): SkillDimension | null {
  return LEGACY_TO_CURRENT_DIMENSION[legacy as LegacySkillDimension] ?? null;
}

/**
 * Forward mapping: muscle-group ID → current SKILL_DIMENSION.
 *
 * The product team labels one muscle group `pacing` while the scoring
 * rubric uses `delivery`. All other muscle-group IDs are 1:1 with the
 * canonical SKILL_DIMENSIONS. Used wherever the scoring pipeline needs
 * to convert a muscle-group exercise's dimension into the rubric vocab
 * (e.g. RAG dim filtering, calibration drift slicing).
 *
 * Returns null when the input isn't a recognized muscle group OR skill
 * dim — callers should treat that as "no preferred dim."
 */
export function muscleGroupToSkillDim(mgId: string): SkillDimension | null {
  if (mgId === "pacing") return "delivery";
  if ((SKILL_DIMENSIONS as readonly string[]).includes(mgId)) {
    return mgId as SkillDimension;
  }
  return null;
}

/**
 * Human-readable legacy dimension labels for rare surfaces that must
 * render old scores verbatim (debug / admin / compare views).
 */
export const LEGACY_DIMENSION_LABELS: Record<LegacySkillDimension, string> = {
  clarity: "Clarity",
  structure: "Structure",
  relevance: "Relevance (legacy v1)",
  confidence: "Confidence (legacy v1 → Thinking Quality)",
  pacing: "Pacing (legacy v1 → Delivery)",
  adaptability: "Adaptability (legacy v2 → Tone)",
  tone: "Tone",
};
