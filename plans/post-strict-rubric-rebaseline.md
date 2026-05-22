# Post-HC-3 calibration re-baseline

Phase HC-3 tightened the scoring bands + introduced explicit score floors
(see `src/lib/ai/score-stages.ts`'s `stage1SystemPrompt`). This SHIFTS
calibration scores for the existing 48-rep reference set — expected,
intentional. This doc captures what to run + what to assert.

## What changed in HC-3

- New band anchors: `10-25` (barely tried), `30-45` (vague), `50-60`
  (generic), `65-80` (strong), `85-95` (excellent), `95+` (exceptional).
- Explicit floors:
  - Off-topic rep: ALL dims capped at 35
  - Junk rep (mic test, <5 words): ALL dims capped at 25
  - Silence-heavy (>50% silence): delivery + pacing capped at 30
  - Exercise-defining rule violation: PRIMARY dim capped at 40
- "DO NOT anchor to mid-range when you can't find evidence" instruction.
- Stage 2 callout shape split: holistic vs quote-based per dim.

## Expected score shifts on the 10-rep subset

| Rep id                          | Expected vs pre-HC-3              |
| ------------------------------- | --------------------------------- |
| `band-poor-mic-test`            | Junk-rep floor (was ~30s, now ≤25)|
| `band-below-rambling-pitch`     | Drop ~10-15 (vague band)          |
| `band-competent-okay-pitch`     | Stable ±5 (generic-tier)          |
| `band-strong-clean-pitch`       | Stable ±5 (strong-tier)           |
| `band-excellent-tight-pitch`    | Stable ±5 (excellent-tier)        |
| `edge-shallow-but-organized`    | thinking_quality drops more       |
| `edge-fast-no-fillers`          | delivery drops more               |
| `edge-variety-with-upspeak`     | tone drops more                   |
| `indep-clear-but-padded`        | conciseness drops more            |
| `qa-strong-pricing-question`    | Stable ±5                         |

The TOP-tier reps should stay within ±5 composite. Middle/low tier reps
should drop. If top-tier shifts down too, the prompt overshot — needs
revisiting. If junk reps DIDN'T drop, the floor instructions aren't
being honored — also revisit.

## Run procedure

Prerequisite: `~$2-3` of Anthropic credits + dev server running.

```bash
# 1. Boot dev server (separate terminal)
npm run dev

# 2. Run the post-strict-rubric baseline
node scripts/phase-baseline.mjs --mode=post-strict-rubric

# 3. Diff against the pre-HC-3 baseline
node scripts/phase-baseline.mjs \
  --mode=post-strict-rubric \
  --compare-against=plans/baselines/phase-pre-pivot.json \
  --composite-tolerance=20 \
  --min-hold-rate=0.4
```

(The wider tolerance + lower hold rate are because we EXPECT scores to
shift on most reps. The gate is purely a "did the prompt go too far"
check, not a regression gate.)

## Acceptance criteria

- ✅ Top-tier reps (`band-strong-clean-pitch`, `band-excellent-tight-pitch`,
  `qa-strong-pricing-question`) within ±5 of the pre-HC-3 composite.
- ✅ Junk rep (`band-poor-mic-test`) ALL dims ≤ 25.
- ✅ Vague rep (`band-below-rambling-pitch`) composite drops ≥10.
- ✅ Holistic dims (structure, thinking_quality, delivery) emit `quote=null`
  for at least 80% of the warn/critical callouts in the sample (eyeball
  the per-rep JSON in `plans/baselines/post-strict-rubric.json`).

If any criterion fails, iterate on `stage1SystemPrompt` /
`stage2SystemPrompt` in `src/lib/ai/score-stages.ts` and re-run.

## Output

`plans/baselines/post-strict-rubric.json` — full per-rep + summary
output from the run.
