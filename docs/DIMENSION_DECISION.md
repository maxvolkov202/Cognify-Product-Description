# Dimension Naming — Decision Doc (WS-1)

> **Purpose:** Decide the canonical names for Cognify's six communication components before WS-3/4/5/6 engineering begins. Once approved, drives a 1-day refactor.
>
> **Owner:** Max (engineering CTO) · **Approvers:** Hunter + advisors (Hupe, Nahamoo optional touchpoint)
>
> **Decision deadline:** 2026-04-28 (so WS-1 Phase 1.2 can land before WS-2 completes)

---

## 1. The conflict in one paragraph

The strategy docs (`Cognify Direction.md`, `Cognify Strategic Update.md`) and the V2 Updates mockups name the six components as **Clarity · Structure · Conciseness · Thinking Quality · Delivery · Adaptability**. The current scoring code (`src/lib/scoring/rubric.ts`, `RUBRIC_VERSION v2-beta.2`) uses **Clarity · Structure · Relevance · Confidence · Pacing · Tone**. Three of the six don't map cleanly. Every downstream surface — the new bottom 6-skills bar, feedback callouts, per-rep labels, dashboard, monthly report, marketing — depends on which name set wins.

---

## 2. Side-by-side

| Strategy docs + mockups (proposed canonical) | Current code                                   | Relationship / note                                                    |
| -------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| **Clarity**                                  | `clarity`                                      | ✅ Match. No change.                                                    |
| **Structure**                                | `structure`                                    | ✅ Match. No change.                                                    |
| **Conciseness**                              | *(absent)*                                     | ⚠️ New. Currently folded into `pacing` via filler/WPM signals.          |
| **Thinking Quality**                         | `confidence`                                   | ⚠️ Mismatch. Confidence is narrower (composure) — Thinking Quality includes generation coherence, recall speed, logical chain. |
| **Delivery**                                 | `pacing`                                       | ⚠️ Mismatch. Pacing is narrower — Delivery includes pacing, pauses, tone-in-voice, vocal energy. |
| **Adaptability**                             | `tone`                                         | ⚠️ Mismatch. Tone is narrower — Adaptability includes audience calibration, mid-rep adjustment, reframe ability. |
| *(absent in strategy docs)*                  | `relevance`                                    | 🟡 Orphan. Currently a full dimension; strategy docs don't name it.     |

---

## 3. Recommended path (CTO view)

**Adopt the strategy-doc names** for all user-facing surfaces. Keep existing deterministic signals (filler rate, WPM variance, pause rate, restart count) — just **remap which dimension each signal feeds**. Treat `relevance` as an **internal gatekeeper flag** that floors composite to ≤40 when a rep is off-topic, rather than a surfaced dimension.

**Why this path:**
- Mockups already publish these names; fighting it means rework + advisor confusion
- Semantic weight matches the strategic narrative (Tim Tebow / pressure / thinking under stress) — "Thinking Quality" carries that story; "Confidence" doesn't
- Consumer vocabulary: "Conciseness" and "Adaptability" are words normal users recognize; "Tone" and "Relevance" are borderline jargon
- The Content / Delivery grouping survives with a clean remap (see §4)
- No user data loss — historical reps keep their old rubric version via `RUBRIC_VERSION` discipline

**What we pay:**
- ~1 day of refactor across `rubric.ts`, `score.ts`, `rep-types.ts`, and every component rendering a dimension label
- One-time in-app note to existing users ("We renamed the dimensions — your past scores are unchanged.")
- Deterministic signal remapping (not rewriting — just which dimension each signal feeds)

---

## 4. The proposed new rubric structure

```ts
// src/lib/scoring/rubric.ts (proposed v2.0.0)

export const RUBRIC_VERSION = "v2.0.0";

export type SkillDimension =
  | "clarity"
  | "structure"
  | "conciseness"
  | "thinking_quality"
  | "delivery"
  | "adaptability";

export const CONTENT_DIMENSIONS: readonly SkillDimension[] = [
  "clarity",
  "structure",
  "conciseness",
];

export const DELIVERY_DIMENSIONS: readonly SkillDimension[] = [
  "thinking_quality",
  "delivery",
  "adaptability",
];
```

### Proposed definitions (one paragraph each)

- **Clarity** — Ideas land on the first hearing. No ambiguity. Concrete language, audience-appropriate vocabulary, resolved pronouns, main point stated early. The listener doesn't have to re-interpret.
- **Structure** — Visible scaffolding. A clear opening that establishes direction, logical flow connected by transitions, and a close that reinforces the point. Consistent ordering (chronological, causal, or importance).
- **Conciseness** — Maximum signal per word. Low filler rate, low hedge rate, no repetition, words-per-point discipline, within time budget. Tight sentences over bloated ones.
- **Thinking Quality** — Coherent generation under real-time conditions. Low backtrack count, low mid-sentence restart rate, logical chain holds, recall feels sharp. Distinct from composure — this measures the *content* of thinking, not the vocal delivery of it.
- **Delivery** — How it sounds. Pacing (stable WPM, purposeful pauses), rhythm, vocal energy, finishing cleanly within time. Absorbs what was `pacing` + the vocal side of `tone`.
- **Adaptability** — Calibration to audience, constraints, and mid-rep cues. Register shifts for different listeners, mid-rep adjustment when pushback or audience switch happens, staying responsive under deviation from the planned path. Absorbs what was the semantic side of `tone` + what the strategy docs meant by "adaptability".

