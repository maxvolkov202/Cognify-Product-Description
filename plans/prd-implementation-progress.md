# Cognify System Change (PRD v3) — Implementation Roadmap & Progress Tracker

> **Source of truth for the PRD rebuild.** Created 2026-07-02 from "Cognify System Change.docx".
> PRD text: `plans/prd/cognify-system-change-prd.md` · Margin comments: `plans/prd/cognify-system-change-comments.md`
> Resume protocol: read this file top-to-bottom, check the Decision Log, find the first phase
> whose status is not ✅, and continue from its first unchecked task. Update statuses as you go.

---

## 0. Decision Log

Decisions that shape everything downstream. D1–D4 confirmed by Max 2026-07-02 ("go with the best option; ranks Bronze→Grandmaster").

| # | Decision | Status | Choice |
|---|----------|--------|--------|
| D1 | Roadmap sequencing | ✅ MAX 2026-07-02 | **Engine-first, adapted.** Existing app = Phase 1 foundation done. Universal Training Engine inside Daily Workout first, then Skill Lab → Build a Rep → progression → intelligence. |
| D2 | Daily Workout loop fidelity | ✅ MAX 2026-07-02 | **Full PRD loop** — 3 exercises × (First Rep + required Retry + Improvement Review), graduation/pressure rep kept as optional finisher. |
| D3 | Prompt strategy | ✅ MAX 2026-07-02 | **Hybrid** — curated banks as backbone + runtime AI generation for refresh/personalization/Build-a-Rep, validated against framework rules, cached back into bank. |
| D4 | Rank vs Levels/Leagues | ✅ MAX 2026-07-02 | **Adopt PRD Rank ladder (Bronze I-IV → Grandmaster), absorb Level 1-100** (XP feeds rank; migration maps levels→ranks; weekly league tiers renamed/folded into leaderboards). |
| D5 | Legacy features kept | ✅ default | Keep mascot, pressure archetypes, daily quests, friend challenges (no PRD conflict). Sub-skill UI (`FF_SUBSKILL_UI`) retired — PRD hides sub-skills from users. |
| D6 | Naming | ✅ default | User-facing: PRD terms — "Pacing" (not Delivery), "Skill Lab", "Build a Rep", "Core Skills", "Communication Score". DB enums stay stable; bridge via `dimension-aliases.ts`. |
| D7 | Dev→prod workflow | ✅ per Max | Big-batch promotion: build a whole phase on a feature branch + dev server (localhost:3333) / Vercel preview, Max tests it there, only then promote to production. No drip-feeding small changes to prod. Everything flag-gated (`FF_*` pattern). |
| D8 | Terminology: "Hidden Skills" | ✅ from PRD | Subskills = Hidden Behaviors = Underlying Behaviors = **Hidden Skills** (PRD terminology clarification). Internal-only, power personalization. |
| D9 | Legacy dimension-drill Skill Lab | ✅ MAX 2026-07-06 | **Skill Lab = applications-only per PRD; dimension drills move to Daily Workout extras.** Drills relocated to `/drills` ("Focus Drills"); entry points = workout-completion "Extra reps" CTA + dashboard deep-links (`/skill-lab?focus=` redirects to `/drills` under `FF_SKILL_LAB_APPS`). Flag off → `/drills` bounces back to legacy `/skill-lab`; prod URLs unchanged. |
| D10 | Prompt slate size | ✅ MAX 2026-07-06 | **FIVE prompt options per slate** — a deliberate deviation from both PRD numbers (Engine specs say 4, §5.6/§6.5 say 6), chosen by Max after the provisional 4. C18 variety guardrail = 2 general slots of 5 (≤60% personalized). |
| D11 | Application Skills per app | ✅ MAX 2026-07-06 | **Restore the full 8 hidden Application Skills per application** (Lab Engine V1 lists), expanding each app's exercise catalog so the added skills actually get trained. Executed in Phase 11.D. |
| D12 | Insight ordering | ✅ from C19 | Owen C19 (topic first, then constraint/insight) **supersedes** §6.4/Lab-Engine's "Coach's Insight → Prompt Selection" ordering. Code order prompt→insight→rep is intentional; future audits shouldn't re-flag. |

