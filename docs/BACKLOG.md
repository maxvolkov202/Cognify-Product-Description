# Cognify — Backlog

Features and improvements deferred during the April 2026 v2-beta.1 build. Organized by theme, with priority ordering within each. Items marked **HIGH** are the first candidates for Phase 8+ work after the consumer v2 ships.

Last updated: April 2026.

---

## Gamification & retention

### Clarity Rating (ELO-style) — HIGH
A single bounded rating number (800–2400) users chase. Deterministic update formula based on composite scores vs. expected difficulty. Chess.com inspiration. Makes the gym feel like a game rather than a tool. Users will obsess over a single number in a way they never will over six dimension scores.

### Drill Packs — HIGH
Duolingo-style 7-day curated workout sequences. Examples: "Executive Presence Week", "Tough Feedback Week", "Interview Crunch". Each pack has themed rep-type picks and a completion certificate. Ship-able marketing surface + retention mechanism. Low implementation cost, high content leverage.

### Framework Mastery Trees — MEDIUM
Each framework from the library (SCQA, CDI, BIE, STAR, etc.) gets a mastery path. Complete N reps holding SCQA → "SCQA Mastery" badge. Turns the internal framework library into a visible collectible. Users never see the framework names in normal flow, but they see them when they opt into mastery tracking.

### Weekly Leagues — MEDIUM
Duolingo-style weekly leaderboard tiers. Users compete in tiers of 20–30 against other users at similar levels. Top performers promote; bottom demote. Stronger retention than a single global leaderboard because everyone has a realistic shot.

### Time-Pressure Ladder — LOW
Earn your way from 90s → 60s → 45s → 30s reps over time. Chess blitz tiers. Prompt banks tagged by difficulty level.

---

## Novel features (real differentiators)

### Mirror Mode — HIGH
After a rep, Cognify reads back a cleaned-up version of what the user said via TTS. Users hear how their point *could have* landed. Aspirational anchor. Implementation: Claude rewrites the transcript into polished form, OpenAI TTS (or ElevenLabs) voices it back. This is a **genuine differentiator** — no competitor does this.

### Before/After Upload — HIGH
User uploads their own audio (real interview recording, voicemail, Loom). Cognify transcribes, scores, generates the coached version + rewrite. The viral conversion feature — people post their improvement on LinkedIn. Conversion potential is enormous because it's personal proof.

### Live Fire Rooms — MEDIUM
Scheduled sessions where N users run the same scenario in sequence, others listen, rankings are live. Poker-tournament vibes. Built-in external validation at scale. Doubles as community building.

### Replay Graph — MEDIUM
Chess.com-style post-rep analysis surface. Transcript with per-sentence quality coloring (green/yellow/red). Click any sentence → see why it scored that way + what the alternative would sound like. Makes feedback feel forensic instead of generic.

### Voice Persona Coaches — MEDIUM
Different coach personas deliver feedback in different tones. Stern ex-McKinsey partner. Warm TED coach. Drill sergeant. Pure voice, no avatars. Users pick a persona and the feedback voice changes (and the feedback *framing* changes to match). Uses existing TTS infrastructure.

---

## Scoring maturation

### Calibration regression against blind-listener rankings — HIGH
The big one. Every completed external validation produces ground truth: humans ranked these N reps in this order. Run nightly regression (ridge or gradient boost) to learn which signal weights actually predict human preference. Update coefficients in `src/lib/scoring/deterministic.ts`, bump `RUBRIC_VERSION`, persist old scores under their original version. This is the patent-defensible calibration story captured in `docs/SCORING_METHODOLOGY.md`.

### Trend arrows in end-of-workout summary — MEDIUM
The `WorkoutEnd` component already shows daily score + Content/Delivery sub-composites + weakest dimension. Trend arrows require day-over-day comparison from `progressSnapshots`. Needs a nightly snapshot job to compute and store daily averages. Wire into `getSkillTrends()`.

