// Shared taxonomy loader for script-side consumers (Phase 2 tooling
// consolidation — was duplicated across seed-exercise-catalog.mjs,
// retag-exercises.mjs, and generate-sub-skills.mjs).
//
// hidden-skills-v2.json (extracted from PRD §5.5, D20) is the source of
// truth for the Hidden Skill Taxonomy; migration-map.json carries the
// 34 pre-v2 ids → v2 ids bridge. src/types/sub-skills.ts is GENERATED
// from the same JSON (via generate-sub-skills.mjs), so scripts and app
// code can never disagree about the skill set.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Manifest/DB dimension key → taxonomy dimension key. The `pacing`
 *  muscle group is the DB-enum-legacy spelling of the taxonomy's
 *  `delivery` dimension (terminology-map ruling, D6). */
export const DIM_ALIAS = { pacing: "delivery" };

/** Canonicalize a manifest/DB dimension to its taxonomy dimension. */
export const toSkillDim = (d) => DIM_ALIAS[d] ?? d;

/**
 * Load + integrity-check the taxonomy. Returns:
 *   - taxonomy: the raw parsed JSON ({version, counts, skills})
 *   - skillsByDim: Map<taxonomyDim, skill[]>
 *   - skillIdsByDim: Map<taxonomyDim, string[]>
 *   - skillById: Map<id, skill>
 *   - legacyMap: { [oldId]: newId } (renames only — identity entries
 *     are filtered out; they'd shadow live ids for no benefit)
 *
 * Integrity checks mirror tests/taxonomy.test.ts — fail loud at load
 * time, not at consumer time.
 */
export function loadTaxonomy() {
  const taxonomy = JSON.parse(
    readFileSync(resolve(__dirname, "hidden-skills-v2.json"), "utf8"),
  );
  const migration = JSON.parse(
    readFileSync(resolve(__dirname, "migration-map.json"), "utf8"),
  );

  const ids = new Set();
  const counts = {};
  const skillsByDim = new Map();
  const skillIdsByDim = new Map();
  const skillById = new Map();
  for (const s of taxonomy.skills) {
    if (!/^[a-z][a-z0-9_]*$/.test(s.id)) throw new Error(`bad id: ${s.id}`);
    if (ids.has(s.id)) throw new Error(`duplicate id: ${s.id}`);
    ids.add(s.id);
    counts[s.dimension] = (counts[s.dimension] ?? 0) + 1;
    skillById.set(s.id, s);
    const arr = skillsByDim.get(s.dimension) ?? [];
    arr.push(s);
    skillsByDim.set(s.dimension, arr);
    const idArr = skillIdsByDim.get(s.dimension) ?? [];
    idArr.push(s.id);
    skillIdsByDim.set(s.dimension, idArr);
  }
  for (const [dim, expected] of Object.entries(taxonomy.counts)) {
    if (dim === "total") continue;
    if (counts[dim] !== expected) {
      throw new Error(
        `count mismatch for ${dim}: ${counts[dim]} != ${expected}`,
      );
    }
  }

  const legacyMap = {};
  for (const [oldId, newId] of Object.entries(migration.map)) {
    if (oldId === newId) continue;
    if (!ids.has(newId)) {
      throw new Error(`migration target not in taxonomy: ${oldId} -> ${newId}`);
    }
    if (ids.has(oldId)) {
      throw new Error(`legacy id collides with a live v2 id: ${oldId}`);
    }
    legacyMap[oldId] = newId;
  }

  return { taxonomy, skillsByDim, skillIdsByDim, skillById, legacyMap };
}
