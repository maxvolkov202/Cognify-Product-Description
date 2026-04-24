# Proposal: Pressure System (WS-3 Phase 3.1 – 3.5)

> **Status:** In progress. Implementation started 2026-04-23 on branch `feat/gym-core`.
>
> **Summary:** Make the Tim Tebow principle real. Every Daily Workout (4+ reps) includes exactly one **pressure rep** at the penultimate position — Build → Build → **Stress** → Reinforce. The pressure rep randomly draws from one of five archetypes with distinct mechanisms that stress specific dimension combinations. This is Cognify's moat against Yoodli/Speeko/Hyperbound.
>
> **Pairs:** `docs/V2_STRATEGIC_PLAN.md` WS-3 mini-plan · `docs/DIMENSION_DECISION.md` (scoring weights touch dimension names — acceptably independent per §6 here).

---

## 1. Why (source of requirement)

From `Cognify Strategic Update.md` and `Cognify Direction.md` (Hupe):

> "Cognify's value isn't just training communication. It's building habits strong enough to hold when it counts."

> "Despite intensive coaching, Tebow reverted to inferior mechanics the moment live game pressure arrived. The brain under stress abandons new pathways and defaults to old habits."

> "Every session must include at least ONE pressure rep."

The existing `handle_pressure` rep type is a pushback drill — it's *one* type of pressure. The strategy docs ask for a **structural guarantee** that every session includes pressure, with enough variety that the user doesn't habituate to a single archetype.

## 2. Design principles

1. **Structural, not optional.** The orchestrator places a pressure rep; users can't skip it by picking a different session type (though they pick between Focus/Combined/Flow — every type still gets pressure).
2. **Archetype variety.** Five distinct mechanisms exist so reps don't feel repetitive over a week of sessions.
3. **Minimal UI intrusion.** Pressure is signaled pre-start and in the post-rep feedback. During the rep itself the UI is calm — no flashing, no countdowns-within-countdowns. Pressure comes from the *prompt content*, not the chrome.
4. **Preserve the existing rep-type count.** 9 rep types stay 9. Pressure archetypes are *data on top of* the existing `handle_pressure` type, not new types.
5. **Scoring is archetype-aware.** Each archetype emphasizes specific dimensions — scoring weight profiles tilt toward those so the dimension's score genuinely reflects the archetype's stress.
6. **No new user settings.** Archetype selection is automatic. A future phase may expose "what archetype do you want to train" in Skill Lab mode, but not in v1.

## 3. The five archetypes

| Id | Name | Core mechanism | Stressed dimensions | Duration delta |
|---|---|---|---|---|
| `pushback` | Pushback | User makes a case; transcript prompt includes a disagreement at the end that the user must respond to inline. | thinking_quality, adaptability, confidence | 0 (normal) |
| `time_compression` | Time Compression | Normal setup but the constraint is *dramatic* — 15–20s to do what would normally take 60s. | conciseness, delivery, clarity | −30 to −45 sec |
| `audience_switch` | Audience Switch | Mid-rep the prompt says "now explain the same thing to [different audience]". User must reframe without losing substance. | adaptability, clarity, structure | +10 sec (more time, harder work) |
| `clarifying_interrupt` | Clarifying Interrupt | Prompt embeds a simulated interruption ("halfway through you'll hear: 'that doesn't make sense'"). User must acknowledge + recover without abandoning structure. | thinking_quality, structure, adaptability | 0 |
| `stakes_raise` | Stakes Raise | The prompt names the real consequence — "this is the moment that decides the offer/deal/promotion". Psychological pressure via framing, not mechanical. | confidence (composure), delivery, thinking_quality | 0 |

