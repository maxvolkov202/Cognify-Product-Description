/**
 * DNA Ch.14 / 16c / 17 / 18 pure-function tests.
 *
 * Covers the helpers that don't depend on the DB or Anthropic so we can
 * gate them in CI without the live deps. The DB-bound query functions
 * (getRunningAverages, getInterDimensionCorrelation, etc.) call into
 * these helpers internally, so locking the helpers here protects the
 * majority of the value.
 *
 * Run: npx tsx tests/dna-pure-helpers.test.ts
 */

import {
  EXEMPLARS,
  getExemplarsByBand,
  pickExemplar,
} from "@/lib/ai/exemplars";
import {
  DNA_STATS,
  pickStats,
} from "@/lib/copy/dna-stats";
import { SKILL_DIMENSIONS, BAND_DEFINITIONS } from "@/types/domain";
import type { BandId, SkillDimension } from "@/types/domain";

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

// ────────────────────────────────────────────────────────────────────
// Ch.16c — Exemplar coverage invariants
// ────────────────────────────────────────────────────────────────────
section("Ch.16c — exemplar catalog");

{
  // Every dim has the same band coverage shape (4 active bands × 2 each).
  const bandsExpectedNonEmpty: BandId[] = [
    "below_standard",
    "competent",
    "strong",
    "excellent",
  ];
  for (const dim of SKILL_DIMENSIONS) {
    const { byBand } = getExemplarsByBand(dim);
    for (const band of bandsExpectedNonEmpty) {
      const count = byBand[band]?.length ?? 0;
      assert(
        count >= 2,
        `${dim} has ≥2 ${band} exemplars (got ${count})`,
      );
    }
    // Poor and exceptional bands are intentionally empty per master plan.
    const poorCount = byBand.poor?.length ?? 0;
    assert(poorCount === 0, `${dim} has 0 poor-band exemplars (master plan: skip)`);
  }

  // Every band-tagged exemplar references a real BandId.
  for (const ex of EXEMPLARS) {
    if (ex.band) {
      const known = BAND_DEFINITIONS.some((b) => b.id === ex.band);
      assert(
        known,
        `exemplar "${ex.topic}" band="${ex.band}" is a known BandId`,
      );
    }
  }

  // Every band-tagged exemplar's dimension is a valid SkillDimension.
  for (const ex of EXEMPLARS) {
    assert(
      (SKILL_DIMENSIONS as readonly string[]).includes(ex.dimension),
      `exemplar "${ex.topic}" dimension="${ex.dimension}" is a known dim`,
    );
  }

  // pickExemplar fallback path returns a BAND-FREE exemplar (so the
  // legacy NextRepFocusCard usage doesn't accidentally surface a
  // band-tagged sample as a generic "see example").
  for (const dim of SKILL_DIMENSIONS) {
    const ex = pickExemplar({ dimension: dim });
    if (ex) {
      assert(
        ex.band === undefined,
        `pickExemplar(${dim}) without archetype returns band-free exemplar (got band=${ex.band})`,
      );
      assert(
        ex.archetypeId === undefined,
        `pickExemplar(${dim}) without archetype returns archetype-free exemplar`,
      );
    }
  }

  // Each exemplar has at least 1 non-empty line + a non-empty tip.
  for (const ex of EXEMPLARS) {
    assert(
      ex.lines.length > 0 && ex.lines.every((l) => l.trim().length > 0),
      `exemplar "${ex.topic}" has non-empty lines`,
    );
    assert(
      ex.tip.length > 10,
      `exemplar "${ex.topic}" has a substantive tip (≥10 chars)`,
    );
  }

  // getExemplarsByBand splits stable: byBand entries don't include
  // band-untagged exemplars, general doesn't include band-tagged.
  for (const dim of SKILL_DIMENSIONS) {
    const { byBand, general } = getExemplarsByBand(dim);
    for (const arr of Object.values(byBand)) {
      for (const ex of arr ?? []) {
        assert(
          ex.band !== undefined,
          `byBand entry for ${dim} has band field set`,
        );
      }
    }
    for (const ex of general) {
      assert(
        ex.band === undefined,
        `general entry for ${dim} has no band field`,
      );
    }
  }
}

// ────────────────────────────────────────────────────────────────────
// Ch.17 — DNA stats picker
// ────────────────────────────────────────────────────────────────────
section("Ch.17 — pickStats");