**Owen/Hunter comment constraints to honor everywhere** (see comments file for full text):
- C3/C4: Timing is only ONE constraint type; also Structure (STAR), Tone, Complexity (ELI5). Consider count-up clock + overage penalty instead of hard-stop countdown. **Needs a design decision in Phase 1.**
- C5: Progressive overload — retries/next reps can raise stakes ("same pitch, now to your boss, in 90s").
- C6: Spaced repetition is good; only avoid identical prompts/insights within one session.
- C7: Build a Rep is heavier (input, feedback, memory, compute) — likely premium tier.
- C9: Add a "Quit session" exit that ends with a real-life tip for the day.
- C10: Be liberal on negative score movement — big negative deltas destroy trust.
- C16/C17: Completion screen must be celebratory + show all-time reps.
- C18: Prompt-to-profile "fitness" must balance relevance vs variety (don't overfit prompts to profile).
- C19: User picks topic, THEN system picks constraints (less setup involvement).

---

## 1. Current-State Gap Analysis (from 7-agent codebase survey, 2026-07-02)

### Already matches the PRD (reuse, don't rebuild)
- **Six Core Skills = current 6 dimensions 1:1** (`src/types/domain.ts`, `src/lib/scoring/rubric.ts` v3.3.0, weights sum 1.0). Naming: code `delivery` ↔ PRD "Pacing" (muscle-group layer already says `pacing`; bridged by `src/lib/scoring/dimension-aliases.ts`).
- **36 Hidden Skills** across the 6 dims already scored per rep (`src/types/sub-skills.ts`, `sub-skill-mapper.ts`, stored in `dimension_scores.signals`, EWA read via `queries/sub-skills.ts`). PRD's exact hidden-layer model.
- **Scoring quality stack**: deterministic signals (`src/lib/scoring/signals/*`), two-stage scoring (`score-stages.ts`), rubric anchors, temp 0.2, reference-rep bank + nightly `calibration-drift` cron + Slack alerts, per-user calibration profile, scoring telemetry.
- **Prompt picker UX**: 5 candidates + refresh (Shuffle) + Surprise Me + All-prompts list (`src/server/actions/prompt-selection.ts`), cross-session seen-tracking (`prompt-history`), 30-window anti-repeat, exercise 2-day dedupe.
- **Streaks**: committed weekly days bitmask + TZ-keyed + freezes cap 3 (`streak-freeze.ts`, `committed-days.ts`) — exactly PRD §10.7.
- **Achievements**: 24 defs + rules engine (`src/lib/engagement/achievements.ts`, `user_achievements`).
- **Recording pipeline** (≤5 min reps): MediaRecorder → `/api/transcribe` (Deepgram nova-3, word timings) → `/api/score` (Claude Haiku scoring / Sonnet generation via `src/lib/ai/claude.ts` shim with OpenAI fallback, prompt caching, metrics).
- **AI infra**: provider shim + fallback + telemetry reusable for all new generation tasks. RAG over knowledge_chunks (pgvector) for feedback grounding. Knowledge base: 15 framework docs, 7 skills, 7 domains, 7 progression ladders (`src/lib/ai/knowledge/`).
- **Onboarding**: vertical → personas → goals → committed days → baseline rep → tutorial.
- **Flags**: `FF_*` env pattern (`src/lib/flags.ts`); PWA (Serwist); crons in `vercel.json`; Upstash rate limiting; Supabase auth + storage.

### Gaps (the build)
1. **Universal Training Engine** — no required Retry, no Improvement Review (attempt-1 vs attempt-2), Coach's Insight scattered (SkillScenariosCard/RuleReminder/framework strip), no per-exercise adaptive insight. Session machine (`src/lib/workout/session-machine.ts`) has no retry/review phases. `RepSurface` already has unused `retryFocus`/`onRetry`/`previousRepSummary` props — partial substrate.
2. **Communication Profile & intelligence layer** — no persisted profile distinct from rep evidence (long-term = read-time EWA over raw reps); no Overall Communication Score; no Communication Snapshot pass; no cross-session coaching memory (only 1-rep-back, client-supplied); no assessment phase (cold-start hardcodes clarity); no plateau detection; no strong-skill maintenance cadence; **two parallel workout engines** (muscle-group `src/server/lib/workout/assignment.ts` vs rep-type `src/lib/ai/workout-prompts.ts`) to consolidate.
3. **Skill Lab redefined** — current `/skill-lab` drills *dimensions*; PRD wants *applications* (Storytelling, Presenting, Teaching, Interviewing, Persuasion) + hidden Application Skills + application scores. Taxonomy net-new. Session-of-N (1/3/5/∞) exists and is reusable.
4. **Build a Rep redefined** — current = one-off scenario rep + talking points. PRD = event prep: context uploads (**no doc upload/parsing exists**), Preparation Plan of Critical Moments (editable), Guided Practice vs Full Simulation, Readiness Review, per-event readiness memory. Full Simulation blocked today: `/api/score` caps durationMs ≤ 300000 & transcript ≤ 10k chars; upload 25MB; routes maxDuration 60s → needs async pipeline (scaffold exists: `/api/score-internal` + Supabase Edge Function, `NEXT_PUBLIC_USE_ASYNC_SCORING`).
5. **Exercise Frameworks** — exercises today = `rule + why + prompt bank` (54 exercises, ~6.2k prompts). Missing fields: communication objective, Hidden Skill tags, coaching philosophy, scoring lens (exists only as code-side `EXERCISE_RUBRIC_HINTS`), retry objective, prompt-generation rules. No runtime prompt generation (`resolveKnowledge({stage:"prompt_gen"})` is dead code). Rep budgets 20–45s vs PRD 60–120s.
6. **Progression conflicts** — no permanent Rank ladder (PRD: Bronze I-IV → Grandmaster); Level 1-100 + weekly league (Bronze→Diamond, `FF_LEAGUES`) collide in naming. No weekly challenges (only daily quests), no team challenges (only 1v1), leaderboard default is 30-day avg composite not weekly improvement, completion screens (WorkoutEnd / DayCompleteSummary) don't aggregate XP/rank/achievements/all-time reps.
7. **User Profile fields** — missing Communication Stage (student→executive); vertical/personas/goals exist.

---

## 2. Roadmap (provisional pending D1–D4)

Phase = one dev→test→promote cycle (per D7). Each phase lands on a feature branch, flag-gated,
tested by Max on dev/preview, then promoted. Statuses: ⬜ not started · 🟨 in progress · ✅ done · 🚫 blocked.

> Branch note: repo is on `feat/muscle-group-pivot` (26 commits ahead of origin, awaiting Max's
> push approval + smoke matrix). PRD work starts on a NEW branch cut from this one once its fate
> is settled — confirm with Max whether pivot merges first.

### Phase 0 — Alignment & scaffolding ✅ (2026-07-02, one open item)
*Goal: decisions locked, terminology mapped, flags in place. No user-visible change.*
- [x] 0.1 Max answered D1–D4 ("go with best options; ranks Bronze→Grandmaster"); Decision Log updated.
- [x] 0.2 Terminology map: `plans/prd/terminology-map.md`.
- [x] 0.3 Flags added to `src/lib/flags.ts`: `FF_TRAINING_ENGINE_V2`, `FF_SKILL_LAB_APPS`, `FF_BUILD_A_REP_V2`, `FF_RANK_SYSTEM`, `FF_PROMPT_GEN` (VERCEL_ENV-aware: on in dev/preview, off in prod).
- [ ] 0.4 OPEN — muscle-group-pivot branch is still 26 commits unpushed; PRD work branched off it as `feat/prd-v3`. Max must still approve pushing/merging the pivot; `feat/prd-v3` carries it along.
- [x] 0.5 ADR-001 written + accepted: `plans/prd/adr-001-constraints.md` (count-up timer w/ target window + soft overage; constraint taxonomy time/structure/tone/complexity; overload lives in "Retry Again").

### Phase 1 — Universal Training Engine (PRD §4) 🟨 built 2026-07-02 — awaiting Max's eyes-on dev test
*Goal: ONE reusable learning loop — Insight → First Rep → Feedback → Retry → Improvement Review — that Daily Workout runs on, and that Skill Lab/Build a Rep will configure later. The most important phase.*

Workstream A — Session machine & flow
- [x] 1.A1 Machine extended (`session-machine.ts` + `types.ts`): new phases `insight`, `improvement-review`, `quit-summary`; new events INSIGHT_DONE/BEGIN_RETRY/RETRY_AGAIN/QUIT; `loop: "v1"|"v2"` on state (server resolves flag via `payload.loopVariant`, reducer stays pure); `attempt` + `firstOutcome` + `retryOutcomes` bookkeeping; retry REQUIRED in v2 (ADVANCE refused from score-reveal unless scoring failed); re-score-at-reveal handling so failed scorings never dead-end BEGIN_RETRY. 84 machine tests green.
- [x] 1.A2 `InsightScreen.tsx` — Coach's Insight after prompt pick (C19), rule + why + prompt restate + framework line + response-window chip.
- [x] 1.A3 Retry flow wired end-to-end: `RepControls.ActiveRep` builds retryFocus Callout + previousRepSummary + retryContext from the stashed first attempt; RepSurface gains `attemptKind`/`parentRepId`/`hideRunItAgain`; feedback CTA becomes "Start your Retry →" on v2 first attempts. (Stronger-Version/ExemplarModal already renders inside FeedbackPanel — carried over as-is.)
- [x] 1.A4 `ImprovementReview.tsx` — first→retry composite movement (C10-softened), implementation-verdict chip + note, focus-dim delta, next development opportunity, Next / Run-it-again / End-session actions.
- [x] 1.A5 `QuitSummary.tsx` — quit exit with per-dimension real-life tip (C9); static tip bank Phase 1, personalized in Phase 3.
- [~] 1.A6 PARTIAL — response-window chip shipped on InsightScreen; RecordButton count-up-with-target-band + full constraint taxonomy display moved to Phase 2 (with the Exercise Framework fields that drive them). ADR-001 governs.

Workstream B — Scoring/coaching additions
- [x] 1.B1 `src/lib/ai/coach-focus.ts`: `CoachFocus` contract + `deriveCoachFocus()` (from primaryFocusDimension + nextRepFocus). Persisted on `reps.coach_focus`.
- [x] 1.B2 Retry evaluation: `modeContext.retryContext` through all 3 score routes; shared `renderRetryEvaluationBlock()` in both single-call and two-stage paths (two-stage otherwise renders no MODE block — non-retry prompts stay byte-identical, protecting calibration); optional `implementationReview {verdict, note}` in both response schemas → `RepScore.implementationReview`; deterministic fallback `deriveImplementationVerdict()` (thresholds generous per C10).
- [x] 1.B3 `softenScoreDelta()` display rule (≥1 celebrate · ≥-3 neutral numeric · <-3 soft copy, no number) — used by ImprovementReview.
- [ ] 1.B4 DEFERRED → Phase 2: progressive-overload variant for "Retry Again" (needs Exercise Framework overload rules; ADR-001 Decision 3).

Workstream C — Data model
- [x] 1.C1 Migration `0028_engine_attempt_lineage.sql` applied to dev DB: `reps.attempt_kind` (default 'first'), `reps.parent_rep_id` self-FK, `reps.coach_focus` jsonb, index. **Prod migration pending promotion** (apply-prod-migration.mjs).
- [x] 1.C2 `coaching_events` table + saveRep writes one row per Coach's Focus; retry attempts back-fill parent's `implemented_verdict` (model verdict → deterministic fallback). Best-effort, never blocks the rep.
- [x] 1.C3 New phases persist through `updateWorkoutSessionState` (validates against extended SessionPhaseSchema; DB column is text).

Verification status (2026-07-02): typecheck ✅ · lint ✅ · all 11 unit suites ✅ (84 machine, 15 coach-focus new) · /workout serves 200 on dev with v2 loop live (flag defaults ON in dev).
STILL OPEN before Phase 1 is ✅:
- [ ] Max eyes-on: full loop on http://localhost:3333/workout (insight → first rep → feedback → "Start your Retry" → improvement review → next station; quit path; graduation still works).
- [ ] Playwright spec for the loop (only mobile-audit.spec.ts exists today).
- [ ] Calibration replay (`calibration-drift` against reference bank) before prod promotion — non-retry prompts are byte-identical so drift risk is nil, but the gate is cheap.
- [ ] NOTE: 4 stations retained in Phase 1; the 3-exercise restructure is Phase 2.1, so a v2 day is currently 4×2=8 recordings on dev — expected, temporary.
PRD refs: §4.3–4.10, §11.4. Comments: C3–C6, C8–C10, C19.

### Phase 2 — Daily Workout on the engine (PRD §5) 🟨 built 2026-07-02 — awaiting Max's eyes-on dev test
*Goal: Daily Workout = 3 exercises, one Core Skill/day, engine loop per exercise, celebratory completion.*
- [x] 2.1 3-exercise day under the flag: `stationsPerDay()` (3 v2 / 4 legacy) at all four sample sites; day-complete target now derives from `plannedExerciseIds` length everywhere (`dayTargetReps()` in day-status, page.tsx, bump-on-save); `tagWorkoutRep` skips the `completed_reps` increment for retry/again attempts (day target counts EXERCISES); `totalStations` threaded through RepControls/RepSurface; v2 time estimate ~110s/exercise.
- [x] 2.2 Exercise Framework enrichment SHIPPED: migration 0029 (7 columns: objective, hidden_skills, scoring_lens, retry_objective, prompt_rules, response_window, constraint_types — applied to dev); seed script validates hidden-skill membership per dimension + window bounds + constraint enum; **all 54 exercises authored** (6 parallel agents, per-dim dry-runs clean, existing fields byte-identical) and seeded to dev (54 updated). Scoring lens now read from DB (`getExerciseScoringContext` — `scoring_lens` wins, code-side EXERCISE_RUBRIC_HINTS fallback). Station payload carries objective + responseWindow → InsightScreen shows the real per-exercise window.
- [x] 2.3 Hidden-Skill-aware selection: `sampleExercises` gains `subSkillAverages`; greedy pick weights toward weak Hidden Skills (unmeasured=45 explores before strong), +15 penalty per already-covered skill enforces diversity, seeded-shuffle tiebreak keeps determinism; caller fetches per-dim averages (EWA from `queries/sub-skills.ts`) only when v2 on — legacy path byte-identical.
- [x] 2.4 Assessment Phase: `assessmentEnabled` input; new users get balanced least-covered-first rotation across all 6 Core Skills for ASSESSMENT_CYCLES=2 cycles (12 attempted days) before ANY adaptive decision (regression/floor/weakness all wait); weekly weakness-day override also suspended during assessment; "Baseline day N of 12" rationale.
- [x] 2.5 Weighted rotation: per-dim re-entry floors by weakness rank — weakest 2 dims return in 4 days, middle 6, strongest 7 (strong-skill maintenance: still weekly, never dropped). Flag-gated; legacy uniform 6-day floor unchanged.
- [x] 2.6 In-session no-repeat: `fetchPromptCandidates` gains `sessionSeenPromptIds` hard exclusion (starvation-relaxed, capped 500); PromptPicker accumulates shown ids across refreshes in-session. C19 (constraint after topic) landed in Phase 1's InsightScreen. Picker stays at 5 options (PRD's 4–6 band).
- [x] 2.7 Celebratory completion: 🎉 header, stats row (reps today + all-time reps + streak — C16/C17), Most Improved Core Skill chip (first→last rep per-dim delta), Coach's-call recommendation (weakest avg dim → next move); `fetchDaySummary` extended with lifetimeReps + streakDays.
- [ ] 2.8 DEFERRED → post-promotion cleanup (see 4.8): legacy rep-type Daily Workout path retirement (pressure machinery still feeds graduation rep + Focus Drills; flag-off fallback must keep serving prod until v2 promotes).

