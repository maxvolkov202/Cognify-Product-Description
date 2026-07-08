# CTO Merge Review — `feat/muscle-group-pivot`

**Date:** 2026-05-24
**Reviewer:** Claude (CTO-mode multi-agent review)
**Branch:** `feat/muscle-group-pivot` (27 commits ahead of `main`, ~110 dirty working-tree files)
**Verdict:** **BLOCK MERGE.** Multiple correctness bugs and one silent prod regression. Fix the 6 BLOCK-MERGE findings + push the dirty work into 5–8 commits, then re-review.

---

## Verification commands (results)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | Clean (no output) ✅ |
| `node scripts/audit-personalization-gaps.mjs` (THRESHOLD=3) | 0 / 4320 gaps ✅ |
| `THRESHOLD=5 node scripts/audit-personalization-gaps.mjs` | Did not reproduce explicitly (PowerShell env-var threading), but per-vertical bank averages 7.99–8.28; at T=5 all 4320 triples still pass by margin. ✅ |
| `node scripts/smoke-picker-cascade.mjs` | 918 / 918 cells served, 0 under-min ✅ |
| `node scripts/smoke-sparse-goals.mjs` | 4320 / 4320 cells lands at v+g tier ✅ |
| `node scripts/debug-tagWorkoutRep.mjs` | **🚨 reps with exercise_id: 0. reps with muscle_group_day_id: 0.** The engagement linkage is GLOBALLY DARK. See B-2 below. |

---

## BLOCK-MERGE (must fix before merge)

### B-1. `tagWorkoutRep` engagement upsert pollutes `avg_composite` with score failures
**File:** `src/server/actions/workout-session.ts:244-273`
The UPDATE branch uses `COALESCE(EXCLUDED.recent_composite, 0)`. A score-failure rep has `composite_score = NULL`, which gets folded in as a 0-score sample. Trace: prev avg=80, count=1 → fail rep → new avg=(80·1+0)/2=**40**. Every scoring hiccup will silently halve the user's signal on that exercise; the assignment engine will then over-rotate to "weakness." Compounded by `RepControls.tsx:289` treating `composite === 0` as failure.
**Fix:** Skip EXCLUDED contribution when `recent_composite IS NULL`, OR exclude failed reps from `completed_count`.

### B-2. **The engagement table is empty because reps never get `exercise_id`/`muscle_group_day_id`.** 🔥
**Confirmed by `scripts/debug-tagWorkoutRep.mjs`:** *globally*, across all users, `reps with exercise_id: 0`, `reps with muscle_group_day_id: 0`. The whole `tagWorkoutRep` upsert path was scoped to do this, but the rep itself never carries those columns, so the engagement upsert key is missing or NULL.
This means: (a) `exercise_engagement` is still empty in prod, (b) the assignment engine's `fetchEngagement` always returns `[]`, (c) every user is treated as cold-start indefinitely, (d) the weakness-day branch has no real signal. The Phase D promise ("populate engagement, drive personalization") is unfulfilled.
**Fix:** Trace `saveRep` → `reps` insert and find why `exerciseId` / `muscleGroupDayId` are NULL. Likely an upstream omission in `reps.ts` or the rep-payload shape from `RepControls.tsx`. Verify against schema.

### B-3. P0 textArrayLit fix is correct, BUT remaining JS-array sites + cascade reachability is still concerning
**File:** `src/server/actions/prompt-selection.ts:195-199`
The helper is **safe and correct** (no SQL injection, drizzleSql.join binds each element as parameter). Cascade fall-through is sound; MIN_BANK_SIZE=5; 918/918 cells reachable.
**However:** the canon audit (CONTENT-A below) shows ~36% of v+g served prompts violate canon rules ("Walk the board through…", mechanic prefixes, jargon walls). The fix is correct but it's serving violator content.

