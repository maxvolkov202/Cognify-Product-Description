# Pre-merge review — 5 passes on `3b10e6a2..HEAD`

Date: 2026-05-27. Branch: `feat/muscle-group-pivot`. Target: `cognify-v2-neon.vercel.app`.
Scope: 88 commits, 306 files, +53,559 / −2,424. Plan: `plans/pre-merge-handoff.md` (source) + `keen-wondering-treehouse.md` (cutover playbook).

---

## Pass 1 — security + correctness + audit-fix semantic verification

### 1A. Security surface

All money-burning + PII-touching endpoints reviewed:

| Endpoint | Gate | External cost | Status |
|---|---|---|---|
| `/api/score`, `/api/score/stage1`, `/api/score/stage2`, `/api/score/twostage` | `requireUser()` + rate-limit by `user.id` (30/min) | Anthropic + Hume + OpenAI fallback | ✓ |
| `/api/talking-points` | `requireUser()` + rate-limit (15/min) | Anthropic | ✓ |
| `/api/progression` | `requireUser()` + rate-limit (20/min) | Anthropic | ✓ |
| `/api/transcribe` | `requireUser()` + rate-limit (30/min) | Deepgram | ✓ |
| `/api/upload` | `requireUser()` + rate-limit (30/min) | Vercel Blob | ✓ |
| `/api/weekly-narrative` | `requireUser()` + rate-limit (10/min by IP) | Anthropic | ✓ |
| `/api/report/pdf` | `requireUser()` | none (react-pdf in-process) | ✓ |
| `/api/validate/audio/[repId]` | `requireUser()` + ownership-or-operator | Supabase signed-URL | ✓ |
| `/api/score-internal` | timing-safe `X-Internal-Secret` vs `INTERNAL_SCORING_SECRET` | Anthropic | ✓ |
| `/api/score/health/stats` | `requireUser()` + `isOperator()` | telemetry read | ✓ |
| `/api/ops/**` | `requireOperator()` | varies | ✓ |
| `/api/me/tz`, `/api/me/committed-days` | `requireUser()` | none | ✓ |
| `/api/support`, `/api/bug-reports` POST | unauth + IP rate-limit + honeypot | Resend + Blob | ✓ (acceptable) |
| `/api/cron/**` (5 routes) | `Authorization: Bearer ${CRON_SECRET}` OR `x-vercel-cron: 1` (rollover is Bearer-only) — fail-closed in prod | varies | ✓ |

**No new attack surface introduced.** Auth gates from commit `9a9bb7b6` cover the formerly-public scoring/transcribe/upload routes. The `OwnershipError` class in `src/server/actions/_ownership.ts` is consistent across `workout-session.ts`, `workout-day.ts`, and `reps.ts`. CSP is enforcing (commit `a0ff2c0d`); HSTS preload set; Permissions-Policy denies camera/geolocation/payment/etc. while allowing microphone for self.

**Caveat (Patch 1 closes):** CSP `img-src` is too tight for production library + OAuth flows. Patch 1 broadens to `https:`.

### 1B. Correctness — high-risk files reviewed

**`src/server/actions/workout-session.ts`** (508 lines, added):
- `tagWorkoutRep` (line 345) is the critical complex function — three writes in `db.transaction()` at line 389:
  1. Self-heal `exerciseId` by reading `planned_exercise_ids` from `muscle_group_days` index lookup (lines 394–413).
  2. UPDATE reps with `muscleGroupDayId` + `exerciseId` + `scoreFailureFlag` (lines 415–422).
  3. UPDATE (increment) `completed_reps` on the day (lines 425–429).
  4. INSERT…ON CONFLICT upsert `exercise_engagement` with NULL-safe avg_composite logic (lines 445–482).
- Auth: explicit `assertOwnsRep` + `assertOwnsDay` (parallel) before any DB writes.
- B-1 (CTO review) closed: line 443–444 reference; the EXCLUDED CASE handles `recent_composite IS NULL` correctly.
- B-2 (CTO review) closed: lines 415–422 directly populate `muscleGroupDayId` + `exerciseId` — engagement linkage now flows.
- **Accepted residual risk:** `completeWorkoutSession` + `recordGraduationRep` use 2-statement updates wrapped in `safeDb()` but NOT explicit `db.transaction()`. Half-state possible but: each statement is idempotent, client retries on `{ persisted: false }`, soft-launch scale means probability of observation is effectively zero. Promote to `db.transaction()` in a follow-up sprint.
- **Accepted residual risk:** `tagWorkoutRep` self-heal queries most-recent `workout_session` row for the day. Two devices simultaneously open + writing reps could pick the wrong `station_index`. Soft launch + per-user usage pattern: not reachable.

