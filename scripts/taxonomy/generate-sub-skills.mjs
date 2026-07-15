#!/usr/bin/env node
// Regenerate src/types/hidden-skills.generated.ts from hidden-skills-v2.json.
//
// The JSON (extracted from PRD §5.5, D20) is the source of truth for the
// Hidden Skill taxonomy. This script emits it as a TypeScript `as const`
// array so `src/types/sub-skills.ts` can derive the SubSkillId union and
// all lookup maps at compile time. Never edit the generated file by hand.
//
// Usage: node scripts/taxonomy/generate-sub-skills.mjs

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// Load + integrity checks (id shape, dup ids, per-dim counts, migration
// target liveness) live in the shared loader — fail loud at generation
// time, not at import time.
import { loadTaxonomy } from "./lib.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { taxonomy, legacyMap } = loadTaxonomy();
const legacyEntries = Object.entries(legacyMap);

const rows = taxonomy.skills
  .map(
    (s) =>
      `  { dimension: ${JSON.stringify(s.dimension)}, id: ${JSON.stringify(s.id)}, label: ${JSON.stringify(s.label)}, definition: ${JSON.stringify(s.definition)} },`,
  )
  .join("\n");

const out = `// GENERATED FILE — do not edit by hand.
// Source: scripts/taxonomy/hidden-skills-v2.json (PRD §5.5 Hidden Skill
// Taxonomy v2, D20). Regenerate: node scripts/taxonomy/generate-sub-skills.mjs

/** Taxonomy version stamp (PRD revision the data was extracted from). */
export const HIDDEN_SKILLS_VERSION = ${JSON.stringify(taxonomy.version)};

export const HIDDEN_SKILLS = [
${rows}
] as const;

export type HiddenSkillRow = (typeof HIDDEN_SKILLS)[number];

/** Old (pre-v2) sub-skill id → v2 id, RENAMES ONLY (identity mappings
 *  excluded). Source: scripts/taxonomy/migration-map.json /
 *  plans/prd/taxonomy-migration-map.md. Lets rep evidence and profile
 *  backfills written against the 34-id taxonomy keep folding correctly. */
export const LEGACY_SUB_SKILL_MAP: Record<string, HiddenSkillRow["id"]> = {
${legacyEntries.map(([o, n]) => `  ${JSON.stringify(o)}: ${JSON.stringify(n)},`).join("\n")}
};
`;

const target = resolve(__dirname, "../../src/types/hidden-skills.generated.ts");
writeFileSync(target, out);
console.log(
  `[generate-sub-skills] wrote ${taxonomy.skills.length} skills to ${target}`,
);
