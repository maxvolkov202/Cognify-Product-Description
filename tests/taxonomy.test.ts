/**
 * System Change v2 Phase 1 (D20) — Hidden Skill Taxonomy v2 tests.
 *
 *   • taxonomy integrity: 148 unique snake_case ids, per-dimension counts
 *     match the PRD §5.5 tables, labels + definitions present
 *   • generated module ↔ source JSON consistency
 *   • migration map round trip: every old id maps to a live v2 id,
 *     canonicalizeSubSkillId resolves old, new, and unknown ids
 *   • profile fold with new keys + legacy-key evidence canonicalization
 *   • renderSubSkillReference token-budget variants
 *
 * Run: npx tsx tests/taxonomy.test.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ALL_SUB_SKILLS,
  SUB_SKILLS,
  SUB_SKILL_TO_DIMENSION,
  SUB_SKILL_LABELS,
  SUB_SKILL_DEFINITIONS,
  canonicalizeSubSkillId,
  isSubSkillId,
  renderSubSkillReference,
  renderSubSkillReferenceWithDefinitions,
} from "@/types/sub-skills";
import { LEGACY_SUB_SKILL_MAP } from "@/types/hidden-skills.generated";
import {
  applyRepToProfile,
  emptyProfile,
} from "@/lib/profile/communication-profile";
import { SKILL_DIMENSIONS } from "@/types/domain";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(cond: unknown, message: string): void {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(message);
    console.log(`  ✗ ${message}`);
  }
}
function section(label: string): void {
  console.log(`\n── ${label} ──`);
}

// PRD §5.5 table row counts (verified against the doc 2026-07-15).
const DOC_COUNTS: Record<string, number> = {
  clarity: 23,
  structure: 23,
  conciseness: 22,
  thinking_quality: 28,
  delivery: 22,
  tone: 30,
};
const DOC_TOTAL = 148;

// ————————————————————————————————————————————————————————————————
section("Taxonomy integrity — ids, counts, labels, definitions");

{
  assert(
    ALL_SUB_SKILLS.length === DOC_TOTAL,
    `ALL_SUB_SKILLS has ${ALL_SUB_SKILLS.length} ids (expected ${DOC_TOTAL})`,
  );
  assert(
    new Set(ALL_SUB_SKILLS).size === ALL_SUB_SKILLS.length,
    "all sub-skill ids are unique",
  );
  for (const id of ALL_SUB_SKILLS) {
    if (!/^[a-z][a-z0-9_]*$/.test(id)) {
      assert(false, `id "${id}" is not snake_case`);
    }
  }
  assert(true, "all ids are snake_case (spot failures above if any)");

  for (const dim of SKILL_DIMENSIONS) {
    assert(
      SUB_SKILLS[dim].length === DOC_COUNTS[dim],
      `${dim} has ${SUB_SKILLS[dim].length} skills (doc table: ${DOC_COUNTS[dim]})`,
    );
  }

  for (const id of ALL_SUB_SKILLS) {
    const label = SUB_SKILL_LABELS[id];
    const def = SUB_SKILL_DEFINITIONS[id];
    if (!label || label.length === 0) assert(false, `id "${id}" missing label`);
    if (!def || def.length < 10) assert(false, `id "${id}" missing definition`);
    if (SUB_SKILL_TO_DIMENSION[id] == null) {
      assert(false, `id "${id}" missing dimension mapping`);
    }
  }
  assert(true, "every id has label + definition + dimension");

  // Generated module stays in sync with the source JSON.
  const json = JSON.parse(
    readFileSync(
      resolve(__dirname, "../scripts/taxonomy/hidden-skills-v2.json"),
      "utf8",
    ),
  ) as { skills: { id: string; dimension: string; definition: string }[] };
  assert(
    json.skills.length === ALL_SUB_SKILLS.length,
    "generated module has same skill count as source JSON",
  );
  for (const s of json.skills) {
    if (!isSubSkillId(s.id)) {
      assert(false, `JSON skill "${s.id}" missing from generated module`);
      continue;
    }
    if (SUB_SKILL_TO_DIMENSION[s.id] !== s.dimension) {
      assert(false, `JSON skill "${s.id}" dimension mismatch`);
    }
    if (SUB_SKILL_DEFINITIONS[s.id] !== s.definition) {
      assert(false, `JSON skill "${s.id}" definition drifted from generated module`);
    }
  }
  assert(true, "generated module matches source JSON (run generate-sub-skills.mjs if this fails)");
}

// ————————————————————————————————————————————————————————————————
section("Migration map — old 34 ids round-trip");

{
  const migration = JSON.parse(
    readFileSync(
      resolve(__dirname, "../scripts/taxonomy/migration-map.json"),
      "utf8",
    ),
  ) as { map: Record<string, string> };
  const entries = Object.entries(migration.map);
  assert(entries.length === 34, `migration map covers 34 old ids (got ${entries.length})`);

  for (const [oldId, newId] of entries) {
    if (!isSubSkillId(newId)) {
      assert(false, `old id "${oldId}" maps to unknown v2 id "${newId}"`);
      continue;
    }
    // canonicalizeSubSkillId must resolve every old id to its target.
    if (canonicalizeSubSkillId(oldId) !== newId) {
      assert(
        false,
        `canonicalizeSubSkillId("${oldId}") !== "${newId}" (got ${canonicalizeSubSkillId(oldId)})`,
      );
    }
  }
  assert(true, "every old id canonicalizes to a live v2 id");

  const targets = entries.map(([, n]) => n);
  assert(
    new Set(targets).size === targets.length,
    "no two old ids collapse into the same v2 id (history preserved 1:1)",
  );

  // LEGACY_SUB_SKILL_MAP holds ONLY the renames (identity entries excluded).
  const renameCount = entries.filter(([o, n]) => o !== n).length;
  assert(
    Object.keys(LEGACY_SUB_SKILL_MAP).length === renameCount,
    `LEGACY_SUB_SKILL_MAP has ${Object.keys(LEGACY_SUB_SKILL_MAP).length} renames (expected ${renameCount})`,
  );
  for (const oldId of Object.keys(LEGACY_SUB_SKILL_MAP)) {
    if (isSubSkillId(oldId)) {
      assert(false, `legacy id "${oldId}" collides with a live v2 id`);
    }
  }
  assert(true, "no legacy id shadows a live v2 id");

  // v2 ids pass through; unknown ids null out.
  assert(
    canonicalizeSubSkillId("takeaway_clarity") === "takeaway_clarity",
    "v2 id passes through canonicalizeSubSkillId",
  );
  assert(
    canonicalizeSubSkillId("not_a_skill") === null,
    "unknown id canonicalizes to null",
  );
}

// ————————————————————————————————————————————————————————————————
section("Profile fold — new keys + legacy evidence canonicalization");

{
  // New-taxonomy evidence folds under its own key.
  const p1 = applyRepToProfile(emptyProfile(), {
    dimensions: [{ dimension: "clarity", score: 70 }],
    subSkillScores: { takeaway_clarity: 82, jargon_translation: 64 },
    at: "2026-07-15T00:00:00Z",
  });
  assert(
    p1.hiddenSkills.takeaway_clarity?.score === 82 &&
      p1.hiddenSkills.jargon_translation?.score === 64,
    "v2 keys fold directly into hiddenSkills",
  );

  // Legacy-key evidence (historical reps) folds into the v2 successor.
  const p2 = applyRepToProfile(emptyProfile(), {
    dimensions: [{ dimension: "clarity", score: 70 }],
    subSkillScores: { word_choice: 75, pitch_variation: 60, garbage_key: 50 },
    at: "2026-07-15T00:00:00Z",
  });
  assert(
    p2.hiddenSkills.vocabulary_precision?.score === 75,
    "legacy word_choice evidence folds into vocabulary_precision",
  );
  assert(
    p2.hiddenSkills.prosodic_alignment?.score === 60,
    "legacy pitch_variation evidence folds into prosodic_alignment (cross-dimension move)",
  );
  assert(
    !("garbage_key" in p2.hiddenSkills) &&
      !("word_choice" in p2.hiddenSkills) &&
      !("pitch_variation" in p2.hiddenSkills),
    "unknown + legacy keys never land in the profile verbatim",
  );

  // Mixed old+new evidence for the SAME skill EMAs into one estimate.
  const p3 = applyRepToProfile(p2, {
    dimensions: [{ dimension: "clarity", score: 70 }],
    subSkillScores: { vocabulary_precision: 85 },
    at: "2026-07-15T01:00:00Z",
  });
  const est = p3.hiddenSkills.vocabulary_precision;
  assert(
    est != null && est.sampleCount === 2 && est.score > 75 && est.score < 85,
    `old+new evidence EMA into one estimate (got ${JSON.stringify(est)})`,
  );
}

// ————————————————————————————————————————————————————————————————
section("Prompt reference rendering — token-budget variants");

{
  const all = renderSubSkillReference();
  assert(
    all.split("\n").length === 6,
    "renderSubSkillReference() renders one line per dimension",
  );
  assert(
    all.includes("Takeaway Clarity") && all.includes("Listener Safety Creation"),
    "full reference includes v2 labels",
  );

  const one = renderSubSkillReference(["tone"]);
  assert(
    one.split("\n").length === 1 && one.startsWith("tone:"),
    "renderSubSkillReference(['tone']) renders only tone",
  );

  const defs = renderSubSkillReferenceWithDefinitions("clarity");
  assert(
    defs.split("\n").length === SUB_SKILLS.clarity.length,
    "definitions variant renders one line per clarity skill",
  );
  assert(
    defs.includes("Jargon Translation — Replacing technical"),
    "definitions variant includes label — definition pairs",
  );
  assert(
    !defs.includes("Signposting"),
    "definitions variant excludes other dimensions (token budget)",
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
