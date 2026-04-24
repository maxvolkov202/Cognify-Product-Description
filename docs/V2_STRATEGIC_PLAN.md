# Cognify V2 — Strategic Plan & Progress Tracker

> **Status:** Living document. Created 2026-04-23 from the strategy team's updates (Hunter, Max, Hupe, Nahamoo). Update the Progress Log at the end of every work session so we can resume if cut short.
>
> **Role of this file:** The single source of truth for what Cognify is building between now and the full V2 launch on cognifygym.com. Supersedes `ROADMAP.md` for net-new direction. `ROADMAP.md` remains the historical record of Phases A–E / Waves 1–6.
>
> **Source documents:**
> - `Cognify Strategic Update.md` — Hunter / Max strategic frame (IQ→EQ, Tim Tebow, the economic impact zone, B2B positioning, IP)
> - `Cognify Direction.md` — the product-level translation (3 modes, 3 session types, pressure system, feedback taxonomy, analytics, habit)
> - `V2 Updates.docx` — per-page redesign mockups (Daily Workout Home, Exercise, Start, Actual Rep). V2 Updates will be **updated continuously** as new designs come in; mirror each update into the relevant workstream below.
> - Advisors: Mr. Hupe (pressure + Subject.AI), Mr. Nahamoo (measurability), James Clear (habit framing), Ellen / Aisle 23 (reasoning engine), Jeffrey / NESSIS (patent), David / ex-IBM-Watson (validation seed). Use names explicitly in consumer-facing copy.

---

## 0. How to use this document

1. Read §1 Executive summary and §7 Sequencing before touching code.
2. **Each workstream (WS-1 through WS-10) contains its own mini-plan**: Goal / Why / Out of scope / Design decisions / Phased execution with ETAs / Task checklist / Test strategy / Rollout / Files / Success criteria / Dependencies / Status. The mini-plan is the scoping document for that workstream — treat it as the thing you read before starting work on that WS.
3. If you spot a change to the underlying strategy, add it to §9 Progress log **with a date** — don't silently edit requirements.
4. When V2 Updates.docx adds new page designs, drop the mockup link into the right workstream under "Mockup references" and add checklist items.
5. Conventions: `[ ]` pending, `[~]` in progress, `[x]` completed, `[!]` blocked. Annotate blockers inline with `⛔ blocker:`. Use `[D?]` when a task requires a design decision that isn't made yet.

---

## 1. Executive summary

Cognify V2 becomes the standard for daily communication reps by turning three advisor insights into product:

- **Hupe / Tim Tebow** → every session has a required **pressure rep**. This is the differentiator competitors can't match.
- **Nahamoo / recall speed** → score + measurable trend (daily score, weekly trend, monthly report card). Users must feel "I'm actually getting better."
- **James Clear / habit** → zero-friction start, <10 min, prompts auto-generated, visible small wins.

**UI is part of this plan, everywhere.** This is a consumer app rebuild as much as it is a system change. UI work lives in:
- **WS-2** — the 10 Product Sweep bugs (pause button, progress bar, transcript on `/try`, Settings completeness)
- **WS-5** — the flagship UI workstream: 6-skills bottom bar + four V2 page redesigns + system-wide polish across Skill Lab, Build-a-Rep, Progress, Feedback, Settings, Onboarding
- **WS-7** — new measurability surfaces (daily score card, weekly narrative, monthly report storytelling, before/after audio moment)
- **WS-8** — habit UI (PWA install prompt, personal-best animation, streak freeze)
- **WS-9** — marketing redesign (`/for-teams` Corporate Health framing, `/about/team` with named advisors)

**The single biggest outstanding strategic call**: the strategy docs name 6 dimensions (Clarity, Structure, Conciseness, Thinking Quality, Delivery, Adaptability) that don't match the current code rubric (Clarity, Structure, Relevance, Confidence, Pacing, Tone). Mockups surface the strategy-doc names. WS-1 below owns this reconciliation. **Nothing downstream ships cleanly until this is decided.**

**Recommended sequence** (details in §7):

1. WS-1 Dimension alignment (1–2 days, decision + refactor)
2. WS-2 Critical UX stabilization from Product Sweep (1 week)
3. Production cutover (days, Bob-gated) — see §6
4. WS-3 Pressure System (core differentiator) (2 weeks)
5. WS-4 Feedback taxonomy (1–2 weeks, overlaps WS-3)
6. WS-5 + WS-6 Page redesigns + session types (3–4 weeks, parallelizable)
7. WS-7 Measurability 2.0 (1–2 weeks)
8. WS-8 Habit hardening (1 week)
9. WS-9 Positioning + WS-10 IP + §5 BD run in parallel throughout

Total: ~8–10 weeks of focused build to ship the V2 we've promised. Positioning/IP/BD continue past that.

---

## 2. Strategic synthesis

### 2.1 What Cognify is (and is not)

Cognify is a **communication training system**. Not a coaching tool. Not a content platform. Not a course. A gym. The user shows up, does reps, leaves sharper. The core loop is unchanged from V1: **Speak → Feedback → Apply → Repeat.**

What V2 adds that V1 missed:
- Pressure as a **required** structural element, not an optional drill
- Feedback that maps cleanly to named components (no more "good job")
- Multiple session types (Focus / Combined / Flow), not one format
- Measurable trend the user can see, share, and defend
- Consumer app tone — human advisor names, consumer copy, zero jargon

### 2.2 What Cognify is aiming at commercially

- **B2C entry point**: early-career professionals + students. Free/lightweight signup.
- **B2B large opportunity**: Corporate Health & Performance budget (NOT L&D). Positioned as a "brain productivity benefit" — subsidized like physical-health coaching, tied to retention/output, not training compliance.
- **Tribal knowledge loss** as the B2B narrative wedge — Kraft-style examples.
- **Subject.AI pilot** (California + Saudi Arabia) is the first B2B expansion vector, via Hupe.

### 2.3 The six components — the naming call

| Strategy docs + mockups                                       | Current code (`rubric.ts`)                     | Status            |
| ------------------------------------------------------------- | ---------------------------------------------- | ----------------- |
| Clarity                                                       | `clarity`                                      | ✅ match          |
| Structure                                                     | `structure`                                    | ✅ match          |
| Conciseness                                                   | (not present)                                  | ⚠️ missing        |
| Thinking Quality                                              | (closest = `confidence`, but not the same)     | ⚠️ mismatched      |
| Delivery                                                      | (closest = `pacing`, but narrower)             | ⚠️ mismatched      |
| Adaptability                                                  | (closest = `tone`, but narrower)               | ⚠️ mismatched      |
| —                                                             | `relevance` (keep as internal gate, not user-facing?) | 🟡 orphaned |

**Recommendation (CTO view, unbiased):** Adopt strategy-doc names in the user-facing surface. They are sharper (Conciseness and Thinking Quality are real, distinct skills users recognize). Keep existing deterministic signals (filler rate, WPM, pauses, etc.) — just remap which dimension they feed. `relevance` becomes an internal gatekeeper flag (off-topic → score floor) rather than a user-visible dimension.

**Alternative** (lower effort, higher risk): Go back to the strategy team and push for the code's current names. Not recommended — the mockups are already published with the new names and the broader strategic narrative (Tim Tebow / pressure / thinking quality) relies on the semantic weight of these specific words.

WS-1 owns executing whichever call is made. Do not ship WS-3/4/5/6 before this is resolved.

---

## 3. Current state audit (as of 2026-04-23)

**Shipped and strong:**
- Phases A–D complete (marketing, auth, scoring pipeline, external validation, admin scaffold, knowledge base, Vercel deploy infrastructure)
- Waves 1–5 shipped (feedback rewrite, rep-to-rep continuity, per-rep-type framework strip, custom scenario builder, dashboard declutter + monthly report)
- Wave 6 partial (planNextRep grounding, CustomScenarioBuilder wizard, Why-this-matters popovers, help/contact, tutorial, ops dashboard)
- 9 rep types live (`src/lib/ai/rep-types.ts`)
- Full scoring pipeline: Deepgram → deterministic signals → Claude Sonnet → transcript-anchored callouts → composite + group scores
- External validation flow (blind listener rankings)
- Monthly report card + CalendarStrip + ThisWeekCard
- Onboarding (vertical → personas → goals → tutorial)

