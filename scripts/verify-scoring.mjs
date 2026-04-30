#!/usr/bin/env node
/**
 * End-to-end scoring smoke test. Sends a representative payload to
 * /api/score and reports whether every field the new feedback path
 * expects came back correctly populated.
 *
 * Use this when:
 *   - You just allocated credits to a workspace and want to verify the
 *     full scoring pipeline works (not just /api/score/health).
 *   - You changed prompt rules in src/lib/ai/score.ts and want to spot
 *     voice drift.
 *   - You're verifying Phase 2 (modeContext / didWell / didntLand /
 *     nextRepFocus / primaryFocusDimension) and Phase 3 (headlineTone
 *     / nextRepHint) come back as expected.
 *
 * Usage:
 *   # against your local dev server:
 *   node scripts/verify-scoring.mjs
 *
 *   # against a custom URL:
 *   BASE_URL=https://cognify-staging.vercel.app node scripts/verify-scoring.mjs
 *
 * Exits non-zero if any assertion fails so this can be wired into CI.
 */

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3333";

// A representative transcript with intentional structure so the model
// has real material to ground its bullets in. ~30 seconds at typical
// speaking rate. Includes a clear hook, three points, a close — so
// structure should score reasonably; pacing should look ok; but the
// claims are loose enough that conciseness might not be perfect.
const FAKE_TRANSCRIPT =
  "Trust is the foundation of every relationship, and three specific behaviors build it. " +
  "First, consistency — showing up the same way whether it's easy or hard. " +
  "Second, honesty about what you don't know, not just what you do. " +
  "Third, following through — every kept commitment is a deposit, every broken one a withdrawal. " +
  "Consistency, honesty, follow-through. That's how trust gets built.";

const FAKE_DURATION_MS = 28_000;

// Word-level timings. Distributed roughly evenly across the 28 seconds
// so the deterministic delivery + pacing scorers have something to chew
// on. The actual values don't need to be precise — just monotonically
// increasing and ending at durationMs.
function buildWords(transcript, durationMs) {
  const tokens = transcript.split(/\s+/).filter(Boolean);
  const stride = Math.floor(durationMs / tokens.length);
  return tokens.map((word, i) => ({
    word: word.replace(/[.,]/g, ""),
    startMs: i * stride,
    endMs: i * stride + Math.max(150, stride - 30),
  }));
}

const PAYLOAD = {
  transcript: FAKE_TRANSCRIPT,
  promptText: "Why is trust the foundation of every relationship?",
  durationMs: FAKE_DURATION_MS,
  timeBudgetMs: 45_000,
  words: buildWords(FAKE_TRANSCRIPT, FAKE_DURATION_MS),
  modeContext: {
    sessionType: "combined",
    repIndex: 1,
    totalReps: 4,
    previousRepFocus: {
      dimension: "structure",
      headline: "Solid bones. Sharpen the hook and this is a 90.",
      score: 78,
    },
  },
};

// ——— Assertion helpers ——————————————————————————————————————

