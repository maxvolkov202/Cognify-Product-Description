# Grading audit and improvement plan (2026-08-26)

Status: **plan approved 2026-08-27, not started**. No code changes were made for this audit. Sources: `Cognify grading docs/00–07`,
prod DB (`cognify_v2`, read-only), `plans/bench/*`, `plans/baselines/*`, calibration artifacts, and a line-level
read of the scoring path on `main` at `72b187a3`.

Scope asked: grading output, speed, efficiency, whether RAG is used effectively, whether scores represent reps
today. Plus: remove the short-rep "proceed anyway" warning and grade short reps accurately.

---

## 1. What the data says

### 1.1 The rep population

| Slice | Reps | Note |
|---|---|---|
| All rows in `reps` | 354 | 2026-04-17 → 08-26, 12 users |
| Seeded demo (`seed-demo-v1`) | 90 | transcript is literally `(seeded demo rep)` |
| Mock fallback (`mock-fallback-v1`) | 97 | scoring failed; fixed scores, composite ~74, thinking 85 |
| **Real LLM grades** | **167** | 120 gpt-4o (07-21+), 47 legacy Anthropic |
| of which v4.1.0 | 157 | 87 from human accounts, 79 from `@cognify.test` harness accounts |

Any dashboard averaging `reps.composite_score` without filtering `model_version` is inflated by mock rows
(they sit above 95% of real reps).

### 1.2 Per-dimension distributions (real LLM reps, n=167)

| dim | mean | sd | p50 | unique values | mode |
|---|---|---|---|---|---|
| clarity | 55.2 | 16.1 | 55 | 29 | 45 (17%) |
| structure | 44.5 | 15.1 | 45 | 27 | 45 (23%) |
| conciseness | 62.8 | 15.5 | 65 | 26 | 78 (20%) |
| thinking_quality | 66.4 | **6.9** | 67 | 32 | 67 |
| delivery (Pacing) | 88.2 | **4.4** | 90 | 14 | **92 (48%; 79% of human v4.1.0 reps)** |
| tone | 57.4 | **7.9** | 60 | 18 | **60 (35%; 51% in the last 14 days)** |
| composite | 60.3 | 9.9 | 62 | 41 | — |

Ceiling: 1 real rep ≥ 80 in the whole dataset, 0 under v4.1.0 (max 77). Real reps are short: median 48 words,
15.7 s, 164 wpm.

### 1.3 Why delivery / tone / thinking clump (structural, not the model)

- **Delivery** is not an LLM score in prod. `applyHybridLayer` replaces it with `scorePacing()`
  (`src/lib/scoring/deterministic.ts:54-113`): start 92, subtract only for fillers > 2/min, hedges > 1/min,
  WPM < 70 or > 220. Any fluent rep at 70–220 wpm = exactly 92. The rubric's 130–165 band, quartile stability and
  pause placement are computed but never scored. Prosody worker output has zero effect on the number. The sync
  path never sends `timeBudgetMs` (`RepSurface.tsx:641-670`), so the time-budget penalty can never fire.
  Headlines regularly contradict the number ("pace is too slow" beside a 92).
- **Tone**: 112/121 v4.1.0 reps had no `audio_url`, so the prompt rule "no prosody → 55–70 band center"
  dominated. Text-tone correlates r=.64–.65 with clarity/conciseness, i.e. it is graded from the words. The tone
  knowledge MD cites prosody fields (`pitch_variance_st`, `rms_std_db`, `final_quartile_rms_delta`) that do not
  exist in the PROSODY block the model sees (`src/lib/audio/prosody.ts`).
- **Thinking quality** is a 60/40 blend with a disfluency score (hedges, restarts, long pauses, end-rush).
  Fluent rep → final = 51 + 0.4 × model; model 25 shows as 61. It compresses the model's range to 40%,
  double-counts hedges with pacing, and measures fluency on a content dimension.

### 1.4 The "pacing/tone fix"

