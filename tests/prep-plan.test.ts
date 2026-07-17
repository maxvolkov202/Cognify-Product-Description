/**
 * PRD v3 Phase 5 — Build a Rep pure-logic tests.
 *
 *   • event-type inference from descriptions
 *   • fallback Preparation Plans (PRD §7.7 examples) — shape + mode
 *   • readiness score math (weighted, null-safe)
 *   • deterministic fallback Readiness Review targets the weakest dim
 *   • context parsing: text passthrough, cap, unsupported types
 *   • L2 event-context scoring block: rendered ONLY for prep reps
 *     (calibration guardrail — non-prep prompts stay byte-identical)
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
import { renderEventContextBlock } from "@/lib/ai/score";
import {
  sanitizeMomentNotes,
  fallbackMomentStructure,
  MOMENT_NOTES_LIMITS,
} from "@/lib/prep/moment-notes";

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

  section("L4 — fallback moments carry coachCue + scoringHint");
  {
    const descriptions = [
      "SDR interview at Salesforce",
      "board presentation with slides",
      "10 minute investor pitch, seed round",
      "wedding toast",
      "product demo for a POC",
      "quarterly business review meeting",
      "keynote speech",
      "catching up with an old friend", // → other
    ];
    for (const d of descriptions) {
      const plan = fallbackPlan(d);
      for (const m of plan.moments) {
        assert(
          typeof m.coachCue === "string" &&
            m.coachCue.length > 0 &&
            m.coachCue.length <= 320,
          `${plan.eventType}/"${m.title}" has a coachCue within bounds`,
        );
        assert(
          typeof m.scoringHint === "string" &&
            m.scoringHint.length > 0 &&
            m.scoringHint.length <= 300,
          `${plan.eventType}/"${m.title}" has a scoringHint within bounds`,
        );
      }
    }
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

    // Edit #1 — images are a supported kind now (vision-parsed). Force
    // the no-key path so the test is deterministic and never fires a
    // live network call: extraction returns null → "failed" (never
    // "unsupported", never a throw).
    const savedKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const image = await parseContextFile(
      Buffer.from([0xff, 0xd8, 0xff]),
      "image/jpeg",
      "photo.jpg",
    );
    if (savedKey != null) process.env.OPENAI_API_KEY = savedKey;
    assert(
      image.status === "failed",
      "image kind without a vision key → failed, not unsupported",
    );
    const bmp = await parseContextFile(
      Buffer.from([0x42, 0x4d]),
      "image/bmp",
      "photo.bmp",
    );
    assert(
      bmp.status === "unsupported",
      "image mime outside the vision set → unsupported",
    );

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

  section("event-context scoring block (L2 calibration guardrail)");
  {
    assert(
      renderEventContextBlock(undefined) === null,
      "absent eventContext → null (non-prep prompts stay byte-identical)",
    );
    const block = renderEventContextBlock({
      title: "SDR Interview",
      eventType: "interview",
      description: "Final-round SDR interview at Salesforce",
      contextSummary: "=== resume.pdf ===\n5 years of outbound sales",
    });
    assert(
      block != null && block.startsWith("EVENT CONTEXT ("),
      "block opens with the operator-facing EVENT CONTEXT framing",
    );
    assert(
      block != null &&
        block.includes("SDR Interview") &&
        block.includes("interview") &&
        block.includes("Final-round SDR interview at Salesforce") &&
        block.includes("5 years of outbound sales"),
      "block carries title, type, description, uploaded context",
    );
    const noSummary = renderEventContextBlock({
      title: "Best Man Toast",
      eventType: "toast",
      description: "toast for my brother",
      contextSummary: null,
    });
    assert(
      noSummary != null && !noSummary.includes("uploaded materials"),
      "null contextSummary omits the materials line",
    );
    const long = renderEventContextBlock({
      title: "T",
      eventType: "other",
      description: "d".repeat(5000),
      contextSummary: "c".repeat(5000),
    });
    assert(
      long != null &&
        !long.includes("d".repeat(2001)) &&
        !long.includes("c".repeat(1501)),
      "description capped at 2000, contextSummary at 1500",
    );
  }

  section("L4 — momentHint scoring lens (same block, only-when-present)");
  {
    const base = {
      title: "SDR Interview",
      eventType: "interview",
      description: "Final-round SDR interview at Salesforce",
      contextSummary: null,
    };
    const withoutHint = renderEventContextBlock(base);
    const withHint = renderEventContextBlock({
      ...base,
      momentHint:
        "Weigh whether the answer ends on a concrete, quantified result.",
    });
    assert(
      withoutHint != null && !withoutHint.includes("Scoring lens"),
      "hint-less prep block carries NO scoring-lens line (byte-identical to pre-L4)",
    );
    assert(
      withHint != null &&
        withHint.includes(
          "Scoring lens for this moment (operator note): Weigh whether the answer ends on a concrete, quantified result.",
        ),
      "momentHint renders as one operator-facing line inside the block",
    );
    assert(
      withHint != null &&
        withoutHint != null &&
        withHint.replace(/^Scoring lens for this moment.*\n/m, "") ===
          withoutHint,
      "the hint is strictly additive — the rest of the block is unchanged",
    );
    const longHint = renderEventContextBlock({
      ...base,
      momentHint: "h".repeat(1000),
    });
    assert(
      longHint != null && !longHint.includes("h".repeat(301)),
      "momentHint capped at 300 chars",
    );
    // Calibration guardrail unchanged: no eventContext → no block at all.
    assert(
      renderEventContextBlock(undefined) === null,
      "non-prep prompts still render no event block",
    );
  }

  section("Edit #3 — moment notes sanitize + fallback");
  {
    assert(sanitizeMomentNotes(null) === null, "null input → null");
    assert(sanitizeMomentNotes("nope") === null, "non-object → null");
    assert(
      sanitizeMomentNotes({ sections: [] }) === null,
      "empty sections → null (clears notes)",
    );
    assert(
      sanitizeMomentNotes({
        sections: [{ header: "  ", bullets: ["   "] }],
      }) === null,
      "whitespace-only content prunes to null",
    );
    const clamped = sanitizeMomentNotes({
      sections: [
        {
          header: "H".repeat(200),
          bullets: [
            ...Array.from({ length: 20 }, (_, i) => `bullet ${i}`),
            42,
            "",
          ],
        },
        ...Array.from({ length: 20 }, () => ({
          header: "extra",
          bullets: ["x"],
        })),
      ],
    });
    assert(
      clamped != null && clamped.sections.length === MOMENT_NOTES_LIMITS.sections,
      "sections clamped to the limit",
    );
    assert(
      clamped != null &&
        clamped.sections[0]!.header.length === MOMENT_NOTES_LIMITS.headerChars,
      "header clamped to the char limit",
    );
    assert(
      clamped != null &&
        clamped.sections[0]!.bullets.length === MOMENT_NOTES_LIMITS.bullets &&
        clamped.sections[0]!.bullets.every((b) => typeof b === "string" && b.length > 0),
      "bullets clamped, non-strings and empties dropped",
    );

    const fb = fallbackMomentStructure({
      title: "Why this role?",
      objective: "Connect your energy to the role's needs.",
      coachCue: "Name one concrete match.",
    });
    assert(
      fb.sections.length === 3 &&
        fb.sections.some((s) =>
          s.bullets.includes("Connect your energy to the role's needs."),
        ) &&
        fb.sections.some((s) => s.bullets.includes("Name one concrete match.")),
      "fallback structure is built from the moment's own objective + cue",
    );
    assert(
      sanitizeMomentNotes(fb) != null,
      "fallback structure round-trips through the sanitizer",
    );
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
