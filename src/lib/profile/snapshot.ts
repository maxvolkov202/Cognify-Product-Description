// PRD v3 Phase 3 — the Communication Snapshot (PRD §8.3.11).
//
// One function that assembles Cognify's current understanding of a user
// before any intelligent decision. NOT stored — regenerated per call
// from the Communication Profile + coaching ledger. Every adaptive
// engine (coaching memory today; Skill Lab + Build a Rep engines in
// Phases 4-5; recommendations in Phase 7) starts here instead of
// re-aggregating ad-hoc SQL.

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  coachingEvents,
  communicationProfile,
  prepEvents,
} from "@/lib/db/schema";
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

/** PRD v3 Phase 7.1 — per-dimension coaching effectiveness: over the
 *  wider ledger window, how often does coaching on this dim get
 *  implemented? Drives technique selection (change the angle where
 *  coaching isn't landing). */
export type CoachingEffectiveness = {
  dimension: SkillDimension;
  coached: number;
  implemented: number;
  /** implemented / retried (nailed+partial+missed); null when the user
   *  never retried coaching on this dim. */
  rate: number | null;
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
  /** Phase 7.1 — implementation rates per coached dimension (wider
   *  window than recentCoaching). */
  coachingEffectiveness: CoachingEffectiveness[];
  /** Phase 7.6 (PRD §8.3.8) — active Build a Rep events + latest
   *  readiness, so every engine knows what the user is preparing for. */
  eventReadiness: { title: string; readinessScore: number | null }[];
};

const COACHING_LOOKBACK = 10;
/** Phase 7.1 — wider window for effectiveness aggregation. */
const EFFECTIVENESS_LOOKBACK = 40;
/** Coached ≥ this many RETRIED times with rate ≤ 1/3 = "resistant". */
export const EFFECTIVENESS_MIN_SAMPLES = 3;

export async function buildCommunicationSnapshot(
  userId: string,
): Promise<CommunicationSnapshot | null> {
  if (!userId || userId === "anonymous") return null;
  return safeDb<CommunicationSnapshot | null>(async () => {
    const [profileRow, coachingRows, effectivenessRows, eventRows] =
      await Promise.all([
        db
          .select({
            overallScore: communicationProfile.overallScore,
            coreSkills: communicationProfile.coreSkills,
            hiddenSkills: communicationProfile.hiddenSkills,
            applications: communicationProfile.applications,
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
        db
          .select({
            dimension: coachingEvents.dimension,
            implementedVerdict: coachingEvents.implementedVerdict,
          })
          .from(coachingEvents)
          .where(eq(coachingEvents.userId, userId))
          .orderBy(desc(coachingEvents.createdAt))
          .limit(EFFECTIVENESS_LOOKBACK),
        db
          .select({
            title: prepEvents.title,
            readinessScore: prepEvents.readinessScore,
          })
          .from(prepEvents)
          .where(
            and(eq(prepEvents.userId, userId), eq(prepEvents.status, "active")),
          )
          .orderBy(desc(prepEvents.updatedAt))
          .limit(3),
      ]);

    const profile: CommunicationProfileState = profileRow
      ? {
          coreSkills:
            profileRow.coreSkills as CommunicationProfileState["coreSkills"],
          hiddenSkills:
            profileRow.hiddenSkills as CommunicationProfileState["hiddenSkills"],
          applications:
            (profileRow.applications as CommunicationProfileState["applications"]) ?? {},
          overallScore: profileRow.overallScore,
          totalReps: profileRow.totalReps,
        }
      : {
          coreSkills: {},
          hiddenSkills: {},
          applications: {},
          overallScore: null,
          totalReps: 0,
        };

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

    // Phase 7.1 — per-dim implementation rates over the wider window.
    // Only RETRIED focuses count toward the rate (null verdict = never
    // retried, which measures engagement, not coaching quality).
    const effAgg = new Map<
      SkillDimension,
      { coached: number; retried: number; implemented: number }
    >();
    for (const r of effectivenessRows) {
      const dim = r.dimension as SkillDimension;
      const cur = effAgg.get(dim) ?? { coached: 0, retried: 0, implemented: 0 };
      cur.coached += 1;
      if (r.implementedVerdict != null) {
        cur.retried += 1;
        if (
          r.implementedVerdict === "nailed" ||
          r.implementedVerdict === "partial"
        ) {
          cur.implemented += 1;
        }
      }
      effAgg.set(dim, cur);
    }
    const coachingEffectiveness: CoachingEffectiveness[] = [
      ...effAgg.entries(),
    ].map(([dimension, a]) => ({
      dimension,
      coached: a.coached,
      implemented: a.implemented,
      rate: a.retried > 0 ? a.implemented / a.retried : null,
    }));

    return {
      profile,
      weakestCoreSkill: weakest,
      strongestCoreSkill: strongest,
      recentCoaching,
      recurringWeaknesses,
      coachingEffectiveness,
      eventReadiness: eventRows.map((e) => ({
        title: e.title,
        readinessScore: e.readinessScore,
      })),
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
  // Phase 7.1 — technique selection: where coaching demonstrably isn't
  // landing across the wider ledger, tell the model to switch technique.
  const resistant = snapshot.coachingEffectiveness.filter(
    (e) =>
      e.rate != null &&
      e.rate <= 1 / 3 &&
      e.coached >= EFFECTIVENESS_MIN_SAMPLES,
  );
  if (resistant.length > 0) {
    lines.push(
      `EFFECTIVENESS: ${resistant
        .map((e) => `${e.dimension} coaching implemented ${e.implemented}/${e.coached}`)
        .join("; ")} — for these, use a DIFFERENT coaching technique: smaller single step, a concrete before/after example from THIS transcript, or coach via a related hidden skill instead.`,
    );
  }
  lines.push(
    "Rules: acknowledge implemented coaching briefly when relevant; never re-issue a focus marked IMPLEMENTED unless the behavior visibly regressed in THIS transcript.",
  );
  return lines.join("\n");
}
