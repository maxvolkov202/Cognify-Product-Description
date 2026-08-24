import { dashboardMomentumCopy } from "../src/lib/dashboard-momentum-copy";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(
  dashboardMomentumCopy(74, 0) ===
    "Your reps are warm. Today is a good day to start a streak.",
  "recent reps with no active streak should invite the user to start one",
);
assert(
  dashboardMomentumCopy(74, 3) ===
    "Your reps are warm. Keep the streak alive.",
  "an active streak should keep the existing momentum message",
);
assert(
  dashboardMomentumCopy(null, 0) === "Pick up where you left off.",
  "no recent score should keep the neutral fallback",
);

console.log("3 passed, 0 failed");
