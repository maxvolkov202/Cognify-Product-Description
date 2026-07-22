---
name: muscle-group-product-pivot
description: "Muscle-group adventure-path pivot — 15-phase plan + post-launch polish + Wave 1 prompts + dark mode + Phase D committed-days/rest-day/skill-scenarios + CTO review fixes shipped on feat/muscle-group-pivot; 33 commits ahead of main; awaiting Max's push approval."
metadata:
  node_type: memory
  type: project
  originSessionId: 73bccd9c-54c8-4a40-b51d-d71e6a1fa0ad
---

**Status (2026-05-24):** all 15 pivot phases + 5 launch-prep follow-ups + UI polish (HA-HD) + Wave 1 prompt expansion + **dark mode** + **committed-days schedule / rest-day +50% XP / weakness-day scheduler (Phase D)** + **pre-rep skill scenarios + framework helpers (Phase E)** + **CTO-level review fixes** shipped on `feat/muscle-group-pivot`. Branch is 33 commits ahead of main. Working tree clean. Production is flag-off. **Branch has NOT been pushed to origin — awaiting Max's explicit go-ahead.**

## Latest 6 commits (this session — 2026-05-24)

- `d7e14b43` chore(scripts+docs): dev scripts, canon prune, CTO review, .gitignore
- `80a7077a` fix(cto-review): engagement linkage + TZ unification + picker bias + P0
- `44fcc3ef` feat(workout): pre-rep skill scenarios + rep redesign + state-machine fix
- `6c4557db` feat(onboarding): committed-days schedule + rest-day +50% XP
- `5fc6fb11` feat(theme): light/dark/system toggle + dark-mode coverage
- `4d866c9a` chore(skill-lab): drop dead promo + pivot tooltip components

## CTO review fixes (commit `80a7077a`)

The full review is at `plans/cto-review-2026-05-24.md`. Six BLOCK-MERGE items addressed:

- **B-1** avg_composite NULL pollution — SQL upsert in `tagWorkoutRep` now skips EXCLUDED contribution when `recent_composite IS NULL` and doesn't bump `completed_count` for failed reps. Score hiccups no longer halve the user's engagement signal.
- **B-2** engagement-table dark in prod — `tagWorkoutRep` self-heals `exerciseId` from `muscle_group_days.planned_exercise_ids[station_idx]` when the caller passes null, plus `tag_workout_rep.invoked` / `.self_heal_exercise_id` / `.no_exercise_id` structured logs. Historical 61 reps still have NULL columns (predate this branch); fresh reps will populate.
- **B-3 + Phase F2** canon prune + picker bias — `scripts/dev/prune-canon-violators.mjs` deactivated 293 violator prompts (walk-the-board, sentinel events, MEDDPICC, Daubert, LBO/MOIC, EBITDA bridge, IC memo). Picker `pickPromptCandidates` always sorts intro→core→stretch. Smoke still 918/918, audit still 0/4320 gaps.
- **B-4 / B-5** TZ unification — new `src/lib/time/user-day.ts` (Intl.DateTimeFormat-based). `isDateCommitted`, `cyclePositionForDate`, `isFinalCycleDay` take optional `tz`. `streak-freeze` uses `AT TIME ZONE` in SQL + `todayYmdInTz`. Dashboard rest-day check + dismissal key share user-local YMD. `users.tz` populated by existing `TimezoneDetector` (already shipped). UTC fallback preserved for undetected users.
- **B-6** working-tree mess — 97 dirty files committed into the 6 logical commits above. Migration 0024 made idempotent with `IF NOT EXISTS`. CRLF churn on 8 vertical JSONs reverted. Debug/probe/audit scripts now `.gitignore`d under `/scripts/debug-*.mjs`, `/scripts/probe-*.mjs`, `/scripts/audit-*.{mjs,json}`, `/scripts/gaps/`, `/scripts/_*.mjs`.

## Theme + dark mode (commit `5fc6fb11`)

- `<ThemeToggle>` (light/dark/system tri-state) wired into `/settings` Appearance section.
- `ThemeProvider` mounted on `(app)/layout.tsx`. Inline pre-hydration script in `src/app/layout.tsx` prevents flash.
- **Path whitelist contract:** new app routes must add their prefix to `appPrefixes` in `layout.tsx:101` or they flash light on hard nav for dark-theme users. Contract documented at `docs/dark-mode.md`. The whitelist currently covers `/dashboard`, `/workout`, `/skill-lab`, `/build-a-rep`, `/library`, `/progress`, `/leaderboard`, `/friends`, `/settings`, `/achievements`, `/onboarding`, `/compare`, `/tutorial`, `/admin`, `/dev`, `/ops`, `/report`, `/scenario`, `/validate`.

