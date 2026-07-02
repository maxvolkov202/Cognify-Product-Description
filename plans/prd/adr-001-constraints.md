# ADR-001 — Rep timing & the constraint taxonomy

Status: **Accepted** (2026-07-02, per Max's "go with the best option" delegation; revisit only with new evidence)
Context: PRD §4/§5 + Owen's comments C3 (clock mechanics undefined), C4 (timing is only one
constraint type), C5 (progressive overload), C19 (system picks constraints after topic pick).

## Decision 1 — Clock: count-up with a target window, soft overage

The rep timer **counts up**, displaying a **target window** (e.g. "60–90s") rather than a
hard countdown to zero.

- Hitting the window start = neutral. Inside the window = green. Past window end = amber,
  with a gentle "wrap it up" cue (mascot/voice line, no buzzer).
- **The recording never hard-stops at the target.** A hard technical ceiling stays
  (currently `maxDurationMs`, raised per mode) purely as an infra guard.
- **Overage is a scoring signal, not a gate**: exceeding the window feeds the existing
  deterministic conciseness/pacing signals (`response scoping`, `time-budget compliance`)
  and can cost points there — mirroring real life, where nobody cuts your mic but rambling
  costs you the room.

Why: Owen C3's hypothesis (count-up beats count-down; expiry shouldn't kill the rep) matches
the PRD's own framing that the timer exists to "recreate time pressure," not to grade
(§7.7). A hard cut destroys the second half of a rep's evidence and punishes the transcriptless
user twice. Count-down is retained ONLY inside explicit time-attack constraints (below).

## Decision 2 — Constraints are a first-class taxonomy, timing is one member

A rep may carry **at most one primary constraint** (PRD: one communication challenge per
prompt; don't stack). Constraint types:

| Type | Examples | Trains | Timer behavior |
|------|----------|--------|----------------|
| `time` | "in under 30s", word budget | conciseness, scoping | count-DOWN, visible urgency |
| `structure` | STAR, BLUF, PREP, 3-point | structure hidden skills | count-up + framework strip |
| `tone` | "stay warm but direct", authority voice | tone hidden skills | count-up |
| `complexity` | ELI5/ELI12, no-jargon, one-point-only | clarity hidden skills | count-up |
| `none` | plain prompt | baseline | count-up + window |

- The **Exercise Framework** declares which constraint types it may use and the default
  response window (PRD standard: 60–120s; time-attack exercises may go lower — the current
  20–45s budgets survive only inside explicit `time` constraints).
- **Sequence per C19**: user picks the topic (prompt) → system attaches the constraint.
  The constraint is revealed on the Coach's Insight/pre-rep screen, not inside the prompt list.

## Decision 3 — Progressive overload lives in "Retry Again"

The required Retry (loop stage 4) always re-runs the SAME prompt + constraint with the
Coach's Focus applied — implementation, not escalation.

**"Retry Again"** (optional third+ attempt, post-Improvement-Review) may escalate per C5:
same prompt with raised stakes (audience upgraded, window tightened, constraint added) —
generated as a variant, labelled "Overload rep". Escalation never appears before the user
has one successful implementation attempt.

## Consequences
- `RecordButton`/`RepSurface` need a window-display mode (count-up + target band) alongside
  the existing countdown; countdown becomes constraint-conditional.
- Exercise Framework schema (Phase 2.2) gains `constraintTypes[]` + `responseWindowSec
  {min,max}` + `overloadVariants` rules.
- Scoring prompt gains the active constraint block; deterministic time-budget signal reads
  the window, not a fixed budget.
