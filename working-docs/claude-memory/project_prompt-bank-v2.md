---
name: project-prompt-bank-v2
description: Deferred plan (2026-07-21) to rebuild the prompt bank as composition + continuous replenishment; full plan file + measured findings
metadata: 
  node_type: memory
  type: project
  originSessionId: 0cbc8b30-f91e-4bc9-a971-fac1ab9ba991
  modified: 2026-07-21T21:21:45.678Z
---

Prompt Bank v2 — designed 2026-07-21, **deferred by Max, not started, no code touched**.

Full 6-phase plan: `C:\Users\MaxVolkov\.claude-personal\plans\breezy-shimmying-kay.md`
Supporting write-ups in Max's Downloads: `cognify-prompt-bank.md` (bank inventory),
`cognify-prompt-generation-guardrails.md` (AI fallback logic + canon rules).
Source doc used: `C:\Users\MaxVolkov\Downloads\Cognify System Change.md` (§5.6, §8.5, §9.1-9.4.2, §11.3).

**Why:** the System Change doc specifies Exercise Frameworks + generated prompts and says "the user
should never feel like Cognify is pulling exercises from a library" (§8.5.3). We built the inverse —
a static library with AI as an emergency patch. Scope was general tier only; vertical deferred.

**Non-obvious findings that took measurement to reach (re-verify before acting, code moves):**

- The general tier holds exactly **20 prompts per exercise**, slate = 5 → **four refreshes exhausts
  it in one session**. That's the refresh button working as built.
- **`diversifySlateTags` (`src/server/lib/workout/assignment.ts:932`) is a guaranteed no-op for the
  general tier.** It diversifies on `tags`, and all 1,080 general prompts carry exactly one tag,
  `["general"]` — so every slate member is `redundant` and no candidate can add an unseen tag. The
  §9.4.1 diversity mechanism is built, tested, and inert. Adding a `topic:<category>` tag activates
  existing code rather than needing new selection logic. **This is the cheapest high-leverage fix.**
- The canon judge is instructed to judge prompts **independently**, so set-level monotony is
  invisible to our only quality gate, by construction.
- Measured general-bank skew: relationships 28.9%, tech 3.9%, current events 1.2%, sports 0.5%.
  Difficulty 30/50/20 — the exact split `docs/prompt-design-canon.md` explicitly repudiates (target
  50/40/10). 24 cross-exercise near-dupes (one at Jaccard 1.00) because dedupe is per-exercise only.
  Voice drift: "Tell us" x99 vs "Tell me" x31.
- Universality was enforced so hard the topic space collapsed into introspection. Prompts pass the
  3-second test and fail "I want to answer this."

**How to apply:** if resumed, Phase 1 (topic tagging) is standalone and unlocks the dormant
diversity pass. The design fork Max chose was **hybrid** — composable shapes x topic pool for
formula-shaped exercises, AI generation for the rest — with composed prompts materialized into
`exercise_prompts` on first serve so nothing downstream changes. Open risk: slot typing
(concept/position/decision/experience) is unsettled and needs design time with Max.
Related: [[project-system-change-v2]], [[feedback-combine-ideas]].
