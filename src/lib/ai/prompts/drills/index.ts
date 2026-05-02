/**
 * Drill bank index — DNA Ch.6b.
 *
 * Maps each drillable focus dimension to its prompt bank. Picker reads
 * the bank, stratifies across `targetSubSkill` so a slate covers the
 * dimension's sub-skills evenly. The 3 dimensions banked here
 * (thinking_quality / delivery / tone) are the new drillable additions
 * per DNA spec; the 3 original drillable dimensions
 * (clarity / structure / conciseness) keep their existing rep-type
 * routing in workout-prompts.ts.
 */

import type { SkillDimension } from "@/types/domain";
import type { DrillPrompt } from "../types";
import type { SubSkillId } from "@/types/sub-skills";
import { THINKING_QUALITY_DRILLS } from "./thinking-quality";
import { DELIVERY_DRILLS } from "./delivery";
import { TONE_DRILLS } from "./tone";

/** Banks for the new drillable dimensions. Keyed by SkillDimension so
 *  callers can look up by the user's focus selection. */
export const DRILL_BANKS: Partial<
  Record<SkillDimension, readonly DrillPrompt[]>
> = {
  thinking_quality: THINKING_QUALITY_DRILLS,
  delivery: DELIVERY_DRILLS,
  tone: TONE_DRILLS,
};

/** Which dimensions have a dedicated drill bank in this Ch.6b ship.
 *  The other 3 (clarity / structure / conciseness) drill via the
 *  existing rep-type routing — no DrillPrompt-shaped bank needed. */
export const DRILLABLE_DIMENSIONS: readonly SkillDimension[] = [
  "thinking_quality",
  "delivery",
  "tone",
];

export type PickDrillInput = {
  dimension: SkillDimension;
  /** Stable seed (rep id, session id) for deterministic picks. */
  seed?: string;
  /** Optional sub-skill bias — when present, picker prefers prompts
   *  targeting these sub-skills first. Caller derives from user's
   *  weakest sub-skills within the dimension. */
  preferSubSkills?: readonly SubSkillId[];
  /** Slate size — default 5 (matches existing pickers). */
  count?: number;
};

/**
 * Pick a slate of drill prompts for the given dimension.
 *
 * Stratification: round-robin across `targetSubSkill` so every slate
 * hits a balanced spread within the dimension. When `preferSubSkills`
 * is passed, those sub-skills appear first.
 *
 * Returns at most `count` prompts; less if the bank is small.
 */
export function pickDrillPrompts(input: PickDrillInput): DrillPrompt[] {
  const bank = DRILL_BANKS[input.dimension];
  if (!bank || bank.length === 0) return [];
  const count = input.count ?? 5;

  // Group by sub-skill
  const bySubSkill = new Map<SubSkillId, DrillPrompt[]>();
  for (const p of bank) {
    const arr = bySubSkill.get(p.targetSubSkill) ?? [];
    arr.push(p);
    bySubSkill.set(p.targetSubSkill, arr);
  }

  // Order sub-skills: preferred first, then the rest in insertion order.
  const subSkillOrder: SubSkillId[] = [];
  for (const s of input.preferSubSkills ?? []) {
    if (bySubSkill.has(s) && !subSkillOrder.includes(s)) subSkillOrder.push(s);
  }
  for (const s of bySubSkill.keys()) {
    if (!subSkillOrder.includes(s)) subSkillOrder.push(s);
  }

  // Round-robin pick — seeded for determinism.
  const picked: DrillPrompt[] = [];
  let cursor = 0;
  while (picked.length < count) {
    let advanced = false;
    for (const s of subSkillOrder) {
      const pool = bySubSkill.get(s) ?? [];
      if (pool.length === 0) continue;
      const idx = stableIdx(input.seed, `${s}-${cursor}`, pool.length);
      const pick = pool[idx]!;
      // Splice so we don't re-pick within the same slate.
      pool.splice(idx, 1);
      picked.push(pick);
      advanced = true;
      if (picked.length >= count) break;
    }
    if (!advanced) break;
    cursor += 1;
  }

  return picked;
}

function stableIdx(
  seed: string | undefined,
  label: string,
  modulo: number,
): number {
  if (modulo <= 0) return 0;
  if (seed == null) return Math.floor(Math.random() * modulo);
  let h = 2166136261;
  const s = `${seed}::${label}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h % modulo;
}
