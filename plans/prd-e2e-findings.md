# Phase 12 — E2E findings ledger

Per Max 2026-07-06: "once weve built everything we are then going to test
everything end to end then document additional fixes we need then build
that as well". Every finding gets an entry; Phase 13 builds them and
checks them off. Loop until empty.

**Environment**: dev on :3333, OpenAI provider (Anthropic dead — revert at
re-up), flags default-ON outside production. Accounts: `demo@cognify.test`
(populated, 90 reps) / `e2e-harness@cognify.test` (cold-start).

**Severity**: 🔴 broken flow or wrong data · 🟠 degraded UX or wrong copy ·
🟡 polish / quality.

## Status legend
- [ ] open · [x] fixed (link commit)

---

## Test runs

| Run | Result | Notes |
| --- | --- | --- |
| Unit suites (`npm test`, 11 suites) | ✅ 501 pass / 0 fail | post-11.D/E |
| Smoke harness (`smoke-engine-v2.ts`, live OpenAI) | ✅ 11/11 | AFTER the D3 scoring-context change (scoring_emphasis + failure modes now render for all 94 exercises) |
| Bank expansion (11.D4) | ✅ 940 prompts, 0 failures | quality note → F-1 |
| Drift replay vs OpenAI baseline | ✅ identical | 29 reps: avg \|Δ\| 7.8 (= baseline), max 23 (base 22), 0 errors/fallbacks; only 2 reps moved ≥8 vs baseline (run noise). D3 scoring-context change did NOT shift calibration. |
| Unauthed e2e (13 specs, iPhone-14) | ✅ 13/13 | re-ran green after all F-fixes |
| Authed live loops (workout / skill lab / build-a-rep) | ✅ 3/3 | workout loop surfaced F-2..F-7 before passing; skill lab + BaR green after the machine change |
| Route sweep (all app routes × cold-start + populated) | ✅ 30/30 + populated check | now asserts the SESSION IS RECOGNIZED (no "Sign in" button) — plain render checks passed even while auth was degraded |
| Cron dry-runs | ✅ 6/6 | calibration-drift, audio-retention, committed-day-reminder, muscle-group-day-rollover (dryRun) + weekly-callout-drift (empty, expected), weekly-narrative (LIVE gen, 2 users, 0 errors) |
| Session probe (zz-auth-probe) | ✅ | permanent guard for F-2-style degradation |
| Generation quality review | ✅ acceptable | 40-prompt random sample: most carry audience/setting framing, topic spread per §5.6 clearly visible (town halls, gardening, interviews, art, sports). See F-1 (downgraded). |

---

## Findings

### F-1 🟡 Some generated prompts are bare abstract asks (minor)
- **Surface**: prompt-gen (11.D4 expansion output, `tags: ["generated"]`, 940 rows)
- **Assessment (40-row random sample)**: majority WELL-framed with named
  listener/setting; §5.6 topic spread visible. A minority are bare asks
  ("Make the case that smartphone apps are eroding privacy standards") —
  mostly on exercises whose rule doesn't demand an audience, where that's
  acceptable. The one truly thin batch seen in debugging (headline-first
  yes/no one-liners) predates the register examples flowing correctly.
- **Disposition**: ACCEPT for now — live selection mixes curated + generated,
  and QA already dedupes. Revisit at Anthropic re-up (Sonnet was the
  intended generator); if Max dislikes any surfaced prompt in eyes-on
  testing, prune with `scripts/prune-prompts.mjs`.

### F-2 🔴 FIXED — dev-server HMR leaked DB pools → pooler EMAXCONN → auth silently degrades to guest
- **Symptom**: after a day of editing, Supabase's pooler hit its 200-client
  ceiling; `resolveSupabaseUser` failed on EVERY request and `currentUser`
  fell through to the guest cookie — signed-in users get the guest
  experience with no error anywhere.
- **Cause**: `src/lib/db/client.ts` cached its postgres pool per MODULE
  INSTANCE; Next dev HMR replaces the module on every recompile, orphaning
  each pool's sockets (up to 10 apiece).
