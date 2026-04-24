# Proposal: Rubric v2.0.0 — Refactor Package

> **Status:** Proposal. Not to be landed until `DIMENSION_DECISION.md` is approved (D1–D5).
>
> **Purpose:** Ready-to-apply code changes for the WS-1 refactor. Once strategy signs off, this is a 1-day mechanical apply.
>
> **Pair reads:** `docs/DIMENSION_DECISION.md` (the decision itself), `docs/V2_STRATEGIC_PLAN.md` WS-1 (the workstream context).

---

## 1. Blast radius (pre-audit, 2026-04-23)

Grep for old dimension names (`\brelevance\b|\bconfidence\b|\bpacing\b|\btone\b`) returns **374 occurrences across 60 files**. Categories:

- **Core types & rubric** — `src/types/domain.ts`, `src/lib/scoring/rubric.ts`, `src/lib/scoring/signals.ts`, `src/lib/scoring/deterministic.ts`, `src/lib/scoring/framework-profiles.ts`
- **AI layer** — `src/lib/ai/rep-types.ts`, `src/lib/ai/score.ts`, `src/lib/ai/progression.ts`, `src/lib/ai/talking-points.ts`, `src/lib/ai/workout-prompts.ts`, `src/lib/ai/prompts/workout.ts`, `src/lib/ai/prompts/verticals.ts`
- **DB** — `src/lib/db/schema.ts` (Postgres enum `dimension`), `src/lib/db/queries/calibration.ts`
- **API routes** — `src/app/api/score/route.ts`, `src/app/api/score-internal/route.ts`, `src/app/api/progression/route.ts`, `src/app/api/knowledge/[dim]/route.ts`
- **Product components (18 files)** — FeedbackPanel, SkillRadar, SkillTrendChart, FeedbackRatingTile, WorkoutSession, CustomScenarioBuilder, TutorialClient, QuickRepFlow, BuildARepFlow
- **App routes** — `(app)/compare/[prompt]`, `(app)/settings/SettingsClient`, `onboarding/vertical`
- **Marketing (8 files)** — for-individuals, for-teams, about, about/references, help, ModesSection, PillarsSection, FeedbackSampleCard, ProgressChartMock, PracticeLoopMock
- **Knowledge base (13 MD files)** — `src/lib/ai/knowledge/**`: skills/{clarity,confidence,pacing,relevance,tone}.md, progression/{confidence,pacing,relevance,tone}.md, domains/{impromptu,negotiation,tough-feedback}.md, frameworks/{fab,adr}.md
- **Infra** — `src/lib/onboarding/constants.ts`, `src/lib/email/send.ts`, `src/lib/audio/transcribe.ts`, `src/lib/friends/mock-data.ts`, `src/lib/ai/knowledge/generated.ts`
- **Server actions** — `src/server/actions/reps.ts`

---

## 2. Known naming-collision hazard

⚠️ **The token `tone` has two distinct meanings in the codebase**:

1. **Dimension name** — one of six scoring dimensions (to be renamed to `adaptability`)
2. **Callout emphasis field** — `Callout.tone: "positive" | "neutral" | "warn" | "critical"` (stays unchanged; also `calloutToneEnum` in `schema.ts`)

Blind find-replace on `"tone"` will break callouts. Refactor MUST preserve `tone` as a field name where it represents emphasis; only rename when it's the dimension.

Grep pattern that's safe: `"tone"` with `dimension:` or `SkillDimension` in nearby lines. Unsafe: `"tone"` anywhere.

Mitigation: `Callout.tone` field gets renamed to `Callout.emphasis` in the same PR to eliminate ambiguity forever. Downstream `CalloutCorrectionRow` + `FeedbackPanel` adjust.

---

## 3. Proposed new `src/types/domain.ts`