**Archetype selection per session:** random sampling with a per-user rotation bias (users don't see the same archetype back-to-back). Implementation: pick uniformly from the 5 archetypes, excluding the archetype used in the previous session if known.

## 4. Orchestrator rules (Build → Stress → Reinforce)

For a session of `N` reps (4 or 5):
- Positions `1..N-2`: build. Non-pressure reps using the normal `planTodaysWorkout` goal-weighted selection.
- Position `N-1`: **pressure rep**. Always `handle_pressure` rep type + a randomized archetype.
- Position `N`: reinforce. A non-pressure rep type that is well-suited to practicing back into calm execution (typically a clarity or structure rep).

Edge cases:
- `N < 4`: no pressure rep (not enough reps for the arc). Currently `count` defaults to 4, and the UI doesn't expose sessions below 4 reps.
- If `handle_pressure` was naturally picked by goal-weighting: keep it at position N-1, don't duplicate.
- User completes a session and does it again same day: re-runs get fresh archetype selection (avoid the one from the previous run).

## 5. Scoring weight profiles

Each archetype applies a weight override on top of the rep type's default weights:

```ts
// Example: pushback emphasizes thinking_quality + adaptability
pushback: {
  thinking_quality: 1.4, // (new rubric) — maps to confidence: 1.4 in v2-beta.2
  adaptability: 1.3,     // (new rubric) — maps to tone: 1.3 in v2-beta.2
  delivery: 1.0,
  clarity: 0.9,
  structure: 0.9,
  conciseness: 0.8,
}
```

Weights normalize to 1.0 average. Post-rep composite reflects archetype emphasis: a user who holds composure (thinking_quality) through a pushback gets more credit than one who was technically correct but shaky.

**WS-1 dependency note:** weight keys use current dimension names. After WS-1 signs off, a codemod updates keys in `pressure-archetypes.ts`. The structure is version-tagged via `WEIGHT_PROFILE_RUBRIC_VERSION` so historical reps keep their old weights.

## 6. Prompt authoring guidelines

Each prompt is a single string that combines setup + trigger. Examples:

**Pushback:** `"Pitch 'take on more technical debt to ship faster' to an engineering lead. When you're done they say: 'We did that two years ago and it cost us a whole quarter fixing it.' Respond."`

**Time Compression:** `"Your CEO asks why the launch is two weeks behind. You have 15 seconds to answer. No preamble."`

**Audience Switch:** `"Explain machine learning to a marketing intern. After 20 seconds, pivot — same idea, but now you're telling a senior ML researcher something they find genuinely new. 15 more seconds."`

**Clarifying Interrupt:** `"Walk me through how you'd handle a conflict with a coworker. Around 15 seconds in you'll hear: 'That doesn't address the root issue — try again.' Keep your structure. Recover."`

**Stakes Raise:** `"This is the interview question that decides whether you get the offer: 'Tell me about a time you failed.' 45 seconds."`

### Authoring rules
- Prompt must be concrete (name the setting, the audience, the stakes) — no abstract "talk about X".
- Interrupts and pushbacks must be specific and realistic. Use lines a user could plausibly hear.
- Time compression prompts must be ruthless — 15–30s max, named explicitly in the prompt.
- Audience switches must include both audiences by name + role.
- Stakes raises must name a tangible consequence (offer, promotion, renewal, trust with the team).
- Keep prompts vertical-aware where possible but lean on generalizable high-stakes situations that any professional can engage with.

### Count and coverage
- Minimum 8 prompts per archetype = 40 total.
- Each archetype covers ≥3 of these domains: sales, interview, exec brief, peer feedback, presentation, team conflict, negotiation.

## 7. UI spec

### Pre-start (WorkoutPromptSelect)
A compact `PressureRepIndicator` component appears when the current rep is a pressure rep:

```
┌─────────────────────────────────────────────┐
│ 🟠 PRESSURE REP · Pushback                  │
│ You'll make a case, then defend it under    │
│ disagreement. Hold structure.               │
└─────────────────────────────────────────────┘
```

- Warm amber accent (`amber-500`/`orange-500`) — distinct from the brand purple.
- Placed above the prompt list.
- Optional dismiss / acknowledge; the rep proceeds the same way.
- Accessible: `role="status"` / `aria-live="polite"`.

### During rep (RepSurface)
- **No change.** The rep surface stays calm. The pressure is in the prompt text, not the chrome.
- Optionally a 1-pixel warm accent on the brand-gradient stripe at the top of the prompt card (deferred to Phase 3.4 polish).

### Post rep (FeedbackPanel)
Archetype is surfaced in the "what you trained" summary tile:

> You trained: Thinking Quality + Adaptability (Pushback)

And at least one callout must reference the pressure mechanism, e.g. "Under the pushback, you acknowledged the objection in 6 words then redirected — that landed."

### Analytics (monthly report)
Separate "pressure performance" trend line on `/progress/month/[yyyyMm]`:

> Under pressure this month: 5 reps · avg composite 74 (+3 from last month) · best archetype: Clarifying Interrupt

## 8. Scope — what's in, what's out

**In this proposal (Phase 3.1–3.5):**
- `pressure-archetypes.ts` — catalog + types
- `prompts/pressure.ts` — 40+ prompts
- `RepType` schema extension (`isPressureType`, `pressureArchetype` runtime field)
- `handle_pressure` rep type promoted to pressure-aware
- `planTodaysWorkout` places pressure at position N-1
- Archetype selection at orchestration time
- `PressureRepIndicator.tsx` UI component
- Unit tests for orchestrator placement
- Weight profiles per archetype (applied to scoring composite)
- Pressure-aware feedback callout nudging

**Deferred (Phase 3.6+):**
- Pressure analytics on monthly report
- Pressure streak ("5 pressure reps in a row without bailing")
- User opt-in to train a specific archetype in Skill Lab
- Biometric / voice-stress signals (not planned)
- Live multi-user pressure (Live Fire Rooms — separate backlog)

## 9. Risks & mitigations

- **R1** Pressure feels gimmicky / adds anxiety rather than practice value. **Mitigation:** 5-user qualitative test after Phase 3.5 ships. If >40% say "cheap" or "stressful", tune prompt intensity + palette.
- **R2** Archetype selection produces same archetype 3 sessions in a row (bad random luck). **Mitigation:** exclude previous-session archetype from sampling. Further rotation later if users still complain.
- **R3** Scoring weight shift makes pressure reps consistently score lower → demotivates users. **Mitigation:** weights boost the dimensions the archetype stresses; they don't *lower* other dimensions. Composite is normalized. Additional: track pressure-rep average composite vs non-pressure composite in analytics — they should trend similarly with practice.
- **R4** WS-1 dimension rename invalidates weight profiles. **Mitigation:** `WEIGHT_PROFILE_RUBRIC_VERSION` tag + codemod at WS-1 apply time. Old reps keep their weights.
- **R5** Prompt bank feels generic / corporate. **Mitigation:** Hunter-approved tone pass before ship (authoring rules in §6 enforce concreteness).

## 10. Apply order (this implementation)

1. Write `src/lib/ai/pressure-archetypes.ts` — types + 5-archetype catalog + weight profiles
2. Write `src/lib/ai/prompts/pressure.ts` — 40+ prompts across the 5 archetypes
3. Update `src/lib/ai/rep-types.ts` — promote `handle_pressure` with `isPressureType: true` field
4. Update `src/lib/ai/workout-prompts.ts` — `planTodaysWorkout` places pressure rep; `selectPressureArchetype` helper
5. Write `tests/unit/workout/pressure-orchestrator.test.ts` — 100 plans pass spec
6. Build `src/components/product/PressureRepIndicator.tsx`
7. Wire indicator into `WorkoutPromptSelect` — show when `currentRep.pressureArchetype` is set
8. Update `FeedbackPanel` — surface archetype in "what you trained" (minimal change)
9. Ship behind flag `NEXT_PUBLIC_PRESSURE_SYSTEM=true` for prod, `true` in staging
10. Deploy to `cognify-v2-neon.vercel.app`. Get Hunter's eyes on the prompt tone before flipping prod.
