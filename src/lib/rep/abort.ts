// UI overhaul Phase 5 (task 5.1) — pure abort-gate logic for the rep flow.
//
// Aborting a rep must produce NO side effects: no rep row, no XP, no streak
// fold, no coaching event, and no session advance. All of those side effects
// live downstream of saveRep()/onComplete() in RepSurface.runScoringPath. The
// safety-critical rule is therefore: only OFFER an abort at a stage that runs
// BEFORE any persistence begins, and guard the scoring path so a late abort
// (fired while /api/score is in flight) still returns before saveRep().
//
// This module holds that rule as pure, testable logic (RepSurface imports
// `canAbortAtStage`; the invariant is locked by tests/rep-abort.test.ts).

/** The phases RepSurface's state machine can be in when a user might abort.
 *  Mirrors the `Phase.kind` union in RepSurface for the stages that matter to
 *  the abort decision. */
export type RepFlowStage =
  | "idle"
  | "transcribing"
  | "scoring"
  | "saving"
  | "processing-async"
  | "done";

/** Stages that run BEFORE any persistence. An abort here is a clean discard.
 *  - `idle`         — recording lives in RecordButton; nothing captured server-side.
 *  - `transcribing` — /api/transcribe only; no rep row, no scoring yet.
 *  - `scoring`      — /api/score in flight; still pre-saveRep.
 *  Excluded on purpose:
 *  - `saving`           — saveRep already invoked; a row may exist.
 *  - `processing-async` — insertPendingRep already wrote a pending row.
 *  - `done`             — rep saved + surfaced. */
const ABORTABLE_STAGES: readonly RepFlowStage[] = [
  "idle",
  "transcribing",
  "scoring",
];

/** Whether a user-initiated "Abort / Discard rep" control may be offered at
 *  this stage. False once any persistence has started, so abort can never race
 *  a write. */
export function canAbortAtStage(stage: RepFlowStage): boolean {
  return ABORTABLE_STAGES.includes(stage);
}
