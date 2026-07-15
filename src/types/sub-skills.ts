import type { SkillDimension } from "./domain";
import {
  HIDDEN_SKILLS,
  LEGACY_SUB_SKILL_MAP,
  type HiddenSkillRow,
} from "./hidden-skills.generated";

/**
 * Per-dimension Hidden Skill map — PRD §5.5 Skill Taxonomy v2 (D20).
 *
 * The July 2026 PRD defines 148 Hidden Skills across the 6 Core Skills
 * (clarity 23, structure 23, conciseness 22, thinking_quality 28,
 * delivery/"Pacing" 22, tone 30). They power exercise tagging, coaching
 * attribution, scoring feedback bullets, and profile storage — and are
 * never exposed to users as a taxonomy (PRD: "Users train Core Skills.
 * Cognify trains the underlying behaviors.").
 *
 * Source of truth: scripts/taxonomy/hidden-skills-v2.json → generated
 * into ./hidden-skills.generated.ts (run
 * `node scripts/taxonomy/generate-sub-skills.mjs` after editing the JSON).
 * Old 34-id taxonomy bridge: plans/prd/taxonomy-migration-map.md.
 *
 * Storage / wire format: each sub-skill is a snake_case string. The
 * `SUB_SKILL_TO_DIMENSION` lookup enforces dimension membership at
 * runtime; the union types enforce it at compile time.
 */

/** Flat union of all 148 sub-skill ids — derived from the generated data. */
export type SubSkillId = HiddenSkillRow["id"];

type SkillsOfDimension<D extends SkillDimension> = Extract<
  HiddenSkillRow,
  { dimension: D }
>["id"];

export type ClaritySubSkill = SkillsOfDimension<"clarity">;
export type StructureSubSkill = SkillsOfDimension<"structure">;
export type ConcisenessSubSkill = SkillsOfDimension<"conciseness">;
export type ThinkingQualitySubSkill = SkillsOfDimension<"thinking_quality">;
export type DeliverySubSkill = SkillsOfDimension<"delivery">;
export type ToneSubSkill = SkillsOfDimension<"tone">;

/** Flat list of every sub-skill in taxonomy order — Zod enums + iteration. */
export const ALL_SUB_SKILLS: readonly SubSkillId[] = HIDDEN_SKILLS.map(
  (s) => s.id,
);

/** Per-dimension sub-skill arrays — exposed as `readonly` for safety. */
export const SUB_SKILLS: Record<SkillDimension, readonly SubSkillId[]> = {
  clarity: HIDDEN_SKILLS.filter((s) => s.dimension === "clarity").map((s) => s.id),
  structure: HIDDEN_SKILLS.filter((s) => s.dimension === "structure").map((s) => s.id),
  conciseness: HIDDEN_SKILLS.filter((s) => s.dimension === "conciseness").map((s) => s.id),
  thinking_quality: HIDDEN_SKILLS.filter((s) => s.dimension === "thinking_quality").map((s) => s.id),
  delivery: HIDDEN_SKILLS.filter((s) => s.dimension === "delivery").map((s) => s.id),
  tone: HIDDEN_SKILLS.filter((s) => s.dimension === "tone").map((s) => s.id),
};

function buildLookup<V>(pick: (row: HiddenSkillRow) => V): Record<SubSkillId, V> {
  const out = {} as Record<SubSkillId, V>;
  for (const row of HIDDEN_SKILLS) out[row.id] = pick(row);
  return out;
}

/** Reverse lookup: which dimension does this sub-skill belong to? */
export const SUB_SKILL_TO_DIMENSION: Record<SubSkillId, SkillDimension> =
  buildLookup((r) => r.dimension);

/** Human-readable labels for UI surfaces (sub-skill chips, accordion headers). */
export const SUB_SKILL_LABELS: Record<SubSkillId, string> = buildLookup(
  (r) => r.label,
);

/** PRD §5.5 "What it means" column — one-line definition per skill.
 *  Prompt surfaces render these so the model attributes skills by
 *  definition, not by guessing from the label. */
export const SUB_SKILL_DEFINITIONS: Record<SubSkillId, string> = buildLookup(
  (r) => r.definition,
);

/**
 * Compact prompt-ready reference: dimension → sub-skill label list.
 * Pass `dimensions` to render a subset — with 148 skills, prompts that
 * only care about one dimension should not ship all six lists.
 */
export function renderSubSkillReference(
  dimensions?: readonly SkillDimension[],
): string {
  const dims =
    dimensions ?? (Object.keys(SUB_SKILLS) as SkillDimension[]);
  const lines: string[] = [];
  for (const dim of dims) {
    const items = SUB_SKILLS[dim].map((s) => SUB_SKILL_LABELS[s]).join(", ");
    lines.push(`${dim}: ${items}`);
  }
  return lines.join("\n");
}

/**
 * Definition-rich reference for ONE dimension ("Label — definition" per
 * line). Used where the model must attribute or target specific hidden
 * skills within the active dimension (coaching attribution, prompt
 * generation). Kept per-dimension on purpose: all 148 definitions in one
 * prompt is a token-budget violation (~6k tokens).
 */
export function renderSubSkillReferenceWithDefinitions(
  dimension: SkillDimension,
): string {
  return SUB_SKILLS[dimension]
    .map((s) => `${SUB_SKILL_LABELS[s]} — ${SUB_SKILL_DEFINITIONS[s]}`)
    .join("\n");
}

/** Type guard. */
export function isSubSkillForDimension(
  subSkill: string,
  dimension: SkillDimension,
): subSkill is SubSkillId {
  return SUB_SKILL_TO_DIMENSION[subSkill as SubSkillId] === dimension;
}

/** Type guard: is this string any valid v2 sub-skill id? */
export function isSubSkillId(value: string): value is SubSkillId {
  return value in SUB_SKILL_TO_DIMENSION;
}

/**
 * Canonicalize a sub-skill id: v2 ids pass through, pre-v2 (34-id
 * taxonomy) ids map to their v2 successor (see
 * plans/prd/taxonomy-migration-map.md), anything else → null. Use at
 * every fold/read boundary that may see historical data (rep signals,
 * profile backfill).
 */
export function canonicalizeSubSkillId(value: string): SubSkillId | null {
  if (isSubSkillId(value)) return value;
  return LEGACY_SUB_SKILL_MAP[value] ?? null;
}
