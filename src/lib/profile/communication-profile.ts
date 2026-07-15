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
import { canonicalizeSubSkillId, type SubSkillId } from "@/types/sub-skills";
import { isApplicationId, isApplicationSkill } from "@/types/application-skills";

export type SkillEstimate = {
  /** 0-100 estimate. */
  score: number;
  /** Evidence count backing the estimate. */
  sampleCount: number;
  /** ISO timestamp of the last contributing rep. */
  updatedAt: string;
};

export type ApplicationEstimate = SkillEstimate & {
  /** PRD §8.4.5 — hidden Application Skill estimates within this
   *  application (same EMA rule as everything else). The Lab
   *  personalization engine reads these to pick the weakest skill;
   *  never shown to users. Keyed by Application Skill id. */
  skills?: Partial<Record<string, { score: number; sampleCount: number }>>;
};

export type CommunicationProfileState = {
  coreSkills: Partial<Record<SkillDimension, SkillEstimate>>;
  hiddenSkills: Partial<Record<SubSkillId, { score: number; sampleCount: number }>>;
  /** PRD §8.3.6 — per-application performance, EMA over the composites
   *  of that application's reps (Skill Lab). Keyed by ApplicationId. */
  applications: Partial<Record<string, ApplicationEstimate>>;
  overallScore: number | null;
  totalReps: number;
};

export function emptyProfile(): CommunicationProfileState {
  return {
    coreSkills: {},
    hiddenSkills: {},
    applications: {},
    overallScore: null,
    totalReps: 0,
  };
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

/**
 * Phase 15 I-9 — coached attempts fold at HALF the learning rate.
 *
 * The profile is Cognify's estimate of how the user CURRENTLY
 * communicates unaided. A retry seconds after targeted coaching ("do
 * this one thing") measures the coached ceiling, not the baseline —
 * folding it at full weight drifts the profile toward that ceiling and
 * then every downstream engine (dim selection, plateau detection,
 * benchmarks) overestimates the user. The PRD's "every rep contributes"
 * (§8.3) is preserved: retry/again evidence still moves the estimate
 * and still increments sampleCount — just at half the k.
 * Recommendation approved by Max (audit item I-9).
 */
export const COACHED_ATTEMPT_WEIGHT = 0.5;

function isCoachedAttempt(kind: RepEvidence["attemptKind"]): boolean {
  return kind === "retry" || kind === "again";
}

/** One EMA step, honoring the coached-attempt half weight. */
function foldEstimate(
  prevScore: number,
  prevSampleCount: number,
  evidenceScore: number,
  coached: boolean,
): number {
  const k =
    learningRate(prevSampleCount) * (coached ? COACHED_ATTEMPT_WEIGHT : 1);
  return Math.round((prevScore + k * (evidenceScore - prevScore)) * 10) / 10;
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
  /** PRD §8.3.6 — when the rep belongs to a Skill Lab application, its
   *  composite folds into that application's estimate. */
  applicationId?: string | null;
  /** Hidden Application Skills the rep's exercise targets (PRD §8.4.5) —
   *  the composite also folds into each. Ids outside the application's
   *  canonical set are skipped. */
  applicationSkills?: string[] | null;
  composite?: number | null;
  /** Phase 15 I-9 — where the rep sits in the exercise learning loop
   *  (reps.attempt_kind). "retry"/"again" attempts happen seconds after
   *  targeted coaching and fold at HALF the learning rate (see
   *  COACHED_ATTEMPT_WEIGHT). Omitted/"first"/null → full weight. */
  attemptKind?: "first" | "retry" | "again" | null;
  /** ISO timestamp of the rep. */
  at: string;
};

const CANONICAL_DIMS = new Set<string>(SKILL_DIMENSIONS);

/** Fold one rep's evidence into the profile. Returns a NEW state. */
export function applyRepToProfile(
  profile: CommunicationProfileState,
  evidence: RepEvidence,
): CommunicationProfileState {
  // Phase 15 I-9 — coached attempts (retry/again) move every estimate at
  // half the k. When the evidence CREATES an estimate (no prior), it is
  // adopted outright regardless: an EMA has nothing to blend against,
  // and in practice a retry is always preceded by its first attempt.
  const coached = isCoachedAttempt(evidence.attemptKind);

  const coreSkills = { ...profile.coreSkills };
  for (const d of evidence.dimensions) {
    if (!CANONICAL_DIMS.has(d.dimension)) continue;
    if (!Number.isFinite(d.score)) continue;
    const dim = d.dimension as SkillDimension;
    const prev = coreSkills[dim];
    if (!prev) {
      coreSkills[dim] = { score: d.score, sampleCount: 1, updatedAt: evidence.at };
    } else {
      coreSkills[dim] = {
        score: foldEstimate(prev.score, prev.sampleCount, d.score, coached),
        sampleCount: prev.sampleCount + 1,
        updatedAt: evidence.at,
      };
    }
  }

  const hiddenSkills = { ...profile.hiddenSkills };
  if (evidence.subSkillScores) {
    for (const [id, raw] of Object.entries(evidence.subSkillScores)) {
      if (raw == null || !Number.isFinite(raw)) continue;
      // Taxonomy v2 (D20): pre-v2 ids in historical rep evidence fold
      // into their v2 successor; unknown ids are skipped.
      const skillId = canonicalizeSubSkillId(id);
      if (skillId == null) continue;
      const prev = hiddenSkills[skillId];
      if (!prev) {
        hiddenSkills[skillId] = { score: raw, sampleCount: 1 };
      } else {
        hiddenSkills[skillId] = {
          score: foldEstimate(prev.score, prev.sampleCount, raw, coached),
          sampleCount: prev.sampleCount + 1,
        };
      }
    }
  }

  // Application performance (PRD §8.3.6): the composite of a Skill Lab
  // rep folds into that application's estimate with the same EMA rule.
  const applications = { ...profile.applications };
  if (
    evidence.applicationId &&
    evidence.composite != null &&
    Number.isFinite(evidence.composite)
  ) {
    const prev = applications[evidence.applicationId];
    const composite = evidence.composite;

    // Per-Application-Skill fold (PRD §8.4.5): the same composite is the
    // evidence for each skill the exercise targets — that's the only
    // per-skill signal a rep produces today.
    const skills = { ...(prev?.skills ?? {}) };
    if (
      isApplicationId(evidence.applicationId) &&
      Array.isArray(evidence.applicationSkills)
    ) {
      for (const skillId of evidence.applicationSkills) {
        if (!isApplicationSkill(evidence.applicationId, skillId)) continue;
        const prevSkill = skills[skillId];
        if (!prevSkill) {
          skills[skillId] = { score: composite, sampleCount: 1 };
        } else {
          skills[skillId] = {
            score: foldEstimate(
              prevSkill.score,
              prevSkill.sampleCount,
              composite,
              coached,
            ),
            sampleCount: prevSkill.sampleCount + 1,
          };
        }
      }
    }

    if (!prev) {
      applications[evidence.applicationId] = {
        score: composite,
        sampleCount: 1,
        updatedAt: evidence.at,
        skills,
      };
    } else {
      applications[evidence.applicationId] = {
        score: foldEstimate(prev.score, prev.sampleCount, composite, coached),
        sampleCount: prev.sampleCount + 1,
        updatedAt: evidence.at,
        skills,
      };
    }
  }

  return {
    coreSkills,
    hiddenSkills,
    applications,
    overallScore: computeOverallScore(coreSkills),
    totalReps: profile.totalReps + 1,
  };
}
