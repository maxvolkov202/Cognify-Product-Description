/**
 * Grading Engine V2 — Arm C: tone-decomposition roll-up.
 *
 * Tone is the dimension Max least trusts ("hard to tell if it's graded
 * right") and the one with the highest run-to-run variance, because a
 * single LLM call emits one continuous 0-100 number from a fuzzy holistic
 * impression. This module replaces that with a deterministic roll-up:
 *
 *   - the LLM emits ORDINAL observations (strong | present | weak | absent)
 *     + short evidence for a few load-bearing, transcript-judgeable tone
 *     sub-skills (directness / authority / assertiveness);
 *   - the prosody mapper already produces measured 0-100 scores for the
 *     voice-driven tone sub-skills (confidence / warmth / gravitas /
 *     emotional_authenticity / calmness) from the Hume emotion vector;
 *   - this file rolls those up into the tone dimension score with pure
 *     math anchored to the rubric bands, prosody-weighted when audio is
 *     present.
 *
 * Why it helps: ordinal judgments are far lower-variance than a continuous
 * guess (four buckets vs. 101 values), the number becomes explainable (it
 * is the average of named observations, each with evidence), and the tone
 * sub-skills finally roll UP into the dimension score instead of being
 * attribution-only.
 */

import type { ToneSubSkill } from "@/types/sub-skills";

export type OrdinalLevel = "strong" | "present" | "weak" | "absent";

export type ToneObservation = {
  subSkill: ToneSubSkill;
  level: OrdinalLevel;
  /** ≤120-char transcript evidence for the observation (audit trail). */
  evidence?: string;
};

/**
 * Ordinal → points, anchored to the rubric BAND_RANGES (rubric-anchors.ts):
 *   strong  → 81-100 band (center-high)
 *   present → 61-80 band  (center)
 *   weak    → 41-60 band  (lower-mid)
 *   absent  → 21-40 band  (present-but-failing, not junk-zero)
 * Point values sit inside each band so a rep built entirely of "present"
 * observations lands a defensible ~68, never a compressed 55.
 */
export const ORDINAL_POINTS: Record<OrdinalLevel, number> = {
  strong: 88,
  present: 68,
  weak: 45,
  absent: 28,
};

export function ordinalToPoints(level: OrdinalLevel): number {
  return ORDINAL_POINTS[level];
}

/** Transcript-judgeable tone sub-skills the LLM scores ordinally. Kept
 *  short and load-bearing (the plan's ~3): these are the tone qualities a
 *  reader CAN judge from words alone. */
export const LLM_TONE_SUBSKILLS: ToneSubSkill[] = [
  "directness",
  "authority",
  "assertiveness",
];

/** Voice-driven tone sub-skills the prosody mapper measures from the Hume
 *  emotion vector (sub-skill-mapper.ts). Only trusted when worker prosody
 *  is present. */
export const PROSODY_TONE_SUBSKILLS: ToneSubSkill[] = [
  "confidence",
  "warmth",
  "gravitas",
  "emotional_authenticity",
  "calmness",
];

/** Weight on the prosody group when BOTH prosody and LLM-ordinal evidence
 *  exist. Voice is the stronger tone instrument when we can hear it, so it
 *  leads; the ordinal read keeps the words honest. */
const PROSODY_WEIGHT = 0.6;
/** Tone score when there is no evidence at all — band center, conservative
 *  (mirrors the system prompt's "grade tone toward band center from text
 *  alone" rule). */
const NO_EVIDENCE_TONE = 60;

export type ToneRollupInput = {
  /** LLM ordinal observations (any tone sub-skills; only the LLM set is
   *  averaged into the text component). */
  observations: ToneObservation[];
  /** Prosody-measured tone sub-skill scores (0-100), e.g. the tone subset
   *  of mapSignalsToSubSkillScores. Only used when hasProsody. */
  prosodyScores?: Partial<Record<ToneSubSkill, number>>;
  /** True when worker prosody is present (hasWorkerProsody). */
  hasProsody: boolean;
};

export type ToneRollupResult = {
  /** The tone dimension score, 0-100. */
  score: number;
  /** Per-sub-skill points that fed the roll-up — rolls the sub-skills UP
   *  into the dimension (attach to DimensionScore.subSkillScores). */
  subSkillScores: Partial<Record<ToneSubSkill, number>>;
  /** How the score was derived (telemetry + auditability). */
  method: "prosody-weighted" | "text-ordinal" | "no-evidence";
};

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Deterministic tone roll-up. Pure function of the observations + prosody
 * scores → same inputs always yield the same number (the anti-variance
 * win). Prosody-weighted when audio is present, else the ordinal text read
 * alone, else a conservative band-center default.
 */
export function rollupTone(input: ToneRollupInput): ToneRollupResult {
  const perSkill: Partial<Record<ToneSubSkill, number>> = {};

  // Text component — average of the LLM-ordinal tone sub-skills.
  const llmPts: number[] = [];
  for (const obs of input.observations) {
    const pts = ordinalToPoints(obs.level);
    perSkill[obs.subSkill] = pts;
    if (LLM_TONE_SUBSKILLS.includes(obs.subSkill)) llmPts.push(pts);
  }
  const llmAvg = llmPts.length ? mean(llmPts) : null;

  // Voice component — average of the measured prosody tone sub-skills.
  const prosodyPts: number[] = [];
  if (input.hasProsody && input.prosodyScores) {
    for (const sk of PROSODY_TONE_SUBSKILLS) {
      const v = input.prosodyScores[sk];
      if (v != null) {
        perSkill[sk] = Math.round(v);
        prosodyPts.push(v);
      }
    }
  }
  const prosodyAvg = prosodyPts.length ? mean(prosodyPts) : null;

  let score: number;
  let method: ToneRollupResult["method"];
  if (prosodyAvg != null && llmAvg != null) {
    score = prosodyAvg * PROSODY_WEIGHT + llmAvg * (1 - PROSODY_WEIGHT);
    method = "prosody-weighted";
  } else if (prosodyAvg != null) {
    score = prosodyAvg;
    method = "prosody-weighted";
  } else if (llmAvg != null) {
    score = llmAvg;
    method = "text-ordinal";
  } else {
    score = NO_EVIDENCE_TONE;
    method = "no-evidence";
  }

  return {
    score: clamp(Math.round(score), 0, 100),
    subSkillScores: perSkill,
    method,
  };
}

/** Coerce a loosely-typed model observation into a ToneObservation, or
 *  null if it isn't a usable tone observation (unknown sub-skill or level).
 *  Lenient by design — a stray malformed observation is dropped, never a
 *  parse failure. */
export function coerceToneObservation(
  raw: unknown,
  validSubSkills: ReadonlySet<string>,
): ToneObservation | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const subSkill = typeof o.subSkill === "string" ? o.subSkill : null;
  const level = typeof o.level === "string" ? o.level.toLowerCase() : null;
  if (!subSkill || !validSubSkills.has(subSkill)) return null;
  if (
    level !== "strong" &&
    level !== "present" &&
    level !== "weak" &&
    level !== "absent"
  ) {
    return null;
  }
  const evidence =
    typeof o.evidence === "string" ? o.evidence.slice(0, 120) : undefined;
  return { subSkill: subSkill as ToneSubSkill, level, evidence };
}