Verification (2026-07-02): typecheck ✅ · lint ✅ · all 11 suites ✅ (41 assignment incl. assessment + hidden-skill tests, 43 day-status incl. target-3, 84 machine) · /workout 200 on dev · migrations 0028+0029 applied to dev DB, **both pending on prod at promotion**.
STILL OPEN: Max eyes-on dev test (whole v2 day: 3 exercises × loop + celebration); XP/achievement toast unification into the summary screen (kept as toasts for now); calibration replay before promotion.
PRD refs: §5 entire, §8.4.3–8.4.4, §8.5.2–8.5.3. Comments: C16–C19.

### Phase 3 — Communication Profile & Snapshot (PRD §8.2–8.3) 🟨 built 2026-07-02 — awaiting Max's eyes-on dev test
*Goal: one persisted, slowly-evolving understanding of the user; every engine reads from it.*
- [x] 3.1 Migration 0030 `communication_profile` (one row/user: core_skills + hidden_skills EMA state, overall_score, total_reps — applied to dev). Update rule: count-scaled EMA `k = 1/min(n+1, 12)` (`src/lib/profile/communication-profile.ts`, pure + 16 tests) — first rep adopts evidence, mature profile moves ≤~8pts/rep. saveRep folds every non-mock authenticated rep (core dims + sub-skill signals); best-effort, never loses the rep.
- [x] 3.2 Overall Communication Score computed + persisted (DIMENSION_WEIGHTS roll-up, null until ≥3 skills measured). **Display deferred to Phase 6** (data accumulates from now).
- [x] 3.3 `buildCommunicationSnapshot()` (`src/lib/profile/snapshot.ts`): profile + weakest/strongest core skill + last-10 coaching events + recurring-weakness detection. Regenerated per call, never stored (PRD §8.3.11).
- [x] 3.4 Coaching memory: `renderCoachingMemoryBlock()` → new `ScoreRepInput.coachingMemory`, injected uncached in BOTH scoring paths + all 3 routes (v2 flag only; null for reference reps → calibration prompts byte-identical). Rules: acknowledge implemented focuses, change angle on recurring misses. FOUND ISSUE (pre-existing): the two-stage path silently drops `userCalibration` — routes pass it, score-stages never renders it. Left as-is (fixing would shift two-stage scoring); flag for Max.
- [x] 3.5 Plateau detection (`src/lib/profile/plateau.ts`: ≥8 samples/21d, |slope|<0.15/day, mean<85 + 5 tests) → `plateauedDims` into the selector: plateaued weakest dim swaps to nearest non-plateaued dim within 6pts (variety intervention, PRD §8.4.4).
- [x] 3.6 Communication Stage: `users.communication_stage` (migration 0030), constants + type guard, `setCommunicationStageAction`, Settings picker section (immediate-save). Onboarding step deferred — Settings covers capture; add to the onboarding flow when Max reviews the funnel.
- [ ] 3.7 DEFERRED → post-promotion cleanup (see 4.8, with 2.8): engine consolidation — muscle-group + rep-type generators behind one Snapshot-driven engine.
- [x] 3.8 Backfill `scripts/backfill-communication-profile.ts` (chronological replay through the same fold; idempotent) — run on dev (5 users, 174 dim rows). **Run on prod at promotion.**

Verification (2026-07-02): typecheck ✅ · lint ✅ · all 12 suites ✅ (21 new profile/plateau) · /workout + /settings 200 on dev.
PRD refs: §8.2, §8.3 entire, §8.4.1–8.4.2, §8.6, §10.3.

### Phase 4 — Skill Lab: applications (PRD §6) 🟨 built 2026-07-03/06 — awaiting Max's eyes-on dev test
*Goal: user picks an Application; Cognify picks everything else; same engine loop.*
- [x] 4.1 Application taxonomy: 5 applications × 6 hidden Application Skills (`src/types/application-skills.ts`; PRD §6.5 + Lab Engine V1). Implemented as columns on `exercises` (migration 0031: `application`, `application_skills`, profile `applications` jsonb — applied to dev) rather than new tables: application exercises reuse the ENTIRE exercise pipeline (prompts, picker, scoring lens, XML) with `dimension` = primary Core Skill.
- [x] 4.2 Application exercise frameworks: 30 exercises (6/app × 12+ prompts, full framework fields) authored in `scripts/exercise-catalog/v1/applications/*.json`, seeded to dev (idempotency re-verified 2026-07-06: 84 exercises / 1213 prompts unchanged on re-apply).
- [x] 4.3 Session flow: `/skill-lab/[slug]` (slug = ApplicationId) → length pick 3/5/10 (default 3) → per exercise: PromptPicker → Coach's Insight → First Rep → required Retry → Improvement Review → Session Complete; quit banks the session (`AppSessionClient.tsx`, `startSkillLabSessionV2`). Gated on `FF_SKILL_LAB_APPS` (was wrongly on TRAINING_ENGINE_V2 — fixed).
- [x] 4.4 Application scores (PRD §8.3.6): per-application EMA over rep composites in `communication_profile.applications`, folded in saveRep (application + skills derived server-side from the exercise row, not trusted from client); Session Complete per §6.8 structure: Application Score → session improvement → Most Improved Application Skill → Core Skill breakdown → Coach Recommendation (weak app skill → weak core skill → related app) → reps earned + all-time. Backfill extended + re-run on dev.
- [x] 4.5 Lab Personalization Engine (PRD §8.4.5): per-Application-Skill EMA estimates nested in the profile; pure selector `src/server/lib/skill-lab/selection.ts` (weakest-skill-first, unmeasured=45 explore, +15 diversity penalty, +20 recent-use penalty, count>catalog cycles, seeded determinism — mirrors Daily Workout conventions; 14 tests).
- [x] 4.6 D9 (Max 2026-07-06): drills → Daily Workout extras. `/drills` hosts the legacy `SkillLabClient`; `/skill-lab?focus=` + `/skill-lab/<dimension>` redirect there under the flag; DayCompleteSummary gains "Extra reps: drill <weakest dim>" CTA; exemplars moved to shared `[slug]` segment (URLs unchanged).
- [x] 4.7 Nav/dashboard: applications hub at `/skill-lab` (5 cards + app-score chips, flag-branched), dashboard mode-card tagline flag-branched, DashboardHero focus deep-link carries `?focus=`, `/drills` added to theme-script app prefixes.
- [ ] 4.8 DEFERRED (was 2.8/3.7): legacy engine retirement + muscle-group/rep-type consolidation — **cannot happen before prod promotion** (flag-off fallback must keep serving prod). Post-promotion cleanup phase.

