# Proposal: Session Types — Focus / Combined / Flow (WS-6)

> **Status:** In progress. Implementation on branch `feat/gym-core`.
>
> **Summary:** Three explicit session types selectable from the Daily Workout home page, each with its own orchestrator. **Focus Workout** drills one dimension. **Combined Workout** is the existing goal-weighted mix (the default). **Flow Session** is new — a 5-rep chain with compressed feedback and a pressure ramp that walks the user through all five pressure archetypes in sequence.
>
> **Why this matters:** Per `Cognify Direction.md`, the three session types are named as first-class features with distinct training benefits. Flow Session specifically trains *recall speed and composure under sustained pressure* — the Nahamoo vector we haven't addressed yet.
>
> **Pairs:** `docs/V2_STRATEGIC_PLAN.md` WS-6 · `docs/proposals/pressure-system.md` (Flow shares the archetype catalog).

---

## 1. What each type trains

### Focus Workout — depth over breadth
- 4–5 reps, **all sharing the same primary dimension**.
- Rep types are filtered to those whose `primaryDimension` matches the user's pick (or those with it as a secondary if not enough primaries exist).
- Pressure rep at N-1 (same Build → Stress → Reinforce arc) with an archetype that stresses the focus dimension.
- User-facing framing: "Clarity Day", "Structure Day", etc. Pick the muscle, drill it.

### Combined Workout — the current default
- 4–5 reps across mixed rep types, goal-weighted (existing behavior from `planTodaysWorkout`).
- Pressure rep at N-1.
- Good for general daily practice; covers multiple dimensions in one session.

### Flow Session — recall speed under sustained pressure
- **Always 5 reps**, chained with compressed feedback.
- Every rep is a pressure rep — the session walks through all 5 archetypes in a specific order that ramps intensity.
- Between reps: 1-sentence feedback + 3-second auto-advance. No full feedback panel until the session end.
- End-of-session recap: the normal FeedbackPanel surfacing all 5 reps' callouts + a trajectory chart.
- User-facing framing: "Flow" — borrowed from deliberate-practice literature and climbing/sports flow state.

## 2. Flow Session pressure ramp

The 5 archetypes are ordered by cognitive-load difficulty:

| Rep | Archetype | Why here |
|---|---|---|
| 1 | Time Compression | Easy entry — constraint is clear. User warms into compressed thinking. |
| 2 | Audience Switch | Harder — register shift + substance preservation. Good warm-up for full pressure. |
| 3 | Pushback | Mid-session — user responds to a specific objection. Requires acknowledgement + redirect. |
| 4 | Clarifying Interrupt | High cognitive load — recovery mid-explanation. |
| 5 | Stakes Raise | Final — no mechanical trick, just sustained composure. Full weight of the session landing here. |

This is deliberate. Research on deliberate practice suggests gradual intensity ramps produce better retention than constant-difficulty or random-order drills. The first archetypes train mechanical pressure (compression, reframing), the middle train responsive pressure (pushback, interrupt), and the finale tests composure under framing pressure with no mechanical escape.

## 3. Orchestrator APIs

```ts
// New (planFocusWorkout)
planFocusWorkout(opts: {
  focusDimension: SkillDimension;
  count?: number; // default 4
  goals?: readonly ImprovementGoalId[];
  recentFrameworkNames?: readonly string[];
  previousPressureArchetypeId?: PressureArchetypeId | null;
}): WorkoutSessionPlan

// New (planFlowSession)
planFlowSession(opts?: {
  recentFrameworkNames?: readonly string[];
}): WorkoutSessionPlan
// Always 5 reps, all pressure, archetypes in the fixed ramp order.

// Existing — renamed conceptually as "Combined" but API unchanged
planTodaysWorkout(opts: ...): WorkoutSessionPlan
// This is Combined Workout's orchestrator. WorkoutSessionPlan.sessionType
// will be 'combined' when built via this path.
```

All three produce `WorkoutSessionPlan` with a new `sessionType` field identifying which orchestrator produced it. Downstream components can branch on it (FeedbackPanel vs FlowFeedbackPanel, analytics splits, UI chrome).

