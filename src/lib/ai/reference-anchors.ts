/**
 * Grading Engine V2 — Arm A: reference-anchored scoring.
 *
 * The root accuracy problem in the single-call scorer is absolute 0-100
 * calibration: gpt-4o compresses scores toward the middle band because it
 * has no fixed sense of where "23" vs "73" vs "84" actually live. This arm
 * gives the model three human-scored reps that span the range as an
 * additional CACHED system block, so it places THIS rep RELATIVE to known
 * anchors instead of guessing an absolute number. Cheapest lever
 * (~static, extends the shared cache prefix, ~0 marginal cost) and it does
 * not touch determinism.
 *
 * The anchor transcripts + human scores are lifted verbatim from
 * `scripts/calibration/reference-reps.json` (the same bank the calibration
 * gate scores against). They are baked in here as constant data — NOT
 * imported from scripts/ — so the production bundle is self-contained and
 * the anchors can never silently drift when the bank is edited. When the
 * bank's expected scores for these ids change, update the `expected`
 * values here in the same PR.
 *
 * ── Leave-one-out ────────────────────────────────────────────────────
 * When the rep being scored IS one of the primary anchors (e.g. the
 * calibration harness replays `band-poor-mic-test` through this arm), the
 * anchor block would otherwise contain that exact transcript with its
 * expected scores and the model would simply parrot them — a leak that
 * would flatter the arm's measured accuracy. `selectAnchors(transcript)`
 * swaps in a same-tier substitute for any anchor whose transcript matches
 * the rep under test, so no rep is ever scored against itself. Matching is
 * on the normalized transcript (the harness sends no rep id).
 */

import type { SkillDimension } from "@/types/domain";

export type ReferenceAnchor = {
  /** id from scripts/calibration/reference-reps.json (provenance only). */
  id: string;
  /** Where this anchor sits on the range — one primary + one substitute
   *  per tier, so leave-one-out always has a same-band replacement. */
  tier: "low" | "mid" | "high";
  promptText: string;
  transcript: string;
  durationMs: number;
  composite: number;
  expected: Record<SkillDimension, number>;
};

// ── Low tier ──────────────────────────────────────────────────────────
const POOR_MIC_TEST: ReferenceAnchor = {
  id: "band-poor-mic-test",
  tier: "low",
  promptText: "Pitch your product to a CFO in 30 seconds.",
  transcript:
    "Uh, hello, hello? Is this thing on. Um yeah so basically the product is, like, you know, it's a thing that does, um, automation, sort of? Uh, that's, that's it I guess.",
  durationMs: 18000,
  composite: 23,
  expected: {
    clarity: 23,
    structure: 15,
    conciseness: 28,
    thinking_quality: 13,
    delivery: 38,
    tone: 32,
  },
};

const RAMBLING_PITCH: ReferenceAnchor = {
  id: "band-below-rambling-pitch",
  tier: "low",
  promptText: "Pitch your product to a CFO in 30 seconds.",
  transcript:
    "So like our product, um, it's basically a SaaS platform that we've been working on, you know, for a while, and the idea is to help companies with their, um, automation needs. We have a lot of features and we think it's pretty good. Uh, the price is competitive and we have customers. So yeah you should consider it.",
  durationMs: 32000,
  composite: 38,
  expected: {
    clarity: 33,
    structure: 25,
    conciseness: 50,
    thinking_quality: 32,
    delivery: 55,
    tone: 50,
  },
};

// ── Mid tier ──────────────────────────────────────────────────────────
const BOARD_BAD_QUARTER: ReferenceAnchor = {
  id: "scenario-competent-board-bad-quarter",
  tier: "mid",
  promptText: "Brief the board on missing the quarter.",
  transcript:
    "We came in fourteen percent short on revenue this quarter. The headline number is bad, here's what's underneath. Pipeline conversion was on plan; the gap was deal velocity — our top ten deals slipped from Q1 to Q2 because of procurement freezes at three of our largest accounts. Two of those have committed signing this month. We're forecasting Q2 at one twenty percent of plan to recover the gap. The deeper question is whether the slip is structural or one-time, and we'll have a clearer read in three weeks based on the early-Q2 pipeline.",
  durationMs: 35000,
  composite: 73,
  expected: {
    clarity: 77,
    structure: 65,
    conciseness: 85,
    thinking_quality: 68,
    delivery: 78,
    tone: 68,
  },
};

const TELL_ME_ABOUT_YOURSELF: ReferenceAnchor = {
  id: "interview-competent-tell-me-about-yourself",
  tier: "mid",
  promptText: "Tell me about yourself.",
  transcript:
    "Sure. I'm a product manager with seven years of experience, mostly in B2B SaaS at the mid-market layer. Started at a twenty-person CRM company where I owned the analytics roadmap, then moved to a series-B fintech where I shipped our reporting suite — that's the work I'm most proud of, doubled active users in two quarters. Currently leading the integrations team at my current company. What pulled me toward this role is the chance to own platform-level decisions instead of just feature ones. That feels like the right next step.",
  durationMs: 36000,
  composite: 71,
  expected: {
    clarity: 78,
    structure: 64,
    conciseness: 85,
    thinking_quality: 57,
    delivery: 78,
    tone: 68,
  },
};

