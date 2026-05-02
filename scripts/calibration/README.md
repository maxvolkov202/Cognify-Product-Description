# Cognify calibration harness

This directory holds the reference rep bank used by `scripts/calibrate-scoring.mjs`
to assert the AI scorer matches our human (us) judgment within ±5 per
dimension and composite.

The harness is the **CI gate for the scoring prompt**. Any change to
`src/lib/ai/score.ts`, `src/lib/scoring/rubric.ts`, the dimension
weights, or the knowledge banks must keep the harness green. If a
deliberate prompt change moves a reference rep's expected score, update
the expected value in the same PR — never bypass the harness.

## File layout

```
scripts/calibration/
  reference-reps.json         # the bank — versioned, hand-authored
  reference-reps.schema.json  # JSON schema validating the bank
  README.md                   # this file
scripts/calibrate-scoring.mjs # the runner (one level up)
```

## Running locally

```bash
# Default: against dev server at 127.0.0.1:3333
node scripts/calibrate-scoring.mjs

# Against a deployed environment
DEV_BASE_URL=https://staging.cognify.app node scripts/calibrate-scoring.mjs

# Subset (substring match on rep id)
node scripts/calibrate-scoring.mjs --filter band-strong

# Machine-readable
node scripts/calibrate-scoring.mjs --json
```

Exit code 0 = all reps within tolerance. Exit code 1 = at least one rep
failed. Exit code 2 = config error (no DEV_BASE_URL, missing JSON, etc.).

## Two assertion modes

### `kind: "band"`

Asserts the AI's per-dimension and composite scores land within ±5 of
the expected values, AND that the band classification matches (off-by-one
allowed at boundaries — e.g. expected `competent` (60-75) actual `strong`
(75-85) at composite 76 is acceptable).

Used for: spanning the score bands (poor → exceptional). Each band gets
at least one rep so a regression in any region of the rubric trips the
harness.

### `kind: "independence"`

Asserts the AI scores dimensions INDEPENDENTLY — a rep can be high on
one and low on another within the same response. Each rep specifies a
list of `assertions`, each with a `kind` (`minScore` or `maxScore`), a
`dimension`, and a `min`/`max` threshold + `rationale`.

Used for: rigged scenarios that PROVE the AI isn't anchoring all
dimensions to the composite. Examples in the bank:

- Numbered scaffolding with circular reasoning → Structure ≥ 75 AND
  Thinking ≤ 55
- Brief, jargon-stacked explanation to a non-engineer → Conciseness ≥ 80
  AND Clarity ≤ 55

These are the inter-skill independence rules from DNA §"Inter-skill
interaction model."

## Adding new reference reps

The bank ships with a placeholder set covering all 6 bands + 2
independence assertions, but its real value comes from REAL recorded
reps with real audio. To extend:

1. **Record** the rep in the dev environment (gives you Deepgram
   word-level transcript automatically).
2. **Pull the transcript + duration** from the rep page network response.
3. **Score it ourselves** — assign per-dimension expected scores using
   the rubric in `src/lib/scoring/rubric.ts`. Be honest, not generous;
   the whole point is calibrating against an HONEST standard, not the
   AI's tendency to inflate.
4. **Add the entry** to `reference-reps.json` with `kind: "band"` (most
   common) or `kind: "independence"` (rigged inter-skill assertions).
5. **Optionally store the audio** in a Supabase `calibration-audio/`
   bucket and set `audioUrl` on the rep so the prosody worker is also
   exercised by the harness.
6. **Run the harness** — if it fails, the AI doesn't agree with our
   scoring. Either tune the prompt OR adjust expected values if our
   judgment was off.

Aim for 30 reference reps (5 per band) once we sit down to record
together. The placeholder set is enough to gate against catastrophic
regressions but is too small to catch finer drift.

## When a deliberate prompt change shifts scores

If you tune the prompt and expected scores need updating, do the work
in two steps:

1. Run the harness against the new prompt — note the actual scores per
   ref rep.
2. Decide for each ref rep: is the new score MORE accurate (we update
   `expected`) or LESS accurate (we tune the prompt back)?
3. Update `reference-reps.json` with the new `expected` values where
   the new score is the better one. Commit alongside the prompt change
   so reviewers see both moves together.

This protocol is what keeps the harness honest. Without step 2, every
prompt tune just rubber-stamps the current AI behavior.

## Wiring into CI

Add this step after the build job (example for GitHub Actions; adapt
to your CI of choice):

```yaml
- name: Calibration harness
  if: env.CALIBRATION_GATE_ENABLED != 'false'
  env:
    DEV_BASE_URL: ${{ secrets.STAGING_BASE_URL }}
  run: node scripts/calibrate-scoring.mjs
```

Set `CALIBRATION_GATE_ENABLED=false` only when there's a transient infra
issue blocking merges; restore as soon as the issue clears. Don't merge
prompt changes with the gate disabled.