- **Fix**: pool cached on `globalThis` (survives HMR) + `max: 6`. The
  guest-degradation failure mode itself still exists by design ("degraded
  mode") — the new route-sweep session assertion + zz-auth-probe make it
  loud in testing. **Prod note**: serverless doesn't HMR, but the silent
  auth degradation under DB pressure is worth an ops alert someday.

### F-3 🔴 FIXED — streaks were ALWAYS zero (42803 on every getStreakStatus call)
- **Symptom**: `column "reps.created_at" must appear in the GROUP BY clause`
  on every dashboard/workout render; safeDb returned the zero-streak
  fallback, so streak UI has shown 0/empty since the May 25 TZ-keying audit.
- **Cause**: the SELECT/GROUP BY/ORDER BY each interpolated `${tz}` as its
  own bind parameter ($1/$2/$3) — Postgres can't prove the expressions
  equal, so the grouped query is invalid. Unit tests mock the DB; nothing
  caught it.
- **Fix**: `GROUP BY 1 / ORDER BY 1 DESC` (position, parameter-immune).
  Verified live: demo user now returns streakDays=16, freeze applied
  2026-06-13.

### F-4 🔴 FIXED — daily-workout reps NEVER persisted on resumed days (and fresh-day saves went sessionless)
- **Symptom**: `reps_session_id_practice_sessions` FK violation on every
  rep save of a RESUMED day; saveRep's fallback swallowed it, the UI loop
  kept "working" on in-memory scores, and NOTHING landed: no rep rows, no
  coaching ledger, no profile fold, no XP, no day progress. There was not
  a single daily_workout-mode rep in the dev DB.
- **Cause**: the shell passed `workout_sessions.id` into RepSurface's
  `sessionId`, but `reps.session_id` FKs `practice_sessions`. Fresh days
  "worked" only because the payload id was still null pre-refresh, so
  saveRep self-created a session.
- **Fix**: `practiceSessionId` threaded end-to-end (payload schema →
  workout page + startMuscleGroupDay both branches → WorkoutShell →
  RepControls → RepSurface). Verified live: first+retry rows persist with
  lineage, coach_focus, coaching_events, mode='daily_workout'.

### F-5 🔴 FIXED — Coach's Focus silently vanished when the model picked structural_adherence
- **Symptom**: on framework-graded reps (e.g. The Word Budget + Feynman),
  GPT-4o often sets `primaryFocusDimension: structural_adherence`;
  `deriveCoachFocus` returned NULL for it → no Coach's Focus card, no
  retry overlay, no retryContext, no ledger row — the v2 "exactly ONE
  Coach's Focus per rep" contract broke on exactly the reps most about
  structure.
- **Fix**: redirect instead of bail — first non-structural bullet, else
  weakest scored core dimension; null only for true mock-fallback shapes.
  Unit tests pin the redirect (17 pass).

### F-6 🟠 FIXED — "Start your Retry" tap dropped when it beats SCORE_DONE to the machine
- **Symptom**: RepSurface renders the v2 feedback (and its CTA) from its
  own local state before the day machine processes SCORE_DONE; a fast tap
  dispatches BEGIN_RETRY while the machine is still in
  recording/transcribing/scoring, where it was silently ignored — dead
  button until a second tap. The async rep path (live post-F-4) widens
  the window to seconds; the e2e spec hit it deterministically.
- **Fix**: mirror of the existing SCORE_DONE hoist — early BEGIN_RETRY
  sets `pendingBeginRetry`, consumed by finishRepWithScore (straight into
  the retry) and dropped on FAIL_SCORE (degraded path offers ADVANCE).
  Machine tests pin both (95 pass).

### F-7 🟠 FIXED — completedReps double-counted re-recorded first attempts
- **Symptom**: leave mid-exercise → resume → new first attempt on the SAME
  station incremented `completed_reps` again; interrupted days "completed"
  with exercises skipped (the e2e day hit 3/3 after 1.5 exercises).
- **Fix**: recount `COUNT(DISTINCT exercise_id)` of non-graduation first
  attempts inside the tagging tx (idempotent under resume/replay); legacy
  `+1` kept only for the exercise-unresolved degraded path.
- **Verified on a resumed day**: second consecutive live loop green; a
  duplicate first attempt on the same station left completed_reps at 1.

### F-8 🟡 OPEN (accepted) — resume position can lag one station on abrupt exit
- **Observed**: after completing exercise 1 and advancing to station 2's
  picker, killing the browser before the fire-and-forget
  `updateWorkoutSessionStation` write lands means the next resume starts
  back at station 1. The user redoes an exercise; F-7's recount keeps the
  day target honest, so no corruption — just repetition.
- **Disposition**: accept. Normal navigation persists the pointer; only
  an instant kill in the ~1s window loses it. Revisit only if eyes-on
  testing surfaces it as annoying.
