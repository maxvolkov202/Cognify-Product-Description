/**
 * PRD v3 Phase 6 — Cognify Rank (PRD §10.5, decision D4).
 *
 * 8 tiers × 4 divisions (Bronze I … Grandmaster IV), derived PURELY from
 * lifetime XP — no rank column, no migration, permanent-forward by
 * construction (XP only grows). Divisions ascend I → IV within a tier
 * (the PRD lists Bronze I first), then promote to the next tier's I.
 *
 * Threshold anchoring: each tier occupies the same level range as its
 * LEVEL_BANDS predecessor (D4: "absorb Level 1-100"), with division
 * floors at evenly spaced level anchors inside that range, converted to
 * XP through the existing `xpForLevel` curve. That inherits the tuned
 * non-linear progression (§10.5.4: early ranks fast, later ranks slow)
 * and makes the levels→ranks mapping exact: a level-16 user IS Silver I.
 *
 * Users never see XP numbers on rank surfaces (§10.5.2) — only the badge
 * and a progress bar. XP stays internal.
 */

import { xpForLevel, MAX_LEVEL } from "./levels";

export const RANK_TIERS = [
  { id: "bronze", label: "Bronze", minLevel: 1, maxLevel: 15, color: "#b45309" },
  { id: "silver", label: "Silver", minLevel: 16, maxLevel: 30, color: "#64748b" },
  { id: "gold", label: "Gold", minLevel: 31, maxLevel: 45, color: "#d97706" },
  { id: "platinum", label: "Platinum", minLevel: 46, maxLevel: 60, color: "#0891b2" },
  { id: "diamond", label: "Diamond", minLevel: 61, maxLevel: 74, color: "#2563eb" },
  { id: "elite", label: "Elite", minLevel: 75, maxLevel: 85, color: "#7c3aed" },
  { id: "master", label: "Master", minLevel: 86, maxLevel: 95, color: "#c026d3" },
  { id: "grandmaster", label: "Grandmaster", minLevel: 96, maxLevel: MAX_LEVEL, color: "#e11d48" },
] as const;

export type RankTierId = (typeof RANK_TIERS)[number]["id"];

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
  /** 0-1 toward the next rank; 1 at the ceiling. */
  progress: number;
  nextLabel: string | null;
};

/** 32 cumulative XP floors, strictly ascending. Computed once. */
export const RANK_FLOORS: readonly { floorXp: number; tier: number; division: number }[] =
  (() => {
    const floors: { floorXp: number; tier: number; division: number }[] = [];
    RANK_TIERS.forEach((tier, t) => {
      const span = tier.maxLevel - tier.minLevel + 1;
      for (let d = 0; d < 4; d++) {
        const anchorLevel = tier.minLevel + Math.floor((span * d) / 4);
        floors.push({
          floorXp: t === 0 && d === 0 ? 0 : xpForLevel(anchorLevel),
          tier: t,
          division: d + 1,
        });
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