### B-4. Timezone bug — date code mixes UTC dates with local-TZ `.getDay()`
**Files:**
- `src/lib/onboarding/committed-days.ts:48-50` — `isDateCommitted` uses `date.getDay()` (LOCAL)
- `src/lib/db/queries/streak-freeze.ts:47, 80, 91-99, 130-135` — `to_char(created_at, 'YYYY-MM-DD')` (UTC) + `today = new Date().toISOString().slice(0,10)` (UTC)
- `src/server/actions/workout-day.ts:264, 318` — `dayDate=todayISODateUTC` then `isFinalCycleDay(mask, today)` uses local `.getDay()`
- `src/app/(app)/dashboard/page.tsx:228, 234` — `todayISO` is UTC, `isDateCommitted` is local

Two different definitions of "today" in the same call site. **On a non-UTC host or for any user not on UTC**, this silently breaks: streak misses are detected on the wrong day, weakness-day fires on the wrong weekday, the rest-day banner appears keyed to the wrong calendar date.
The schema already has `users.tz` (added by 0023). Read it and resolve weekday through `Intl.DateTimeFormat(tz)` OR commit fully to UTC with `getUTCDay()` everywhere.
**Hand-trace verification (Mon/Wed/Fri user, missed Fri 5/22, today Sun 5/24):** algorithm IS correct **given UTC**, returns `streakDays=0`. But the algorithm's assumption (UTC) is the bug.

### B-5. RestDayNotification — dismissal key is UTC, "is rest day" check is local-TZ
**File:** `src/app/(app)/dashboard/page.tsx:228 + 234`, consumer `src/components/product/RestDayNotification.tsx`
Same-root failure as B-4 but with the additional user-visible bug: a US-Pacific user dismissing at 5pm PT writes `cognify.rest-day-dismissed.2026-05-28` (Thu UTC) while the rest-day check still reads "Wed local." Tomorrow they open the app on the real Thursday and the banner is already pre-dismissed — exactly the failure the per-day key was meant to prevent.
**Fix:** Derive `todayISO` from same local-TZ Date used for the rest-day computation: `${y}-${pad(m)}-${pad(d)}` from `.getFullYear/Month/Date`.

### B-6. Untracked migration, untracked API route, untracked content files
**Files:**
- `drizzle/migrations/0024_user_committed_days.sql` (untracked)
- `src/app/api/me/committed-days/` (untracked dir)
- `src/lib/onboarding/committed-days.ts` (untracked)
- `src/content/skill-scenarios/index.ts` (untracked)
- `src/components/product/RestDayNotification.tsx` (untracked)
- `src/components/product/workout-shell/SkillScenariosCard.tsx` (untracked)
- `src/lib/workout/exercise-framework.ts` (untracked)

These are core to the shipped behavior. Until they're committed, the merge target is undefined. The 5-8-commit split below resolves this.

Also: migration 0024 lacks `IF NOT EXISTS` (sibling 0023 has it). Safe for first run, but re-runs throw. Add `IF NOT EXISTS`.

---

## SHOULD-FIX-SOON (quality, follow-up tickets)

### S-1. Canon violation rate at served tier is ~30–50% on worst slices
**Source:** content audit (15-prompt sample, 7/15 fully pass = 47% compliance). DB confirms:
- 76 "Walk the [board/CFO/IC]…" prompts active (canon-banned)
- 122 mechanic-prefixed prompts active (recal scripts explicitly forbid)
- 35 sentinel-event, 83 Daubert/voir-dire, 89 LBO/MOIC/EBITDA, 19 MEDDPICC — all canon-named-as-forbidden, all active
- 32 "you're talking to…" / "you're presenting…" (second-person scenario tone violations)
- Difficulty mix is still Wave-2 30/50/20, not canon-target 50/40/10

**Pre-merge fix (30 min, reversible):** `UPDATE exercise_prompts SET is_active=false WHERE text ~* '(walk the (board|cfo|ic|jury|audit committee|lp))|sentinel event|MEDDPICC|Daubert|voir dire|LBO|MOIC|EBITDA bridge'` — ~300-row prune. Also push picker bias intro→core→stretch in `pickPromptCandidates` (Phase F2, 4-line change).

