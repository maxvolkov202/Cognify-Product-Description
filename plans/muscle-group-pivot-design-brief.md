# Muscle-Group Pivot — Design Brief

> Shared context for every phase-spec agent. After all specs return,
> this file is rolled into the decisions log at the bottom of
> `plans/muscle-group-pivot-progress.md`.

---

## The pivot in one paragraph

The Daily Workout becomes a **"brain-gym muscle group per DAY"** product. Each day, one muscle group (= one of the 6 dimensions — Clarity, Structure, Conciseness, Thinking Quality, Pacing, Tone) is trained via **4 exercises** randomly sampled from that muscle group's catalog. Each exercise owns a **prompt bank**; the user picks one prompt per rep. A **brain mascot** (with legs, headband, dumbbells) walks between 4 exercise stations on the top half of the screen as the user completes each rep. **Skill Lab stays as a parallel freeform tool** — the daily Workout must feel uniquely different from Skill Lab.

The progression narrative comes from rotation: when Clarity rolls around again ~6 days later, the user sees whether they improved on their last Clarity day.

---

## Non-negotiable constraints

- Must be convertible to a mobile app — touch-first, no hover-only affordances, React Native / Capacitor / PWA-ready
- Fully scoped + production-ready when shipped — no half-finished features in the merge target
- Don't bolt onto the RAG/scoring overhaul (just merged on `feat/openai-fallback`). This is a layer on top.
- Calibration tuning continues independently via `/ops/calibration/drift` + Promote-to-bank — do not fold that into this plan
- Exercise catalog from DNA doc is v1; gap-fill Tone + Pacing to match Clarity's 9-exercise floor but don't over-author
- New tables live in the `cognify_v2` schema namespace (v1→v2 migration is complete)

---

## Decided — UI signature

- **TOP HALF** of screen: animated mascot moving between 4 stations laid out horizontally. Stations transition: `locked → current (mascot here) → complete`.
- **BOTTOM HALF**: start-workout button before session; during/between reps it becomes the rep controls (prompt selector, start recording, transcript preview, score reveal).
- **Mascot states** (minimum): `idle` (pre-workout), `walking-to-next-station` (between reps), `at-station` (during rep), `celebrating` (workout complete). Optional: `stumbling` / `sweating` / `flexing` for personality.
- **Engine: Rive (rive.app).** One `.riv` asset, ~50KB. Designer rigs the character in Rive Editor; runtime triggers state transitions from rep-completion events. Free for our use, native RN support.
- **Respect `prefers-reduced-motion`**: still-frame fallback per state.

---

## Exercise catalog (DNA doc v1 floor — gap-fill to ~9 per dim during Phase 2)

- **Clarity** (9): Explain Like I'm 12, Headline First, The Analogy Bridge, No Jargon Allowed, Make It Real, One Point Only, Answer the Confusion, Prove It, The Word Budget
- **Structure** (5 → 9): The 3 Point Rule, The Story Arc, Bottom Line First, The Problem Solution Frame, Monroe's Motivated Sequence
- **Conciseness** (5 → 9): The 30 Second Rule, Kill the Filler, No Hedging, One Idea Per Response, The Hard Stop
- **Thinking Quality** (6 → 9): The Claim and Proof, The Steel Man, First Principles, The So What Test, The Perspective Shift, Draw the Line
- **Pacing** (3 → 9): Metronome, Strategic Pause, Silence Over Filler
- **Tone** (5 → 9): The Monotone Breaker, Volume Dial, Warmth Switch, Authority Voice, Downward Landing

~20 prompts per exercise is the v1 floor; expand long-term per Max's instruction.

---

## Vocabulary

- **Muscle group** = dimension (Clarity, Structure, etc.)
- **Exercise** = named drill within the dimension
- **Rep** = single execution (one prompt + recording + scoring)
- **Muscle group day** = a calendar day on which one muscle group is trained (4 reps + optional graduation rep)
- **Workout session** = the live runtime traversal of a muscle group day
- **Station** = visual representation of one of the 4 exercises in the day; where the mascot stands during that rep

---

## Design decisions (auto-mode calls — surface in plan's decision log so Max can redirect)

### Q1 — Session shape per day
**4 reps stacked into one continuous session, but pause-and-resumable (same day).** 4 is the default ceiling; user can shorten to 2 or 3 in settings. Continuous flow matches the "go to the gym" feel; resumability respects mobile life.

### Q2 — Streak / completion
**1 of 4 reps preserves the streak** ("showed up"). **4 of 4 = full muscle group day complete** (sets baseline + unlocks achievement). Missed day = streak resets unless streak-freeze (existing mechanic) is consumed. **Muscle group rotation does not pause** — if Wednesday's Clarity day is missed, Clarity rolls back around in ~6 days regardless.

### Q3 — Rotation cadence
**Hybrid** — system suggests next muscle group by lowest recent dim score (weakest-first nudge); user can override on the day-start screen before starting. Round-robin floor: same muscle group rolls around every **6 days** minimum so all 6 dims hit weekly. May surface earlier if a dim regresses sharply.

