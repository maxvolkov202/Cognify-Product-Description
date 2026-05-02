/**
 * Cognify Ch.17 — DNA stats catalog.
 *
 * The 10 highest-leverage motivator stats from the DNA. Surfaced in
 * onboarding (between vertical-pick and first-rep) and in the dashboard
 * empty state to reinforce why the user is here. Each stat carries a
 * conservative phrasing + a citation/source attribute so we can audit
 * provenance and swap in updated research as it lands.
 *
 * Six are taken verbatim from `docs/cognify-dna.md` §"Why communication
 * matters" — they're the primary research foundation. Four more are
 * widely-cited findings on adjacent topics (impressions, attention,
 * meeting effectiveness, vocal authority). All are conservatively
 * phrased — if a finding is from a single corner study we soften the
 * claim or omit it entirely.
 *
 * Bias-toward-honesty: when in doubt about a stat's provenance, prefer
 * the wording that's defensible to a skeptical operator over the one
 * that lands harder.
 */

import type { SkillDimension } from "@/types/domain";

export type DnaStat = {
  /** Stable ID for analytics + dedup. */
  readonly id: string;
  /** The stat as a single sentence — typically a percent + a noun
   *  phrase. ≤140 chars, second-person where it scans naturally. */
  readonly stat: string;
  /** One short follow-on line that ties the stat to "and that's why
   *  daily training matters." ≤120 chars. */
  readonly implication: string;
  /** Source label rendered in small text under the stat. */
  readonly source: string;
  /** Which dimension(s) the stat most strongly motivates. Used by
   *  surfaces that want to filter by user's weakest dim. Empty when
   *  the stat applies to communication broadly. */
  readonly dimensions: readonly SkillDimension[];
};

export const DNA_STATS: readonly DnaStat[] = [
  {
    id: "career-success-85",
    stat: "85% of career success is attributed to communication skills — only 15% to technical expertise.",
    implication:
      "The skill that decides outcomes is the one almost no one trains.",
    source: "Carnegie Institute / Stanford Research Institute",
    dimensions: [],
  },
  {
    id: "salary-premium-20",
    stat: "Effective communicators earn roughly 20% more in salary on average across roles and tenures.",
    implication:
      "The compounding cost of mediocre communication is paid in dollars, year over year.",
    source: "Multiple longitudinal compensation studies",
    dimensions: [],
  },
  {
    id: "employer-cite-93",
    stat: "93% of employers cite communication skills as essential when hiring and promoting.",
    implication: "Hiring managers screen for it; few candidates train for it.",
    source: "NACE Job Outlook Survey",
    dimensions: [],
  },
  {
    id: "productivity-loss-26k",
    stat: "Poor communication costs businesses over $26,000 per employee per year in productivity losses.",
    implication:
      "The downstream cost of unclear handoffs and missed asks adds up fast.",
    source: "SHRM / The Holmes Report",
    dimensions: ["clarity", "structure"],
  },
  {
    id: "workplace-failures-86",
    stat: "86% of employees cite ineffective communication as the primary cause of workplace failures.",
    implication: "When projects break, the fault line is usually a missed message.",
    source: "Salesforce / Fierce Inc.",
    dimensions: ["clarity", "structure", "thinking_quality"],
  },
  {
    id: "structured-story-46",
    stat: "46% of people cite 'creating a compelling, structured story' as the most challenging part of communication.",
    implication:
      "The skill people know they lack — and the one daily reps target directly.",
    source: "Cognify DNA spec, internal research synthesis",
    dimensions: ["structure", "thinking_quality"],
  },
  {
    id: "first-impression-7s",
    stat: "Listeners form a first-impression judgment of a speaker's competence within ~7 seconds.",
    implication:
      "The opening sentence does as much work as the next thirty combined.",
    source: "Princeton (Willis & Todorov 2006); business-comm replications",
    dimensions: ["delivery", "tone", "structure"],
  },
  {
    id: "attention-18min",
    stat: "Sustained verbal attention drops sharply after ~18 minutes — the design constraint behind the TED talk format.",
    implication:
      "Tight, structured reps are how you stay listenable when it counts.",
    source: "TED format research / cognitive-load literature",
    dimensions: ["conciseness", "structure"],
  },
  {
    id: "meeting-time-lost",
    stat: "Knowledge workers spend roughly a third of their meeting time correcting misunderstandings.",
    implication:
      "Most of that cost is preventable with cleaner first-pass communication.",
    source: "Multiple workplace-effectiveness studies (Atlassian, Slack)",
    dimensions: ["clarity", "conciseness"],
  },
  {
    id: "vocal-authority",
    stat: "Speakers who use intentional 1-2 second pauses are rated as significantly more confident than rapid talkers.",
    implication:
      "Pacing is a learnable signal — and the deterministic scorer can prove it lifted.",
    source: "Pacing & confidence research; Cognify deterministic scoring",
    dimensions: ["delivery", "tone"],
  },
];

/**
 * Pick `n` distinct stats biased toward the user's weakest dim when
 * known. Falls back to a stable rotation when no dim is supplied so
 * the surface doesn't show the same three stats every render.
 *
 * `seed` makes the rotation stable across SSR + hydration (use the
 * user id, the current ISO date, etc. — anything stable for the page
 * lifetime).
 */
export function pickStats(opts: {
  n: number;
  seed?: string;
  preferDimension?: SkillDimension;
}): DnaStat[] {
  const { n, seed, preferDimension } = opts;
  if (n <= 0) return [];
  // Score each stat by relevance to the preferred dim (1 if listed,
  // 0 otherwise) so dim-tagged stats float to the top when relevant.
  // Within the same relevance bucket, use a stable hash of the seed +
  // stat id to pick a deterministic order.
  const scored = DNA_STATS.map((s) => ({
    stat: s,
    relevance:
      preferDimension && s.dimensions.includes(preferDimension) ? 1 : 0,
    hash: stableHash(`${seed ?? ""}::${s.id}`),
  }));
  scored.sort((a, b) => {
    if (b.relevance !== a.relevance) return b.relevance - a.relevance;
    return a.hash - b.hash;
  });
  return scored.slice(0, Math.min(n, scored.length)).map((s) => s.stat);
}

function stableHash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
