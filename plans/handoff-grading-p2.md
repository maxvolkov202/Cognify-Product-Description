# Handoff: grading plan, phase 2 (paste after /clear)

Supersedes `plans/handoff-grading-p0-p1.md` (stale; all nine workstreams shipped 2026-08-28/30).

```
I'm continuing the Cognify grading work. All nine workstreams of plans/grading-audit-2026-08-26.md §3
(plus 1b middleware, 1c prompt-slate latency, WS8's prosody-at-upload, the bank-fill cron) are MERGED
AND DEPLOYED — do not restart any of them. Read, in this order:

1. plans/system-change-v2-progress.md — every "Grading WS" entry from 2026-08-28 onward, bottom-up;
   the last "Next:" line is where we are.
2. plans/grading-audit-2026-08-26.md — §2 evidence gates and the status header only.
3. CLAUDE.md conventions (branch + PR for every change; Claude runs commit → PR → review → merge →
   deploy end to end; calibration re-run on any prompt-byte change, noted in the tracker).

Facts not to re-derive:
- Rubric v4.2.0 is live. Pacing is a measured five-sub-score function (no more 92 clump); Thinking is
  the model's score (blend retired) with a DISFLUENCY prompt line; length is never a deficiency.
- Built but OFF pending the human set: FF_TONE_PROSODY_CORE, FF_RELEVANCE_FLOOR,
  SCORING_EVIDENCE_FIRST, SCORING_OPENAI_JSON_MODE. Scoring RAG is OFF (FF_RAG_RETRIEVE=true re-enables).
- The calibration bank is a DRIFT ALARM only (identical-bytes runs range 17–24 fails of 48); never
  re-author it. Accuracy calls come from the human set via
  scripts/calibration/human-labeling/rescore.mjs --label <name>.
- .env.local's DATABASE_URL IS the prod pooler: any script reading it is a prod action; migrations are
  applied with apply-migration.mjs (append-only) and probed by verify-prod-migrations.mjs.
- Run local calibration with `npm run dev` (plain `next dev` skips build:knowledge). /code-review kept
  reviewing merged files; use a targeted agent on `git diff main...<branch>` instead.
- Prod e2e: PW_BASE_URL=https://www.cognifygym.com PW_STORAGE_STATE=tests/e2e/authed/.auth/prod-fresh2.json (add E2E_LIVE_METRICS=0 while FF_LIVE_REP_METRICS is off in prod — the measured-delivery assertions skip)
  npx playwright test tests/e2e/authed/<spec> --config playwright.p5.config.ts (fake mic; harness
  accounts; the daily-workout specs consume that account's day). Every shipped phase gets a prod e2e
  pass; delete/refresh the storage states if auth fails.

Execute, in order:
1. If the labeling sheets (rater A = Max, rater B = Owen Brown;
   plans/calibration/human-labeling-2026-09/) are filled: run scoring.mjs, record the baseline in the
   tracker, adjudicate >1-band gaps with the raters, then rescore.mjs for labels ws3, ws4,
   ws6-evidence-first (SCORING_EVIDENCE_FIRST=true), ws6-json (SCORING_OPENAI_JSON_MODE=true), rag-on
   (FF_RAG_RETRIEVE=true) against a local `npm run dev` server, and bring Max the flag decisions with
   numbers. If audio links are expired (signed 2026-08-28, 7 days), re-run build-packet.mjs ONLY to
   re-sign — never resample. If the sheets are not filled, remind Max + Owen and continue with 2–4.
2. Evidence-gate sweep (read-only SQL via scripts/qa/grading-audit/db.mjs): WS1 join (≥20 real reps /
   ≥3 users), WS3 no-length-feedback + short_rep distribution, WS4 Pacing spread (≥25 unique values,
   ≥50 reps), WS5 audio gate (≥30 audio reps, ≥5 users, Chrome+Safari), WS6 thinking sd + same-transcript
   spread + relevance-tag distribution (sets the FF_RELEVANCE_FLOOR threshold), WS8 client_e2e_ms
   p50/p90 vs the <7 s target, 1b zero MIDDLEWARE_INVOCATION_TIMEOUT over 7 days from 08-28, 1c slate
   latency. Real reps only (exclude @cognify.test, seed, mock). Record results in the tracker; close
   gates that pass, flag ones that fail to Max.
3. Check cron_runs: muscle-group-day-rollover (fixed 08-30) and expand-prompt-bank (new 08-30) both
   green on their latest runs; investigate if not.
4. Deferred cleanup PR: remove the unused scoring arms (median-of-n, all-llm, grouped-fanout,
   tone-decomposed, reference-anchors.ts, rag/reference-reps.ts) — score-arms.ts STAYS (it is the live
   dispatcher and prod's signals-drop arm); keep control + signals-drop + the blend config option arms
   tests still cover. Also the WS4-review audit-script cleanups (scratchpad OUT path, emails on stdout,
   Date.now anchoring, duplicated analyze*.mjs). Branch → PR → targeted review → merge → deploy →
   prod e2e (skill-lab-loop at minimum).

Standing: OpenAI credits were re-upped 2026-08-30 — watch model_used for anthropic-fallback rate (an
alert on that rate is an open follow-up). Stop and ask Max at any unmet verify gate, before anything
destructive, and whenever the PRD conflicts with the plan.
```
