#!/usr/bin/env node
// Regenerate src/types/hidden-skills.generated.ts from hidden-skills-v2.json.
//
// The JSON (extracted from PRD §5.5, D20) is the source of truth for the
// Hidden Skill taxonomy. This script emits it as a TypeScript `as const`
// array so `src/types/sub-skills.ts` can derive the SubSkillId union and
// all lookup maps at compile time. Never edit the generated file by hand.
//
// Usage: node scripts/taxonomy/generate-sub-skills.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const taxonomy = JSON.parse(
  readFileSync(resolve(__dirname, "hidden-skills-v2.json"), "utf8"),
);
const migration = JSON.parse(
  readFileSync(resolve(__dirname, "migration-map.json"), "utf8"),
);

// Integrity checks mirror tests/taxonomy.test.ts — fail loud at generation
// time, not at import time.
const ids = new Set();
const counts = {};
for (const s of taxonomy.skills) {
  if (!/^[a-z][a-z0-9_]*$/.test(s.id)) throw new Error(`bad id: ${s.id}`);
  if (ids.has(s.id)) throw new Error(`duplicate id: ${s.id}`);
  ids.add(s.id);
  counts[s.dimension] = (counts[s.dimension] ?? 0) + 1;
}
for (const [dim, expected] of Object.entries(taxonomy.counts)) {
  if (dim === "total") continue;
  if (counts[dim] !== expected) {
    throw new Error(`count mismatch for ${dim}: ${counts[dim]} != ${expected}`);
  }
}

// Every migration target must be a live v2 id, and only RENAMED ids
// belong in the emitted legacy map (identity entries would shadow live
// ids at read time for no benefit).
const legacyEntries = Object.entries(migration.map).filter(
  ([oldId, newId]) => oldId !== newId,
);
for (const [oldId, newId] of legacyEntries) {
  if (!ids.has(newId)) {
    throw new Error(`migration target not in taxonomy: ${oldId} -> ${newId}`);
  }
  if (ids.has(oldId)) {
    throw new Error(`legacy id collides with a live v2 id: ${oldId}`);
  }
}

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
