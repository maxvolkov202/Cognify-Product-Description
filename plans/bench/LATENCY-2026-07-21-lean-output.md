# Grading Engine V2 — latency lever (a): the `lean-output` arm

**Date:** 2026-07-21 · **Model:** `openai:gpt-4o` (temp 0.2) · **Goal:** cut grading
latency without touching accuracy. Grading is decode-bound — one gpt-4o call, ~8.2s p50
is almost all output-token generation — so trimming output tokens is a ~linear lever.

## What the arm does

`lean-output` is the control single-call flow with a leaner OUTPUT contract, nothing else:

1. **Drops the per-dimension `signals` narratives.** These were persisted to
   `dimension_scores.signals` but **never rendered in any UI** — they round-trip into
   `RepScore` and stop there (verified: no `.tsx` consumer). Pure dead output.
2. **Halves the per-dimension `feedback` cap** (400→160 chars, "1-2 sentences" → "1").
   Feedback groundedness is ~0 regardless of length (the model doesn't quote transcript
   spans), so there is real slack here — this was Max's explicitly-named lever.

Everything else — dimension **scores**, headline, coachFocus, strongerVersion — is
byte-identical to control. The scores come from separate JSON fields produced by the same
reasoning, so **the arm is accuracy-neutral by construction**: it trims prose the model
writes, not the judgment behind the numbers.

Implementation: `LEAN_SYSTEM_PROMPT` is DERIVED from control's `systemPrompt` by three
anchored substitutions (with a `requireReplace` guard that throws if a base edit ever
breaks an anchor), so every untouched rule tracks control automatically. The `signals`
schema field became `.optional().default([])` — byte-neutral for control (control still
emits it). Flag-gated (`FF_SCORING_VARIANT_ARM=lean-output`), default OFF → prod unchanged.

## Two bench instruments (both server-free, RAG off, in-process)

The `/api/score` HTTP body carries no token counts, and spinning a second dev server to
run the HTTP harness risks the node_modules-junction incident. So both benches call the arm
functions **directly in-process** and read the return `metrics` — no server, no worktree,
and one run can A/B many arms:

- `scripts/bench/lean-output-micro.ts` — paired control-vs-lean per rep; measures the
  *mechanism* (output-token delta + model latency).
- `scripts/bench/direct-arm-bench.ts` — accuracy: per-dim + composite **MAE vs the
  human-authored expected scores**, plus tokens / latency / call-count. This is what caught
  (and then cleared) the accuracy question below.

## Latency + token mechanism (micro-bench: 6 reps × 3 samples = 36 gpt-4o calls)

| arm | output tokens (mean / p50) | model latency p50 | model latency mean | composite \|Δ\| |
|-----|---------------------------:|------------------:|-------------------:|---------------:|
| control | 649 / 652 | 7707ms | 8238ms | — |
| lean-output | 466 / 463 | 6405ms | 7629ms | — |
| **delta** | **−28.2%** | **−16.9%** | −7.4% | comp \|Δ\| 1 · dim \|Δ\| 2 |

The token cut is **−28.2%** (649→466), dead-consistent rep-by-rep. Latency **p50 −16.9%**
(7.7s→6.4s) — use p50 not mean: gpt-4o's fat tail (both arms spiked to ~14.8s at random)
makes means noise-dominated. Control mean (8238ms) reproduces the prior doc's ~8.2s baseline,
so this measures the same decode the HTTP bench did.

## Accuracy vs human (`direct-arm-bench.ts`: 12 reps × N=3 = 72 gpt-4o calls)

I first ran a single-sample (N=1) pass that looked alarming — lean-output composite MAE 2.7
vs control 1.6. But control's OWN composite MAE swung 1.6→2.3 between runs, i.e. the gap was
mostly single-rep LLM noise (±10-20 on some reps). Re-run at **N=3** (noise ÷√3):

| arm | comp | clarity | struct | concise | think | deliv | tone | out | lat p50 |
|-----|-----:|--------:|-------:|--------:|------:|------:|-----:|----:|--------:|
| control | 2.3 | 3.3 | 4.3 | 2.1 | 5.1 | 2.3 | 2.6 | 652 | 7010ms |
| lean-output | **2.5** | 3.4 | 4.4 | 3.1 | 4.9 | 1.9 | 3.8 | 484 | 5581ms |

**Composite MAE 2.5 vs 2.3 — a 0.2 gap, inside the noise floor.** lean-output is
composite-accuracy-neutral. Per-dim it reshuffles slightly (worse conciseness +1.0 / tone
+1.2, better thinking −0.2 / delivery −0.4, tied on clarity/structure) — all ~1 MAE, within
noise. NOTE: my earlier "accuracy-neutral BY CONSTRUCTION" was an overclaim. It's neutral by
*measurement*, not construction: within a dim the JSON emits `score` before its prose (so a
dim's own score can't move), but earlier dims' prose precedes later dims' scores, a weak
cross-dim channel. The bench had to confirm it — and did, on composite.

