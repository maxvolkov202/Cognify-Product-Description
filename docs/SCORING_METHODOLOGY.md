# Cognify — Scoring Methodology

> **Status**: Phase A scaffolding. Full rubric to be landed in Phase D alongside provisional patent prep.
>
> **Owner**: The scoring model is the algorithmic core of Cognify's IP and the foundation of the measurability claim. This document must be the single source of truth for how reps are scored.

## Principles

1. **Transparent** — every callout explainable to an end user and to a patent examiner.
2. **Model-stable** — same rubric + same model version → same score for the same audio. Trend lines must reflect user improvement, not model drift.
3. **Transcript-anchored** — every sub-score and callout is tied to specific timestamps in the user's transcript. Click a callout → jump to that moment in the audio.
4. **Composable** — per-skill sub-scores roll up to a composite via user-configurable weights.
5. **Defensible** — each dimension has a definition, signal list, scoring function, and unit test coverage. No black-box scoring.

## The six dimensions

| # | Dimension | One-line definition | Primary signals (placeholder) |
| --- | --- | --- | --- |
| 1 | **Clarity** | Ideas land on the first hearing. | Sentence specificity, pronoun resolution, concrete vs abstract language, jargon density relative to audience |
| 2 | **Structure** | Visible scaffolding — opening, flow, close. | Framework-node adherence (scenario mode), logical connectors, opening/closing strength, topic cohesion |
| 3 | **Conciseness** | Maximum signal per word. | Filler rate, hedge rate, repetition rate, words-per-point, over/under time |
| 4 | **Thinking on the spot** | Coherent generation without preparation. | Pause distribution, backtrack count, topic drift, mid-sentence restarts |
| 5 | **Handling pressure** | Performance stability under constraints. | Pacing variance under timer, drop-off in final 25% of the rep, recovery after hesitation |
| 6 | **Adaptability** | Calibration to audience and constraints. | Audience-appropriate register, constraint compliance (time, tone), mid-rep adjustment (advanced) |

> Each cell in "Primary signals" is a placeholder until the Phase D rubric is finalized. The real list comes from (1) audio feature extraction via Deepgram's word-timestamped transcript + prosody metrics, (2) LLM-based semantic scoring via Claude Sonnet 4.6 with a structured output schema, (3) deterministic post-processing (filler counts, timing windows).

## The composite score

```
composite = Σ (dimension_score[i] × user_weight[i]) / Σ user_weight[i]
```

- Each sub-score is normalized to 0–100.
- Default weights: all 1.0 (equal). Users can re-weight per session or per goal.
- Composite is what appears on the home dashboard streak card and the progress line chart.

## The scoring pipeline (to be turned into a flow diagram for the patent)

```
Raw audio
   ↓
Upload to Vercel Blob
   ↓
Deepgram speech-to-text (word-level timestamps, prosody features)
   ↓
Deterministic signal extraction (filler counts, pacing, duration, pauses)
   ↓
Claude Sonnet 4.6 semantic scoring (structured output: per-dimension scores + callouts)
   ↓
(Scenario mode only) Framework adherence scoring: compare transcript → framework nodes
   ↓
Composite score via user weights
   ↓
Persist: rep row + scores rows + transcript rows + callouts rows
   ↓
Surface to user: score dials, transcript-anchored callouts, audio jump-to
```

## Why this is the IP

The algorithmic novelty is not any single step — it's the end-to-end loop:

1. **Structured input capture** (scenario + audience + key points + constraints)
2. **Framework generation** (picking or composing a thinking framework from a library)
3. **Timed voice rep** held against the framework
4. **Multi-dimensional scoring** with structural-adherence as a first-class dimension
5. **Transcript-anchored feedback** tied to improvement deltas
6. **Compounding progress loop** (spaced repetition + weakest-skill targeting)

The combination — framework-constrained rep + structural-adherence scoring + rep-to-rep diff + spaced-repetition scheduling — is what makes this a *training* system rather than an analysis tool. That combination is what the provisional patent will claim.

## Validation

External validation (the flagship measurability feature) is the human-in-the-loop check on the scoring model's accuracy.

- If the model says rep #5 is better than rep #1, but blind listeners rank them identically, the model is wrong.
- Continuous comparison of model-rank vs listener-rank → calibration signal for future rubric versions.
- Surfaces as a user-facing receipt: "4 of 5 unbiased listeners ranked your 5th rep as the clearest" — this is the pitch.

## Open questions (to resolve in Phase D)

- Exact filler-word lexicon per language (currently English only)
- Pacing normalization: fixed WPM bands or speaker-relative?
- Audience-appropriate register: how do we measure "executive-appropriate" vs "team-appropriate"?
- Adaptability is the hardest dimension to score objectively. May default to 0-weight in v2.
- Model versioning: every rubric change needs a migration plan so past scores stay comparable.

## Unit test requirements

Every dimension's scoring function must have:

- At least 3 canonical high-score examples (synthetic transcripts)
- At least 3 canonical low-score examples
- At least 3 edge cases (empty transcript, one-word response, over-time)
- Regression lock: if the scoring function changes, old tests fail loudly

Tests live in `tests/unit/scoring/`.