### Proposed signal → dimension mapping

| Deterministic signal                    | Old dimension fed | New dimension fed     | Note                              |
| --------------------------------------- | ----------------- | --------------------- | --------------------------------- |
| Filler rate (um, uh, like)              | `pacing`          | `delivery`            | Filler is a delivery tell.        |
| Hedge rate (I think, maybe, sort of)    | `confidence`      | `thinking_quality`    | Hedging = weak generation.        |
| WPM variance                            | `pacing`          | `delivery`            | Stable WPM = delivery control.    |
| Mid-sentence restart count              | `confidence`      | `thinking_quality`    | Restart = thought mis-fire.       |
| Backtrack count                         | `confidence`      | `thinking_quality`    | Same.                             |
| Over/under time budget                  | `pacing`          | `conciseness`         | Conciseness owns time discipline. |
| Pause distribution (purposeful vs panic) | `pacing`         | `delivery`            | Pauses are delivery craft.        |
| Pronoun resolution (LLM)                | `clarity`         | `clarity`             | No change.                        |
| Concrete-vs-abstract ratio (LLM)        | `clarity`         | `clarity`             | No change.                        |
| Framework-node adherence (LLM)          | `structure`       | `structure`           | No change.                        |
| Opening/closing presence (LLM)          | `structure`       | `structure`           | No change.                        |
| Words-per-point (derived)               | *(new)*           | `conciseness`         | New signal powering Conciseness.  |
| Repetition rate (transcript)            | *(new)*           | `conciseness`         | Same.                             |
| Register-match (LLM vs audience)        | `tone`            | `adaptability`        | Adapt to audience.                |
| Mid-rep adjustment (LLM)                | *(advanced)*      | `adaptability`        | Keep as advanced signal.          |
| Relevance: on-topic check (LLM)         | `relevance` (dim) | *(internal gate only)* | No longer a surfaced score.       |

---

## 5. Decisions requested

Approve / reject / modify each below. Anything not explicitly approved stays in "recommendation" state.

### D1 · The name set
- [ ] ✅ **Approve strategy-doc names** (Clarity / Structure / Conciseness / Thinking Quality / Delivery / Adaptability) — **recommended**
- [ ] ❌ Push back to strategy team for the current code names
- [ ] ✏️ Modify (specify): _____________

### D2 · Fate of `relevance`
- [ ] ✅ **Keep as internal gatekeeper** — floors composite to ≤40 if off-topic; hidden from user-facing UI — **recommended**
- [ ] ❌ Drop entirely (no off-topic protection)
- [ ] ✏️ Keep as visible 7th dimension (adds surface area but stays honest)
- [ ] ✏️ Modify (specify): _____________

### D3 · Content / Delivery grouping
- [ ] ✅ **Keep grouping**, re-mapped: Content = {Clarity, Structure, Conciseness}; Delivery = {Thinking Quality, Delivery, Adaptability} — **recommended**
- [ ] ❌ Drop the grouping entirely
- [ ] ✏️ Different grouping: _____________

### D4 · User communication
- [ ] ✅ **One-time in-app note on next login** + line in monthly report (labels changed, scores unchanged) — **recommended**
- [ ] ❌ No announcement
- [ ] ✏️ Email instead of in-app
- [ ] ✏️ Modify (specify): _____________

### D5 · Advisor confirmation
- [ ] ✅ Max + Hunter sign alone (no advisor call needed for naming)
- [ ] ✏️ Pass by Hupe + Nahamoo on next advisor call before locking — **recommended if one's on calendar within a week**
- [ ] ❌ Block on advisor sign-off

---

## 6. If approved — execution clock

Day 0: This doc approved
Day 1: Refactor `rubric.ts`, `domain.ts`, `rep-types.ts`, `score.ts`, `signals.ts`. Add `dimension-aliases.ts` for historical reads.
Day 2: UI label sweep across `src/components/product/*`. One-time in-app note copy.
Day 3: Verification — 5 canonical transcripts scored old vs new; composite within ±3; typecheck + lint clean.
Day 4: Ship PR to `supabase-migration`. Begin WS-2 in parallel.

---

## 7. Out of scope for this decision

- Any scoring *signal* changes (filler-word list, pacing thresholds, etc.) — that's future rubric iteration
- Per-user custom weights (possible future; not needed now)
- Multi-language dimension definitions (English only for V2)
- Re-scoring historical reps under the new rubric (they stay tagged with `v2-beta.2`)

---

## 8. Questions from strategy team (collect here before sign-off)

<!-- Add questions during review; answer inline -->

- _Q: (Hunter) ___________ ·  A: ___________
- _Q: (Hupe) _____________ ·  A: ___________
- _Q: (Nahamoo) __________ ·  A: ___________