## Committed-days + rest-day (commit `6c4557db`)

- Migration `0024_user_committed_days.sql` — bitmask `INTEGER NOT NULL DEFAULT 31` (Mon=bit0..Sun=bit6, default Mon-Fri). Idempotent via `ADD COLUMN IF NOT EXISTS`.
- `MIN_COMMITTED_DAYS = 3` enforced in API + onboarding/settings picker.
- `/onboarding/days/page.tsx` + `PATCH /api/me/committed-days` + Settings picker section.
- `awardXp` ×1.5 multiplier when `restDayBonus=true`. `reps.ts` reads `users.committedDays` to set the flag on save.
- `RestDayNotification` on `/dashboard` — dismissible per-day, keyed by user-local YMD.
- Weakness-day branch in `suggestTodaysMuscleGroup` fires on the user's final committed day of the week — picks the weakest dim's `avgComposite7d`.

## Skill scenarios + rep redesign (commit `44fcc3ef`)

- `src/content/skill-scenarios/index.ts` — 60 universal scenarios (10 per dim × 6 dims).
- `SkillScenariosCard` mounts on workout start, auto-expands first time per dim, persists "seen" state in localStorage.
- `exercise-framework.ts` provides per-dimension framework lookups.
- `RepFrameworkStrip` persists notes to localStorage keyed by `muscleGroupDayId:exerciseId`.
- `RepSurface` got a symmetric vertical-stack idle layout for daily workout.
- `session-machine.ts` `SCORE_DONE` / `FAIL_SCORE` hoisted above `recording/transcribing/scoring` phases.

## Smoke replay results (post-prune, post-fixes)

- `npx tsc --noEmit` → clean ✅
- `node scripts/dev/audit-personalization-gaps.mjs` → **0 / 4320 gaps** ✅
- `node scripts/smoke-picker-cascade.mjs` → **918 / 918 cells, 0 under-min** ✅
- `node scripts/dev/smoke-sparse-goals.mjs` → confirmed earlier 4318/4320 land at v+g (2 fall to v+p, still served) ✅
- `node scripts/debug-tagWorkoutRep.mjs` → historical 0/61 (predates this branch's Phase 8 — expected). Live verification requires a fresh rep via the browser flow.

## What's still deferred / blocked

- **Push + draft PR** — needs Max's explicit go-ahead (CLAUDE.md rule).
- **Live verification of B-2 fix** — Max must complete a fresh rep on `/workout`; then re-run `node scripts/debug-tagWorkoutRep.mjs` to confirm `reps with exercise_id ≥ 1`.
- **Phase G mascot art polish** — Figma → SVG layer swap in `MascotCharacter.tsx`. Placeholder still production-acceptable.
- **48-rep calibration replay** — needs API credits + dev server.
- **Smoke matrix** on real device — `plans/muscle-group-pivot-launch-checklist.md`.
- **CTO review S-2 through S-12 + N-1 through N-10** — out of scope for this unblock; track separately as `feat/muscle-group-followups`.

## Wave 1 prompt expansion (commit `602e953e`)

- 4,320 prompts in `cognify_v2.exercise_prompts`. Tags `[<vertical>, <persona>, <goal>]`. Picker cascade V∧P∧G → V∧P → V∧G → V → general. **Plus 293 canon-violators deactivated by Phase D prune.**

## Where to look first when picking this up

- `plans/cto-review-2026-05-24.md` — full review + verdict + remaining follow-ups
- `plans/muscle-group-pivot-launch-checklist.md` — launch gates
- `plans/post-wave2-roadmap.md` — Phase F1/F2/F3 (F1+F2 shipped; F3 prune done)
- `docs/dark-mode.md` — theme whitelist contract
- `docs/prompt-design-canon.md` — prompt authoring rules
- `src/lib/time/user-day.ts` — TZ-aware day helpers
- `src/server/actions/workout-session.ts` — `tagWorkoutRep` self-heal + B-1 fix
- `src/lib/db/queries/streak-freeze.ts` — TZ-aware streak walker

Related memories: [[project_deployment-gates]] · [[project_v1-v2-merge]] · [[feedback_autonomous-phases]] · [[feedback_tokens-over-rework]]