## 4. Schema

```ts
// types.ts addition
export type SessionType = "focus" | "combined" | "flow";

// WorkoutSessionPlan gets:
{
  id: string;
  reps: WorkoutRepSlot[];
  estimatedDurationSec: number;
  sessionType: SessionType;      // NEW
  focusDimension?: SkillDimension; // NEW, only set for focus
}
```

**DB migration (deferred):** a `sessionType` enum column on `workout_sessions` so historical analytics can split by type. Not blocking the v1 ship — in-memory attribute is enough until we want longitudinal analytics.

## 5. UI

### Daily Workout Home (workout/page.tsx)

Above the existing intro (`WorkoutIntro`), add a `SessionTypeChip` group — three chips in a row: Focus / Combined (default) / Flow. User taps one to change the session type. The intro content below updates to reflect the chosen type's estimated duration, rep count, and description.

For Focus: after picking Focus, show a dimension picker (6 chips, one per dimension) before the intro updates.

### Prompt-select per rep

No change. Existing screen works for all three types — pressure reps within Flow already show the `PressureRepIndicator` from WS-3.

### Rep surface during recording

No change. Calm is calm regardless of session type.

### Feedback between reps

- **Focus + Combined:** full `FeedbackPanel` (existing behavior).
- **Flow:** new `FlowFeedbackPanel` component. Single sentence + dimension callout tag. Auto-advances after 3 seconds (user can tap to advance sooner). Visually compressed — ~1/3 the height of the full panel.

### End-of-session

- **Focus + Combined:** existing `WorkoutEnd` component.
- **Flow:** same `WorkoutEnd` but with a "Flow recap" section showing: the 5-archetype trajectory as a mini timeline, each rep's composite + top dimension callout, the pressure-handling average across the 5 reps.

## 6. Default type selection

- New user: Combined (safest entry — mixed dimensions, pressure rep once, familiar feedback).
- Returning user: the type they picked last (stored in localStorage — same pattern as `pause.ts`).
- "Suggest Focus on your weakest dimension" nudge: if the user has trended a single dimension ≥ 10 points below their overall composite for a week, the home page shows a "Focus day recommended" prompt above the chip picker. (Shipping in a follow-up; not Phase 6.1.)

## 7. Out of scope (explicit)

- Multiplayer flow (Live Fire Rooms — backlog).
- User-scheduled session types ("I'll do Flow on Thursday") — reactive, not calendar-based.
- Flow Session with <5 reps — always 5.
- Per-archetype opt-out within Flow — the whole point is to walk the ramp.
- Cross-session streak of Flow reps (separate feature, future).

## 8. Risks + mitigations

- **R1** Flow's 3-second auto-advance feels rushed or confusing. **Mitigation:** keyboard/tap advance is always available. 5-user test after ship; tune the delay.
- **R2** Focus Workout's rep-type filter leaves too few candidates (some dimensions only have 1 rep type as primary). **Mitigation:** fall back to reps with the dimension as secondary; beyond that, repeat rep types with different prompts.
- **R3** Users pick Flow early and burn out. **Mitigation:** Flow only unlocks after user has completed 3 sessions (soft gate via UI disable — orchestrator accepts Flow regardless, the gate is UI). Shipping in a follow-up; not Phase 6.1.
- **R4** Flow end-of-session recap is too dense after 5 rapid reps. **Mitigation:** big visual exhale moment — "You completed Flow" — then the recap appears below, not forced.

## 9. Apply order

1. `types` + `WorkoutSessionPlan.sessionType` field
2. `planFocusWorkout` in `workout-prompts.ts`
3. `planFlowSession` in `workout-prompts.ts`
4. Update `planTodaysWorkout` to tag its output with `sessionType: 'combined'`
5. `tests/session-types.test.ts` — Focus + Flow invariants
6. `SessionTypeChip` component
7. `FlowFeedbackPanel` component
8. Update `WorkoutSession` to route feedback by session type
9. Update `workout/page.tsx` to surface the chip picker + persist choice to localStorage
10. Deploy to `cognify-v2-neon.vercel.app`. Qualitative review of Flow timing with Hunter.
