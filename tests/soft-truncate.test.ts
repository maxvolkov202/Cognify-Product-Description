/**
 * Grading audit WS1 — soft truncation of over-cap prose fields.
 * Run: npx tsx tests/soft-truncate.test.ts
 */
import {
  softTruncate,
  softTruncateScoringResponse,
  PROSE_CAPS,
} from "@/lib/scoring/soft-truncate";
import { scoringResponseSchema } from "@/lib/ai/score-shared";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) pass++;
  else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── softTruncate ──
{
  check("under cap untouched", softTruncate("short", 10) === "short");
  check("exact cap untouched", softTruncate("abcde", 5) === "abcde");
  const r = softTruncate("the quick brown fox jumps", 15);
  check("cuts on word boundary", r === "the quick brown", r);
  check("never longer than cap", softTruncate("a ".repeat(200), 50).length <= 50);
  check(
    "trailing punctuation stripped",
    softTruncate("one two, three four", 9) === "one two",
    softTruncate("one two, three four", 9),
  );
  check("no boundary → hard cut", softTruncate("abcdefghijklmnop", 5) === "abcde");
  check("non-empty in → non-empty out", softTruncate("x".repeat(30), 3).length > 0);
  check("zero cap → empty", softTruncate("abc", 0) === "");
  // Idempotent
  const once = softTruncate("lorem ipsum dolor sit amet consectetur", 20);
  check("idempotent", softTruncate(once, 20) === once);
}

// ── softTruncateScoringResponse ──
{
  const long = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
  const raw = {
    headline: long(80),
    nextRepHint: long(30),
    coachFocus: {
      dimension: "clarity",
      subSkill: null,
      behavior: long(80),
      why: long(120),
      action: long(90),
    },
    implementationReview: { verdict: "partial", note: long(120) },
    dimensions: [
      { dimension: "clarity", score: 60, signals: [], feedback: long(200) },
      { dimension: "structure", score: 50, signals: [] },
    ],
    strongerVersion: { quote: long(400), rewrite: "fine" },
  };
  const { value, truncated } = softTruncateScoringResponse(raw);
  const v = value as typeof raw;
  check("headline capped", v.headline.length <= PROSE_CAPS.headline);
  check("hint capped", v.nextRepHint.length <= PROSE_CAPS.nextRepHint);
  check("behavior capped", v.coachFocus.behavior.length <= PROSE_CAPS.coachBehavior);
  check("why capped", v.coachFocus.why.length <= PROSE_CAPS.coachWhy);
  check("action capped", v.coachFocus.action.length <= PROSE_CAPS.coachAction);
  check("note capped", v.implementationReview.note.length <= PROSE_CAPS.implementationNote);
  check(
    "dim feedback capped",
    (v.dimensions[0]?.feedback as string).length <= PROSE_CAPS.dimensionFeedback,
  );
  check("missing feedback left absent", v.dimensions[1]?.feedback === undefined);
  check(
    "quote NOT truncated (verbatim field)",
    v.strongerVersion.quote === raw.strongerVersion.quote,
  );
  check(
    "reports every cut field",
    truncated.length === 7 && truncated.includes("coachFocus.why"),
    truncated.join(","),
  );
  check("non-object passthrough", softTruncateScoringResponse(null).value === null);
  check("non-string field untouched", (() => {
    const r = softTruncateScoringResponse({ headline: 42 }).value as { headline: unknown };
    return r.headline === 42;
  })());
}

// ── End-to-end: a 300-char coachFocus.why now passes the schema ──
{
  const why300 = ("keep it grounded " as string).repeat(20).trim(); // ~339 chars
  check("fixture is over cap", why300.length > 280);
  const full = {
    headline: "You buried the point under setup.",
    headlineTone: "directive",
    nextRepHint: "lead with the answer",
    dimensions: [
      "clarity",
      "structure",
      "conciseness",
      "thinking_quality",
      "delivery",
      "tone",
    ].map((dimension) => ({
      dimension,
      score: 60,
      signals: ["s"],
      subSkill: null,
      feedback: "One concrete note.",
    })),
    coachFocus: {
      dimension: "clarity",
      subSkill: null,
      behavior: "You opened with three caveats.",
      why: why300,
      action: "Say the answer first.",
    },
    strongerVersion: null,
  };
  const before = scoringResponseSchema.safeParse(structuredClone(full));
  check("schema rejects the raw 300-char why", !before.success);
  const after = scoringResponseSchema.safeParse(
    softTruncateScoringResponse(structuredClone(full)).value,
  );
  check("schema accepts after soft truncation", after.success, JSON.stringify(after.success ? "" : after.error.issues[0]));
}

console.log("────────────────────────────");
console.log(`pass: ${pass} fail: ${fail}`);
if (fail === 0) console.log("✓ all soft-truncate tests pass");
else process.exitCode = 1;
