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
 *   - You're verifying the grading-v3 (v4) contract: coachFocus
 *     (behavior/why/action), strongerVersion grounding, per-skill
 *     feedback, headlineTone / nextRepHint.
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
      headers: {
        "Content-Type": "application/json",
        // /api/score requires an identity — same convention as the
        // calibrate-* harnesses.
        ...(process.env.CALIBRATION_GUEST_ID
          ? { cookie: `cognify_guest_id=${process.env.CALIBRATION_GUEST_ID}` }
          : {}),
      },
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
    "callouts array is present (empty on v4 reps)",
    Array.isArray(score.callouts),
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

  console.log("\n=== Grading v3: coachFocus / strongerVersion / per-skill feedback ===");
  assert(
    "coachFocus present with behavior/why/action",
    score.coachFocus &&
      typeof score.coachFocus.behavior === "string" &&
      typeof score.coachFocus.why === "string" &&
      typeof score.coachFocus.action === "string",
    score.coachFocus ? score.coachFocus.dimension : "missing",
  );
  assert(
    "coachFocus.text composed for legacy consumers",
    typeof score.coachFocus?.text === "string" &&
      score.coachFocus.text.length > 0,
    score.coachFocus?.text?.slice(0, 60),
  );
  assert(
    "primaryFocusDimension mirrors coachFocus.dimension",
    score.primaryFocusDimension === score.coachFocus?.dimension,
    `${score.primaryFocusDimension} vs ${score.coachFocus?.dimension}`,
  );
  const dimsWithFeedback = (score.dimensions ?? []).filter(
    (d) => typeof d.feedback === "string" && d.feedback.length > 0,
  );
  assert(
    "per-skill feedback on ≥5 of 6 dimensions",
    dimsWithFeedback.length >= 5,
    `${dimsWithFeedback.length}/6`,
  );
  assert(
    "callouts empty on v4 reps",
    Array.isArray(score.callouts) && score.callouts.length === 0,
    `length ${score.callouts?.length}`,
  );

  // Anti-hallucination: the strongerVersion quote must be a verbatim
  // transcript substring (this transcript is real content, so a null
  // strongerVersion is a failure — null is only allowed for junk reps).
  const tLower = FAKE_TRANSCRIPT.toLowerCase().replace(/\s+/g, " ");
  assert(
    "strongerVersion present (non-junk rep)",
    score.strongerVersion != null,
    score.strongerVersion ? "present" : "null",
  );
  if (score.strongerVersion?.quote) {
    const q = String(score.strongerVersion.quote)
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    assert(
      "strongerVersion.quote substring present in transcript",
      q.length > 0 && tLower.includes(q),
      `"${score.strongerVersion.quote.slice(0, 50)}…"`,
    );
  }

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
  // tone-band rules. Adjacent band allowed — the prompt's scaffold rule
  // tells the model to report the tone it actually wrote, which can
  // legitimately sit one band off near a boundary (e.g. composite 77
  // with directive copy).
  const TONE_ORDER = ["blunt", "directive", "praise", "celebratory"];
  const expectedTone =
    score.composite < 50
      ? "blunt"
      : score.composite < 75
        ? "directive"
        : score.composite < 90
          ? "praise"
          : "celebratory";
  const toneDistance = Math.abs(
    TONE_ORDER.indexOf(score.headlineTone) - TONE_ORDER.indexOf(expectedTone),
  );
  assert(
    `headlineTone within one band for composite ${score.composite}`,
    toneDistance <= 1,
    `got ${score.headlineTone}, band-expected ${expectedTone}`,
  );

  // ——— Print headline + bullets so the user can voice-audit ————

  console.log("\n=== Voice spot-check ===");
  console.log(`headline: "${score.headline}"`);
  console.log(`tone:     ${score.headlineTone}`);
  if (score.nextRepHint) console.log(`hint:     "${score.nextRepHint}"`);
  if (score.coachFocus) {
    console.log("\ncoachFocus:");
    console.log(`  behavior: ${score.coachFocus.behavior}`);
    console.log(`  why:      ${score.coachFocus.why}`);
    console.log(`  action:   ${score.coachFocus.action}`);
    console.log(
      `  dim:      ${score.coachFocus.dimension}${score.coachFocus.subSkill ? ` · ${score.coachFocus.subSkill}` : ""}`,
    );
  }
  if (score.strongerVersion) {
    console.log("\nstrongerVersion:");
    console.log(`  quote:   "${score.strongerVersion.quote?.slice(0, 80)}"`);
    console.log(`  rewrite: "${score.strongerVersion.rewrite.slice(0, 100)}"`);
  }
  for (const d of score.dimensions ?? []) {
    if (d.feedback) console.log(`  [${d.dimension} ${d.score}] ${d.feedback.slice(0, 90)}`);
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