The fix is PR #72 (`63178b1d`, 2026-08-26): Chrome/Edge uploads sent `audio/webm;codecs=opus`, Supabase
rejected it, so those reps never had an `audioUrl` and always graded tone from text. Correct diagnosis, but:

- It changes **tone** only. **Pacing** still goes through `scorePacing()`, which ignores prosody. Expect tone to
  spread, pacing to keep clumping at 92.
- Evidence so far: one verification rep. In the DB, tone/delivery variance in the last 14 days is the **lowest in
  the dataset** (tone sd 4.5, 7 unique values). The fix needs ≥30 audio-graded reps before it is confirmed.

### 1.5 Noise, retries, learning

- Same 40-word off-prompt transcript scored 30 times: composite 45–74 (three times in one day: 45, 44, 72).
  The off-topic floor never fired.
- Retry delta: composite +0.1 (sd 9.8). Run-to-run noise ≈ retry effect, so retries are not measurably rewarded.
- Per-user composite over the first 20 reps: flat (slope −0.09/rep).
- Correlation: the four content dims + tone form one factor (r .40–.67); delivery is orthogonal (r ≤ .35)
  because it is deterministic.

### 1.6 Feedback

- Headline "Your response lacks clarity and structure, making it hard to follow." appears on 4 of 25 sampled
  reps across users and prompts, despite the CRITICAL no-stock-sentence rule.
- Bench groundedness 0.00–0.03 on every arm (July).

### 1.7 Mock fallbacks (resolved)

Since 08-10: 36 mock reps, 33 on test accounts, **3 on a real user (08-12)**. Causes from `error_detail`:

| Cause | Rows | Note |
|---|---|---|
| Zod `too_big` on `coachFocus.why/behavior/action` (280/200/220 chars) | 5 | The real-user hits. A 20 s successful LLM call is discarded for a few characters. |
| OpenAI `429 You have no credits remaining` + Anthropic fallback `timeout after 20000ms` | 5 | 08-24 18:32–19:33. Credits ran out; the 20 s fallback timeout is too tight (the one fallback that succeeded took 16.9 s). |
| `400 invalid model ID` (fast fail ~800 ms, 1/s bursts) | 58 | Harness running with a bad model config, not prod traffic. |
| 08-25T03 prod signals-drop reps averaging 81.9 s (one 213 s) | 5 | OpenAI slow period; client aborts at 45 s so the user saw nothing. |

### 1.8 Calibration bank is self-referential

Since v4.0.0, band expectations are machine re-authored from 3× replays of the model
(`scripts/calibration/reauthor-expectations.mjs`, commits `1253495f`, `fc7770a8`). "48/48 pass" and bench MAE
1–2 measure self-consistency, not agreement with humans. After re-authoring, the bank has 0 excellent /
0 exceptional reps; the elite pitch's expected composite is 78. `reference-reps.json.rubricVersion` still says
v3.2.0. The only human-pre-registered set (18 reps, July) is not in the harness.

### 1.9 Speed and cost

- Server p50 **8.3 s**, p90 11.6 s (n=2,849). Model decode 7.5 s (~680 output tokens). RAG p50 297 ms.
- Not persisted: Deepgram time, upload time, prosody worker time, end-to-end perceived latency.
- Serial where it needn't be: transcribe → upload → score; prosody (5 s timeout) and RAG (1.5 s) are both awaited
  **before** the LLM call (`score-shared.ts:1360`; the comment claiming concurrency is wrong).
- Tokens: ~10K static prefix (5.3K is the system prompt) + ~1.5–2.7K uncached per rep + ~700 out + one embedding
  call. OpenAI caching is automatic-prefix only (~8K cached reads observed). No JSON mode / structured outputs.
  Two WPM lines with two targets (130–165 vs 150–160) in the same prompt.
- Prod runs `FF_SCORING_VARIANT=true`, `ARM=signals-drop`, `PERCENT=100` (confirmed via `vercel env pull`).
  The 381 "control" telemetry rows since 08-10 are local calibration bursts, not prod.