**Known gaps vs new direction:**
- No required **pressure rep** in session structure
- No **Build → Stress → Reinforce** ordering enforcement
- No **Flow Session** type (continuous reps with pressure ramp)
- No **6-skills always-visible** bottom bar with dynamic primary/secondary illumination
- Framework strip does not accept notes (mockup #3/#4 shows per-node note fields)
- Prompts are pre-selected (new design: **prompts revealed one at a time**, rep list shows "hidden" until entered)
- Session type (Focus / Combined / Flow) is not a first-class user-facing concept
- Pressure-specific prompt banks are undersized
- Dimension naming misaligned (see §2.3)
- Feedback panel not guaranteed to map every callout to one of the 6 components
- Progress bar mid-rep is missing (mockup #4) — Product Sweep confirmed
- Pause button wiring exists but no visible button (mockup #4 shows `Pause / Hold your place`) — Product Sweep confirmed
- Mid-rep timer presentation is basic (mockup #4 shows `00:10` centered + waveform)
- B2B marketing still L&D-framed on `/for-teams`, not "Corporate Health / Brain Productivity"
- Named advisors not surfaced on `/about` or `/about/references` (grep confirms no Hupe/Nahamoo references in code)
- Boxology / patent notes have scaffold but not filing-grade SVG diagrams
- 5-session repeated-test protocol exists as External Validation but is not branded/surfaced as "your Improvement Curve"
- `cognifygym.com` domain still on V1 (per `TODO.md` — blocked on Bob)
- Anthropic credits depleted in prod (AI falls back to mocks) — per `TODO.md`

**What to preserve (do not touch):**
- The scoring pipeline architecture (deterministic → LLM → composite)
- Deepgram + Vercel Blob + Supabase Auth stack
- The core practice loop (Prompt → Think → Speak → Feedback → Retry → Advance)
- The IP core: framework-constrained rep + structural-adherence scoring + spaced repetition
- External validation blind ranking — this is the flagship measurability feature

---

## 4. The plan — workstreams

Each workstream is a self-contained mini-plan. WS-1 blocks WS-3/4/5/6. WS-9/10 and BD/IP work run in parallel. Check off tasks as they land, don't delete them.

---

### WS-1 · Dimension Alignment (BLOCKER)

**Goal:** One canonical set of 6 component names used everywhere — code, UI, docs, prompts, scoring, analytics, mockups — with historical scores preserved under their original rubric version.

**Why:** Every downstream UI surface (the bottom skills bar, feedback callouts, per-rep dimension labels, progress dashboard, monthly report card) references dimension names. Shipping misaligned names means rework + user confusion + a garbled Nahamoo measurability story.

**Out of scope (explicit):**
- Renaming DB columns (use `rubric_version` tag instead; old columns remain for historical queries)
- Changing the deterministic scoring signals themselves (filler rate, WPM, etc.) — just remap which dimension they feed
- Touching V1 rep data during migration (it stays on its original rubric version forever)
- Re-scoring historical reps under the new rubric

**Key design decisions (need sign-off before engineering):**
- **D1** — Which name set? Recommendation: adopt strategy-doc names (Clarity / Structure / Conciseness / Thinking Quality / Delivery / Adaptability). Alternative: push back on strategy team.
- **D2** — Fate of `relevance`? Recommendation: keep as an internal gatekeeper that floors a rep's composite to ≤40 if the rep is off-topic, but hide from user-facing surface. Alternative: drop entirely; alternative: surface as a 7th dimension.
- **D3** — Keep Content / Delivery grouping? Recommendation: yes but re-map — Content = {Clarity, Structure, Conciseness}, Delivery = {Thinking Quality, Delivery, Adaptability}. This lets the FeedbackPanel keep its current two-column layout.
- **D4** — How to communicate the change to existing users? Recommendation: one-time in-app note on next login + a line in the monthly report card ("Dimensions renamed this month — your past scores stayed the same, just the labels got sharper.").

**Phased execution:**

*Phase 1.1 — Decision & spec (ETA: 1–2 days)*
- [ ] Max + Hunter sign off on D1–D4 (I've drafted `docs/DIMENSION_DECISION.md` as the discussion artifact)
- [ ] Confirm with Hupe + Nahamoo on next advisor call (optional; not blocking)
- [ ] Lock dimension definitions (1 paragraph per dimension) into `docs/SCORING_METHODOLOGY.md`
- [ ] Lock signal→dimension mapping table

*Phase 1.2 — Code refactor (ETA: 1 day)*
- [ ] Update `src/types/domain.ts` — rename `SkillDimension` enum members; update all imports
- [ ] Rewrite `src/lib/scoring/rubric.ts` — new `DIMENSION_RUBRIC` entries, `RUBRIC_VERSION` → `v2.0.0`, new `CONTENT_DIMENSIONS` / `DELIVERY_DIMENSIONS` groupings
- [ ] Update `src/lib/ai/rep-types.ts` — `primaryDimension` + `secondaryDimensions` per rep (9 reps × 2–3 dims each)
- [ ] Update `src/lib/ai/score.ts` prompt — new structured output schema with new dimension keys
- [ ] Update `src/lib/scoring/signals.ts` — remap which deterministic signals feed which new dimension
- [ ] Add `src/lib/scoring/dimension-aliases.ts` — old→new mapping helper for reading historical reps

*Phase 1.3 — UI relabeling (ETA: 1 day)*
- [ ] Grep every user-facing string for old names and replace — FeedbackPanel, SkillRadar, SkillTrendChart, WorkoutEnd, RepFrameworkStrip, TalkingPointsSidebar, onboarding goals, rep-type display, monthly report
- [ ] Write the one-time in-app note copy
- [ ] Update `docs/PRODUCT.md` + `docs/POSITIONING.md` + `docs/SCORING_METHODOLOGY.md` + `docs/PATENT_NOTES.md`
- [ ] Update `ROADMAP.md` to reference V2_STRATEGIC_PLAN.md for active work

*Phase 1.4 — Verification (ETA: 0.5 days)*
- [ ] Run the full scoring pipeline against 5 canonical transcripts; confirm no score regressions (only label changes)
- [ ] Visually diff the FeedbackPanel before/after — confirm layout unchanged
- [ ] Confirm historical reps load cleanly (show original labels with a "Scored under v1-beta.2" tag or silently alias)

**Test strategy:**
- **Unit:** 6 canonical transcripts (one high-score per dimension) scored under both old and new rubric; composite must be within ±3 points (pure label change should not shift score)
- **Integration:** one full workout session (4 reps) end-to-end in staging; feedback panel renders, all callouts tagged correctly
- **Regression:** `npm run typecheck` + `npm run lint` clean; existing unit tests either updated or justified

**Rollout plan:**
- Single PR to `supabase-migration` branch (same as all in-flight work)
- Bump `RUBRIC_VERSION` so old reps stay tagged — no data migration needed
- In-app note shown once on next login (dismissable)
- No feature flag needed — this is a naming change, not behavioral

**Files to touch:** `src/types/domain.ts`, `src/lib/scoring/rubric.ts`, `src/lib/scoring/signals.ts`, `src/lib/scoring/dimension-aliases.ts` (new), `src/lib/ai/score.ts`, `src/lib/ai/rep-types.ts`, all `src/components/product/*` that render dimension names, `docs/SCORING_METHODOLOGY.md`, `docs/PRODUCT.md`, `docs/POSITIONING.md`, `docs/PATENT_NOTES.md`, `docs/DIMENSION_DECISION.md` (new).

**Success criteria:**
- Grep for every old dimension name in `src/` returns zero results (except in `dimension-aliases.ts`)
- A rep scored today lists the 6 new dimensions; one scored last month still loads cleanly under its original rubric version
- Mockups and code use identical labels
- Feedback panel visual layout is unchanged

**Dependencies:** Strategy sign-off on D1–D4. Anthropic credits restored (so new rubric can be scored against real reps in staging).

**Status:** `[~]` In progress — decision doc being drafted now. ETA: 3 days once strategy signs off.

---

### WS-2 · Critical UX Stabilization (Product Sweep)

**Goal:** Close the 10 blockers from `docs/PRODUCT_SWEEP_2026-04-16.md` plus the 2 known prod bugs from `TODO.md`, so the production cutover happens on a stable surface.

**Why:** Stacking redesigns on unstable surfaces multiplies rework. The Product Sweep identifies real first-user friction — these aren't polish items, they're blockers.

**Out of scope (explicit):**
- Redesigning the affected surfaces (that's WS-5) — these fixes should match the existing V1 visual treatment
- Adding new features — only fixing what's broken
- Touching the scoring pipeline — Anthropic credits is a billing action, not code

**Key design decisions:**
- **D1** — Settings data export format? Recommendation: CSV for reps, JSON for callouts/transcripts (CSV is spreadsheet-friendly, JSON preserves nested structure).
- **D2** — Account delete: hard delete vs soft delete? Recommendation: soft delete + 30-day grace period (reversible via support) + hard delete after 30 days. Required for GDPR regardless.
- **D3** — Supabase email confirmation: keep on or off? Recommendation: keep ON but redesign the "check your email" screen to feel purposeful, not like a dead end.

**Phased execution:**

*Phase 2.1 — Critical blockers (ETA: 2 days)*
- [ ] `/try` shows transcript + callouts (not just scores) — `src/app/try/page.tsx` + `src/components/product/FeedbackPanel.tsx` (anonymous variant)
- [ ] Pause button visible during workout — `RepSurface.tsx` (wiring exists in `src/lib/workout/pause.ts`)
- [ ] Timer progress bar mid-rep — `RepSurface.tsx` (progress = elapsed / timeBudgetSec)
- [ ] Restore Anthropic credits in prod (billing; no deploy)
- [ ] Decide + implement D3 on Supabase email confirmation

*Phase 2.2 — High-priority UX (ETA: 2 days)*
- [ ] Settings: password reset (Supabase API), email change, data export (D1), account delete (D2)
- [ ] Build a Rep: preview talking points before rep starts — `BuildARepFlow.tsx`
- [ ] Fix mobile `hidden md:flex` → `md:hidden` logic bug on Challenge buttons — `FriendActionButtons.tsx`

*Phase 2.3 — Medium/Low (ETA: 1 day)*
- [ ] Friends/Leaderboard "Preview" full-width banner — `LeaderboardTable.tsx`, `friends/page.tsx`
- [ ] Validation: preview shareable link + listener view before sending — `ValidationCreator.tsx`
- [ ] Onboarding: frame baseline rep as the anchor — `BaselineRep.tsx` intro copy

**Test strategy:**
- **Smoke:** Manual playthrough as a fresh user, on desktop + iPhone Safari, hitting every item
- **Regression:** The 10 items become tagged checks in the Phase E self-test gauntlet (`ROADMAP.md` Wave 6 final verification)
- **Accessibility:** Tab-through the new buttons + modals; confirm screen reader reads pause/progress state

**Rollout plan:**
- Ship as individual PRs (one per phase) to reduce review surface
- Anthropic credits first (no deploy)
- No feature flag needed — bug fixes

**Files to touch:** `src/app/try/page.tsx`, `src/components/product/RepSurface.tsx`, `src/components/product/WorkoutSession.tsx`, `src/app/(app)/settings/page.tsx`, `src/components/product/BuildARepFlow.tsx`, `src/components/product/TalkingPointsSidebar.tsx`, `src/app/(app)/friends/page.tsx`, `src/components/product/LeaderboardTable.tsx`, `src/components/product/FriendActionButtons.tsx`, `src/app/(app)/validate/page.tsx`, `src/components/product/ValidationCreator.tsx`, `src/components/product/BaselineRep.tsx`, `src/app/onboarding/*`.

**Success criteria:** All 10 Product Sweep items resolved + both prod bugs cleared. Staging self-test gauntlet passes without flagging these again.

**Dependencies:** WS-1 partial overlap (any new dimension labels touched in `/try` FeedbackPanel).

**Status:** `[ ]` Not started. ETA: 5 working days.

---

### WS-3 · The Pressure System (the differentiator)

**Goal:** Every Daily Workout session includes **at least one required pressure rep** at a deterministic position in the session; pressure escalates across Flow Sessions; pressure reps score differently and surface as a separate trend line.

**Why:** Per Hupe, the brain under stress defaults to old pathways. Training in calm conditions doesn't transfer. If Cognify's only moat is "daily reps with feedback", Yoodli can clone that. The moat is "daily reps **with pressure built in**." This is the core IP narrative for the Boxology filing too.

**Out of scope (explicit):**
- Live multi-user pressure (Live Fire Rooms is a backlog item, not V2)
- Video-based pressure cues (avatar judging, etc.)
- Actual biometric feedback (heart rate, voice stress) — signals come from transcript + timing only
- Re-scoring pressure reps under a different rubric — same rubric, different weights

**Key design decisions:**
- **D1** — Visual treatment of a pressure rep: subtle (tiny icon change) or overt (color shift, pill label)? Recommendation: overt pre-start ("PRESSURE REP" label with red/orange accent), subtle during (no distraction), clear in feedback ("You handled pressure under [archetype]"). Hunter to bless palette.
- **D2** — Can users opt out of pressure reps? Recommendation: **no** — pressure is the differentiator, making it optional dilutes the point. Users can pick Focus (any dim) or Combined (mixed) but both get 1 pressure rep.
- **D3** — Naming: "pressure rep" / "stress test" / "challenge" / something else? Recommendation: **pressure rep** (matches strategy-doc vocabulary, ties directly to Hupe's Tim Tebow story).
- **D4** — Pressure rep duration: same as baseline (60s) or compressed (30s)? Recommendation: archetype-dependent. Time Compression = 15–30s. Others stay at normal duration.
- **D5** — What happens if a rep fails (user bails, audio corrupts)? Recommendation: retry-once at the same pressure level; after that, next pressure rep resets archetype.

**Phased execution:**

*Phase 3.1 — Schema + archetype catalog (ETA: 2 days)*
- [ ] Extend `RepType` with `isPressureType: boolean` and optional `pressureArchetype: 'pushback' | 'time' | 'audience' | 'interrupt' | 'stakes'`
- [ ] Decide: do the 5 pressure archetypes become 5 new rep types, or 5 sub-variants of the existing `handle_pressure` type? Recommendation: 5 sub-variants selected dynamically, not 5 rep types (keeps rep-type count at 9).
- [ ] Author the 5-archetype catalog in `src/lib/ai/pressure-archetypes.ts` — each archetype has: name, display label, duration delta, prompt template, scoring weight overrides

*Phase 3.2 — Pressure prompt bank (ETA: 2 days)*
- [ ] Author 40+ pressure prompts in `src/lib/ai/prompts/pressure.ts`:
  - Pushback: 10 prompts across domains (sales, interview, feedback, exec brief, peer debate)
  - Time Compression: 10 prompts with 15–30s constraints
  - Audience Switch: 10 prompts with audience swap mid-rep ("Now explain to a CFO")
  - Clarifying Interrupt: 5 prompts with an embedded interrupt cue
  - Stakes Raise: 5 prompts with stakes framing ("This is the deciding moment")
- [ ] Hunter-approved tone pass on all 40

*Phase 3.3 — Session orchestrator (ETA: 2 days)*
- [ ] Update `planTodaysWorkout()` in `src/lib/ai/workout-prompts.ts`:
  - 4-rep session: position 3 is pressure (Build → Build → **Stress** → Reinforce)
  - 5-rep session: position 4 is pressure (Build → Build → Build → **Stress** → Reinforce)
  - Flow Session: positions 2–5 each ramp pressure (see WS-6)
- [ ] Archetype selection: rotate across sessions to avoid fatigue; bias toward user's weakest dimension
- [ ] Unit tests: 100 simulated plans always place pressure correctly

*Phase 3.4 — UI + scoring (ETA: 2 days)*
- [ ] `PressureRepIndicator.tsx` component — pre-start label, subtle during
- [ ] Color palette + animation (Hunter owns visual pass)
- [ ] Scoring weight profile per archetype in `rubric.ts`
- [ ] Feedback panel: post-pressure callout explicitly references the archetype ("You held structure under pushback")

*Phase 3.5 — Analytics + surfacing (ETA: 1 day)*
- [ ] Add `pressure_performance` aggregate to monthly report (separate trend line)
- [ ] Pressure streak ("5 pressure reps in a row without bailing")
- [ ] Surface in `/progress/month/[yyyyMm]/page.tsx`

*Phase 3.6 — User test + refine (ETA: 1 week, post-launch)*
- [ ] 5-user qualitative test (3 existing users, 2 fresh)
- [ ] Collect feedback on intensity, palette, naming
- [ ] Prompt iteration based on what felt generic vs what felt real

**Test strategy:**
- **Unit:** orchestrator placement (100 runs); archetype rotation; weight profile applied
- **Prompt quality:** side-by-side pressure vs baseline prompt grades (blind-ranked by 3 reviewers)
- **User:** 5 interviews post-rep — did this feel like pressure? Did it feel cheap?

**Rollout plan:**
- Feature flag `NEXT_PUBLIC_PRESSURE_SYSTEM` — default off in prod for Phase 3.1–3.4, on in staging
- Flip on in prod after Phase 3.6 user test confirms the intensity curve is right
- Rubric version unchanged (still v2.0.0) — weight profiles are runtime, not rubric

**Files to touch:** `src/lib/ai/rep-types.ts`, `src/lib/ai/pressure-archetypes.ts` (new), `src/lib/ai/prompts/pressure.ts` (new), `src/lib/ai/workout-prompts.ts`, `src/components/product/PressureRepIndicator.tsx` (new), `src/components/product/WorkoutSession.tsx`, `src/components/product/RepSurface.tsx`, `src/components/product/FeedbackPanel.tsx`, `src/lib/scoring/rubric.ts`, `src/app/(app)/progress/month/[yyyyMm]/page.tsx`, `tests/unit/workout/*`, `docs/PRODUCT.md`, `docs/PATENT_NOTES.md`.

**Success criteria:**
- 100 simulated session plans all contain a pressure rep at the spec'd position
- Pressure reps score measurably differently from baseline reps of the same rep type
- 4 of 5 test users say "that felt like a real-world moment"
- Hupe (or stand-in) reviews and confirms "yes, that's the Tim Tebow principle"

**Dependencies:** WS-1 (dimension names used in pressure weighting); WS-6 (Flow Session pressure ramp).

**Status:** `[ ]` Not started. ETA: 2 weeks build + 1 week user test.

---

### WS-4 · Feedback Taxonomy — Every Callout Maps to a Component

**Goal:** Every feedback callout is explicitly tagged with one of the 6 components, schema-enforced. No "Good job". No orphan feedback. Users always know which muscle they trained. 1 positive + 2 improvements, max, per rep.

**Why:** Direction.md: *"Feedback is too general."* If we can't say "this callout trained Clarity" in one breath, the feedback taxonomy is broken. This also protects the measurability story (Nahamoo): users trust trend lines when each callout has a home.

**Out of scope (explicit):**
- Redesigning the feedback panel visuals (that's WS-5)
- Changing the underlying LLM model (still Sonnet 4.6)
- Adding audio-based callouts (voice stress, prosody) — text-anchored only for now
- Retroactively tagging old feedback — historical callouts stay as-is

**Key design decisions:**
- **D1** — Hard cap or soft cap on callout count? Recommendation: **hard cap** — if LLM returns >3, truncate to best-ranked. The 1+2 rule from Direction.md is non-negotiable.
- **D2** — What if LLM returns a callout without a dimension? Recommendation: validator drops it silently (logs for review) rather than breaking the whole score.
- **D3** — How do we phrase positive callouts to feel earned, not flattery? Recommendation: require specific quote + transcript timestamp + dimension — "At 0:18 you named the stakes in 4 words: 'If we miss, we close.' That's Conciseness landing." (Note the pattern.)
- **D4** — Do callouts stack across reps in a session? Recommendation: no — each rep's feedback is self-contained; the "since last rep" card (shipped in Wave 2) handles cross-rep narrative.

**Phased execution:**

*Phase 4.1 — Schema + validator (ETA: 1 day)*
- [ ] Update Zod schema in `src/lib/ai/score.ts` — every callout MUST have `dimension: SkillDimension`, `polarity: 'positive' | 'improvement'`, `quote: string`, `timestampMs: number`, `suggestedRewrite?: string`
- [ ] Update LLM prompt to enforce the schema + the 1+2 rule
- [ ] Post-LLM validator drops non-conforming callouts + logs them
- [ ] Unit test: 50 mock LLM responses → validator produces 50 valid 1+2 callout sets

*Phase 4.2 — Prompt engineering (ETA: 2 days)*
- [ ] Rewrite scoring prompt with explicit "never say 'Good job'" instruction
- [ ] Add positive-callout template (the D3 pattern)
- [ ] Add improvement-callout template (problem + suggested rewrite + dimension tag)
- [ ] A/B test new prompt vs old on 20 canonical transcripts; blind-rate callout quality

*Phase 4.3 — Feedback panel grouping (ETA: 1 day)*
- [ ] `FeedbackPanel.tsx` — group by dimension (collapsible), show 1 positive + 2 improvements by default
- [ ] Dimension badge on each callout (color-matched to bottom skills bar in WS-5)
- [ ] "What you trained" summary tile at top — primary + secondary dims from rep type

*Phase 4.4 — Cleanup (ETA: 0.5 days)*
- [ ] Grep for "Good job" / "Nice work" / generic strings in prompts + fallbacks; remove
- [ ] Backfill missing dimension tags on recent mock responses (if any shipped without)

**Test strategy:**
- **Unit:** 100 mock LLM responses → validator produces conforming output or rejects cleanly
- **Prompt:** blind A/B with 3 reviewers grading 20 feedback pairs (old vs new); new should win ≥80%
- **E2E:** live rep in staging → feedback panel renders exactly 3 callouts, all dimension-tagged

**Rollout plan:**
- Bump `PROMPT_VERSION` in score.ts (separate from `RUBRIC_VERSION`)
- Ship on main trunk — no flag, direct swap
- Monitor `score_failures` log for validator drops post-ship

**Files to touch:** `src/lib/ai/score.ts`, `src/lib/scoring/signals.ts`, `src/components/product/FeedbackPanel.tsx`, `src/components/product/CalloutCorrectionRow.tsx`, `tests/unit/scoring/*`, `src/lib/ai/prompts/scoring.ts` (if separated).

**Success criteria:**
- Every new callout has a non-null `dimension`
- Feedback panel is strictly ≤3 callouts (1 positive + 2 improvements)
- "Good job"-style bland callouts grep-zero in prompts + codebase
- A/B prompt test shows ≥80% preference for new callouts

**Dependencies:** WS-1 (dimension names). Can run partially in parallel with WS-3.

**Status:** `[ ]` Not started. ETA: 1 week.

---

### WS-5 · UI System + V2 Page Redesigns (the flagship UI workstream)

**Goal:** Ship the four redesigned pages from `V2 Updates.docx` with a persistent bottom **6-skills bar** AND extend the same design system across the full `(app)` surface — Skill Lab, Build-a-Rep, Progress, Feedback, Settings, Onboarding. Consumer-grade polish throughout. Human user names. Named advisors on marketing.

**Why:** Direction.md names the 6-skills bar "CRITICAL" for a reason — it makes the system **visible, trackable, intentional**. Users see what they're training in the moment and across the session. This is also where the gym metaphor earns its keep visually. And because the 4 mockups only cover Daily Workout flow, the rest of the app needs a companion polish pass so we don't ship a two-tier product.

**Out of scope (explicit):**
- Marketing pages (that's WS-9 — `/for-teams` redesign etc.)
- Native mobile apps (backlog, not V2)
- Avatar/voice-persona coaches (backlog)
- Design-system fundamentals rewrite — we keep Tailwind v4 + shadcn/ui + existing brand tokens
- Onboarding flow redesign beyond label updates — full onboarding rebuild is Phase 8+

**Key design decisions:**
- **D1** — 6-skills bar on mobile: horizontal-scroll strip, stacked 2×3 grid, or tappable collapsed chip? Recommendation: horizontal-scroll strip with primary skill pinned left; Hunter to bless.
- **D2** — Framework-notes feature: do notes feed scoring? Recommendation: **no** — Direction.md says "Optional · jot a word or two to guide your thinking"; scoring stays transcript-only.
- **D3** — Do framework notes persist across reps on the same framework? Recommendation: **no** — notes are per-rep ephemeral; resets on next rep.
- **D4** — Rep display titles (e.g. "Teach it step by step" for Simplify): who authors them? Recommendation: Hunter writes, I propose starters. 9 titles needed.
- **D5** — Session-type picker placement: chip row above "Today's training" or modal on "Start training"? Recommendation: chip row above, default = Combined, 1-tap to swap.
- **D6** — "Hidden" prompt reveal: progressive (each rep unveils its prompt when prior is done) or all-at-start-with-lock-icons? Recommendation: progressive — matches mockup #1 copy ("Prompts are revealed one at a time. No prep needed.").

**Phased execution:**

*Phase 5.1 — Design system primitives (ETA: 2 days)*
- [ ] `SixSkillsBar.tsx` — fixed bottom, dynamic primary/secondary/muted; 6 dims color-coded
- [ ] `DimensionBadge.tsx` — reusable pill used on feedback callouts, rep-type cards, progress charts (consistent color per dim)
- [ ] `CircleTimer.tsx` — animated ring timer (for mockup #2)
- [ ] `GradientPanel.tsx` — the blue/purple/pink right-side hero card (reused across mockups #1, #3, #4)
- [ ] `ProgressDots.tsx` — rep N-of-M progress row (used on Exercise, Start, Actual Rep pages)
- [ ] `SessionTypeChip.tsx` — chip-select (Focus / Combined / Flow)

*Phase 5.2 — Daily Workout Home (mockup #1) (ETA: 2 days)*
- [ ] Redesign `workout/page.tsx` + `WorkoutSession.tsx` intro state
- [ ] "You paused earlier — Resume" banner reads from `pause.ts`
- [ ] "Today's training" list with `DimensionBadge` + duration + "hidden" lock per rep
- [ ] "Enter the gym" `GradientPanel` with single Start CTA
- [ ] Top-nav user name pulls from profile first name
- [ ] Streak chip, exercise count, minutes chip

*Phase 5.3 — Exercise / Prompt-pick page (mockup #2) (ETA: 1 day)*
- [ ] Redesign `WorkoutPromptSelect.tsx`
- [ ] Add `displayTitle` field to `RepType` (D4); Hunter to fill in for all 9
- [ ] `CircleTimer` badge top-right
- [ ] Prompt card select affordance (checkmark state)
- [ ] Refresh button (existing; restyle)

*Phase 5.4 — Start page (mockup #3) (ETA: 2 days)*
- [ ] Redesign the "ready" state of `RepSurface.tsx`
- [ ] Framework-with-notes UI: extend `RepFrameworkStrip.tsx` to accept optional per-node textarea
- [ ] Session state: note text lives in React state, not DB (D2, D3)
- [ ] 3s countdown visual upgrade
- [ ] "Hide" framework toggle preserved

*Phase 5.5 — Actual rep page (mockup #4) (ETA: 2 days)*
- [ ] Redesign `RepSurface.tsx` recording state
- [ ] `MM:SS` countdown format (new helper `src/lib/utils/time.ts`)
- [ ] Waveform restyle
- [ ] RECORDING pill top-right
- [ ] 3 action tiles (Redo / Pause / Submit); wire Redo to drop audio + reset timer
- [ ] Progress bar on prompt card (covers Product Sweep high-priority item)

*Phase 5.6 — System-wide extension (ETA: 3 days)*
- [ ] **Skill Lab** — new landing page applying same design system; 6 skill tiles with `DimensionBadge`; rep chain with `ProgressDots`
- [ ] **Build a Rep** — apply `GradientPanel` + `CircleTimer` to the existing flow
- [ ] **Feedback panel** — apply `DimensionBadge` to every callout; new primary/secondary summary tile
- [ ] **Progress dashboard** — restyle cards; integrate `DimensionBadge` on every skill reference
- [ ] **Settings** — pass to visual consistency (buttons, cards, tab treatment)
- [ ] **Onboarding** — dimension labels updated (WS-1 did the rename; this polishes visuals)

*Phase 5.7 — Accessibility + mobile audit (ETA: 1 day)*
- [ ] Tab order through rep surface; screen-reader labels on all new buttons
- [ ] iPhone portrait: 6-skills bar variant; 3-tile action row becomes vertical stack if cramped
- [ ] Reduced-motion preference respected on ring timer + waveform

*Phase 5.8 — Consumer tone polish (ETA: 1 day)*
- [ ] User display name pulled from profile across all pages (not placeholder)
- [ ] Copy audit: any jargon / "AI coach" phrasing → plain language
- [ ] Microcopy pass on empty states, loading states, error states
- [ ] Hunter's taste pass on palette, spacing, typography across all 4 mockup pages

**Test strategy:**
- **Visual:** side-by-side mockup comparison; each mockup page indistinguishable from its reference
- **Interactive:** full Daily Workout flow on desktop + iPhone Safari; no layout breakage
- **Motion:** 6-skills bar transition feels smooth (200ms, no flicker)
- **A11y:** Axe scan on each new page, zero critical findings
- **Regression:** `/try`, `/workout`, `/skill-lab`, `/build-a-rep`, `/progress`, `/settings`, `/onboarding` all render cleanly

**Rollout plan:**
- Feature flag `NEXT_PUBLIC_UI_V2` — default off in prod, on in staging
- Ship Phase 5.1 primitives in a separate PR (foundational)
- Phases 5.2–5.5 can be individual PRs (each mockup page independent)
- Phase 5.6 extension rides on the same flag
- Flip flag on in prod after Hunter's full visual sign-off + 1-day staging soak
- Keep V1 components around under `src/components/product/legacy/` for 2 weeks, then delete

**Files to touch:** too many to list per-file; full list:
- New components: `SixSkillsBar.tsx`, `DimensionBadge.tsx`, `CircleTimer.tsx`, `GradientPanel.tsx`, `ProgressDots.tsx`, `SessionTypeChip.tsx`
- Modified: `src/app/(app)/layout.tsx`, every page under `src/app/(app)/*`, every component under `src/components/product/*`
- Types: `src/lib/ai/rep-types.ts` (displayTitle)
- Utils: `src/lib/utils/time.ts` (new)

**Success criteria:**
- Side-by-side visual diff against the 4 mockups: zero meaningful differences
- 6-skills bar renders correctly on desktop + mobile portrait + tablet
- Hunter signs off on visual taste across the full app surface
- Lighthouse score stays ≥90 (mobile and desktop)
- No regression in existing automated tests

**Dependencies:** WS-1 (dimension names → badge labels), WS-6 (session types → chip), WS-3 (pressure indicator color palette).

**Status:** `[ ]` Not started. Mockups acquired 2026-04-23. ETA: 3 weeks build + 1 week polish.

**Mockup references:**
- #1 Daily Workout Home — `https://claude.ai/public/artifacts/586d0891-9180-4c45-84c5-e0526d92ab00`
- #2 Exercise — `https://claude.ai/public/artifacts/eba6165f-1f0e-4efb-870e-2fd95c04d446`
- #3 Start — `https://claude.ai/public/artifacts/f9e32508-a3ed-4319-bc3a-01338037d3f0`
- #4 Actual Rep — `https://claude.ai/public/artifacts/4a934123-f450-491b-b902-5a706f7ec75b`
- (future mockups from rolling V2 Updates.docx → append here as they arrive, with date)

---

### WS-6 · Session Types + Flow Session + Build→Stress→Reinforce

**Goal:** Three explicit session types (**Focus** / **Combined** / **Flow**) selectable by the user, each with its own orchestration. Build→Stress→Reinforce is the default arc; Flow Session compresses reset time between reps and ramps pressure continuously.

**Why:** Direction.md: three session types are named explicitly. Flow Session is called out specifically as the mode that "trains recall speed and composure under sustained pressure." Without it we're not training the Nahamoo recall-speed dimension.

**Out of scope (explicit):**
- Multiplayer flow (backlog — Live Fire Rooms)
- Custom user-defined session types
- Scheduling ahead ("I'll do Flow on Thursday") — reactive, not calendar-based
- Changing what a "rep" fundamentally is — still speak-then-get-feedback

**Key design decisions:**
- **D1** — Session-type selection friction: always pick, or smart default? Recommendation: smart default = Combined for new users, last-used for returning; 1-tap to swap.
- **D2** — Flow Session feedback depth: single-sentence vs full panel? Recommendation: single-sentence in-flow + full panel at end-of-session recap.
- **D3** — Flow Session reset time between reps: how short is too short? Recommendation: start at 3s (fades audio, shows 1-line feedback, auto-advances); user-testable.
- **D4** — Flow ends how? Recommendation: fixed 5-rep block, then full recap screen; no infinite mode (yet).
- **D5** — Can Focus Workout pick any dimension, or only the user's weakest? Recommendation: user picks; smart suggest = weakest.

**Phased execution:**

*Phase 6.1 — Schema + picker (ETA: 1 day)*
- [ ] Add `sessionType: 'focus' | 'combined' | 'flow'` to `workout_session` table
- [ ] Migration: default existing sessions to `combined`
- [ ] `SessionTypeChip.tsx` on Daily Workout Home (reused from WS-5 Phase 5.1)

*Phase 6.2 — Focus Workout orchestrator (ETA: 1 day)*
- [ ] New planner variant in `workout-prompts.ts` — all reps primary-dim = user's pick
- [ ] Rep-type filter: only types whose `primaryDimension` matches
- [ ] Picker UI: dimension select before starting (if not auto-picked)

*Phase 6.3 — Combined Workout (rename + confirm existing) (ETA: 0.5 days)*
- [ ] Existing behavior; just label/track it as `combined`
- [ ] Confirm pressure rep still placed correctly (WS-3 orchestrator)

*Phase 6.4 — Flow Session orchestrator + UI (ETA: 4 days)*
- [ ] New planner: 5-rep chain, pressure ramps (rep 1 normal, rep 2 time-compressed, rep 3 audience switch, rep 4 pushback, rep 5 interrupt/stakes)
- [ ] `FlowFeedbackPanel.tsx` — single-sentence in-flow feedback, auto-advance after 3s (D3)
- [ ] New Flow recap screen at end — full panel with session arc, pressure performance, biggest improvement
- [ ] Audio handling: pre-cache next prompt audio during feedback to avoid lag
- [ ] Keyboard/tap to "skip feedback + advance now" for impatient users

*Phase 6.5 — Analytics integration (ETA: 1 day)*
- [ ] Per-session-type aggregates in `/progress`
- [ ] Streak breakdown: "10-day streak (3 Focus, 4 Combined, 3 Flow)"
- [ ] Monthly report surfaces Flow Session "recall speed" metric

*Phase 6.6 — User test (ETA: post-launch)*
- [ ] 3-user test of Flow Session — does the compression feel "flow" or "rushed"?
- [ ] Iterate D3 reset time based on feedback

**Test strategy:**
- **Unit:** each orchestrator produces spec-conforming plans (rep types, pressure placement, dimension focus)
- **Integration:** full session end-to-end for each type in staging
- **Perf:** Flow reset time actually <3s including audio pre-cache
- **User:** 3-user Flow intensity calibration

**Rollout plan:**
- Feature flag `NEXT_PUBLIC_SESSION_TYPES` — Combined always on; Focus + Flow flagged
- Ship Focus first (simpler), then Flow after calibration
- Staged prod rollout: 10% → 50% → 100% on Flow

**Files to touch:** `src/lib/db/schema.ts`, DB migration, `src/lib/ai/workout-prompts.ts`, `src/components/product/WorkoutSession.tsx`, `src/components/product/FlowFeedbackPanel.tsx` (new), `src/components/product/WorkoutIntro.tsx`, `src/app/(app)/progress/*`, `src/components/product/SessionTypeChip.tsx` (from WS-5).

**Success criteria:**
- Each session type runs end-to-end without bugs
- Flow Session intensity curve is palpable — users say "I could feel it ramping"
- Per-type analytics surface cleanly in Progress

**Dependencies:** WS-1, WS-3 (pressure archetypes power the Flow ramp), WS-5 (UI primitives).

**Status:** `[ ]` Not started. ETA: 2 weeks build + 1 week tuning.

---

### WS-7 · Measurability 2.0 — Daily / Weekly / Monthly

**Goal:** A measurability layer polished enough that users, advisors, and enterprise buyers can all say "I can see the improvement." This is the Nahamoo pitch in pixels.

**Why:** Direction.md: *"Daily Scores · Weekly Trends · Monthly Report Card."* Most pieces exist (Phase C + Wave 5) but they're under-curated. Users don't currently get a visceral "I got better" moment.

**Out of scope (explicit):**
- Leaderboards beyond what exists (that's separate)
- Per-domain calibration (filler rate weighted differently for sales vs exec) — backlog
- Re-scoring history to clean up old scoring drift
- External-validation-driven calibration regression (backlog item, depends on data volume)

**Key design decisions:**
- **D1** — Weekly narrative generation timing: Sunday night cron, Monday morning pull, or on-demand? Recommendation: cron Sunday 6pm local; cached; refreshable on-demand.
- **D2** — Weekly narrative voice: third-person analytical or second-person coach? Recommendation: second-person ("You leveled Structure up +11% this week"). Matches consumer app tone.
- **D3** — Before/After audio: auto-surface in monthly report, or opt-in? Recommendation: auto-surface in monthly report; opt-in share via external-validation link.
- **D4** — Does the monthly report card export to PDF? Recommendation: yes (covers the B2B "exportable progress report" narrative); phase 7.4.

**Phased execution:**

*Phase 7.1 — Daily score card (ETA: 2 days)*
- [ ] `DailyScoreCard.tsx` — overall composite + 6 component scores + deltas vs yesterday
- [ ] Nightly cron (or on-read cache) computing daily averages → `daily_scores` table
- [ ] Delta indicators: up/down/flat arrows + numeric
- [ ] Integrate into `(app)/dashboard` above existing ThisWeekCard

*Phase 7.2 — Weekly narrative (ETA: 3 days)*
- [ ] `weekly_reports` table (user_id, week_start, narrative, top_3_stats, worst_dim, best_dim)
- [ ] Sunday-6pm cron job to generate (Claude Sonnet via `src/lib/ai/weekly-summary.ts`)
- [ ] `WeeklyNarrative.tsx` component on dashboard
- [ ] Refresh-on-demand button
- [ ] Empty state (first week, <5 reps): different copy ("Keep going — your first week recap arrives Sunday.")

*Phase 7.3 — Monthly report storytelling (ETA: 3 days)*
- [ ] Redesign `/progress/month/[yyyyMm]/page.tsx`
- [ ] Hero stat: "You improved Clarity +18% this month"
- [ ] Dimension-by-dimension breakdown with % deltas
- [ ] Best rep audio playback (composite-highest rep of the month)
- [ ] Streak record
- [ ] 3-pressure-archetype performance chart (ties to WS-3 analytics)

*Phase 7.4 — Before/After moment (ETA: 2 days)*
- [ ] `BeforeAfterComparison.tsx` — picks earliest + latest rep on a topic; side-by-side audio + transcript
- [ ] Transcript diff highlights (what was new in the improvement)
- [ ] Auto-surfaces in monthly report
- [ ] "Share this" button → validation flow integration (WS-10)

*Phase 7.5 — PDF export (ETA: 2 days)*
- [ ] `src/lib/pdf/monthly-report.ts` — React PDF template
- [ ] Download button on monthly report page
- [ ] Branded for B2B (logo, month, user, key stats)
- [ ] Single-page design

**Test strategy:**
- **Unit:** daily score calc + delta logic + weekly narrative output schema
- **Integration:** cron job runs cleanly; narrative generated within 5s per user
- **Visual:** monthly report renders cleanly with 0/1/10/100 reps of history
- **PDF:** renders correctly on Chrome print preview (baseline); email-attachable

**Rollout plan:**
- Daily score ships first (no flag, additive)
- Weekly narrative flagged `NEXT_PUBLIC_WEEKLY_NARRATIVE` — on in staging, on in prod after one Sunday cron run validates output
- Monthly report updates ship behind the same `UI_V2` flag as WS-5

**Files to touch:** `src/components/product/DailyScoreCard.tsx` (new), `src/components/product/WeeklyNarrative.tsx` (new), `src/components/product/BeforeAfterComparison.tsx` (new), `src/app/(app)/progress/month/[yyyyMm]/page.tsx`, `src/lib/ai/weekly-summary.ts` (new), `src/lib/pdf/monthly-report.ts` (new), DB migrations for `daily_scores` + `weekly_reports`.

**Success criteria:**
- Nahamoo can log in, see daily + weekly + monthly, say "yes, this measures improvement"
- Before/After produces a shareable moment (first user tries it within first month of active use)
- PDF export renders cleanly and is emailable

**Dependencies:** WS-1 (names on cards), WS-4 (feedback dimension tags feed rollups).

**Status:** `[ ]` Not started. Foundation exists in `StreakHeatmap`, `CalendarStrip`, `ThisWeekCard`, month page. ETA: 2 weeks.

---

### WS-8 · Habit System Hardening

**Goal:** Every habit principle from Direction.md is demonstrably true in the product. No knobs, no setup, just reps.

**Why:** James Clear principles aren't design polish — they're retention. A user who fumbles setup drops. A user who starts with one tap comes back.

**Out of scope (explicit):**
- Social habits (accountability partners, public goals) — that's Friends (shipped)
- Email digests beyond existing ones
- SMS — channel not supported
- Full gamification (Clarity Rating ELO, Drill Packs) — backlog

**Key design decisions:**
- **D1** — Notifications: when to send? Recommendation: morning (user-configurable time, default 8am) if streak at risk; weekly recap Sunday.
- **D2** — Streak freeze: 1 per 7 days, 1 per 30 days, or different? Recommendation: 1 per 7-day streak earned, auto-applied (no user action needed). Prevents guilt-quit.
- **D3** — Personal-best animation: loud (confetti) or quiet (subtle glow)? Recommendation: quiet. Consumer app but no goof.
- **D4** — PWA install prompt timing: day-1 or day-7? Recommendation: day-3 after 3 completed workouts (earned right to ask).

**Phased execution:**

*Phase 8.1 — Zero-friction audit (ETA: 1 day)*
- [ ] Time-to-first-rep measurement in staging — baseline
- [ ] Remove any modal / tooltip / overlay that appears between landing and first rep on returning user
- [ ] Confirm 1-tap start from logged-in dashboard works
- [ ] Confirm direct URL `/workout` starts a session immediately for returning users

*Phase 8.2 — PWA + install (ETA: 1 day)*
- [ ] Review `public/manifest.json` (icons, name, theme color, start_url)
- [ ] iOS + Android test — install works, launches in standalone mode
- [ ] Day-3 install prompt component (D4) — dismissable, re-surfaces after 2 weeks

*Phase 8.3 — Notifications (ETA: 2 days)*
- [ ] Web Push API integration (requires Service Worker update)
- [ ] Settings toggle for notification preferences (morning, weekly, streak-at-risk)
- [ ] Supabase Edge Function for push delivery (or server action with web-push library)
- [ ] Default opt-in on signup? Recommendation: opt-in required (CAN-SPAM and iOS requirement)

*Phase 8.4 — Streak freeze + grace (ETA: 1 day)*
- [ ] `streak_freezes` column on user table (integer count)
- [ ] Earned: after every completed 7-day streak, +1 freeze (cap at 3)
- [ ] Auto-applied when streak would break
- [ ] Notification: "You missed a day — freeze used. 2 left."

*Phase 8.5 — Personal-best celebration (ETA: 1 day)*
- [ ] Post-rep check: was any dimension score a personal best?
- [ ] If yes: subtle animation (D3) + "Personal best! Clarity: 87" toast
- [ ] Cap to 1 celebration per rep to avoid spam

**Test strategy:**
- **Unit:** streak freeze logic (earned, applied, capped)
- **Integration:** end-to-end signup → first rep in <90s (stopwatch)
- **Device:** iPhone Safari + Android Chrome PWA install + push reception
- **Qualitative:** have 2 users go dark for 7 days, return — did notifications work? Did streak survive?

**Rollout plan:**
- PWA + notifications behind flag `NEXT_PUBLIC_HABIT_SYSTEM`
- Daily/weekly/streak notifications launched incrementally
- Start conservative on notification frequency; escalate after opt-out rates stabilize

**Files to touch:** `public/manifest.json`, `public/sw.js` (service worker), `src/app/layout.tsx` (install prompt), `src/lib/notifications/*` (new), `src/app/(app)/settings/page.tsx` (notification toggles), `src/components/product/InstallPrompt.tsx` (new), `src/components/product/PersonalBestToast.tsx` (new), DB migration for `streak_freezes`.

**Success criteria:**
- Time-to-first-rep <90s for returning user, <2min for new user
- 1-tap start works on iOS + Android PWA
- Notification opt-in rate >30%
- Streak freeze prevents quit-for-one-missed-day

**Dependencies:** WS-5 (home page redesign touches the same surfaces), WS-7 (notifications reference weekly narrative).

**Status:** `[ ]` Not started. ETA: 1 week.

---

### WS-9 · Positioning Shift — B2B Corporate Health, Named Advisors

**Goal:** Marketing narrative matches the strategic update — B2B positioned as Corporate Health & Performance (not L&D); advisor names front and center; consumer copy uses human language.

**Why:** *"It belongs in the Corporate Health and Performance budget, positioned as a brain productivity benefit."* — Strategic Update.md. L&D budgets are the first cut. Health is sacred. This is a real economic re-framing, not a rename.

**Out of scope (explicit):**
- Running actual B2B outbound (that's BD workstream §5)
- Generating real Kraft-style case studies (don't have data yet — use generic "Enterprise X lost $Y to tribal knowledge loss" with sourced stat)
- Redesigning product-facing pages (that's WS-5)
- Localization (English first; Arabic comes with Subject.AI pilot)

**Key design decisions:**
- **D1** — Which advisor bios get pictures? Recommendation: all five — Hupe, Nahamoo, Ellen, Jeffrey, David. Need headshots from each.
- **D2** — `/for-teams` CTA: "Book a pilot" / "Request a demo" / "Start pilot conversation"? Recommendation: "Book a pilot" (shorter, more confident).
- **D3** — Do we publish the dimension naming (Clarity, Structure, etc.) on marketing? Recommendation: yes on `/how-it-works`; no on `/for-teams` hero (too dense, save for deeper pages).
- **D4** — Pricing page update? Recommendation: B2B tier labeled "Corporate Health" (not "Enterprise"); consumer tier stays as-is.

**Phased execution:**

*Phase 9.1 — Copy draft (ETA: 2 days)*
- [ ] Draft new `/for-teams` hero + narrative in `docs/POSITIONING.md` section (working doc)
- [ ] Draft 5 advisor bios (60–80 words each)
- [ ] Draft ROI calculator new narrative: retention × seat × time-to-contribution framing
- [ ] Strategy team review + revisions (Hunter owns)

*Phase 9.2 — `/for-teams` rebuild (ETA: 3 days)*
- [ ] New hero with Corporate Health framing
- [ ] Tribal-knowledge-loss narrative section (with sourced stat)
- [ ] Proof beats (stats bar — reused from existing positioning)
- [ ] New CTA band (D2)
- [ ] ROI calculator component updated (existing scaffold in place)

*Phase 9.3 — `/about/team` (new) (ETA: 2 days)*
- [ ] New route `src/app/(marketing)/about/team/page.tsx`
- [ ] Advisor cards with photos + bios
- [ ] Link from `/about` and footer
- [ ] Consumer-tone copy ("Cognify is built with input from people who've spent careers on this problem")

*Phase 9.4 — Copy audit across marketing (ETA: 1 day)*
- [ ] Grep all marketing pages for banned phrases: "leverage", "empower", "unlock your potential", "AI coach", "soft skills"
- [ ] Replace each with plain language
- [ ] Confirm dimension names used match WS-1

*Phase 9.5 — Pricing + home update (ETA: 1 day)*
- [ ] B2B tier relabeled
- [ ] Home page hero variants updated (`enterprise` and `dual` modes)

**Test strategy:**
- **Copy:** strategy team blind-review (Hunter + Max) on `/for-teams` before publish
- **Live test:** share with 1 Corporate Health / HR buyer contact for reaction
- **Lighthouse:** marketing pages ≥95 on both desktop + mobile after redesign
- **Grep:** banned phrases return zero results

**Rollout plan:**
- Ship as one PR; publish all updated marketing pages together
- Keep `NEXT_PUBLIC_MARKETING_MODE` env variable for hero variant selection (existing)
- If strategy team wants a soft rollout, push to a staging subdomain first

**Files to touch:** `src/app/(marketing)/for-teams/page.tsx`, `src/app/(marketing)/about/page.tsx`, new `src/app/(marketing)/about/team/page.tsx`, `src/app/(marketing)/page.tsx`, `src/app/(marketing)/pricing/page.tsx`, `src/app/(marketing)/how-it-works/page.tsx`, `docs/POSITIONING.md`, `public/team/*` (photos, need from team).

**Success criteria:**
- `/for-teams` never uses the phrase "Learning and Development" in hero or narrative
- All 5 named advisors present with photos + bios on `/about/team`
- Banned phrases grep-zero
- 1 Corporate Health buyer finds the framing believable

**Dependencies:** None code-wise. Strategy team for copy. Team members for photos + bios.

**Status:** `[ ]` Not started. ETA: 2 weeks (depends heavily on strategy/photo turnaround).

---

### WS-10 · IP / Boxology + 5-Session Improvement Curve

**Goal:** Patent-filing-grade Boxology documentation + a user-facing "Improvement Curve" that operationalizes David's 5-session validation test.

**Why:** Strategic Update.md: *"Cognify is pursuing a Provisional Patent based on its Boxology."* Also: *"Execute the 5-session repeated test with biased and unbiased observers to document the Improvement Curve."* Both are IP-and-credibility work that B2B buyers (and patent examiners) need.

**Out of scope (explicit):**
- Full utility patent (provisional only for now; full follows within 12 months)
- International filings (US provisional first; international strategy post-filing)
- Calibration regression against validation data (backlog item — depends on data volume)
- Re-scoring old reps against validation ground truth

**Key design decisions:**
- **D1** — SVG diagram source: Excalidraw, draw.io, Figma? Recommendation: Excalidraw (easy export, version-control-friendly, patent-adjacent tooling).
- **D2** — Inventor list: Max + Hunter always; Owen (based on contribution); Sides (TBD — legal cleanup needed). Recommendation: document contributions explicitly in `docs/INVENTORS.md` before filing.
- **D3** — 5-session test protocol: who are the biased/unbiased listeners? Recommendation: biased = SD employees + advisors; unbiased = consumer pool (MTurk or similar); target 3+3 per protocol.
- **D4** — Improvement Curve visualization: line chart or step chart? Recommendation: line with 95% confidence band (shows both trend and signal-vs-noise).
- **D5** — Does the public validation page show the improvement curve? Recommendation: yes after user completes 5 validated reps (becomes shareable proof).

**Phased execution:**

*Phase 10.1 — Boxology diagrams (ETA: 3 days)*
- [ ] Author 3 SVG flow diagrams (Excalidraw):
  - Diagram 1: User-facing loop (onboarding → scheduling → mode → rep → feedback → progress)
  - Diagram 2: Scoring pipeline (audio → Deepgram → signals → LLM → composite → persistence)
  - Diagram 3: Validation loop (5-rep capture → blind ranking → aggregation → improvement curve)
- [ ] Export as SVG + PNG
- [ ] Embed in `docs/PATENT_NOTES.md`

*Phase 10.2 — Prior-art research (ETA: 2 days)*
- [ ] USPTO + Google Patents search: "communication training" + "framework" + "spaced repetition" + "voice feedback" + "structural adherence"
- [ ] Document top 20 related filings in `docs/PRIOR_ART.md` (new)
- [ ] FTO gap analysis: Yoodli, Speeko, Orai, Hyperbound, SecondNature
- [ ] Note any broad claims we need to avoid

*Phase 10.3 — Provisional package (ETA: 2 days)*
- [ ] Package cover sheet, claim families, spec, drawings → hand-off folder for Jeffrey's attorney
- [ ] Inventor list + assignment clarity doc
- [ ] Sides conversation — needed clearance (flag if blocked)

*Phase 10.4 — Improvement Curve component (ETA: 2 days)*
- [ ] `ImprovementCurve.tsx` — line chart with 95% CI band
- [ ] Data source: user's last 5 reps on a topic; if validation rankings exist, overlay them
- [ ] Integrated into `/progress` and `/validate/[token]/results`
- [ ] Empty state (fewer than 5 reps on any single topic): "Do 5 reps on one topic to see your curve."

*Phase 10.5 — 5-session validation protocol (ETA: 2 days)*
- [ ] Protocol doc in `docs/VALIDATION_PROTOCOL.md`
- [ ] UI prompt: after 5 reps on same topic, CTA "Share for validated improvement"
- [ ] Validation creator flow encourages 3+3 biased/unbiased listener recruitment
- [ ] Results PDF includes Improvement Curve + aggregated listener rankings
- [ ] "Improvement receipt" download (PDF) — shareable on LinkedIn

*Phase 10.6 — First real run (ETA: 2 weeks, post-infrastructure)*
- [ ] 5 users complete the 5-session protocol
- [ ] Document results — is the Improvement Curve real? Are blind rankings trending up?
- [ ] Write up as "first Improvement Curve proof" for B2B pitches

**Test strategy:**
- **Legal:** patent attorney reviews provisional package — no red flags
- **Diagram:** advisor review (Hupe or Nahamoo) of Boxology — do the boxes capture what we actually do?
- **Validation:** statistical — do blind rankings on 5 real users show positive trend? (If not, either product doesn't work yet or we need more data.)

**Rollout plan:**
- Patent work is private until provisional filed
- Improvement Curve ships with WS-7 rollout (flagged)
- Validation protocol doc publishes on `/how-it-works` (public-facing methodology)

**Files to touch:** `docs/PATENT_NOTES.md`, `docs/PRIOR_ART.md` (new), `docs/INVENTORS.md` (new), `docs/VALIDATION_PROTOCOL.md` (new), `docs/BOXOLOGY-1.svg` + `BOXOLOGY-2.svg` + `BOXOLOGY-3.svg` (new), `docs/SCORING_METHODOLOGY.md`, `src/components/product/ImprovementCurve.tsx` (new), `src/app/(app)/progress/*`, `src/app/validate/[token]/results/page.tsx`, `src/lib/pdf/validation-receipt.ts` (new).

**Success criteria:**
- Patent attorney receives package deemed "ready to file provisional"
- 1 user with 5+ validated reps sees an upward-trending curve (proves product value)
- `docs/PATENT_NOTES.md` reads as filing-grade to a technically literate lawyer
- Sides assignment cleanup is documented

**Dependencies:** Jeffrey attorney intro (parallel). Sides conversation (parallel). WS-1 (dimension names in diagrams). WS-7 (Improvement Curve shares visualization tech).

**Status:** `[ ]` Not started. Scaffold exists in `docs/PATENT_NOTES.md`. ETA: 2 weeks build + ongoing BD.

---

## 5. BD, Advisor, and Pilot workstreams (run in parallel)

These aren't code-heavy but they're on the critical path to making Cognify a business.

- [ ] **Ellen / Aisle 23 — reasoning engine collab kickoff**
  - Scope call: what does "advanced feedback" mean? What part of the scoring pipeline does Aisle 23 own vs Cognify?
  - Data sharing agreement (anonymized transcript samples)
  - Integration plan (API boundary)
  - Owner: Max
- [ ] **Subject.AI pilot prep (California + Saudi Arabia)**
  - Pending Hupe collaboration
  - Localization questions (language, market adaptation) — do we need Arabic? Scoped dimension/prompt translation?
  - Commercial terms: per-seat, pilot-free, revenue share?
  - Owner: Max + Hupe
- [ ] **B2B addressable market analysis**
  - Corporate Health & Performance TAM vs L&D TAM
  - Anchor customer list (first 10 pilot targets)
  - Owner: Hunter (business plan)
- [ ] **Advisor follow-up cadence**
  - Quarterly review with Hupe + Nahamoo on IP + product progress (next: Q3 2026)
  - Jeffrey patent-attorney intro meeting
  - David check-in on validation curve data
  - Owner: Max
- [ ] **Validation test execution**
  - Recruit 5 users willing to do 5 reps on a topic over a week
  - Recruit 3+3 biased/unbiased listeners (advisor pool? SD employees?)
  - Run the protocol; document the Improvement Curve
  - Owner: Max (recruit) + Hunter (analyze)

---

## 6. Deploy coordination (two targets)

There are **two distinct deploy targets**, and they have different blockers. Ref `TODO.md` + `docs/DEPLOYMENT.md` for details.

### 6.1 Preview / iteration — `cognify-v2-neon.vercel.app` (UNBLOCKED)

Max's Vercel project `cognify-v2` under `maxvolkov202s-projects` team. Every commit can ship here immediately; this is where current work is visible to the team.

- [x] `.vercel/project.json` correctly points to `prj_SwZBC9rMztIlOxSdJPwVpHvr5seE` (team `team_fAzZIbLNs3aHUdDIJ6gsCrlX` = `maxvolkov202s-projects`)
- [x] Manual deploy works: `npx vercel@latest deploy --prod --yes --scope maxvolkov202s-projects` (~45s build, auto-aliases to `cognify-v2-neon.vercel.app`)
- [ ] Wire Vercel GitHub app so pushes auto-deploy. Blocker: Vercel GitHub app needs to be installed on `maxvolkov202`'s GitHub account; then `vercel git connect` will complete cleanly. Low-priority — manual deploy works fine meanwhile.
- [ ] Optional alternative: GitHub Actions workflow using `VERCEL_TOKEN` secret for auto-deploy on push.

**Deploy cadence:** after each logical chunk of work, run the deploy command. Takes ~1 minute total.

### 6.2 Production cutover — `cognifygym.com` (BOB-BLOCKED)

Bob's upstream Vercel project serves the real production domain. Merging `maxvolkov202:supabase-migration → bobsides-AICodebase:main` triggers the cutover.

- [!] **Get Bob on a 10-minute call** (unblocks everything) — ⛔ blocker: Bob availability
- [ ] Confirm Vercel project ownership + access on the upstream (Bob-owned) project
- [ ] Paste env vars per `docs/DEPLOYMENT.md` §2 (Supabase, Anthropic, Deepgram, Resend, Upstash)
- [ ] **Restore Anthropic credits** (AI currently returns mocks in prod) — billing action, no deploy
- [ ] Open PR from `maxvolkov202:supabase-migration` → `bobsides-AICodebase:main`
- [ ] Preview deploy smoke test (sign up → rep → score → feedback)
- [ ] 🚀 Merge PR → cognifygym.com live on V2
- [ ] Google OAuth wiring (post-launch polish)
- [ ] Async scoring Edge Function (post-launch optimization)
- [ ] Sentry + Vercel Analytics
- [ ] Real iPhone + Android browser testing

**Success criteria:** cognifygym.com serves V2; first real paying user can complete a rep end-to-end; scoring returns real AI output (not mocks).

**Status:** `[!]` Still blocked on Bob call for the production cutover. Preview path is fully unblocked.

---

## 7. Sequencing recommendation

The order to ship this in:

| # | Workstream                              | Parallel? | Why first / why later |
|---|-----------------------------------------|-----------|--------------------|
| 1 | WS-1 Dimension alignment                | No        | Everything touches names. Unblock in 1–2 days. |
| 2 | WS-2 Product Sweep critical UX          | Yes w/ 1  | Low-risk, high-visible polish. Unblocks prod cutover. |
| 3 | Production cutover (§6)                 | Serial    | Gets V2 on cognifygym.com before building more on top. |
| 4 | WS-3 Pressure System                    | No        | The differentiator. Must land before B2B pitches. |
| 5 | WS-4 Feedback taxonomy                  | Yes w/ 3  | Cheap while we're in scoring-adjacent code. |
| 6 | WS-5 + WS-6 Page redesigns + sessions   | Parallel  | Big visual moment. Invest once, reap everywhere. |
| 7 | WS-7 Measurability 2.0                  | Serial    | Requires the 6 names finalized + pressure data flowing. |
| 8 | WS-8 Habit hardening                    | Serial    | Polish phase after core is stable. |
| 9 | WS-9 Positioning + WS-10 IP + §5 BD     | Parallel throughout | Non-engineering, always progressing. |

This is ~8–10 weeks of focused build plus rolling BD/IP/positioning. If WS-5/6 parallelize across two engineers, shave to 6–7.

---

## 8. Risk register

- **R1** Dimension-name decision drifts → downstream rework. **Mitigation:** WS-1 is a blocker; don't start WS-3/4/5/6 until signed.
- **R2** Anthropic credits stay depleted → no real AI in prod → demos look fake. **Mitigation:** Max restores credits day-1; post-launch we set a spend alarm.
- **R3** Bob unavailable → cognifygym.com stays on V1. **Mitigation:** standing offer to deploy under Max's Vercel project and swap domain later (see `docs/DOMAIN_CUTOVER.md`).
- **R4** Pressure System feels gimmicky to users → retention hurts. **Mitigation:** user-test with 5 early users in WS-3 Phase 3.6; iterate prompts + visual treatment before wide release.
- **R5** Mockups continue evolving mid-implementation → rework. **Mitigation:** V2 Updates.docx is the single source; any new mockup gets appended to WS-5 with a date; no private side-channel mockups.
- **R6** Patent filing blocked by Sides assignment ambiguity. **Mitigation:** start Sides legal conversation in parallel with first WS-10 engineering task.
- **R7** Naming shift confuses existing users with scored reps under old rubric. **Mitigation:** `RUBRIC_VERSION` migration discipline + one-time in-app note explaining the change.
- **R8** Flow Session compressed-feedback UX is hard to get right (too fast = confusing; too slow = not flow). **Mitigation:** prototype early, test with Hunter before wide release.
- **R9** B2B repositioning lands before enterprise buyers are ready → messaging gets stale. **Mitigation:** test copy with one Corporate Health / HR buyer conversation before publishing.
- **R10** Mobile portrait layout breaks with new bar. **Mitigation:** build mobile variant first, desktop second (unusual but safer for this product).
- **R11** UI_V2 flag becomes a two-world problem (legacy components live too long). **Mitigation:** calendar-bounded — 2 weeks post-flip to delete `legacy/`.
- **R12** Weekly narrative cron produces generic / bad content at scale. **Mitigation:** prompt-tune against 20 real weeks of data before flipping prod flag.

---

## 9. Progress log (append-only)

Format: `YYYY-MM-DD · who · what changed`

- **2026-04-23 · CTO-agent (Claude)** · Strategic plan created. Synthesized `Cognify Strategic Update.md`, `Cognify Direction.md`, V2 Updates.docx (4 page mockups acquired from user). Flagged dimension-naming conflict as WS-1 blocker. Defined 10 workstreams + §5 BD track + §6 production-launch track. Memories saved: `project_cognify-v2-dimensions` + `project_cognify-v2-advisors` under primary memory dir.
- **2026-04-23 · CTO-agent (Claude)** · Expanded every WS with mini-plans (Out of scope / Design decisions / Phased execution with ETAs / Test strategy / Rollout plan). Added WS-5 system-wide extension beyond the 4 mockup pages. Added WS-7 PDF export. Added 2 new risks (R11, R12). Doc now ~1000 lines and meant to be read top-to-bottom once, then by WS as work begins.
- **2026-04-23 · CTO-agent (Claude)** · WS-1 Phase 1.1 deliverables shipped: `docs/DIMENSION_DECISION.md` (5 decisions D1–D5 staged for Max + Hunter + optional Hupe/Nahamoo sign-off) and `docs/proposals/rubric-v2.0.0.md` (the ready-to-apply refactor: full proposed `domain.ts`, `rubric.ts`, new `dimension-aliases.ts`, rep-type remap table, signal→dimension mapping, DB migration plan, 15-file knowledge base plan, apply-order checklist, 5 risks). Pre-audit counted 374 occurrences of old dimension names across 60 files. Flagged the `tone` token collision (Callout.tone vs dimension tone) as blocking a blind find-replace — proposal renames `Callout.tone` → `Callout.emphasis` to eliminate the ambiguity.
- **2026-04-23 · CTO-agent (Claude)** · WS-2 critical UX stabilization — 7 Product Sweep items shipped as individual commits on `supabase-migration`: (1) pause workout button surfaced as proper UI, (2) mobile challenge button visibility fixed, (3) shared `DemoBanner` with stronger visual treatment on /friends + /leaderboard, (4) anchor framing + onboarding summary on baseline page, (5) pre-create listener preview on validation flow, (6) /try transcript open by default, (7) preview phase before Build a Rep records. Notes: timer progress bar already existed in RecordButton.tsx (Sweep #3 stale); Settings completeness already present via AccountSection (Sweep #4/#9 stale); Anthropic credits + Supabase email-confirmation are billing/admin actions.
- **2026-04-23 · CTO-agent (Claude)** · Fixed Vercel deploy pipeline. Discovered `link: null` on `cognify-v2` Vercel project — git integration was never connected, so no pushes have auto-deployed. Manually deployed commit `341071eb` via `npx vercel deploy --prod --yes --scope maxvolkov202s-projects` (45s build, aliased to `cognify-v2-neon.vercel.app`). Updated `docs/DEPLOYMENT.md` §0 with the 1-command deploy flow; `TODO.md` to reflect the two-target reality (preview unblocked, production Bob-gated); `docs/HANDOFF_PROMPT.md` stack section (Supabase Auth/Postgres/Storage, not Auth.js/Neon/Blob) and added V2_STRATEGIC_PLAN.md as the top-priority read.

<!-- append future sessions below -->

---

## 10. Mockup references (all)

### Shipped into this plan 2026-04-23
- Daily Workout Home — `https://claude.ai/public/artifacts/586d0891-9180-4c45-84c5-e0526d92ab00`
- Exercise / Prompt Pick — `https://claude.ai/public/artifacts/eba6165f-1f0e-4efb-870e-2fd95c04d446`
- Start (pre-rep) — `https://claude.ai/public/artifacts/f9e32508-a3ed-4319-bc3a-01338037d3f0`
- Actual Rep (recording) — `https://claude.ai/public/artifacts/4a934123-f450-491b-b902-5a706f7ec75b`

### Future mockups (as V2 Updates.docx evolves)
<!-- append: page name · claude.ai URL · date added -->

---

## 11. Source documents

- `~/Downloads/Cognify Strategic Update.md` — strategic frame (IQ→EQ, IP, market, B2B)
- `~/Downloads/Cognify Direction.md` — product system (modes, sessions, pressure, feedback, habit)
- `~/Downloads/V2 Updates.docx` — rolling page-level mockups (4 pages as of 2026-04-23)
- `dev/cognify/README.md` — stack + structure
- `dev/cognify/ROADMAP.md` — historical record of Phases A–E / Waves 1–6
- `dev/cognify/TODO.md` — production-launch punch list (Bob-gated)
- `dev/cognify/docs/PRODUCT.md` — existing product vision
- `dev/cognify/docs/POSITIONING.md` — dual-track messaging
- `dev/cognify/docs/SCORING_METHODOLOGY.md` — scoring rubric + signals
- `dev/cognify/docs/PATENT_NOTES.md` — Boxology scaffold
- `dev/cognify/docs/PRODUCT_SWEEP_2026-04-16.md` — 10 UX findings
- `dev/cognify/docs/BACKLOG.md` — deferred features (several anticipated by strategy)
- `dev/cognify/docs/DIMENSION_DECISION.md` — the WS-1 decision artifact (created 2026-04-23)
