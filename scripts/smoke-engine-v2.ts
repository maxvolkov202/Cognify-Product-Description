/**
 * PRD v3 — live smoke harness for the v2 engine's scoring additions.
 *
 * Exercises the REAL model pipeline (no mocks) for the pieces Phases 1-3
 * added, and asserts the contracts hold:
 *   1. First-rep scoring (two-stage, the production dev path):
 *      no implementationReview, coach focus derivable.
 *   2. Retry scoring with retryContext: implementationReview present with
 *      a valid verdict; feedback framed as implementation review.
 *   3. Coaching memory + snapshot build against the dev DB (no-crash +
 *      shape checks; content depends on ledger state).
 *   4. Reference sanity: a known-strong and known-weak fixture keep a
 *      sane composite ordering (full drift replay stays with the
 *      nightly calibration cron).
 *
 * Run: npx tsx scripts/smoke-engine-v2.ts
 * Cost: ~6 Haiku calls. Exit 1 on any contract failure.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

// NOTE: all src imports are DYNAMIC (inside main) — static imports hoist
// above the dotenv config() call, and src/lib/ai/claude.ts snapshots
// provider keys at module-init time. Static imports here would silently
// disable the OpenAI fallback.

let pass = 0;
let fail = 0;
function check(cond: unknown, label: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`);
  }
}

const PROMPT = "Explain what a firewall is to a coworker with no technical background, in under 90 seconds.";

const FIRST_TRANSCRIPT =
  "So a firewall is like, um, it's basically a security thing for your computer network. " +
  "It like checks the stuff coming in and going out, and um, if something looks bad it blocks it. " +
  "There's different kinds, like hardware ones and software ones, and they use rules, " +
  "and also there's stateful inspection which tracks connection state across packets, " +
  "and honestly it's kind of complicated but yeah, it keeps the bad stuff out basically.";

const RETRY_TRANSCRIPT =
  "A firewall is a bouncer for your computer network. Every piece of data that wants in has to " +
  "get past it first. The bouncer has a guest list — rules about what's allowed — and anything " +
  "suspicious gets turned away at the door before it can cause trouble inside. That's the whole " +
  "job: check everything at the entrance, let the good traffic through, keep the bad traffic out.";

function mkWords(transcript: string): { word: string; startMs: number; endMs: number }[] {
  // Synthetic even-cadence word timings (~150 WPM) so deterministic
  // signals have data to chew on.
  const words = transcript.split(/\s+/);
  const perWord = 60_000 / 150;
  return words.map((w, i) => ({
    word: w,
    startMs: Math.round(i * perWord),
    endMs: Math.round(i * perWord + perWord * 0.8),
  }));
}

async function main() {
  console.log("\n=== v2 engine live smoke ===\n");
  const { scoreRepTwoStage } = await import("../src/lib/ai/score-stages");
  const { deriveCoachFocus } = await import("../src/lib/ai/coach-focus");
  const { buildCommunicationSnapshot, renderCoachingMemoryBlock } =
    await import("../src/lib/profile/snapshot");

  // ── 1. First rep (two-stage production path) ─────────────────────────
  console.log("1) First-rep two-stage scoring");
  const firstResult = await scoreRepTwoStage({
    transcript: FIRST_TRANSCRIPT,
    promptText: PROMPT,
    durationMs: 45_000,
    timeBudgetMs: 90_000,
    words: mkWords(FIRST_TRANSCRIPT),
  });
  const first = firstResult.score;
  check(
    first.composite >= 20 && first.composite <= 98,
    `composite in range (${first.composite})`,
  );
  check(first.dimensions.length === 6, "6 dimensions scored");
  check(
    first.implementationReview == null,
    "no implementationReview on a first rep",
  );
  const focus = deriveCoachFocus(first);
  check(!!focus, `coach focus derivable (${focus?.dimension}: "${focus?.text.slice(0, 60)}...")`);

  // ── 2. Retry with retryContext ───────────────────────────────────────
  console.log("\n2) Retry scoring with retryContext");
  if (!focus) throw new Error("no focus to carry into retry");
  const retryResult = await scoreRepTwoStage({
    transcript: RETRY_TRANSCRIPT,
    promptText: PROMPT,
    durationMs: 30_000,
    timeBudgetMs: 90_000,
    words: mkWords(RETRY_TRANSCRIPT),
    modeContext: {
      sessionType: "focus",
      focusDimension: focus.dimension,
      repIndex: 0,
      totalReps: 3,
      retryContext: {
        attempt: "retry",
        firstTranscript: FIRST_TRANSCRIPT,
        firstComposite: first.composite,
        coachFocus: {
          dimension: focus.dimension,
          subSkill: focus.subSkill,
          text: focus.text,
        },
      },
    },
  });
  const retry = retryResult.score;
  check(
    retry.composite >= 20 && retry.composite <= 98,
    `retry composite in range (${retry.composite})`,
  );
  check(
    retry.implementationReview != null,
    `implementationReview present (${retry.implementationReview?.verdict ?? "MISSING"})`,
  );
  check(
    ["nailed", "partial", "missed"].includes(
      retry.implementationReview?.verdict ?? "",
    ),
    "verdict is a valid enum value",
  );
  check(
    (retry.implementationReview?.note ?? "").length > 0,
    `verdict note non-empty ("${retry.implementationReview?.note?.slice(0, 70)}...")`,
  );
  console.log(`  headline: "${retry.headline}"`);

  // ── 3. Snapshot + coaching memory (dev DB) ───────────────────────────
  console.log("\n3) Communication snapshot + coaching memory (dev DB)");
  const { db } = await import("../src/lib/db/client");
  const { users } = await import("../src/lib/db/schema");
  const anyUser = await db
    .select({ id: users.id })
    .from(users)
    .limit(1)
    .then((r) => r[0] ?? null);
  if (anyUser) {
    const snapshot = await buildCommunicationSnapshot(anyUser.id);
    check(snapshot != null, "snapshot builds for a real user");
    check(
      snapshot != null && typeof snapshot.profile.totalReps === "number",
      `profile present (totalReps=${snapshot?.profile.totalReps}, overall=${snapshot?.profile.overallScore})`,
    );
    const block = renderCoachingMemoryBlock(snapshot);
    check(
      block === null || block.startsWith("COACHING MEMORY"),
      `coaching memory block well-formed (${block ? "present" : "empty ledger → null"})`,
    );
  } else {
    console.log("  (no users in dev DB — skipped)");
  }

  // ── 4. Sanity ordering ───────────────────────────────────────────────
  console.log("\n4) Sanity: retry (clean) vs first (filler-heavy) ordering");
  check(
    retry.composite >= first.composite - 5,
    `clean retry not scored materially below messy first (first=${first.composite}, retry=${retry.composite})`,
  );

  console.log(`\n═══ smoke result: pass=${pass} fail=${fail} ═══`);
  if (fail > 0) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error("smoke fatal:", err);
  process.exit(1);
});
