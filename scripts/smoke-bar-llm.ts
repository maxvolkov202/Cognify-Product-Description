/**
 * Phase 4 (Build a Rep) LLM-path smoke — post API re-up.
 *
 * Exercises the three LLM paths that Phase 4 could only run through
 * deterministic fallbacks while both providers were out of credits:
 *   #2  generatePreparationPlan honors user-named questions (rule 1a):
 *       plan == EXACTLY those questions (non-suggested) + a separate
 *       suggestions rail (suggested:true).
 *   #3a generateTalkingPoints auto-drafts a moment's speaking notes.
 *   #1  extractImageContextText (OpenAI vision) parses a document image,
 *       and generatePreparationPlan reflects that context.
 *
 * Run: npx tsx scripts/smoke-bar-llm.ts [path-to-document-image.png]
 *
 * All src imports are DYNAMIC (after dotenv) so provider keys are read
 * from .env.local at call time, not hoisted at module init.
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
config({ path: ".env.local" });

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

async function main() {
  const imagePath = process.argv[2];
  const { generatePreparationPlan } = await import("../src/lib/ai/prep/plan-generation");
  const { generateTalkingPoints } = await import("../src/lib/ai/talking-points");

  // ── Smoke #2: user-named questions become EXACTLY the plan ──────────
  console.log("\n=== #2 user-named questions → exactly those moments + suggestions rail ===");
  const namedDesc =
    "I have a final-round PM interview next week. I want to practice exactly three questions: " +
    "1) Tell me about a product you shipped end to end. " +
    "2) How do you say no to a senior stakeholder? " +
    "3) Walk me through how you'd prioritize a messy backlog.";
  const { plan: namedPlan, source: namedSource } = await generatePreparationPlan({
    description: namedDesc,
  });
  console.log(`  source=${namedSource}  eventType=${namedPlan.eventType}  moments=${namedPlan.moments.length}`);
  const practice = namedPlan.moments.filter((m) => !m.suggested);
  const suggested = namedPlan.moments.filter((m) => m.suggested);
  console.log("  practice titles:", practice.map((m) => `"${m.title}"`).join(", "));
  console.log("  suggested titles:", suggested.map((m) => `"${m.title}"`).join(", ") || "(none)");
  check("plan came from the model, not the deterministic fallback", namedSource === "model");
  check("exactly 3 practice moments (the user's 3 questions)", practice.length === 3, `got ${practice.length}`);
  // titles should reflect the user's three topics (loose keyword match)
  const joined = practice.map((m) => m.title.toLowerCase()).join(" | ");
  check("practice moments reflect the named questions",
    /ship|product/.test(joined) && /(say no|stakeholder|no to)/.test(joined) && /(prioriti|backlog)/.test(joined),
    joined);
  check("no user-named moment is mislabeled 'suggested'", practice.length === 3);
  check("suggestions render separately (0-3, all suggested:true)", suggested.length <= 3 && suggested.every((m) => m.suggested));
  check("every practice moment has coachCue + scoringHint", practice.every((m) => m.coachCue && m.scoringHint));

  // ── Smoke #3a: moment speaking notes auto-draft ─────────────────────
  console.log("\n=== #3 moment speaking notes auto-draft (talking-points generator) ===");
  const tp = await generateTalkingPoints({
    scenario:
      "Interview moment: 'Tell me about a product you shipped end to end.' " +
      "Draft speaking notes: structure for a tight 90-second STAR-style answer.",
  });
  const bulletCount = tp.sections.reduce((n, s) => n + s.bullets.length, 0);
  console.log(`  sections=${tp.sections.length}  bullets=${bulletCount}`);
  console.log("  headers:", tp.sections.map((s) => `"${s.header}"`).join(", "));
  check("notes have 2-6 sections", tp.sections.length >= 2 && tp.sections.length <= 6, `${tp.sections.length}`);
  check("each section has 1-3 bullets", tp.sections.every((s) => s.bullets.length >= 1 && s.bullets.length <= 3));
  check("bullets are non-empty phrases", tp.sections.every((s) => s.bullets.every((b) => b.trim().length > 0)));

  // ── Smoke #1: vision parse of a document image → plan reflects it ───
  if (imagePath) {
    console.log("\n=== #1 photo/document vision parse → plan regenerated with context ===");
    const { extractImageContextText } = await import("../src/lib/ai/prep/image-context");
    const buf = readFileSync(imagePath);
    const mime = imagePath.endsWith(".jpg") || imagePath.endsWith(".jpeg") ? "image/jpeg" : "image/png";
    const extracted = await extractImageContextText(buf, mime);
    console.log(`  extracted ${extracted ? extracted.length : 0} chars`);
    if (extracted) console.log("  extract head:", JSON.stringify(extracted.slice(0, 300)));
    check("vision returned non-empty text", !!extracted && extracted.length > 20);
    if (extracted) {
      // The doc names a specific role/company — plan should be specific to it.
      const { plan: ctxPlan, source: ctxSource } = await generatePreparationPlan({
        description: "Help me prepare for the event this document describes.",
        contextText: extracted,
      });
      console.log(`  ctx plan source=${ctxSource} title="${ctxPlan.title}" moments=${ctxPlan.moments.length}`);
      const allText = (ctxPlan.title + " " + ctxPlan.moments.map((m) => m.title + " " + m.objective).join(" ")).toLowerCase();
      check("context plan came from the model", ctxSource === "model");
      check("plan reflects the document (mentions the role/company/topic)",
        /aurora|payments|staff|platform|migration|reliability|incident/.test(allText),
        ctxPlan.title);
    }
  } else {
    console.log("\n(skipping #1 vision smoke — no image path arg)");
  }

  console.log(`\n${failures === 0 ? "ALL SMOKES PASSED" : failures + " CHECK(S) FAILED"}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("smoke crashed:", e);
  process.exit(1);
});
