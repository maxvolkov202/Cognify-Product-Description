# Calibration Loop — Operator Runbook

> Ch.C3 of the DNA base-layer expansion plan.

The calibration loop closes the gap between LLM-predicted scores and
expert-verified scores. Each operator review verdict eventually feeds
the reference bank that future scoring runs are calibrated against —
so the system learns from operator disagreement instead of silently
drifting.

## The full loop

```
       +─────────+      +────────────+      +───────────────+
       │  Score  │  ─→  │ Flag if   │  ─→  │ Operator     │
       │  rep    │      │ ≥95 comp. │      │ Review queue │
       +─────────+      +────────────+      │ (Ch.C2)      │
                                            +───────┬──────+
                                                    │
       +─────────+      +────────────+      +───────▼──────+
       │ Future  │  ←─  │ PR review +│  ←─  │ 7-day        │
       │ scoring │      │ hand-merge │      │ cool-off     │
       │ runs    │      │ to ref-bank│      │ +operator    │
       │ measure │      └────────────┘      │ promotion    │
       │ drift   │                          │ script       │
       │ vs new  │                          │ (Ch.C3)      │
       │ ground  │                          +──────────────+
       │ truth   │
       └─────────┘
```

## Step-by-step (operator perspective)

### 1. A user submits a rep that scores ≥95

The score endpoint sets `requiresHumanReview: true` on the response
(visible in the user's score JSON). The user sees their score
immediately — review is retroactive.

### 2. Rep lands in `/ops/review-queue`

Filter: `composite_score >= 95 AND id NOT IN (SELECT rep_id FROM
score_corrections)`. Most recent first, paginated 50 per page. The
landing card shows the rep's prompt, audio (if available), composite
+ per-dim scores, and the model + rubric versions used.

### 3. Operator submits a verdict

Four verdicts:

| Verdict | When to use | Effect |
|---------|------------|--------|
| `confirmed_accurate` | LLM got it right | Removes from queue. No future calibration impact. |
| `should_be_lower` | Composite is too high | Removes from queue. Operator suggests a corrected_composite (0-100). Eligible for Ch.C3 promotion in 7 days. |
| `should_be_higher` | Composite is too low | Same as above but higher. (Rare — ≥95 reps are usually over-graded, not under-graded.) |
| `skipped` | Not enough context to judge | Removes from queue. Won't promote (no corrected_composite). |

The submission writes one row to `score_corrections` per verdict.

### 4. 7-day cool-off

Promotion script ignores corrections submitted in the last 7 days.
Reasoning: a second operator may want to flag a bad correction before
it propagates to the calibration substrate. If you disagree with a
correction, just submit your own verdict (different reviewer_user_id)
within 7 days and the original won't propagate alone.

> Today the cool-off is implemented as a `WHERE reviewed_at < cutoff`
> filter in `getPromotableCorrections`; there is no second-reviewer
> consensus rule. Future iteration could require N≥2 confirmations
> when correction magnitude is large.

### 5. Operator runs the promotion script

```powershell
# From the repo root, with DATABASE_URL pointing at prod:
$env:DATABASE_URL = "<prod-postgres-url>"
npx tsx scripts/promote-corrections.ts
```

Output: a sidecar JSON proposal at
`scripts/calibration/proposed-YYYY-MM-DD.proposed.json` listing every
correction that's eligible for promotion. The script does NOT mutate
`reference-reps.json` — that change must come via PR review.

Each proposed entry includes:
- A new id of the form `correction-<correctionId-prefix>`
- The original rep's prompt text + transcript + duration + audio URL
- An `expected` block with the operator's corrected composite + per-dim
  scores + auto-derived band (poor / below_standard / competent /
  strong / excellent / exceptional)
- A `sourceCorrection` block with provenance (correctionId, repId,
  verdict, operator notes) so reviewers know where the entry came from

### 6. PR review + merge

The operator opens a PR adding accepted entries from the proposal
into `scripts/calibration/reference-reps.json`. Standard review:

- Does the corrected composite make sense given the transcript?
- Does the assigned band match the rubric definitions?
- Is the entry redundant with existing reference reps?

Reject anything where the correction looks like a one-off operator
miscall. Accept entries that surface systematic LLM mis-scoring (e.g.
"the LLM keeps giving exceptional to fluent boilerplate").

### 7. Next nightly drift cron measures against the new ground truth

Once merged, the new entries are part of `reference-reps.json`. The
nightly drift cron iterates the FULL bank including the new entries
and writes drift rows to `calibration_runs`. If the LLM's behavior
matches the operator's correction, the new entry passes calibration;
if not, it shows up in the daily drift count and (if drift is bad
enough) triggers a Ch.C1 alert.

## The /ops/calibration-corrections page

`/ops/calibration-corrections` is a read-only summary of pending
promotable corrections. It shows:

- Total promotable count
- Per-correction: rep id, prompt excerpt, verdict, LLM composite,
  operator-suggested composite, review date, notes

There is NO "Generate proposal" button on the page (yet). That action
is operator-run from a shell with DATABASE_URL access — keeps the
loop manual on purpose so no-one accidentally promotes thousands of
unreviewed corrections.

## Why the loop is manual

- **Calibration substrate is load-bearing.** Reference-reps.json is
  what every drift gate, every nightly cron, and every Tier-2 chapter
  measures against. One bad operator correction propagating into the
  bank will silently miscalibrate every future scoring run.
- **PR review surfaces disagreements.** Two operators looking at the
  same correction often catch issues neither saw alone.
- **Cool-off lets the loop self-correct.** A bad correction can be
  countered by a second-opinion verdict before it ages past 7 days.

The trade-off is throughput. If correction volume gets high (10+ per
week), automate the cool-off + consensus check rather than the
hand-merge step.

## Environment requirements

- `DATABASE_URL` for the script
- Operator role on the user submitting reviews (`is_operator = true`
  on `users`)
- Optional: `CALIBRATION_ALERT_WEBHOOK_URL` for Ch.C1 alerts when
  drift opens up after a promotion
