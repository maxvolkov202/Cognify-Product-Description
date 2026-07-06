/**
 * PRD v3 Phase 5 — Build a Rep pure-logic tests.
 *
 *   • event-type inference from descriptions
 *   • fallback Preparation Plans (PRD §7.7 examples) — shape + mode
 *   • readiness score math (weighted, null-safe)
 *   • deterministic fallback Readiness Review targets the weakest dim
 *   • context parsing: text passthrough, cap, unsupported types
 *
 * Run: npx tsx tests/prep-plan.test.ts
 */

import {
  fallbackPlan,
  inferEventType,
} from "@/lib/ai/prep/plan-generation";
import {
  computeReadinessScore,
  fallbackReview,
} from "@/lib/ai/prep/readiness-review";
import { parseContextFile, PREP_PARSED_TEXT_CAP } from "@/lib/prep/parse";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(cond: unknown, message: string): void {
  if (cond) pass++;
  else {
    fail++;
    failures.push(message);
    console.log(`  ✗ ${message}`);
  }
}
function section(label: string): void {
  console.log(`\n── ${label} ──`);
}

async function main() {
  section("event-type inference");
  {
    assert(inferEventType("SDR interview at Salesforce") === "interview", "interview");
    assert(inferEventType("10 minute investor pitch, seed round") === "pitch", "pitch");
    assert(inferEventType("best man toast for my brother") === "toast", "toast");
    assert(inferEventType("product demo for a POC") === "demo", "demo");
    assert(inferEventType("quarterly business review with my VP") === "meeting", "meeting (QBR)");
    assert(inferEventType("keynote talk at a conference") === "speech", "speech");
    assert(inferEventType("board presentation with slides") === "presentation", "presentation");
    assert(inferEventType("catching up with an old friend") === "other", "other");
  }

  section("fallback plans (PRD §7.7)");
  {
    const interview = fallbackPlan("SDR interview at Salesforce");
    assert(
      interview.moments.length >= 4 && interview.moments.length <= 8,
      "interview plan 4-8 moments",
    );
    assert(
      interview.moments.some((m) => m.title === "Tell Me About Yourself"),
      "interview includes Tell Me About Yourself",
    );
    assert(
      interview.moments.some((m) => m.title === "Questions For The Interviewer"),
      "interview includes Questions For The Interviewer",
    );
    assert(interview.recommendedMode === "guided", "interview → guided");

    const toast = fallbackPlan("wedding toast");
    assert(toast.recommendedMode === "simulation", "toast → simulation");
    assert(
      toast.moments.some((m) => m.title === "Message to the Couple"),
      "toast includes Message to the Couple",
    );
    const totalSec = toast.moments.reduce((s, m) => s + m.recommendedSeconds, 0);
    assert(
      toast.recommendedDurationSec === totalSec,
      "recommended duration = sum of moments",
    );
    for (const m of toast.moments) {
      assert(
        m.recommendedSeconds >= 30 && m.recommendedSeconds <= 600,
        `moment seconds in bounds (${m.title})`,
      );
    }

    const longDesc = fallbackPlan("x".repeat(200));
    assert(longDesc.title.length <= 80, "long description → truncated title");
  }

  section("readiness score");
  {
    assert(computeReadinessScore({}) === null, "no dims → null");
    const uniform = computeReadinessScore({
      clarity: 70,
      structure: 70,
      conciseness: 70,
      thinking_quality: 70,
      delivery: 70,
      tone: 70,
    });
    assert(uniform === 70, `uniform 70 → 70 (got ${uniform})`);
    const partial = computeReadinessScore({ clarity: 80 });
    assert(partial === 80, "single dim → that score");
  }

  section("fallback readiness review");
  {
    const review = fallbackReview(
      {
        event: {
          title: "SDR Interview",
          eventType: "interview",
          description: "SDR interview",
        },
        mode: "guided",
        dimensionAverages: { clarity: 82, structure: 55, tone: 74 },
      },
      70,
    );
    assert(
      review.coachFeedback.includes("Structure"),
      "coach feedback targets the weakest dim",
    );
    assert(review.coreSkills.clarity?.score === 82, "dim entries carry scores");
    assert(
      review.readinessSummary.includes("SDR Interview"),
      "summary names the event",
    );
    assert(review.overallScore === 70, "overall passed through");
  }

  section("context parsing");
  {
    const text = await parseContextFile(
      Buffer.from("My resume\n\n\n\nSales experience  \n"),
      "text/plain",
      "resume.txt",
    );
    assert(text.status === "parsed", "txt parses");
    assert(
      text.status === "parsed" && !text.text.includes("\n\n\n"),
      "blank runs collapsed",
    );

    const huge = await parseContextFile(
      Buffer.from("a".repeat(PREP_PARSED_TEXT_CAP + 5000)),
      "text/plain",
      "big.txt",
    );
    assert(
      huge.status === "parsed" && huge.text.length <= PREP_PARSED_TEXT_CAP,
      "parsed text capped",
    );

    const image = await parseContextFile(
      Buffer.from([0xff, 0xd8, 0xff]),
      "image/jpeg",
      "photo.jpg",
    );
    assert(image.status === "unsupported", "image → unsupported");

    const markdown = await parseContextFile(
      Buffer.from("# Notes\n- point"),
      "",
      "notes.md",
    );
    assert(markdown.status === "parsed", "md by extension parses");

    const emptyDoc = await parseContextFile(
      Buffer.from("   \n \n"),
      "text/plain",
      "empty.txt",
    );
    assert(emptyDoc.status === "failed", "whitespace-only → failed");
  }

  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`  pass: ${pass}   fail: ${fail}`);
  if (fail > 0) {
    console.log(`\nFailures:`);
    for (const f of failures) console.log(`  • ${f}`);
    process.exit(1);
  }
  console.log(`  ✓ all prep-plan tests pass`);
}

void main();
