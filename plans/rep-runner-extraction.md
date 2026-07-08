# RepRunner extraction plan (Phase E follow-up)

## Context

`src/components/product/RepSurface.tsx` is **1259 LoC with a ~30-prop
interface** consumed by 7 production callers across 4 distinct
product surfaces:

| Caller | Surface | What it asks of RepSurface |
| --- | --- | --- |
| `WorkoutSession.tsx` (archived) | legacy daily workout | Full rep loop + retry + carry-over focus |
| `workout-shell/RepControls.tsx` | muscle-group pivot workout | Rep loop + Phase 8 exerciseId/muscleGroupDayId props |
| `SkillLabSession.tsx` | Practice surface | Rep loop + per-skill feedback |
| `BuildARepFlow.tsx` | Custom rep authoring | Rep loop with user-authored prompt + framework |
| `QuickRepFlow.tsx` | One-off rep | Minimal rep loop, no carry-over |
| `BaselineRep.tsx` | Onboarding baseline | Single-rep loop with onboarding-specific copy |
| `ChallengeRunner.tsx` | Pressure / challenge sessions | Rep loop + pressureArchetypeId + speaking threshold gate |

These callers share **the same core flow**:

1. Render prompt + framework cheat-sheet
2. Hand off to `RecordButton` (and `RepHintsBar`)
3. On recording complete → optimistic dim preview → server score
4. Render `FeedbackPanel` (or `FlowFeedbackPanel` for Flow Session)
5. Retry / next

But each caller passes a different subset of the 30+ props to thread
their UX variant. This is where the 1259 LoC comes from — the file
has accreted every variant flag (retryFocus, carryoverFocus,
feedbackMode, flowRepIndex, pressureContext, feedbackLastRepFocus,
onMidRepPause, speakingThreshold, scoreModeContext, exerciseId,
muscleGroupDayId, isGraduationRep, …) as a flat prop bag.

## Proposed shape

Split `RepSurface` into three layers:

```
RepRunner (headless state machine + scoring orchestration)
    ├── useRepRunner() hook — Phase machine, idle/transcribing/scoring/done
    └── thin context provider for callers to read the current phase
RepRunnerSurface (default UI shell using RepRunner)
    ├── consumes useRepRunner()
    ├── renders RecordButton, OptimisticDimensionPreview, FeedbackPanel
    └── exposes slot props for caller-specific chrome (above-the-fold
        cheat sheet, post-feedback CTA, etc.)
Caller-specific surfaces
    ├── WorkoutRepSurface — wraps RepRunner with workout-shell chrome
    ├── PracticeRepSurface — wraps RepRunner with skill-lab chrome
    ├── ChallengeRepSurface — wraps RepRunner with pressure chrome
    └── (etc.)
```

The 30-prop interface collapses to:

- **`RepRunner` core props (~8)**: `prompt`, `framework?`,
  `mode?`, `sessionId?`, `maxDurationMs?`, `scoreModeContext?`,
  `speakingThreshold?`, `onComplete?`
- **Surface props are owned by the caller**, not pushed through
  RepRunner. (Carry-over focus, archetype context, save-and-exit
  routes, etc. live in the caller's wrapper.)

## Migration plan

Each step is its own commit. Plan to ship as **a separate branch off
`feat/muscle-group-pivot`**, not on this PR.

1. **Step 1 — Extract `useRepRunner` hook.** Pull the Phase machine
   + `RecordButton` → `insertPendingRep` → `getRepResult` flow into a
   headless hook. `RepSurface` adopts the hook internally; behavior
   unchanged.
2. **Step 2 — Build `RepRunnerSurface` shell.** Move the default UI
   chrome (RecordButton placement, optimistic preview, FeedbackPanel
   rendering) into a thin shell that consumes the hook. `RepSurface`
   delegates to it for the default path.
3. **Step 3 — Migrate `RepControls` (muscle-group pivot).** First
   real caller swap. Replace `<RepSurface ... />` with
   `<WorkoutRepSurface ... />` which wraps `<RepRunnerSurface />`
   plus the workout-shell-specific chrome. Verify the full muscle-
   group flow on staging.
4. **Step 4 — Migrate `SkillLabSession`.** Second caller. Verify the
   Practice surface still ticks the same way.
5. **Step 5 — Migrate `BuildARepFlow`, `QuickRepFlow`, `BaselineRep`,
   `ChallengeRunner` one PR per surface.** Each merge is gated on its
   own smoke test.
6. **Step 6 — Delete `RepSurface.tsx`.** Strip it once every caller
   is off. Final PR.

## Out of scope for this prep

- The actual extraction (Step 1+). This is a ~2-day refactor with
  caller-by-caller smoke testing; doing it inside the muscle-group-
  pivot PR risks scope creep + reviewer fatigue.
- Pure logic extraction. The `useRepStatus` hook already exists at
  `src/hooks/useRepStatus.ts`; reuse it.
- New behavior. Step 1-6 are behavior-preserving refactors only.

## Risk

- **Caller drift.** Each surface has subtly different needs. The
  RepRunner core must not foreclose on any of the existing variants;
  the seven callers are the spec.
- **Optimistic dim preview shape.** RepSurface uses
  `OptimisticDimensionPreview` with `computeOptimisticDims`; behavior
  depends on `previousDimensionScores` being passed in. The new
  surface must keep that wiring.
- **`onComplete` shape coupling.** Callers depend on the
  `onComplete({ score, recording, repId, sessionId, transcript,
  words, gate?, guestRepCount? })` shape. New API must preserve it.
- **The archived `WorkoutSession.tsx`.** Skipping it — the file is
  in `_archive/` with `@ts-nocheck`, not in the live tree, so no
  migration needed. Confirm again before Step 6 deletes RepSurface.

## Why we're documenting instead of doing

The launch is gated on smoke testing the muscle-group pivot, not on
this refactor. Mixing a 7-caller behavior-preserving refactor into
the pivot PR would mean:

- Review burden balloons: pivot is ~15 commits of new product; this
  would add another 6+ behavior-preserving refactor commits in
  unrelated surfaces.
- Bisect surface area expands: a regression in Skill Lab or Build-a-
  Rep traces back to "the pivot" instead of "the RepRunner refactor."
- The refactor itself benefits from its own smoke matrix (per-caller),
  which is its own day of work.

Hence: scope it, write down the plan, ship under a separate branch
when Max is ready.