Verification (2026-07-06): typecheck ✅ · lint ✅ · 13 unit suites ✅ (14 new selection + 8 new profile app-skill tests) · e2e `skill-lab-v2.spec.ts` 6/6 on dev (hub, session route, focus redirects, exemplars, 404) · routes 200 on dev · migration 0031 + 30 exercises seeded to dev, **pending on prod at promotion** (0031 + seed + backfill).
KNOWN: mobile tap-target audit fails on PRE-EXISTING shell chrome (banner sign-in, skills-bar chips, feedback fab — fails on /workout too, not a Phase 4 regression) → Phase 9.2. Full authed engine-loop Playwright spec still the Phase 1 open item (needs a storage-state auth fixture).
STILL OPEN: Max eyes-on dev test (hub → Storytelling ×3 loop → Session Complete; drills CTA from workout completion); calibration replay before promotion (retry/coaching-memory blocks unchanged since Phase 3, non-retry prompts still byte-identical).
🚫 BLOCKER (2026-07-06, env not code): BOTH AI provider keys dead on dev — Anthropic "credit balance too low", OpenAI 429 quota. Live scoring falls back to mock (`mock-fallback-v1`), so the eyes-on test can exercise the flow but not real coaching, and the smoke harness (`scripts/smoke-engine-v2.ts`) + calibration replay can't run until credits are topped up.
PRD refs: §6 entire, Lab Engine V1, §8.4.5, §8.5.4.

### Phase 5 — Build a Rep: event preparation (PRD §7) 🟨 built 2026-07-06 — awaiting Max's eyes-on dev test
*Goal: describe an event → prep plan of Critical Moments → Guided Practice or Full Simulation → Readiness Review.*
- [x] 5.1 Data model: migrations 0032 (`prep_events`, `critical_moments`, `prep_context_uploads`, `readiness_reviews`) + 0033 (mode enum value `build_a_rep`) — both applied to dev; Drizzle schema + MODE_IDS updated; `isBuildARep` quest check covers both mode values.
- [x] 5.2 Event intake: conversational description + example chips (`PrepHome.tsx`); event-type inference (8 types, regex fallback + model); plan generated at create time so users practice immediately (PRD §7.3).
- [x] 5.3 Context uploads: `/api/prep-context` (POST multipart/DELETE, 4MB cap, owner-scoped, rate-limited), Supabase Storage bucket `prep-context` (lazy create), parsing via `unpdf` (pdf) + `mammoth` (docx) + native txt/md (`src/lib/prep/parse.ts`, 50k-char cap), parsed text cached on the event for generation. Always optional; parse failure never blocks (§7.4).
- [x] 5.4 Preparation Plan generation (`src/lib/ai/prep/plan-generation.ts`): Sonnet + zod validation + deterministic per-event-type fallback plans (PRD §7.7 examples verbatim — interview/presentation/pitch/toast/demo/meeting/speech/other); fully editable plan UI (add/remove/rename/retime/reorder, C11 definition line); "Regenerate with context" preserves user-authored moments.
- [x] 5.5 Guided Practice: per-moment engine loop (Moment Insight → rep → feedback → optional retry → Improvement Review with prep labels), free ordering from the plan, unlimited retries (§4.9), per-moment best/attempts tracked (`recordMomentPractice`).
- [x] 5.6 Full Simulation: setup (editable recommended time, framework preview) → uninterrupted long rep with framework sidebar → feedback only at the end via Readiness Review. **Infra: sync path suffices** — score routes raised to transcript ≤48k chars / duration ≤25 min / maxDuration 120s, transcribe maxDuration 300s; 20-min opus stays under the 25MB upload cap. Async Edge-Function scaffold left dormant as fallback (documented).
- [x] 5.7 Readiness Review (`src/lib/ai/prep/readiness-review.ts` + screen): deterministic weighted overall score (model never invents the number), single highest-impact Coach Feedback, expandable per-dim why/well/improve, readiness summary; persisted per event (`readiness_reviews` + `prep_events.readiness_score`, PRD §8.3.8).
- [x] 5.8 Premium hook (C7): `src/lib/entitlements.ts` choke point on every entry (actions + upload route); `FF_BUILD_A_REP_PREMIUM` kill switch until billing exists.
- [x] 5.9 `/build-a-rep` flag-branched: v2 = event prep (PrepHome + `/build-a-rep/[eventId]` plan surface); legacy scenario flow byte-identical when off. Talking-points generation untouched (still powers legacy; prep uses its own plan generator).

Verification (2026-07-06): typecheck ✅ · lint ✅ · 14 unit suites ✅ (34 new prep tests) · e2e build-a-rep-v2.spec 3/3 + skill-lab 6/6 · /build-a-rep 200 on dev with v2 intake · migrations 0032+0033 applied to dev, **pending on prod at promotion**. NOTE: plan/review generation degrades to the deterministic fallbacks while the AI keys are dead — the full flow is walkable on dev regardless.
STILL OPEN: Max eyes-on (create event → edit plan → guided moment loop → simulation → Readiness Review; upload a resume PDF once credits return to see personalized plans); long-sim (≥8 min) live scoring validation once credits return.
PRD refs: §7 entire (MVP scope §7.10 — conversational simulation OUT per §7.11), §8.4.6, §8.5.5.

### Phase 6 — Progression & motivation overhaul (PRD §10) 🟨 built 2026-07-06 — awaiting Max's eyes-on dev test
*Goal: rank, challenges, leaderboards, unified celebration — after the training experience is solid (PRD ordering).*
- [x] 6.1 Rank ladder per D4: `src/lib/progression/rank.ts` — 32 ranks (8 tiers × 4 divisions, I→IV ascending) derived PURELY from lifetime XP (no rank column, permanent-forward by construction, ZERO data migration: division floors anchor to the existing level curve via `xpForLevel`, so level 16 IS Silver I exactly). §10.5.3 XP factors added to `awardXp`: implementation ×1.5/×1.25 (nailed/partial) + score-improvement +1%/pt capped ×1.3, wired in saveRep from `implementationReview` + parent composite. `RankBadge` SVG (tier color + roman numeral, swappable for illustrated assets). §10.5.2 honored: rank surfaces never show raw XP.
- [x] 6.2 League fold per D4: `FF_LEAGUES` cohort board retires when `FF_RANK_SYSTEM` is on (its Bronze→Diamond names collide with the permanent ladder; `settleWeek` was never implemented anyway — survey confirmed weekly promotion never actually ran). Dashboard renders WeeklyChallengesCard instead; league machinery untouched for flag-off.
- [x] 6.3 Leaderboards: `getLeaderboard` gains `metric` (composite | improvement | communication_score); under the flag the page defaults to **Weekly improvement** with a **Top communicators** (Overall Communication Score) board added; legacy tabs preserved when off.
- [x] 6.4 Weekly Challenges (§10.10): counter-based week-keyed engine (`weekly-challenges.ts` bank of 7 behavior-focused challenges + migration 0034 table), 3/week seeded-stable per user, folded per rep in saveRep (mode counts, implemented retries, 75+/85+ reps, distinct training days), bonus XP additive like quests; dashboard card + ProgressionStrip mini-bars.
- [x] 6.5 Team Challenges (§10.11): `team_weekly_challenges` (one shared rep goal/team/week, target scaled by member count), incremented on any member's rep, shown on the dashboard card.
- [x] 6.6 Unified completion celebration (§10.8): survey found the pipe was DEAD — saveRep returned xp/achievements/quests that no client consumed and LevelUpCelebration was mounted nowhere. Built the consumer: `ProgressionStrip` (self-fetching via `getProgressionSummary`, null when flag off) mounted on ALL THREE completion surfaces (DayCompleteSummary, Skill Lab SessionComplete, Readiness Review): rank badge + progress bar + streak + today's achievements + weekly-challenge progress. `SaveRepResult.completedWeeklyChallenges` added.
- [x] 6.7 Rank badge component shipped (code-drawn SVG; illustrated assets are a design handoff later); dashboard `LevelStreakCard` gains rank mode (badge + label + progress, no XP numbers) under the flag.
- [x] 6.8 Committed-day reminder emails: hourly cron `/api/cron/committed-day-reminder` (user-local 17:00, committed day, not trained, ≤1/day dedupe via `users.last_reminder_sent_at`, CRON_SECRET auth, dryRun param), Resend template (streak-aware subject), Settings → Notifications live toggle (`users.reminder_emails_enabled`, migration 0034). Push notifications stay "coming soon".
- BUG FIX (pre-existing, found in passing): daily-quest `repsToday` counted LIFETIME reps (no date filter) — volume quests completed instantly. Now counts UTC-today only.

Verification (2026-07-06): typecheck ✅ · lint ✅ · 15 unit suites ✅ (42 new progression tests) · /dashboard /leaderboard /settings 200 on dev · leaderboard renders Weekly-improvement default · reminder cron dry-run OK · migration 0034 applied to dev, **pending on prod at promotion**.
STILL OPEN: Max eyes-on (rank card on dashboard, completion strips across all 3 modes, challenge card, leaderboard tabs, settings toggle); badge visual-design handoff (SVG placeholder shippable); RESEND_API_KEY needed on prod for 6.8.
PRD refs: §10 entire.