### Tomorrow's focus with dynamic prompt biasing — MEDIUM
End-of-workout already picks the weakest dimension as "tomorrow's focus". Next step: actually bias tomorrow's workout toward rep types that train that dimension. Requires passing the prior session's weakest dim into `planTodaysWorkout({ focusOverride: ... })`. Small code change, measurable retention lift.

### Relevance-specific deterministic signals — MEDIUM
Currently 100% LLM-scored. Could add token-overlap heuristics (prompt keywords appearing in transcript) as a deterministic contribution. Won't replace the LLM layer but stabilizes the score floor.

### Prosody signal extraction — MEDIUM
Pitch, intonation, stress patterns. Deepgram exposes some of this (nova-3 returns word-level confidence + energy). Would enrich confidence and tone scoring. Requires parsing additional Deepgram fields and calibrating new signals.

### Per-domain signal weights — LOW
Filler rate probably matters more for cold-calling than for exec briefings (where pauses are expected). Could learn per-domain signal coefficients once the calibration regression has enough validation data stratified by domain.

---

## UX polish

### Full UI polish pass — (Phase 7, SCHEDULED)
Walk through every surface (marketing, onboarding, workout, build-a-rep, feedback, progress, leaderboard, compare, validate, settings) and improve to match the team's design sensibility. Focus: fast transitions, gym-workout feel, mobile portrait correctness, brand gradient consistency, accessibility. See task #25.

### Dynamic focus on rep screen (persistent hint) — MEDIUM
Currently shows retry focus after a completed attempt. Could also show the rep type's target dimension as a persistent pre-rep hint ("This rep trains: Clarity"). Helps users internalize what they're practicing.

### Durable pause/resume across devices — LOW
Currently localStorage-only (between-rep, 24h expiry). Database-backed would sync across devices but adds schema + a whole new state-sync pattern. Not needed unless users ask.

### Mid-rep pause — LOW
Between-rep pause is implemented. Mid-rep pause is complex (need to pause MediaRecorder, handle partial audio, resume timer) and low-value because reps are 30–60s anyway.

### Rep screen accessibility polish — MEDIUM
Screen-reader support for timer updates, pause state, callout tone badges. The rep flow is heavily visual right now.

---

## Enterprise surface (frozen until consumer v2 ships)

### Enterprise admin dashboard revisit — PARKED
`/admin/teams` routes exist from Phase A scaffolding and are frozen per Max's direction. Revisit after consumer v2 has real users and a pilot opportunity lands.

### SSO / SCIM for enterprise pilots — PARKED
Auth.js → Clerk or WorkOS migration when the first pilot requires it. Not before. Current Auth.js v5 setup is fine for B2C Google OAuth.

### Calibration sessions (admin surface) — PARKED
Assign the same scenario to all team members, review results side-by-side. Depends on enterprise admin. Parked with the admin surface.

### ROI calculator on /for-teams — PARKED
Already scaffolded as a component slot. Fill in with real math (team size × ramp time savings × hourly cost) when the business case data is validated against actual pilot outcomes.

### Pilot onboarding flow for enterprises — PARKED
Different from consumer onboarding: bulk user import, vertical locked by admin, team-level dashboards. Built on top of `/admin/teams`.

---

## Pre-existing work to clean up

### Delete `/scenario` route + `ScenarioIntake` component — LOW
`/scenario/page.tsx` currently redirects to `/build-a-rep`. The route can be deleted entirely once we're sure nothing external links to it (email campaigns, external docs, etc). `ScenarioIntake` component is orphaned and can be deleted in the same pass.

### Clean up `workout-prompts.ts` legacy shim — LOW
The `todaysWorkout()` legacy export is still there as a backwards-compat shim. Daily Workout now uses `planTodaysWorkout()` end-to-end, so the shim can be removed. Grep for any remaining callers first.