### 1.10 RAG

- 243 chunks (47 skill / 129 framework / 67 domain). Only the 4 `skills-full` files can satisfy dimension
  coverage, so 4 of 6 injected chunks are nearly always sections of the same four files whose slim versions are
  already in the cached SCORING KNOWLEDGE block, under a header saying the RUBRIC wins on conflict.
- No similarity threshold. Chunk ids / similarities / counts never persisted. Every arm bench ran with
  `FF_RAG_RETRIEVE=false`, so the shipped config has never been accuracy-benched.
- Verdict: ~300 ms + ~1K tokens per rep with no evidence of signal.

### 1.11 Instrumentation gaps

`scoring_telemetry.rep_id` is NULL on all rows. Word timings persisted on 0 reps. Prosody features on 0 reps.
RAG chunks never. No "graded from audio" flag on a rep.

---

## 2. Decisions taken in this session

- Priority order: accuracy > feedback quality > latency > cost (all matter; this is the tie-break).
- Max will label ~50–60 real reps (with a second rater) to create a human ground-truth set.
- The short-rep modal goes away; short reps must grade accurately (ruleset in §4).
- signals-drop is the de-facto prod default (100% ramp); treat it as control going forward.
- Short-rep floor: fewer than 5 recognised words and under 3 s of speech (silent, no modal). Agreed 2026-08-27.
- Latency target: score visible < 7 s p50 on the sync path. Agreed 2026-08-27.
- **Evidence gates.** No phase closes on a single rep. Minimum samples, all from real (non-test, non-mock) reps:
  - Instrumentation (workstream 1): >= 20 reps across >= 3 users with telemetry joined and `graded_from_audio` set.
  - Tone confirmation (workstream 5): >= 30 audio-graded reps across >= 5 users and both Chrome and Safari.
  - Distribution checks (workstreams 3–6): >= 50 reps per condition.
  - Latency (workstream 8): >= 50 reps per condition over >= 3 days and >= 5 users, reporting p50/p90/p99 with n and the
    device/browser mix; a change ships only if p50 < 7 s AND p90 does not regress.

---

## 3. Build plan (everything, in execution order)

One plan, executed top to bottom. Each workstream is a branch + PR + `/code-review` + merge + deploy
(CLAUDE.md). Anything that changes scoring-prompt bytes re-runs the calibration suite and notes it in the
tracker. Evidence gates (§2) apply to every "Verify" line; real reps only (exclude `@cognify.test`,
`seed-demo-v1`, `mock-fallback-v1`). Later workstreams that change scores are judged against the human set
from workstream 2, so record its baseline before starting workstream 3.

First commit on the first branch also adds the uncommitted audit files: this doc, `plans/handoff-grading-p0-p1.md`,
`scripts/qa/grading-audit/`, and the tracker entry.

### 1. Instrumentation and failure handling (`feat/grading-p0-instrumentation`)

Why first: every later change is measured on reps scored after this lands, and two user-visible failures are cheap.

1. **Telemetry joins to reps.** Sync path writes `rep_id` on `scoring_telemetry` (client knows it after `saveRep`;
   either move the telemetry write after save or update by a request id). Append-only migration under
   `drizzle/migrations`: `graded_from_audio bool`, `rag_chunk_ids text[]`, `rag_chunk_count int`, `deepgram_ms int`,
   `upload_ms int`, `prosody_ms int`, `client_e2e_ms int`, `short_rep bool`.
2. **Persist evidence on the rep.** `transcript.words` (already in the payload, never stored) and the prosody
   feature bundle as JSON (`reps.prosody_features jsonb`).
3. **Soft-truncate instead of mock.** In the `score-shared.ts` post-validator, cut `coachFocus.behavior/why/action`,
   `headline`, `dimensions[].feedback` at their Zod caps on the last word boundary; never fail the score for length.
