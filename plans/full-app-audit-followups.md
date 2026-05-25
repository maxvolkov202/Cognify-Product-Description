# Cognify Audit — Follow-up Sprint Plan

**Source audit:** `plans/full-app-audit-2026-05-24.md`
**Already-shipped phases:** `memory/project_full-app-audit-fixes.md`
**Branch:** continue on `feat/muscle-group-pivot` (uncommitted from prior session — see "Commit split" below)

The 2026-05-25 session closed all 🔴 findings + a sizeable chunk of 🟠. This doc lists what remains, grouped into focused commits. Goal: ship the whole batch in one focused sprint without leaving 🟠 lingering when the muscle-group pivot pushes to prod.

---

## Order of operations

### Commit 0 — Land what's already done from the prior session

The 2026-05-25 session shipped ~30 fixes across 8 phases but left the working tree uncommitted. Split into 4–6 commits before touching anything new:

1. **`chore: dead code + lint cleanup`** — `_archive/` delete, `use-idle-timeout.ts` delete, `FeedbackPanel.tsx` shim + 2 importer rewires, ServiceWorker AbortController, `pickFocusDim` + 6 other unused vars, `mark.png` → `mark.svg`, ServiceWorker registration cleanup, `flags.ts` rollback comment.
2. **`fix(infra): register day-rollover + callout-drift crons, uniqueIndex sync`** — `vercel.json` 2 new cron entries, `schema.ts` `uniqueIndex(mgd_user_date_uniq_idx)`.
3. **`fix(workout): TZ-keyed day_date + React.cache on session helpers`** — `todayDateForUser`, replaced `todayISODateUTC` / `todayUTC()` call sites; `cache()` wraps on `currentUser`, `getUserProfile`, `getCurrentSkillScores`, `suggestTodaysMuscleGroup`; `detectNewHigh` MAX; `weeklyReports` typed jsonb + zod; `tagWorkoutRep` transaction; `startMuscleGroupDay` ON CONFLICT.
4. **`feat(security): auth gates + ownership on expensive endpoints`** — 5 score routes + transcribe + upload + talking-points + progression now require `currentUser` + rate-limit by user.id; `/api/validate/audio/[repId]` ownership; `/api/score/health/stats` operator-gated; `workout-session.ts` actions get ownership + zod parse.
5. **`perf: N+1 fixes + parallel awaits + library allSettled`** — `getRecentSignups` + `getUserValidations` GROUP BY; layout + dashboard `Promise.all`; library `Promise.allSettled`.
6. **`style(workout): brand-gradient + WCAG contrast + focus-ring color`** — StartCard + WorkoutShell segmented slider; RecordButton + StartCard `text-white`; GradientButton ring-brand-purple; WorkoutShell `<a>` → `<Link>`.

Verify after each commit: `npx tsc --noEmit && npm test && npm run lint`.

---

### Commit 1 — Security headers + env validation (`PR-1`, `PR-2`)

**Scope:**
- `next.config.ts`: add `Content-Security-Policy`, `Strict-Transport-Security`, expand `Permissions-Policy` to deny camera/geolocation/payment.
- Starter CSP (deploy as `Content-Security-Policy-Report-Only` first; cut over to `Content-Security-Policy` once 24h of preview shows no violations):
  ```
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';   # Next inline boot + dev HMR
  style-src 'self' 'unsafe-inline';
  font-src 'self' data:;
  img-src 'self' blob: data: *.supabase.co *.public.blob.vercel-storage.com;
  media-src 'self' blob: *.supabase.co *.public.blob.vercel-storage.com;
  connect-src 'self' *.supabase.co *.upstash.io api.anthropic.com api.deepgram.com api.hume.ai;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  ```
