// Grading Engine V2 — feedback-quality eval (mechanical layer).
//
// A new product goal for the redesign is "less generic, more specific
// per-dimension feedback". This scores that mechanically so the bench can
// compare arms:
//
//   groundedness      — does each dimension's feedback quote/reference an
//                       actual ≥3-word span from the transcript? (reuses the
//                       verbatim idea from scripts/qa/score-grading-quality.mjs
//                       + tests/grading-v3-contract.test.ts sanitizeStrongerVersion)
//   distinctness      — are the six feedback strings distinct from each other,
//                       or is the model repeating one generic line? (pairwise
//                       Jaccard; mirrors the off-diagonal <0.6 inter-dimension
//                       correlation guardrail in calibration-metrics.ts)
//   bannedFiller      — any praise-filler that the prompt bans
//
// Higher groundedness + distinctness + fewer banned lines = more specific,
// less generic feedback. An optional LLM-judge layer can live alongside this
// later (kept out here so mechanical scoring stays free + deterministic).

const BANNED_FILLER = [
  "good job",
  "great job",
  "nice work",
  "nice job",
  "well done",
  "way to go",
  "keep it up",
  "you got this",
  "you're doing great",
  "you did well",
];

function normalize(text) {
  return (text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(text) {
  return new Set(normalize(text).split(" ").filter((w) => w.length > 2));
}

/** True if `feedback` contains any ≥3-word span that also appears verbatim
 *  (whitespace-insensitive) in the transcript — evidence the line is about
 *  what the speaker actually said, not a generic template. */
function isGrounded(feedback, normalizedTranscript) {
  const words = normalize(feedback).split(" ").filter(Boolean);
  for (let i = 0; i + 3 <= words.length; i++) {
    const span = words.slice(i, i + 3).join(" ");
    if (normalizedTranscript.includes(span)) return true;
  }
  return false;
}

function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function hasBannedFiller(text) {
  const n = normalize(text);
  return BANNED_FILLER.some((p) => n.includes(p));
}

/**
 * Score one graded rep's feedback quality.
 * @param {object} score - RepScore from /api/score (dimensions[].feedback, coachFocus, strongerVersion)
 * @param {string} transcript - the rep transcript
 * @returns {object} metrics
 */
export function evaluateFeedbackQuality(score, transcript) {
  const normalizedTranscript = normalize(transcript);
  const dims = score.dimensions ?? [];

  const feedbacks = dims
    .map((d) => ({ dim: d.dimension, text: d.feedback }))
    .filter((f) => f.text);

  // Groundedness across per-dimension feedback.
  const groundedCount = feedbacks.filter((f) =>
    isGrounded(f.text, normalizedTranscript),
  ).length;
  const groundedFraction =
    feedbacks.length > 0 ? groundedCount / feedbacks.length : 0;

  // Distinctness: pairwise Jaccard over the feedback strings. A high mean or
  // any pair > 0.6 means the model is repeating one generic line.
  const sets = feedbacks.map((f) => tokenSet(f.text));
  let pairSum = 0;
  let pairCount = 0;
  let maxPair = 0;
  const genericPairs = [];
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const sim = jaccard(sets[i], sets[j]);
      pairSum += sim;
      pairCount++;
      if (sim > maxPair) maxPair = sim;
      if (sim > 0.6) {
        genericPairs.push(`${feedbacks[i].dim}~${feedbacks[j].dim}=${sim.toFixed(2)}`);
      }
    }
  }
  const meanPairwiseSimilarity = pairCount > 0 ? pairSum / pairCount : 0;

  // Banned filler anywhere in surfaced copy.
  const surfaces = [
    ...feedbacks.map((f) => f.text),
    score.headline,
    score.coachFocus?.behavior,
    score.coachFocus?.why,
    score.coachFocus?.action,
    score.strongerVersion?.rewrite,
  ].filter(Boolean);
  const bannedCount = surfaces.filter(hasBannedFiller).length;

  return {
    dimensionCount: feedbacks.length,
    groundedFraction: Math.round(groundedFraction * 100) / 100,
    meanPairwiseSimilarity: Math.round(meanPairwiseSimilarity * 100) / 100,
    maxPairwiseSimilarity: Math.round(maxPair * 100) / 100,
    genericPairs,
    bannedFillerCount: bannedCount,
    strongerVersionPresent: !!score.strongerVersion,
  };
}

/** Aggregate per-rep feedback-quality metrics into an arm-level summary. */
export function summarizeFeedbackQuality(perRep) {
  const n = perRep.length || 1;
  const avg = (pick) => perRep.reduce((a, r) => a + pick(r), 0) / n;
  return {
    reps: perRep.length,
    avgGroundedFraction: Math.round(avg((r) => r.groundedFraction) * 100) / 100,
    avgPairwiseSimilarity:
      Math.round(avg((r) => r.meanPairwiseSimilarity) * 100) / 100,
    repsWithGenericPairs: perRep.filter((r) => r.genericPairs.length > 0).length,
    totalBannedFiller: perRep.reduce((a, r) => a + r.bannedFillerCount, 0),
    strongerVersionRate:
      Math.round(avg((r) => (r.strongerVersionPresent ? 1 : 0)) * 100) / 100,
  };
}