### Phase 7 — Intelligence deepening (PRD §8 remainder) 🟨 built 2026-07-06 — awaiting Max's eyes-on dev test
*Goal: the "gets smarter every rep" layer, once data from Phases 1–6 accumulates.*
- [x] 7.1 Coaching effectiveness: per-dim implementation rates over a 40-event ledger window (`CoachingEffectiveness` in the Snapshot; only RETRIED focuses count toward the rate); the coaching-memory prompt block gains an EFFECTIVENESS line instructing a TECHNIQUE SWITCH for resistant dims (rate ≤ 1/3, coached ≥3) — smaller step / concrete transcript example / related hidden skill. ⚠️ scoring-prompt change (v2 users only) → calibration replay before promotion.
- [x] 7.2 Confidence management (§8.4.4): `confidence_builder` rationale in the selector — two consecutive attempted days closing <55 → serve the STRONGEST dim (needs a ≥60 strength to lean on; checked BEFORE sharp-regression so a slump never becomes "now drill your worst skill"). Flag-gated, 5 tests.
- [x] 7.3 Multi-session planning v1: `planUpcomingDims()` simulates the next 2 selections (pure replay of the selector against hypothetical closed days); suggestion rationale gains "Next up: X, then Y" — the visible plan Trust-the-Coach needs. Full sequence-optimization stays future work (documented).
- [x] 7.4 Communication Score display (deferred from 3.2): Overall Communication Score as a dashboard-hero vital sign under `FF_RANK_SYSTEM`, with static Communication-Stage benchmark bands (`stage-benchmarks.ts` — editorial v1; swap for real percentiles once population data exists).
- [x] 7.5 C18 fitness-vs-variety guardrail: when the whole 5-slate comes from a personalized bank tier, the last 2 slots swap to general-bank prompts (session-seen + duplicate-safe, best-effort).
- [x] 7.6 Memory consolidation: the Communication Snapshot is now the ONE unified read — profile (core+hidden+application skills) + coaching history + effectiveness + active-event readiness (`eventReadiness` from prep_events, PRD §8.3.8). Every engine keeps starting here.

Verification (2026-07-06): typecheck ✅ · lint ✅ · 16 unit suites ✅ (17 new intelligence tests) · /dashboard /workout 200 on dev.
STILL OPEN: Max eyes-on; calibration replay REQUIRED before promotion (7.1 adds a line to v2 scoring prompts); real percentile benchmarks once data accumulates; full multi-session sequence optimization → future.
PRD refs: §8.4.4, §8.4.7, §8.6, §8.7, §10.3.

### Phase 8 — Content expansion & prompt generation (PRD §9) 🟨 built 2026-07-06 — generation runs blocked on AI credits
- [x] 8.1 Runtime prompt-generation engine per D3 hybrid: `src/lib/ai/prompt-gen.ts` (shared core of the three Engine V1 specs — same objective, topic varies; framework `prompt_rules` + response-window + hidden-skill context injected; user vertical/stage biasing; QA filter: length/meta/newline/near-dup Jaccard vs bank) + `prompt-gen-cache.ts` (validated prompts inserted into `exercise_prompts` tagged `generated` — every generation permanently thickens the curated backbone). Wired at the exact starvation point: `fetchPromptCandidates` session-exclusion relax → under `FF_PROMPT_GEN`, generate-and-cache tops the slate up instead of re-showing rejected prompts. Dead `prompt_gen` knowledge stage now live as grounding. All failure paths degrade to the curated bank.
- [x] 8.2 Offline bank-expansion pipeline (`scripts/expand-prompt-bank.ts` — batch-runs the SAME generate+QA+cache pipeline across the catalog, --dim/--app/--per-exercise filters). ⚠️ EXECUTION blocked on AI credits; run after re-up (start: `--per-exercise 10 --apply`, ~84 Sonnet calls).
- [x] 8.3 Content flywheel pruning: `scripts/prune-prompts.mjs` — shown ≥20 with pick-rate <5% deactivated worst-first, hard floor of 12 active per exercise, reversible, dry-run default. Dev dry-run clean (no engagement data yet — becomes meaningful post-launch).
- [ ] 8.4 DEFERRED (deliberate): additional exercise frameworks per Core Skill + application. The authoring templates + 6-agent pipeline exist (Phase 2/4 used them), but multiplying un-reviewed content before Max's eyes-on of the existing 84 exercises compounds review debt, and 8.1's generation refresh removes the urgency. Author after content review.

Verification (2026-07-06): typecheck ✅ · lint ✅ · 17 unit suites ✅ (5 new QA-filter tests) · prune dry-run clean on dev.
PRD refs: §9 entire, three Engine V1 specs, D3, C15, C18 (guardrail landed in 7.5).

