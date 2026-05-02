/**
 * Hint selector — picks 2 hints for a rep based on focus dimension and
 * (when available) the user's weakest sub-skills.
 *
 * Stratification: takes a `seenHintTexts` set so the caller can pass
 * session-storage state and avoid showing the same hint twice in a
 * session. When the bank for a sub-skill is exhausted, falls back to the
 * dimension-wide pool.
 */

import { SUB_SKILLS, type SubSkillId } from "@/types/sub-skills";
import type { SkillDimension } from "@/types/domain";
import { HINTS, type Hint } from "./index";

export type PickHintsInput = {
  /** The dimension this rep targets. Drives which sub-skills are
   *  candidates. Required. */
  dimension: SkillDimension;
  /** Optional: which sub-skills the user is weakest at within this
   *  dimension. When supplied, prefer hints from these. */
  weakestSubSkills?: readonly SubSkillId[];
  /** Hint texts already shown this session — avoid repeating. */
  seenHintTexts?: ReadonlySet<string>;
  /** How many hints to return. Default 2. */
  count?: number;
};

/** Deterministic-friendly seed; pass a stable rep id to make the picker
 *  reproducible for testing. */
export type PickHintsOptions = {
  /** Stable seed (e.g. `repId`). When omitted, uses Math.random(). */
  seed?: string;
};

export function pickHintsForRep(
  input: PickHintsInput,
  options: PickHintsOptions = {},
): Hint[] {
  const count = input.count ?? 2;
  const seen = input.seenHintTexts ?? new Set<string>();

  // Build the candidate pool: weakest sub-skills first, then the rest of
  // the dimension's sub-skills. This way a user with a known Tone weakness
  // on `downward_inflection` sees hints for that first, with `pitch_variation`
  // / `volume_control` filling the second slot.
  const dimensionSubSkills = SUB_SKILLS[input.dimension];
  const ordered: SubSkillId[] = [];
  for (const s of input.weakestSubSkills ?? []) {
    if (
      (dimensionSubSkills as readonly SubSkillId[]).includes(s) &&
      !ordered.includes(s)
    ) {
      ordered.push(s);
    }
  }
  for (const s of dimensionSubSkills) {
    if (!ordered.includes(s)) ordered.push(s);
  }

  // Walk the ordered sub-skill list, taking one unseen hint from each
  // until we have `count`. Falls back to seen hints if the bank is
  // exhausted (small bank + long session pathological case).
  const result: Hint[] = [];
  const usedSubSkills = new Set<SubSkillId>();

  // Pass 1: one unseen hint per sub-skill, in priority order.
  for (const subSkill of ordered) {
    if (result.length >= count) break;
    const pool = HINTS[subSkill] ?? [];
    const unseen = pool.filter((h) => !seen.has(h.text));
    if (unseen.length === 0) continue;
    const pick = stablePick(unseen, options.seed, subSkill);
    result.push(pick);
    usedSubSkills.add(subSkill);
  }

  // Pass 2: if still short, allow second hint from same sub-skill (still
  // unseen).
  if (result.length < count) {
    for (const subSkill of ordered) {
      if (result.length >= count) break;
      const pool = HINTS[subSkill] ?? [];
      const unseenFiltered = pool.filter(
        (h) => !seen.has(h.text) && !result.includes(h),
      );
      if (unseenFiltered.length === 0) continue;
      const pick = stablePick(unseenFiltered, options.seed, `${subSkill}-2`);
      result.push(pick);
    }
  }

  // Pass 3 (last resort): allow seen hints to fill the slot.
  if (result.length < count) {
    for (const subSkill of ordered) {
      if (result.length >= count) break;
      const pool = HINTS[subSkill] ?? [];
      const filtered = pool.filter((h) => !result.includes(h));
      if (filtered.length === 0) continue;
      result.push(stablePick(filtered, options.seed, `${subSkill}-fallback`));
    }
  }

  return result.slice(0, count);
}

/** Deterministic pick when seed is supplied (for tests / SSR), otherwise
 *  random. Hash combines seed + label so different sub-skill slots in the
 *  same call get different picks even with the same seed. */
function stablePick<T>(
  arr: readonly T[],
  seed: string | undefined,
  label: string,
): T {
  if (arr.length === 0) {
    throw new Error("stablePick called on empty array");
  }
  if (seed == null) {
    return arr[Math.floor(Math.random() * arr.length)]!;
  }
  let h = 2166136261;
  const s = `${seed}::${label}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return arr[h % arr.length]!;
}
