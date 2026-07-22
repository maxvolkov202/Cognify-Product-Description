---
name: next-detailed-rubric-per-dimension
description: "After full-app audit merges, Max wants to deepen scoring by giving the LLM a richer per-dimension rubric. Each of the 6 core dimensions decomposes into sub-skills the model grades + feedback-narrates separately, so feedback is concrete (\"you lacked X within clarity\") instead of fluff."
metadata: 
  node_type: memory
  type: project
  originSessionId: 05874d44-5c1b-43e5-badf-fe405f2d48ac
---

**Status:** LARGELY SHIPPED as of the DNA chapter series (verified 2026-07-02 codebase survey):
36 canonical sub-skills across the 6 dimensions exist in `src/types/sub-skills.ts`, are scored
per rep (LLM + deterministic mapper), persisted in `dimension_scores.signals`, with EWA
running averages and a flag-gated UI (`FF_SUBSKILL_UI`). Remaining deepening work is absorbed
into the [[prd-v3-rebuild]] workstream (note: the new PRD wants sub-skills HIDDEN from users,
so SubSkillBreakdownCard surfacing gets retired, not expanded).
**Owner:** Max (product direction); Claude (implementation).

## Why

Current scoring returns a composite + 6 dimension scores + callouts. Max's
hypothesis: dimension-level feedback ("clarity = 72") is still fluffy
because it doesn't tell the user WHY clarity was 72 — which sub-skill of
clarity failed.

## Sketch of the idea

Each of the 6 dimensions is a parent skill. Inside each is a set of
grade-able sub-skills the LLM scores + narrates individually. Example:

- **Clarity** (parent): plain-language word choice / jargon-avoidance /
  audience-calibration / signposting.
- **Structure** (parent): opening hook / progressive disclosure /
  transition discipline / closing payoff.
- **Conciseness** (parent): filler-word density / sentence economy /
  redundancy / unnecessary qualifiers.
- **Thinking quality** (parent): claim-evidence pairing / counter-
  argument acknowledgment / logical step density / abstraction depth.
- **Delivery** (parent): pacing / volume modulation / pause discipline /
  filler-sound suppression. (Some of these are already deterministic
  via prosody — the model would aggregate + narrate.)
- **Tone** (parent): warmth / authority / appropriateness to audience /
  consistency.

The exact sub-skill list per dimension is a product call — Max wants to
shape this before we touch code.

## Existing scaffolding to reuse

- `src/lib/scoring/signals/sub-skill-mapper.ts` already exists.
- `dimension_scores.signals` JSONB column already stores
  `encodeDimensionSignals` output which has a `subSkillScores` field.
- `src/components/product/feedback/SubSkillBreakdownCard.tsx` already
  renders sub-skill breakdowns. (Audit DC-1 noted SkillsFocusContext
  half-uses this — the dashboard shows sub-skills when present.)
- Hot path: Wave 1 vertical prompts have a `subSkills` tag dimension on
  some prompts; the scoring path picks them up via the signals encoder.

So this isn't greenfield — there's a half-built sub-skill system already.
The deepening is (a) defining the canonical per-dim sub-skill taxonomy,
(b) updating the LLM prompt in `src/lib/ai/score.ts` to score each
sub-skill explicitly, (c) updating the feedback panel to surface
per-sub-skill copy, (d) backfill / cutover plan for old reps.

## Where to start when we get there

1. Audit current sub-skill plumbing end-to-end — what works, what's
   half-built, what's dead.
2. Max + Claude design the canonical sub-skill list (1-2hr workshop).
3. Update the scoring prompt + zod schema + dimension_scores.signals
   shape.
4. Update FeedbackPanel + SubSkillBreakdownCard to surface the new
   shape.
5. Rubric-version bump + backfill plan for existing reps (likely
   leave old reps at v3 composite-only and write v4 going forward).

## Out of scope for now

This memo is purely a placeholder. We finish the audit first.

Related memories: [[muscle-group-product-pivot]] · [[full-app-audit-fixes-2026-05-25]]
