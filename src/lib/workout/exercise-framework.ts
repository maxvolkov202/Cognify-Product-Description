// Maps each muscle-group dimension to the canonical rep-type framework
// that best models a structured response for that dimension. Used by
// the daily workout's RepSurface to surface a cheat-sheet ("hold this
// structure while you speak") alongside the prompt — the same affordance
// that existed pre-pivot for the old 9-rep-type system, restored to the
// 54-exercise muscle-group flow.
//
// Mapping rationale (one framework per dimension keeps the affordance
// consistent across exercises; per-exercise frameworks can layer later):
//   clarity          → simplify       (Feynman: Name it / Analogy / Why / Spot the gap)
//   structure        → structure      (Main + 3 + Close)
//   conciseness      → be_concise
//   thinking_quality → think_fast
//   pacing           → deliver
//   tone             → adapt

import { REP_TYPES, type RepTypeFramework } from "@/lib/ai/rep-types";
import type { MuscleGroupId } from "@/types/domain";

const DIMENSION_TO_REP_TYPE: Record<MuscleGroupId, string> = {
  clarity: "simplify",
  structure: "structure",
  conciseness: "be_concise",
  thinking_quality: "think_fast",
  pacing: "deliver",
  tone: "adapt",
};

const FRAMEWORK_BY_REP_TYPE: Record<string, RepTypeFramework> = Object.fromEntries(
  REP_TYPES.map((rt) => [rt.id, rt.framework]),
);

export function getFrameworkForDimension(
  dim: MuscleGroupId | null | undefined,
): RepTypeFramework | undefined {
  if (!dim) return undefined;
  const repTypeId = DIMENSION_TO_REP_TYPE[dim];
  return repTypeId ? FRAMEWORK_BY_REP_TYPE[repTypeId] : undefined;
}