- HSTS: `max-age=63072000; includeSubDomains; preload`.
- New `src/lib/env.server.ts` with zod schema:
  - Required in prod: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY`, `CRON_SECRET`, `INTERNAL_SCORING_SECRET`, `BLOB_READ_WRITE_TOKEN`.
  - Optional: `UPSTASH_REDIS_*`, `HUME_API_KEY`, `RESEND_API_KEY`.
  - Parse at module load; throw on missing-required in prod, warn in dev.
- Import the server-env once in `instrumentation.ts` so it boots before any request.

**Risk:** CSP can break previews if an allowed-origin is missing. Mitigate with Report-Only mode for 24h.

---

### Commit 2 — Observability sprint (`PR-3`, `PR-4`, `PR-6`)

**Scope:**
- `src/lib/log.ts` — thin structured-log helper (`log.info/warn/error` → JSON with `event`, `ts`, `userId?`, payload). No external SDK; goes to stdout for Vercel log drains.
- Codemod `console.log` / `console.warn` / `console.error` in `src/lib/db/queries/`, `src/server/actions/`, `src/app/api/` to `log.*`. Leave UI components alone for now.
- Audio retention cron `src/app/api/cron/audio-retention/route.ts`:
  - Walks Supabase storage `reps/${userId}/` paths older than N days.
  - Deletes blob + nulls `reps.audio_url` / `reps.transcript_text`.
  - Per-user retention setting (default 90 days; add `users.audio_retention_days INTEGER NOT NULL DEFAULT 90` migration 0025).
  - Register in `vercel.json` as daily at 03:30 UTC.
  - Settings UI: simple dropdown "30 / 90 / 180 / forever" in Privacy section.
- `weekly-narrative` cron concurrency: use `p-limit(8)` over the active-users iteration. Add a `MAX_CRON_USERS_PER_RUN` cap that pages by `userId DESC LIMIT N` and stores cursor to handle past ~150 active users without timing out.

---

### Commit 3 — JSONB typing codemod (`PR-15`)

**Scope:** Apply the `.$type<>()` + zod-parse-at-read pattern (already done for `weeklyReports.narrative`) to the remaining JSONB columns:

| Schema column | Type | Read site |
|---|---|---|
| `reps.transcript` | `{ text: string; words?: TranscriptWord[] }` | `RepSurface`, `reps.ts` |
| `reps.framework_snapshot` | `RepTypeFramework` | `reps.ts` |
| `reps.dimension_scores` *(via dimensionScores table)* | already typed |  |
| `dimension_scores.signals` | `EncodedSignals` | `score-internal` |
| `daily_quests.quests` | `Quest[]` | `daily-quests.ts` |
| `daily_quests.completion` | `QuestCompletion` | `daily-quests.ts` |
| `activity_events.payload` | discriminated `{ type, …}` union | `activity.ts` |
| `user_notifications.payload` | discriminated union per `kind` | `day-status.ts`, `notifications.ts` |
| `external_validations.rep_ids` | `string[]` | `validation.ts` |
| `external_rankings.ranking` | `string[]` | `validation.ts` |
| `calibration_runs.expected_per_dim` | `Record<SkillDimension, number>` | `calibration-drift` cron |
| `score_corrections.corrected_per_dim` | same |  |
| `bug_reports.image_paths` | `string[]` | `bug-reports/route.ts` |
| `muscle_group_days.planned_exercise_ids` | `string[]` (UUIDs) — consider switching to `text[]` instead | `workout-day.ts`, `workout/page.tsx` |

Pattern: typed column + `Schema.safeParse` at every read site. Drop the `as unknown as object` and `as unknown as Shape` casts. Audit's pattern matches the `weeklyReports` change shipped 2026-05-25.

---

### Commit 4 — DB hygiene (`PR-20`, `PR-21`, `PR-22`, `DB-1`–`DB-6`)

**Scope:**
- New migration `0026_fk_and_index_hygiene.sql`:
  - `ALTER TABLE league_membership ADD CONSTRAINT … FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` (+ schema.ts mirror).
  - Same for `daily_quests.user_id`.
  - FK + onDelete-set-null for `scoring_telemetry.user_id` and `scoring_telemetry.rep_id`.
  - FK for `personal_bests.rep_id` → `reps.id` cascade.
  - FK for `users.baseline_rep_id` → `reps.id` set null (deferrable initially deferred).
  - FK + index for `reference_reps.source_rep_id` → `reps.id`.
  - `CREATE INDEX scoring_telemetry_rep_idx ON scoring_telemetry(rep_id) WHERE rep_id IS NOT NULL`.
  - `DROP INDEX user_prompt_history_user_idx` (redundant with PK leading column).
  - `CREATE INDEX exercise_prompts_dim_active_diff_idx ON exercise_prompts(dimension, is_active, difficulty)`.
- Email case-insensitivity (`PR-20`): switch `users.email` + `crew_invites.email` to `citext` (or store lowercased + add a CHECK). Backfill existing rows. Schema-side: drop the old indexes, recreate as `LOWER(email)` if not using citext.
- JSONB array-column migrations where shape is stable (`PR-15` overlap; do here to bundle the migration):
  - `muscle_group_days.planned_exercise_ids` → `uuid[]`
  - `bug_reports.image_paths` → `text[]`
  - `external_validations.rep_ids` → `uuid[]`
  - `external_rankings.ranking` → `text[]`

**Risk:** Email column type change requires careful prod backfill. Stage in preview first; verify Supabase auth.users join still works.

---

### Commit 5 — UX polish + accessibility (`UX-4`, `UX-5`, `UX-6`, `UX-8`, `UX-10`–`UX-16`)

**Scope:**
- **Terminology unification:** sweep "Today's Workout" everywhere (`WorkoutShell` H1, eyebrow, `RepControls` CTA, `not-found.tsx`, `TutorialClient`, `LibraryCallout`). Reserve "Training" for the per-day list.
- **Dark-mode codemod:** add `dark:bg-ink-900 dark:border-ink-700 dark:text-…` siblings on `ActivityRibbon`, `BeforeAfterAudio`, `CalendarStrip`, `CalloutCorrectionRow`, `CircleTimer`, `dashboard/StreakCalendar`, `WorkoutShell` streak/freeze pills.
- **Loading / empty states:** `leaderboard/page.tsx` Suspense per tab; `friends/page.tsx` include `challenges.length` in `hasRealData`; `progress/page.tsx` per-card Suspense.
- **WeakestLink focus outline:** `focus-visible:outline-2 focus-visible:outline-offset-2` colored with the dim accent.
- **Card-radius token:** define `--radius-hero` in `globals.css`; replace `rounded-2xl` (StartCard) and `rounded-3xl` (DashboardHero, LibraryCallout, build-a-rep cards) with `rounded-[var(--radius-hero)]`.
- **Brand-glow shadow tokens:** define `--shadow-glow-sm/md/lg/xl`; replace hand-rolled `shadow-[0_X_Y_-Z_rgba(151,136,255,…)]` at 6 sites.
- **Segmented-control desync fix:** `WorkoutShell.tsx:482,494` swap fixed `min-w-[110px]` + `translateX(110px)` for `flex-1` tabs + ref-measured slider.
- **TrainingList palette:** normalize `slate-*` → `ink-*` in `TrainingList.tsx:83-89`.
- **Marketing "Pillars" → "Skills" / "Dimensions":** rename `PillarsSection.tsx` and the section copy.

---

### Commit 6 — Performance (`PR-9`, `PR-14`, `IN-1`–`IN-6`, `PR-12 followup`)

**Scope:**
- `leaderboard.ts` — compute streaks/deltas once over the full user set; reuse for top-N table and global callouts.
- `RecordButton.tsx` — replace `useState(scale) + requestAnimationFrame` with `useMotionValue` from `motion/react`; write directly to `motion.button` style.
- `convertPendingCrewInvites` — bulk-fetch existing friendships in one `inArray`, batch-insert, single `UPDATE … WHERE id IN (…)`.
- `getMuscleGroupComparison` (`muscle-group-progress.ts:325-326`) — wrap two sequential dim-avg calls in `Promise.all`.
- `RepFrameworkStrip` — 300ms debounce on localStorage writes.
- `WorkoutShell.tsx:299-347` — narrow the `AnimatePresence` wrapper so RepControls subtree doesn't re-mount per phase.
- `WorkoutProgressBar.tsx:67-83` — keep dot dimensions constant, let `animate.scale` do the visual size change.
- Library OG memo: lift the 15-image fetch to module scope or `unstable_cache` so it's not request-time work.
- **Asset optimization:** recompress `public/icons/apple-splash-*.png` (4 files, ~1.55 MB total), `icon-512.png` (466 KB) via oxipng/pngcrush. Move `public/fixtures/sample-rep.wav` out of `public/`.

---

### Commit 7 — Cleanup + content gap (`DC-1`, `DC-2`, remaining 🟡/🟢)

**Scope:**
- **`SkillsFocusContext`:** decide. Recommended cut — drop the Provider, inline empty default into `SixSkillsBar`, delete `SkillsFocusContext.tsx`.
- **`friends/mock-data.ts`:** gate behind `process.env.NODE_ENV !== "production"` OR delete if friends/page.tsx no longer falls through to mocks once `hasRealData` is fixed.
- **`scripts/`:** move remaining `debug-*.mjs`, `probe-*.mjs`, `test-*.mjs` ad-hoc scripts into `scripts/dev/` or delete `phase-baseline.mjs` + `backfill-progression.mjs` (one-shots already executed).
- **`isMuscleGroupWorkoutEnabled` flag:** if push-to-prod has happened by this point and the flag is flipped on, delete the flag + `BetaSoon` placeholder + the env var line from `.env.example`.
- **Lint warnings:** `UserMenu.tsx:99` `<img>` → `<Image>` (Google OAuth avatar).
- **`InstallPrompt.tsx:90` + `audio/capture.ts:124`:** add `webkit*` types to `src/types/globals.d.ts` instead of inline casts.
- **`RepFrameworkStrip.tsx:67-89`:** fix the restore-effect dep (`framework` identity, not `framework.sections.length`).
- **Migration 0019:** add `IF NOT EXISTS` symmetry.
- **Service-worker stale shell** (`PR-23`): `Vary: Cookie` on auth-bearing routes or split the SW shell.

---

### Commit 8 — Content backfill

**Scope:** Sparse-goals smoke still shows 2 healthcare cells falling to v-tier:
- `healthcare/thinking_on_the_spot` on "The Analogy Bridge" (v+g bank = 4, need ≥ 5)
- `healthcare/storytelling` on "Explain Like I'm 12" (v+g bank = 4)

Generate 1–2 prompts per cell via `scripts/generate-prompts.mjs`, run through canon linter, seed. Re-run `node scripts/dev/smoke-sparse-goals.mjs` — expect 4320 / 4320.

---

## Out of scope (track separately)

- Push `feat/muscle-group-pivot` + draft PR + flag-flip in prod (existing `[[muscle-group-product-pivot]]` memory).
- Vercel firewall + BotID rollout (separate hardening pass).
- AI-Gateway migration (would replace direct Anthropic SDK; meaningful refactor, not a fix).
- Capacitor + mobile build (`plans/muscle-group-pivot-capacitor-audit.md`).
- Sentry / log-drain selection (procurement, not code).
- Test coverage on API routes / server actions (separate sprint).

---

## Verification at end of sprint

```
npx tsc --noEmit
npm test
npm run lint
node scripts/dev/audit-personalization-gaps.mjs   # expect 0 / 4320
node scripts/smoke-picker-cascade.mjs              # expect 918 / 918
node scripts/dev/smoke-sparse-goals.mjs            # expect 4320 / 4320 after Commit 8
npm run build                                       # surface bundle warnings
```

Expected outcome: zero 🔴 remaining, all 🟠 closed, 🟡 substantially reduced, the audit document marked "closed" with a note pointing here.
