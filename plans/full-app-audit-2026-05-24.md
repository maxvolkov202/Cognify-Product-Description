# Cognify Full-App Audit — 2026-05-24

**Branch:** `feat/muscle-group-pivot` (clean working tree at audit time)
**Method:** 6 parallel investigators (dead-code, inefficiency, type-safety, DB hygiene, UX/UI, prod-readiness), synthesized.
**Prior review:** `plans/cto-review-2026-05-24.md` (BLOCK-MERGE findings B-1…B-6 were fixed; S-2…S-12 and N-1…N-10 were deferred — many resurface here, see §References).

## Verification snapshot

| Command | Result |
|---|---|
| `npx tsc --noEmit` | Clean ✅ |
| `npm test` | 340 / 340 pass ✅ |
| `npm run lint` | **7 errors, 1 warning** — see Q-1 |
| `node scripts/dev/audit-personalization-gaps.mjs` (T=3) | 0 / 4320 gaps ✅ |
| `node scripts/smoke-picker-cascade.mjs` | 918 / 918 cells ✅ |
| `node scripts/dev/smoke-sparse-goals.mjs` | **2 / 4320 fall through** to v-tier (healthcare × thinking_on_the_spot/Analogy Bridge; healthcare × storytelling/Explain Like I'm 12). New regression vs. prior review. |

---

## 🔴 Fix before next feature

### Production readiness

**P-1. Public scoring/transcribe/upload endpoints have no auth.**
`src/app/api/score/route.ts`, `src/app/api/score/stage1/route.ts`, `src/app/api/score/stage2/route.ts`, `src/app/api/score/twostage/route.ts`, `src/app/api/transcribe/route.ts`, `src/app/api/upload/route.ts`, `src/app/api/talking-points/route.ts`, `src/app/api/progression/route.ts` — anonymous internet caller can drive Anthropic Opus + Deepgram + Vercel Blob with only IP-rate-limiting (15–30/min). Direct credit-burn behind any NAT. Fix: gate on `currentUser()` (incl. guest cookie); rate-limit by `user.id`, not IP. Namespace blob keys under `reps/{userId}/...`.

**P-2. `/api/validate/audio/[repId]` exposes any rep's audio to anyone with the UUID.**
`src/app/api/validate/audio/[repId]/route.ts` — no auth, no ownership check. UUIDs are unguessable but leak via screenshots/logs. Voice = biometric PII. Fix: require `currentUser()`, assert `rep.userId === user.id` (or operator role) before redirecting to signed URL.

**P-3. `/api/cron/muscle-group-day-rollover` is not in `vercel.json` — silently dead in prod.**
Only `weekly-narrative` + `calibration-drift` are registered. The muscle-group pivot's keystone rollover never fires. Same for `weekly-callout-drift`. Fix: add cron entries (rollover hourly, callout-drift weekly) or delete the handlers. This breaks the just-shipped feature.

**P-4. `/api/cron/calibration-drift` self-calls `/api/score` over public HTTP and will 429 itself.**
`src/app/api/cron/calibration-drift/route.ts` — public scoring endpoint is 30/min/IP. Once reference bank passes 30 reps, cron throttles itself silently. Fix: call scorer in-process, or route through `/api/score-internal` with `INTERNAL_SCORING_SECRET`.

### Inefficiency

**P-5. No `React.cache()` anywhere — every server helper re-runs per call site.**
`import { cache } from "react"` is unused in the repo. A single `/workout` request fires `currentUser()` 4–5×, `getUserProfile()` 2–3×, and `suggestTodaysMuscleGroup()` (≈ 4 heavy aggregates) **twice**. Confirmed prior S-2 still unfixed; pattern is much wider. Fix: wrap `currentUser`, `getUserProfile`, `getCurrentSkillScores`, `suggestTodaysMuscleGroup` with `React.cache(...)`. Expect 40–60% drop in dashboard/workout DB roundtrips.

**P-6. `detectNewHigh` pulls every rep's score over the wire per scored rep.**
`src/lib/db/queries/activity.ts:141-148` — `SELECT composite_score FROM reps WHERE user_id = ?` with no aggregate, no LIMIT, then reduces in JS. After ~1k reps that's hundreds of KB per scoring call. Fix: `SELECT MAX(composite_score) ...`.

### Data integrity / DB

**P-7. `muscle_group_days` UNIQUE-index drift between schema and migration.**
`src/lib/db/schema.ts:1117` declares non-unique `index("mgd_user_date_uniq_idx")`; migration 0020 created `UNIQUE INDEX`. A `drizzle-kit push` from current schema drops uniqueness, removing the only guard against double-insert in `startMuscleGroupDay` (which has no `ON CONFLICT`). Fix: change to `uniqueIndex(...)` in schema and stop using `push` for prod.

**P-8. `tagWorkoutRep` does three writes with no transaction → double-increment risk.**
`src/server/actions/workout-session.ts:269-344` — UPDATE rep, `completed_reps + 1`, engagement UPSERT all sequential. Mid-flight failure + client retry double-counts the rep counter, which gates day-graduation. Fix: wrap in `db.transaction(...)`.

### Type safety

**P-9. `weeklyReports.narrative` JSONB read with cast, no runtime validation → crash risk.**
`src/lib/db/queries/weekly-reports.ts:35,66,74` — write site `as unknown as object`, read site `as WeeklyNarrative`. Any drifted row or hand-edit crashes `/progress`. Fix: `.$type<WeeklyNarrative>()` on the column + `WeeklyNarrativeSchema.safeParse` at read.

**P-10. Server actions in `workout-session.ts` accept client IDs with no ownership check or zod parse.**
`updateWorkoutSessionState` (`:29`), `completeWorkoutSession` (`:108`), `recordGraduationRep` (`:142`), `tagWorkoutRep` (`:217`) — any logged-in user can pass another user's `workoutSessionId` / `muscleGroupDayId` / `repId`. Same gap in `reps.ts:139,206`. Fix: zod-parse inputs; assert `row.userId === currentUser.id` before mutating.

### Dead code

**P-11. `pickFocusDim` is still dead (prior N-1, confirmed by lint error).**
`src/app/(app)/dashboard/page.tsx:628` — declared, never used. Trivial delete. Listed 🔴 only because lint is now failing on `main`-bound branches because of it.

---

## 🟠 Fix this sprint

### Production readiness

- **PR-1.** **CSP missing entirely; no HSTS.** `next.config.ts` sets X-Frame, X-Content-Type, Referrer, Permissions=microphone(self) — but no `Content-Security-Policy` and no `Strict-Transport-Security`. Any XSS in bug-report descriptions or callout titles escalates to credential theft. Fix: starter CSP (`default-src 'self'; img-src 'self' blob: data: *.supabase.co; media-src 'self' blob: *.supabase.co; connect-src 'self' *.supabase.co *.upstash.io api.anthropic.com api.deepgram.com api.hume.ai;`) + HSTS preload header.
- **PR-2.** **No env validation.** `src/lib/env.ts` has helpers but no zod schema parsed at boot. Missing `CRON_SECRET` / `SUPABASE_SERVICE_ROLE_KEY` / `INTERNAL_SCORING_SECRET` silently degrades; multiple cron routes log warning and run unguarded. Fix: zod-schema on first import; fail fast in prod.
- **PR-3.** **No audio/PII retention policy.** Uploaded audio sits in Supabase storage forever. Voice biometric under GDPR/CCPA. Fix: cron that deletes audio + transcript text past N days (per-user setting).
- **PR-4.** **No structured logger; 95 `console.*` calls across 46 files.** Prior U-5 still open. Failure paths in upload/transcribe/email/cron categorized inconsistently. Fix: introduce a thin `log.info/warn/error` JSON-shaped helper; codemod replacements over time.
- **PR-5.** **`/api/score/health/stats` leaks pipeline failure-rate publicly.** Comment claims operator endpoint but reachable anonymously and exposes p50/p95/p99 + mock-fallback rates. Competitor/attacker telemetry. Fix: operator-gate or shared secret.
- **PR-6.** **`weekly-narrative` cron iterates users serially with no concurrency limit.** Will time out past ~150 active users at 2s each. Fix: `p-limit` concurrency 4–8 or shard by `user.id % N`.

### Inefficiency

- **PR-7.** **`getRecentSignups` is N+1.** `src/lib/db/queries/ops.ts:202-236` — 20 sequential `SELECT COUNT(*) FROM reps` for `hasRepped` flag. Fix: single `inArray` + `GROUP BY userId`.
- **PR-8.** **`getUserValidations` is N+1.** `src/lib/db/queries/validation.ts:83-99` — per-row rankings count loop. Fix: single `GROUP BY validationId`.
- **PR-9.** **Leaderboard recomputes streak/delta map twice.** `src/lib/db/queries/leaderboard.ts:302-306, 342-363` — `computeSimpleStreaks` and `computeDeltas` run once for top-N then again for the global "topStreak"/"biggestClimb" callouts. Fix: compute once over the full userId set, reuse.
- **PR-10.** **`(app)/layout.tsx:40-59` runs 3 sequential awaits after `currentUser`.** `isUserOnboarded` → `getUserProfile` → `getCurrentSkillScores` are independent. Fix: `Promise.all`.
- **PR-11.** **`dashboard/page.tsx:118-143` re-serializes baseline + suggest after the main `Promise.all`.** Both independent of cohort. Fold into one parallel block.
- **PR-12.** **`library/page.tsx:217-226` issues 15 outbound OG-image fetches per request.** Fix: module-scope memo or build-time JSON; one failure currently crashes the page (Promise.all not allSettled).
- **PR-13.** **`public/logo/mark.png` is 1.6 MB while `mark.svg` (1.4 KB) sits next to it.** Fix: verify nothing imports the PNG; delete.
- **PR-14.** **`RecordButton.tsx:307` updates React state per audio frame to animate scale.** Fix: `useMotionValue` → write directly to `motion.button` style; bypass reconciliation. Mid-tier Android jank.

### Type safety / boundaries

- **PR-15.** **JSONB columns lack `.$type<>()` and runtime validation across the board.** 28 `as unknown as` casts in 14 files. Hot spots: `reps` (transcript, framework_snapshot, signals), `dailyQuests` (quests, completion), `activityEvents.payload`, `dimensionScores.signals`, `validation.ts` repIds/ranking, `userNotifications.payload`. Fix: typed jsonb columns + zod parse at each read site.
- **PR-16.** **`talking-points` route asserts shape instead of validating.** `src/app/api/talking-points/route.ts:44` — `as GenerateTalkingPointsInput` with only `typeof === "string"` checks, then sent to paid Claude. Fix: zod schema + safeParse.
- **PR-17.** **`upload`/`transcribe` accept any 25 MB file with no MIME enum gate.** Fix: `z.enum([...audio mimes])` + extension whitelist.
- **PR-18.** **`api/score/health/stats?window=foo` crashes on bad enum.** `:149` — assertion not check. Fix: 400 on unknown window.

### Data integrity / DB

- **PR-19.** **`startMuscleGroupDay` SELECT-then-INSERT race (no `ON CONFLICT`).** `src/server/actions/workout-day.ts:411-536` — double-tap of "Start" 500s instead of idempotent. Fix: `INSERT ... ON CONFLICT (user_id, day_date) DO NOTHING RETURNING id`, re-select on null.
- **PR-20.** **`crew_invites.email` index is case-sensitive but lookups normalize to lower.** Mixed-case historical inserts permanently dark. Same risk on `users.email`. Fix: `citext` or `LOWER(email)` index + lowercased writes.
- **PR-21.** **`leagueMembership.user_id` and `daily_quests.user_id` lack FK.** Orphan rows on user delete. Fix: `.references(users.id, { onDelete: 'cascade' })`.
- **PR-22.** **`scoring_telemetry` lacks index on `rep_id`.** Per-rep ops drilldown seq-scans an append-only table. Fix: `index("scoring_telemetry_rep_idx").on(t.repId)`.

### UX / UI

- **UX-1.** **Three competing gradient systems on one screen.** Canonical `brand-gradient` (`globals.css:108`) vs ad-hoc Tailwind (`from-indigo-500 via-purple-500 to-pink-500` in `workout-shell/StartCard.tsx:65`, `WorkoutShell.tsx:504`) vs violet bg (`WorkoutShell.tsx:239`). The most-visited surface is visually disconnected. Fix: replace ad-hoc with `brand-gradient`; introduce `brand-gradient-bg-soft` for page bg.
- **UX-2.** **WCAG AA contrast failures on `text-white/85` over magenta/pink ends.** `RecordButton.tsx:202,241,244,280,283,323`, `StartCard.tsx:82,85`. Prior S-7 was partial. Fix: solid `text-white` for body copy, or dark overlay behind text columns.
- **UX-3.** **`GradientButton.tsx:42` has `focus-visible:ring-2` with no ring color — falls back to off-brand default blue and is invisible on brand-gradient bg.** Fix: `ring-brand-purple/60`.
- **UX-4.** **Terminology drift on `/workout`: "Ready to train?" (H1) / "Today's Workout" (eyebrow) / "Today's Training" (list) / "Start today's Workout" (CTA).** Five strings on one screen. Fix: pick "Today's Workout" everywhere; reserve "Training" for the exercise list only if a real distinction exists.
- **UX-5.** **Dark-mode coverage holes in ~10 components.** `ActivityRibbon`, `BeforeAfterAudio`, `CalendarStrip`, `CalloutCorrectionRow`, `CircleTimer`, `dashboard/StreakCalendar`, `WorkoutShell` streak/freeze pills (`:410,421`). All ship `bg-white` / `border-ink-200` / colored text with no `dark:` siblings. Fix: codemod-add `dark:` variants.
- **UX-6.** **`leaderboard/page.tsx` and `friends/page.tsx` lack loading + correct empty states.** Leaderboard has no Suspense fallback; friends falls back to MOCK preview if challenges-only user has no friends/pending/activity (`friends/page.tsx:62-79`). Fix: per-tab Suspense + real empty state; include `challenges.length` in `hasRealData`.
- **UX-7.** **`library/page.tsx` crashes if any OG-image fetch rejects.** `Promise.all` → `Promise.allSettled` (also UX-only edge of PR-12).
- **UX-8.** **WeakestLink CTA has no `focus-visible:` outline.** `WeakestLinkCard.tsx:136-144` — keyboard users get nothing on the highest-CTA card on the dashboard.
- **UX-9.** **`WorkoutShell.tsx:521,532` use `<a href="/settings">` instead of `<Link>`** → full page reload from inside the workout flow.

### Dead code

- **DC-1.** **`SkillsFocusContext` is a half-dead feature.** `src/components/product/SkillsFocusContext.tsx` — `SkillsFocusScope` only set by `SkillLabSession.tsx` (and the archive). Live `WorkoutShell` never wraps reps in scope, so `SixSkillsBar` always reads empty default. Either wire the scope into workout, or remove the Provider from `(app)/layout.tsx` and inline the default into the bar.
- **DC-2.** **`src/lib/friends/mock-data.ts` ships ~200 lines of mock arrays to client.** Imported in `friends/page.tsx:18-29`. Fix: gate behind `NODE_ENV !== "production"` or split types and delete the data exports.
- **DC-3.** **`src/components/_archive/workout-session-v1/` — 900 lines, `@ts-nocheck`.** Comment in `flags.ts` claims it's a "rollback fallback" but it cannot be re-imported. Delete folder; update the `flags.ts` comment.

---

## 🟡 Fix when touching the area

### Type safety / API

- **TY-1.** Server actions in `validation.ts:25, 62` accept `repIds`/`ranking` as `string[]` with no length cap and no UUID-shape check → 10 MB payload can land in pg jsonb.
- **TY-2.** `friends.ts:46` validates email by `.includes("@")` instead of a real validator.
- **TY-3.** `api/score-internal/route.ts:123,128` uses `rep.exerciseId!` non-null asserts inside an `||` guard — works today, fragile on refactor.
- **TY-4.** Cron payloads (`calibration-drift/route.ts:109,111,114,141`, `weekly-callout-drift/route.ts:145`) cast SQL results `as unknown as` shapes — use Drizzle `db.execute<T>` generic.
- **TY-5.** `notifications.ts:56` `DAY_LIFECYCLE_KINDS as unknown as string[]` — spread to a fresh array.

### DB

- **DB-1.** **JSONB columns without shape contracts.** `muscle_group_days.planned_exercise_ids` (should be `uuid[]`), `bug_reports.image_paths` (should be `text[]`), `external_validations.rep_ids` (should be `uuid[]`). Switch to typed array columns; add `jsonb_typeof` CHECK on the evolving ones (`daily_quests.quests`, `activity_events.payload`).
- **DB-2.** **`exercise_prompts` missing `(dimension, is_active, difficulty)` index** for cross-exercise ops scans.
- **DB-3.** **`user_prompt_history_user_idx` duplicates PK leading column** — drop.
- **DB-4.** **`reference_reps.source_rep_id` and `personal_bests.rep_id` lack FK + index.** Add `.references(reps.id)` and an index.
- **DB-5.** **`users.baselineRepId` dangles forever if baseline rep is deleted.** Either FK with `onDelete: set null` or periodic cleanup.
- **DB-6.** **`scoring_telemetry.{user_id, rep_id}` columns added pre-0022 lack FK** — 0022 added FKs only for newer columns. Inconsistent.

### Inefficiency

- **IN-1.** `convertPendingCrewInvites` (`src/lib/session/current-user.ts:217-245`) — 3 queries × N invites per first-signup; bulk-fetch + bulk-insert.
- **IN-2.** `getMuscleGroupComparison` (`muscle-group-progress.ts:325-326`) — two sequential `dimAvgsFor` calls; `Promise.all`.
- **IN-3.** `dashboard/page.tsx:236-249` — dynamic `await import` of two tiny utility modules on every render; hoist to static imports.
- **IN-4.** `RepFrameworkStrip.tsx:92-102` — undebounced localStorage writes per keystroke (prior S-6, still open). Add 250–300 ms debounce.
- **IN-5.** `WorkoutShell.tsx:299-347` — `AnimatePresence mode="wait"` re-mounts entire RepControls tree on every phase change. Move to a thinner wrapper.
- **IN-6.** `WorkoutProgressBar.tsx:67-83` — dot animation changes `width/height` style + `animate.scale` together → triggers layout, defeats GPU path.

### UX / UI

- **UX-10.** Three competing card radii (`rounded-2xl` StartCard, `rounded-3xl` hero cards, `surface-card` token). Define `--radius-hero`.
- **UX-11.** Brand-glow shadows hand-rolled at 6 sites with drifting opacities (0.45–0.95). Promote `--shadow-glow-{sm,md,lg,xl}` CSS tokens.
- **UX-12.** `WorkoutShell.tsx:482,494` segmented control hard-codes `min-w-[110px]` + indicator `translateX(110px)` — desyncs on any copy change. Use `flex-1` + ref-measured slider.
- **UX-13.** `progress/page.tsx` blocks render on 8-query `Promise.all`; no per-card Suspense.
- **UX-14.** `TrainingList.tsx:83-89` mixes `slate-*` (light) with `ink-800/60` (dark) — palette inconsistency vs rest of app.
- **UX-15.** Dashboard CTA collapse: hero pill + WeakestLink "Drill" button + LibraryCallout + DailyQuestsStrip all compete above the fold. Demote WeakestLink to outline/ghost.
- **UX-16.** Marketing uses "Pillars" while product uses "Dimensions"/"Skills". Signup → product taxonomy shift confuses.

### Dead code / scripts

- **DC-4.** `src/hooks/use-idle-timeout.ts` — orphaned by HB-4 auto-pick kill.
- **DC-5.** `src/components/product/FeedbackPanel.tsx` — 8-line re-export shim. Two importers; rewrite and delete.
- **DC-6.** `scripts/` ad-hoc debug/probe/test scripts not moved to `scripts/dev/` (`debug-rotation*.mjs`, `probe-*.mjs`, `test-jsonb-funcs.mjs`, etc.). Move or delete.
- **DC-7.** `scripts/phase-baseline.mjs` and `scripts/backfill-progression.mjs` — one-shots already executed; delete.
- **DC-8.** `isMuscleGroupWorkoutEnabled` flag has no real-rollback branch (off-state renders `<BetaSoon />`). Once flipped on, delete flag + BetaSoon + env var.

### Production readiness

- **PR-23.** Service worker can serve a stale signed-in shell to a signed-out user for one nav cycle (`src/app/sw.ts`, `cacheOnNavigation: true`). Add `Vary: Cookie` or split auth shell.

---

## 🟢 Cleanup-someday

- Lint errors beyond `pickFocusDim`: `workout/page.tsx:15` (`getUserProfile` unused), `onboarding/days/page.tsx:15,19,72` (unused), `PromptPicker.tsx:23` (unused type), `DayCompleteSummary.tsx:361` (`_c` unused), `use-workout-session.tsx:33` (`AUTO_ADVANCE_MS` unused).
- `UserMenu.tsx:99` uses `<img>` — Next image warning.
- `ServiceWorkerRegister.tsx:21-30` — `AbortController` never wired to anything; dead.
- `RepFrameworkStrip.tsx:67-89` — restore effect deps off-by-one (`framework.sections.length` instead of identity).
- Migration 0019 lacks `IF NOT EXISTS` symmetry (re-running is currently safe).
- `webkit-*` global casts in `InstallPrompt.tsx:90`, `audio/capture.ts:124` — add to `globals.d.ts`.
- 4 splash PNGs (~1.55 MB total) + `icon-512.png` (466 KB) — recompress.
- `public/fixtures/sample-rep.wav` (1.5 MB test fixture) — move out of `public/`.
- `library/page.tsx:362-366` secondary CTAs lack hover state.
- `friends/page.tsx`: include `challenges.length` in `hasRealData` is also 🟡; the 🟢 piece is renaming the misleading `hasRealData` variable.

---

## Cross-cutting themes (highest leverage)

1. **`React.cache()` is unused.** Six core server helpers run multiple times per request because the codebase doesn't dedupe them. One small PR wrapping ~6 functions likely eliminates 40–60% of DB roundtrips on the two most-visited routes.
2. **Rate-limiting is used as a substitute for authentication on expensive endpoints.** Score/talking-points/progression/transcribe/upload all reachable anonymously, IP-bucketed only — useless behind NATs and bots. The `score-internal` route already shows the right shape (auth-or-secret + per-user rate limit); wire that across the rest.
3. **JSONB columns are typed only at the TS layer, with no DB CHECK and no zod gate.** 28 `as unknown as` casts and zero `.$type<>()` declarations. A bad migration or hand-poke crashes the UI silently. The fix is mechanical: typed columns + read-site `safeParse`.
4. **Every pivot/refactor leaves a tombstone instead of pruning.** `_archive/`, `flags.ts` rollback comment, `FeedbackPanel` re-export shim, `SkillsFocusContext` dark on muscle-group, `use-idle-timeout` orphaned. Future readers can't tell what's load-bearing. Adopt a "delete predecessor within N commits of successor shipping" rule, plus a `find-orphans` script in CI.
5. **The muscle-group pivot introduced a second design system that bypasses brand tokens.** Three competing gradients, three card radii, six hand-rolled shadow opacities, five terminology variants for "Workout" on one screen. The shared utilities (`brand-gradient`, `GradientButton`, `surface-card`) exist; new code keeps inventing its own.

---

## Quick wins (top 10, ≤15 min each, by ROI)

1. **Add `pickFocusDim` delete + the other 6 unused-var lint errors.** Unblocks lint on `main`. 5 min.
2. **Wrap `currentUser`, `getUserProfile`, `getCurrentSkillScores` in `React.cache()`.** Single-file edit in `current-user.ts` + `queries/user.ts`. Cuts roundtrips immediately. 10 min.
3. **Fix `mgd_user_date_uniq_idx` schema declaration to `uniqueIndex`.** One-word change in `schema.ts`. 1 min.
4. **Register `muscle-group-day-rollover` (and `weekly-callout-drift`) in `vercel.json`.** Pivot stops being silently dark. 5 min.
5. **Switch `detectNewHigh` query to `MAX(composite_score)`.** Two-line edit in `activity.ts`. 5 min.
6. **Replace `Promise.all` with `Promise.allSettled` in `library/page.tsx:217-226`.** Prevents page crash on single fetch fail. 2 min.
7. **Delete `pickFocusDim`, `use-idle-timeout.ts`, the `_archive/` folder.** Three deletes, one comment update. 5 min.
8. **Promote `WorkoutShell.tsx:521,532` `<a>` → `<Link>`.** No more full reload from workout flow. 2 min.
9. **Add `text-white` (drop `/85`) to body lines of `RecordButton` + `StartCard`.** Closes WCAG AA contrast hits. 5 min.
10. **Replace `from-indigo-500 via-purple-500 to-pink-500` in `StartCard.tsx` + `WorkoutShell.tsx:504` with `brand-gradient` class.** Brand consistency on the most-visited surface. 5 min.

---

## Out of scope (noticed, not chased)

- **Framework / DB engine choice.** Next.js App Router + Drizzle + Supabase are foundational; not on the table.
- **Test coverage of API routes.** Unit tests cover `session-machine`, `mascot-voice`, `day-status`, assignment, retrieve, hints — zero coverage on API routes or server actions. Worth a separate sprint plan, not a single finding.
- **Sentry / error tracking choice.** Related to PR-4 but a procurement decision, not a code finding.
- **Bundle-size audit.** Skipped `next build`; bundle analysis would surface more (especially around mock-data and OG image utilities), but is a separate workstream.
- **i18n.** "Today's Workout" terminology fix (UX-4) assumes English-only; no i18n today.
- **Capacitor / mobile build status.** Out of scope per the prompt; see `plans/muscle-group-pivot-capacitor-audit.md` for that.
- **`pgvector` index health (`knowledge_chunks`).** Schema declares HNSW; no audit done on rebuild cadence or recall.
- **Migration 0023's status backfill.** Not analyzed; left to a migration-specific review.
- **Race in `awardStreakFreeze`** (prior U-4). Untouched, still real.
- **`tz` inference path** (prior U-6). Untouched; B-4/B-5 fixes assumed UTC.

---

## Verdict

**Fix the 🔴 batch first.** Eleven 🔴 findings, but most are tight one-PR fixes — P-3 (cron registration), P-5 (React.cache), P-7 (UNIQUE index), P-11 (pickFocusDim), Q-1 lint — are each <30 min. P-1 (auth on score/transcribe/upload), P-2 (validate/audio ownership), P-8 (tagWorkoutRep transaction), P-9/P-10 (JSON + ownership) are each 1–3 hour focused fixes. Together that's a single ~1-day sprint that closes the data-integrity, prod-readiness, and silent-degradation risks introduced by the muscle-group pivot. After that, the 🟠 batch is a 1-week sweep (CSP, env validation, retention, structured logging, dark-mode codemod, gradient consolidation) that puts the platform on a sound footing for the next feature.

The codebase is fundamentally strict and well-tested (zero `any`, zero TS suppressions, 340 passing tests). The issues are not about code quality — they're about the **boundary contracts** (auth, validation, schema↔DB sync) and the **operational seams** (cron registration, observability, retention) that quietly eroded during a fast-moving 27-commit pivot. Worth the sprint. Don't ship the next feature on top of these.

---

## References to prior CTO review

Re-surfaced from `plans/cto-review-2026-05-24.md`:
- S-2 `suggestTodaysMuscleGroup` uncached → **P-5** (expanded scope).
- S-6 `RepFrameworkStrip` localStorage churn → **IN-4** (still open).
- S-7 `RecordButton` contrast → **UX-2** (expanded).
- S-9 `/api/me/committed-days` no transaction → **PR-19**-class pattern (same fix shape).
- S-11 dashboard "Today's focus" vs "Weakest link" — not re-derived; tracked separately.
- N-1 `pickFocusDim` dead → **P-11** (now blocking lint).
- N-2 dead skill-lab promo → confirmed removed.
- N-8 day-picker a11y → not re-derived; **UX-8** is a different missing-focus instance.
- N-10 migration 0024 `IF NOT EXISTS` → assumed fixed; not re-checked.
- U-1 dark-mode whitelist → coverage is now correct at the layout level; component-level holes are **UX-5**.
- U-5 console.log everywhere → **PR-4** (still open).
- U-6 `users.tz` inference path → **flagged as out-of-scope**, still real.
