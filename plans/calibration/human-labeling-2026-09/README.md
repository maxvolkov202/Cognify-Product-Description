# Human ground-truth set (grading plan WS2)

Raters: **A = Max**, **B = Owen Brown**. Blind: the sheets show prompt, transcript, audio link, the model's headline
and Coach's Focus text (needed for the three yes/no questions) — never the model's numbers.

The data files in this folder (`sample.json`, `labeling-sheet-*.csv`, `model-scores*.json`, `human-labeled-*.json`,
`metrics.*.json`, `strata.md`) hold real user transcripts and are **gitignored** (public repo). Keep them local or in
a private drive; only the scripts and this README are committed.

## Build / score

```
node scripts/calibration/human-labeling/build-packet.mjs        # DB read-only; signs 7-day audio links
node scripts/calibration/human-labeling/scoring.mjs             # after both sheets are filled → metrics.baseline.json
BASE_URL=... CALIBRATION_GUEST_ID=... node scripts/calibration/human-labeling/rescore.mjs --label <ws-name>
```

Never add these reps to `reference-reps.json`; never run `reauthor-expectations.mjs` on them.

## How to fill a sheet (~2 min per rep, ~2 h total)

Listen to the audio when there is a link; otherwise read the transcript. Then fill, per rep:

- Six band columns, **1–5**, per dimension (Clarity, Structure, Conciseness, Thinking Quality, Pacing, Tone),
  using the rubric anchor bands: 1 = 0–20, 2 = 21–40, 3 = 41–60, 4 = 61–80, 5 = 81–100. Anchor text per band and
  dimension: `~/Documents/Projects/Cognify grading docs/02-live-rubrics-and-band-anchors.md`.
  Judge the content against the prompt; never mark down for being short.
- `headline_accurate` (y/n): does the headline describe what actually happened in this rep?
- `coach_focus_right_lever` (y/n): is the Coach's Focus the one thing that would most improve the next attempt?
- `hallucinated_claim` (y/n): does the headline or focus cite anything the person did not say?
- `notes`: optional; note anything that made the rep hard to band.

Do not compare notes until both sheets are done. `scoring.mjs` lists every rep where you are more than one band
apart; settle those together in `adjudicated.csv` (`rep_id` + the six band columns) and re-run.