## Read

Lever (a) is a **real, low-risk latency win**: −26/28% output tokens, **−17 to −20% p50
latency** (~8.2s → ~5.6-6.4s depending on provider weather), composite-accuracy-neutral,
single call (no extra cost), no clarity regression. It changes *output verbosity*, not
*judgment* — the only variant in the whole sweep that improves latency without a clear
accuracy downside.

## Decision / next

**Recommend lever (a) `lean-output` as the latency win for the current single-call
architecture.** Two things are Max's call before any prod flip (Phase 6):
- The user-visible change is **shorter feedback text** (≤160 vs ≤400 chars/dim). The bench
  proves scores don't move; it does NOT prove the shorter feedback still *reads* useful, nor
  does it vet the minor tone/conciseness wobble. Max eyeballs a few lean samples + approves
  the copy trade. (Signals-drop is invisible — no review needed.)
- If the tone/conciseness wobble matters, a `lean-signals-only` fallback (drop the invisible
  signals field, keep the 400-char feedback) captures ~half the token win with zero prose
  change — a strictly-safe subset if the full trim ever feels too aggressive.

Lever (a×b) `lean-split` (lean output ON the parallel decode) — see the addendum below.

---

## Addendum — lever (a×b): `lean-split` (lean output × clarity-safe parallel decode)

**The arm.** grouped-fanout (CONTENT ∥ DELIVERY+TONE + synthesis) with the lean output
contract on every pass, PLUS a targeted fix for the clarity regression the lean sweep found:
the base CONTENT scope told the model to "spend your full token budget on RICH feedback" for
only four dims — that flaw-hunting pressure manufactured clarity nitpicks and dragged the
score down. The lean CONTENT scope removes it and adds an explicit anti-compression guard
(short feedback must never pull a score down). Flag: `FF_SCORING_VARIANT_ARM=lean-split`.

**Result (`direct-arm-bench.ts`, 10 reps × N=2, control same-run):**

| arm | comp | clarity | struct | concise | think | deliv | tone | out(Σ3 calls) | lat p50 | calls |
|-----|-----:|--------:|-------:|--------:|------:|------:|-----:|--------------:|--------:|------:|
| control | 2.1 | 3.3 | 3.0 | 2.4 | 4.2 | 2.2 | 2.6 | 653 | 7839ms | 1 |
| lean-split | 2.7 | **3.0** | 3.1 | **5.1** | 5.2 | 4.4 | **5.6** | 342 | **4513ms** | 3 |

**Read.**
1. **The clarity fix WORKS.** clarity MAE 3.0 ≈ control 3.3 (and held 3.0 on the earlier
   N=1 run too) — grouped-fanout's 1.4→5.6 blowup is gone. Confirms the mechanism: the
   "rich feedback" budget pressure was the driver, not the split itself. A genuine, reusable
   finding.
2. **But the split still regresses the OTHER dims.** conciseness 5.1 (vs 2.4), tone 5.6
   (vs 2.6), thinking 5.2 (vs 4.2), composite 2.7 (vs 2.1). Isolating delivery+tone into a
   voice-only call, on text reps with no audio, calibrates them worse than control's holistic
   pass — the same reason grouped-fanout was shelved. (Delivery 4.4 is partly a bench
   artifact: these direct inputs carry no word-timings, so the deterministic pacing override
   prod uses on real audio reps is bypassed and delivery falls to the raw LLM number in both
   arms. Tone/conciseness are NOT deterministic-overridden, so those regressions are real.)
3. **Latency is the biggest of any arm: −42%** (7.8s → 4.5s), total output tokens even
   lower than lean-output (342 vs 484, summed over 3 calls). The parallel-decode + lean-output
   stack is genuinely fast.

**Verdict: `lean-split` is NOT a clean win — it buys the biggest latency cut with a real
conciseness/tone accuracy cost.** Same accuracy-for-latency tradeoff grouped-fanout was
rejected for; the clarity-safe fix closed one leak but not the others. Keep it committed and
dormant (flag OFF) as a proven building block — the clarity fix is the reusable asset if the
split is ever revisited. **Do not promote.**

## Bottom line

- **`lean-output` (lever a): SHIP CANDIDATE.** −26% tokens, −17-20% p50 latency,
  accuracy-neutral on composite, one call. Gated on Max's copy review + prod flip (Phase 6).
- **`lean-split` (lever a×b): shelved.** Fastest, but the delivery/tone/conciseness split
  costs accuracy. Clarity-safe fix retained as a building block.
- Both flag-gated OFF → prod grading unchanged. Nothing to revert.

---

## PIVOT experiments — quality-preserving latency (2026-07-21, Max)