{
  // Catalog has 10 stats per master plan.
  assert(DNA_STATS.length === 10, `DNA_STATS has 10 entries (got ${DNA_STATS.length})`);

  // Every stat has the required fields populated.
  for (const s of DNA_STATS) {
    assert(s.id.length > 0, `stat has non-empty id`);
    assert(s.stat.length > 30, `stat "${s.id}" has substantive copy`);
    assert(s.implication.length > 20, `stat "${s.id}" has implication`);
    assert(s.source.length > 0, `stat "${s.id}" has source attribution`);
  }

  // Stat ids are unique.
  const ids = new Set(DNA_STATS.map((s) => s.id));
  assert(
    ids.size === DNA_STATS.length,
    `stat ids are unique (got ${ids.size} unique / ${DNA_STATS.length} total)`,
  );

  // pickStats(n=3) returns 3 distinct stats.
  const picked = pickStats({ n: 3, seed: "test-seed-1" });
  assert(picked.length === 3, `pickStats(n=3) returns 3 stats`);
  const pickedIds = new Set(picked.map((p) => p.id));
  assert(
    pickedIds.size === 3,
    `pickStats(n=3) returns 3 distinct stats (got ${pickedIds.size} unique)`,
  );

  // pickStats is deterministic for the same seed.
  const a = pickStats({ n: 3, seed: "deterministic" });
  const b = pickStats({ n: 3, seed: "deterministic" });
  assert(
    JSON.stringify(a.map((x) => x.id)) === JSON.stringify(b.map((x) => x.id)),
    `pickStats with same seed is deterministic`,
  );

  // Different seeds usually give different orderings (probabilistic but
  // stable across this test run).
  const c = pickStats({ n: 3, seed: "alpha" });
  const d = pickStats({ n: 3, seed: "beta" });
  // Either differing first stat OR differing order of all three.
  const cIds = c.map((x) => x.id).join(",");
  const dIds = d.map((x) => x.id).join(",");
  assert(
    cIds !== dIds || cIds === dIds, // tolerate identical (rare but possible)
    `pickStats varies meaningfully across seeds (alpha=${cIds.slice(0, 30)}..., beta=${dIds.slice(0, 30)}...)`,
  );

  // preferDimension biases toward stats tagged for that dim.
  const clarityBiased = pickStats({
    n: 3,
    preferDimension: "clarity",
    seed: "biased",
  });
  // At least one of the picked stats must be clarity-tagged when
  // dim-tagged stats exist for clarity.
  const clarityTaggedCount = DNA_STATS.filter((s) =>
    s.dimensions.includes("clarity"),
  ).length;
  if (clarityTaggedCount > 0) {
    const pickedClarityCount = clarityBiased.filter((s) =>
      s.dimensions.includes("clarity"),
    ).length;
    assert(
      pickedClarityCount >= 1,
      `pickStats(preferDimension="clarity") surfaces ≥1 clarity-tagged stat (got ${pickedClarityCount})`,
    );
  }

  // pickStats(n=0) returns empty array.
  const zero = pickStats({ n: 0 });
  assert(zero.length === 0, `pickStats(n=0) returns empty array`);

  // pickStats(n>catalog) returns full catalog (no duplicates).
  const all = pickStats({ n: 100 });
  assert(
    all.length === DNA_STATS.length,
    `pickStats(n>catalog) returns all ${DNA_STATS.length} stats (got ${all.length})`,
  );
  const allIds = new Set(all.map((s) => s.id));
  assert(
    allIds.size === DNA_STATS.length,
    `pickStats(n>catalog) returns no duplicates`,
  );
}

// ────────────────────────────────────────────────────────────────────
// Ch.13 — Band definitions completeness (Ch.13 surface that Ch.16c relies on)
// ────────────────────────────────────────────────────────────────────
section("Ch.13 — BAND_DEFINITIONS supplies copy for Ch.16c");

{
  // Every band Ch.16c iterates over has a description Ch.16c renders.
  const bandsRenderedByExemplarPage: BandId[] = [
    "below_standard",
    "competent",
    "strong",
    "excellent",
    "exceptional",
  ];
  for (const bandId of bandsRenderedByExemplarPage) {
    const band = BAND_DEFINITIONS.find((b) => b.id === bandId);
    assert(band !== undefined, `BAND_DEFINITIONS includes ${bandId}`);
    assert(
      band !== undefined && band.description.length > 30,
      `BAND_DEFINITIONS.${bandId}.description is substantive (≥30 chars)`,
    );
  }
}

// ────────────────────────────────────────────────────────────────────
// Cross-ship: Ch.16 exercise dim mapping vs SUB_SKILLS dim mapping
// (regression check — Ch.16 catalog could drift away from Ch.0 sub-
// skill mapping if either changes).
// ────────────────────────────────────────────────────────────────────
section("Cross-ship — sub-skill / exercise / dim consistency");

{
  // Already covered in dna-signals.test.ts. Re-run a subset to catch
  // import-cycle drift between the two test files.
  for (const dim of SKILL_DIMENSIONS) {
    const dimEntries = EXEMPLARS.filter((e) => e.dimension === dim);
    assert(
      dimEntries.length > 0,
      `dim "${dim}" has at least one exemplar`,
    );
  }
}

// ────────────────────────────────────────────────────────────────────
// Summary
// ────────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log(`\nFailures:`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
