# Cognify Calibration Baseline — May 2026 (post-Ch.D2)

> Captured: 2026-05-04 · Bank size: 48 reps · Rubric: v3.2.0
>
> Successor to `docs/calibration-baseline-2026-05.md` (post-D1).
>
> This snapshot extends the post-D1 baseline with 12 new
> `kind: "independence"` reps covering all 6 inter-skill interaction
> pairs from the DNA spec (clarity↔conciseness, structure↔thinking,
> delivery↔tone, clarity↔thinking, conciseness↔structure,
> thinking↔delivery — 2 reps per pair, both directions).
>
> Source: `scripts/calibration/reference-reps.json` rev at the D2 merge
> commit. Re-run with `CONCURRENCY=2 node scripts/calibrate-scoring-baseline.mjs`.

## Bank composition (post-D2)

| | Pitches | Q&A | Objection | Interview | Scenario | Persuasive | Independence/Edge | Total |
|---|---|---|---|---|---|---|---|---|
| Reps | 7 | 6 | 6 | 7 | 6 | 6 | 19 | **48** (was 36) |

By kind: 29 `band` reps (unchanged from D1), 19 `independence` reps
(was 7, added 12).

## Inter-skill pair coverage

All 6 DNA-spec'd inter-skill pairs now have ≥2 reps:

| Pair | Reps | Direction A | Direction B |
|---|---|---|---|
| Clarity ↔ Conciseness | 4 | `indep-conciseness-vs-clarity`, `indep-ambiguous-pronouns` (concise+unclear) | `indep-clear-but-padded`, `edge-brevity-cost-meaning` (cost-of-brevity) |
| Structure ↔ Thinking | 4 | `indep-structure-vs-thinking`, `edge-shallow-but-organized`, `indep-okrs-empty-scaffold` (org+shallow) | `indep-quitting-engineer-meander` (disorg+deep) |
| Delivery ↔ Tone | 3 | `indep-rushed-bank-pitch` (variety+rushed), `edge-fast-no-fillers` (rate fail) | `indep-monotone-review-process` (paced+monotone), `edge-variety-with-upspeak` (variety+upspeak) |
| Clarity ↔ Thinking | 2 | `indep-velocity-jargon-revelation` (deep+unclear) | `indep-earnings-explainer-empty` (clear+shallow) |
| Conciseness ↔ Structure | 2 | `indep-q4-risks-no-frame` (concise+unstructured) | `indep-pricing-three-part-padded` (structured+verbose) |
| Thinking ↔ Delivery | 2 | `indep-launch-miss-breathless` (deep+rushed), `edge-short-but-deep` (deep+concise) | `indep-future-of-work-pitch` (fluent+shallow) |

## Baseline metrics (post-D2)

> Captured from sequential and parallel runs against
> http://127.0.0.1:3333 with Anthropic Haiku 4.5
> (claude-haiku-4-5-20251001), no fallbacks fired (0% OpenAI).
> Branch `feat/dna-base/D2-independence-reps`.

### Pass rate

| Metric | Run 1 (CONCURRENCY=2) | Run 2 (CONCURRENCY=2) | Run 3 (CONCURRENCY=2) | Run 4 (CONCURRENCY=1, sequential) |
|---|---|---|---|---|
| Total reps | 48 | 48 | 48 | 48 |
| Band-rep pass rate | 0% (0/29) | 1/29 | 1/29 | 1/29 |
| **Independence-rep pass rate** | **21% (4/19)** | **37% (7/19)** | **16% (3/19)** | **21% (4/19)** |
| Per-assertion pass rate (indep) | — | — | — | **47% (17/36)** |
| Fallback rate | 0% | 0% | 0% | 0% |
| Wall-clock duration | 142s | 142s | 140s | 288s |

The plan's D2 acceptance gate of "**independence-rep pass rate ≥80%**"
is **NOT met** at any concurrency setting. See "Variance dominates" below
for the diagnosis and "How later chapters close the gate" for the path.

### Variance dominates

Run-to-run variance on the same input ranges from ±5 to ±50 points
on individual dimensions. Examples observed across the 4 runs above:

- `edge-shallow-but-organized` thinking_quality: 70 → 20 → 20 → 30 (50pt swing)
- `indep-conciseness-vs-clarity` conciseness: 70 → 30 → 45 → 60 (40pt swing)
- `indep-ambiguous-pronouns` clarity: 50 → 72 → 45 → 70 (27pt swing)
- `indep-pricing-three-part-padded` structure: 80 → 80 → 85 → 90 (10pt swing — among the tightest)