Max judged the shipped `lean-output@160` "too lean to get to prod" (feedback must stay
helpful). New mandate: latency levers that PRESERVE output quality (quality is the gate,
latency the goal), **cost no longer a constraint**. Three experiments, each benched vs
control on quality (per-dim + composite MAE vs human) AND latency via
`scripts/bench/direct-arm-bench.ts` (server-free, RAG off).

**All the machinery is built, tested (tsc + lint + scoring-arms 51 + score-arm-b 34 green),
flag-OFF, prod-safe:**
- **Exp 1** — parameterized lean feedback cap: `leanSystemPromptFor(cap)` +
  `leanFeedbackCap` threaded through `runSingleCallScore`/`buildSystemBlocks`. Bench arms
  `lean-400` (signals-only floor, feedback prose byte-identical to control), `lean-320`,
  `lean-280`, `lean-240`, `lean-160`. Signals-drop is applied at every cap (free — never
  rendered).
- **Exp 2** — `--model` / `--provider` overrides on the bench (sets `OPENAI_SCORING_MODEL`
  / `ANTHROPIC_SCORING_MODEL` + `AI_PROVIDER` before the dynamic import). Not yet run.
- **Exp 3** — new arm `per-skill-fanout` (`runPerSkillFanout` in score-arm-b.ts): 6 parallel
  single-dim scoring calls + synthesis. Wired into the dispatcher + `IMPLEMENTED_VARIANT_ARMS`.

### Exp 3 — `per-skill-fanout`: COMPLETE. Quality FAIL, do NOT promote.

`direct-arm-bench.ts`, 12 reps × N=3, gpt-4o, RAG off:

| arm | comp | clarity | struct | concise | think | deliv | tone | out | latP50 | calls |
|-----|-----:|--------:|-------:|--------:|------:|------:|-----:|----:|-------:|------:|
| control | 3.0 | 3.4 | 4.4 | 2.9 | 6.0 | 2.6 | 3.0 | 644 | 7022ms | 1 |
| per-skill-fanout | 4.8 | 5.7 | 5.8 | 4.3 | 10.5 | 2.9 | **12.7** | 516 | **4022ms** | 7 |
| grouped-fanout | 2.9 | 6.0 | 4.3 | 3.8 | 6.4 | 1.3 | 5.3 | 540 | 5976ms | 3 |

**Read.** Per-skill fan-out is the FASTEST arm ever benched — **−43% p50 (7.0s → 4.0s)**;
the six tiny single-dim calls decode in ~1.5s each concurrently, then a ~2-6s synthesis.
But per-dimension isolation destroys calibration exactly as Max flagged: **tone MAE 12.7 vs
3.0** (each voice dim judged with zero content context on text reps with no audio — the
grouped-fanout tone leak, amplified), **thinking 10.5 vs 6.0**, composite 4.8 vs 3.0, and
clarity/structure both worse. This is the same accuracy-for-latency trade grouped-fanout and
lean-split were rejected for, at its most extreme. **Fails the quality gate.** Keep committed
+ dormant (flag OFF) as a proven building block; the −43% latency is real if a future arm can
close the calibration loss (e.g. give each voice call the sibling dim's context, or only
fan-out the content dims and keep delivery+tone in one holistic call).

### Exp 1 — milder feedback-trim sweep: PARTIAL, INCONCLUSIVE (blocked mid-run).

The run crashed at rep 6/12 when the **OpenAI spend quota was exhausted (429 "exceeded your
current quota") and the Anthropic fallback hit "credit balance too low"** — running Exp 1 and
Exp 3 concurrently burned through the OpenAI cap. The N=3 aggregate MAE table is computed only
at run end, so it was lost on crash; only noisy single-sample per-rep composite deltas
survived (6 reps), which the docs note carry ±10-20 noise — too muddy to conclude. One rep
(`interview-below-why-this-role`) showed lean caps drifting up (160: cΔ11 vs control cΔ3), but
that is exactly the single-sample noise N=3 exists to clear. **No conclusion — needs a clean
rerun once API quota is restored.** Token/latency savings per cap are the deterministic part
and were not in doubt; the open question is purely the quality floor (which cap still reads
useful with no MAE loss).

### Exp 2 — faster model: NOT STARTED (blocked by the same quota wall).

`--model gpt-4o-mini` / `gpt-4.1-mini` / `claude-haiku-4-5-20251001` and the
gpt-4o-scores + fast-model-synthesis split remain to run. Each needs ISOLATED (non-concurrent)
execution for clean latency, since the comparison is cross-run (model X vs gpt-4o baseline).

### BLOCKER (2026-07-21)

**Scoring API quota exhausted on BOTH providers** — OpenAI `insufficient_quota` (429) +
Anthropic `credit_balance_too_low`. No further benches (or prod scoring) can run until Max
tops up. Nothing shipped, control unchanged, all new code flag-OFF and green. When quota is
back: rerun Exp 1 clean (single bench, 12 reps × N≥3, arms control,lean-400,lean-320,lean-280,
lean-240,lean-160), then Exp 2 models one-at-a-time.

