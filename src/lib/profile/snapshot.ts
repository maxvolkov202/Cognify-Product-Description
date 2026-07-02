// PRD v3 Phase 3 — the Communication Snapshot (PRD §8.3.11).
//
// One function that assembles Cognify's current understanding of a user
// before any intelligent decision. NOT stored — regenerated per call
// from the Communication Profile + coaching ledger. Every adaptive
// engine (coaching memory today; Skill Lab + Build a Rep engines in
// Phases 4-5; recommendations in Phase 7) starts here instead of
// re-aggregating ad-hoc SQL.

import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { coachingEvents, communicationProfile } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import type { SkillDimension } from "@/types/domain";
import { SKILL_DIMENSIONS } from "@/types/domain";
import type { CommunicationProfileState } from "./communication-profile";

export type CoachingMemoryEntry = {
  dimension: SkillDimension;
  subSkill: string | null;
  focusText: string;
  /** nailed | partial | missed | null (never retried). */
  implementedVerdict: string | null;
  at: string;
};

export type CommunicationSnapshot = {
  profile: CommunicationProfileState;
  /** Weakest / strongest measured core skill (null with no evidence). */
  weakestCoreSkill: { dimension: SkillDimension; score: number } | null;
  strongestCoreSkill: { dimension: SkillDimension; score: number } | null;
  /** Most recent Coach's Focus deliveries, newest first. */
  recentCoaching: CoachingMemoryEntry[];
  /** Dimensions coached ≥3 times in the recent window whose focuses keep
   *  missing — the model should change its coaching angle, not repeat. */
  recurringWeaknesses: SkillDimension[];
};

const COACHING_LOOKBACK = 10;

export async function buildCommunicationSnapshot(
  userId: string,
): Promise<CommunicationSnapshot | null> {
  if (!userId || userId === "anonymous") return null;
  return safeDb<CommunicationSnapshot | null>(async () => {
    const [profileRow, coachingRows] = await Promise.all([
      db
        .select({
          overallScore: communicationProfile.overallScore,
          coreSkills: communicationProfile.coreSkills,
          hiddenSkills: communicationProfile.hiddenSkills,
          totalReps: communicationProfile.totalReps,
        })
        .from(communicationProfile)
        .where(eq(communicationProfile.userId, userId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({
          dimension: coachingEvents.dimension,
          subSkill: coachingEvents.subSkill,
          focusText: coachingEvents.focusText,
          implementedVerdict: coachingEvents.implementedVerdict,
          createdAt: coachingEvents.createdAt,
        })
        .from(coachingEvents)
        .where(eq(coachingEvents.userId, userId))
        .orderBy(desc(coachingEvents.createdAt))
        .limit(COACHING_LOOKBACK),
    ]);

    const profile: CommunicationProfileState = profileRow
      ? {
          coreSkills:
            profileRow.coreSkills as CommunicationProfileState["coreSkills"],
          hiddenSkills:
            profileRow.hiddenSkills as CommunicationProfileState["hiddenSkills"],
          overallScore: profileRow.overallScore,
          totalReps: profileRow.totalReps,
        }
      : { coreSkills: {}, hiddenSkills: {}, overallScore: null, totalReps: 0 };

    let weakest: { dimension: SkillDimension; score: number } | null = null;
    let strongest: { dimension: SkillDimension; score: number } | null = null;
    for (const dim of SKILL_DIMENSIONS) {
      const est = profile.coreSkills[dim];
      if (!est) continue;
      if (!weakest || est.score < weakest.score) {
        weakest = { dimension: dim, score: est.score };
      }
      if (!strongest || est.score > strongest.score) {
        strongest = { dimension: dim, score: est.score };
      }
    }

    const recentCoaching: CoachingMemoryEntry[] = coachingRows.map((r) => ({
      dimension: r.dimension as SkillDimension,
      subSkill: r.subSkill,
      focusText: r.focusText,
      implementedVerdict: r.implementedVerdict,
      at: r.createdAt.toISOString(),
    }));

    const missCounts = new Map<SkillDimension, number>();
    for (const c of recentCoaching) {
      if (c.implementedVerdict === "missed" || c.implementedVerdict == null) {
        missCounts.set(c.dimension, (missCounts.get(c.dimension) ?? 0) + 1);
      }
    }
    const recurringWeaknesses = [...missCounts.entries()]
      .filter(([, n]) => n >= 3)
      .map(([dim]) => dim);

    return {
      profile,
      weakestCoreSkill: weakest,
      strongestCoreSkill: strongest,
      recentCoaching,
      recurringWeaknesses,
    };
  }, null);
}

/** Render the COACHING MEMORY block for the scoring prompt (PRD §8.6.4).
 *  Returns null when there's nothing to remember — first-time users and
 *  calibration reference reps produce byte-identical prompts. */
export function renderCoachingMemoryBlock(
  snapshot: CommunicationSnapshot | null,
): string | null {
  if (!snapshot || snapshot.recentCoaching.length === 0) return null;
  const lines: string[] = [
    "COACHING MEMORY (the user's recent Coach's Focus history — newest first):",
  ];
  for (const c of snapshot.recentCoaching.slice(0, 5)) {
    const verdict =
      c.implementedVerdict === "nailed"
        ? "IMPLEMENTED"
        : c.implementedVerdict === "partial"
          ? "partially implemented"
          : c.implementedVerdict === "missed"
            ? "not yet implemented"
            : "no retry recorded";
    lines.push(`  - [${c.dimension}] "${c.focusText}" → ${verdict}`);
  }
  if (snapshot.recurringWeaknesses.length > 0) {
    lines.push(
      `RECURRING: ${snapshot.recurringWeaknesses.join(", ")} coaching keeps not landing — change the ANGLE (different hidden skill, different framing, or a smaller step), do not repeat prior focus text.`,
    );
  }
  lines.push(
    "Rules: acknowledge implemented coaching briefly when relevant; never re-issue a focus marked IMPLEMENTED unless the behavior visibly regressed in THIS transcript.",
  );
  return lines.join("\n");
}
