// PRD v3 Phase 3 — the Communication Profile update rule.
//
// The profile is Cognify's slowly-evolving ESTIMATE of how a user
// communicates; rep scores are EVIDENCE feeding it (PRD §8.3: "the
// Communication Profile is not a record of previous scores — it is
// Cognify's best estimate of how the user currently communicates").
//
// Pure functions only — persistence lives in the saveRep write path and
// the backfill script. Tested in tests/communication-profile.test.ts.

import {
  SKILL_DIMENSIONS,
  DIMENSION_WEIGHTS,
  type SkillDimension,
} from "@/types/domain";
import { SUB_SKILL_TO_DIMENSION, type SubSkillId } from "@/types/sub-skills";

export type SkillEstimate = {
  /** 0-100 estimate. */
  score: number;
  /** Evidence count backing the estimate. */
  sampleCount: number;
  /** ISO timestamp of the last contributing rep. */
  updatedAt: string;
};

export type CommunicationProfileState = {
  coreSkills: Partial<Record<SkillDimension, SkillEstimate>>;
  hiddenSkills: Partial<Record<SubSkillId, { score: number; sampleCount: number }>>;
  overallScore: number | null;
  totalReps: number;
};

export function emptyProfile(): CommunicationProfileState {
  return { coreSkills: {}, hiddenSkills: {}, overallScore: null, totalReps: 0 };
}

/** Count-scaled EMA learning rate: rep 1 adopts the evidence outright;
 *  a mature profile (12+ reps on the skill) moves at k = 1/12 ≈ 0.083,
 *  so one rep shifts the estimate by at most ~8 points even on an
 *  extreme outlier — "long-term trends matter more than individual
 *  scores" (PRD §4.5.1, §11.5). */
export const PROFILE_MAX_SAMPLE_WEIGHT = 12;

export function learningRate(sampleCount: number): number {
  return 1 / Math.min(sampleCount + 1, PROFILE_MAX_SAMPLE_WEIGHT);
}

/** Overall Communication Score (PRD §10.3): DIMENSION_WEIGHTS-weighted
 *  average over measured core skills. Null until at least 3 skills have
 *  evidence — a one-skill "overall" would be noise dressed as a number. */
export const OVERALL_MIN_SKILLS = 3;

export function computeOverallScore(
  coreSkills: CommunicationProfileState["coreSkills"],
): number | null {
  let weighted = 0;
  let totalWeight = 0;
  let measured = 0;
  for (const dim of SKILL_DIMENSIONS) {
    const est = coreSkills[dim];
    if (!est) continue;
    const w = DIMENSION_WEIGHTS[dim] ?? 0;
    weighted += est.score * w;
    totalWeight += w;
    measured += 1;
  }
  if (measured < OVERALL_MIN_SKILLS || totalWeight === 0) return null;
  return Math.round((weighted / totalWeight) * 10) / 10;
}

export type RepEvidence = {
  /** Per-dimension scores from the rep (v3 canonical dims only —
   *  callers must alias legacy dims first; unknown dims are skipped). */
  dimensions: { dimension: string; score: number }[];
  /** Optional per-sub-skill scores (Ch.11 signals). Invalid ids skipped. */
  subSkillScores?: Partial<Record<string, number>> | null;
  /** ISO timestamp of the rep. */
  at: string;
};

const CANONICAL_DIMS = new Set<string>(SKILL_DIMENSIONS);

/** Fold one rep's evidence into the profile. Returns a NEW state. */
export function applyRepToProfile(
  profile: CommunicationProfileState,
  evidence: RepEvidence,
): CommunicationProfileState {
  const coreSkills = { ...profile.coreSkills };
  for (const d of evidence.dimensions) {
    if (!CANONICAL_DIMS.has(d.dimension)) continue;
    if (!Number.isFinite(d.score)) continue;
    const dim = d.dimension as SkillDimension;
    const prev = coreSkills[dim];
    if (!prev) {
      coreSkills[dim] = { score: d.score, sampleCount: 1, updatedAt: evidence.at };
    } else {
      const k = learningRate(prev.sampleCount);
      coreSkills[dim] = {
        score: Math.round((prev.score + k * (d.score - prev.score)) * 10) / 10,
        sampleCount: prev.sampleCount + 1,
        updatedAt: evidence.at,
      };
    }
  }

  const hiddenSkills = { ...profile.hiddenSkills };
  if (evidence.subSkillScores) {
    for (const [id, raw] of Object.entries(evidence.subSkillScores)) {
      if (raw == null || !Number.isFinite(raw)) continue;
      if (!(id in SUB_SKILL_TO_DIMENSION)) continue;
      const skillId = id as SubSkillId;
      const prev = hiddenSkills[skillId];
      if (!prev) {
        hiddenSkills[skillId] = { score: raw, sampleCount: 1 };
      } else {
        const k = learningRate(prev.sampleCount);
        hiddenSkills[skillId] = {
          score: Math.round((prev.score + k * (raw - prev.score)) * 10) / 10,
          sampleCount: prev.sampleCount + 1,
        };
      }
    }
  }

  return {
    coreSkills,
    hiddenSkills,
    overallScore: computeOverallScore(coreSkills),
    totalReps: profile.totalReps + 1,
  };
}