```ts
// ——— Scoring dimensions (v2.0.0 rubric — WS-1 2026-04-23) ———————————
// Grouped into Content (what you said) and Delivery (how you said it).
// Dimension names aligned with strategy team + V2 mockups. Historical
// reps retain their original `rubric_version` tag; use the
// `src/lib/scoring/dimension-aliases.ts` helper to read them.
// See docs/SCORING_METHODOLOGY.md and src/lib/scoring/rubric.ts.

export const SKILL_DIMENSIONS = [
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "adaptability",
] as const;

export type SkillDimension = (typeof SKILL_DIMENSIONS)[number];

export const SKILL_DIMENSION_GROUPS = {
  content: ["clarity", "structure", "conciseness"],
  delivery: ["thinking_quality", "delivery", "adaptability"],
} as const satisfies Record<string, readonly SkillDimension[]>;

export type SkillDimensionGroup = keyof typeof SKILL_DIMENSION_GROUPS;

export const DIMENSION_LABELS: Record<SkillDimension, string> = {
  clarity: "Clarity",
  structure: "Structure",
  conciseness: "Conciseness",
  thinking_quality: "Thinking Quality",
  delivery: "Delivery",
  adaptability: "Adaptability",
};

export const DIMENSION_GROUP_LABELS: Record<SkillDimensionGroup, string> = {
  content: "Content",
  delivery: "Delivery",
};

export function getDimensionGroup(dim: SkillDimension): SkillDimensionGroup {
  if ((SKILL_DIMENSION_GROUPS.content as readonly string[]).includes(dim)) {
    return "content";
  }
  return "delivery";
}

export const MODE_IDS = ["daily_workout", "skill_lab", "scenario_training"] as const;
export type ModeId = (typeof MODE_IDS)[number];

// Callout.tone → Callout.emphasis (collision cleanup — see Proposal §2)
export type Callout = {
  dimension: SkillDimension | "structural_adherence";
  emphasis: "positive" | "neutral" | "warn" | "critical";
  title: string;
  body: string;
  quote: string | null;
  suggestedRewrite: string | null;
  transcriptStart: number;
  transcriptEnd: number;
};

export type DimensionScore = {
  dimension: SkillDimension;
  score: number;
  // ... existing fields preserved
};
```

---

## 4. Proposed new `src/lib/scoring/rubric.ts`

