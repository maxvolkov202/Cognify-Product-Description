// PRD v3 Phase 7.4 — Communication Stage benchmark bands.
//
// Static v1: with no population data yet, these bands are editorial
// anchors ("typical for your stage") so the Overall Communication Score
// has context without shaming new users. Replace with real percentile
// data once enough profiles accumulate (the query is a one-liner over
// communication_profile.overall_score grouped by users.communication_stage).

export type StageBenchmark = {
  stage: string;
  label: string;
  /** Typical Overall Communication Score band for this stage. */
  low: number;
  high: number;
};

export const STAGE_BENCHMARKS: readonly StageBenchmark[] = [
  { stage: "student", label: "Student", low: 45, high: 62 },
  { stage: "early_career", label: "Early career", low: 50, high: 66 },
  {
    stage: "individual_contributor",
    label: "Individual contributor",
    low: 55,
    high: 70,
  },
  { stage: "manager", label: "Manager", low: 60, high: 75 },
  { stage: "senior_leader", label: "Senior leader", low: 65, high: 80 },
  { stage: "executive", label: "Executive", low: 70, high: 85 },
];

export function benchmarkForStage(
  stage: string | null | undefined,
): StageBenchmark | null {
  if (!stage) return null;
  return STAGE_BENCHMARKS.find((b) => b.stage === stage) ?? null;
}

/** One-line context for a score vs the user's stage band. */
export function benchmarkNote(
  score: number,
  stage: string | null | undefined,
): string | null {
  const b = benchmarkForStage(stage);
  if (!b) return null;
  if (score > b.high) return `Above typical for ${b.label.toLowerCase()}s`;
  if (score < b.low) return `Building toward the ${b.label.toLowerCase()} band`;
  return `Typical ${b.label.toLowerCase()} band: ${b.low}–${b.high}`;
}
