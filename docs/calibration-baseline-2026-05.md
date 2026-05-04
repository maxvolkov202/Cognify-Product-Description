# Cognify Calibration Baseline — May 2026 (post-Ch.D1)

> Captured: 2026-05-04 · Bank size: 36 reps · Rubric: v3.2.0
>
> This snapshot is the reference baseline that all subsequent DNA
> base-layer chapters (D2, D3, S1–S5, C1–C3) measure drift against.
> It is intentionally wider than the legacy 13-rep snapshot — Ch.D1
> tripled the bank with diverse prompt types and band coverage, so
> drift necessarily widens until per-signal chapters tighten it back.
>
> Source: `scripts/calibration/reference-reps.json` rev at the D1 merge
> commit. Re-run with `CONCURRENCY=6 node scripts/calibrate-scoring-baseline.mjs`.

## Bank composition

| | Pitches | Q&A | Objection | Interview | Scenario | Persuasive | Independence/Edge | Total |
|---|---|---|---|---|---|---|---|---|
| Reps | 6 | 5 | 5 | 5 | 4 | 4 | 7 | **36** |

By kind: 29 `band` reps, 7 `independence` reps.

## Band coverage (band-kind only)

| Band | Reps | Composite range |
|---|---|---|
| Poor (<40) | 6 | 18–38 |
| Below Standard (40–60) | 6 | 48–53 |
| Competent (60–75) | 6 | 68–70 |
| Strong (75–85) | 6 | 78–81 |
| Excellent (85–95) | 4 | 87–88 |
| Exceptional (≥95) | 1 | 96 |

Each band-rep covers all 6 dimensions, so per-band-per-dim coverage is
≥4 in every band except `exceptional` (1, intentionally rare per DNA).

## Domain diversity

- **Tech / Engineering:** breach explanation, frontend status Q&A, tool
  adoption (Linear), pricing question.
- **Business / Sales:** pitches (CFO close), objection handling,
  incumbent loyalty, security concern, board updates, customer apology.
- **Personal / Career:** interview answers (weakness, why-this-role,
  TMAY, conflict, leadership-failure), promotion case.
- **Strategic:** regulatory contingency, restructure announcement,
  budget reallocation defense, four-day work week, PTO policy.

## Untestable dimensions

The plan flagged this gap explicitly: text-only reps cannot honestly
score Tone in either tail without audio (Ch.D3). Reps with tone
expectations more aggressive than text-LLM scoring can plausibly
return are tagged `expected.untestableDimensions: ["tone"]` so the
baseline runner downgrades those drifts from failures to warnings.

Affected reps (8): `qa-poor-frontend-status`, `qa-excellent-board-regulatory`,
`objection-poor-too-expensive`, `objection-excellent-incumbent-loyalty`,
`interview-poor-greatest-weakness`, `interview-excellent-leadership-failure`,
`scenario-poor-breach-explanation`, `persuasive-poor-promotion-case`.

The 6 legacy band-of-pitch reps (band-poor-mic-test through
band-exceptional-elite-pitch) keep their pre-D1 expectations to anchor
backwards compatibility; if those start failing under D1's new
SIGNALS-block routing, that's a separate bug (NOT a re-baseline).

## Baseline metrics

> Captured from `CONCURRENCY=2 node scripts/calibrate-scoring-baseline.mjs`
> against http://127.0.0.1:3333 with Anthropic Haiku 4.5
> (claude-haiku-4-5-20251001), OpenAI fallback wired but not used in this
> run (0 fallbacks). Branch `feat/dna-base/D1-reference-bank-growth`.

### Pass rate

| Metric | Value |
|---|---|
| Total reps | 36 |
| Band-rep pass rate | **0% (0/29)** |
| Independence-rep pass rate | **57% (4/7)** |
| Overall pass rate | 11% (4/36) |
| Fallback rate (OpenAI) | 0% (0/36) |
| Wall-clock duration | 117 seconds (concurrency=2) |

### Per-dimension drift (band reps only, n=29)

| Dimension | Mean abs Δ | Max abs Δ | Sign bias |
|---|---|---|---|
| Clarity | 10.2 | +52 | +5.4 (LLM over-grades) |
| Structure | 10.4 | +33 | +4.8 (LLM over-grades) |
| Conciseness | 11.0 | +25 | +8.7 (LLM significantly over-grades) |
| Thinking Quality | 12.8 | +35 | +5.7 (LLM over-grades) |
| Delivery | 8.5 | +20 | +2.0 (slight over-grade) |
| Tone | 7.2 | -17 | −0.8 (≈unbiased) |
| Composite | 9.4 | +32 | +4.9 (LLM over-grades) |

### Worst-drift band reps

