# Cognify v2 — Roadmap

Living checklist of the phased build. Waves 1–6 live below the legacy phases — the phase model captured the original build; the wave model captures ongoing feedback-driven iteration.

## Wave 6 — Improvement pass (current)

Deepens Waves 1–5, closes the #51 backlog, ships internal ops. Plan: `.claude-personal/plans/serene-brewing-pancake.md`.

- [x] A1: `planNextRep` grounds the next rep's prompt in the previous rep's weakest dimension (prompt-select shows the reason)
- [x] A2: CustomScenarioBuilder guided-survey mode (8-step wizard + 3 new context fields wired through talking-points)
- [x] A3: "Why this matters" popover on every callout, backed by `/api/knowledge/[dim]`
- [x] A4: Framework strip "See example" worked-example reveal, with curated examples per rep type
- [x] B1: `/help` FAQ + contact form → `/api/support` → Resend inbox
- [x] B2: `/tutorial` 4-screen walkthrough, `tutorialSeenAt` persistence, onboarding-done funnels into it
- [x] B3: `docs/DEPLOY.md` end-to-end Vercel pipeline
- [x] B4: `public/fixtures/sample-rep.wav` for the tutorial's "Play a sample" button
- [x] B5: Real `friendships` + `friend_challenges` schema, `/api/...` actions, `/friends` real-data view with mock-preview fallback for empty state
- [x] D: `/ops` internal dashboard (signups, DAU/WAU/MAU, funnel, recent signups, top verticals), gated on `users.isOperator`
- [x] C1: `src/lib/env.ts` runtime helper; progression API hard-fails in prod, warns in dev on missing `ANTHROPIC_API_KEY`
- [x] C2: HANDOFF_PROMPT + ROADMAP refreshed
- [ ] Final verification gauntlet

## Waves 1–5 (shipped)

Translated 6 team-text screenshots (Hunter + Max) into end-to-end feature work. All five landed cleanly before the previous session timed out.

- [x] Wave 1: FeedbackPanel rewrite — ranked weakness, 1 positive + 2 improvements with `quote` + `suggestedRewrite`, collapsible transcript with click-to-seek
- [x] Wave 2: Rep-to-rep continuity — `/api/progression`, `SinceLastRepCard`, `carryoverFocus`, `previous_rep_id` + `carryover_focus` columns
- [x] Wave 3: Per-rep-type `RepFrameworkStrip` chip row in Daily Workout with hint popover + hide toggle
- [x] Wave 4: Build-a-Rep consolidation, `CustomScenarioBuilder`, vertical-aware stakeholder lists across 8 verticals
- [x] Wave 5: Dashboard declutter, Duolingo-style `CalendarStrip`, `ThisWeekCard`, `/progress/month/[yyyyMm]` monthly report

## Phase A — Foundation (shipped)

- [x] Scaffold Next.js 15 + TypeScript + Tailwind v4 + shadcn/ui
- [x] Project docs (README, ROADMAP, PRODUCT, SCORING_METHODOLOGY, POSITIONING, COMPETITIVE, PATENT_NOTES, DEPLOY)
- [x] Brand design tokens, logo, fonts
- [x] Marketing homepage + supporting pages (for-teams, for-individuals, how-it-works, product, about, pricing, use-cases, help, about/references)
- [x] Auth.js v5 with Google OAuth + Resend magic link
- [x] Welcome email via Resend on first sign-in
- [x] `(app)` layout with user menu, sign out, nav
- [x] Drizzle schema covering users, sessions, reps, callouts, frameworks, scenarios, teams, memberships, external validations, friendships, friend challenges
- [x] Lib scaffolding (Claude, scoring, framework, knowledge base)
- [x] End-to-end Claude API round-trip verified

## Phase B — Scenario Training / Build a Rep (shipped)

- [x] Scenario intake flow (text + audience + key points + outcome + constraints)
- [x] Talking-points generation (Opus 4.6) — never names frameworks, structure adapts per scenario
- [x] Framework knowledge base (14 frameworks MD, used as grounding)
- [x] Voice capture, Deepgram transcription, Vercel Blob storage
- [x] Scoring (Sonnet 4.6) with transcript-anchored callouts + quotes + rewrites
- [x] Feedback panel with dimension scores, timestamps, retry-with-focus
- [x] Rep persistence, scenario history, rep-to-rep diff (Wave 2)

## Phase C — Daily Workout + Skill Lab + Progress (shipped)

- [x] Nine rep types with primary/secondary dimensions
- [x] Per-rep-type prompt banks + goal-weighted picker
- [x] `/workout` with intro → countdown → prompt select → rep → end-of-workout
- [x] Framework strip cheat-sheet per rep (Wave 3 + A4 example reveal)
- [x] `/progress` dashboard — per-dimension trends, streak heat map, monthly report
- [x] Onboarding (vertical → personas → goals → done → tutorial → first workout)

## Phase D — External Validation + Enterprise + IP docs

- [x] External validation setup (user picks topic + reps → token)
- [x] Public blind-ranking surface at `/validate/[token]`
- [x] Ranking aggregation → "N of M listeners ranked your Xth rep clearest"
- [x] `/admin/teams` scaffold (frozen per Q2 decision; real enterprise work deferred)
- [x] `/ops` internal dashboard (Wave 6 bucket D)
- [x] `/for-teams` marketing + ROI calculator component
- [x] `docs/SCORING_METHODOLOGY.md` with rubric + signal definitions
- [x] `docs/PATENT_NOTES.md` with process flows
- [x] `/how-it-works` methodology explainer
- [x] `/about/references` citations / research page
- [x] `/help` FAQ + contact form (Wave 6 bucket B)

## Phase E — Production iteration (ongoing)

- [ ] End-to-end playthrough on production URL (waiting on deploy)
- [x] Claude prompt tuning from real scoring output
- [ ] Lighthouse audit (≥ 95 marketing, LCP < 2s app)
- [ ] Accessibility audit (WCAG AA)
- [ ] Mobile portrait audit (iPhone)
- [ ] Security review (API authz, rate limits, audio blob access control)
- [x] Cost guardrails on Claude calls (per-user rate limiting via Upstash)
- [ ] Production deploy to cognifygym.com cutover

## Parked / out of scope for v2

- Native mobile apps (Expo / React Native)
- Live human coaching
- Live multi-user roleplay
- K–12 gamified version
- Advanced analytics beyond longitudinal dashboard
- Enterprise SSO/SCIM via Clerk or WorkOS (deferred until first pilot demands it)