```ts
import type { SkillDimension } from "@/types/domain";

/**
 * Cognify scoring rubric — v2.0.0
 *
 * Six dimensions aligned with strategy team + V2 mockups (2026-04-23).
 * Renamed from v2-beta.2:
 *   - relevance → (absorbed into internal off-topic gate; see dimension-aliases.ts)
 *   - confidence → thinking_quality (generation coherence, not vocal composure)
 *   - pacing → delivery (absorbs pacing + vocal side of old tone)
 *   - tone → adaptability (audience calibration + mid-rep adjustment)
 *
 * Groupings: Content = {clarity, structure, conciseness},
 *            Delivery = {thinking_quality, delivery, adaptability}.
 *
 * Pacing/WPM/filler signals still extracted by signals.ts — they now feed
 * delivery (vocal control) and thinking_quality (hedging, restart count).
 * See docs/proposals/rubric-v2.0.0.md §7 for the full signal remap table.
 */

export const RUBRIC_VERSION = "v2.0.0";

export type DimensionGroup = "content" | "delivery";

export type DimensionRubric = {
  dimension: SkillDimension;
  group: DimensionGroup;
  definition: string;
  lowScoreSignals: readonly string[];
  highScoreSignals: readonly string[];
  defaultWeight: number;
  scoringStrategy: "llm" | "deterministic" | "hybrid";
};

export const DIMENSION_RUBRIC: Record<SkillDimension, DimensionRubric> = {
  // ——— Content ———————————————————————————————————————
  clarity: {
    dimension: "clarity",
    group: "content",
    definition:
      "Ideas land on the first hearing. No ambiguity. Concrete language, audience-appropriate vocabulary, resolved pronouns, main point stated early. The listener does not have to re-interpret.",
    lowScoreSignals: [
      "Unresolved pronouns (it, they, that) without clear referents",
      "Abstract nouns where concrete ones would work",
      "Jargon outside the target audience's register",
      "Listener-has-to-re-interpret moments",
    ],
    highScoreSignals: [
      "Concrete nouns and specific examples",
      "Audience-appropriate vocabulary",
      "Unambiguous pronoun resolution",
      "Main point stated in the first 10 seconds",
    ],
    defaultWeight: 1.0,
    scoringStrategy: "hybrid",
  },
  structure: {
    dimension: "structure",
    group: "content",
    definition:
      "Visible scaffolding — opening that establishes direction, logical flow connected by transitions, and a close that reinforces the main point.",
    lowScoreSignals: [
      "No visible opening or closing",
      "Topic jumps without connective tissue",
      "Missing transitions between points",
      "Random ordering of ideas",
    ],
    highScoreSignals: [
      "Clear opening that establishes direction",
      "Logical connectors between points (first, because, therefore)",
      "Consistent ordering (chronological, causal, or importance)",
      "Closing that lands the main point",
    ],
    defaultWeight: 1.0,
    scoringStrategy: "hybrid",
  },
  conciseness: {
    dimension: "conciseness",
    group: "content",
    definition:
      "Maximum signal per word. Low filler rate, low repetition, words-per-point discipline, within time budget. Tight sentences over bloated ones.",
    lowScoreSignals: [
      "High filler rate (> 4 per minute)",
      "Repeating the same point in different words",
      "Long preambles before getting to the point",
      "Over-time or under-time by >20% of budget",
      "Hedge-stacking that dilutes claims",
    ],
    highScoreSignals: [
      "Low filler rate (< 2 per minute)",
      "Each sentence advances the argument",
      "Finishes within 10% of time budget",
      "No repetition of ideas",
      "Tight word economy (words-per-point < 25)",
    ],
    defaultWeight: 1.0,
    scoringStrategy: "hybrid",
  },
  // ——— Delivery ——————————————————————————————————————
  thinking_quality: {
    dimension: "thinking_quality",
    group: "delivery",
    definition:
      "Coherent generation under real-time conditions. Low backtrack rate, low restart rate, logical chain holds, recall feels sharp. Measures the content of thinking, not vocal composure.",
    lowScoreSignals: [
      "Hedges: 'I think', 'maybe', 'kind of', 'sort of'",
      "Verbal backtracking: 'wait, let me start over'",
      "Long pauses (>2 seconds) outside natural breaks",
      "Mid-sentence restarts",
      "Logical chain breaks (conclusion doesn't follow premise)",
    ],
    highScoreSignals: [
      "Direct assertions without hedging",
      "Quick clean recovery from stumbles",
      "Logical connectors used correctly (because, therefore, so)",
      "Low restart count (< 1 per 30s)",
      "Purposeful pauses, not panicked ones",
    ],
    defaultWeight: 1.0,
    scoringStrategy: "hybrid",
  },
  delivery: {
    dimension: "delivery",
    group: "delivery",
    definition:
      "How it sounds. Pacing (stable WPM, purposeful pauses), rhythm, vocal energy, finishing cleanly within time. The craft of speech distinct from the content.",
    lowScoreSignals: [
      "Rushing in the final quartile",
      "Going significantly over or under time budget",
      "Voice tightening, pitch rising",
      "Rambling run-on sentences",
      "Monotone delivery across an emotional moment",
    ],
    highScoreSignals: [
      "Consistent WPM across rep quartiles",
      "Purposeful pauses for emphasis",
      "Finishes within time budget",
      "Final sentence lands cleanly",
      "Vocal variation matches the content stakes",
    ],
    defaultWeight: 1.0,
    scoringStrategy: "hybrid",
  },
  adaptability: {
    dimension: "adaptability",
    group: "delivery",
    definition:
      "Calibration to audience, constraints, and mid-rep cues. Register shifts for different listeners, adjusts when pushback or audience switch happens, stays responsive when the conversation deviates from the planned path.",
    lowScoreSignals: [
      "Same register regardless of audience",
      "Technical jargon to non-technical audience",
      "Ignoring stated tone or time constraints",
      "No visible adjustment after pushback or audience switch",
      "Defensive posture when challenged",
    ],
    highScoreSignals: [
      "Audience-appropriate vocabulary",
      "Visible register shift between two audiences",
      "Respects stated constraints (time, tone, format)",
      "Acknowledge-redirect-land pattern under pushback",
      "Emotionally attuned to the moment",
    ],
    defaultWeight: 0.9,
    scoringStrategy: "hybrid",
  },
};

export const ALL_DIMENSIONS: readonly SkillDimension[] = [
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "adaptability",
];

export const CONTENT_DIMENSIONS: readonly SkillDimension[] = [
  "clarity",
  "structure",
  "conciseness",
];

export const DELIVERY_DIMENSIONS: readonly SkillDimension[] = [
  "thinking_quality",
  "delivery",
  "adaptability",
];

/**
 * Weighted composite score across dimensions. User-configurable weights
 * override defaults; absent dimensions are excluded from both numerator
 * and denominator so partial scoring stays honest.
 *
 * The internal off-topic gate (previously `relevance`) applies AFTER this
 * function: if the rep is judged off-topic by the LLM, composite is
 * floored to 40. See scoring pipeline in docs/SCORING_METHODOLOGY.md.
 */
export function composite(
  scores: Partial<Record<SkillDimension, number>>,
  weights: Partial<Record<SkillDimension, number>> = {},
): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const dimension of ALL_DIMENSIONS) {
    const score = scores[dimension];
    if (score === undefined) continue;
    const weight =
      weights[dimension] ?? DIMENSION_RUBRIC[dimension].defaultWeight;
    weightedSum += score * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

export function groupComposite(
  scores: Partial<Record<SkillDimension, number>>,
  group: DimensionGroup,
  weights: Partial<Record<SkillDimension, number>> = {},
): number {
  const dims = group === "content" ? CONTENT_DIMENSIONS : DELIVERY_DIMENSIONS;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const dimension of dims) {
    const score = scores[dimension];
    if (score === undefined) continue;
    const weight =
      weights[dimension] ?? DIMENSION_RUBRIC[dimension].defaultWeight;
    weightedSum += score * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}
```

