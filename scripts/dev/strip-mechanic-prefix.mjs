#!/usr/bin/env node
/**
 * Cleans mechanic-prefix anti-pattern from vertical catalog files.
 * Agents kept embedding exercise mechanic instructions ("Headline first:",
 * "Steel-man it:", "No hedging:", etc.) in prompt text despite the canon
 * banning it. UI already shows the exercise name + rule, so the prefix is
 * redundant and reads as a directive instead of an invitation.
 *
 * Two passes per file:
 *   1. STRIP — known prefix patterns get cut from prompt.text; the
 *      remaining text (if it stands alone as a real prompt) is kept.
 *   2. PRUNE — if the stripped prompt is too short (<25 chars) or starts
 *      with junk, the whole prompt is removed entirely.
 *
 * Idempotent. Re-running on a clean file is a no-op.
 *
 * Usage:
 *   node scripts/strip-mechanic-prefix.mjs --dry-run
 *   node scripts/strip-mechanic-prefix.mjs --apply --vertical consulting
 *   node scripts/strip-mechanic-prefix.mjs --apply  (all 8 verticals)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const VERTICALS = ["sales","consulting","finance","healthcare","law","education","leadership","other"];
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const DRY = !APPLY;
const onlyIdx = args.indexOf("--vertical");
const ONLY = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

// Patterns to strip — case-insensitive match at the start of prompt.text,
// followed by ":" or "—" or "-" and a space, then the actual question.
const PREFIXES = [
  /^headline first[,:\s—-]+/i,
  /^lead with the headline[,]?( then the details)?[,:\s—-]+/i,
  /^bottom line first[,:\s—-]+/i,
  /^steel[-\s]?man it[,:\s—-]+/i,
  /^make the case (for|against)[,:\s—-]+/i,
  /^no hedging[,:\s—-]+/i,
  /^no jargon( allowed)?[,:\s—-]+/i,
  /^no medical words[.\s]*plain english( only)?[,:\s—-]+/i,
  /^break it down like (they|you|i)( are| am)? (12|twelve)[,.:\s—-]+/i,
  /^explain like (i'?m|im) (12|twelve)[,:\s—-]+/i,
  /^cut (it )?by half[,:\s—-]+/i,
  /^cut in half[,:\s—-]+/i,
  /^in one sentence[,:\s—-]+/i,
  /^single sentence[,:\s—-]+/i,
  /^one point only[,:\s—-]+/i,
  /^one idea per response[,:\s—-]+/i,
  /^bridge it with (an everyday |a )?analogy[,:\s—-]+/i,
  /^use an analogy[,:\s—-]+/i,
  /^pause before (the )?key (beat|moment|point)s?[,:\s—-]+/i,
  /^strategic pause[,:\s—-]+/i,
  /^silence over filler[,:\s—-]+/i,
  /^two[-\s]?beat pause[,:\s—-]+/i,
  /^kill the filler[,:\s—-]+/i,
  /^30 seconds?[,:\s—-]+/i,
  /^in 30 seconds?[,:\s—-]+/i,
  /^the hard stop[,:\s—-]+/i,
  /^hard stop[,:\s—-]+/i,
  /^warmth switch[,:\s—-]+/i,
  /^prove it[,:\s—-]+/i,
  /^first principles[,:\s—-]+/i,
  /^the story arc[,:\s—-]+/i,
  /^three points[,:\s—-]+/i,
  /^the 3 point rule[,:\s—-]+/i,
  /^the analogy bridge[,:\s—-]+/i,
  /^the word budget[,:\s—-]+/i,
  /^the claim and proof[,:\s—-]+/i,
  /^claim and proof[,:\s—-]+/i,
  /^metronome[,:\s—-]+/i,
  /^volume dial[,:\s—-]+/i,
  /^monotone breaker[,:\s—-]+/i,
];

const MIN_RESIDUAL_LENGTH = 20; // Stripped prompts shorter than this are pruned

// PRUNE MODE: any prompt with a known mechanic-prefix gets deleted
// entirely. Stripping leaves too many sentence fragments ("Of the customer
// story…", "Then unpack X") that don't stand alone. Cleaner to delete and
// let the next authoring run replace them.
function strip(text) {
  for (const re of PREFIXES) {
    if (re.test(text)) {
      return { text, action: "prune", reason: "mechanic-prefix detected" };
    }
  }
  return { text, action: "kept" };
}

let totals = { vertical: 0, fileTotal: 0, kept: 0, stripped: 0, pruned: 0 };

for (const v of VERTICALS) {
  if (ONLY && v !== ONLY) continue;
  const path = resolve("scripts/exercise-catalog/v1/vertical", `${v}.json`);
  const j = JSON.parse(readFileSync(path, "utf-8"));
  let kept = 0, stripped = 0, pruned = 0, prePromptCount = 0;
  const samplesStripped = [];
  const samplesPruned = [];
  for (const ex of j.exercises) {
    prePromptCount += ex.prompts.length;
    const next = [];
    for (const p of ex.prompts) {
      const result = strip(p.text);
      if (result.action === "kept") {
        next.push(p);
        kept++;
      } else if (result.action === "stripped") {
        next.push({ ...p, text: result.text });
        stripped++;
        if (samplesStripped.length < 3) {
          samplesStripped.push({ before: result.originalText, after: result.text });
        }
      } else if (result.action === "prune") {
        pruned++;
        if (samplesPruned.length < 3) {
          samplesPruned.push({ before: p.text, reason: result.reason });
        }
      }
    }
    ex.prompts = next;
  }
  const postTotal = kept + stripped;
  console.log(`${v.padEnd(12)}  pre=${prePromptCount}  kept=${kept}  stripped=${stripped}  pruned=${pruned}  → ${postTotal}`);
  if (samplesStripped.length > 0) {
    console.log("  sample strips:");
    for (const s of samplesStripped) {
      console.log(`    -- "${s.before.slice(0,80)}"`);
      console.log(`    ++ "${s.after.slice(0,80)}"`);
    }
  }
  if (samplesPruned.length > 0) {
    console.log("  sample prunes:");
    for (const s of samplesPruned) {
      console.log(`    XX "${s.before.slice(0,80)}" (${s.reason})`);
    }
  }
  totals.vertical++;
  totals.fileTotal += prePromptCount;
  totals.kept += kept;
  totals.stripped += stripped;
  totals.pruned += pruned;
  if (APPLY) {
    writeFileSync(path, JSON.stringify(j, null, 2));
    console.log(`  ✓ wrote ${path}`);
  }
}

console.log(`\n=== TOTALS across ${totals.vertical} vertical(s) ===`);
console.log(`  pre:     ${totals.fileTotal}`);
console.log(`  kept:    ${totals.kept}`);
console.log(`  stripped: ${totals.stripped}`);
console.log(`  pruned:  ${totals.pruned}`);
console.log(`  post:    ${totals.kept + totals.stripped}`);
if (DRY) console.log(`\n[dry-run] no writes. Use --apply to commit changes.`);
