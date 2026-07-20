# System Change v2 — Holistic Verification Pass (2026-07-20)

Read-only/verify pass after Phase 6 prod promotion. No prod or code changes made.
Prod target: https://cognify-v2-neon.vercel.app · main HEAD `7cb8f8c7` · provider OpenAI gpt-4o.

## TL;DR

- **Plan complete, prod live and correct.** All Phase 0–6 build items are done; the only open
  items are Max-owned watch/follow-up (nightly drift watch, prosody-worker prod deploy, auth+mic
  smoke). build/test/lint green; prod flags exactly as specified; 0 mock-fallbacks anywhere.
- **Grading is directionally sound and honest at the low/mid end.** Junk scored 14 (not floored),
  off-prompt detected, bands ordered correctly, dimension independence works on 4 of 6 stress reps,
  all `strongerVersion` quotes verbatim (incl. an 907-char run-on — quote-cap fix confirmed live),
  rewrites are the user's own content upgraded.
- **Three real quality gaps** (none are crashes/data bugs; all are scoring-prompt/calibration
  matters gated by the calibration guardrail + Max sign-off):
  1. **Headlines are echoed verbatim from the prompt's 3 band-example sentences** (~11/18 reps) —
     the most visible copy the user sees is often generic, not rep-specific.
  2. **`thinking_quality` under-rates concise/disorganized insight** and conflates "depth" with
     "has evidence" — the dominant mechanism behind the known upper-tier under-rating.
  3. **coachFocus over-concentrates** on two reflexive fixes (add first/next connectors; add
     evidence); tone is never a focus.
- **Upper-tier under-rating quantified:** a genuinely elite investor pitch landed **75** (expected
  85+); no rep in a diverse strong set cleared 78. ~7–10 points below fair expectation.

---

## Part 1 — Plan completeness