let failures = 0;
function assert(label, cond, detail) {
  const tag = cond ? "✓" : "✗";
  console.log(`  ${tag} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

// ——— Run ————————————————————————————————————————————————————

async function main() {
  console.log(`[verify-scoring] POST ${BASE_URL}/api/score`);
  const start = Date.now();
  let res;
  try {
    res = await fetch(`${BASE_URL}/api/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(PAYLOAD),
    });
  } catch (err) {
    console.error(`[verify-scoring] fetch failed: ${err.message ?? err}`);
    console.error(
      `Is the dev server running on ${BASE_URL}? Try \`npm run dev\` first.`,
    );
    process.exit(1);
  }
  const latencyMs = Date.now() - start;

  if (!res.ok) {
    const body = await res.text();
    console.error(
      `[verify-scoring] HTTP ${res.status} — ${body.slice(0, 500)}`,
    );
    process.exit(1);
  }

  const score = await res.json();
  console.log(`[verify-scoring] response in ${latencyMs}ms\n`);

  // Detect mock fallback. If the scoring service couldn't reach Claude
  // it still returns a valid RepScore with modelVersion: "mock-fallback-v1"
  // so the client UI doesn't break — but that's not a real Claude run
  // and we should not assert against it.
  if (score.modelVersion === "mock-fallback-v1") {
    console.error(
      "[verify-scoring] Got mock fallback response. Claude scoring failed —",
    );
    console.error(
      "  most likely cause: workspace credits not allocated. Check",
    );
    console.error(
      `  GET ${BASE_URL}/api/score/health for the underlying error.`,
    );
    process.exit(1);
  }

  console.log("=== Phase 1 fields ===");
  assert(
    "composite is a 0–100 number",
    typeof score.composite === "number" &&
      score.composite >= 0 &&
      score.composite <= 100,
    `${score.composite}`,
  );
  assert(
    "dimensions array has 6 entries",
    Array.isArray(score.dimensions) && score.dimensions.length === 6,
    `${score.dimensions?.length}`,
  );
  assert(
    "callouts array is present",
    Array.isArray(score.callouts) && score.callouts.length > 0,
    `${score.callouts?.length}`,
  );
  assert(
    "rubricVersion present",
    typeof score.rubricVersion === "string" && score.rubricVersion.length > 0,
    score.rubricVersion,
  );
  assert(
    "modelVersion non-mock",
    typeof score.modelVersion === "string" &&
      !score.modelVersion.includes("mock"),
    score.modelVersion,
  );

  console.log("\n=== Phase 1: headline ===");
  assert(
    "headline is a non-empty string",
    typeof score.headline === "string" && score.headline.trim().length > 0,
    score.headline ? `"${score.headline}"` : "missing",
  );
  if (score.headline) {
    assert(
      "headline ≤ 90 chars (rule)",
      score.headline.length <= 90,
      `${score.headline.length} chars`,
    );
  }

  console.log("\n=== Phase 2: didWell / didntLand / nextRepFocus ===");
  assert(
    "didWell is an array",
    Array.isArray(score.didWell),
    `length ${score.didWell?.length ?? "missing"}`,
  );
  assert(
    "didntLand is an array",
    Array.isArray(score.didntLand),
    `length ${score.didntLand?.length ?? "missing"}`,
  );
  assert(
    "nextRepFocus is an array",
    Array.isArray(score.nextRepFocus),
    `length ${score.nextRepFocus?.length ?? "missing"}`,
  );
  assert(
    "primaryFocusDimension is a SkillDimension",
    typeof score.primaryFocusDimension === "string",
    score.primaryFocusDimension,
  );

  // Anti-hallucination: every grounded bullet (quote !== null) must
  // have its quote substring present in the transcript (case-insensitive).
  const tLower = FAKE_TRANSCRIPT.toLowerCase().replace(/\s+/g, " ");
  function checkGrounding(bullets, label) {
    if (!Array.isArray(bullets)) return;
    bullets.forEach((b, i) => {
      if (b.quote == null) return;
      const q = String(b.quote).toLowerCase().replace(/\s+/g, " ").trim();
      const matches = q.length > 0 && tLower.includes(q);
      assert(
        `${label}[${i}].quote substring present in transcript`,
        matches,
        matches ? `"${b.quote.slice(0, 40)}…"` : `MISSING: "${b.quote}"`,
      );
    });
  }
  checkGrounding(score.didWell, "didWell");
  checkGrounding(score.didntLand, "didntLand");

  console.log("\n=== Phase 3: headlineTone + nextRepHint ===");
  assert(
    "headlineTone is one of the four tones",
    ["blunt", "directive", "praise", "celebratory"].includes(
      score.headlineTone,
    ),
    score.headlineTone,
  );
  // Schema requires nextRepHint (z.string().min(2).max(60)). Absent
  // means schema validation should have failed upstream — surface it.
  assert(
    "nextRepHint present (required by schema)",
    typeof score.nextRepHint === "string" &&
      score.nextRepHint.trim().length >= 2,
    score.nextRepHint ? `"${score.nextRepHint}"` : "MISSING",
  );
  if (typeof score.nextRepHint === "string") {
    assert(
      "nextRepHint ≤ 60 chars (rule)",
      score.nextRepHint.length <= 60,
      `${score.nextRepHint.length} chars`,
    );
  }

  // Tone-band sanity: if composite < 50, expect blunt; ≥75, expect
  // praise / celebratory; etc. This catches drift in the score.ts
  // tone-band rules.
  const expectedTone =
    score.composite < 50
      ? "blunt"
      : score.composite < 75
        ? "directive"
        : score.composite < 90
          ? "praise"
          : "celebratory";
  assert(
    `headlineTone matches band for composite ${score.composite}`,
    score.headlineTone === expectedTone,
    `got ${score.headlineTone}, expected ${expectedTone}`,
  );

  // ——— Print headline + bullets so the user can voice-audit ————

  console.log("\n=== Voice spot-check ===");
  console.log(`headline: "${score.headline}"`);
  console.log(`tone:     ${score.headlineTone}`);
  if (score.nextRepHint) console.log(`hint:     "${score.nextRepHint}"`);
  if (Array.isArray(score.didWell) && score.didWell.length > 0) {
    console.log("\ndidWell:");
    score.didWell.forEach((b, i) =>
      console.log(`  ${i + 1}. ${b.text}${b.quote ? ` (quote: "${b.quote.slice(0, 60)}…")` : ""}`),
    );
  }
  if (Array.isArray(score.didntLand) && score.didntLand.length > 0) {
    console.log("\ndidntLand:");
    score.didntLand.forEach((b, i) =>
      console.log(`  ${i + 1}. ${b.text}${b.quote ? ` (quote: "${b.quote.slice(0, 60)}…")` : ""}`),
    );
  }
  if (Array.isArray(score.nextRepFocus) && score.nextRepFocus.length > 0) {
    console.log("\nnextRepFocus:");
    score.nextRepFocus.forEach((b, i) =>
      console.log(`  ${i + 1}. ${b.text}${b.exampleLine ? ` → "${b.exampleLine}"` : ""}`),
    );
  }

  console.log(
    `\n[verify-scoring] ${failures === 0 ? "all assertions passed ✓" : `${failures} assertion(s) failed ✗`}`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("[verify-scoring] unexpected error:", err);
  process.exit(1);
});
