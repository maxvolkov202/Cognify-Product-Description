# Taxonomy Migration Map — 34 sub-skills (DNA May 2026) → Hidden Skills v2 (PRD §5.5, D20)

Purpose: migrate `communication_profile.hiddenSkills` jsonb keys (and every code reference) from
the old 34-id taxonomy to the new 148-id taxonomy without losing user history. Machine-readable
copy lives in `scripts/taxonomy/migration-map.json` (consumed by the profile fold + drizzle
migration). Every old id maps to exactly ONE new id — score + sampleCount move over unchanged; if
the target key already exists (shouldn't happen on first run), the higher-sampleCount entry wins.

Doc note: dimension counts in the July 2026 PRD tables are Clarity 23, Structure 23, Conciseness
22, Thinking Quality 28, Pacing 22, Tone 30 = **148** (the tracker's "~149" was an estimate;
extraction verified against the tables 2026-07-15).

## Clarity

| Old id | New id | Kind | Rationale |
|---|---|---|---|
| `word_choice` | `vocabulary_precision` | rename | "Choosing the exact word" is the same lever. |
| `concreteness` | `concreteness` | keep | Same definition. |
| `audience_awareness` | `audience_calibration` | rename | Same lever, doc's term. |
| `idea_isolation` | `idea_isolation` | keep | Same definition. |
| `precision` | `lexical_specificity` | rename | Old id was driven by the concreteness/word-precision lexicon signal — closest new skill is "replacing vague language with sharper language". |
| `logical_sequencing` | `listener_first_sequencing` | rename | Ordering-for-the-listener is the doc's framing of the same skill. |

## Structure (all keep)

`opening_hook`, `signposting`, `argument_hierarchy`, `bottom_line_discipline` (label becomes
"Bottom-Line Discipline"), `narrative_arc`, `coherence` — all six old ids exist verbatim in v2.

## Conciseness

| Old id | New id | Kind |
|---|---|---|
| `filler_elimination` | `filler_reduction` | rename |
| `hedging_awareness` | `hedging_control` | rename |
| `repetition_control` | `repetition_control` | keep |
| `response_scoping` | `response_scoping` | keep |
| `editing_in_real_time` | `real_time_editing` | rename |

## Thinking Quality (all keep)

`claim_support`, `first_principles_reasoning`, `counterargument_awareness`, `depth_of_analysis`,
`intellectual_honesty`, `perspective_taking` — all six old ids exist verbatim in v2.

## Delivery (UI "Pacing")

| Old id | New id | Kind | Rationale |
|---|---|---|---|
| `rate_awareness` | `rate_awareness` | keep | |
| `strategic_pausing` | `strategic_pausing` | keep | Doc's "Strategic pausing (discrete yes/no)". |
| `filler_word_control` | `filler_to_pause_substitution` | rename | Delivery-side filler skill is now explicitly the pause-substitution behavior (text-side filler lives in Conciseness `filler_reduction`). |
| `rhythm_variation` | `rhythm_variation` | keep | |
| `pressure_management` | `pressure_pacing` | rename | Doc scopes it to pacing under pressure. |

## Tone — including cross-dimension moves

The v2 taxonomy moves vocal/prosodic mechanics out of Tone into Pacing (`delivery`); Tone v2 is
emotional/relational presence. Three old Tone ids therefore fold into `delivery` skills — the
profile fold moves the estimate to the new key regardless of dimension (hiddenSkills is a flat
map; dimension membership is derived from the id).

| Old id | New id | New dimension | Kind | Rationale |
|---|---|---|---|---|
| `pitch_variation` | `prosodic_alignment` | delivery | move+rename | Pitch/rhythm/stress mechanics are Pacing in v2. |
| `volume_control` | `emphasis_timing` | delivery | move+rename | Volume emphasis → "stressing the most important phrase". |
| `downward_inflection` | `confidence` | tone | rename | Downward inflection was our proxy for confident, declarative closure — v2 names the underlying quality. |
| `emotional_authenticity` | `emotional_authenticity` | tone | keep | |
| `vocal_presence` | `gravitas` | tone | rename | "Controlled presence" is the doc's definition of gravitas. |
| `warmth` | `warmth` | tone | keep | |

## Coverage check

- 34 old ids → 34 mappings (24 keep, 8 rename, 2 move+rename across dimension). No splits needed:
  no old id's historical signal genuinely spans two v2 skills tightly enough to justify duplicating
  its (score, sampleCount) evidence.
- 148 − 32 distinct targets = 116 new skills start with no history and accrue evidence from
  scoring attribution going forward (expected; the LLM attributes only skills it observed).

## Consumers that must apply this map

1. `communication_profile.hiddenSkills` jsonb keys — drizzle migration + `applyRepToProfile`
   guard (`SUB_SKILL_TO_DIMENSION` membership check silently drops unknown/old ids, so unmigrated
   rows would stop accruing — migration required, not optional).
2. `reps.dimension_scores.signals.subSkillScores` — historical rows keep old keys (read paths
   aggregate via `SUB_SKILL_TO_DIMENSION`, old keys simply stop matching; acceptable — profile is
   the estimate of record, and `getSubSkillStats` windows recent reps which will use new ids).
3. `src/lib/scoring/signals/sub-skill-mapper.ts` — signal → sub-skill destinations renamed.
4. `src/lib/ai/hints/index.ts` hint content keys, `src/lib/ai/exercises.ts` targetSubSkills,
   legacy prompt banks (`src/lib/ai/prompts/*` — retired in Phase 2 but must keep compiling).
5. Exercise catalog `hiddenSkills` tags (DB + JSON manifests) — re-tagged from scratch against
   v2 in Phase 1.3 rather than mapped, since 148 skills allow far more precise tags.
