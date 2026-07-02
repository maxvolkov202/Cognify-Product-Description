# Phase 1 — Universal Training Engine: implementation design

Status: in progress 2026-07-02. Flag: `FF_TRAINING_ENGINE_V2` (`isTrainingEngineV2Enabled()`).
PRD §4; ADR-001; decisions D1/D2. Phase 1 keeps 4 stations (3-exercise cut is Phase 2.1).

## Loop (flag ON)

```
prompt-selecting ──PICK_PROMPT──▶ insight ──INSIGHT_DONE──▶ recording → transcribing → scoring
                                                                              │ SCORE_DONE (attempt=first)
                                                                              ▼
                       score-reveal (Coach Feedback; CTA = "Start your Retry")
                                             │ BEGIN_RETRY
                                             ▼
                       retry: recording → transcribing → scoring   (same prompt, focus carried)
                                             │ SCORE_DONE (attempt=retry|again)
                                             ▼
                       improvement-review ──ADVANCE──▶ walking / day-complete-prompt
                              │ RETRY_AGAIN ─▶ retry loop (attempt="again", may overload per ADR-001 D3)
                              │ QUIT ────────▶ quit-summary (real-life tip, C9) → exit to dashboard
```

Flag OFF: existing flow untouched (score-reveal → ADVANCE). The machine supports both
transition sets unconditionally (pure reducer stays flag-agnostic); the UI decides which
CTAs to render, so the flag lives only in components/server.

## Machine changes (`src/lib/workout/session-machine.ts`, `types.ts`)
- New `SessionPhase` values: `insight`, `improvement-review`, `quit-summary`.
  (Retry re-uses `recording/transcribing/scoring` phases + a new `attempt` field —
  avoids duplicating the transient-phase logic incl. the SCORE_DONE hoist.)
- New state: `attempt: "first" | "retry" | "again"`, `firstOutcome: {repId, composite} | null`
  (per current station, reset on WALK_DONE/PICK_PROMPT), `retryOutcome` same shape.
- `StationOutcome` gains `attempt`; a station contributes its FIRST-attempt outcome to
  `outcomes` at first SCORE_DONE and the retry outcome separately (`retryOutcomes` list) so
  DayCompleteSummary can show both later without breaking existing consumers.
- New events: `INSIGHT_DONE`, `BEGIN_RETRY`, `RETRY_AGAIN`, `QUIT`.
- SCORE_DONE routing: attempt=first → `score-reveal`; attempt=retry|again → `improvement-review`.
- QUIT allowed from `score-reveal` and `improvement-review` → `quit-summary`.
- `workout_sessions.state` persists the new phases (text column, no enum change needed).

## Schema (migration 0028)
- `reps.attempt_kind` text NOT NULL DEFAULT 'first' ('first'|'retry'|'again').
- `reps.parent_rep_id` uuid NULL self-FK (retry → its first rep), ON DELETE SET NULL.
- `reps.coach_focus` jsonb NULL: `{dimension, subSkill?, text}` — the Coach's Focus this
  rep RECEIVED (written after scoring).
- New table `coaching_events`: id, user_id FK, rep_id FK, dimension, sub_skill (nullable),
  focus_text, implemented_verdict (nullable; 'nailed'|'partial'|'missed', set by the retry's
  evaluation), created_at. Indexes on (user_id, created_at) and rep_id.
  This is the seed of PRD §8.3.9 Coaching History — Phase 3 reads it.

## Scoring contract (`src/lib/ai/score.ts`, `score-stages.ts`)
- `deriveCoachFocus(score): CoachFocus` pure helper — from `primaryFocusDimension` +
  `nextRepFocus[0]` (dimension, subSkill, text). No prompt change needed for first reps.
- `ScoreRepModeContext` gains optional `retryContext: {firstTranscript, firstComposite,
  coachFocus, attempt}`. `renderModeBlock` emits a RETRY EVALUATION block: assess whether
  the focus behavior improved; write feedback as implementation review, not fresh critique.
- Zod schema gains optional `implementationReview: {verdict: 'nailed'|'partial'|'missed',
  note: string}` — only requested when retryContext present, so reference-rep calibration
  (no retryContext) is unaffected. Fallback: if the model omits it, derive verdict
  deterministically from the focus dimension's delta (>= +5 nailed, >= 0 partial, else missed).
- Server persists coach_focus on the rep + a coaching_events row; retry scoring updates the
  first rep's coaching_events.implemented_verdict.
- Display rule (C10): negative composite deltas render softened — numeric badge only for
  deltas >= -3; below that, copy ("slightly under your first take — normal when changing
  habits") without a big red number. Positive deltas celebrate loudly.

## UI (`workout-shell/`, `feedback/`)
- `InsightScreen` (new, phase `insight`): Coach's Insight cue (exercise rule + why +
  framework hint), response-window chip (ADR-001), "Let's go" CTA → INSIGHT_DONE.
  Constraint revealed here, after topic pick (C19).
- `RepControls`: render InsightScreen; ActiveRep for retry passes `retryFocus` (derived
  Callout), `previousRepSummary` (first attempt), `scoreModeContext.retryContext`; feedback
  CTA becomes "Start your Retry" (BEGIN_RETRY) on first attempts when flag on.
- `ImprovementReview` (new, phase `improvement-review`): score movement (softened negatives),
  focus-dimension delta, implementation verdict chip, next development opportunity (retry's
  coach focus), CTAs: Retry Again / Next station / Quit.
- `QuitSummary` (new, phase `quit-summary`): mascot-voice real-life tip keyed to the day's
  dimension + best delta; "Back to dashboard".
- Timer: Phase 1 keeps RecordButton mechanics; adds target-window display variant
  (count-up with 60–90s band) behind the same flag. Full constraint taxonomy lands Phase 2.

## Test plan
- `tests/workout-session-machine.test.ts`: new transitions (insight, retry routing by
  attempt, improvement-review actions, quit), hoist behavior during retry, pause/resume
  inside retry, outcomes bookkeeping (first vs retry lists).
- New `tests/coach-focus.test.ts`: deriveCoachFocus + deterministic verdict fallback +
  softened-delta display rule.
- e2e: extend workout e2e to drive the full loop with mocked scoring.