**`src/server/actions/workout-day.ts`** (725 lines, added):
- `todayDateForUser(userId)` uses `getUserProfile(userId)` (React.cache-wrapped) + `todayYmdInTz(profile.tz ?? "UTC")`. Per-user-local date keying confirmed.
- `startMuscleGroupDay` uses `INSERT … ON CONFLICT DO NOTHING` + re-`SELECT` (PR-19 fix).
- `suggestTodaysMuscleGroup` is `React.cache()`-wrapped (P-5 fix).
- `swapMuscleGroup` has explicit `userId` predicate in the WHERE clause + rejects swap if any rep exists.
- **Accepted residual risk:** if a concurrent DELETE wiped the day row between the INSERT and re-SELECT, re-SELECT returns null and `createWorkoutSession(null)` crashes. No API path DELETEs `muscle_group_days` in v2. Acceptable.

**`src/app/api/cron/audio-retention/route.ts`** (139 lines, added):
- Auth model matches the other crons (Bearer + Vercel header, fail-closed in prod).
- Single SQL pass joins users to read per-user retention window.
- Hard-deletes Supabase blobs, soft-deletes DB columns (audio_url + transcript nulled).
- Storage errors logged but loop continues (audio is effectively gone from user's POV).
- Idempotent on re-run (skipped at `isNotNull(reps.audioUrl)` predicate).
- **Patch 2 closes:** no `?dryRun=1` flag → adds dry-run preview mirroring rollover cron.
- **MAX_REPS_PER_RUN = 2,000** cap protects 300s budget. With prod at 8 audio reps total, this cap is academic at soft-launch scale.

**`src/app/api/cron/calibration-drift/route.ts`** (344 lines, added):
- Auth pattern correct (Bearer + Vercel header).
- Reference-rep fanout with per-rep try/catch — single failure doesn't kill the run.
- Status taxonomy: `ok` / `drift` / `fallback` / `error`.
- Alert webhook fires when avg|Δ|>5 OR worst|Δ|>15 OR fallbackCount>2.
- **Patch 3 closes (P-4):** `scoreOne` at line 326 still calls `/api/score` which now requires `requireUser()`. Every ref-rep call would 401 → all rows write `status: error` → silent dashboard failure. Patch 3 swaps to `/api/score-internal` + `X-Internal-Secret` header.

**`src/app/api/cron/weekly-narrative/route.ts`** (118 lines):
- `CONCURRENCY = 8`, `MAX_USERS_PER_RUN = 400` (PR-6 closed). Hand-rolled bounded concurrency.
- Reports `deferred` count if cohort exceeds the cap.
- Per-user error wrapping; one user's failure doesn't kill the cron.

**`instrumentation.ts`** + **`src/lib/env.server.ts`**:
- Zod schema parsed at boot. Required keys throw in prod → boot crash → cold-start failure visible immediately, not a silent degrade.
- Required: 8 keys (DATABASE_URL, Supabase ×3, Anthropic, Deepgram, CRON_SECRET, INTERNAL_SCORING_SECRET).
- Cached after first parse; dev-only stale-cache concern (irrelevant in prod).

**`next.config.ts`** CSP — see Patch 1 in main plan.

### 1C. Semantic audit-fix verification

68 audit findings catalogued; 23 CTO-review findings.

🔴 P-class (11 findings): **10 confirmed closed, 1 (P-4) requires Patch 3.**

| ID | Closed by | Verification |
|---|---|---|
| P-1 (auth on score/transcribe/upload) | commit `9a9bb7b6` | `requireUser()` present in each route |
| P-2 (`/api/validate/audio/[repId]` ownership) | `9a9bb7b6` | ownership-or-operator check confirmed |
| P-3 (cron registration in vercel.json) | `86b7971e` | 5 crons in vercel.json |
| P-4 (calibration-drift self-throttle) | **NOT FIXED** | route.ts:326 still calls `/api/score` → Patch 3 |
| P-5 (React.cache on session helpers) | `62e73bc4` | currentUser, getUserProfile, getCurrentSkillScores, suggestTodaysMuscleGroup all wrapped |
| P-6 (detectNewHigh N+1) | `62e73bc4` | aggregate MAX query |
| P-7 (uniqueIndex schema/migration drift) | `86b7971e` | uniqueIndex in schema.ts |
| P-8 (tagWorkoutRep transaction) | `62e73bc4` | db.transaction() at line 389 |
| P-9 (weeklyReports.narrative zod) | `62e73bc4` | `.$type<>()` + safeParse at read |
| P-10 (workout-session ownership) | `9a9bb7b6` | assertOwnsSession/Rep/Day in place |
| P-11 (pickFocusDim lint) | `81050e0d` | dead code removed |

🟠 PR-class (23 findings): **20 confirmed closed, 3 with Patch 1/2/4.**

| Highlights closed | Highlights with patch |
|---|---|
| PR-2 env zod (commit `6811b5e2`) | PR-1 CSP img-src (Patch 1) |
| PR-4 structured logger + codemod (`ea4ea259`, `ffcff2de`) | PR-3 dryRun (Patch 2) |
| PR-6 weekly-narrative paging (`ea4ea259`) | PR-15 partial — see below |
| PR-7..PR-12 perf (`b35cc8ae`, `aae525dd`) | |
| PR-19 ON CONFLICT (`62e73bc4`) | |
| PR-20..PR-22 + DB hygiene (`7d886043`, `5726b6e9`) | |
| PR-23 SW cacheOnNavigation (`30d7d599`) | |

PR-15 (JSONB casts) — `.$type<>()` codemod confirmed via cast hygiene grep (only 2 legitimate db.execute() patterns remain in `leagues.ts`).

🟡/🟢 + CTO-review (S-3..S-12, UX-10..UX-16, DC-4..DC-8, B-3 canon prune): **~12 deferred to post-launch.** None block this cutover; treat as backlog. Documented in `memory/project_deferred-work.md` (referenced by handoff).

---

## Pass 2 — Cross-cutting integration review

**React.cache + Promise.all interaction:**
- Layout (`src/app/(app)/layout.tsx:46`) runs 3-way `Promise.all` over `isUserOnboarded`, `getUserProfile`, `getCurrentSkillScores`.
- Dashboard (`src/app/(app)/dashboard/page.tsx:81`) runs 9-way `Promise.all` (streak, reps, activity, trends, profile, weakest, quests, league, sub-skills).
- Dedupe verified: `currentUser`, `getUserProfile`, `getCurrentSkillScores`, `suggestTodaysMuscleGroup` all `React.cache()`-wrapped. Dashboard reuses layout's results without re-hitting DB.

**TZ keying consistency:**
- Every `muscle_group_days.day_date` writer is `todayYmdInTz(profile.tz)`. No `todayISODateUTC` / `todayUTC` paths remain (audit B-4 + B-5 closed).
- Cron `muscle-group-day-rollover/route.ts:26–39` mirrors the same `Intl.DateTimeFormat` pattern with UTC fallback on invalid tz.
- `users.tz` populated via `/api/me/tz` (PATCH route exists, confirmed in inventory; TimezoneDetector wired into layout per audit Phase A).

**Auth gate completeness across `src/app/api/**/route.ts`:** see Pass 1A table — every route inventoried, every gate verified.

**Type cast hygiene:**
- `as unknown as` count in `src/server/actions/` + `src/lib/db/queries/`: 2 occurrences (`queries/leagues.ts:102, 110`).
- Both wrap `db.execute()` raw-SQL results — legitimate Drizzle pattern; `.$type<>()` doesn't apply to `execute()`. ✓

**Pivot rollout state:**
- `FF_MUSCLE_GROUP_WORKOUT` defined at `src/lib/flags.ts:19–25`. Default false in prod.
- Consumed at `src/app/(app)/workout/page.tsx:288` — off-state renders BetaSoon placeholder.
- Vercel env currently has flag unset → workout page would show BetaSoon → must set `FF_MUSCLE_GROUP_WORKOUT=true` before deploy.

**Cron inventory cross-checked** with `vercel.json`: 5 crons registered, all have correct auth handlers. ✓

---

## Pass 3 — Migration safety + cutover plan

**Pre-check script output (Max authorized, ran 2026-05-27):**

| Check | Result |
|---|---|
| total reps | 72 |
| reps with audio_url | 8 |
| reps with audio AND >90 days old | **0** |
| oldest audio rep | 2026-04-22 (35 days) |
| FK orphan rows (7 buckets) | **all 0** |
| JSONB type-conversion blockers (2 cols) | **all 0** |
| case-variant email duplicates | **0** |
| total users / guests / auth-linked / operators | 340 / 334 / 6 / 1 |

**Verdict:** every migration applies cleanly with no manual cleanup. Lock duration on 0026 type conversions is sub-second at this row count. 0027 citext UNIQUE recreate has no constraint violation to resolve.

**Apply order: `0025 → 0026 → 0027`, ALL before `vercel deploy --prod`.** Code already expects the new schema; deploying first would crash on the first read of `audio_retention_days` / native arrays / case-insensitive email lookups.

**Patch 4 amends 0025:** default 90 → 180 per Max's product call (soft-launch posture). 0 reps swept either way today; effect is on future eligibility.

Per-migration rollback SQL: see `plans/rollback.md` §1, §2, §3.

---

## Pass 4 — Smoke matrix

See `plans/smoke-matrix.md`. 22 items: 17 MUST-PASS, 5 NICE-TO-PASS.

---

## Pass 5 — Reverse-camera rollback

See `plans/rollback.md` for:
- Vercel deploy rollback (dashboard or CLI).
- DB rollback SQL per migration (0025/0026/0027).
- Feature-flag soft rollback (`FF_MUSCLE_GROUP_WORKOUT=false` + redeploy).
- Go/no-go criteria for the first 30 minutes post-deploy.

**Order-dependent caveat:** if rollback is needed after B2 (0026 type conversions), DB rollback FIRST then Vercel rollback. Old code reads JSONB; new schema has native arrays; mismatch crashes on read.

---

## Verdict

**Ready to ship with the 4 pre-deploy patches (CSP, dryRun, P-4, retention default).** Pre-checks clean; high-risk surface reviewed; deferred work is non-blocking UX/perf polish. Soft-launch scale (6 real users, 72 reps, 8 audio blobs) means low-risk-per-minute and fast rollback. Active engineering time to deploy ~75 minutes; full confidence after overnight cron observation.
