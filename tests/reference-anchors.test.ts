/**
 * Grading Engine V2 — Arm A (reference-anchored) unit tests + the
 * system-block cache-prefix guard.
 *
 * Pure: no LLM, no DB. Covers anchor selection (leave-one-out), block
 * rendering, and the invariant that adding the REFERENCE ANCHORS block
 * leaves the four static cached blocks byte-identical (so prompt-prefix
 * caching still hits and control stays unaffected).
 *
 * Run: npx tsx tests/reference-anchors.test.ts
 */

import {
  selectAnchors,
  renderReferenceAnchorsBlock,
  ALL_ANCHOR_IDS,
} from "@/lib/ai/reference-anchors";
import { buildSystemBlocks } from "@/lib/ai/score-shared";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) pass++;
  else {
    fail++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const POOR_MIC =
  "Uh, hello, hello? Is this thing on. Um yeah so basically the product is, like, you know, it's a thing that does, um, automation, sort of? Uh, that's, that's it I guess.";
const RAMBLING =
  "So like our product, um, it's basically a SaaS platform that we've been working on, you know, for a while, and the idea is to help companies with their, um, automation needs. We have a lot of features and we think it's pretty good. Uh, the price is competitive and we have customers. So yeah you should consider it.";

const RUBRIC = "RUBRIC_STUB";
const textOf = (b: unknown) => (b as { text: string }).text;
const isCached = (b: unknown) =>
  !!(b as { cache_control?: unknown }).cache_control;

// ── selectAnchors: default = three primaries spanning the range ──
{
  const anchors = selectAnchors();
  check("selects 3 anchors", anchors.length === 3, `got ${anchors.length}`);
  check(
    "tiers are low/mid/high in order",
    anchors.map((a) => a.tier).join(",") === "low,mid,high",
    anchors.map((a) => a.tier).join(","),
  );
  check(
    "ascending composites",
    anchors[0]!.composite < anchors[1]!.composite &&
      anchors[1]!.composite < anchors[2]!.composite,
    anchors.map((a) => a.composite).join(","),
  );
  check(
    "default low anchor is the mic-test primary",
    anchors[0]!.id === "band-poor-mic-test",
    anchors[0]!.id,
  );
}

// ── leave-one-out: scoring an anchor swaps in its tier substitute ──
{
  const anchors = selectAnchors(POOR_MIC);
  check(
    "primary low anchor is NOT scored against itself",
    anchors[0]!.id !== "band-poor-mic-test",
    anchors[0]!.id,
  );
  check(
    "low tier swaps to the substitute",
    anchors[0]!.id === "band-below-rambling-pitch",
    anchors[0]!.id,
  );
  check(
    "mid + high anchors are unchanged",
    anchors[1]!.id === "scenario-competent-board-bad-quarter" &&
      anchors[2]!.id === "objection-strong-security-concern",
    `${anchors[1]!.id},${anchors[2]!.id}`,
  );
  check(
    "no selected anchor equals the rep under test",
    anchors.every((a) => a.transcript !== POOR_MIC),
  );
}

// ── leave-one-out is symmetric: substitute under test → use the primary ──
{
  const anchors = selectAnchors(RAMBLING);
  check(
    "substitute under test swaps back to the primary",
    anchors[0]!.id === "band-poor-mic-test",
    anchors[0]!.id,
  );
}

// ── whitespace/case-insensitive matching still triggers leave-one-out ──
{
  const messy = `   ${POOR_MIC.toUpperCase()}   `.replace(/ /g, "  ");
  const anchors = selectAnchors(messy);
  check(
    "normalized match still swaps",
    anchors[0]!.id === "band-below-rambling-pitch",
    anchors[0]!.id,
  );
}

// ── ALL_ANCHOR_IDS covers primaries + substitutes ──
{
  check("6 anchor ids total", ALL_ANCHOR_IDS.length === 6, `${ALL_ANCHOR_IDS.length}`);
  check(
    "includes both mic-test and rambling",
    ALL_ANCHOR_IDS.includes("band-poor-mic-test") &&
      ALL_ANCHOR_IDS.includes("band-below-rambling-pitch"),
  );
}

// ── renderReferenceAnchorsBlock: framing + all three anchors present ──
{
  const block = renderReferenceAnchorsBlock(selectAnchors());
  check("header present", block.includes("REFERENCE ANCHORS"));
  check("framed as references not exemplars", block.includes("NOT exemplars to imitate"));
  check("shows a human composite", block.includes("human composite 23"));
  check("shows per-dimension scores", block.includes("clarity 23"));
  check(
    "renders all three anchor blocks",
    (block.match(/ANCHOR \d+ — human composite/g) ?? []).length === 3,
  );
}

// ── cache-prefix guard: no anchors → four static cached blocks only ──
{
  const blocks = buildSystemBlocks({ rubricBlock: RUBRIC });
  const cached = blocks.filter(isCached);
  check("4 cached blocks on the plain path", cached.length === 4, `${cached.length}`);
  check("no uncached blocks without calibration/memory", blocks.length === 4, `${blocks.length}`);
  check("first cached block is the system prompt", textOf(blocks[0]).startsWith("You are the scoring model"));
}

// ── adding the anchors block keeps the 4 static blocks byte-identical ──
{
  const control = buildSystemBlocks({ rubricBlock: RUBRIC });
  const anchorsBlock = renderReferenceAnchorsBlock(selectAnchors());
  const armed = buildSystemBlocks({ rubricBlock: RUBRIC, anchorsBlock });

  check("armed adds exactly one block", armed.length === control.length + 1, `${armed.length} vs ${control.length}`);
  check(
    "first 4 blocks are byte-identical to control",
    control.every((b, i) => textOf(armed[i]) === textOf(b)),
  );
  check("all armed blocks are cached (prefix stays cacheable)", armed.every(isCached));
  check(
    "the anchors block is the appended 5th block",
    textOf(armed[4]) === anchorsBlock,
  );
}

// ── anchors block sits BEFORE user-specific (uncached) blocks ──
{
  const anchorsBlock = renderReferenceAnchorsBlock(selectAnchors());
  const blocks = buildSystemBlocks({
    rubricBlock: RUBRIC,
    userCalibration: "USER CALIBRATION BLOCK",
    coachingMemory: "COACHING MEMORY BLOCK",
    anchorsBlock,
  });
  const anchorIdx = blocks.findIndex((b) => textOf(b) === anchorsBlock);
  const calibIdx = blocks.findIndex((b) => textOf(b) === "USER CALIBRATION BLOCK");
  check("anchors block precedes the uncached calibration block", anchorIdx < calibIdx && anchorIdx !== -1);
  check("anchors block is cached", isCached(blocks[anchorIdx]));
  check("calibration block stays uncached", !isCached(blocks[calibIdx]));
}

console.log("\n════════════════════════════════════════════════════════════");
console.log(`  pass: ${pass}   fail: ${fail}`);
if (fail === 0) console.log("  ✓ all reference-anchors tests pass");
else process.exitCode = 1;
