/**
 * Grading plan WS6 (§3.6.4) — relevance check.
 *
 * Cosine similarity between the prompt embedding and the transcript
 * embedding (the same text-embedding-3-small vectors RAG already
 * computes). The similarity is tagged on every rep so the threshold can be
 * set from real data; below the threshold, and only when
 * FF_RELEVANCE_FLOOR is on, the four content dimensions are capped and the
 * headline says the answer did not address the prompt. Audit §1.5: the
 * prompt-only off-topic rule never fired on a 40-word off-prompt transcript
 * scored 30 times.
 */
import type { DimensionScore, SkillDimension } from "@/types/domain";

/** Starting threshold; tune from `[relevance: x]` tags on ≥ 50 real reps. */
export const RELEVANCE_FLOOR_SIMILARITY = 0.2;
/** Content dimensions are capped here when the floor fires. */
export const RELEVANCE_FLOOR_CAP = 40;
export const RELEVANCE_HEADLINE_PREFIX = "This answer did not address the prompt.";
const CONTENT_DIMS: readonly SkillDimension[] = ["clarity", "structure", "conciseness", "thinking_quality"];

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number | null {
  if (a.length === 0 || a.length !== b.length) return null;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!, y = b[i]!;
    dot += x * y; na += x * x; nb += y * y;
  }
  if (na === 0 || nb === 0) return null;
  const sim = dot / Math.sqrt(na * nb);
  return Number.isFinite(sim) ? sim : null;
}

export function relevanceBelowFloor(similarity: number | null, threshold = RELEVANCE_FLOOR_SIMILARITY): boolean {
  return similarity != null && similarity < threshold;
}

/** Cap the content dimensions and prefix the headline. Pure; returns new objects. */
export function applyRelevanceFloor(input: {
  dimensions: DimensionScore[];
  headline: string;
  similarity: number;
}): { dimensions: DimensionScore[]; headline: string; dimensionMap: Partial<Record<SkillDimension, number>> } {
  const dimensionMap: Partial<Record<SkillDimension, number>> = {};
  const dimensions = input.dimensions.map((d) => {
    const capped = CONTENT_DIMS.includes(d.dimension) ? Math.min(d.score, RELEVANCE_FLOOR_CAP) : d.score;
    dimensionMap[d.dimension] = capped;
    return capped === d.score
      ? d
      : { ...d, score: capped, signals: [...d.signals, `[relevance floor: ${input.similarity.toFixed(2)} < ${RELEVANCE_FLOOR_SIMILARITY}]`] };
  });
  const headline = input.headline.startsWith(RELEVANCE_HEADLINE_PREFIX)
    ? input.headline
    : `${RELEVANCE_HEADLINE_PREFIX} ${input.headline}`.slice(0, 200);
  return { dimensions, headline, dimensionMap };
}
