#!/usr/bin/env tsx
/**
 * Ch.C3 — Operator-correction → reference-bank promotion.
 *
 * Reads score_corrections rows that:
 *   - have verdict in {should_be_lower, should_be_higher}
 *   - have non-null corrected_composite
 *   - were reviewed at least 7 days ago (cool-off for second-opinion)
 * and emits a JSON proposal showing what NEW reference reps would be
 * appended to scripts/calibration/reference-reps.json with the
 * operator's corrected scores as the new `expected`.
 *
 * Critically: this script does NOT auto-write. It outputs the proposal
 * as a *.proposed.json sidecar that the operator hand-merges via PR
 * review. Reasoning: reference-bank entries set expectations for
 * EVERY future calibration run. Auto-merging operator corrections risks
 * propagating one operator's miscalibration. PR review surfaces
 * disagreements before they hit the bank.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/promote-corrections.ts
 *   DATABASE_URL=... npx tsx scripts/promote-corrections.ts --cooloff-days 3
 *   DATABASE_URL=... npx tsx scripts/promote-corrections.ts --out custom-path.proposed.json
 */

import { writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPromotableCorrections } from "../src/lib/db/queries/review-queue.js";
import { loadReferenceBank } from "../src/lib/calibration/reference-bank.js";

type Args = {
  cooloffDays: number;
  out: string;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const out = (() => {
    const idx = args.indexOf("--out");
    return idx >= 0 ? args[idx + 1] : null;
  })();
  const cooloff = (() => {
    const idx = args.indexOf("--cooloff-days");
    return idx >= 0 ? Number.parseInt(args[idx + 1] ?? "7", 10) : 7;
  })();
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    cooloffDays: Number.isFinite(cooloff) ? cooloff : 7,
    out:
      out ??
      resolve(
        process.cwd(),
        "scripts",
        "calibration",
        `proposed-${stamp}.proposed.json`,
      ),
  };
}

function transcriptToText(transcript: unknown): string {
  if (typeof transcript === "string") return transcript;
  if (transcript && typeof transcript === "object" && "transcript" in transcript) {
    const t = (transcript as Record<string, unknown>).transcript;
    if (typeof t === "string") return t;
  }
  return JSON.stringify(transcript);
}

async function main() {
  const args = parseArgs();
  process.stderr.write(
    `Loading promotable corrections (≥${args.cooloffDays} days old)...\n`,
  );

  const corrections = await getPromotableCorrections({
    cooloffDays: args.cooloffDays,
  });

  if (corrections.length === 0) {
    process.stderr.write("No promotable corrections found.\n");
    process.exit(0);
  }

  const bank = loadReferenceBank();
  const existingIds = new Set(bank.reps.map((r) => r.id));

  const proposed: Array<{
    id: string;
    kind: "band";
    promptText: string;
    transcript: string;
    durationMs: number;
    audioUrl?: string;
    expected: {
      composite: number;
      band: string;
      dimensions: Record<string, number>;
    };
    sourceCorrection: {
      correctionId: string;
      repId: string;
      verdict: string;
      reviewedAt: string;
      operatorNotes: string | null;
    };
  }> = [];

  let skipped = 0;
  for (const c of corrections) {
    const newId = `correction-${c.correctionId.slice(0, 8)}`;
    if (existingIds.has(newId)) {
      skipped++;
      continue;
    }
    const expectedComposite = c.correctedComposite;
    const band =
      expectedComposite < 40
        ? "poor"
        : expectedComposite < 60
          ? "below_standard"
          : expectedComposite < 75
            ? "competent"
            : expectedComposite < 85
              ? "strong"
              : expectedComposite < 95
                ? "excellent"
                : "exceptional";
    const dims =
      c.correctedPerDim ??
      // Fall back to actuals if operator didn't specify per-dim corrections.
      c.rep.perDimActual;
    proposed.push({
      id: newId,
      kind: "band",
      promptText: c.rep.promptText,
      transcript: transcriptToText(c.rep.transcript),
      durationMs: c.rep.durationMs,
      ...(c.rep.audioUrl ? { audioUrl: c.rep.audioUrl } : {}),
      expected: {
        composite: expectedComposite,
        band,
        dimensions: dims,
      },
      sourceCorrection: {
        correctionId: c.correctionId,
        repId: c.repId,
        verdict: c.verdict,
        reviewedAt: c.reviewedAt.toISOString(),
        operatorNotes: c.notes,
      },
    });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    cooloffDays: args.cooloffDays,
    bankSizeBefore: bank.reps.length,
    proposedAdds: proposed.length,
    skippedExisting: skipped,
    proposed,
    mergeInstructions: [
      "1. Review each entry below for correctness (especially per-dim scores).",
      "2. Adjust id / promptText / transcript as needed for clarity.",
      "3. Append accepted entries to scripts/calibration/reference-reps.json.",
      "4. Run `node scripts/calibrate-scoring.mjs` to verify drift impact.",
      "5. Commit + PR with a one-line rationale per accepted entry.",
    ],
  };

  writeFileSync(args.out, JSON.stringify(output, null, 2), "utf8");
  process.stderr.write(
    `Wrote proposal: ${args.out}\n` +
      `  proposed adds: ${proposed.length}\n` +
      `  skipped (id collision): ${skipped}\n`,
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