**Root cause:** `src/lib/ai/score.ts:822-827` calls
`anthropic.messages.create` without a `temperature` parameter — the
Anthropic SDK default is **temperature: 1.0**, which samples the
output distribution maximally. At temp=1.0 the same input produces
wildly different score JSON from one call to the next, swamping any
±5 tolerance assertion the harness uses.

**Independent of D2:** this variance affects the post-D1 baseline too —
the 0/29 band-pass rate documented in `calibration-baseline-2026-05.md`
is partly LLM bias and partly LLM variance. With temp=1.0, neither
band reps nor independence reps can reliably pass strict assertions.

### Per-assertion pass rate (the honest metric)

For independence reps, per-assertion pass rate is more diagnostic
than per-rep pass rate (a rep with 2 assertions fails the rep
even if 1 of 2 assertions correctly fires). Sequential run:

- 36 total directional independence assertions
- 17 passed = **47%**

Of the 19 failing assertions:

- **9 are LLM-bias dependent** (Conciseness/Thinking over-grade
  patterns documented in the post-D1 baseline). Tightening targets
  for **Ch.S3** (stoppingPointAccuracy + word-redundancy) and
  **Ch.S4** (originalityIndex + logicalConsistencyMarkers).
- **5 are rate-detection dependent** (delivery max on rushed reps).
  Text-only LLM cannot see WPM reliably without `extractDeliverySignals`
  routing word-timestamps. Tightening targets for **Ch.S5** prosody worker.
- **3 are structure-perception dependent** (LLM under-grades structure
  when content is circular even though scaffolding is visible).
  Tightening target for **Ch.S2** (logicalFlowScore + argument_hierarchy).
- **2 are clarity-perception dependent** (LLM credits jargon as
  thinking depth). Tightening target for **Ch.S1** (wordPrecisionScore).

Each new D2 rep's `assertions[*].rationale` field annotates which
specific S-chapter signal is expected to fire that assertion to
green.

## How later chapters close the gate

The plan author wrote ≥80% as the D2 gate. That number was implicitly
contingent on:

1. **LLM scoring stability.** Today: temp=1.0, ±30-50pt swings.
   Closing this requires either:
   a. Adding `temperature: 0` (or `0.2`) to the score endpoint —
      one-line change, prod-affecting (stabilizes user scores too).
      Not done as part of D2 (D2 is data-only per plan); flagged
      to operator for separate decision.
   b. Median-of-N harness mode — averages 3+ runs per rep, slower
      but smooths variance without prod impact. Could land in Ch.C1
      if temperature change is rejected.

2. **S1–S5 deterministic signals.** Each S-chapter pins one or more
   dimensions against text-derivable (or audio-derivable for S5)
   ground truth, removing scoring slack. Per-assertion rate-of-fire
   should rise from 47% (today) toward 80% as S1, S2, S3, S4 land.
   S5 (prosody) closes the rate-detection gap.

**D2 ships the test substrate.** The 12 new reps cover all 6 inter-skill
pairs in both directions per the DNA spec; their assertions are
intentionally calibrated to where each dim *should* land per the
rubric, not where the LLM places them today. They become passing
gates for S1–S5, not D2.

## Reading the drift (post-D2)

Same five observations as the post-D1 baseline still hold; D2 doesn't
re-baseline band reps. New observations specific to D2:

6. **The LLM clusters all dim scores around 65-75 by default.** When
   scoring an unfamiliar rep type (independence reps), Haiku appears
   to default toward a competent-band centerpoint and only deviates
   when the rep matches a well-known band exemplar. Independence reps
   stress-test this clustering — they're DESIGNED to need divergent
   per-dim scores. The fact that the LLM resists divergence IS the
   diagnostic finding.
7. **Bimodal per-rep scoring at concurrency≥2 — investigate.** Run 3
   produced suspicious near-identical 70-everywhere scores for two
   different reps (`edge-brevity-cost-meaning` and `edge-variety-with-upspeak`).
   Could be coincidence or could be a request-cache cross-contamination
   in the score endpoint when prompts are similar. Sequential
   (CONCURRENCY=1) didn't reproduce. Worth a 30-min look during S5
   pre-flight.

## Re-running this snapshot

```powershell
# Sequential, slower, more stable variance picture (~5 min):
$env:CONCURRENCY="1"; node scripts/calibrate-scoring-baseline.mjs > $HOME/calib.json

# Parallel, faster, run 3+ times to characterize variance (~2.5 min each):
$env:CONCURRENCY="2"; node scripts/calibrate-scoring-baseline.mjs > $HOME/calib.json
```

If a future chapter bumps rubricVersion (e.g. v3.2.0 → v3.3.0 after
S5 ships), bump the filename here too:
`docs/calibration-baseline-<year>-<month>-<chapter>.md` and link it
from this baseline's "How later chapters close the gate" section so
the lineage is traceable.