---

## 5. Proposed new `src/lib/scoring/dimension-aliases.ts`

New file. Provides safe reads of historical reps scored under `v2-beta.2`.

```ts
import type { SkillDimension } from "@/types/domain";

/**
 * Legacy dimension identifiers from rubric versions prior to v2.0.0.
 * Used only to read historical reps — never to write.
 */
export type LegacySkillDimension =
  | "clarity"           // unchanged
  | "structure"         // unchanged
  | "relevance"         // removed → internal gate only
  | "confidence"        // → thinking_quality
  | "pacing"            // → delivery
  | "tone";             // → adaptability

/**
 * Best-effort mapping from a legacy dimension name to its v2.0.0
 * equivalent. `relevance` has no user-facing successor — callers
 * rendering historical scores should either omit it or label it as
 * "Relevance (legacy metric)".
 */
export const LEGACY_TO_V2_DIMENSION: Partial<
  Record<LegacySkillDimension, SkillDimension>
> = {
  clarity: "clarity",
  structure: "structure",
  confidence: "thinking_quality",
  pacing: "delivery",
  tone: "adaptability",
  // relevance: intentionally absent
};

/**
 * Renders a rep's scores in the current dimension vocabulary, regardless
 * of the rubric version they were scored under. Used by SkillTrendChart
 * and Progress dashboard to avoid a dual-axis labeling mess.
 */
export function projectScoresToV2(
  rubricVersion: string,
  scores: Partial<Record<string, number>>,
): Partial<Record<SkillDimension, number>> {
  if (rubricVersion === "v2.0.0") {
    return scores as Partial<Record<SkillDimension, number>>;
  }
  // Treat anything older as v2-beta.*
  const projected: Partial<Record<SkillDimension, number>> = {};
  for (const [legacyDim, value] of Object.entries(scores)) {
    const v2Dim = LEGACY_TO_V2_DIMENSION[legacyDim as LegacySkillDimension];
    if (v2Dim !== undefined && value !== undefined) {
      projected[v2Dim] = value;
    }
  }
  return projected;
}

/**
 * Human-readable legacy dimension labels for rare surfaces that must
 * render old scores verbatim (debug / admin / compare views).
 */
export const LEGACY_DIMENSION_LABELS: Record<LegacySkillDimension, string> = {
  clarity: "Clarity",
  structure: "Structure",
  relevance: "Relevance (legacy)",
  confidence: "Confidence (legacy → Thinking Quality)",
  pacing: "Pacing (legacy → Delivery)",
  tone: "Tone (legacy → Adaptability)",
};
```

---

## 6. Proposed rep-type dimension remap

All 9 rep types, current → proposed. **Open question flagged** where Hunter's judgment needed.

