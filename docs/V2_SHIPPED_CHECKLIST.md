# Cognify V2 — Shipped Checklist

**Status:** SHIPPED · deployed to https://cognify-v2-neon.vercel.app
**Branch:** `feat/gym-core` · merged commits `a2a3214d` → `c070c138`
**Date:** 2026-04-24

This checklist cites `docs/V2_STRATEGIC_PLAN.md` by workstream. Each row has a live URL you can open to verify the UI + a concrete file/path that implements it.

---

## Source documents

- `docs/V2_STRATEGIC_PLAN.md` — master plan, 10 workstreams + 4 mockup scopes + progress log
- `docs/proposals/v2-final-push.md` — the 9-phase plan that closed out the long tail
- `docs/proposals/rubric-v2.0.0.md` — WS-1 rubric spec
- `docs/proposals/pressure-system.md` — WS-3 pressure spec
- `docs/proposals/session-types.md` — WS-6 session types spec
- `docs/PRIOR_ART.md` — WS-10 patent-grade survey
- `docs/mockups/01-04-*.jpeg` — four reference mockups

---

## Workstream status (`V2_STRATEGIC_PLAN.md §2`)

| ID | Workstream | Status | How to verify live |
|---|---|---|---|
| **WS-1** | Dimension alignment (Clarity / Structure / Conciseness / Thinking / Delivery / Adaptability) | ✅ shipped | `/how-it-works` — dimension table shows all 6 new labels |
| **WS-2** | Critical UX stabilization (Product Sweep #1–10) | ✅ shipped | Feedback panel callouts on any rep result; `/settings` flow |
| **WS-3** | Pressure system (5 archetypes + weight profiles + UI) | ✅ shipped | `/build-a-rep` preview card shows the pressure picker; `/workout` places an archetype rep at slot N-1 |
| **WS-4** | Feedback taxonomy (dimension-tagged callouts + transcript timestamps) | ✅ shipped | Any finished rep → FeedbackPanel with dim badges + timestamp chips |
| **WS-5** | UI system + V2 page redesigns | ✅ shipped | `/workout` uses SixSkillsBar, CircleTimer, ProgressDots, PressureRepIndicator; all 4 mockup scopes rendered |
| **WS-6** | Session types + Flow session + Build→Stress→Reinforce | ✅ shipped | `/workout` → SessionTypePicker; picking Flow runs 5 pressure reps with auto-advance feedback; Combined places pressure at slot N-1 |
| **WS-7** | Measurability 2.0 (Daily / Weekly / Monthly) | ✅ shipped | `/progress` shows DailyScoreCard + ImprovementCurve (with 95% CI band) + BeforeAfterAudio + WeeklyNarrativeCard; `/report` + `/api/report/pdf` export |
| **WS-8** | Habit system (streak freeze, PWA, personal bests) | ✅ shipped | `/progress` shows streak stat + freeze banner when applied; `/settings` has Notifications stub; PersonalBestToast fires on new PBs |
| **WS-9** | B2B positioning (Corporate Health, ROI, prior art) | ✅ shipped | `/for-teams` renders ROICalculator + PriorArt + CompetitorTable |
| **WS-10** | IP / Boxology + 5-session improvement curve | ✅ shipped | `docs/PRIOR_ART.md` + `docs/diagrams/*.svg` (3 files) |

---

## Mockup parity (`V2_STRATEGIC_PLAN.md §10`)

| Mockup | Location | Status |
|---|---|---|
| **#1 Daily Workout Home** | `docs/mockups/01-daily-workout-home.jpeg` | ✅ — WorkoutIntro renders SessionTypePicker + chip row + resume banner + "Today's training" list with lock icons on hidden reps |
| **#2 Exercise / Prompt Pick** | `docs/mockups/02-exercise-prompt-pick.jpeg` | ✅ — WorkoutPromptSelect shows CircleTimer "45s TO SPEAK" badge + ProgressDots + 5-card picker + Refresh + gradient Start-rep CTA |
| **#3 Start / Pre-rep** | `docs/mockups/03-start-page.jpeg` | ✅ — RepSurface idle state shows framework with per-node notes + ready countdown + gradient mic |
| **#4 Recording / Actual Rep** | `docs/mockups/04-recording-page.jpeg` | ✅ — Recording phase shows RECORDING pill, waveform, MM:SS centered timer, 3-tile Redo/Pause/Submit row with real in-place pause/resume |

---

## New API routes

| Route | Purpose | Runtime |
|---|---|---|
| `/api/score` | Rep scoring (pressure-archetype-aware weight profiles) | node |
| `/api/knowledge/[dim]` | Knowledge-base excerpt for "Why this matters" popover | node |
| `/api/progression` | Rep-to-rep progression diff | node |
| `/api/talking-points` | Scenario-personalized scaffold generator | node |
| `/api/weekly-narrative` | Weekly coaching narrative (read-through DB cache) | node |
| `/api/cron/weekly-narrative` | Sunday 18:00 UTC cron; persists narratives to `weekly_reports` | node |
| `/api/report/pdf` | Server-side PDF export via `@react-pdf/renderer` | node |

---

## New DB tables / columns (`docs/V2_STRATEGIC_PLAN.md §3` — "Persistence")

| Object | Purpose |
|---|---|
| enum `dimension` (expanded) | Added `clarity`, `structure`, `conciseness`, `thinking_quality`, `delivery`, `adaptability`; legacy values retained for historical reads |
| enum `session_type` | `focus` / `combined` / `flow` |
| enum `pressure_archetype` | `pushback`, `time_compression`, `audience_switch`, `clarifying_interrupt`, `stakes_raise` |
| `users.streak_freezes` | Banked freezes (cap 3) |
| `users.last_pressure_archetype_id` | Cross-session archetype rotation |
| `users.last_session_weakest_dimension` | Cached tomorrow's-focus bias |
| `users.completed_reps_count` | PWA install-prompt gating signal |
| `practice_sessions.session_type` | focus / combined / flow |
| `practice_sessions.focus_dimension` | Populated for Focus sessions |
| `reps.pressure_archetype_id` | + index for analytics |
| `personal_bests` (new table) | Per-dimension all-time PBs, cross-session |
| `weekly_reports` (new table) | DB-cached weekly narratives (unique on userId + weekStartIso) |

Applied via `drizzle/migrations/0001_v2_additive.sql` using `scripts/apply-migration.mjs`. Idempotent — safe to re-run.

---

## Confirmed-deferred (external-blocked)

| Item | Blocker |
|---|---|
| Web Push notifications | Needs VAPID keys + service worker installation |
| Advisor headshots on `/about/team` | Blocked on team photo uploads |
| cognifygym.com domain cutover | Bob-gated, separate process |
| Anthropic credits top-up | Separate ops action (mock fallback is live) |

---

## How to close this out

1. Open https://cognify-v2-neon.vercel.app and walk the flow:
   - `/how-it-works` → confirm 6 dimensions
   - `/for-teams` → scroll to ROI calculator (drag the sliders) + Prior Art table
   - `/workout` → try Focus / Combined / Flow picker; run a Flow session to see auto-advance
   - `/progress` → Daily score card on top, Improvement Curve with pink CI band, Before/After audio below
   - `/report` → Print preview + Download PDF both work
   - `/settings` → Notifications section visible (toggles disabled = expected)
2. Spot-check mockup #1–4 against `docs/mockups/*.jpeg`.
3. If the walk looks right → merge `feat/gym-core` into `main` and mark the plan doc as v2.0.0 frozen.

Anything you find mismatched, post the page URL + what's off and we can patch forward.