4. **Provider resilience.** `claude.ts`: Anthropic fallback timeout 20 s → 35 s. OpenAI 429 "no credits" gets its own
   `failure_reason` (`provider_credits`) and an error-level log for alerting.
5. **Honest mock.** A mock-fallback rep renders "We couldn't score this rep" with a retry, not a plausible 74. Keep
   the `RepScore` shape so downstream code is untouched.
6. **Aggregates filter `model_version`.** Any dashboard / weekly summary / progress query.

Tests: unit tests for truncation, telemetry write path, migration verify script. Verify: ≥ 20 real reps across
≥ 3 users with `rep_id` joined and `graded_from_audio` set; a forced 300-char `coachFocus.why` still yields a real
score; calibration suite unchanged (no prompt bytes touched).

### 2. Human ground-truth set (no app code; DB read-only)

Output dir `plans/calibration/human-labeling-2026-09/`:

1. `sample.json` — 60 real reps: exclude test accounts, seed and mock rows, reps < 5 words. Stratify composite band
   (<50 / 50–65 / 65–75 / 75+) × duration tercile × `audio_url` present; backfill thin cells (75+ has ~7 reps) from
   neighbours and record the strata used.
2. `labeling-sheet.csv` (two copies, rater A and B), blind: `rep_id, prompt, transcript, audio_link (signed, 7-day),
   duration_s, clarity_band, structure_band, conciseness_band, thinking_band, pacing_band, tone_band,
   headline_accurate, coach_focus_right_lever, hallucinated_claim, notes`. Band 1–5 per the RUBRIC band lists.
3. `model-scores.hidden.json` — six model scores + headline + coachFocus per rep, outside the sheet.
4. `scoring.mjs` — reads both sheets; Cohen's kappa per dimension; adjudication list (> 1 band apart); then
   band-match rate, MAE, Spearman, bias per dimension vs the model; feedback accuracy rates.
5. Add a harness mode to `scripts/calibrate-scoring.mjs` (or a sibling) that scores the 60 reps and reports the same
   metrics, so every later workstream can re-run it.

Never add this set to `reference-reps.json`; never run `reauthor-expectations.mjs` on it. Raters: Max + one other
(to be named). Verify: kappa reported per dimension; baseline metrics for the current pipeline recorded in the
tracker before workstream 3 starts.

### 3. Short-rep ruleset (`feat/short-rep-ruleset`)

Spec in §4. Files: `src/components/product/RepSurface.tsx` (delete the `speaking-gate` phase and modal, keep the
silent floor), the three `speakingThreshold={{ minRatio: 0.6 }}` call sites (`SkillLabSession.tsx`,
`workout-shell/RepControls.tsx`, `skill-lab-v2/AppSessionClient.tsx`), `src/lib/workout/pause.ts`
(`meetsSpeakingThreshold` → floor-only), `src/lib/scoring/rubric.ts` + `rubric-anchors.ts` +
`src/lib/ai/knowledge/skills/{conciseness,delivery}.md` (remove under-budget language), `score-shared.ts`
(length rule beside edge rule 5; rate line "n/a" under 8 s), `deterministic.ts` (drop ratio < 0.70 branch),
`RepSurface.tsx` sync body (send `timeBudgetMs`), `short_rep` flag from workstream 1. PRD has no speaking-gate
requirement. Tests: gate unit tests, rubric render snapshot, `scorePacing` cases. Calibration suite re-run (prompt
bytes change). Verify: a 6 s / 12-word rep scores with no modal; on ≥ 50 real reps no dimension feedback mentions
length; human-set metrics not worse than baseline.

### 4. Pacing rebuilt (`feat/pacing-rubric-score`)