### Phase 9 — Polish & optimization (PRD Phase 9) 🟨 built 2026-07-06
- [x] 9.2 Accessibility — tap-target sweep: fixed every product violation the mobile audit enumerated (banner logo link, Sign-in, Open-menu, feedback fab, SessionTypePicker + prompt-mode radios, SkillScenariosCard accordion, skills-bar chips via transparent-44px-anchor + unchanged pill visuals, collapsed dots, progress "All" chip + workout CTA); Next dev-tools launcher excluded from the audit (toolchain, not product).
- [x] 9.6 Terminology (D6): user-facing dimension "Delivery" → **"Pacing"** everywhere (DIMENSION_LABELS single source + achievements copy + exemplars 404 + marketing mocks/pages; the GROUP "Content vs Delivery" keeps its name — it's a category, not the dimension). Welcome email fixed: claimed dimensions "(clarity, structure, relevance)/(confidence, pacing, tone)" — neither trio was real; now the actual six Core Skills.
- [x] 9.3/9.5 pass: all new surfaces null-safe/empty-safe (hub, PrepHome, WeeklyChallengesCard, ProgressionStrip render nothing on missing data); error paths best-effort + logged throughout Phases 4-8; repsToday lifetime-count bug fixed in Phase 6.
- [ ] 9.1 PARTIAL: completion screens celebratory (🎉 + strips); a dedicated rank-up/achievement ANIMATION moment needs design assets — deferred to the badge-design handoff (6.7).
- [ ] 9.4 DEFERRED: no perf hotspots observed in dev; profile after prod traffic exists.
- KNOWN (pre-existing, unchanged): two-stage scoring path silently drops `userCalibration` (flagged Phase 3) — fix alongside a calibration-replay window.

Verification (2026-07-06): typecheck ✅ · lint ✅ · 18 unit suites ✅ · **ALL 13 e2e green incl. the previously-failing tap-target audit (4/4 routes)** · 9 routes 200 on dev.

---

### Phase 10 — Spec-fidelity hardening (6-auditor PRD re-read, 2026-07-06) 🟨 built — awaiting Max's eyes-on
*Max asked for a full PRD re-read + gap audit. Six parallel auditors produced 31 deviations (3 MUST-FIX); all code-side items closed same session.*

**Engine (§4 + ADR-001) — the 3 MUST-FIXes:**
- [x] 10.1 ADR-001 timer implemented at last: `RecordButton` count-up mode with target band (band bar, "Past your window — bring it home" cue, no hard stop at the window); `responseWindow` threaded RepControls/AppSession/PrepEvent → RepSurface → RecordButton; infra ceiling ≥ max(2×window, 3min); graduation pressure rep + legacy callers keep the countdown. **Overage now scores**: `timeBudgetMs` = window max (not the ceiling) so the existing deterministic time signal reads the window.
- [x] 10.2 v2 FeedbackPanel (`engineV2`): §4.5 exact order **Score → ONE Coach's Focus → Core Skill Breakdown**; the prohibited "What you did well"/"What didn't land" split and the multi-bullet Next-Rep-Focus list removed from v2 (v1 untouched); new `CoachFocusCard` (deriveCoachFocus + Stronger-Version exemplar link).
- [x] 10.3 ImprovementReview gains the Core Skill Breakdown (§4.7.1 "same breakdown in both feedback screens") + per-skill first→retry delta chips (C10-softened); retry overlay gains "Stronger version" + "what one change" framing (§4.6); InsightScreen shows the ADR-001 constraint-type chip.

**Selection & difficulty:**
- [x] 10.4 D10: slate = 4 everywhere; C18 variety guardrail = 1 general slot.
- [x] 10.5 Difficulty adaptation live: `challengeBias` easier/<60 · neutral · harder/≥80 (stretch-first for strong users, v2-gated) — the dead `preferEasier` no-op is gone.
- [x] 10.6 Lab: strong-skill maintenance slot (last slot of 3+ sessions targets the strongest measured skill when uncovered — §6.6 "not weakness-only"); prompt-selection telemetry fixed (sessionId now logged); Lab selection reads the **Communication Snapshot** (§8.3.11 "every system begins here") instead of a direct profile query.

**Profile & intelligence:**
- [x] 10.7 §8.3.10 Improvement Trends implemented: per-dim 21-day least-squares slope (improving/flat/declining/insufficient) + mostImproved/mostConsistent + strongestApplication in the Snapshot.
- [x] 10.8 §8.2 Communication Stage captured in ONBOARDING (new 5-step flow: vertical → personas → goals → **stage** → days; skippable; Settings editor unchanged).
- [x] 10.9 §8.4.6 Adaptive Preparation live: plan generation + regeneration consume a profile hint (weakest core skill + prior readiness + weakest practiced moments); Readiness Review receives the previous session's score/focus and speaks to trajectory.

**Completion surfaces (§10.8/§5.7):**
- [x] 10.10 ProgressionStrip now shows **Updated Communication Score + all six Core Skill estimates** (all three modes); DayCompleteSummary gains the §5.7 "This workout" first→last delta chips and moves Reps-Earned to the final slot; Lab Session Complete always renders the improvement row (neutral copy when flat).

**Build a Rep loop (§7.7):**
- [x] 10.11 "Continue to Next Critical Moment" branches at BOTH decision points (post-feedback skip-retry link + Improvement Review advance); recommended time **editable on the rep screen** (write-through); context uploads **auto-regenerate** the plan on successful parse (§7.5); "prepared remarks" inference keyword.

**Misc:**
- [x] 10.12 Nav "Practice" → "Skill Lab" (D6); achievements: added `vol_100_reps` ("100 Communication Reps Completed", §10.6) + renamed First Daily Workout / First Skill Lab Completed; per-mode weekly rep counts on dashboard tiles are now real (were fabricated: total on workout, 0 on others); stale "Practice (formerly Skill Lab)" copy fixed; `scripts/mvp-metrics.mjs` measures every A.6 criterion.

DEFERRED from the audit (content/design side, tracked): per-exercise `coach_insight` authoring + Lab Engine pack fields (secondary core skills, failure modes, 3-part scoring emphasis — batch with 8.4 content expansion), §5.6 topic-category catalog diversity (batch with 8.2 generation run), inline framework editing on the sim surface (plan-screen editing covers it), .pptx parsing (PDF export works), Readiness/coaching-history profile silos (functional, documented).

Verification (2026-07-06): typecheck ✅ · lint ✅ · 18 unit suites ✅ (+3 selection tests) · ALL 13 e2e ✅ (incl. tap-target audit) · 7 routes 200 · mvp-metrics runs. ⚠️ Calibration replay still required (coaching-memory unchanged this phase, but timeBudgetMs semantics changed for v2 window reps).

---

### Phase 11 — Pre-testing readiness (confirmed by Max 2026-07-06: A+B+C+D + remaining doc items; OpenAI credits live, Anthropic still dead) 🟨 in progress
*Goal: everything needed so live-credit testing is meaningful — provider prep, machine-verified loop, populated demo data, complete coach content.*

**11.A Scoring pipeline prep** ✅ 2026-07-06
- [x] A1 `SCORING_PROVIDER=openai` set (.env.local; REVERT when Anthropic re-ups). Live calls confirmed provider=openai, fallback=false.
- [x] A2 `/api/talking-points` gate fixed (was Anthropic-only → silently served defaults on OpenAI).
- [x] A3 Two-stage `userCalibration` drop FIXED (now injected as an uncached system block in both stages, mirroring coaching memory; reference reps unaffected).
- [x] A4 Calibration re-baseline on OpenAI: 29-rep in-process replay (drift cron dryRun) — **avg |Δ| ≈ 7.8 vs the Haiku-tuned expectations, worst ≈ 22-27; GPT-4o compresses the top band** (exceptional reps score lower) and mildly inflates some low/mid reps. Baseline persisted: `plans/calibration-baseline-openai-2026-07-06.json`. Interpretation rule for Phase 12: judge coaching QUALITY, not absolute numbers; the Anthropic baseline re-applies at re-up. (The stale HTTP-based `calibrate-scoring.mjs` 401s since the May auth gates — the in-process cron replay is the working harness.)
- [x] A5 Smoke harness 11/11 green on OpenAI. FOUND+FIXED in the process: GPT-4o omitted `implementationReview` (hardened the retry-evaluation block to REQUIRED + exact JSON shape) and omits `note` sometimes (schema + RepScore type now optional; deterministic verdict copy covers absence).

**11.B Authed E2E loop harness** ✅ 2026-07-06 — ALL THREE LOOPS PASS LIVE
- [x] B1 Setup project provisions the test user via Supabase admin (idempotent, refuses prod) + logs in through the REAL signin UI → storageState (`tests/e2e/authed/auth.setup.ts`, `.auth/` gitignored).
- [x] B2 `tests/fixtures/spoken-rep.wav` — ~45s coherent spoken answer via OpenAI TTS (`scripts/generate-audio-fixture.ts`); Chromium loops it as the fake mic.
- [x] B3 `authed-chromium` Playwright project (opt-in `AUTHED=1` — costs credits), fake-media flags, 420s test budget; unauthed suites untouched.
- [x] B4 LIVE loops green: **Daily Workout** (start day → prompt → insight → rep → v2 feedback w/ ONE Coach's Focus + no legacy split asserted → required retry → Improvement Review verdict + breakdown → next exercise, 1.2m), **Skill Lab** (Storytelling ×3 → loop → quit banks → §6.8 Session Complete, 1.2m), **Build a Rep** (intake → generated plan → guided moment w/ editable time asserted → readiness review, 48s). Harness learnings: prompt cards got a `data-testid`, animated CTAs need force-clicks, threshold gate clicked through deliberately.

**11.C Demo-user seeding** ✅ 2026-07-06
- [x] C1 `scripts/seed-demo-user.ts`: deterministic (mulberry32 seed 20260706) 21-day history — 90 reps w/ dimension scores + hidden-skill signals, 14 workout days, 16 lab sessions (incl. storytelling application folds), 42 coaching events w/ mixed verdicts, 1 prep event + readiness review, 5 achievements, weekly challenge, xp=3400, profile replayed through the REAL `applyRepToProfile` fold (overall 72.6). `--reset` wipes + reseeds; refuses prod-looking DATABASE_URL. Login: `demo@cognify.test` / `cognify-demo-7h2p9w!D`.
- [x] C2 `scripts/verify-demo-user.ts` green — verifies via production reads (`buildCommunicationSnapshot`): trends all improving, coachingEffectiveness populated per dim, strongestApplication=storytelling 67.5. **Cold-start account = `e2e-harness@cognify.test`** (11.B setup user, near-zero history) — use it for empty-state passes; demo user for populated passes.

**11.D Coach content pass** ✅ 2026-07-06 (D10 revert + D11 restore + deferred audit content)
- [x] D0 D10: slate 4→5 everywhere; variety slots → 2. ✅
- [x] D1 D11: APPLICATION_SKILLS restored to the full Lab Engine V1 canon (8/app; 10 new ids) in types + seed mirror; 10 new exercises authored (2/app targeting the restored skills, 121 prompts) → catalog now 94 exercises; seeded. Selection tests still green (new skills are additive).
- [x] D2 `coach_insight`: migration 0035 + schema + seed support; threads through Station/ShellStation/AppExercise → InsightScreen (insight LEADS when authored, rule becomes the enforcement line). BaR MomentInsight already carries its own generated insight — catalog consumption n/a there by design. All 94 exercises authored (11 parallel agents, one per catalog file).
- [x] D3 Pack fields `secondary_core_skills` / `common_failure_modes` / `scoring_emphasis` (same migration): seed-validated (secondary ≠ primary dim), consumed in `getExerciseScoringContext` → exercise block gains SECONDARY DIMENSIONS + COMMON FAILURE MODES lines and stage-2 hint gains SCORING EMPHASIS — all rendered ONLY when authored, so pre-enrichment prompts stay byte-identical (calibration-safe). All 94 authored + seeded.
- [x] D4 Topic diversity (§5.6): TOPIC_CATEGORIES (9) + spread instruction in the generation system prompt. FOUND+FIXED while running: response schema's `.max(10)` rejected every 12-prompt batch (we ask for count+2) → shape-only schema (QA filter owns policing), max_tokens scales with count, failures now log. Expansion run on OpenAI: core 540/540 + 80/app cached, ZERO failures (~880 total). NOTE for Phase 12 quality review: GPT-4o generations lean toward bare one-line questions — register thinner than the curated banks.

**11.E Remaining doc items** ✅ 2026-07-06
- [x] E1 Rank-up celebration in ProgressionStrip: localStorage `cognify:last-rank-index` crossing → tier-colored "Rank up!" banner (`data-testid="rank-up-celebration"`); first sight primes silently; storage failure = no fanfare.
- [x] E2 Inline framework editing on sim setup (§7.8): section titles are inputs; blur/Enter commits → `updateCriticalMoment` write-through + parent event state sync (plan reflects edits).
- [x] E3 `.pptx` parsing: `src/lib/prep/pptx.ts` — zero-dep zip central-directory reader + `<a:t>` run extraction (slides ordered, paragraphs line-broken, entities decoded, speaker notes appended); wired into parse dispatch/mime/extension + upload accept. Smoke-tested against a generated fixture.
- [x] E4 Achievements discoverability: Progress header button + "All achievements →" link on the completion strip's earned chips.

### Phase 12 — End-to-end live testing ✅ 2026-07-06 (ledger: `plans/prd-e2e-findings.md`)
*Everything exercised on live OpenAI credits: unit 11 suites ✅ · smoke 11/11 ✅ (post-D3 prompts) · drift replay IDENTICAL to baseline (avg |Δ| 7.8) ✅ · unauthed e2e 13/13 ✅ · authed live loops 3/3 ✅ · NEW 30-route sweep under cold-start + populated demo accounts with server-side session assertion ✅ · 6/6 crons (incl. live weekly-narrative gen) ✅ · generation quality review (40-sample) ✅ · demo-user surfaces verified via production reads ✅.*

### Phase 13 — Fix what testing finds ✅ 2026-07-06 — SIX REAL BUGS found + fixed + verified (commit 6466e743)
1. **F-2 🔴** HMR-leaked DB pools → Supabase pooler EMAXCONN → auth silently degraded to guest (globalThis pool cache).
2. **F-3 🔴** Streaks ALWAYS zero since May 25 — tz bind-params invalidated the grouped streak query on every call (GROUP BY position). Demo user now: 16-day streak.
3. **F-4 🔴** Daily-workout reps NEVER persisted on resumed days (workout_sessions id passed into a practice_sessions FK) — no rep rows/ledger/profile/XP ever landed from the workout loop. practiceSessionId threaded end-to-end; full persistence verified live (lineage + coach_focus + coaching_events + day count).
4. **F-5 🔴** Coach's Focus voided whenever the model picked structural_adherence as primary (framework-heavy reps) — card, retry overlay, retryContext and ledger row all silently dropped. Now redirects to the best core dimension.
5. **F-6 🟠** Fast "Start your Retry" tap silently swallowed pre-SCORE_DONE — machine now buffers early BEGIN_RETRY (mirror of the score-done hoist).
6. **F-7 🟠** completedReps double-counted re-recorded first attempts → interrupted days completed with exercises skipped. Distinct-exercise recount in-tx; verified on a resumed day.
Remaining ledger: F-1 🟡 (generated-prompt register — accepted, revisit at Anthropic re-up), F-8 🟡 (resume position can lag one station on instant kill — accepted, count stays honest).

### Phase 14 — Provider-agnostic AI layer ✅ 2026-07-06 (per Max: "should run pretty much the same … no matter what model") — commit 73557496
*ONE `AI_PROVIDER` knob for every path (non-scoring calls were Anthropic-primary and burned a dead round-trip per call in openai mode); per-ROLE OpenAI model map (scoring/framework distinction survives provider choice); dead-provider circuit breaker (2 hard key failures → cooldown skip; transients never trip it); generation-grade timeouts on the previously-unbounded path; provider-agnostic gates (progression route, health probe probes the REAL serving path, drift tolerance follows the provider); 17 unit tests. Live-verified: openai-primary serves both roles with zero Anthropic attempts. REVERT plan unchanged: set AI_PROVIDER=anthropic (or just remove SCORING_PROVIDER) at re-up.*

### Phase 15 — CTO improvement pass (5-auditor doc+platform re-read) ✅ waves 1+2 SHIPPED (4bd33d2b, 9e36d529 + follow-up) — dispositions in `plans/phase15-audit-synthesis.md`
*Audit theme: "the fallback is the lie" — safeDb/synthetic values masking data loss. Wave 1 (build-now set): labeled write failures (counters + dev-throw + user-visible "rep didn't save" banner), transactional saveRep core, /api/health, auth-degradation counter, stats degraded sentinel · composite_at_close finally written by the real flow (Workout Complete hero/delta/confidence-builder were reading a never-written column) · dead Skip button · Stronger Version on Retry · ONE streak (progression XP/achievements/freezes ran on a naive UTC streak — MWF users could never earn streak rewards) · mode XP weights + session-completion bonuses (§10.5.3) · server-truth rank-up (migration 0037) · server-derived readiness evidence · BaR event context into per-moment coaching (calibration-safe) · Lab session resume (migration 0036) · prompt gen gets stage+goals · scoring hot path sheds the 600-row trends scan + UPCOMING EVENT line · profile-EMA blend fixes post-break selection · plateau always changes stimulus. Wave 2 (in flight): contract-test harness + cron run ledger · retry focus chip + paired First→Retry day summary + Lab recommendation · implementation achievements + multi-freeze + leaderboard rank badges + 2-day schedules + committed-week challenge · moment coachCue/scoringHint + readiness re-practice links + similar-event history + insight-screen coaching memory + assessment new-exercise preference + slate tag diversity. Wave 2 landed everything except P-7 branded ids (deliberately deferred to an isolated post-eyes-on PR). Contract harness immediately caught TWO more always-broken queries (rep-detail 404s; dim selection stuck on cold-start fallback) — fixed + enforced. Full validation on the settled tree: 13 unit suites, 38/38 contracts, 3 live authed loops, 34 sweep/probe, 13 unauthed, lint. Migrations 0036-0039 applied to dev. Demo user reseeded.*


---

## 🏁 ALL 9 PRD PHASES BUILT (2026-07-06) + Phase 10 spec-fidelity hardening. Promotion checklist before prod:
1. Top up Anthropic + OpenAI credits (both dead — mock scoring on dev).
2. Max eyes-on dev test of Phases 1–9 on :3333.
3. Calibration replay (Phase 3 coaching-memory + Phase 7 EFFECTIVENESS lines changed v2 scoring prompts; non-retry legacy prompts remain byte-identical).
4. Run smoke harness (`scripts/smoke-engine-v2.ts`) with live keys.
5. Prod migrations 0028–0034 (`apply-prod-migration.mjs`) + exercise seed (84) + profile backfill.
6. Prod env: flip `FF_*` flags, RESEND_API_KEY, CRON_SECRET (new cron), Supabase `prep-context` bucket auto-creates.
7. Optional post-credit: `expand-prompt-bank.ts --apply` (Phase 8.2).

---

## 3. Working agreements
- **Dev/test/promote**: all work flag-gated; phase built fully on branch + dev server/preview; Max eyeball-tests; then prod promotion. No partial prod drips (D7).
- **Never commit to main directly; PRs required** (repo standard). Reference this tracker in PR descriptions.
- **Every phase start**: re-read the relevant PRD section IN FULL (`plans/prd/cognify-system-change-prd.md`) + its comments before coding (PRD "Working with Claude Code" instruction).
- **Definition of Done per PRD**: behaves as documented, integrates cleanly, supports the learning philosophy, meets §11 Product Standards, ready for real users.
- **Ambiguity rule**: if requirements conflict (e.g., 4-vs-6 prompt options, 5-vs-6 bands), stop and log in Decision Log rather than guessing silently.
- **Calibration guardrail**: any scoring-prompt change re-runs the reference-rep bank before merge.

## 4. Session log
| Date | Session summary |
|------|-----------------|
| 2026-07-02 | PRD read end-to-end + comments extracted; 7-agent codebase gap survey completed; roadmap drafted; D1–D4 asked (pending Max); dev server verified on :3333. No code changes. |
| 2026-07-02 (2) | Max confirmed D1–D4. Branch `feat/prd-v3` cut off feat/muscle-group-pivot. Phase 0 done (ADR-001, terminology map, 5 flags). Phase 1 BUILT: machine v2 loop (insight/retry/improvement-review/quit, 84 tests), migration 0028 (attempt lineage + coaching_events, applied to dev), coach-focus contract + retry evaluation through both scoring paths + all 3 routes, InsightScreen/ImprovementReview/QuitSummary components, full RepControls/WorkoutShell/RepSurface wiring. typecheck/lint/all unit suites green; /workout 200 on dev. Open: Max eyes-on test, loop e2e spec, calibration replay, deferred 1.A6-full + 1.B4 to Phase 2. Next session: address Max's dev-test feedback, then Phase 2 (3-exercise day, Exercise Framework enrichment, assessment phase, adaptive rotation, prompt no-repeat, celebratory completion). |
| 2026-07-02 (3) | Phase 2 BUILT (all but 2.8, deferred to Phase 4): 3-exercise v2 day w/ data-driven completion targets + retry-safe rep counting; migration 0029 + full 54-exercise framework enrichment (6 parallel authoring agents) seeded to dev; DB-backed scoring lens; Hidden-Skill-aware exercise selection (weakness-weighted + diversity); Assessment Phase (2 balanced cycles, suspends all adaptive overrides); weakness-weighted rotation floors (4/6/7d); in-session prompt no-repeat; celebratory completion (stats row, most-improved, coach's call). All suites/lint/typecheck green, /workout 200. Next session: Max's eyes-on feedback → then Phase 3 (Communication Profile + Snapshot + coaching memory + Overall Communication Score + engine consolidation). |
| 2026-07-02 (4) | Phase 3 BUILT (3.7 deferred to Phase 4 with 2.8): migration 0030 communication_profile + users.communication_stage (applied to dev); count-scaled EMA profile fold in saveRep; Overall Communication Score persisted (display → Phase 6); backfill run on dev (5 users); Communication Snapshot service; coaching-memory block through both scoring paths + 3 routes (calibration-safe); plateau detection wired into rotation as variety swap; Communication Stage settings section. 12 suites/lint/typecheck green; /workout + /settings 200. FOUND: two-stage path drops userCalibration (pre-existing) — flag for Max. NEXT: Max eyes-on of Phases 1–3 on dev, calibration replay, then Phase 4 (Skill Lab applications + 2.8/3.7 legacy-engine consolidation). |
| 2026-07-03 | Phase 4 partial (session interrupted, unlogged until 07-06): taxonomy module, migration 0031 (applied to dev), 5 application catalogs authored + seeded (30 exercises), startSkillLab/complete actions, AppSessionClient session runner, per-application profile fold, seed/backfill script support. No routes yet; wrong flag on the action. |
| 2026-07-06 (10) | **Phases 14+15 SHIPPED (Max: model-agnostic + CTO improvement pass).** P14: AI_PROVIDER governs EVERY path (non-scoring was Anthropic-primary), per-role OpenAI model map, dead-provider breaker, gen timeouts, provider-agnostic gates + drift tolerance; live-verified zero wasted round-trips. P15: 5 parallel auditors (doc §4-10 + platform) → 40 findings, all built across 2 agent waves except 5 deliberate deferrals (`plans/phase15-audit-synthesis.md`). Headliners: "the fallback is the lie" class killed (labeled writes + dev-throw + user-visible save-failure banner + tx saveRep + /api/health); §5.7 Final Communication Score was NEVER written by the real flow; progression ran on a naive UTC streak; contract harness (38 checks) immediately caught rep-detail 404-on-every-rep + dim selection stuck on cold-start fallback (exposed by F-4's own fix — every e2e day had been "Clarity Day"). Coaching depth: moment coachCues+scoringHints (42 authored), event context + similar-event history into BaR coaching, insight-screen coaching memory, assessment coverage, slate tag diversity, implementation achievements, multi-freeze, leaderboard rank badges, session-completion XP. Migrations 0036-0039 dev-applied. Validated: 13 unit suites, 38/38 contracts, 3 live loops, 34 sweep/probe, 13 unauthed, lint. Commits 73557496→285972ef. NEXT: Max eyes-on (demo reseeded), Anthropic re-up → drop AI_PROVIDER override + re-baseline, W3 deferrals (branded ids post-review), prod promotion (migrations now 0028-0039). |
| 2026-07-06 (9) | **Phases 11-13 COMPLETE — plan from the doc is BUILT AND LIVE-TESTED.** 11.C demo user (90-rep 21-day deterministic history + verifier). 11.D1 8 app skills restored + 10 new exercises (5 agents). 11.D2/D3 migration 0035 pack fields plumbed + ALL 94 exercises authored (11 agents) + seeded; scoring context consumes emphasis/failure-modes calibration-safely (drift replay = baseline exactly). 11.D4 §5.6 topic spread + FIXED schema bug that zeroed every expansion batch → 940 prompts cached, 0 failures. 11.E1-E4 (rank-up moment, sim inline editing, .pptx zero-dep parser, achievements entries). Phase 12 full live sweep (see ledger). Phase 13: **six real bugs fixed+verified** — HMR pool leak→guest-degraded auth; streaks always-zero since May 25; workout reps NEVER persisted on resumed days; Coach's Focus voided on structural_adherence; early retry-tap swallowed; completedReps double-count. Workout/lab/BaR loops green WITH full persistence; resumed-day re-verified. Commits e1629cf1→6466e743. NEXT: Max eyes-on tour (demo@cognify.test / cognify-demo-7h2p9w!D), Anthropic re-up → revert SCORING_PROVIDER + re-baseline, prod promotion checklist. |
| 2026-07-06 (8) | Phase 11.A+B BUILT: SCORING_PROVIDER=openai validated (smoke 11/11; two-stage userCalibration drop FIXED; talking-points gate FIXED; implementationReview hardening for GPT-4o); OpenAI calibration baseline persisted (avg |Δ| 7.8, top-band compression). Authed E2E harness: Supabase-provisioned test user through the REAL signin UI → storageState; TTS spoken-rep.wav fake mic; all three engine loops pass LIVE (workout 1.2m, lab 1.2m, BaR 48s). D10 slate 4→5 + variety 2. |
| 2026-07-06 (7) | Phase 10 BUILT (full PRD re-read via 6 parallel auditors → 31 deviations, 3 MUST-FIX; all code-side closed): ADR-001 count-up/target-band timer + overage-as-signal; v2 feedback = Score → ONE Coach's Focus → Breakdown (prohibited did-well/didn't-land split removed); ImprovementReview breakdown + per-skill deltas; D10 slate=4; difficulty bias live; Lab maintenance slot + snapshot routing + telemetry; §8.3.10 Improvement Trends; onboarding stage step (5-step flow); BaR adaptive prep + next-moment branches + editable rep-screen time + auto-regen on upload; ProgressionStrip shows Communication Score + six skills; nav/achievements/per-mode counts; mvp-metrics.mjs. D10 PROVISIONAL (Max unresponsive to the ask — one-constant override). All suites/e2e green. |
| 2026-07-06 (6) | Phase 9 BUILT — PLAN COMPLETE: tap-target sweep (audit now 4/4 green; product violations all fixed, dev-tools excluded), Delivery→Pacing terminology per D6 (label source + achievements + marketing + exemplars 404), welcome email's fictional dimension lists corrected. ALL 13 e2e + 18 unit suites + typecheck + lint green; 9 routes 200. Every PRD phase (0–9) now built on feat/prd-v3, all flag-gated, awaiting: credits re-up → Max eyes-on → calibration replay → prod promotion (checklist above). |
| 2026-07-06 (5) | Phase 8 BUILT (8.4 deferred to post-review): runtime prompt-gen engine (QA filter, cache-back, FF_PROMPT_GEN, starvation-point wiring in fetchPromptCandidates, prompt_gen knowledge stage live); offline expansion pipeline script (blocked on credits); engagement-driven pruning script w/ per-exercise floor. 17 suites green. NEXT: Phase 9 (polish). |
| 2026-07-06 (4) | Phase 7 BUILT: coaching-effectiveness rates in Snapshot + EFFECTIVENESS technique-switch line in coaching memory (calibration replay required); confidence-builder selector intervention (2 rough days → strongest dim); planUpcomingDims "Next up" plan preview; Overall Communication Score on dashboard hero w/ stage benchmark bands; C18 variety guardrail (2 general slots in personalized slates); Snapshot now unifies profile+coaching+effectiveness+event-readiness. 16 suites green. NEXT: Phase 8 (prompt generation engine). |
| 2026-07-06 (3) | Phase 6 BUILT: rank.ts (32 ranks from XP, no migration), §10.5.3 XP factors in awardXp+saveRep, RankBadge SVG + LevelStreakCard rank mode, league fold behind FF_RANK_SYSTEM, leaderboard metrics (weekly improvement default + communication score board), weekly challenges (migration 0034, 7-challenge bank, saveRep fold, dashboard card) + team challenges, ProgressionStrip on all 3 completion surfaces (fixed the dead celebration pipe), committed-day reminder cron + Resend template + Settings toggle. Fixed pre-existing repsToday lifetime-count quest bug. 15 suites green. NEXT: Phase 7 (intelligence deepening). |
| 2026-07-06 (2) | Phase 5 BUILT: migrations 0032/0033 (prep tables + build_a_rep mode, applied to dev); plan + readiness-review generators w/ deterministic fallbacks; context uploads (unpdf/mammoth, Supabase prep-context bucket, /api/prep-context); prep-events actions (create/regenerate/edit-plan/practice/finish); PrepHome intake + PrepEventClient (plan editor, guided moment loop on the engine, Full Simulation w/ framework sidebar, Readiness Review screen); score caps raised for long sims (48k chars/25min); entitlement hook (C7); flag-branched /build-a-rep. 14 suites + 9 e2e green. FOUND: orphaned dev server (dead stdout pipe) caused EPIPE WorkerErrors on new routes — restart fixed; not a code issue. NEXT: Phase 6 (Rank ladder, challenges, unified celebration). |
| 2026-07-06 | Phase 4 COMPLETED (D9: Max chose drills → Daily Workout extras + PRD-pure Skill Lab). Flag fixed to FF_SKILL_LAB_APPS; per-Application-Skill EMA tracking in profile (server-derived from exercise rows); Lab Personalization Engine (selection.ts, 14 tests) wired into session start; §6.8 Session Complete (app score, most-improved app skill, core breakdown, coach recommendation, all-time reps); routes: [dimension]→[slug] rename (exemplar URLs unchanged), /skill-lab/[slug] session page, applications hub w/ score chips, /drills relocation + redirects both flag states, DayCompleteSummary "Extra reps" CTA, dashboard/hero/theme-script integration. e2e: skill-lab-v2.spec.ts (6/6) + tap-target audit extended (fails on pre-existing shell chrome only). typecheck/lint/13 suites green; seed idempotent; backfill re-run on dev. NEXT: Max eyes-on Phases 1–4 on dev (:3333), calibration replay, prod promotion checklist (0028–0031 + seed + backfill), then Phase 5 (Build a Rep event prep — needs doc upload + async long-rep pipeline). |
