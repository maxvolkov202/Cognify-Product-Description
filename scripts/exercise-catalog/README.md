# Exercise Catalog v1

Authoring source for the muscle-group adventure-path product
(see `plans/muscle-group-pivot-progress.md`).

## Layout

One JSON file per muscle group, all under `v1/`:

```
scripts/exercise-catalog/
├── README.md
└── v1/
    ├── clarity.json
    ├── structure.json
    ├── conciseness.json
    ├── thinking_quality.json
    ├── pacing.json
    └── tone.json
```

The seed script (`scripts/seed-exercise-catalog.mjs`) reads all six
files, validates them as a single manifest, and upserts into
`cognify_v2.exercises` + `cognify_v2.exercise_prompts`.

> **Why per-dim files** instead of one monolithic `v1.json`? The plan
> ships ≥9 exercises × ≥15 prompts × 6 dims = 800+ prompt entries.
> Splitting by dim keeps each file viewable, diff-able, and editable
> by one author per dim (matches the "one author per dim, not parallel
> crowdsource" risk note in the plan).

## File shape

```json
{
  "version": "v1",
  "exercises": [
    {
      "dimension": "clarity",
      "name": "Explain Like I'm 12",
      "rule": "No word a 12-year-old wouldn't recognize.",
      "why": "Forces concrete language; surfaces hidden jargon.",
      "default_difficulty": "core",
      "ordering": 1,
      "tags": ["dna-v1"],
      "prompts": [
        { "text": "Explain how OAuth works.", "difficulty": "intro", "tags": ["tech"] },
        { "text": "Explain compound interest.", "difficulty": "core", "tags": ["finance"] }
      ]
    }
  ]
}
```

## Field → DB column mapping

| Manifest field         | DB column                                   | Notes                                                          |
|------------------------|---------------------------------------------|----------------------------------------------------------------|
| `name`                 | `exercises.name`                            | Unique within `(dimension, name)`.                             |
| `rule`                 | `exercises.description`                     | The user-facing rule. Phase 6 reads this as "exercise rule".   |
| `why`                  | `exercises.instructions`                    | Station-card body copy (the "why this drill matters").         |
| `ordering`             | `exercises.sort_order`                      | Unique within dim.                                             |
| derived `slugify(name)`| `exercises.slug`                            | Stable. Used to build `prompt_id`s.                            |
| `default_difficulty`   | (seed-time default for prompts)             | Not stored on `exercises` directly.                            |
| `tags` (on exercise)   | (authoring metadata only)                   | Not stored.                                                    |
| `prompts[*].text`      | `exercise_prompts.prompt_text`              | ≤200 chars.                                                    |
| `prompts[*].difficulty`| `exercise_prompts.difficulty` (1\|2\|3)      | Mapping: intro=1, core=2, stretch=3. Falls back to exercise's `default_difficulty`. |
| `prompts[*].tags`      | `exercise_prompts.tags` (jsonb)             | Free-form array.                                               |
| derived                | `exercise_prompts.prompt_id`                | `${exerciseSlug}-${sha8(normalizedText)}` — stable id.         |

### Exercise Framework fields (PRD v3 Phase 2.2, migration 0029) — all optional

| Manifest field      | DB column                     | Notes |
|---------------------|-------------------------------|-------|
| `objective`         | `exercises.objective`         | The single communication objective this framework trains. Leads on the Insight screen when no `coach_insight`. |
| `hidden_skills`     | `exercises.hidden_skills`     | 2-3 sub-skill ids from the exercise's dimension (`src/types/sub-skills.ts`). Drives Hidden-Skill-aware selection. |
| `scoring_lens`      | `exercises.scoring_lens`      | Operator-facing rubric constraint ("Constraint: …"). Wins over code-side EXERCISE_RUBRIC_HINTS. |
| `retry_objective`   | `exercises.retry_objective`   | What the required Retry targets when the rule was broken. |
| `prompt_rules`      | `exercises.prompt_rules`      | Rules for AI prompt generation from this framework (Phase 8). |
| `response_window`   | `exercises.response_window`   | `{"min_sec": N, "max_sec": N}`, 10 ≤ min < max ≤ 300 (ADR-001 count-up band). |
| `constraint_types`  | `exercises.constraint_types`  | Subset of time \| structure \| tone \| complexity \| none. First non-none renders as the Insight screen's constraint chip. |

### Lab Engine V1 pack fields (Phase 11.D2/D3, migration 0035) — all optional

| Manifest field          | DB column                          | Notes |
|-------------------------|------------------------------------|-------|
| `coach_insight`         | `exercises.coach_insight`          | 1-2 sentence pre-rep cue ("what great looks like + the trap"); LEADS on the Insight screen, rule becomes the enforcement line. ≤240 chars, no theory names. |
| `secondary_core_skills` | `exercises.secondary_core_skills`  | 1-2 Core Skill dims ≠ the primary `dimension` (validator rejects the primary). Rendered as SECONDARY DIMENSIONS in the scoring block. |
| `common_failure_modes`  | `exercises.common_failure_modes`   | 3-4 short transcript-observable failures; the scorer names the one it saw (never invents). |
| `scoring_emphasis`      | `exercises.scoring_emphasis`       | One evaluator-attention line; rides the stage-2 hint block. Complements, never repeats, `scoring_lens`. |

All framework/pack fields render into scoring prompts ONLY when authored,
so pre-enrichment rows keep byte-identical prompts (calibration guardrail).

### Application exercises — `applications/*.json` (PRD v3 Phase 4, migration 0031)

One file per Skill Lab application (`storytelling`, `presenting`,
`teaching`, `interviewing`, `persuasion`), same shape as the core files
plus two required fields:

| Manifest field       | DB column                     | Notes |
|----------------------|-------------------------------|-------|
| `application`        | `exercises.application`       | The ApplicationId; `dimension` holds the exercise's PRIMARY Core Skill so the scoring pipeline is unchanged. Daily-workout queries filter `application IS NULL`. |
| `application_skills` | `exercises.application_skills`| Non-empty subset of that app's canonical 8 (D11) in `src/types/application-skills.ts` (seed script mirrors it — keep in sync). |

Application banks may start slimmer: ≥12 prompts per exercise
(`APP_PROMPT_MIN`) vs ≥15 for core.

## Voice rules

### Exercise `rule`
- Imperative or present-tense constraint.
- ≤12 words.
- "No throat-clearing — first word is load-bearing."
- "Every claim followed by a concrete example."

### Exercise `why`
- One sentence. Plain English. Names the learning gain.
- "Forces concrete language; surfaces hidden jargon."

### Prompts
- ≤200 chars (mobile card constraint).
- Imperative or scenario framing the user speaks against.
- Concrete topic, not abstract. Mix domains across the bank:
  tech, business, finance, healthcare, leadership, education,
  personal/relationships, creative.
- Difficulty mix per exercise (rough target for a 15-prompt bank):
  - 4 intro (warm-up, low cognitive load topics)
  - 8 core (default difficulty, real-world breadth)
  - 3 stretch (high pressure, unfamiliar domain, or extra constraint)

## Canonical muscle groups (6)

```
clarity, structure, conciseness, thinking_quality, pacing, tone
```

`pacing` is enum-legacy in the database (the canonical dim enum was
restructured around `delivery` in v3) but is **explicitly chosen as a
muscle group** by the product team. The seed script writes
`dimension='pacing'` against the existing enum value. Scoring-side
aliasing (Phase 8) reconciles this with the canonical 6 dims for
analytics + retrieval. See plan decisions log.

## Difficulty taxonomy

- `intro`  → DB `difficulty = 1` — short, low-stakes, warm-up.
- `core`   → DB `difficulty = 2` — default rep, broad domain coverage.
- `stretch`→ DB `difficulty = 3` — heavier topics or extra constraint.

## Running the seed

```bash
# Validate the manifest, see per-dim summary, write nothing
node scripts/seed-exercise-catalog.mjs --dry-run

# Apply (idempotent; re-run is a no-op for unchanged content)
node scripts/seed-exercise-catalog.mjs --apply

# Apply only one dim (useful when iterating on a single dim's content)
node scripts/seed-exercise-catalog.mjs --dim pacing --apply
```

Validation errors exit non-zero so CI can gate the manifest.

## Idempotency

- `exercises` upsert keys on `(dimension, name)` (DB constraint
  `exercises_dimension_name_uniq`). Re-running with the same content
  is a no-op; renaming an exercise in-place will create a new row
  (and orphan the old one unless `is_active=false` is set manually).
- `exercise_prompts` upsert keys on `prompt_id`, which is derived from
  `${exerciseSlug}-${sha8(normalizedText)}`. Editing a prompt's text
  in the manifest produces a new `prompt_id`, leaving the original row
  intact. Use `UPDATE ... SET is_active=false` to retire old rows if
  needed (no automatic deactivation).

## Future expansions (out of scope for v1)

- Embeddings on prompt text for similarity-based deduplication.
- Catalog admin UI for non-engineering authors.
- A `v2/` directory + version bump field on rows so retired prompts
  can be archived rather than deleted.
