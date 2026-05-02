import type { SkillDimension } from "@/types/domain";

/** Phase 1: static last-rep-focus continuation copy. Phase 3 replaces this
 *  with AI-generated continuation tied to the actual previous-rep
 *  performance. Voice: declarative, second-person, no praise filler. */
export const LAST_REP_FOCUS_COPY: Record<SkillDimension, string> = {
  clarity: "tighten the throughline",
  structure: "keep building on it",
  conciseness: "trim the runway",
  thinking_quality: "stay sharp under questions",
  delivery: "hold the pacing",
  tone: "land statements with conviction",
};