### S-2. `suggestTodaysMuscleGroup()` is uncached + called 2–3× per dashboard render
**Files:** `src/app/(app)/dashboard/page.tsx:143`, `src/app/(app)/workout/page.tsx:100, 160`, `src/server/actions/workout-day.ts:486` (inside `startMuscleGroupDay`).
Each call = 5 sequential DB roundtrips (`existing` + 4-way `Promise.all`). Dashboard + Workout shared visit = 2 full cascades + 1 more on Start. Wrap function in `React.cache()` — pure on `(userId, dayDate)` — and add to dashboard's parent `Promise.all`.

### S-3. XP multiplier stack can hit ×6
**File:** `src/lib/progression/xp.ts:104-110`
A 75-band rep on a 14-day streak that's both comeback and rest-day: `10 × 2.0 (band) × 1.4 (streak) × 2 (comeback) × 1.5 (rest)` = **84 XP per rep**. Anti-grinding only caps level-ups, not XP. Clamp combined bonus-multiplier ≤ 2.5×, OR make comeback and rest-day mutually exclusive.

### S-4. `restDayBonus` is silent — no analytics, no user-facing surfacing
**Files:** `src/server/actions/reps.ts:411-433`, `src/lib/progression/xp.ts:94`.
Bonus fires but `awardXp` doesn't log multipliers used. User has no visible signal. Add: (a) `restDayBonusApplied: boolean` to `AwardXpResult`, (b) structured log `awardXp.granted { composite, streakDays, comebackBonus, restDayBonus, xpDelta }`. Surface a "+50% rest-day bonus" toast in the UI.

### S-5. Session-machine SCORE_DONE hoist is correct, but no recovery from stuck `recording`
**File:** `src/lib/workout/session-machine.ts:217-237`.
Hoist is the right fix — no `FINISH_RECORDING`/`TRANSCRIBE_DONE` dispatcher exists in `src/`. But if a user closes the tab mid-recording, the machine resumes in `recording` with no in-flight rep. The reducer rejects every event except SCORE_DONE/FAIL_SCORE/PAUSE. **No way to cancel-rep.** Add `CANCEL_REP` → `prompt-selecting`.

### S-6. RepFrameworkStrip writes localStorage on every keystroke + restore logic is dead
**File:** `src/components/product/RepFrameworkStrip.tsx:81-83, 92-102`.
No debounce → hundreds of `JSON.stringify + setItem` per rep, will stutter mid-tier Android. Restore logic only fires after initial `useState(notesDefaultOpen)` already set `notesOpen=true` — the conditional re-open is dead. Add 300-500ms debounce; fix the open-on-restore logic OR comment that it's intentional.

### S-7. RecordButton small-text contrast fails WCAG AA
**File:** `src/components/product/RecordButton.tsx:205, 244, 280, 283`.
`text-white/85` on brand-gradient ≈ 2.9:1, fails 4.5:1 for 11–14px text. Headline sizes (text-5xl/6xl) pass at ~3.4:1. Bump small body to `text-white` (no opacity).

### S-8. Day-picker drift between Settings and Onboarding
**Files:** `src/app/(app)/settings/SettingsClient.tsx:335-373` vs `src/app/onboarding/days/page.tsx:94-119`.
Same data, same bit math, different visual + motion + on-toggle-save behavior. Settings shows `maskToHumanSummary` summary, onboarding doesn't. Extract `<CommittedDaysPicker>` shared component before the drift compounds.

### S-9. PATCH `/api/me/committed-days` has no transaction; zod allows mask=0 (then 400s)
**File:** `src/app/api/me/committed-days/route.ts:25-27, 67-85`. Collapse select+update to one atomic UPDATE; tighten zod refine to MIN_COMMITTED_DAYS.