Replace `scorePacing()` with a function of the rubric's own signals (all already in the bundle or the prosody
worker): WPM distance from 130–165 (graded docking above 170, per edge rule 3; mild below 110), quartile WPM
stability, pause placement (pauses 1–3 s after clause ends score up; > 3 s stalls and mid-phrase pauses score
down), filler rate, over-budget only. Output the sub-scores. Generate the Delivery feedback text from the same
numbers (template with the actual wpm / pause counts) so score and copy cannot disagree; keep the model's
`subSkill`/`quote` if consistent. Feed prosody-worker pauses when present. Retire the "default 78" prompt
instruction. Tests: table-driven cases covering each signal, monotonicity, idempotence on identical audio.
Verify on ≥ 50 real reps: ≥ 25 unique Pacing values; correlation with WPM-distance-from-band; zero headline/score
contradictions in a 25-rep read; human-set Pacing MAE improves.

### 5. Tone prosody-first (`feat/tone-prosody-first`)

1. Fix the prompt: PROSODY block and tone knowledge MD name the same fields (`pitchStdSemitones`, `pitchRangeSemitones`,
   `monotoneRatio`, `upspeakRatio`, `rmsStd`, `articulationScore`); delete the phantom fields.
2. Add a deterministic tone core from Praat features (pitch variability, monotone ratio, upspeak, RMS dynamics,
   articulation) with the LLM writing the narrative and adjusting within ±10 for context; when no audio, fall to
   the model with an explicit "text-only, lower confidence" tag surfaced in the UI.
3. Confirm PR #72 first: ≥ 30 audio-graded reps across ≥ 5 users, Chrome and Safari, before the deterministic
   core is tuned.
Calibration suite + audio-tone bank re-run. Verify on the audio reps: flat vs expressive separate by ≥ 20 points;
Tone no longer correlates > .4 with clarity; human-set Tone MAE improves.

### 6. Thinking Quality and noise (`feat/thinking-llm-and-noise`)

1. Remove the 60/40 blend; pass the disfluency bundle as SIGNALS input; re-check edge rules 2 / 2b on the human set.
2. Output order: per-dimension evidence (quote + one-line reason) before the score in the JSON.
3. Structured outputs (JSON schema) on the OpenAI path; tool-use schema on Anthropic; drop brace extraction.
4. Relevance check: cosine similarity between the prompt embedding and the transcript embedding (already computed
   for RAG); below threshold → apply the off-topic floor deterministically and say so in the headline.
Calibration suite re-run. Verify on ≥ 50 real reps: Thinking sd ≥ 12; same-transcript composite spread ≤ 6 over
10 runs; the firewall transcript floors on every prompt it does not answer; human-set metrics improve.

### 7. RAG decision (`feat/rag-ablation`)

Run bank + human set with RAG on/off (N = 3 each); write results to `plans/bench`. No accuracy gain →
`FF_RAG_RETRIEVE=false` for scoring by default (corpus stays for prompt-gen). Gain → keep with a similarity
threshold, per-rep chunk logging (workstream 1 columns), and retarget to reference reps with known scores
(`rag/reference-reps.ts`, unused today) or framework/domain chunks only on framework-backed prompts. Verify: a
written on/off result with MAE and latency per dimension.

### 8. Latency (`feat/scoring-latency`)

Upload ∥ transcribe on the client; trigger the prosody worker at upload time; start the LLM call without awaiting
RAG (drop or race it); move `loadUserContext` in parallel with body parsing; adopt the shorter output from
workstream 6. Re-bench the model lineup (last benched July) on the human set. Target: score visible < 7 s p50 on
the sync path. Verify: stop-recording → score-visible measured before and after on ≥ 50 real reps per condition,
≥ 3 days, ≥ 5 users; p50/p90/p99 with n and browser mix; ship only if p50 < 7 s and p90 does not regress.

### 9. Hygiene (`chore/grading-hygiene`)

