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
