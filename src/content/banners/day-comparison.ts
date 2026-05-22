// Phase 13 — day-start banner templates (Q4 in the design brief).
//
// Named-slot strings. The MuscleGroupHeader picks the right variant
// based on `lastDay` shape, then runs the chosen template through
// `formatVoice` from src/content/mascot/pick.ts.
//
// Locked slot names: {dim}, {days}, {composite}, {deltaSign},
// {deltaAbs}, {firstName}. Don't scatter template literals elsewhere.

export const dayComparisonTemplates = {
  firstEver: "First {dim} day. Set the baseline.",
  previousExists:
    "Last {dim} day ({days}d ago): composite {composite}. Beat it.",
  previousStrong:
    "Last {dim} day: composite {composite} — strong. Don't slip.",
  previousWeak:
    "Last {dim} day: composite {composite} — let's climb.",
} as const;

export type DayComparisonTemplateKey = keyof typeof dayComparisonTemplates;
