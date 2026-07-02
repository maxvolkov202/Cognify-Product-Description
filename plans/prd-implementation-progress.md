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
- [ ] 2.8 DEFERRED → Phase 4 start: legacy rep-type Daily Workout path retirement (pressure machinery still feeds graduation rep + Skill Lab).

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
- [ ] 3.7 DEFERRED → Phase 4 start (with 2.8): engine consolidation — muscle-group + rep-type generators behind one Snapshot-driven engine.
- [x] 3.8 Backfill `scripts/backfill-communication-profile.ts` (chronological replay through the same fold; idempotent) — run on dev (5 users, 174 dim rows). **Run on prod at promotion.**

Verification (2026-07-02): typecheck ✅ · lint ✅ · all 12 suites ✅ (21 new profile/plateau) · /workout + /settings 200 on dev.
PRD refs: §8.2, §8.3 entire, §8.4.1–8.4.2, §8.6, §10.3.

### Phase 4 — Skill Lab: applications (PRD §6) ⬜
*Goal: user picks an Application; Cognify picks everything else; same engine loop.*
- [ ] 4.1 Application taxonomy: 5 applications + Application Skills per app (PRD §6.5 + Lab Engine V1 spec lists) as data (new tables `applications`, `application_skills`, exercise-framework links). Terminology: "Skill Lab" user-facing.
- [ ] 4.2 Application exercise frameworks: author initial set per application (PRD Lab Engine V1 output format = authoring template; existing knowledge `domains/*.md` overlap — storytelling, behavioral-interview, negotiation, exec-briefing).
- [ ] 4.3 Session config: pick application → pick length (3/5/10, default 3 — reuse `RepCountChoice`) → engine loop per exercise; required retry + optional extra reps (PRD §4.9).
- [ ] 4.4 Application scores (PRD §6.7/§10.3.2): derived from Core Skill performance on that app's reps; `application_performance` in profile; Session Complete screen per §6.8.
- [ ] 4.5 Lab personalization engine: within chosen app, Snapshot picks weakest Application Skill → exercise → prompts (PRD §8.4.5, §8.5.4).
- [ ] 4.6 Migrate current dimension-drill Skill Lab: either keep as "Focus drills" sub-mode or fold into Daily Workout extras — decide with Max at phase start.
- [ ] 4.7 Nav/dashboard integration; mode cards per PRD §3.

Acceptance: full Storytelling session end-to-end on dev with application scoring; other 4 apps content-complete; e2e added.
PRD refs: §6 entire, Lab Engine V1, §8.4.5, §8.5.4.

### Phase 5 — Build a Rep: event preparation (PRD §7) ⬜
*Goal: describe an event → prep plan of Critical Moments → Guided Practice or Full Simulation → Readiness Review.*
- [ ] 5.1 Data model: `prep_events`, `critical_moments`, `prep_context_uploads`, `readiness_reviews`; mode enum value `build_a_rep`.
- [ ] 5.2 Event intake: conversational description (reuse `CustomScenarioBuilder` patterns); event-type inference.
- [ ] 5.3 Context uploads: doc upload endpoint (Supabase Storage or wire the declared-but-unused Vercel Blob), parsing (pdf/docx/txt — add parser lib), parsed context into generation. Optional always (PRD §7.4).
- [ ] 5.4 Preparation Plan generation: Critical Moments list from event + context (Claude Sonnet), editable (add/remove/rename/reorder), recommended times per moment.
- [ ] 5.5 Guided Practice: per-moment engine loop, free ordering, retry-until-satisfied (retries unlimited here per PRD §4.9), event-context-aware coaching.
- [ ] 5.6 Full Simulation: uninterrupted long rep with framework sidebar (editable), timer, feedback only at end. **Infra: async pipeline** — chunked/long transcription, raise `/api/score` caps or new `/api/score-long`, background processing via existing async-scoring scaffold (`/api/score-internal` + Edge Function); respects Vercel 300s ceiling via chunking.
- [ ] 5.7 Readiness Review: overall score, single highest-impact focus before the event, Core Skill breakdown, readiness summary; per-event readiness stored in profile (PRD §8.3.8).
- [ ] 5.8 Premium consideration (C7): meter compute; keep entitlement hook ready (no billing build yet unless Max says so).
- [ ] 5.9 Replace current `/build-a-rep` scenario flow; keep talking-points generation as the Critical-Moment/framework generator substrate.