### Remove `ALL_REP_TYPES` re-export from `workout-prompts.ts` — LOW
Deprecated re-export, callers should import from `rep-types.ts` directly.

---

## Technical debt

### Test infrastructure (Vitest + Playwright) — HIGH
`tests/fixtures/scoring.ts` has hand-crafted fixtures and a `verifyAllFixtures()` function but no test runner. Install Vitest, wire the fixtures as real tests, add Playwright for e2e flows (onboarding → workout → build-a-rep → feedback). Block merges on green tests.

### Database migration rehearsal — HIGH
Every rubric change needs a migration script. Formalize the wipe-and-rebuild pattern from the v2-alpha → v2-beta.1 rubric transition as a scripted, versioned migration. Document the migration invariants in `docs/SCORING_METHODOLOGY.md`.

### Prompt cache hit monitoring — MEDIUM
Add metrics on Claude prompt cache hits. If cache hit rate drops (which would happen if the knowledge base bloats or system prompts churn too fast), the cost model breaks. Log cache-creation vs cache-hit tokens per call.

### Debug route auth gate — MEDIUM
`/api/debug/knowledge` has no auth. Safe in dev, should be gated in prod. Simple env var check (`NODE_ENV === "production" → require auth`) or IP allowlist.

### Error tracking / observability — MEDIUM
No Sentry or equivalent installed yet. Consumer v2 will surface real errors we can't debug without it. Install Sentry, wire into error.tsx, tag by route + user.

### Rate limiting on expensive endpoints — MEDIUM
`/api/score`, `/api/transcribe`, `/api/talking-points`, `/api/framework` all call paid APIs. Upstash Redis is already in the stack — add per-user rate limits to prevent abuse.

### GradientButton href types — LOW
Now that typed routes are disabled, GradientButton's `href?: string` works. If typed routes get re-enabled, the component should use `Parameters<typeof Link>[0]["href"]` for consistency.

---

## Research / experimental

### Multi-language support — LOW
Filler lexicons + scoring rubric are English-only. Adding Spanish / Mandarin / French is a research project — needs native-speaker disfluency data, not just translation. Big scope.

### Whisper fallback for Deepgram — LOW
If Deepgram becomes a bottleneck (cost or reliability), OpenAI Whisper is a drop-in alternative. Implementation: create a `transcribe.ts` provider interface, swap based on env var.

### Custom rep type creation — LOW
Let users (or eventually enterprise admins) define custom rep types with their own drill banks. Useful for industry-specific training programs. Requires a creator UI and a review queue.

### Voice cloning for coach personas — LOW
Future extension of Mirror Mode + Voice Persona Coaches. Let users choose a voice for their coach that sounds like someone they trust (with consent + legal review).

---

## User onboarding, auth, and platform surfaces (Phase 8 priority)

Captured 2026-04-11 — Max's follow-on ask after the key-setup verification.
All six items are needed before the product sees real signup traffic.

### Real user signup + Google sign-in — HIGH
Guest cookie mode works for demos, but the product needs a real account
system before any user-facing launch. Google OAuth backend wiring already
exists in `src/auth.ts` (commented `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` in
`.env.local`) — what's missing is:
- `/signin` page with Google button
- `/signup` page (email/password fallback or Google-only MVP)
- Guest → authenticated account promotion (preserve stats when a guest
  user signs up — `users.isGuest` flip + carry over the same `id`)
- Sign-out button in the header
- Session refresh handling

**Why it's HIGH:** blocks every other item on this list and blocks any
real marketing launch.

### Welcome email on signup — HIGH
Triggered on first successful authentication (not on guest-cookie
creation). Contents: welcome, link back to `/workout` for first rep,
brief explanation of Daily Workout + Build a Rep modes. Provider options:
Resend (simplest, free tier generous), Postmark (deliverability king),
SES (cheapest at scale).