| Rep ID | Composite Δ | Top dim Δ | Notes |
|---|---|---|---|
| `scenario-poor-breach-explanation` | +32 | clarity +52 | DNA jargon-to-non-tech-CEO test — prompt should detect audience-design failure but LLM grades on word density alone. Expected target for **Ch.S1 audience_awareness** signal. |
| `interview-poor-greatest-weakness` | +18 | thinking_quality +33 | Cliché "I work too hard" gets scored as substantive thinking. Prompt rewards on structure-of-answer not depth-of-self-reflection. |
| `objection-competent-late-launch` | +16 | conciseness +25 | LLM treats explanation-length as proof of clarity rather than Conciseness cost. |
| `scenario-competent-board-bad-quarter` | +16 | conciseness +25 | Same conciseness over-grading pattern. |
| `objection-poor-too-expensive` | +15 | thinking_quality +25 | Defensive non-answer scored as reasoning. |
| `band-exceptional-elite-pitch` | −14 | structure −17 | Existing legacy rep — LLM **under-grades** the elite pitch. Suggests prompt is reluctant to score >85 even when warranted (exceptional-band shyness). |
| `interview-excellent-leadership-failure` | −13 | thinking_quality −20 | Same pattern — high-end answers under-graded. |

### Independence rep failures

| Rep ID | Failure | Diagnostic |
|---|---|---|
| `indep-conciseness-vs-clarity` | conciseness=40 < min 75 | LLM penalized BOTH conciseness AND clarity together — failed to score them independently. Inter-skill model needs reinforcement (S1 + Ch.S3). |
| `edge-shallow-but-organized` | structure=50 < min 65 | LLM correctly penalized shallow thinking but ALSO dragged structure down with it. Independence violation. |
| `edge-fast-no-fillers` | delivery=75 > max 50 | LLM ignored the rate-too-fast Delivery penalty since deterministic Delivery scorer was bypassed (no word timings on text-only rep). **Diagnosable post-S5** when prosody is real. |

## Reading the drift

This baseline is wider than the pre-D1 snapshot and that is **expected**.
The 0% band-rep pass rate is a feature, not a bug — it surfaces the
prompt's systemic over-grading bias that the thin pitch-only bank
masked. Five observations:

1. **The LLM systematically over-grades on the content dims.** Mean
   composite bias is **+4.9 points**; conciseness leads at **+8.7**.
   Honest rubric-driven scores assigned by us land below where
   Anthropic Haiku puts them. This was always true; the old 13-rep
   bank just didn't have enough range to expose it.
2. **The over-grade is worst on poor reps.** Three of the four worst-
   drift reps are `poor` band — the LLM is reluctant to score below
   ~40 even when the rubric says "no meaningful content was
   communicated." `scenario-poor-breach-explanation` (+52 clarity) is
   the canonical example.
3. **Tone is the tightest dim.** Mean abs delta = 7.2, sign-bias
   ≈ 0. Surprising on a text-only run, since prosody is unavailable.
   Best read as: the LLM defaults Tone to a centered ~65 and our
   honest expectations cluster there too. **This number will move
   once Ch.S5 lights up real prosody** — could go either direction.
4. **High-end reps are under-graded.** `band-exceptional-elite-pitch`
   and `interview-excellent-leadership-failure` are the two negative
   outliers. The prompt's exceptional-band reluctance (DNA spec:
   "should almost never be assigned") may be over-corrected.
5. **Inter-skill independence is failing on 3/7 reps.** The DNA's
   "score dimensions independently" rule isn't holding when one dim
   is rigged low — the LLM drags neighbors with it. S1–S4 deterministic
   signals will pin individual dim scores against text-derivable
   ground truth, which should restore independence.

These five observations are the **diagnostic targets** for chapters
S1–S5. The drift itself is honest signal — exactly what the bank was
expanded to surface.

## How later chapters measure drift

Subsequent chapters MUST hold this baseline. The drift thresholds for
those chapters compare against THIS snapshot, NOT against the legacy
13-rep state. Specifically:

- **D2** can widen independence-rep drift further (it's adding 12 new
  independence reps, same intent as D1).
- **D3** does not change scoring directly but enables the 8 untestable
  reps once audio lands; expect tone drift to TIGHTEN as a result.
- **S1–S4** add new SIGNALS to the LLM context. Drift gate: per-dim
  mean abs delta must not exceed THIS baseline's value by more than 3
  points. Composite mean abs delta must not exceed THIS by more than 2.
- **S5** lights up real prosody. Tone drift is allowed to move in
  either direction (could tighten or loosen depending on prosody
  fidelity); composite drift must hold.
- **C1–C3** are operator surfaces and don't touch scoring; baseline
  is informational only.

## Re-running this snapshot

```bash
# Foreground, single concurrency=6 run, ~3-5 minutes wall-clock:
CONCURRENCY=6 node scripts/calibrate-scoring-baseline.mjs > /tmp/calib.json 2>&1

# Then aggregate with whatever JQ pipeline matches the section above.
# A small helper aggregator may land in a future chapter; for now it's
# a one-off computed from the raw `results` array in the JSON output.
```

If you bump rubricVersion (e.g. v3.2.0 → v3.3.0 after S5 ships), bump
the filename here too: `docs/calibration-baseline-<year>-<month>.md`
and link it from the previous baseline's "How later chapters measure
drift" section so the lineage is traceable.