| Rep Type          | Current primary  | Current secondary           | Proposed primary      | Proposed secondary                       | Rationale                                                                                 |
| ----------------- | ---------------- | --------------------------- | --------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `simplify`        | clarity          | structure, relevance        | clarity               | structure, conciseness                   | Feynman simplification = clarity + tight words.                                           |
| `structure`       | structure        | clarity, relevance          | structure             | clarity, conciseness                     | Clean scaffolding, no bloat.                                                              |
| `think_fast`      | confidence       | clarity, pacing             | **thinking_quality**  | clarity, delivery                        | No-prep = pure Thinking Quality test.                                                     |
| `be_concise`      | pacing           | clarity, relevance          | **conciseness**       | clarity, delivery                        | Time-constrained = Conciseness.                                                           |
| `reinforce`       | clarity          | structure, pacing           | clarity               | structure, delivery                      | Teach-back: clear + paced steps.                                                          |
| `persuade`        | relevance        | structure, tone             | **adaptability**      | structure, conciseness                   | Elevator pitch = read the listener + tight case. ⚠️ Alternative: primary=conciseness.     |
| `adapt`           | tone             | clarity, relevance          | **adaptability**      | clarity, conciseness                     | Two-audience reframe = flagship Adaptability.                                             |
| `deliver`         | pacing           | confidence, tone            | **delivery**          | thinking_quality, adaptability           | Pause + pace + vocal = Delivery.                                                          |
| `handle_pressure` | confidence       | relevance, tone             | **adaptability**      | thinking_quality, delivery               | Pushback = adaptive response. ⚠️ Alternative: primary=thinking_quality (WS-3 expands).    |

**Distribution after remap:**
- clarity: 2 primary (simplify, reinforce)
- structure: 1 primary (structure)
- conciseness: 1 primary (be_concise)
- thinking_quality: 1 primary (think_fast)
- delivery: 1 primary (deliver)
- adaptability: 3 primary (persuade, adapt, handle_pressure)

**Concern:** 3 rep types land on Adaptability as primary. If that feels imbalanced, flip `handle_pressure` to primary=`thinking_quality` — both arguable. WS-3 (Pressure System) will further diversify the pressure-rep surface, so Adaptability's 3-count becomes less of a skew.

**Open question for Hunter:** Does `persuade` primary = adaptability or conciseness feel right? Elevator pitch has a strong case for either. Recommendation: adaptability (because persuasion IS reading your audience).

---

## 7. Proposed signal → dimension mapping (`signals.ts` remap)

`signals.ts` itself is untouched — it just extracts values. What changes is which dimension consumes each signal in the LLM scoring prompt.

| Signal (from `SignalBundle`)              | v2-beta.2 consumer | v2.0.0 consumer         | Rationale                              |
| ----------------------------------------- | ------------------ | ----------------------- | -------------------------------------- |
| `fillerCount`, `fillerRate`               | pacing             | **conciseness + delivery** | Filler is a bloat problem (conciseness) + a vocal tell (delivery). Slight double-count, documented. |
| `hedgeCount`, `hedgeRate`                 | confidence         | **thinking_quality**    | Hedge = weak generation.               |
| `wpm`, `quartileWpm`, `quartileWpmVariance` | pacing           | **delivery**            | WPM discipline = Delivery.             |
| `longPauseCount`, `pauseP50Ms`, `pauseP95Ms` | pacing          | **delivery + thinking_quality** | Purposeful pauses (delivery) vs panic pauses (thinking_quality). LLM disambiguates. |
| `stallCount`                              | confidence         | **thinking_quality**    | Stall = generation failure.            |
| `restartCount`                            | confidence         | **thinking_quality**    | Same.                                  |
| `finalQuartileDelta`                      | pacing (pressure)  | **delivery**            | Finishing strong = delivery craft.     |
| `timeBudgetRatio`                         | pacing             | **conciseness**         | Time discipline = Conciseness.         |

---

## 8. DB migration

Postgres enum `cognify_v2.dimension` currently has: `["clarity", "structure", "relevance", "confidence", "pacing", "tone", "structural_adherence"]`.

**Two-phase migration** to preserve historical reads:

```sql
-- Phase A (pre-deploy): add new values alongside old
ALTER TYPE cognify_v2.dimension ADD VALUE IF NOT EXISTS 'conciseness';
ALTER TYPE cognify_v2.dimension ADD VALUE IF NOT EXISTS 'thinking_quality';
ALTER TYPE cognify_v2.dimension ADD VALUE IF NOT EXISTS 'adaptability';
-- delivery, clarity, structure already exist

-- Phase B (post-deploy, when safe):
-- DO NOT delete old values. Historical reps reference them.
-- Just stop writing to: confidence, pacing, tone, relevance.
```

**Critical:** Never `DROP VALUE` from the enum — historical rep rows reference `confidence`/`pacing`/`tone`/`relevance` forever. They're frozen, not retired.

