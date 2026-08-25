import { visibleSkillDelta } from "../src/lib/skill-delta";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Basic movement.
assert(visibleSkillDelta(80, 74) === 6, "improvement shows the rounded delta");
assert(visibleSkillDelta(72, 74) === -2, "small dips (−1..−3) stay visible");
assert(visibleSkillDelta(71, 74) === -3, "−3 is the last visible dip");

// C10 softening.
assert(visibleSkillDelta(70, 74) === null, "drops beyond −3 are suppressed");
assert(visibleSkillDelta(74, 74) === null, "zero movement is suppressed");

// Rounding matches the Improvement Review's historical rule:
// round(current − previous), not round(current) − round(previous).
assert(visibleSkillDelta(74.4, 74.0) === null, "sub-half movement rounds to zero");
assert(visibleSkillDelta(75.6, 74.9) === 1, "0.7 movement rounds to +1");

// Missing baseline.
assert(visibleSkillDelta(74, null) === null, "null previous → no chip");
assert(visibleSkillDelta(74, undefined) === null, "undefined previous → no chip");

console.log("9 passed, 0 failed");
