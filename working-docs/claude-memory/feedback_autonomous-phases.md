---
name: autonomous-phase-execution
description: "For multi-phase build plans (e.g. plans/muscle-group-pivot-progress.md), execute all phases without consulting Max except on real blockers"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c556d393-a463-4db7-98d7-b742c59f8eb0
---

When working through a planned multi-phase build (a `plans/*-progress.md` tracker file), execute every phase end-to-end without pausing for sign-off between phases. Only stop and consult Max on **real blockers** — not on judgment calls Claude can reasonably make.

**Why:** Max explicitly said "for all phases only consult me if you hit a blocker, otherwise keep building" during the muscle-group pivot kickoff (2026-05-21). Pre-planned trackers already capture the design decisions; pausing between phases for "are we good?" check-ins is noise. Max will redirect via interrupt if he wants to step in.

**How to apply:**
- After completing a phase: commit cleanly with a per-phase commit message, update the tracker status `[ ]` → `[x]`, then start the next phase in the same session.
- Run the phase's own Definition-of-Done + Checkpoint Protocol as a self-check, not as a stop-and-ask.
- Verification runs (typecheck, tests, lint, calibration harness) execute automatically; failures get fixed, not surfaced as questions.
- Pre-planned scope choices in the tracker are authoritative — don't re-litigate them mid-build.

**Real blockers that DO warrant pausing:**
- External-credential failure (Anthropic credit, OpenAI key, Supabase auth, Vercel env)
- Calibration drift exceeds tolerance (composite ±5 or dim ±8 on >1 of 10 reps) — would silently degrade product
- A discovery that reshapes ≥2 downstream phases (e.g., Phase 7 finds the chosen state machine can't model pause-during-walking; would invalidate Phase 5's hook contract)
- Destructive action with non-trivial blast radius (force-push, schema drop, deleting >50 LoC of legitimate code)
- Scope ambiguity that the tracker + brief don't resolve (rare — most are resolved in the decisions log)

**Not blockers (just decide and proceed):**
- "Should this be a hook or a server action?" — pick one based on existing patterns, document in commit msg
- "This phase needs an extra small file I didn't list" — add it, note in commit msg
- "Test fixture is missing" — create it
- "The DoD has 8 items, I've done 7, item 8 is a 'nice to have'" — finish all 8 or note explicitly why deferred

**Communication shape during autonomous runs:**
- Brief status updates per phase completion (1-2 sentences: what shipped, what's next)
- Save the wall-of-text retrospective for the end OR for actual blockers
- If a phase opens up an idea worth Max's input but isn't blocking, queue it in a `plans/*-followups.md` file rather than interrupting flow