Also: bump `rubric_version` column default from `v2-beta.2` to `v2.0.0` in `sessions` table.

**Drizzle Kit step:** Manual SQL (Drizzle Kit doesn't handle enum value addition cleanly). Hand-rolled migration in `supabase/migrations/` following existing convention.

---

## 9. LLM prompt changes (`src/lib/ai/score.ts`)

The scoring prompt references the 6 dimensions by name. Key change: replace the 6 definitions with the new ones (from §4 `DIMENSION_RUBRIC`) and update the structured output schema.

```ts
// Zod schema for Claude structured output (before)
const scoreSchema = z.object({
  scores: z.object({
    clarity: z.number().min(0).max(100),
    structure: z.number().min(0).max(100),
    relevance: z.number().min(0).max(100),
    confidence: z.number().min(0).max(100),
    pacing: z.number().min(0).max(100),
    tone: z.number().min(0).max(100),
  }),
  callouts: z.array(calloutSchema).max(3),
  isOffTopic: z.boolean(),  // legacy hidden signal
});

// After
const scoreSchema = z.object({
  scores: z.object({
    clarity: z.number().min(0).max(100),
    structure: z.number().min(0).max(100),
    conciseness: z.number().min(0).max(100),
    thinking_quality: z.number().min(0).max(100),
    delivery: z.number().min(0).max(100),
    adaptability: z.number().min(0).max(100),
  }),
  callouts: z.array(calloutSchema).max(3),
  isOffTopic: z.boolean(),  // now drives the composite floor (replaces relevance as user-facing dim)
});
```

Prompt body edits: inline the new dimension definitions from §4 into the scoring instructions. Explicit instruction: "Never write 'Good job'. Each callout must cite a transcript quote + timestamp + dimension." (Also satisfies WS-4 Phase 4.1.)

---

## 10. Knowledge base MD files

`src/lib/ai/knowledge/skills/{clarity,confidence,pacing,relevance,tone}.md` and progression/*.md — 13 files.

**Action:** rename files + rewrite content to match new dimension definitions.
- `skills/confidence.md` → `skills/thinking_quality.md`
- `skills/pacing.md` → `skills/delivery.md`
- `skills/tone.md` → `skills/adaptability.md`
- `skills/relevance.md` → delete or move to `skills/_legacy/relevance.md` (retained for historical reps)
- Add new: `skills/conciseness.md`
- `progression/*` — same pattern

`build-knowledge.mjs` script regenerates `src/lib/ai/knowledge/generated.ts` from the MD files. Will pick up renames automatically once MD files are updated.

---

## 11. UI labels — component-by-component checklist

Each item: grep the component for old names, replace with new labels. Confirm `DIMENSION_LABELS` from `domain.ts` is the single source of truth.

- [ ] `src/components/product/FeedbackPanel.tsx` (14 occurrences)
- [ ] `src/components/product/SkillRadar.tsx` (8 occurrences) — chart axes
- [ ] `src/components/product/SkillTrendChart.tsx` (4 occurrences) — use `projectScoresToV2` helper for historical reps
- [ ] `src/components/product/FeedbackRatingTile.tsx` (6 occurrences)
- [ ] `src/components/product/WorkoutSession.tsx` (2 occurrences)
- [ ] `src/components/product/CustomScenarioBuilder.tsx` (2 occurrences)
- [ ] `src/components/product/TutorialClient.tsx` (1 occurrence)
- [ ] `src/components/product/QuickRepFlow.tsx` (9 occurrences)
- [ ] `src/components/product/BuildARepFlow.tsx` (1 occurrence)
- [ ] `src/components/product/CalloutCorrectionRow.tsx` — rename `Callout.tone` → `Callout.emphasis`
- [ ] `src/components/marketing/FeedbackSampleCard.tsx` (7) — sample feedback in marketing
- [ ] `src/components/marketing/ModesSection.tsx` (1)
- [ ] `src/components/marketing/PillarsSection.tsx` (1)
- [ ] `src/components/marketing/PracticeLoopMock.tsx` (1)
- [ ] `src/components/marketing/ProgressChartMock.tsx` (2)

**Marketing pages:**
- [ ] `src/app/(marketing)/for-individuals/page.tsx`
- [ ] `src/app/(marketing)/for-teams/page.tsx` — WS-9 also touches this; coordinate
- [ ] `src/app/(marketing)/about/page.tsx`
- [ ] `src/app/(marketing)/about/references/page.tsx`
- [ ] `src/app/(marketing)/help/page.tsx`
- [ ] `src/app/(marketing)/how-it-works/page.tsx` (not in grep count but likely has labels)

**App routes:**
- [ ] `src/app/(app)/compare/[prompt]/page.tsx` — side-by-side reps from different rubric versions: use `projectScoresToV2`
- [ ] `src/app/(app)/settings/SettingsClient.tsx`
- [ ] `src/app/onboarding/vertical/page.tsx`
- [ ] `src/app/api/score/route.ts`, `src/app/api/score-internal/route.ts`, `src/app/api/progression/route.ts`
- [ ] `src/app/api/knowledge/[dim]/route.ts` — dim param validator needs new union

---

## 12. Tests to write

- [ ] `tests/unit/scoring/rubric.test.ts` — composite math unchanged, group composite correct
- [ ] `tests/unit/scoring/dimension-aliases.test.ts` — `projectScoresToV2` on a synthetic `v2-beta.2` row + a `v2.0.0` row
- [ ] `tests/unit/scoring/off-topic-gate.test.ts` — if `isOffTopic: true`, composite floors to 40
- [ ] `tests/unit/ai/score-prompt.test.ts` — prompt contains all 6 new dimension names, zero old names
- [ ] `tests/fixtures/canonical-transcripts/*.json` — 6 canonical transcripts (one high-score per dimension); assert signal-to-dimension mapping correct

---

## 13. Apply order (the 1-day refactor sequence)

Run in this order on `supabase-migration` branch:

1. **Schema migration** — `supabase/migrations/0XXX_rubric_v2_dimensions.sql` (Phase A from §8)
2. **Types first** — `src/types/domain.ts` (drives everything)
3. **Rubric** — `src/lib/scoring/rubric.ts`, new `src/lib/scoring/dimension-aliases.ts`
4. **Scoring wiring** — `src/lib/scoring/signals.ts` (no file change — just confirm still compiles), `src/lib/scoring/deterministic.ts`, `src/lib/scoring/framework-profiles.ts`
5. **Rep types** — `src/lib/ai/rep-types.ts` (primary/secondary from §6)
6. **AI scoring** — `src/lib/ai/score.ts` prompt + schema; also `progression.ts`, `talking-points.ts`, `workout-prompts.ts`, `prompts/workout.ts`
7. **Knowledge base rename + regen** — MD files + `npm run build:knowledge`
8. **Server actions + API routes** — `src/server/actions/reps.ts`, all 4 `src/app/api/*` routes
9. **Components** — product components first (feedback-adjacent), marketing components, pages
10. **Tests** — add the 5 test files from §12; confirm green
11. **Typecheck + lint** — must pass before push
12. **One-time in-app note** — copy: "We renamed the six dimensions today to make them sharper. Your past scores are unchanged — just the labels got tighter."

---

## 14. Risks beyond the decision itself

- **R-R1** `tone` token collision causes regression (Callout.tone broken). **Mitigation:** explicit rename in §3; grep for `dimension` nearby when touching `tone`.
- **R-R2** Postgres enum values accidentally dropped → historical reads break. **Mitigation:** never `DROP VALUE`; document in migration comment.
- **R-R3** Knowledge MD renames break `build-knowledge.mjs` cache → prod ships with stale knowledge. **Mitigation:** regenerate explicitly post-rename; check `generated.ts` diff.
- **R-R4** LLM scores differently under new rubric even though definitions are "the same idea" — trend lines show a discontinuity. **Mitigation:** RUBRIC_VERSION tag forever on each rep; charts use `projectScoresToV2`; add a visible version-change marker on trend charts (vertical line at rubric rollout date).
- **R-R5** Post-rename users don't recognize their dashboard. **Mitigation:** in-app note + one-month grace period where hover-tooltips show "(previously Confidence)".

---

## 15. What this proposal does not decide

- WS-3 pressure archetype naming (separate workstream)
- WS-4 feedback taxonomy beyond the prompt-level guarantee (also lands in §9)
- WS-5 UI visuals for the new dimension badges
- Whether to open-source the rubric (separate IP question)
- Calibration regression against validation data (backlog; requires validation volume)
