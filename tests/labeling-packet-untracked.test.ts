/**
 * Leak guard: the human-labeling packet data files (real user transcripts, hidden model
 * scores, signed audio URLs) must never be tracked in this public repo — PR #78 force-added
 * them past .gitignore once already. Only README.md may be tracked in the packet dir.
 * The same assertion exists as .github/workflows/leak-guard.yml (needs a workflow-scoped
 * token to push); this test is the always-runs local guard.
 */
import { execSync } from "node:child_process";
import assert from "node:assert/strict";

const tracked = execSync("git ls-files plans/calibration/human-labeling-2026-09", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);
const extras = tracked.filter((f) => f !== "plans/calibration/human-labeling-2026-09/README.md");
assert.deepEqual(extras, [], `packet data files are tracked (must stay untracked, see the packet README): ${extras.join(", ")}`);

console.log("labeling-packet-untracked: ok");