### Q4 — Progress surface
**All three, staged:**
- (a) Banner on day-start screen ("Last Clarity day: composite 64 — beat it") — primary touchpoint
- (b) End-of-day retrospective (per-dim delta vs last Clarity day)
- (c) Standalone `/progress/muscle-groups` view (per-dim timeline of all days)

### Q5 — Relationship to current modes
**Daily Workout owns its own shape** (4 reps + optional graduation pressure rep). Focus / combined / flow / scenario modes live in **Skill Lab** as user-chosen session shapes. Pressure mode appears in two places: (a) optional graduation rep at the end of a Workout day, (b) Skill Lab session shape. The overlap is intentional.

### Q6 — Skill Lab boundary
Skill Lab keeps: framework-builder, scenario practice, pressure archetypes, "give me a random rep", custom prompts, build-a-rep. Skill Lab does NOT have muscle-group structure, mascot, or 4-rep day shape. Shared primitive: **single rep recording + scoring extracted into a session-runner module both products consume.**

### Q7 — Schema appetite
**Full migration.** New `cognify_v2` tables: `exercises`, `exercise_prompts`, `muscle_group_days`, `workout_sessions`, `exercise_engagement`. `reps` gets nullable `exercise_id` + `muscle_group_day_id` FKs. Overlay JSON was rejected because rotation + retrospective views need queryable structured data.

---

## Existing surfaces to reference in specs

- `src/app/(app)/workout/page.tsx` — current Daily Workout entry (to be replaced)
- `src/app/(app)/skill-lab/page.tsx` + `src/app/(app)/skill-lab/[dimension]/exemplars/page.tsx` — Skill Lab
- `src/app/(app)/progress/page.tsx` + `/progress/month/[yyyyMm]` + `/progress/rep/[repId]`
- `src/app/(app)/build-a-rep/page.tsx`, `src/app/(app)/scenario/page.tsx`
- `src/server/actions/sessions.ts`, `src/server/actions/reps.ts`, `src/server/actions/baseline.ts`
- `src/lib/scoring/{deterministic.ts, rubric.ts, rubric-anchors.ts, framework-profiles.ts, dimension-aliases.ts, telemetry.ts}`
- `src/lib/ai/score.ts`, `src/lib/ai/score-stages.ts` (Stage 1 + Stage 2 scoring entry)
- `src/lib/ai/rag/retrieve.ts` (RAG, Phase 4 from prior overhaul)
- `src/lib/db/schema.ts` (Drizzle schema; new tables go in `cognify_v2` namespace)
- `drizzle/migrations/*` (next new migration starts at `0020`)
- `src/components/product/feedback/*` (DimensionCard, OptimisticDimensionPreview, FeedbackSkeleton)
- `scripts/calibration/reference-reps.json` (48 calibrated reps for harness)
- `scripts/seed-reference-bank.mjs` (existing seed-script pattern)

---

## Spec output format

Every phase agent returns markdown matching this exact shape:

```
## Phase N — <title>

**Goal:** (1-2 sentences)

**In scope:**
- bullets

**Out of scope:**
- bullets (explicit)

**Schema changes:**
DDL stubs (or "none")

**Code/component changes:**
filenames + what changes

**Copy / voice considerations:**
...

**Mobile-app conversion considerations:**
...

**Telemetry / observability:**
...

**Definition-of-done:**
- [ ] checkbox list

**Checkpoint protocol:**
What Max verifies before signing off

**Risks + what could derail the phase:**
- bullets
```

Target length per phase: **400-800 words.** Cite real cognify file paths + exercise names from the catalog above where relevant. Preserve Cognify's voice (encouraging, specific, no fluff).

---

## Appendix — 10 mascot voice samples (Max-approved, 2026-05-21)

Reference tone for Phase 13's `voice.ts` full file. Use these as the anchor when authoring variations.

| Bucket | Sample line |
|---|---|
| `idleGreeting` (morning) | "Morning. Headband's on. Let's go." |
| `walkingComments` (strong-rep, between stations) | "That landed. Walking it off." |
| `walkingComments` (weak-rep, between stations) | "Reset. Next station's a different shape." |
| `atStationIntro` — Headline First | "Headline First — bury the lede and we're done." |
| `scoreReactions` excellent (90+) | "Clean. That's the rep, Max." |
| `scoreReactions` poor (<50) | "Rough one. Filed under research, not failure." |
| `dayCompleteCelebration` breakthrough (+15 vs last) | "Composite 79 — beat last Clarity by 15. Compounding." |
| `dayCompleteCelebration` regression (−8 vs last) | "Down a few from last time. Tomorrow's a different muscle. Walk it off." |
| `freezeConsumed` | "Used a freeze. Streak's safe. Today's Conciseness." |
| `errorFallback` (scoring failure) | "Scoring hiccup. Counting it as a rep. Don't lose momentum." |

Rules embodied: ≤12 words per bubble, specific over vague, dry not cheery, no exclamation-mark spam, first-name once in 10 (line 5).