**Implementation scope:** new `src/lib/email/` module with a provider
interface, one template in JSX email format (Resend supports react-email
out of the box), wire into the auth callback in `src/auth.ts` on first
sign-in. Couple hours end-to-end.

### Internal admin / ops dashboard — HIGH
Separate surface (likely `/admin` route group with strict auth check, or
a second Next.js app hosted on a subdomain) to track:
- Signups / DAU / WAU / retention cohorts
- Reps completed per day, per user, per mode
- Score distribution histograms (feeds the B1 harshness calibration
  decision — see `docs/self-test-notes/run-2026-04-11-1.md`)
- API cost tracking (Claude input/output tokens, Deepgram minutes)
- Error rate by route
- Active vs. churned user lists

**Implementation options:**
- Lightweight: `/admin` route group inside the same Next app, gated by
  an email allowlist in an env var. Fast to ship, hides in the same
  deployment, read-only queries against Neon.
- Proper: separate Next app deployed to a subdomain
  (`ops.cognify.ai`), shared Neon DB, auth-gated by a small team list.
  Cleaner separation, can be closed-sourced even if the main app is
  open-sourced later.

**Recommendation:** start with lightweight `/admin` inside the main app,
migrate to separate app when it grows past one screen.

### Help & support center — MEDIUM
- `/help` landing with common-question cards
- Per-topic articles (what is a rep, how is scoring calculated, what to
  do if your mic doesn't work, how to interpret Next Rep Focus, etc.)
- `/contact` form that routes to a shared inbox (Resend transactional
  email or a simple Postmark webhook)
- Search across help articles (MDX-based with front-matter tags, flex
  search on the client)

**Implementation scope:** MDX content model already fits Next perfectly
(`app/(marketing)/help/[slug]/page.tsx`). The content-writing is the
real cost, not the code. Ship with 8-10 articles for launch.

### Interactive tutorial page — MEDIUM
A guided first-run walkthrough that teaches the workout flow before
dropping the user into a real rep. Options:
- Embedded Loom video on `/how-it-works` (fastest, least interactive)
- Interactive product tour with callouts on the real UI (use
  `driver.js` or `intro.js` — no React lock-in, dependency-free)
- A dedicated `/tutorial` page that runs a mock rep with scripted
  feedback, so users see the feedback loop before their first real rep

**Recommendation:** ship a Loom video on `/how-it-works` for launch (2
hours of work), add the interactive tour after real user feedback shows
where the drop-offs happen.

### Email verification + password reset — LOW (only if email/password is supported)
If Google-only auth is the launch path, skip this. If email/password is
on the launch path, we need:
- Email verification on signup (existing `users.emailVerified` column)
- Password reset flow
- Rate-limited password attempts
- Bcrypt or argon2 password hashing

**Recommendation:** Google-only for MVP. Add email/password in Phase 9
once we have real users asking for it.

---

## Shipped in v2-beta.1 (reference)

For completeness, features that landed during the April 2026 build:

- ✅ 8 vertical / 7 persona / 10 improvement goal onboarding
- ✅ 6-dimension rubric (Content + Delivery grouping)
- ✅ Expert-sourced knowledge base (15 frameworks + 6 skills + 7 domains)
- ✅ Daily Workout with 9 rep types, 135+ general prompts, 5-prompt-select, Refresh, speaking threshold gate, retry-with-focus, pause/resume, end-of-session summary
- ✅ Build a Rep with 120 vertical-specific prompts, custom prompt option, context textarea, dynamic talking-points generator, editable sidebar
- ✅ Hybrid scoring: pacing pure deterministic, confidence hybrid, rest LLM
- ✅ External validation flow (blind ranking)
- ✅ Marketing: home, for-individuals, for-teams, how-it-works, pricing, product, use-cases, about, about/references
- ✅ Dashboard, progress, leaderboard, compare, settings
- ✅ Error boundaries, loading states, not-found pages
- ✅ Guest session flow + Google OAuth (optional)
