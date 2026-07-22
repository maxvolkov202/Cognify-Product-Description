---
name: tokens-over-rework
description: Max would rather spend more tokens building things correctly the first time than re-iterate. Prefer thoroughness over thrift.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c556d393-a463-4db7-98d7-b742c59f8eb0
---

When building features for Max, default to thoroughness over token-economy. Don't truncate scope, skip edge cases, or defer "nice-to-haves" implied by the spec just to keep responses short.

**Why:** Max said verbatim during the muscle-group pivot Phase 3 build (2026-05-21): "I would much rather spend more on tokens and do it properly than reiterate." Iteration cycles cost more in Max's calendar than they save in tokens, and rework introduces drift in voice/quality. This is a stronger signal than the default "be concise" instruction — when there's tension, this wins.

**How to apply:**
- **Authoring tasks:** when content needs to be high quality (manifests, copy, prompt banks, fixture data), invest in the authoring pass instead of placeholder-then-revise. Author it properly the first time.
- **Tests:** write tests that cover the edge cases the spec implies, not just the happy path. A 12-assertion test suite beats a 4-assertion one if both cost the same wall-clock.
- **Edge handling:** the spec's "Risks + what could derail" bullets and out-of-scope clarifications are still authoritative. Build defenses for the named risks in-line.
- **Parallel agents:** when authoring a large body of content (a prompt bank, copy across surfaces, fixtures across dimensions), spawn parallel sub-agents liberally rather than serializing. The cost is amortized; the wall-time gain is real.
- **Refactors mid-phase:** if a "judgment call" left a gap (like a missing FK on the Drizzle side because of declaration order), fix it before committing the phase. Don't ship the gap with a comment promising to fix later.
- **Document divergences:** when you deviate from the literal spec (e.g. directory layout, file naming), call it out in the commit message + plan tracker so Max sees the divergence and can redirect cheaply.

**Communication shape:**
- The verbosity preference applies to the **product** (code, tests, docs), NOT to chat responses. Keep status updates short — but ship full, well-tested code underneath. Chat brevity ≠ implementation shortcuts.

**This composes with [[autonomous-phase-execution]]:** autonomous mode says "don't pause for sign-off mid-phase." This rule says "but DO go deep on each phase before moving on." Together: build each phase thoroughly + autonomously, then move to the next without a checkpoint.