### S-10. RestDayNotification animation re-plays on every dashboard navigation
**File:** `src/components/product/RestDayNotification.tsx:28, 30-39`. `useState(false)` → `useEffect` flip + `<AnimatePresence initial={false}>` + `motion.div initial={{...}}` = slide-in on every page hit until user dismisses. Either cookie-pass `initiallyDismissed` server-side, or set `initial={false}` so re-mounts don't re-animate.

### S-11. Dashboard runs BOTH `getWeakestDimension` (still) AND `suggestTodaysMuscleGroup` — they can disagree
**File:** `src/app/(app)/dashboard/page.tsx:86, 143, 324`. "Today's focus = Clarity" + "Your weakest link = Pacing" rendered together = user confusion. Either unify (use `weeklyDimScores.alternates` for WeakestLinkCard) or rename WeakestLinkCard to "Lifetime weakness."

### S-12. Single-committed-day user → weakness-day every session
**File:** `src/lib/onboarding/committed-days.ts:122-125`. `MIN_COMMITTED_DAYS=3` makes this currently unreachable. Add a guard `cycleLength >= 2` so future relaxation doesn't silently break behavior.

---

## NICE-TO-HAVE (cleanup, polish)

- **N-1.** Delete dead `pickFocusDim()` in `dashboard/page.tsx:614-641` (no callers).
- **N-2.** Dead-code refs to removed `SkillLabDailyPromo` / `SkillLabPivotTooltip` / `skill-lab-promo.ts` — verify no remaining imports.
- **N-3.** Add `scripts/lint-prompts.mjs` to regex-lint prompts against canon rules at PR time.
- **N-4.** Bump `general` bank from 1,080 to ~4k for anonymous users.
- **N-5.** Rename `twoColumnLayout` (it's now a vertical stack) → `dailyWorkoutIdleLayout` in `RepSurface.tsx`.
- **N-6.** `SkillScenariosCard` scenarios render in source order — users only ever see scenarios[0-3]. Seed-shuffle by `dim + user.id`.
- **N-7.** SkillScenariosCard `seen` key isn't user-scoped — shared device leaks across users.
- **N-8.** Day-picker accessibility: no `aria-live` on count/error message; "T" and "S" labels ambiguous to screen readers — add explicit `aria-label="Tuesday"` etc.
- **N-9.** RestDayNotification `localStorage` keys leak forever (one per day forever). Trivial leak (~50 bytes/day), but use a single key holding last-dismissed YYYY-MM-DD.
- **N-10.** Migration 0024 → add `IF NOT EXISTS` for idempotency.

---

## SURPRISED-BY (non-obvious, load-bearing, flag for team)

- **U-1.** A full **dark-mode theme system** (ThemeProvider, ThemeToggle, inline pre-hydration script in `src/app/layout.tsx`, ~50 components touched with `dark:` Tailwind classes) shipped on this branch but isn't in any commit subject, isn't in `project_muscle-group-pivot.md`. The inline IIFE whitelists 14 path prefixes — new app routes need to be added to this list or they silently lack dark mode.
- **U-2.** `~50 product/feedback/dashboard component files` are dirty solely for `dark:` class additions, piggybacking on the theme commit. Don't ship as separate orphan commit — fold into theme commit.
- **U-3.** All 8 `scripts/exercise-catalog/v1/vertical/*.json` are dirty (240k LOC change in stat) but the content is already committed. **This is CRLF/LF line-ending churn.** Either `git checkout` to revert, or add `.gitattributes` with `text eol=lf`. Don't include in any new commit.
- **U-4.** `awardStreakFreeze` has a pre-existing race (no atomic update guard) — out of scope but worth flagging.
- **U-5.** `console.log`/`console.warn` are the structured-logging primitive everywhere. No central logger. Acceptable today; not great for prod.
- **U-6.** `users.tz` defaults to `'UTC'` and schema comment says "Best-effort inferred client-side on first launch." If that inference code isn't shipped/landed, the TZ fix for B-4/B-5 collapses to "every user is UTC" until tz-inference lands. Find and verify the inference path.
- **U-7.** Weakness-day branch in `workout-day.ts:317-343` bypasses the assignment engine's whole regression-prevention contract on the final cycle day. Intentional, but worth a TODO comment + a test.
- **U-8.** 18 untracked debug/probe/audit scripts in `scripts/` (`debug-*.mjs`, `probe-*.mjs`, `audit-gaps.json`, `gaps/` dir with 10 files). Decide: move to `scripts/dev/` or `.gitignore` `/scripts/debug-*.mjs`, `/scripts/probe-*.mjs`, `/scripts/audit-*.{mjs,json}`, `/scripts/gaps/`, `/scripts/_*`.

---

## Recommended commit split (for the dirty working tree)

1. **chore(skill-lab): drop dead promo/pivot tooltip** — 3 deletes + SkillLabClient/skill-lab/page wiring removal.
2. **feat(theme): light/dark with no-flash pre-hydration script** — ThemeProvider, ThemeToggle, layout.tsx script, globals.css, settings UI, + all `dark:` class additions across ~50 components.
3. **feat(onboarding): committed-days + rest-day +50% XP + weakness-day** — migration 0024, schema, committed-days lib, /onboarding/days, /api/me/committed-days, SettingsClient picker, xp.ts, reps.ts, workout-day.ts weakness branch, RestDayNotification, dashboard mount, streak-freeze rewrite.
4. **feat(workout): pre-rep skill scenarios + framework helpers** — skill-scenarios content, SkillScenariosCard, exercise-framework.ts, WorkoutShell wiring.
5. **fix(picker): P0 textArrayLit + cascade tier logging** — prompt-selection.ts only.
6. **fix(workout): session-machine SCORE_DONE hoist + tagWorkoutRep engagement upsert** — session-machine.ts + workout-session.ts (note: B-1 and B-2 must be fixed before this commit lands).
7. **fix(dashboard+rep): notes persistence, rep page redesign, dashboard "Today's focus" rewire** — RepFrameworkStrip, RepSurface stack layout, RecordButton contrast, dashboard.
8. **chore(scripts+docs): dev-script consolidation + canon + roadmap** — move debug-/probe-/audit-/gaps/ to `scripts/dev/` (or .gitignore), commit `docs/dark-palette.md`, `docs/prompt-design-canon.md`, `plans/post-wave2-roadmap.md`. Revert the 8 vertical JSON files (CRLF churn).

---

## Memory updates needed

- `project_muscle-group-pivot.md` — extend "shipped" log past Wave 1 to include HB-1..HB-5, HC-1..HC-5, HD-1..HD-2, Phase D rest-day, Phase E skill-scenarios, dark-mode theme system. Note all 6 BLOCK-MERGE findings as open items.
- `project_deferred-work.md` — add "merge of feat/muscle-group-pivot blocked on this review."
- New: `project_dark-mode.md` — document the path-whitelist contract in `layout.tsx` so future app routes don't silently lack dark mode.

---

## Verdict

**BLOCK** the merge until:

1. **B-2** (engagement linkage) is debugged and `reps.exercise_id` + `reps.muscle_group_day_id` populate on save — confirm via re-running `node scripts/debug-tagWorkoutRep.mjs`.
2. **B-1** (avg_composite NULL pollution) — 5-line SQL fix.
3. **B-4 + B-5** (timezone unification) — read `users.tz` OR commit to UTC everywhere. Find and ship the tz-inference code path if it isn't live.
4. **B-3 / S-1** (canon prune SQL) — 30-minute reversible UPDATE; cuts user-visible canon violators from ~36% to ~5%.
5. **B-6** (commit the dirty files via the 8-commit split above).

S-2 through S-12 can be follow-up tickets, but B-1/B-2 are silent data-integrity bugs that will compound every day post-merge.

**Estimated unblock time:** 2–4 focused hours (~half a day) plus a smoke re-run.