Every Phase 0–5 checkbox is complete and merged (PRs #5, #6, #11, #12, #13, #14, #15 on the fork).
Phase 6 status:

| Item | State |
|---|---|
| 6.1 Prod reseed/prune | ✅ done (shared DB; 4,148 active prompts, 0 below slate floor) |
| 6.2 Flag promotion | ✅ done (all flags verified below) |
| 6.3 Prod smoke (non-auth) | ✅ done |
| 6.4 Post-promotion watch | 🟡 open, Max-owned — drift cron pre-validated green (see PR #15) |
| process-rep edge fn deploy | ✅ done (PR #14, ae426e2d) — ahead of the session-9 tracker log |
| Prosody worker prod deploy (Modal) | 🟡 open, Max-owned follow-up |
| Auth + mic smoke matrix (#3–#17) | 🟡 open — needs real creds + mic + browser |

Note: the tracker's session-9 log slightly trails git — process-rep deploy and drift-cron
pre-validation both landed (PRs #14/#15) after it was written. No genuinely-open *build* work
remains; the three open items are all operational and Max-owned.

## Part 2 — Prod-live status (evidence)

- **Deploy:** `dpl_3YowfEwpG6J7jyBZcSGWgC1mcMuX`, target production, ● Ready, created 2026-07-20
  09:25 (fresh), alias `cognify-v2-neon.vercel.app`. Embodies post-#12 code (proven: the 907-char
  run-on rep scored real, not mock — that only passes with PR #12's quote-cap fix live).
- **`GET /` → 200** with all 6 security headers (CSP, HSTS preload, Permissions-Policy
  `microphone=(self)`, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy).
- **`GET /api/score/health` → `{ok:true, provider:"openai"}`.**
- **Flags (via `vercel env pull` production):** `AI_PROVIDER=openai` · `FF_MUSCLE_GROUP_WORKOUT`,
  `FF_TRAINING_ENGINE_V2`, `FF_SKILL_LAB_APPS`, `FF_BUILD_A_REP_V2`, `FF_PROMPT_GEN` = **true** ·
  `FF_PROSODY_WORKER=false` · `NEXT_PUBLIC_USE_ASYNC_SCORING=false` · (bonus)
  `FF_DETERMINISTIC_SIGNALS=true`, `FF_BAND_ANCHORS=false`. **Exact match to spec.**
- **build/test/lint:** `npm run build` compiled in 17.1s; `npm test` 906+ passed / 0 failed across
  21 suites; `npm run lint` "No ESLint warnings or errors". All exit 0.

## Part 3 — Automated verification results

| Check | Result |
|---|---|
| `calibrate-scoring.mjs` (48 reps, prod) | **3 failures, 0 mock** — all boundary/noise (clarity off by 5; `qa-excellent-board` composite +7; one persuasive structure +17). Meets ≤5 criterion. |
| `verify-scoring.mjs` (prod) | **All assertions pass** (6/6 per-skill feedback, verbatim quote, headline ≤90, coachFocus, non-mock `openai:gpt-4o-2024-08-06`, rubric v4.0.0). Exit 127 = known Windows libuv teardown race after success. |
| `smoke-bar-llm.ts` (local, real model) | **5/6.** Named-questions→exact moments, suggestions rail, coachCue/scoringHint, notes auto-draft all PASS. 1 FAIL is an over-tight test assertion ("1–3 bullets/section"; generator emitted a valid 4-bullet STAR section) — not a product defect. |
| `phase-baseline.mjs` (prod) | total **p50/p95 = 8.4s / 10.1s**, model 8.1/9.5s, **0% mock, 0% openai-fallback**, 100% cache. Within budget. |
| Drift cron `?dryRun=1` (prod) | 29 reps, **25 ok / 4 minor drift / 0 fallback / 0 error**, avg |Δ| 2.1, worst 9, alert **skipped** (aggregate gates avg>5 / worst>15 not tripped). Healthy. |
| `calibrate-audio-tone.mjs` (local + Praat worker) | **All tone pair separations pass** (expressive−flat = +30/+20/+35/+28) and pacing (+15…+30), `toneSource: prosody` throughout. 1 per-clip boundary miss (tone 58 vs 60 on a TTS clip, script self-annotated). Confirms tone/delivery genuinely react to audio. |

## Part 4 — Grading-quality deep-dive (18 fresh authored reps)

Text-only scoring via prod `/api/score` (no `words`/audio sent — so **delivery/tone below are
text-conservative and not representative of prod's real, Deepgram-word-timed delivery**; the audio
axis is covered separately above). Expected profiles were written before scoring
(`scripts/qa/grading-quality-reps.mjs`).

Per-dimension: cla=clarity str=structure con=conciseness thk=thinking del=delivery ton=tone.

| Rep (tier/type) | Exp comp | Got | cla str con thk del ton | Verdict |
|---|---|---|---|---|
| junk off-prompt | 8–30 | **14** | 15 10 10 5 30 25 | ✅ accurate — off-prompt caught, not floored, `strongerVersion:null` |
| poor rambling update | 28–45 | **28** | 25 30 20 20 45 40 | ✅ accurate — conciseness weakest |
| competent project update | 58–72 | **73** | 78 72 85 65 70 65 | ✅ accurate (+1) |
| strong behavioral interview | 66–80 | **77** | 81 78 85 75 65 70 | ✅ accurate |
| **excellent investor pitch** | **82–94** | **75** | 85 78 90 68 45 70 | ⚠️ **under-rated ~7–19** (known limit; text-only delivery 45 the big drag) |
| strong objection handling | 66–80 | **76** | 85 72 78 65 80 75 | ✅ accurate |
| competent wedding toast | 58–74 | **71** | 85 65 80 50 75 70 | ✅ accurate — genre-appropriate (thk lowest, not penalized as fatal) |
| strong teaching explainer | 66–80 | **78** | 85 75 90 65 80 70 | ✅ accurate |
| competent deliver bad news | 62–78 | **74** | 78 72 85 55 78 82 | ✅ accurate — tone 82 (empathy recognized); coachFocus mildly generic |
| competent persuasive ask | 62–77 | **78** | 85 78 82 72 75 70 | ✅ accurate (+1) |
| indep clear-but-shallow | 38–55 | **46** | 45 40 55 30 60 65 | ◐ partial — thk cratered ✓ but clarity not "high" (45) |
| indep organized-but-empty | 33–52 | **51** | 45 55 65 30 70 60 | ◐ partial — structure(55) held above thk(30), gap 25 ✓ |
| **indep deep-but-disorganized** | 40–58 | **50** | 45 50 65 **40** 50 55 | ❌ **independence fail — thk(40) < str(50)** though coaching admits "your ideas were there" |
| indep concise-but-vague | 30–50 | **51** | 50 40 85 30 55 60 | ✅ excellent independence — con 85 / thk 30 (gap 55) |
| indep padded-but-clear | 40–58 | **51** | 55 45 40 50 65 60 | ✅ accurate — conciseness weakest |
| indep jargon-tangled | 30–50 | **40** | 25 30 75 35 40 50 | ✅ excellent — clarity 25 (audience mismatch), thk 75 (reasoning sound) |
| **indep brief-but-deep** | 55–72 | **70** | 75 65 85 **55** 75 70 | ◐ partial — brevity not floored ✓ but genuine insight scored thk 55 + told "lacks depth" |
| edge run-on long quote | 48–66 | **61** | 55 45 75 70 65 60 | ✅ accurate + **primary edge PASS** (907-char verbatim quote, no mock) |

**Composite fidelity: 17/18 landed within (or within 1 of) the pre-registered range.** The single
real miss is the excellent investor pitch.

### Coaching-quality read

- **strongerVersion: excellent.** 17/17 non-junk reps present, **all quotes verbatim** (tolerant of
  whitespace), incl. the 907-char run-on. Rewrites upgrade the user's *own* content (e.g. the
  buy-vs-build stream reorganized into the user's actual points), never a generic exemplar. Junk
  correctly returns `null`.
- **coachFocus: one objective, always populated, but over-concentrated.** Distribution across 18:
  structure 9, thinking_quality 4, clarity 2, conciseness 2, delivery 1, **tone 0**. Two reflexive
  fixes dominate: `structure/transition_control` "add first/next connectors" (5×, applied even to
  the clean-STAR behavioral answer and the objection response) and `thinking_quality/claim_support`
  "add evidence/examples" (4×, applied to the genuinely-insightful brief answer that does *not* lack
  depth). The highest-leverage issue is not always the mechanically-lowest dimension.
- **Per-skill feedback** does explain scores in terms of what the speaker did (6/6 dims populated).
- **nextRepHint** is honest and ≤60 chars, but frequently mirrors the reflexive coachFocus
  ("support your claims with evidence").
- **headline: often NOT rep-specific.** ~11/18 headlines are **verbatim copies of the 3 band-example
  sentences** hardcoded in the scoring prompt (`score.ts:378–380`). "Clean from open to ask. Tighten
  the middle and this is a 90." was returned identically for a behavioral interview, an objection
  response, a bad-news delivery, a raise ask, and a project update. A rep at composite 73 even got
  the 75–89 band's example, so the echo mis-bands. About 6–7 reps got genuinely specific headlines
  (wedding toast, teaching, investor pitch), so it is not uniform — but the band examples are being
  lifted as-is on the majority.

### Overall grading-fidelity verdict

**The pipeline accurately represents low and mid-tier reps and dimension independence in the
concise/padded/jargon/audience axes; it partially misrepresents genuine analytical depth and
systematically under-rates the top tier.** Concretely:

- **Low/junk end is honest** — junk 14 (not floored ~40), off-prompt detected, no false praise.
- **Independence works on 4 of 6 stress reps** (concise-but-vague, padded-but-clear, jargon-tangled,
  organized-but-empty). It **fails on the two "deep thinking" reps**: `thinking_quality` is not
  separated from structure/length — disorganized or brief insight is scored as shallow (thk 40 and
  55), and the coaching says "lacks depth" when the rep's defect is *elaboration/proof*, not depth.
- **Upper-tier under-rating (known §3.6 limit), quantified:** the elite investor pitch landed **75**
  vs an expected 85+ (~10 below a fair mark, up to 19 below the ceiling of my range); a diverse set
  of genuinely strong reps all capped **75–78**. The bank's own "excellent" reference rep scores 71
  (phase-baseline) — the ceiling is baked in. Mechanisms: (a) `thinking_quality` strictness above,
  and (b) the narrow **150–160 wpm** delivery band, which penalizes measured 130–140 wpm speech
  (the pitch's text-derived delivery = 45 was its single biggest drag).

## Part 5 — Prioritized findings

No crash-level, data-integrity, or mock-fallback bugs were found. All items below are
scoring-prompt/calibration quality matters; **each touches the calibration-guarded scoring prompt,
so any fix requires a calibration replay + Max sign-off — I did not change prod or code.**

**P1 — Headlines echo the prompt's band examples. ✅ FIXED (branch `fix/headline-echo-band-examples`).**
`score.ts:378–380` gave three ready-to-use example headlines; gpt-4o returned them verbatim on the
majority of reps, so the most prominent piece of user-facing copy was generic and sometimes
mis-banded. Fix: replaced the quotable exemplars with tone *descriptions* + an explicit "never output
a stock sentence; be specific to THIS transcript within ≤90 chars" rule. Validation:
- Re-scored the 18 reps on the branch → **0 duplicate headlines** (was 3 templates covering ~11/18),
  every headline now names the rep's actual content; **0 over 90 chars**; **0 mock**.
- Full `calibrate-scoring.mjs` replay on the branch → **3 failures / 0 mock**, same count + shape as
  the pre-change baseline; `qa-excellent-board` fails +8 vs +7 before, i.e. the change is
  **score-neutral** (confirmed the guardrail: headline copy, not scoring, moved).
- typecheck + grading-v3 contract tests green. `/code-review` (high) → 1 finding (a 95-char headline
  from the weakened brevity anchor) found + fixed (re-anchored the ≤90 limit).

**P2 (Phase-7 grading scope) — `thinking_quality` under-rates concise/disorganized insight.**
It conflates "depth" with "presence of evidence/examples," so a sharp 2-sentence causal insight
(brief-but-deep) is marked "lacks depth," and disorganized-but-deep reasoning is dragged below its
own structure score. This is the dominant driver of the upper-tier under-rating. Fix belongs with the
eventual grading recalibration (rubric wording + re-baseline), not a hotfix.

**P3 (Phase-7 grading scope) — coachFocus concentration.** Structure/transition_control and
thinking_quality/claim_support account for ~11/18 focuses; tone is never chosen. Consider a
"highest-leverage, not lowest-score" selection rule and genre-awareness (a wedding toast or bad-news
delivery rarely needs "add evidence").

**P4 (accepted limitation — quantify, don't re-file) — upper-tier compression.** Elite/strong reps
cluster 75–78. Track as-is per §3.6; the bank pins current behavior for drift, not quality.

**P5 (operational, Max-owned) — prod tone fidelity gap.** With `FF_PROSODY_WORKER=false`, prod tone
runs the text-conservative tier; the audio path is proven to work (Part 3) but isn't live until the
Modal worker is deployed. Prod delivery *is* real (Deepgram word timings); only tone is degraded.

### Non-issues (logged so they aren't re-investigated)
- smoke-bar #3 "1–3 bullets/section" — over-tight test assertion, valid 4-bullet output.
- calibrate-scoring 3 failures — boundary noise, ≤5 criterion met.
- verify-scoring exit 127 — Windows libuv teardown race after a clean pass.

## Reproduction artifacts
- `scripts/qa/grading-quality-reps.mjs` — the 18 authored reps + pre-registered expected profiles.
- `scripts/qa/score-grading-quality.mjs` — the scoring harness (guest cookie, verbatim check).
- Run: `BASE=https://cognify-v2-neon.vercel.app CALIBRATION_GUEST_ID=<uuid> node scripts/qa/score-grading-quality.mjs`.
