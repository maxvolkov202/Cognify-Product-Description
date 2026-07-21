# Grading Engine V2 — Phase 2 decision-gate bench (lean 6-arm sweep)

**Date:** 2026-07-21 · **Model:** `openai:gpt-4o-2024-08-06` (temp 0.2) · **Run:** isolated worktree
server on :3334, credits live, 0 mock-fallback, 0 rate-limit, 192 top-level `/api/score` calls.

**Scope (lean, per Max's ~250-call cap):** accuracy on a 12-rep stratified subset (composite
23→84, all 4 bands); run-to-run variance on the 4-rep default subset at N=5. 32 calls/arm × 6 arms.
Grouped-fanout / tone-decomposed fan out ~2–3× internally (more provider calls than the 32 top-level).

## Results

| arm | comp MAE | band | **tone** | **delivery** | clarity | structure | concise | thinking | lat p50 | worst-dim var swing |
|-----|---------:|:----:|---------:|-------------:|--------:|----------:|--------:|---------:|--------:|--------------------:|
| **control** | **1.1** | 1.0 | 3.6 | 2.3 | 1.4 | 1.5 | 1.7 | 2.3 | 8219ms | **37** (structure) |
| **all-llm** | 1.3 | 1.0 | **2.5** | **1.6** | 1.7 | 2.1 | 2.0 | 2.4 | 9776ms | 22 (structure) |
| reference-anchored | 1.8 | 1.0 | 4.4 | 2.4 | 1.4 | 3.2 | 2.6 | 3.3 | 8548ms | 17 (thinking) |
| grouped-fanout | 2.9 | 1.0 | 4.6 | 3.4 | 5.6 | 2.7 | 2.3 | 4.5 | **6855ms** | 20 (delivery) |
| grouped-fanout@llm | 3.5 | 1.0 | 4.5 | 4.3 | 5.3 | 3.8 | 2.6 | 3.6 | 8065ms | 20 (delivery) |
| tone-decomposed | 3.0 | 1.0 | **12.3** | 2.2 | 5.8 | 4.3 | 3.6 | 3.8 | 6795ms | **10** (concise) |

Feedback quality was flat across arms (groundedness ~0.00–0.03 — gpt-4o rarely quotes ≥3-word
transcript spans; pairwise-similarity ~0.08–0.10 = well-differentiated; 0 banned filler).

## Read

**Sample-size caveat first:** at 12 accuracy reps, composite-MAE gaps under ~0.7 are within the
noise floor. Trust the *large* signals; treat the fine accuracy ranking (control vs all-llm vs
reference-anchored) as a tie, not an ordering.

1. **No variant beats control on accuracy.** Control (1.1) and all-llm (1.3) are the accuracy
   leaders and are statistically indistinguishable here. Every other arm is clearly worse.
2. **all-llm is the real story (Max's Q1: "can we drop determinism?").** Letting the LLM own
   delivery + thinking (no deterministic pacing override, no 60/40 thinking blend) **matched control
   on composite, beat it on delivery MAE (1.6 vs 2.3), and did NOT blow up variance** (worst-dim
   swing 22 vs control's own 37). On *text* reps, determinism is not earning its keep. **BUT** this
   is the wrong test surface for the determinism question: the deterministic pacing override exists
   to read real WPM from word timings on **audio** reps, which this text-only subset never exercised.
   → all-llm is a genuine promotion candidate, gated on an audio-rep rerun (see follow-ups).
3. **reference-anchored HURT accuracy** (1.8; structure 1.5→3.2, thinking 2.3→3.3). The 3 baked
   anchors pull scores toward the anchor values rather than tightening calibration. Not worth it.
4. **grouped-fanout trades accuracy for latency.** ~17% faster (6.9s vs 8.2s — the parallel-decode
   win the plan predicted) and marginally more distinct feedback, but the content/delivery split
   **regresses clarity badly (1.4→5.6)** and composite (2.9). Not shippable without fixing the
   clarity regression. The @llm variant is strictly worse.
5. **tone-decomposed is the worst on the exact dimension it targets** (tone MAE 12.3) — the
   ordinal→points rollup is badly miscalibrated against human tone scores **with no prosody worker
   up** (text-ordinal-only path + 60 band-center floor). It does deliver the lowest variance (10, the
   explainability/stability win) but that's worthless at this accuracy. Needs the Modal prosody
   worker + a rollup recalibration before it can be judged fairly.
6. **Control's variance wart:** its worst single-dim swing (37, structure on `edge-short-but-deep`)
   is the highest of any arm — determinism does nothing for the LLM-graded dims (structure/clarity),
   which is where the real run-to-run instability lives.

## Decision

**Keep `control` as the shipped default. `FF_SCORING_VARIANT` stays OFF. Promote no variant.**
The measurement earned its cost: it says the current single-call scorer (post-v4.1.0 rubric) is
already well-calibrated and nothing here improves it enough to justify the added cost/latency/
calibration-surface. The infra stays committed and dormant — it's what let us learn this, and it's
what runs the follow-ups.

## Follow-ups (in priority order)

1. **Audio rerun of `control` vs `all-llm`** on the 15 `audio-tone` reps with the Modal prosody
   worker up (`--with-audio`). This is the *real* determinism test — if all-llm holds up on delivery
   there, dropping the opaque pacing override (Max's original grievance) becomes a defensible ship.
2. **Fix grouped-fanout's clarity regression** only if latency becomes a priority — the ~17% win is
   real but the content-pass is under-grading clarity.
3. **tone-decomposed:** recalibrate the ordinal→points rollup against human tone scores + require the
   prosody worker before re-benching. Shelve until then.
4. **Widen the accuracy set** to the full 29 band reps before any promote decision — 12 reps can't
   separate a 0.2 MAE difference. *(done — see below.)*

## Addendum — full 29-rep control vs all-llm (same run, N=3 variance)

| metric | control-29 | all-llm-29 |
|---|---:|---:|
| composite MAE | 1.7 | **1.4** |
| clarity / structure / conciseness | 1.7 / 1.9 / 2.3 | 1.8 / 1.9 / 2.4 |
| thinking | 3.2 | **2.9** |
| **delivery** | 1.4 | 1.4 (tie) |
| tone | 2.9 | 2.8 |
| band-match | 1.0 | 1.0 |
| worst-dim var swing | 22 | 20 |
| latency p50 | 8.3s | **7.7s** |

Across both runs (12-rep: all-llm 1.3 vs control 1.1; 29-rep: 1.4 vs 1.7), **all-llm ≈ control on text
accuracy and never meaningfully worse** — equal-or-better on every dimension at 29 reps, identical
delivery, marginally more stable. The 12-rep run's fine ordering was noise; the 29-rep run erases any
"control is more accurate" claim.

**This does NOT clear all-llm to ship.** The delivery parity (1.4 = 1.4) is on *text* reps, where both
arms read the same transcript pace signals. The deterministic pacing override exists for **audio** WPM
precision, which no run here tested (the 15 audio-tone reps carry no `audioUrl`, and `PROSODY_WORKER_URL`
is unset). The determinism question stays formally open until the audio rerun. Everything text says:
determinism is not helping — but text can't see the case determinism was built for.

Accuracy caveat: each rep is scored once per accuracy pass, so single-rep noise (±10–20 on some reps)
means a 0.3 composite gap is suggestive, not decisive. A multi-sample accuracy pass would firm it.
