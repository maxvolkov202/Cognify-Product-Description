---
name: full-app-audit-fixes-2026-05-25
description: "Full-app CTO audit closure — 2 sessions, 19 commits. 2026-05-25 shipped 30 fixes (all 🔴 + some 🟠) uncommitted. 2026-05-26 split that into 6 commits (0a–0f), added 8 sprint commits (1–8), and 5 follow-up cleanup commits. Branch feat/muscle-group-pivot is 19 commits ahead of origin. tsc + lint + tests + smoke clean. Migrations 0025/0026/0027 authored, NOT applied. Not pushed."
metadata: 
  node_type: memory
  type: project
  originSessionId: 056abc2a-2997-4353-927c-afeb92d1e5d3
---

**Status (2026-05-26):** All audit follow-up work shipped on `feat/muscle-group-pivot`. Branch is **19 commits ahead** of `origin/feat/muscle-group-pivot`. Tests 941/941, lint 0 errors/0 warnings, tsc clean. **Not pushed** — push approval still pending. **Migrations 0025, 0026, 0027 authored as SQL files but NOT applied** — safety rail held; need Max's authorization + preview-deploy staging. Full audit at `plans/full-app-audit-2026-05-24.md`; sprint plan at `plans/full-app-audit-followups.md`.

## Commit timeline

### Commit 0 — split the dirty tree from 2026-05-25 (6 commits)

- `81050e0d` chore: prune dead code (deletes _archive, FeedbackPanel shim, use-idle-timeout, pickFocusDim + 6 unused vars, mark.png→svg, SW dead AbortController; plans/ docs added).
- `86b7971e` fix(infra): vercel.json registers muscle-group-day-rollover + weekly-callout-drift; schema mgd_user_date_uniq_idx becomes uniqueIndex.
- `62e73bc4` fix(workout): TZ-keyed day_date, React.cache wraps on currentUser/getUserProfile/getCurrentSkillScores/suggestTodaysMuscleGroup (via inner-impl pattern), detectNewHigh MAX, weeklyReports zod, startMuscleGroupDay ON CONFLICT.
- `9a9bb7b6` feat(security): score routes + transcribe + upload + talking-points + progression require currentUser + per-user rate-limit; upload namespaces reps/{userId}; talking-points real zod schema; validate/audio rep ownership; score/health/stats operator-gated; workout-session.ts ownership + zod (tagWorkoutRep tx folded in here).
- `b35cc8ae` perf: getRecentSignups + getUserValidations GROUP BY; layout/dashboard Promise.all; library Promise.allSettled.
- `7acda2a0` style(workout): canonical brand-gradient + WCAG AA contrast + ring-brand-purple + `<a>` → `<Link>`.

### Commits 1–8 — sprint plan

- `6811b5e2` feat(security): CSP (initially Report-Only) + HSTS preload + Permissions-Policy expand + env.server.ts zod parsed at boot via instrumentation.ts.
- `ea4ea259` feat(observability): `src/lib/log.ts` JSON structured logger; codemod high-value cron sites; audio-retention cron + migration 0025 (`users.audio_retention_days`) + Settings UI Privacy section; weekly-narrative bounded concurrency (8 workers, MAX_USERS_PER_RUN=400).
- `449d020d` refactor(types): `.\$type<>()` on 12 JSONB columns; drop `as unknown as object` casts.
- `7d886043` chore(db): migration 0026 — FK hygiene (league_membership, daily_quests, scoring_telemetry, personal_bests, reference_reps, users.baseline_rep_id), index hygiene (add scoring_telemetry_rep_idx + exercise_prompts_dim_active_diff_idx + reference_reps_source_rep_idx; drop user_prompt_history_user_idx), JSONB→native arrays for 4 columns.
- `ff47f0ae` style(ux): WeakestLink focus ring; PersonalizeSwitch segmented control flex-1 + slider 50%; friends hasRealData includes challenges.length; TrainingList slate→ink; loading.tsx for /leaderboard /progress /friends; `--shadow-glow-{sm,md,lg,xl}` + `--radius-hero` CSS tokens.
- `aae525dd` perf: leaderboard dedupes streaks/deltas; RepFrameworkStrip 300ms debounce; getMuscleGroupComparison Promise.all; convertPendingCrewInvites bulk; library OG fetch module-scope memo.
- `e2e30947` chore(cleanup): friends/mock-data exports gated to NODE_ENV; UserMenu `<img>` → next/image; src/types/globals.d.ts for webkit/standalone.
- `108b2379` content(healthcare): 2 prompts to Analogy Bridge tagged thinking_on_the_spot + 2 to ELI12 tagged storytelling; smoke 4320/4320.

### Cleanup follow-ups (after Commit 8)

- `f6243243` refactor(types): discriminated unions for activity_events.payload + user_notifications.payload via new `src/types/db-payloads.ts` (schema.ts references via type-only import).
- `ffcff2de` chore(logging): finish console.* → log.* codemod for ~14 remaining files (api/score/*, api/ops/exemplar-bank, api/progression, api/score-internal, api/talking-points, api/weekly-narrative, lib/db/queries/weekly-reports, server/actions/reps, workout-day, workout-session, prompt-selection).
- `30d7d599` fix(sw): `cacheOnNavigation: false` to stop stale signed-in shell (audit PR-23).
- `5726b6e9` chore(db): migration 0027 authored — citext on users.email + crew_invites.email. **NOT APPLIED.** Pre-check + manual dupe merge required before staging.
- `a0ff2c0d` feat(security): flip CSP from Report-Only to enforcing.

## Verification at end of cleanup

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean ✅ |
| `npm run lint` | 0 errors, 0 warnings ✅ |
| `npm test` | 941 / 941 pass ✅ |
| `scripts/dev/smoke-sparse-goals.mjs` | 4320 / 4320 ✅ |

## What still requires Max

1. **Push** — branch is 19 commits ahead of `origin/feat/muscle-group-pivot`. Held per safety rail.
2. **Apply migration 0025** (audio_retention_days) — needs preview-deploy authorization.
3. **Apply migration 0026** (FK + index + JSONB→arrays) — needs preview-deploy authorization.
4. **Apply migration 0027** (email citext) — needs preview-deploy authorization + the pre-check query for case-variant dupes (in the migration header).
5. **CSP enforcing watch** — first preview deploy with the enforcing header should show no CSP violations in the browser console; revert the `30d7d599` commit if it does. Allowlist covers Supabase / Upstash / Anthropic / Deepgram / Hume.

## Genuinely deferred (not in this sprint, separate work)

- Asset recompression (apple-splash PNGs, icon-512) — needs oxipng/pngcrush, not in CLI env.
- SkillsFocusContext decision — kept; still load-bearing for SkillLab.
- Marketing "Pillars" rename — no user-visible "Pillars" string remains, component-name-only cleanup.

Related memories: [[muscle-group-product-pivot]] · [[feedback_autonomous-phases]] · [[feedback_tokens-over-rework]]
