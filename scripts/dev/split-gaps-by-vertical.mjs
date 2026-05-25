#!/usr/bin/env node
// Splits scripts/audit-gaps.json into 8 per-vertical files
// scripts/gaps/<vertical>.json so each sub-agent has a focused worklist.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const all = JSON.parse(readFileSync("scripts/audit-gaps.json", "utf8"));
mkdirSync("scripts/gaps", { recursive: true });

const byVertical = {};
for (const g of all.gaps) {
  (byVertical[g.vertical] ||= []).push(g);
}

for (const [vertical, gaps] of Object.entries(byVertical)) {
  // Group by exercise so the agent can iterate cleanly.
  const byExercise = {};
  for (const g of gaps) {
    (byExercise[g.exerciseSlug] ||= {
      exerciseId: g.exerciseId,
      exerciseSlug: g.exerciseSlug,
      exerciseName: g.exerciseName,
      dimension: g.dimension,
      gaps: [],
    }).gaps.push({ goal: g.goal, have: g.have, need: g.need });
  }
  const ordered = Object.values(byExercise).sort((a, b) => {
    if (a.dimension !== b.dimension) return a.dimension.localeCompare(b.dimension);
    return a.exerciseName.localeCompare(b.exerciseName);
  });
  const out = {
    vertical,
    threshold: all.threshold,
    totalGaps: gaps.length,
    exercises: ordered,
  };
  writeFileSync(`scripts/gaps/${vertical}.json`, JSON.stringify(out, null, 2));
  console.log(`  ${vertical.padEnd(12)} ${gaps.length} gaps across ${ordered.length} exercises → scripts/gaps/${vertical}.json`);
}
