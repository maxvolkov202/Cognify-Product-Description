/**
 * PRD v3 Phase 6 — Cognify Rank (PRD §10.5, decision D4).
 *
 * 8 tiers × 4 divisions (Bronze I … Grandmaster IV), derived PURELY from
 * lifetime XP — no rank column, no migration, permanent-forward by
 * construction (XP only grows). Divisions ascend I → IV within a tier
 * (the PRD lists Bronze I first), then promote to the next tier's I.
 *
 * Threshold curve (Overhaul Phase 3 §3.3 — retunes D4's level-anchored
 * floors): each tier has a single FLAT per-division cost (TIER_DIVISION_XP)
 * that STEPS UP by tier. So all four Bronze divisions cost the same, every
 * Silver division costs more than a Bronze one, every Gold division more
 * than a Silver one, and so on. Floors are the running sum of those costs.
 * This makes the progression legible ("each rank in a tier is the same
 * climb; the next tier is a bigger climb") and preserves §10.5.4's
 * non-linear shape (later tiers graduate slower) without inheriting the
 * uneven within-tier deltas the old level-anchoring produced.
 *
 * The floors are DECOUPLED from the Level 1-100 curve (`xpForLevel`) — the
 * two ladders no longer align division-for-level. Re-floor safety: the
 * Bronze per-division cost (800) was chosen against the live prod XP
 * distribution (2026-07-22: 718 users, 710 at 0 XP, top user 3,400 XP) so
 * that NO existing user demotes — the highest real users stay in their
 * current division or promote. See tests/progression-rank.test.ts.
 *
 * Rank XP is now VISIBLE (DEC-2 amends §10.5.2): surfaces show "N XP · M to
 * <next>" alongside the badge and progress bar. `rankFromXp` returns
 * `xpInRank`/`xpToNext` for that copy.
 */

export const RANK_TIERS = [
  { id: "bronze", label: "Bronze", color: "#b45309" },
  { id: "silver", label: "Silver", color: "#64748b" },
  { id: "gold", label: "Gold", color: "#d97706" },
  { id: "platinum", label: "Platinum", color: "#0891b2" },
  { id: "diamond", label: "Diamond", color: "#2563eb" },
  { id: "elite", label: "Elite", color: "#7c3aed" },
  { id: "master", label: "Master", color: "#c026d3" },
  { id: "grandmaster", label: "Grandmaster", color: "#e11d48" },
] as const;

export type RankTierId = (typeof RANK_TIERS)[number]["id"];

/**
 * Flat XP cost of ONE division within each tier. Constant inside a tier,
 * strictly increasing across tiers, so higher tiers graduate slower.
 * A tier's four divisions each add this amount; the jump into the next
 * tier's division I is one more of the previous tier's cost (i.e. the
 * fourth division of the current tier completes here).
 *
 * Bronze = 800 is the re-floor safety anchor (see file header): with it,
 * Bronze III sits at 1,600 XP — below the top live users at 1,781 / 2,663
 * XP — so the retune never demotes anyone. Steps rise by +100 each tier
 * (500 → 1,100 second differences) for a smooth accelerating climb;
 * Grandmaster IV lands at 97,600 XP total.
 */
export const TIER_DIVISION_XP: Record<RankTierId, number> = {
  bronze: 800,
  silver: 1300,
  gold: 1900,
  platinum: 2600,
  diamond: 3400,
  elite: 4300,
  master: 5300,
  grandmaster: 6400,
};

export const DIVISION_ROMAN = ["I", "II", "III", "IV"] as const;

export type RankInfo = {
  /** 0-31, Bronze I = 0, Grandmaster IV = 31. */
  rankIndex: number;
  tierId: RankTierId;
  tierLabel: string;
  tierColor: string;
  /** 1-4 (I-IV ascending). */
  division: number;
  divisionRoman: (typeof DIVISION_ROMAN)[number];
  /** e.g. "Silver III". */
  label: string;
  /** Cumulative XP floor of this rank. */
  floorXp: number;
  /** Floor of the NEXT rank; null at Grandmaster IV. */
  nextFloorXp: number | null;
  /** XP earned SINCE entering this rank (xp − floorXp), clamped ≥ 0. */
  xpInRank: number;
  /** XP still needed to reach the next rank; null at Grandmaster IV. */
  xpToNext: number | null;
  /** 0-1 toward the next rank; 1 at the ceiling. */
  progress: number;
  nextLabel: string | null;
};

/**
 * 32 cumulative XP floors, strictly ascending. Computed once from
 * TIER_DIVISION_XP: each tier's four divisions add the same flat cost,
 * and the running total carries into the next tier. Bronze I = 0.
 */
export const RANK_FLOORS: readonly { floorXp: number; tier: number; division: number }[] =
  (() => {
    const floors: { floorXp: number; tier: number; division: number }[] = [];
    let cumulative = 0;
    RANK_TIERS.forEach((tier, t) => {
      const divisionCost = TIER_DIVISION_XP[tier.id];
      for (let d = 0; d < 4; d++) {
        floors.push({ floorXp: cumulative, tier: t, division: d + 1 });
        cumulative += divisionCost;
      }
    });
    return floors;
  })();

export function rankFromXp(xp: number): RankInfo {
  const clamped = Math.max(0, Math.floor(xp));
  let idx = 0;
  for (let i = RANK_FLOORS.length - 1; i >= 0; i--) {
    if (clamped >= RANK_FLOORS[i]!.floorXp) {
      idx = i;
      break;
    }
  }
  const floor = RANK_FLOORS[idx]!;
  const next = idx + 1 < RANK_FLOORS.length ? RANK_FLOORS[idx + 1]! : null;
  const tier = RANK_TIERS[floor.tier]!;
  const nextTier = next ? RANK_TIERS[next.tier]! : null;
  const progress = next
    ? Math.max(
        0,
        Math.min(
          1,
          (clamped - floor.floorXp) / (next.floorXp - floor.floorXp),
        ),
      )
    : 1;
  return {
    rankIndex: idx,
    tierId: tier.id,
    tierLabel: tier.label,
    tierColor: tier.color,
    division: floor.division,
    divisionRoman: DIVISION_ROMAN[floor.division - 1]!,
    label: `${tier.label} ${DIVISION_ROMAN[floor.division - 1]}`,
    floorXp: floor.floorXp,
    nextFloorXp: next?.floorXp ?? null,
    xpInRank: clamped - floor.floorXp,
    xpToNext: next ? next.floorXp - clamped : null,
    progress,
    nextLabel:
      next && nextTier
        ? `${nextTier.label} ${DIVISION_ROMAN[next.division - 1]}`
        : null,
  };
}

/** Did this XP delta cross a rank floor? (Rank-up celebration hook.) */
export function rankChanged(previousXp: number, newXp: number): boolean {
  return rankFromXp(previousXp).rankIndex !== rankFromXp(newXp).rankIndex;
}