// ── High tier ─────────────────────────────────────────────────────────
const SECURITY_CONCERN: ReferenceAnchor = {
  id: "objection-strong-security-concern",
  tier: "high",
  promptText:
    "After the breach in your industry last quarter, how do I trust you with our data?",
  transcript:
    "Three layers of answer. First, we don't store the data the breached vendor stored — our model is encrypt-and-forward, not encrypt-at-rest. The blast radius for us is structurally smaller. Second, we run quarterly third-party penetration tests; the most recent report is in your data room from last week. Third, on the specific vector that hit them, we patched eighteen months ago because we sit on the same disclosure list. Three controls, all auditable. I'd rather earn the trust on evidence than ask for it.",
  durationMs: 33000,
  composite: 84,
  expected: {
    clarity: 85,
    structure: 88,
    conciseness: 91,
    thinking_quality: 82,
    delivery: 79,
    tone: 73,
  },
};

const CLEAN_PITCH: ReferenceAnchor = {
  id: "band-strong-clean-pitch",
  tier: "high",
  promptText: "Pitch your product to a CFO in 30 seconds.",
  transcript:
    "We cut your monthly close from five days to one. Here's how. We ingest your bank feeds, match them against your ledger, and flag the exceptions. Three of your peers are running it now and they've reclaimed 40 hours per close. The CFO at one of them said it was the highest-ROI tool she signed last year. Want me to share their case study and book 15 minutes?",
  durationMs: 35000,
  composite: 80,
  expected: {
    clarity: 88,
    structure: 78,
    conciseness: 87,
    thinking_quality: 79,
    delivery: 66,
    tone: 71,
  },
};

/** One primary + one substitute per tier. `selectAnchors` picks the
 *  primary unless the rep under test IS the primary (leave-one-out), in
 *  which case it uses the substitute. */
const ANCHOR_TIERS: { primary: ReferenceAnchor; substitute: ReferenceAnchor }[] =
  [
    { primary: POOR_MIC_TEST, substitute: RAMBLING_PITCH },
    { primary: BOARD_BAD_QUARTER, substitute: TELL_ME_ABOUT_YOURSELF },
    { primary: SECURITY_CONCERN, substitute: CLEAN_PITCH },
  ];

/** Every rep this arm treats as an anchor (primaries + substitutes), so a
 *  caller can tell whether a given transcript is anchor material. */
export const ALL_ANCHOR_IDS: readonly string[] = ANCHOR_TIERS.flatMap((t) => [
  t.primary.id,
  t.substitute.id,
]);

function normalizeTranscript(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Pick the three anchors (low / mid / high) to show the model for THIS
 * rep. Leave-one-out: if the rep's transcript matches a tier's primary (or
 * its substitute), pick the OTHER rep in that tier so the rep is never
 * scored against a copy of itself. `transcript` omitted (or matching
 * nothing) → the three primaries.
 */
export function selectAnchors(transcript?: string): ReferenceAnchor[] {
  const norm = transcript ? normalizeTranscript(transcript) : null;
  return ANCHOR_TIERS.map(({ primary, substitute }) => {
    if (norm && normalizeTranscript(primary.transcript) === norm) {
      return substitute;
    }
    if (norm && normalizeTranscript(substitute.transcript) === norm) {
      return primary;
    }
    return primary;
  });
}

const DIM_ORDER: SkillDimension[] = [
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "tone",
];

/**
 * Render the REFERENCE ANCHORS cached system block. Framed explicitly as
 * calibration references (NOT exemplars to imitate) so the model uses them
 * for band placement, not as content to copy. Deterministic function of
 * the selected anchors → byte-stable, cache-friendly.
 */
export function renderReferenceAnchorsBlock(anchors: ReferenceAnchor[]): string {
  const lines: string[] = [
    "REFERENCE ANCHORS (calibration references, NOT exemplars to imitate):",
    "Below are real reps a human expert already scored, spanning the range from a poor rep to a strong one. Use them ONLY to calibrate absolute 0-100 placement: judge where THIS rep falls relative to these anchors, then score it. A rep may score higher than the strongest anchor or lower than the weakest. Do NOT copy their content, structure, wording, or topic, and do NOT assume this rep should land near any anchor — they are a ruler, not a target.",
    "",
  ];
  anchors.forEach((a, i) => {
    const scores = DIM_ORDER.map((d) => `${d} ${a.expected[d]}`).join(", ");
    lines.push(
      `ANCHOR ${i + 1} — human composite ${a.composite}`,
      `Prompt: ${a.promptText}`,
      `Transcript: "${a.transcript}"`,
      `Human dimension scores: ${scores}`,
      "",
    );
  });
  lines.push(
    "Now score the rep in the user message below on its own merits, using these anchors only to keep your 0-100 placement honest.",
  );
  return lines.join("\n");
}