Acceptance: "SDR interview" flow end-to-end with resume+JD upload on dev; wedding-toast Full Simulation ≥8 min processes successfully; Readiness Review renders.
PRD refs: §7 entire (MVP scope §7.10 — conversational simulation is OUT of scope per §7.11), §8.4.6, §8.5.5.

### Phase 6 — Progression & motivation overhaul (PRD §10) ⬜
*Goal: rank, challenges, leaderboards, unified celebration — after the training experience is solid (PRD ordering).*
- [ ] 6.1 Rank ladder per D4: 8 tiers × 4 divisions, badges, progress bar; XP weighting adds retry-implementation + score-improvement factors (PRD §10.5.3); non-linear curve (reuse `levels.ts` math); permanent-forward; migration maps existing levels→ranks.
- [ ] 6.2 League reconciliation per D4 (rename tiers or fold into leaderboards).
- [ ] 6.3 Leaderboards: default = weekly improvement, filter = overall Communication Score (PRD §10.10); reuse `queries/leaderboard.ts`.
- [ ] 6.4 Weekly Challenges (PRD §10.10 doc's §10.10/§10.12): weekly-reset challenge defs + progress; evolve daily-quest engine.
- [ ] 6.5 Team Challenges: team-scoped shared goals on `teams`/`memberships`.
- [ ] 6.6 Unified completion celebration across all modes: updated scores + rank progress + streak + achievements + all-time reps in ONE surface (kills the toast-vs-screen split).
- [ ] 6.7 Badge/rank visual assets (coordinate design; mascot integration).
- [ ] 6.8 Reminder/nudge notifications (streak-at-risk cron, committed-day reminders) — email first (Resend), push later.

Acceptance: rank visible + progressing on dev; migration dry-run on prod snapshot; weekly challenge cycle simulated; completion screen unified.
PRD refs: §10 entire.

### Phase 7 — Intelligence deepening (PRD §8 remainder) ⬜
*Goal: the "gets smarter every rep" layer, once data from Phases 1–6 accumulates.*
- [ ] 7.1 Adaptive coaching maturity: coaching-effectiveness tracking (did focus X improve skill Y?), technique selection per user.
- [ ] 7.2 Confidence management (PRD §8.4.4): challenge/reinforce balancing in rotation.
- [ ] 7.3 Multi-session planning: sequence-of-workouts objective replacing single-day greedy selection.
- [ ] 7.4 Communication Insights surfaces (trends, benchmarks by Communication Stage).
- [ ] 7.5 Prompt-to-profile fitness tuning (C18): personalization strength dial, variety guardrails.
- [ ] 7.6 Long-term memory consolidation (PRD Long-Term Memory) — profile + coaching history + content memory unified service.

### Phase 8 — Content expansion & prompt generation (PRD §9) ⬜
- [ ] 8.1 Prompt generation engine per D3 (hybrid): runtime generation module implementing the PRD's three Engine V1 specs (Daily Workout / Lab / Build a Rep) with framework-rule validation, QA filters, cache-back into banks; wire the dead `prompt_gen` knowledge stage.
- [ ] 8.2 Bank expansion per Hunter C15: prompts per Hidden Skill via offline pipeline.
- [ ] 8.3 Content flywheel metrics: engagement-driven pruning (reuse `prompt_engagement`).
- [ ] 8.4 Additional exercise frameworks per Core Skill + application.

### Phase 9 — Polish & optimization (PRD Phase 9) ⬜
- [ ] 9.1 Animations/haptics/celebrations pass; 9.2 accessibility; 9.3 empty/loading states; 9.4 performance; 9.5 error-handling sweep; 9.6 copy consistency vs terminology map (incl. stale welcome-email dimension names).

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