Delete dormant arms (`score-arms.ts`, `score-arm-b.ts`, `reference-anchors.ts` unless workstream 7 uses it) and
`rag/reference-reps.ts` if unused; drop the 184 KB knowledge bundle from the scoring function; reconcile the two
WPM lines; bump `reference-reps.json.rubricVersion`; align calibration README tolerances with code; refresh or
archive `SCORING_METHODOLOGY.md`, `GRADING_SYSTEM.md`, `EVALUATION_SYSTEM_V2.md`; regenerate
`Cognify grading docs/00–07` from the final prompt stack.

---

## 4. Short-rep ruleset

Goal: length is never a reason to block, warn, or dock. Content is judged on whether it served the prompt.

**UI**
1. Remove the `speaking-gate` phase and modal. No duration-ratio check, no word-count check.
2. Keep one silent "nothing to grade" floor: fewer than 5 recognised words **and** under 3 s of speech.
   Show the mascot line ("Too short to score. Try one full thought before the cut.") inline and return to
   record. No modal, no choice. (5 is a starting value; tune from data.)

**Grading prompt / rubric**
3. Remove "within 10% of time budget" and "finishes within budget" from the conciseness and delivery band
   anchors and the slim skill MDs. Keep over-running as a conciseness signal ("kept talking past the content").
4. Add one explicit rule near edge rule 5: "Never cite length, duration, or word count as a deficiency. Judge
   whether the content completed the prompt. An incomplete answer loses on Thinking Quality or Clarity for what
   is missing, not for being short."
5. Rate line: when duration < 8 s, render `MEASURED RATE: n/a (too short to measure)` and tell the model not to
   dock delivery on rate.

**Deterministic layer**
6. Remove the under-budget branch (ratio < 0.70) from `scorePacing()`; keep the over-budget branch and start
   sending `timeBudgetMs` on the sync path so it works.
7. In `scoreThinkingQualityDeterministic`, scale pause/stall penalties by duration so a 10 s rep with one pause is
   not treated like a 60 s rep with six (moot once workstream 6 drops the blend).

**Evidence**
8. Persist `short_rep` (duration < 15 s) so we can check whether short reps are systematically scored low after
   the change.

---

## 5. Human labeling protocol (workstream 2)

- **Sample**: 60 real reps from prod, excluding `@cognify.test`, mock and seed rows. Stratify: composite band
  (<50 / 50–65 / 65–75 / 75+) × length tercile × audio present. Include the 18-rep July QA set if it can be
  re-recorded.
- **Raters**: Max + one other. Blind to model scores. Listen to audio where it exists; otherwise transcript.
- **Per rep**: band (1–5) per dimension, optional point score, plus three binaries: headline accurate?
  coach focus is the right lever? any quote / claim not in the transcript?
- **Agreement**: Cohen's kappa per dimension; adjudicate any disagreement > 1 band.
- **Metrics vs model**: band-match rate, MAE, Spearman, bias (over/under) per dimension; feedback accuracy rate.
- **Budget**: ~2 min/rep → ~2 h per rater.
- **Storage**: `scripts/calibration/human-labeled-2026-09.json` (never re-authored from model output).

---

## 6. Open questions

- Second rater for workstream 2.
- Whether to keep RAG at all if workstream 7 shows no gain (recommendation: off for scoring, keep corpus for prompt-gen).

---

## 7. Handoff

- Paste-in prompt: `plans/handoff-grading-p0-p1.md`.
- Analysis scripts and outputs behind §1: `scripts/qa/grading-audit/` (`db.mjs` reads `.env.local`, SELECT-only).
- Team-readable prompt stack: `~/Documents/Projects/Cognify grading docs/00–07`. Verified byte-equal to code except:
  block 5 (calibration/coaching memory) is appended to system but not cache-controlled; doc 01 shows `\`why\``
  with literal backslashes; docs are silent on model (gpt-4o primary, Haiku 4.5 fallback), timeouts (35 s / 20 s),
  temperature 0.2, max_tokens 2500, and the absence of JSON mode.
- Shareable page: https://claude.ai/code/artifact/bf9f763d-81ab-4760-a301-ebaeb0d85248.
