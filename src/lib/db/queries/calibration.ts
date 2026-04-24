import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  calloutCorrections,
  callouts as calloutsTable,
  feedbackRatings,
} from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import type { SkillDimension } from "@/types/domain";

/**
 * Per-user calibration profile, built from their past feedback ratings and
 * callout corrections. Passed into Claude's scoring system prompt so repeat
 * users get feedback that's been tuned to their prior corrections.
 */
export type CalibrationProfile = {
  /** Recent overall ratings — the user's own verdict on the AI's work. */
  recentRatings: Array<{
    rating: string; // "nailed_it" | "kinda_off" | "wrong"
    note: string | null;
    createdAt: Date;
  }>;
  /** Callouts the user flagged as wrong / off-base. */
  recentCorrections: Array<{
    dimension: SkillDimension;
    verdict: string;
    originalTitle: string;
    originalQuote: string | null;
    correctedQuote: string | null;
    correctedRewrite: string | null;
    createdAt: Date;
  }>;
  /** Aggregate per-dimension trust score: 1.0 = user agrees with our
   *  scoring on this dim, 0.0 = user disagrees a lot. Derived from the
   *  ratio of "agree" vs "wrong/not_relevant" corrections. */
  dimensionTrust: Record<SkillDimension, number>;
};

const MAX_RATINGS = 20;
const MAX_CORRECTIONS = 30;

export async function getUserCalibrationProfile(
  userId: string,
): Promise<CalibrationProfile> {
  return safeDb<CalibrationProfile>(
    async () => {
      const ratings = await db
        .select({
          rating: feedbackRatings.rating,
          note: feedbackRatings.note,
          createdAt: feedbackRatings.createdAt,
        })
        .from(feedbackRatings)
        .where(eq(feedbackRatings.userId, userId))
        .orderBy(desc(feedbackRatings.createdAt))
        .limit(MAX_RATINGS);

      const correctionRows = await db
        .select({
          verdict: calloutCorrections.verdict,
          correctedQuote: calloutCorrections.correctedQuote,
          correctedRewrite: calloutCorrections.correctedRewrite,
          createdAt: calloutCorrections.createdAt,
          dimension: calloutsTable.dimension,
          originalTitle: calloutsTable.title,
          originalQuote: calloutsTable.quote,
        })
        .from(calloutCorrections)
        .innerJoin(
          calloutsTable,
          eq(calloutsTable.id, calloutCorrections.calloutId),
        )
        .where(eq(calloutCorrections.userId, userId))
        .orderBy(desc(calloutCorrections.createdAt))
        .limit(MAX_CORRECTIONS);

      // Filter out the structural_adherence dimension — it's scored
      // separately and doesn't participate in calibration today.
      const scopedCorrections = correctionRows.filter(
        (c): c is typeof c & { dimension: SkillDimension } =>
          c.dimension !== "structural_adherence",
      );

      const dimensionTrust = buildDimensionTrust(scopedCorrections);

      return {
        recentRatings: ratings,
        recentCorrections: scopedCorrections.map((c) => ({
          dimension: c.dimension,
          verdict: c.verdict,
          originalTitle: c.originalTitle,
          originalQuote: c.originalQuote,
          correctedQuote: c.correctedQuote,
          correctedRewrite: c.correctedRewrite,
          createdAt: c.createdAt,
        })),
        dimensionTrust,
      };
    },
    {
      recentRatings: [],
      recentCorrections: [],
      dimensionTrust: emptyDimensionTrust(),
    },
  );
}

function buildDimensionTrust(
  corrections: Array<{ dimension: SkillDimension; verdict: string }>,
): Record<SkillDimension, number> {
  const base = emptyDimensionTrust();
  // Neutral starting trust: 1.0 (we assume the user agrees until they tell us otherwise).
  const tallies = new Map<SkillDimension, { agree: number; disagree: number }>();

  for (const c of corrections) {
    const entry = tallies.get(c.dimension) ?? { agree: 0, disagree: 0 };
    if (c.verdict === "agree") entry.agree += 1;
    else entry.disagree += 1;
    tallies.set(c.dimension, entry);
  }

  for (const [dim, counts] of tallies) {
    const total = counts.agree + counts.disagree;
    if (total === 0) continue;
    // Gentle curve: small sample sizes can't drive trust all the way down.
    // 3 disagreements in a row lands at ~0.25.
    base[dim] = Math.max(0, Math.min(1, counts.agree / total));
  }
  return base;
}

function emptyDimensionTrust(): Record<SkillDimension, number> {
  return {
    clarity: 1,
    structure: 1,
    conciseness: 1,
    thinking_quality: 1,
    delivery: 1,
    adaptability: 1,
  };
}

/**
 * Render the calibration profile as a system-prompt block for Claude.
 * Kept short and structured — the goal is to tune future callouts, not
 * dump every historical rating into context.
 */
export function renderCalibrationForPrompt(
  profile: CalibrationProfile,
): string | null {
  const hasRatings = profile.recentRatings.length > 0;
  const hasCorrections = profile.recentCorrections.length > 0;
  if (!hasRatings && !hasCorrections) return null;

  const parts: string[] = [];
  parts.push(
    "USER CALIBRATION — the user has previously rated or corrected your scoring on past reps. Use this to tune your feedback on this rep. Do not mention these corrections directly in your output.",
  );

  if (hasRatings) {
    const wrongCount = profile.recentRatings.filter(
      (r) => r.rating === "wrong",
    ).length;
    const offCount = profile.recentRatings.filter(
      (r) => r.rating === "kinda_off",
    ).length;
    const nailedCount = profile.recentRatings.filter(
      (r) => r.rating === "nailed_it",
    ).length;
    parts.push(
      `Recent overall ratings (newest first, last ${profile.recentRatings.length}): nailed ${nailedCount}, kinda off ${offCount}, wrong ${wrongCount}.`,
    );
    const notes = profile.recentRatings
      .filter((r) => r.note)
      .slice(0, 5)
      .map((r) => `  - [${r.rating}] ${r.note}`);
    if (notes.length > 0) {
      parts.push("User notes on previous feedback:");
      parts.push(...notes);
    }
  }

  if (hasCorrections) {
    const byDim = new Map<SkillDimension, typeof profile.recentCorrections>();
    for (const c of profile.recentCorrections) {
      const arr = byDim.get(c.dimension) ?? [];
      arr.push(c);
      byDim.set(c.dimension, arr);
    }
    parts.push("Recent callout corrections by dimension:");
    for (const [dim, corrections] of byDim) {
      const wrong = corrections.filter(
        (c) => c.verdict === "wrong" || c.verdict === "not_relevant",
      ).length;
      const agree = corrections.filter((c) => c.verdict === "agree").length;
      parts.push(
        `  - ${dim}: ${wrong} marked wrong/not-relevant, ${agree} agreed with (last ${corrections.length})`,
      );
      const examples = corrections
        .filter((c) => c.verdict === "wrong" || c.verdict === "not_relevant")
        .slice(0, 2);
      for (const ex of examples) {
        parts.push(
          `    · User flagged this as off: "${ex.originalTitle}"${
            ex.correctedQuote ? ` (user's correction: "${ex.correctedQuote}")` : ""
          }`,
        );
      }
    }
    parts.push(
      "Calibration instruction: For dimensions the user has repeatedly flagged as wrong, raise your confidence bar — only flag high-signal issues. For dimensions they've agreed with, you can be more thorough.",
    );
  }

  return parts.join("\n");
}
