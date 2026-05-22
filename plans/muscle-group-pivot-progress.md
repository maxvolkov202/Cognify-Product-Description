# Muscle-Group Adventure-Path Pivot — Progress Tracker

> **Branch:** TBD `feat/muscle-group-pivot` (will be cut off `feat/openai-fallback` when Phase 1 starts)
> **Started:** planning 2026-05-21 — execution begins after Max approves this plan
> **Total phases:** 15 (data → catalog → engine → mascot system → shell → picker → runtime → scoring → progression → streak → Skill Lab refactor → mobile → copy → **mascot polish (Max-authored, deferred)** → verification + launch)
> **Goal:** Replace the legacy Daily Workout with a "brain-gym muscle group per DAY" adventure path. Each day = 4 exercise reps inside one of 6 dimensions, presided over by a brain mascot that walks between stations. Skill Lab stays as parallel freeform tool. Rotation drives the progression narrative ("you trained Clarity 6 days ago — beat it").
> **Mobile constraint:** every surface ships touch-first + Capacitor/PWA-ready. No hover-only affordances.
> **Production-ready constraint:** the merge target ships fully scoped — no half-finished features.
> **Voice:** mascot is encouraging, specific, never saccharine. ≤12 words per bubble.
> **Asset pipeline:** Claude builds the entire mascot animation system + placeholder character in Phase 4 (pure code, Framer Motion, no GUI tools). Max's only hands-on work is Phase 14 — designing the final character art in Figma and dropping SVG layers into the existing system. Phase 14 is OPTIONAL; if skipped, Phase 4's placeholder ships.

Read the design brief at [`plans/muscle-group-pivot-design-brief.md`](./muscle-group-pivot-design-brief.md) before picking up a phase. Each phase has a Goal, In/Out scope, Schema/Code changes, Mobile + Telemetry considerations, Definition-of-done, Checkpoint protocol, and Risks. The decision log at the bottom captures the Q1-Q7 product calls — flag any you want changed before Phase 1 starts.

---

## Phase status legend

- `[ ]` not started
- `[~]` in progress
- `[x]` complete, user-confirmed at checkpoint
- `[!]` blocked — see notes

---

## Phase 1 — Data model + Drizzle migration `[x]`

> **2026-05-21:** Migration `0020_muscle_group_pivot.sql` applied clean against dev DB; re-run is a NOTICE-only no-op. All 5 tables present in `cognify_v2`, all 4 new `reps` columns present, `workout_sessions_grad_rep_fk` constraint present. Drizzle column-level FKs wired via forward thunks (matching the existing `reps.frameworkId → frameworks` pattern); `muscleGroupDays.previousDayId` self-ref uses `AnyPgColumn` cast. `npx tsc --noEmit` clean, `npm run build` green. No app code imports the new exports yet.

**Goal:** Land the schema foundation for the muscle-group pivot: five new `cognify_v2` tables (`exercises`, `exercise_prompts`, `muscle_group_days`, `workout_sessions`, `exercise_engagement`) plus two nullable FKs on `reps`. Migration-only — no runtime code consumes the new tables yet. Drizzle types compile clean so Phase 2 can start typed.

**In scope:**
- New migration `drizzle/migrations/0020_muscle_group_pivot.sql` with idempotent DDL for all 5 tables + ALTERs on `reps`.
- Drizzle TypeScript mirrors in `src/lib/db/schema.ts` (table defs + minimal `relations()` blocks).
- Indexes on (`user_id`, `day_date`), (`muscle_group_day_id`), (`exercise_id`), and (`exercise_id`, `picked_count`).
- Application via `scripts/apply-migration.mjs` (auto-mode's chosen pattern — matches how 0017–0019 shipped).

**Out of scope:**
- Seeding the `exercises` / `exercise_prompts` tables (Phase 2).
- Any reads/writes from server actions, RSC, or scripts.
- `reps.exercise_id` backfill — column is nullable, historical rows stay NULL forever.

**Schema changes:**

```sql
-- 0020_muscle_group_pivot.sql — idempotent.

CREATE TABLE IF NOT EXISTS "cognify_v2"."exercises" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" text NOT NULL UNIQUE,                  -- "explain-like-im-12"
  "name" text NOT NULL,                         -- "Explain Like I'm 12"
  "dimension" "cognify_v2"."dimension" NOT NULL,
  "description" text NOT NULL,
  "instructions" text,                          -- station-card body copy
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "exercises_dim_active_idx"
  ON "cognify_v2"."exercises" ("dimension", "is_active");

CREATE TABLE IF NOT EXISTS "cognify_v2"."exercise_prompts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "exercise_id" uuid NOT NULL
    REFERENCES "cognify_v2"."exercises"("id") ON DELETE CASCADE,
  "prompt_text" text NOT NULL,
  "prompt_id" text NOT NULL UNIQUE,             -- stable id for prompt_engagement join
  "difficulty" integer NOT NULL DEFAULT 2,      -- 1..3
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "exercise_prompts_exercise_active_idx"
  ON "cognify_v2"."exercise_prompts" ("exercise_id", "is_active");

CREATE TABLE IF NOT EXISTS "cognify_v2"."muscle_group_days" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "cognify_v2"."users"("id") ON DELETE CASCADE,
  "day_date" date NOT NULL,
  "dimension" "cognify_v2"."dimension" NOT NULL,
  "planned_exercise_ids" jsonb NOT NULL,        -- ordered array of 4 uuids
  "completed_reps" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'planned',     -- planned|in_progress|complete|abandoned|frozen_skip
  "composite_at_close" real,                    -- avg of the 4 reps when complete
  "previous_day_id" uuid REFERENCES "cognify_v2"."muscle_group_days"("id") ON DELETE SET NULL,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "mgd_user_date_uniq_idx"
  ON "cognify_v2"."muscle_group_days" ("user_id", "day_date");
CREATE INDEX IF NOT EXISTS "mgd_user_dim_date_idx"
  ON "cognify_v2"."muscle_group_days" ("user_id", "dimension", "day_date");

CREATE TABLE IF NOT EXISTS "cognify_v2"."workout_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "muscle_group_day_id" uuid NOT NULL
    REFERENCES "cognify_v2"."muscle_group_days"("id") ON DELETE CASCADE,
  "practice_session_id" uuid NOT NULL
    REFERENCES "cognify_v2"."practice_sessions"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "cognify_v2"."users"("id") ON DELETE CASCADE,
  "current_station_index" integer NOT NULL DEFAULT 0,  -- 0..3 (4 = done)
  "state" text NOT NULL DEFAULT 'idle',
  "paused_at" timestamptz,
  "resumed_at" timestamptz,
  "graduation_rep_id" uuid,                     -- FK added below
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "workout_sessions_mgd_idx"
  ON "cognify_v2"."workout_sessions" ("muscle_group_day_id");
CREATE INDEX IF NOT EXISTS "workout_sessions_user_idx"
  ON "cognify_v2"."workout_sessions" ("user_id");

CREATE TABLE IF NOT EXISTS "cognify_v2"."exercise_engagement" (
  "exercise_id" uuid PRIMARY KEY REFERENCES "cognify_v2"."exercises"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "cognify_v2"."users"("id") ON DELETE CASCADE,
  "shown_count" integer NOT NULL DEFAULT 0,
  "completed_count" integer NOT NULL DEFAULT 0,
  "avg_composite" real,
  "recent_composite" real,                       -- 14d rolling avg
  "last_trained_at" timestamptz,
  "last_event_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "exercise_engagement_user_dim_idx"
  ON "cognify_v2"."exercise_engagement" ("user_id", "exercise_id");

ALTER TABLE "cognify_v2"."reps"
  ADD COLUMN IF NOT EXISTS "exercise_id" uuid
    REFERENCES "cognify_v2"."exercises"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "muscle_group_day_id" uuid
    REFERENCES "cognify_v2"."muscle_group_days"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "is_graduation_rep" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "score_failure_flag" boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "reps_exercise_idx"
  ON "cognify_v2"."reps" ("exercise_id");
CREATE INDEX IF NOT EXISTS "reps_mgd_idx"
  ON "cognify_v2"."reps" ("muscle_group_day_id");

ALTER TABLE "cognify_v2"."workout_sessions"
  ADD CONSTRAINT "workout_sessions_grad_rep_fk"
  FOREIGN KEY ("graduation_rep_id")
  REFERENCES "cognify_v2"."reps"("id") ON DELETE SET NULL;
```

The `workout_sessions.graduation_rep_id` FK is added trailing so the cycle resolves.

**Code/component changes:**
- `src/lib/db/schema.ts`: append table defs inside `cognifyV2Schema`. Add new columns on `reps`. Add `repsRelations` entries.
- `drizzle/migrations/0020_muscle_group_pivot.sql`: the DDL above.
- No edits to `src/server/actions/*`, no UI files, no scripts.

**Copy / voice considerations:** none — DDL has no user-facing strings.

**Mobile-app conversion considerations:** schema is platform-neutral. `current_station_index` + `paused_at` are server-side so a paused session resumes on any device. `muscle_group_days.day_date` is a `date` (no timezone) — Phase 3 resolves user-local boundaries.

**Telemetry / observability:** no new telemetry yet. `exercise_engagement` is the future analog of `prompt_engagement` — populated by Phase 7's runtime.

**Definition-of-done:**
- [ ] `drizzle/migrations/0020_muscle_group_pivot.sql` exists, idempotent.
- [ ] `node scripts/apply-migration.mjs drizzle/migrations/0020_muscle_group_pivot.sql` clean against dev DB; re-run is a no-op.
- [ ] All 5 tables visible (`\dt cognify_v2.*`); `\d cognify_v2.reps` shows new columns.
- [ ] `pnpm tsc --noEmit` passes.
- [ ] No app code imports the new exports yet (grep clean).
- [ ] `pnpm build` succeeds.

**Checkpoint protocol:** Max runs the migration, inspects one table via psql, confirms `git diff src/lib/db/schema.ts` shows only additive changes, confirms typecheck + build green. Sign-off unblocks Phase 2.

**Risks + what could derail the phase:**
- Drizzle `relations()` circular-import noise — mitigated by declaring tables in dependency order, keeping new `relations()` blocks minimal.
- `workout_sessions ↔ reps` FK cycle — resolved by trailing `ALTER TABLE ADD CONSTRAINT`.
- Rollback order matters: `exercise_engagement` → `workout_sessions` → `muscle_group_days` → `exercise_prompts` → `exercises`, then `ALTER TABLE reps DROP COLUMN ...`.

---

## Phase 2 — Exercise catalog ingestion + gap-fill `[x]`

> **2026-05-21:** 54 exercises (33 DNA-v1 + 21 gap-fills) × 15-16 prompts each = 848 total prompts shipped via 6 per-dim manifest files under `scripts/exercise-catalog/v1/`. Seed script `scripts/seed-exercise-catalog.mjs` applied clean; re-run is a true no-op (diff-based skip, not blind upsert). `--dim <name>` filter works. `npm run seed:exercises` wired. Per-dim counts: clarity 9/144, structure 9/135, conciseness 9/144, thinking_quality 9/144, pacing 9/146, tone 9/135. No within-dim prompt duplicates. **Note:** the spec said `v1.json` (singular) but I shipped `v1/{dim}.json` (one file per muscle group) — easier to author, diff, and edit per the plan's "one author per dim" rule. The seed script assembles them at runtime. Document in `scripts/exercise-catalog/README.md`.

**Goal:** Stand up the seeded `cognify_v2.exercises` + `cognify_v2.exercise_prompts` data layer. Author the v1 manifest with all 33 DNA-doc exercises + 21 net-new gap-fills, ship a manifest-driven idempotent seed script.

**In scope:**
- Author `scripts/exercise-catalog/v1.json` containing all 33 DNA-doc exercises plus the 21 net-new gap-fills below, with `rule`, `why`, `default_difficulty`, `ordering`, and ≥15 prompts each (floor at v1).
- Net-new exercise authoring (names + rules + why; prompt banks executed day-of):
  - **Pacing (+6):** *Two-Beat Landing* (land every claim, count two beats before moving on); *Slow Cooker* (deliver same point at 70% normal speed without losing energy); *Punctuation Breathing* (one breath per sentence boundary, no run-ons); *The Stretch* (extend the most important word by 30%); *Tempo Shift* (open slow, accelerate into the proof, decelerate at the close); *Beat the Buzzer* (hit a 45s target window).
  - **Tone (+4):** *Curiosity Lift* (end each thought lifted, not declarative); *Conviction Floor* (no rising terminals on claims of fact); *Pivot Tone* (signal a topic change with a tonal shift, not a filler word); *Read the Room* (match tone to a stated audience cue).
  - **Structure (+4):** *Signpost First* (announce structure before delivering it); *Two Then One* (two supporting beats, one payoff); *Compare and Contrast* (force an A-vs-B spine); *Question Then Answer* (open with the listener's question, then resolve it).
  - **Conciseness (+4):** *Cut by Half* (deliver, then deliver same idea in half the words); *Subject Verb Object* (no clause stacking); *No Throat Clearing* (first word is load-bearing); *The Single Sentence* (whole answer in one).
  - **Thinking Quality (+3):** *Name the Assumption* (surface the load-bearing assumption before the conclusion); *Disconfirm Yourself* (state what would change your mind); *Order of Magnitude* (commit to a rough number, not "many" or "some").
- `scripts/seed-exercise-catalog.mjs`, modeled on `scripts/seed-reference-reps.mjs`. Idempotent upsert on `(dimension, name)` and `(exercise_id, prompt_hash)`. CLI: `--dry-run`, `--dim <name>`, `--apply`.
- Validation pass: schema-shape, ≥15 prompts/exercise, no duplicate prompt text within a dim, `dimension` ∈ canonical 6, `default_difficulty` ∈ `{intro, core, stretch}`, `ordering` unique within dim.

**Out of scope:**
- Authoring the ~20 prompts per net-new exercise (day-of execution; spec only locks names + rules).
- Catalog admin UI.
- Embeddings on prompts.

**Manifest shape (`scripts/exercise-catalog/v1.json`):**
```json
{
  "version": "v1",
  "exercises": [
    {
      "dimension": "clarity",
      "name": "Explain Like I'm 12",
      "rule": "No word a 12-year-old wouldn't recognize.",
      "why": "Forces concrete language; surfaces hidden jargon.",
      "default_difficulty": "core",
      "ordering": 1,
      "tags": ["dna-v1"],
      "prompts": [{ "text": "...", "difficulty": "intro", "tags": ["concept"] }]
    }
  ]
}
```

**Schema changes:** none new — consumes Phase 1 tables. Phase 1 must include `UNIQUE (dimension, name)` on `exercises` and unique prompt-hash on `exercise_prompts`.

**Code/component changes:**
- New: `scripts/seed-exercise-catalog.mjs`, `scripts/exercise-catalog/v1.json`, `scripts/exercise-catalog/README.md`.
- `package.json` — add `seed:exercises` script.

**Copy / voice considerations:** Rules are imperative, ≤12 words, present tense. Why blurbs name the learning gain in user-facing language.

**Mobile-app conversion considerations:** Prompts ship as plain text; keep ≤200 chars so mobile cards never need scroll.

**Telemetry / observability:** Seed script prints per-dim summary, exits non-zero on validation fail so CI can gate.

**Definition-of-done:**
- [ ] `v1.json` checked in with all 33 DNA exercises + 21 gap-fills authored.
- [ ] `node scripts/seed-exercise-catalog.mjs --dry-run` passes on a clean checkout.
- [ ] Second run = no-op.
- [ ] Local DB shows ≥9 exercises per dim; no within-dim prompt duplicates.
- [ ] `--dim pacing` restricts writes to Pacing rows only.

**Checkpoint protocol:** Max reviews `v1.json` exercise names + rules (especially the 21 new ones) and signs off before any prompt-bank authoring sprint. Spot-checks 3 random exercises in psql after seed.

**Risks + what could derail the phase:**
- New-exercise rules drift from Cognify voice — Max signs off on names/rules first.
- `ON CONFLICT` targets don't match Phase 1's unique constraints — coordinate.
- Prompt authoring quality variance — one author per dim, not parallel crowdsource.

---

## Phase 3 — Daily-assignment engine `[x]`

> **2026-05-21:** Pure decision logic in `src/server/lib/workout/assignment.ts` (selector + sampler + prompt picker). Server actions in `src/server/actions/workout-day.ts` (`suggestTodaysMuscleGroup`, `startMuscleGroupDay`, `swapMuscleGroup`). `createWorkoutSession()` helper added to `src/server/actions/sessions.ts`. `MUSCLE_GROUP_IDS` + `MUSCLE_GROUP_LABELS` + `Station` + `HydratedMuscleGroupDay` added to `src/types/domain.ts` — intentionally diverges from `SKILL_DIMENSIONS` to handle the `pacing` vs `delivery` split (documented inline). 27 unit tests pass (`tests/workout-assignment.test.ts`, wired into `npm test`). Dev-verify harness at `scripts/dev/verify-workout-assignment.mjs` for the manual checkpoint protocol. Telemetry events fire: `workout.assignment.suggested|overridden`, `workout.day.started`, `assignment.fallback.cold_start|sparse_engagement`. Typecheck + build clean.

**Goal:** Server-side decision logic that, on every "open the Daily Workout" event, picks today's muscle group, samples 4 exercises, and binds them to 4 stations — implementing the Q3 hybrid rotation (weakest-first + 6-day floor + sharp-regression early-surface + user override).

**In scope:**
- `src/server/lib/workout/assignment.ts` (new) — pure, testable functions:
  - `selectMuscleGroupForToday(userId): { suggested: Dim, alternates: Dim[], rationale: string }`
  - `sampleExercises(userId, dim, n=4): Exercise[]` — uniform random from `exercises` where `dim_id=dim`, deduped against the user's last 2 `muscle_group_days` for that dim (when catalog has ≥6 exercises).
  - `pickPromptCandidates(exerciseId, userId, k=5): Prompt[]` — biased away from `prompt_id`s in the user's last 30 reps for that exercise.
- `src/server/actions/workout-day.ts` (new):
  - `suggestTodaysMuscleGroup()` — returns suggested + alternates + rationale.
  - `startMuscleGroupDay({ dim?: Dim })` — inserts `muscle_group_days` row + 4 station rows atomically; idempotent per-user-per-calendar-day.
  - `swapMuscleGroup({ dayId, newDim })` — only allowed while day has 0 completed reps.
- Selector algorithm (deterministic order):
  1. **6-day floor pass:** any dim last trained ≥6 days ago is eligible. None eligible → fall back to "oldest last-trained dim".
  2. **Sharp-regression override:** if any dim's 7-day rolling composite dropped ≥8 pts vs prior 14-day baseline, surfaces early regardless of floor. Tie-break by largest drop.
  3. **Weakest-recent:** among eligible dims, rank ascending by `exercise_engagement.recent_composite`. Suggested = lowest. Alternates = next 2.
  4. **Rationale string** — short, encouraging: "Pacing dropped 11 pts this week — let's tighten it" / "Six days since Clarity — time to revisit" / "Fresh start: Clarity first."
- Cold-start (no engagement): suggest **Clarity** with rationale "Clarity is the highest-leverage muscle — we'll start here." Alternates = Structure, Conciseness.
- Sparse-engagement fallback: when `exercise_engagement` has <3 rows for a dim, fall back to averaging `reps.composite_score` filtered by `dim_id` last 14 days. Empty for that dim → treat as "untrained" → push to front of weakest list.
- Unit tests in `src/server/lib/workout/__tests__/assignment.test.ts` covering cold-start, 6-day floor, regression surface-early, dedupe, override.

**Out of scope:**
- UI day-start banner / override picker (Phase 5).
- Mascot station rendering (Phase 4).
- Writing reps / scoring (existing pipeline; Phase 8 wires `exercise_id` + `muscle_group_day_id` through).
- Streak / freeze logic (Phase 10).

**Schema changes:** none — consumes Phase 1+2 tables.

**Code/component changes:**
- New: `src/server/lib/workout/assignment.ts`, `src/server/actions/workout-day.ts`, tests.
- Touch: `src/server/actions/sessions.ts` — export `createWorkoutSession(muscleGroupDayId)` helper wrapping `createSession("workout")`.
- Touch: `src/types/domain.ts` — add `Dim`, `Station`, `HydratedMuscleGroupDay` types.

**Copy / voice considerations:** Rationale strings are user-facing via Phase 9's banner — ≤60 chars, encouraging, specific. No "you've been slacking" framing.

**Mobile-app conversion considerations:** All logic in pure server actions returning serializable JSON — RN/Capacitor client calls them via same RPC. Random sampling uses `crypto.randomUUID`-seeded shuffles for SSR stability.

**Telemetry / observability:** Emit `workout.assignment.suggested` (dim, rationale_code, alternates), `workout.assignment.overridden` (from_dim → to_dim), `workout.day.started` (dim, exercise_ids), `assignment.fallback.cold_start`, `assignment.fallback.sparse_engagement`.

**Definition-of-done:**
- [ ] `selectMuscleGroupForToday` returns suggested + 2 alternates + rationale for cold-start, normal, and regression cases.
- [ ] `sampleExercises` returns exactly N unique exercises, deduped against last 2 days when possible.
- [ ] `pickPromptCandidates` returns K prompts biased away from last-30-reps usage.
- [ ] `startMuscleGroupDay` creates exactly 1 row + 4 stations atomically; idempotent per-day.
- [ ] `swapMuscleGroup` rejects after first rep is logged.
- [ ] Unit tests pass.
- [ ] Telemetry events fire in dev logs.

**Checkpoint protocol:** Max runs a seed script that backfills 14 days of synthetic `exercise_engagement`, calls `suggestTodaysMuscleGroup()`, confirms rationale matches seeded signal. Then forces Pacing regression and confirms Pacing surfaces early.

**Risks + what could derail the phase:**
- `exercise_engagement` write path not landing on time — selector falls back to `reps` aggregation, slower but functional.
- Weakest-first feeling punitive — softened by rationale copy ("let's revisit").
- Dedupe-within-2-weeks impossible when dim has <6 exercises pre-gap-fill — gracefully relax.
- Calendar-day boundaries across TZs — anchor to `users.timezone`; default UTC if absent.

---

## Phase 4 — Mascot animation system + placeholder character (Claude-authored) `[x]`

> **2026-05-21:** Mascot system shipped via `motion/react` (Framer Motion v12, already in deps). Six files: `src/lib/animations/mascot-state.ts` (state enum + transitions + timings + scoreBandFor), `src/components/product/workout/mascot/MascotCharacter.tsx` (hand-authored geometric brain — hemispheres, sulcus, headband, dumbbells, face — layered into named `<Layer layerName="...">` groups for Phase 14 swap), `variants.ts` (per-layer Framer Motion variants + score-band intensity map), `MascotFallback.tsx` (reduced-motion still-frame + 200ms opacity cross-fade), `Mascot.tsx` (wrapper: state→ARIA + station-X translate + reduced-motion swap + onTap), `/dev/mascot/page.tsx` (full debug surface with state picker, score band, station, dim, viewport sim, transition log, walk sequence). Dev route bundle: 7.72 KB (well under 30KB budget). Build green, typecheck clean. **Deferred to manual verification:** frame-budget ≤8ms on Pixel 6a and CLS=0 measurements require a real device — not testable in this sandbox.

**Goal:** Ship a working brain mascot that walks between 4 stations and reacts to rep events, with a fully Claude-authored placeholder character (SVG + CSS/Framer Motion animations) that's intentional and on-brand, not a throwaway stub. The animation system, state machine, ARIA wiring, and reduced-motion fallback all ship here. Phase 14 later swaps the visual layers for Max's final Figma-designed character without touching any of this scaffolding. If Phase 14 never happens, the product still ships looking deliberate.

**In scope:**
- Hand-authored SVG mascot character in `src/components/product/workout/mascot/MascotCharacter.tsx` — geometric/iconic style, pink/coral palette matching Cognify accents. Layered SVG groups (`<g id="head">`, `<g id="body">`, `<g id="left-leg">`, `<g id="right-leg">`, `<g id="left-arm">`, `<g id="right-arm">`, `<g id="headband">`, `<g id="dumbbells">`, `<g id="eyes">`, `<g id="mouth">`) so Phase 14's polish swap can replace any single layer without touching siblings.
- Animation engine: **Framer Motion** (not Rive). Rationale: Rive Editor requires a desktop GUI; pure-code path via Framer Motion + CSS transforms is what Claude can actually author. Framer Motion handles state machines (`AnimatePresence` + `variants`) declaratively in React.
- `src/components/product/workout/Mascot.tsx` — typed React wrapper exposing `state`, `targetStationIndex`, `lastScore`, `onMascotTap` props. Internally drives Framer Motion variants per state.
- States: `idle` (subtle head-bob breathing, 2s loop), `walking-to-next-station` (legs alternating + arms swinging + body translateX, 1.5-2s), `at-station-recording` (slight forward lean), `at-station-scoring` (head tilt), `celebrating-rep` (jump + raise dumbbells, score-band-keyed: poor→sweating shake, ok→neutral pump, strong→flex, excellent→full headband-pop), `celebrating-day` (bigger pose, 2s).
- Score-band branching inside `celebrating-rep`: 0-49 sweating, 50-74 neutral pump, 75-89 flexing, 90+ headband-pop.
- Stubbed event hooks (`onRepStarted`, `onRepCompleted(score)`, `onDayCompleted`, `walkTo(stationIndex)`).
- ARIA live region announcing state changes. CSS `prefers-reduced-motion: reduce` → animations collapse to instant state changes with 200ms opacity cross-fade.
- Bundle budget: Mascot.tsx + MascotCharacter.tsx + Framer Motion subset ≤30KB gzipped (Framer Motion tree-shakes well; only use `motion.svg`, `AnimatePresence`, `useAnimation`).

**Asset path — Claude-authored, 100% code, $0 cash, no GUI tooling required.**

The legacy plan ("commission a rigger" / "self-rig in Rive Editor") is replaced because:
- Commission is rejected per Max's direction
- Rive Editor is a desktop GUI tool Claude can't drive
- The animation system + state machine + ARIA + perf budget can all be authored as pure React + Framer Motion code

The placeholder character Claude ships is intentional, on-brand, geometric — not a throwaway stub. It uses Cognify's existing pink/coral palette, has expressive eyes, simple but readable proportions. **If Phase 14 polish never happens, this placeholder is production-acceptable.**

Phase 14 (new, deferred to the end of the plan) is where Max swaps the visual SVG layers for a Figma-designed warmer character. Same component contract, same state machine, same animation timings — only the `<g id="...">` layer contents change.

**Out of scope:**
- Final character art polish (Phase 14 — Max swaps SVG layer contents at the end of the plan).
- Wiring to the workout session runtime (Phase 7).
- Station UI itself (Phase 5).
- Easter-egg tap interactions beyond placeholder handler.
- Rive Editor / `.riv` files / any GUI-tool-dependent pipeline.

**Schema changes:** none.

**Code/component changes:**
- `src/components/product/workout/Mascot.tsx` (new) — wrapper component. Props: `state`, `targetStationIndex`, `lastScore`, `onMascotTap`. Drives Framer Motion variants.
- `src/components/product/workout/mascot/MascotCharacter.tsx` (new) — the SVG character itself, layered groups. **This is the file Max edits in Phase 14.**
- `src/components/product/workout/mascot/variants.ts` (new) — Framer Motion `Variants` definitions per state. Animation timings live here.
- `src/components/product/workout/mascot/MascotFallback.tsx` (new) — `prefers-reduced-motion` variant (instant state changes + opacity cross-fade).
- `src/lib/animations/mascot-state.ts` (new) — TS state enum + transition map.
- `package.json` — add `framer-motion` (~30KB gzipped, tree-shakes well).
- Optional: `src/app/(app)/dev/mascot/page.tsx` — debug route with state-toggling controls for Phase 4 verification + Phase 14 polish iteration.

**Copy / voice considerations:**
- ARIA announcements: "Mascot moved to Station 2: Headline First." "Strong rep — mascot celebrating."
- No baby-talk, no "Yay!" — coach, not cheerleader.

**Mobile-app conversion considerations:**
- Framer Motion supports RN via `framer-motion` package's `motion` API working identically; otherwise swap to `react-native-reanimated` via `.native.tsx` extension on `Mascot.tsx`. Character SVG layers reused as-is (RN has `react-native-svg`).
- SVG sized via `vh`/`dvh`. Tap target ≥44pt.
- Lazy load via `next/dynamic({ ssr: false })` for SSR safety.

**Telemetry / observability:**
- `mascot.asset_load_ms` (perf mark).
- `mascot.state_transition` events with `from`, `to`, `triggered_by`.
- `mascot.reduced_motion_active` on session start.
- Log `.riv` 404 + fallback engagement.

**Definition-of-done:**
- [ ] Hand-authored SVG character ships in `MascotCharacter.tsx` — geometric/iconic, on-brand, intentional (not stub-tier).
- [ ] `Mascot.tsx` renders all 6 primary states via `/dev/mascot` debug route.
- [ ] `walkTo(stationIndex)` transitions smoothly between 4 horizontal positions.
- [ ] `prefers-reduced-motion: reduce` collapses to instant-state + opacity cross-fade.
- [ ] ARIA live region announces every state change.
- [ ] Frame budget ≤8ms on Pixel 6a via Chrome devtools perf panel.
- [ ] CLS = 0 when mascot mounts.
- [ ] Bundle: Mascot.tsx + MascotCharacter.tsx + Framer Motion subset ≤30KB gzipped.
- [ ] Layered SVG structure documented so Phase 14 swap is straightforward (each `<g id="...">` is an isolated layer Max can replace).

**Checkpoint protocol:** Max opens `/dev/mascot` debug page, clicks through state triggers, confirms walk reads as "walking" not "sliding," confirms reduced-motion swap, confirms tap-target Easter egg, confirms placeholder character looks intentional (not amateurish) at 320px through 1280px viewports. Sign-off accepts the placeholder as production-acceptable even if Phase 14 polish is deferred or never happens.

**Risks + what could derail the phase:**
- Placeholder character lands amateurish — mitigation: lean into a stylized geometric look (modern abstract icon) rather than attempting warm character art; the placeholder's job is "intentional and clean," not "alive and warm" (warmth comes in Phase 14).
- Framer Motion bundle bloat — only import `motion`, `AnimatePresence`, `useAnimation`; never bare-import the package.
- Reduced-motion fallback forgotten — gate merge on existence.
- SVG + scroll-jank on iOS Safari — test on real device. Framer Motion uses transform/opacity which the iOS compositor handles well.
- Layered SVG structure not preserved during placeholder design — Phase 14 swap becomes painful. Mitigation: enforce `<g id="...">` layer naming convention from day one; document in `MascotCharacter.tsx` header comment.

---

## Phase 5 — Workout Shell UI `[x]`

> **2026-05-21:** Workout page rewritten as split-screen shell. New components under `src/components/product/workout-shell/`: `WorkoutShell` (outer container + session provider), `MuscleGroupHeader` (dim badge + rationale + "last day composite" banner), `MascotStage` (animated mascot + station strip), `StationStrip` + `StationCard` (4 cards with locked/current/complete states; keyboard nav: Tab + ArrowLeft/Right), `RepControls` (bottom-half panel with per-phase placeholders + the Start CTA wired to `startMuscleGroupDay`). Skeletal `useWorkoutSession()` hook at `src/lib/workout/use-workout-session.tsx`. Zod schemas at `src/lib/workout/types.ts`. Legacy `WorkoutSession.tsx` archived at `src/components/_archive/workout-session-v1/` with `@ts-nocheck` + eslint ignore. Bundle: /workout 4.08 KB, /dev/mascot 3.81 KB. Build green, 27 tests pass. **Deferred to manual verification:** Lighthouse a11y ≥95 — not testable in this sandbox.

**Goal:** Replace the legacy single-column Workout page with a touch-first, split-screen shell hosting the mascot above 4 stations and a swappable rep-controls panel below — the visual frame every other Workout-day surface plugs into.

**In scope:**
- Rewrite `src/app/(app)/workout/page.tsx` (server entry): fetches active `muscle_group_day` + `workout_session` (Phase 3), resolved 4 exercises, last same-dim day composite (Phase 9 owns the query), hands hydrated payload to client shell.
- Component tree under `src/components/product/workout-shell/`:
  - `WorkoutShell.tsx` — outer split-screen container, owns layout + `useWorkoutSession()` provider.
  - `MuscleGroupHeader.tsx` — dim badge, "Today: Clarity" title, Phase 9 banner slot.
  - `MascotStage.tsx` — top-half wrapper composing `<Mascot>` (Phase 4) above `<StationStrip>`, mascot offset bound to current station.
  - `StationStrip.tsx` — 4 station cards, exercise name + gym-equipment glyph.
  - `StationCard.tsx` — three visual states: `locked` (muted, lock icon), `current` (dim-colored ring + subtle pulse), `complete` (check + score chip).
  - `RepControls.tsx` — bottom-half swappable container. Render-state switch driven by `session.phase`.
- `useWorkoutSession()` hook at `src/lib/workout/use-workout-session.ts` — skeletal type contract + no-op reducer so shell renders deterministically (runtime in Phase 7).
- Empty state: when server returns no active day → CTA "Start today's Workout" triggers Phase 3 server action.
- Archive `src/components/product/WorkoutSession.tsx` to `_archive/workout-session-v1/`.
- Layout primitives via Tailwind: `grid grid-rows-[auto_1fr_auto]` mobile; `grid-rows-2` 50/50 tablet+. `max-w-5xl` desktop container.

**Out of scope:**
- Mascot rigging + Rive runtime (Phase 4).
- Rep recording, scoring, state-machine dispatching (Phase 7).
- Banner data query + retrospective content (Phase 9).
- Settings to shorten 4→2/3 reps (later phase).

**Schema changes:** none.

**Code/component changes:** as above. Legacy `WorkoutSession` archived; new directory `src/components/product/workout-shell/`; new hook `src/lib/workout/use-workout-session.ts`.

**Copy / voice considerations:**
- Header: "Today: {Muscle Group}" — never "Daily Workout" inside the shell.
- Station-locked a11y label: "Unlocks after station {n-1}".
- Empty-state CTA: "Start today's Workout" + subline "4 reps. ~8 minutes. Let's move."
- Between-reps transition: "Mascot is walking to {exercise name}…" (Phase 7 fills exercise).

**Mobile-app conversion considerations:**
- All interactive ≥44px tap target; station cards 80×96px, gap-2, fit 4 across at 360px viewport.
- No hover-only state; focus + active only.
- No `position: sticky` in bottom controls (iOS keyboard issues); use grid rows.
- Safe-area insets (`pb-[env(safe-area-inset-bottom)]`) on `RepControls`.
- Rive canvas already RN-portable; shell uses no web-only APIs.

**Telemetry / observability:**
- `workout_shell.viewed` (muscle_group_day_id, session_phase, has-prior-day).
- `workout_shell.station_focused` (keyboard nav).
- `workout_shell.empty_state_cta_clicked`.

**Definition-of-done:**
- [ ] `/workout` renders new shell with seeded muscle-group day fixture.
- [ ] Mobile 360px: 4 stations fit, no horizontal scroll, controls above keyboard.
- [ ] Tablet/desktop: 50/50 split with max-width centering.
- [ ] Keyboard: Tab enters station strip, arrows move focus, only current is Enter-activatable.
- [ ] `aria-live="polite"` announces "Now at station {n}: {exercise}".
- [ ] `prefers-reduced-motion`: no pulse/ring animations.
- [ ] Empty state CTA wired to Phase 3 server action stub.
- [ ] Legacy `WorkoutSession` archived, no live imports remain.
- [ ] Lighthouse a11y ≥95.

**Checkpoint protocol:** Max loads `/workout` on real phone + desktop. Confirms station strip + mascot stage feels gym-like not dashboard-like; bottom controls don't clip on iOS Safari; empty state CTA is the obvious next action; hierarchy reads "muscle group → mascot → stations → action".

**Risks + what could derail the phase:**
- Phase 3 contract churn → shell types thrash. Mitigation: ship a Zod schema in `src/lib/workout/types.ts` this phase, Phase 3 conforms.
- Mascot horizontal offset coupling — pin Rive artboard to fixed width, compute station centers in JS.
- 4 stations at 360px with long exercise names → ugly truncation. Mitigation: 2-line clamp + short-name field on `exercises` table.
- Accidental deletion of legacy `WorkoutSession` before Phase 7 lifts patterns. Mitigation: archive, don't delete.

---

## Phase 6 — Prompt selection UX `[ ]`

**Goal:** Build the moment between "mascot arrives at station N" and "user hits record" — a tab-based picker letting the user choose one prompt from the exercise's ~20-prompt bank with fast default path (Shuffle), full agency (List), and no-decision escape (Surprise me).

**In scope:**
- `src/components/product/workout/PromptPicker.tsx` (new client) mounted inside `<RepControls>` during the `prompt-selecting` phase.
- Three tabs: **Shuffle** (default — 3 candidates from `pickPromptCandidates()`, one free re-shuffle, swipe-to-reshuffle on mobile), **All prompts** (filter by difficulty + tags), **Surprise me** (one auto-picked prompt + big "Start rep" button).
- Difficulty chips on every card. Server biases sampling toward easier prompts when recent dim composite < 60.
- Idle-timeout fallback: >15s idle → auto-pick top Shuffle candidate, emit `prompt_auto_selected`.
- Rule reminder card pinned above tabs ("Explain Like I'm 12 — strip topic to language a 12-year-old uses") sourced from `exercises.rule`.
- Exit path: "Skip this station" → returns to StationStrip, emits `station_skipped` (Phase 10 reads for partial-day streak rules).
- Selected state announced via `aria-live="polite"`; tap targets ≥44×44px; keyboard nav (Tab between tabs, ↑↓ between cards, Enter to select).

**Out of scope:**
- The actual candidate biasing algorithm (Phase 3 owns).
- Custom-prompt entry (Skill Lab — Phase 11).
- Difficulty progression / unlocks (future).

**Schema changes:**
```sql
-- 0021_prompt_selection_events.sql
CREATE TABLE cognify_v2.prompt_selection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES cognify_v2.users(id),
  workout_session_id uuid NOT NULL REFERENCES cognify_v2.workout_sessions(id),
  exercise_id uuid NOT NULL REFERENCES cognify_v2.exercises(id),
  prompt_id uuid REFERENCES cognify_v2.exercise_prompts(id),
  mode text NOT NULL CHECK (mode IN ('shuffle','list','surprise','auto_idle')),
  reshuffles smallint NOT NULL DEFAULT 0,
  ms_to_select integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON cognify_v2.prompt_selection_events (user_id, created_at DESC);
```

**Code/component changes:**
- `src/components/product/workout/PromptPicker.tsx` — new client component, tabs via shadcn `Tabs`.
- `src/components/product/workout/PromptCard.tsx` — prompt text, difficulty chip, tag chips, "Pick" button.
- `src/components/product/workout/RuleReminder.tsx` — pinned banner.
- `src/server/actions/prompt-selection.ts` — `logPromptSelection({...})`.
- `src/hooks/use-idle-timeout.ts` — generic 15s idle hook.
- `src/lib/workout/prompt-picker-state.ts` — small reducer.

**Copy / voice considerations:**
- Tab labels: **"Shuffle"**, **"All prompts"**, **"Surprise me"** (no "random" — it's earned recommendation).
- Empty-state for filter: "No prompts at that difficulty yet — try medium."
- Re-shuffle button: "Shuffle again" → after one use: "Locked in — pick one".

**Mobile-app conversion considerations:**
- Swipe-left on Shuffle card stack → reshuffle (one free); haptic via `navigator.vibrate(10)`.
- Tabs bottom-anchored on <640px for thumb reach.
- No hover states; tap to expand difficulty tooltip.
- Mascot stays mounted above; picker is bottom-sheet overlay on mobile, inline panel on desktop.

**Telemetry / observability:**
- Every selection writes a `prompt_selection_events` row.
- Aggregate in `/ops/dashboards/workout`: % shuffle vs list vs surprise vs auto_idle, median `ms_to_select`, reshuffle rate per exercise.
- Alert if `auto_idle` > 20% — picker too heavy.

**Definition-of-done:**
- [ ] Picker renders inside `<RepControls>` during `prompt-selecting` only.
- [ ] All three tabs functional; Shuffle default.
- [ ] Difficulty biasing visible (easier candidates surface when composite < 60).
- [ ] Idle 15s → auto-pick + event logged with `mode='auto_idle'`.
- [ ] Swipe-to-reshuffle on touch, button on desktop.
- [ ] Keyboard nav + screen-reader pass axe audit.
- [ ] Migration 0021 applied.
- [ ] Selecting a prompt advances `<RepControls>` to `recording` via Phase 5's callback contract.

**Checkpoint protocol:** Max runs a full Clarity day on mobile viewport, picks via each tab once, deliberately idles on one rep to confirm auto-pick, checks `prompt_selection_events` rows match each action.

**Risks + what could derail the phase:**
- Phase 3 not shipping difficulty-biasing signature in time → block. Mitigation: coordinate types in `src/lib/workout/types.ts` early.
- Tab UI may feel heavy on mobile → fallback to single Shuffle view with overflow menu.
- Idle auto-pick frustrates deliberate users → make threshold per-user-setting in a later phase if data complains.
- Swipe-to-reshuffle conflicts with iOS Safari back-swipe → `touch-action: pan-y` on card stack.
- Surprise me becomes the only tab anyone uses → monitor mix; if >70% surprise, promote it.

---

## Phase 7 — Session runtime + state machine `[ ]`

**Goal:** Drive a single muscle-group day from "start workout" to "day complete" via a formal finite-state machine owning mascot orchestration, station progression, rep scoring handoff, pause/resume, and the optional graduation pressure rep. The brain tying Phases 3-6 together.

**In scope:**
- `useWorkoutSession()` hook in `src/hooks/use-workout-session.ts` backed by `useReducer` (no `xstate` dep — ~150 LOC).
- States: `idle`, `prompt-selecting`, `recording`, `transcribing`, `scoring`, `score-reveal`, `walking`, `day-complete-prompt`, `graduation-rep`, `day-complete`, `celebrating`, `paused`.
- Events: `START`, `PICK_PROMPT`, `FINISH_RECORDING`, `TRANSCRIBE_DONE`, `SCORE_PROGRESS` (Stage 1 partial), `SCORE_DONE`, `ADVANCE` (auto 5s OR manual tap), `WALK_DONE`, `ACCEPT_GRADUATION`, `SKIP_GRADUATION`, `GRADUATION_DONE`, `PAUSE`, `RESUME`, `FAIL_SCORE`, `NETWORK_DROP`, `NETWORK_RECONNECT`.
- Persistence: every transition writes `workout_sessions.state` + `current_station_index` + `paused_at` via `updateWorkoutSessionState({...})` in new `src/server/actions/workout-session.ts`. Reads via `getActiveWorkoutSession(userId)` for hydrate-on-mount.
- Derived `mascotState` exposed by hook for `<Mascot>` (Phase 4): `idle | at-station | walking-to-next-station | celebrating | stumbling` (stumbling fires on `FAIL_SCORE`). Walk is 1.5-2s; reducer locks input by exposing `controlsDisabled: true` during `walking`, `transcribing`, early `scoring`.
- Scoring wiring: on `FINISH_RECORDING`, fire `scoreStage1` (`src/lib/ai/score-stages.ts:509`), reveal partial dims via `<OptimisticDimensionPreview>`, then `scoreStage2` (line 606) for full feedback. Reuse `scoreRepTwoStage` (line 749) when staged UI isn't needed (graduation = single reveal).
- Graduation rep: after station 4's `score-reveal`, prompt "Want a graduation rep? Pressure mode." Opt-in default. On accept → `graduation-rep` runs one pressure rep using `src/lib/ai/pressure-archetypes.ts` + `src/lib/ai/workout-prompts.ts`. Resulting rep tagged `is_graduation_rep: true`. **Completing the graduation rep awards bonus XP via the existing `src/lib/engagement/achievements.ts` system** — Phase 10 defines the XP value + the `mg_graduated_first` achievement that fires on first-ever graduation. Failing or skipping it costs nothing.
- Edge cases:
  - `FAIL_SCORE` (mock-fallback) → advance to `score-reveal` with degraded dim card + `reps.score_failure_flag = true`.
  - `NETWORK_DROP` mid-record → buffer blob to IndexedDB (`workout-session-buffer`); replay on `NETWORK_RECONNECT`.
  - Pause-during-`walking` → snapshot source/target station, resume replays from start.

**Out of scope:**
- Rive mascot rigging (Phase 4).
- Schema definition (Phase 1).
- Retrospective math (Phase 9).
- Rotation logic (Phase 3).

**Schema changes:** none new — assumes Phase 1 added `workout_sessions.state`, `current_station_index`, `paused_at`, `reps.is_graduation_rep`, `reps.score_failure_flag`.

**Code/component changes:**
- New `src/hooks/use-workout-session.ts` — reducer + side-effect runner.
- New `src/server/actions/workout-session.ts` — `updateWorkoutSessionState`, `getActiveWorkoutSession`, `completeWorkoutSession`, `recordGraduationRep`.
- New `src/lib/workout/session-machine.ts` — pure reducer + types (testable in isolation).
- New `src/lib/workout/network-buffer.ts` — IndexedDB recording buffer.
- Wire into Phase 5's shell.

**Copy / voice considerations:**
- Graduation prompt: "One more rep — pressure mode. Want it?" Skip reads "Call it a day".
- Score-reveal → walk transition: "Next station →".
- Failure toast: "Scoring hiccup — we'll re-grade this rep later. Don't lose momentum."

**Mobile-app conversion considerations:**
- Reducer is pure TS — runs identically on RN / Capacitor.
- IndexedDB buffer abstracted behind `KVStore` interface for RN AsyncStorage swap.
- Background-state: `visibilitychange` → `hidden` mid-record = `PAUSE` (Safari kills mic anyway).
- Auto-advance 5s timer via `setTimeout`; expose `cancelAdvance()` for touch interrupt.

**Telemetry / observability:**
- `workout.session.state_transition { from, to, sessionId, station, elapsedMs }` every transition (100% sample).
- `workout.session.graduation_accepted/_skipped` counters.
- `workout.session.score_failure { repId }`.
- `workout.session.resumed { gapMinutes }`.

**Definition-of-done:**
- [ ] Reducer unit tests cover every transition + every event from every state.
- [ ] Close tab mid-`scoring`, reopen → hydrates back to `scoring` (or `score-reveal` if completed server-side).
- [ ] Airplane mode mid-record → buffer persists → reconnect retries → state advances.
- [ ] Mock-scoring failure renders degraded card + advances; ops dashboard shows flag.
- [ ] Pause during `walking` → resume replays walk from N to N+1.
- [ ] Graduation accept produces rep tagged `is_graduation_rep=true` landing in `day-complete`.
- [ ] `prefers-reduced-motion`: walk collapses to 200ms cross-fade; reducer still emits `WALK_DONE`.

**Checkpoint protocol:** Max runs one full Clarity day end-to-end on desktop + mobile viewport, hits pause mid-rep 2, refreshes, confirms resume lands exactly where left off, completes graduation rep. Force-kills scoring endpoint to confirm failure-flag path.

**Risks + what could derail the phase:**
- State explosion if pause/resume isn't a meta-state — keep `paused` as wrapper carrying `previousState`.
- Mascot animation timing drift vs reducer timer — anchor `WALK_DONE` on Rive `onComplete`, not hard-coded 1800ms.
- Stage 1/2 staggered reveal has own timing — reducer must not double-gate; let `OptimisticDimensionPreview` own its reveal.
- IndexedDB quotas on iOS Safari — cap buffer to one in-flight recording.
- Auto-advance 5s timer fighting user tap — cancel-on-mount and any pointer event.

---

## Phase 8 — Scoring integration `[ ]`

**Goal:** Thread `exerciseId` + `muscleGroupDayId` end-to-end through rep-save → scoring → telemetry so the model sees exercise context (rule) in-prompt and ops can analyze per-exercise drift. Augment — never override — the existing rubric.

**In scope:**
- `src/server/actions/reps.ts`: `insertPendingRep()` and `saveRep()` accept optional `exerciseId` + `muscleGroupDayId`, persist to `reps.exercise_id` / `reps.muscle_group_day_id` (nullable FKs from Phase 1).
- `src/lib/ai/score.ts`: extend `ScoreRepInput` with optional `exerciseId`. In `scoreRepWithMetrics`, hydrate exercise row once via `src/lib/ai/exercises.ts` and pass into prompt builder.
- `src/lib/ai/score-stages.ts`: in `prepareContext` + Stage 1/2 user-message builders, inject one compact XML block before rubric anchors:
  `<exercise name="Headline First" dimension="clarity" rule="Entire answer in sentence one." />`
- Exercise-aware rubric AUGMENTATION (not override): append single constraint sentence keyed by exercise:
  - **The Word Budget** → `Constraint: if transcript exceeds 30 words, primary clarity feedback MUST call it out and conciseness score MUST reflect it.`
  - **The 30 Second Rule** → wall-clock check; bias conciseness.
  - **Headline First** → if sentence-1 doesn't carry thesis, clarity feedback names it.
  - Lookup table `EXERCISE_RUBRIC_HINTS: Record<ExerciseSlug, string>` in `src/lib/ai/exercises.ts`. Unknown exercises → no augmentation.
- Deterministic fast-fail wiring in `src/lib/scoring/deterministic.ts`:
  - **Kill the Filler** → existing filler-word detector pre-LLM; if filler ratio > threshold, short-circuit conciseness to floor with explicit feedback before calling model. LLM still scores other 5 dims.
  - **Strategic Pause** / **Silence Over Filler** → verify pacing/prosody signals reach the prompt when exerciseId maps to Pacing.
- `src/lib/ai/rag/retrieve.ts`: when `exerciseId` set, hydrate its dimension and pass as filter into existing coverage rerank.
- `src/lib/scoring/telemetry.ts` `writeScoringTelemetry`: accept + write `exerciseId`, `muscleGroupDayId`, `isGraduationRep`. Wire from `/api/score-internal`.
- `src/lib/db/queries/exemplar-bank.ts` `promoteRepToExemplar`: read `reps.exercise_id`, stamp into exemplar `tags.exercise_id`. Retrieval filters by exercise for tighter few-shot grounding.
- `scripts/phase-baseline.mjs`: add `--exercise-id=<uuid|slug>` flag filtering the 48-rep replay; emit per-exercise composite drift in report footer.
- Backward compat: existing Skill Lab reps (no exerciseId) skip XML, skip constraint, skip fast-fail — identical to today.

**Out of scope:**
- New rubric versions per exercise (still v6, augmented at prompt-build time).
- Per-exercise model selection or temperature tuning.
- UI for surfacing exercise-aware feedback bullets (Phase 6).
- Calibration-set re-curation.

**Schema changes:**
```sql
-- 0022_scoring_telemetry_exercise_columns.sql
ALTER TABLE cognify_v2.scoring_telemetry
  ADD COLUMN exercise_id uuid REFERENCES cognify_v2.exercises(id) ON DELETE SET NULL,
  ADD COLUMN muscle_group_day_id uuid REFERENCES cognify_v2.muscle_group_days(id) ON DELETE SET NULL,
  ADD COLUMN is_graduation_rep boolean NOT NULL DEFAULT false;
CREATE INDEX scoring_telemetry_exercise_idx
  ON cognify_v2.scoring_telemetry(exercise_id, created_at);
```

**Code/component changes:**
- `src/server/actions/reps.ts` — extend types; persist new FKs.
- `src/lib/ai/score.ts` — extend `ScoreRepInput`; hydrate exercise; pass through.
- `src/lib/ai/score-stages.ts` — inject XML; append constraint hint to Stage 2 user message.
- `src/lib/ai/exercises.ts` (new) — `EXERCISE_RUBRIC_HINTS` map + `getExerciseScoringContext(id)` returning `{ name, dimension, rule, hint }`.
- `src/lib/scoring/deterministic.ts` — `tryExerciseFastFail({...})` returning optional partial-score override.
- `src/lib/scoring/telemetry.ts` — extend `WriteTelemetryInput` + insert columns.
- `src/lib/db/queries/exemplar-bank.ts` — read `reps.exerciseId`, write into exemplar tags.
- `src/app/(app)/ops/calibration/page.tsx` (or sibling) — new "Per-exercise drift" view.
- `scripts/phase-baseline.mjs` — `--exercise-id` flag.

**Copy / voice considerations:** Constraint hints are operator-facing prompt strings — surgical, no encouragement, no fluff. User-facing exercise `why` stays in UI untouched.

**Mobile-app conversion considerations:** Server-side only. No new client bundle weight. Calibration ops view desktop-only.

**Telemetry / observability:**
- Every scored rep with `exerciseId` writes that id to `scoring_telemetry`.
- New ops query: per-exercise validation-fail rate, p95 model duration, mean composite, grouped by exercise_id.
- `is_graduation_rep=true` charted separately so pressure scoring doesn't drag regular p95.

**Definition-of-done:**
- [ ] Migration 0022 applied; Drizzle reflects new columns + indexes.
- [ ] `insertPendingRep`/`saveRep` thread `exerciseId` + `muscleGroupDayId`; existing callers compile unchanged.
- [ ] Stage 1/2 prompts include `<exercise/>` XML when set; snapshot test asserts no leakage when not.
- [ ] `EXERCISE_RUBRIC_HINTS` covers Headline First, The Word Budget, Kill the Filler, The 30 Second Rule, Bottom Line First, The So What Test (one per dim).
- [ ] Filler-word fast-fail short-circuits Kill-the-Filler conciseness when ratio > threshold; LLM still runs other dims.
- [ ] `promoteRepToExemplar` writes `tags.exercise_id`; RAG retrieve filters by exercise.
- [ ] `phase-baseline.mjs --exercise-id=headline-first` emits per-exercise drift table.
- [ ] `/ops/calibration` shows per-exercise drift block.
- [ ] All 48 calibration reps replay with byte-identical composites (backward-compat regression).

**Checkpoint protocol:** Max runs Phase 8 baseline harness against the 48 calibrated reps with `--exercise-id` unset and confirms no composite drift. Then runs filtered to one exercise on a fresh 4-rep Clarity day and inspects the ops per-exercise drift block. Sign-off requires: (a) zero drift on no-exercise replay, (b) XML block visible in prompt-log debug pane, (c) Kill-the-Filler fast-fail observable on a deliberately filler-laden test rep.

**Risks + what could derail the phase:**
- Prompt bloat from XML + constraint hint — capture before/after `promptSizeBytes` in baseline.
- Constraint hint leaking into user feedback verbatim — phrase as rubric instructions; snapshot-test rendered feedback for forbidden substrings.
- Deterministic fast-fail desyncing from LLM scores — reuse `blendScores` with explicit "deterministic wins for this exercise" branch.
- Exemplar tag JSON migration — missing-tag must mean "match any exercise", not "exclude".
- Ops view query cost — `(exercise_id, created_at)` index + 30-day window default.

---

## Phase 9 — Progression surface `[ ]`

**Goal:** Make the "you trained Clarity 6 days ago — beat your previous composite of 64" narrative visible at three moments: before the workout (banner), immediately after (retrospective), on-demand (timeline). Progression is the whole reason rotation exists.

**In scope:**
- (a) Day-start banner on `<MuscleGroupHeader>` (Phase 5) — comparison vs last day of suggested dim, 4 copy variants (first-ever, normal, strong-prior, weak-prior).
- (b) `DayRetrospective.tsx` shown after Phase 7's `day-complete` — composite + per-dim deltas vs last day, mascot reaction, CTA to (c).
- (c) New route `/progress/muscle-groups` — per-dim filterable timeline + composite-over-time line chart, volume bars (30/60/90 day windows), day-of-week/time-of-day heatmap.
- Server queries in `src/lib/db/queries/muscle-group-progress.ts` (new):
  - `getLastMuscleGroupDay(userId, dim): { lastDate, lastComposite, lastDimAvg, daysSince } | null`
  - `getMuscleGroupTimeline(userId, dim, limit?)`
  - `getMuscleGroupComparison(userId, dim, currentDayId)`
- Telemetry events: `progression_banner_shown`, `retrospective_opened`, `muscle_group_timeline_viewed`.

**Out of scope:**
- Cross-dim aggregation (lives on `/progress/page.tsx`, untouched).
- Streak / streak-freeze UI (Phase 10).
- Mascot dialogue strings (Phase 13).
- Calibration drift visualizations.
- Chart library adoption — SVG-only, no recharts/visx/chart.js.

**Schema changes:** none.

**Code/component changes:**
- `src/lib/db/queries/muscle-group-progress.ts` (new) — three queries above.
- `src/components/product/workout/MuscleGroupHeader.tsx` (extend from Phase 5) — accepts `lastDay` prop, renders banner variant. Banner is one line on mobile, no modal.
- `src/components/product/workout/DayRetrospective.tsx` (new) — full-screen panel on mobile, modal on ≥768px. Sections: composite hero, per-dim delta grid with arrow indicators, highlights ("Best dim today: Conciseness 82", "Biggest jump: +18 in Clarity", "Watch: Tone dropped 11"), mascot frame, CTA → `/progress/muscle-groups?dim=clarity`.
- `src/app/(app)/progress/muscle-groups/page.tsx` (new) — server component, reads dim from `searchParams`, renders filter chips + timeline + 3 charts.
- `src/components/product/progress/MuscleGroupTimelineRow.tsx` (new) — date, composite, 4 exercise badges with scores, time-to-complete.
- `src/components/product/progress/CompositeLineChart.tsx`, `VolumeBars.tsx`, `TrainingHeatmap.tsx` (new) — responsive SVG primitives, no deps.
- `src/lib/telemetry.ts` (extend) — three new event names.

**Copy / voice considerations:**
Terse, specific, comparative. "Beat it." not "Try to improve." Numbers always visible. First-ever: "First Clarity day — set the baseline." Retrospective uses verbs the user did: "You climbed +12 in Structure" not "Structure improved."

Banner variants:
- `firstEver(dim)` → "First {dim} day. Set the baseline."
- `previousExists(dim, days, composite)` → "Last {dim} day ({days} days ago): composite {composite}. Beat it."
- `previousStrong(...)` → "Last {dim} day: composite {composite} — strong. Don't slip."
- `previousWeak(...)` → "Last {dim} day: composite {composite} — let's climb."

**Mobile-app conversion considerations:**
Retrospective is the emotionally loaded screen — flawless at 375px. Full-screen on mobile, edge-to-edge. Filter chips 44px tap, horizontal scroll on overflow. Charts use `viewBox` + `preserveAspectRatio` responsive. Heatmap cells min 32px on mobile.

**Telemetry / observability:**
- `progression_banner_shown` on `MuscleGroupHeader` mount when `lastDay !== null`. Props: `dim`, `daysSince`, `lastComposite`.
- `retrospective_opened` on `DayRetrospective` mount. Props: `dim`, `todayComposite`, `deltaVsLast`.
- `muscle_group_timeline_viewed` on page load. Props: `dim`, `rowCount`.
- Funnel: of users who saw the banner, what % beat their last composite?

**Definition-of-done:**
- [ ] All 4 banner variants render based on `lastDay`.
- [ ] Retrospective shows correct per-dim deltas for seeded user with 2+ Clarity days.
- [ ] `/progress/muscle-groups` loads <500ms for user with 60 days history.
- [ ] All charts responsive 320px → 1440px.
- [ ] Three telemetry events fire and appear in sink.
- [ ] `prefers-reduced-motion`: arrow indicators static.
- [ ] First-ever-day path renders baseline-framing copy with no broken comparison UI.

**Checkpoint protocol:** Max manually completes 2 Clarity days separated by a forced rotation, verifies: (1) banner shows "Last Clarity day (X days ago): composite N — beat it", (2) retrospective shows correct deltas, (3) `/progress/muscle-groups?dim=clarity` shows both rows + 2-point line chart. Repeats with first-ever Tone day to confirm baseline copy path. Mobile screenshot at 375px of all three surfaces.

**Risks + what could derail the phase:**
- `getMuscleGroupComparison` joins 4 tables — needs index on `muscle_group_days(user_id, dim, completed_at desc)`.
- SVG charts hand-rolled = easy to get axis math wrong; budget half-day for visual QA.
- Retrospective double-firing pre-`day-complete` settle — gate on `hasFiredRetrospective` ref.
- "Beat it" lands harsh if delta is negative; mascot tone (Phase 13) must absorb gracefully.
- First-ever-day branch most-skipped in testing — seed no-history user in dev fixture.

---

## Phase 10 — Streak + missed-day handling `[ ]`

**Goal:** Wire the engagement-loop mechanics for per-day muscle-group product — define what "showing up" means, close out each day with final status, reuse existing streak-freeze rails.

**In scope:**
- `muscle_group_days.status` lifecycle: `not_started` → `partial` | `complete` | `missed` | `frozen_skip`.
- Completion rules (Q2):
  - 0 reps by end of day → `missed` (consumes freeze if available, else streak resets).
  - 1-3 reps → `partial` (streak preserved as "showed up"; no baseline set).
  - 4 reps → `complete` (streak preserved; baseline set for next rotation; achievement unlocks).
  - Graduation rep is bonus — flips `graduated_at` timestamp; never changes `status`.
- Daily rollover cron at `src/app/api/cron/muscle-group-day-rollover/route.ts` running at user-local midnight (UTC + offset). Closes yesterday's row with final status. Auto-consumes freezes. Inserts notifications. Uses pattern from `/api/cron/weekly-callout-drift`.
- Reuse `awardStreakFreeze` / `consumeStreakFreeze` from `src/lib/db/queries/streak-freeze.ts` — no new ledger.
- Rotation does NOT pause — Phase 3's selector runs untouched; missed Clarity still waits ~6 days for rotation.
- `<MuscleGroupHeader>` (Phase 5) gets streak count + freezes-available pill.
- Missed-day modal on next app open; achievement toast on 4-of-4 via existing `src/lib/engagement/achievements.ts`.

**Out of scope:**
- Replacing existing rep-day streak math in `getStreakStatus` — Phase 11 reconciles.
- Push notifications / email — strictly in-app.
- Per-user reminder time settings.

**Schema changes:**
```sql
-- 0023_muscle_group_day_status.sql
ALTER TABLE cognify_v2.muscle_group_days
  ADD COLUMN IF NOT EXISTS graduated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS freeze_applied_date DATE;

ALTER TABLE cognify_v2.users
  ADD COLUMN IF NOT EXISTS tz TEXT NOT NULL DEFAULT 'UTC';

CREATE TABLE IF NOT EXISTS cognify_v2.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES cognify_v2.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,           -- 'freeze_consumed' | 'day_missed' | 'day_complete'
  payload JSONB NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON cognify_v2.user_notifications (user_id, read_at, created_at DESC);
```

**Code/component changes:**
- `src/lib/muscle-groups/day-status.ts` (new) — `closeOutDay(userId, dayId, nowUtc)` resolves end-states, writes `closed_out_at`, spends freeze, fires achievement, emits telemetry.
- `src/app/api/cron/muscle-group-day-rollover/route.ts` (new) — copy auth + structure from `src/app/api/cron/weekly-callout-drift/route.ts`. Selects rows where `local_date < today_in_user_tz` AND `closed_out_at IS NULL`. Idempotent. Registered hourly in `vercel.json`.
- `src/server/actions/reps.ts` — on every rep save, recompute day status (`partial` at rep 1, `complete` at rep 4); rep's `created_at` decides day membership (start-time wins).
- `src/components/product/workout/MuscleGroupHeader.tsx` — streak + freezes pill.
- `src/components/product/workout/MissedDayModal.tsx` (new) — reads top unread `user_notifications` on app shell mount.
- `src/lib/engagement/achievement-rules.ts` — add `mg_day_complete_first`, `mg_day_complete_streak_7`, `mg_graduated_first`. Define **bonus XP value for graduation rep completion** (suggested: +25 XP on top of base rep XP, configurable in one place so balance can be tuned without code change). XP awarded regardless of graduation rep's score — the reward is for opting in + finishing, not for hitting a score threshold.

**Copy / voice considerations:**
- Missed (freeze used): "Your streak's safe. Used 1 freeze (2 left). Wednesday's Clarity day will rotate back around — today is Conciseness."
- Missed (no freeze): "Streak reset. No shame — Conciseness is up today. The work compounds when you show up."
- Partial: "Showed up. Streak still alive. Try to close out all 4 next time."
- 4-of-4 toast: "Clarity day complete. Composite 71 — beat last Clarity by +6." (Delta from Phase 9.)

**Mobile-app conversion considerations:**
- TZ from `Intl.DateTimeFormat().resolvedOptions().timeZone` on first launch; persist via `PATCH /api/me/tz`. Cron uses stored value.
- 1hr grace window past local midnight: rep timer serializes `started_at` (UTC) on client; trust server-side.
- Notifications table shape works for future native push payloads.

**Telemetry / observability:**
- `streak_freeze_consumed { userId, dayId, dimension }`
- `day_completed { userId, dimension, repsDone: 4, graduated: bool }`
- `day_missed { userId, dimension, hadFreeze: bool }`
- `day_partial { userId, dimension, repsDone }`
- `rotation_force_repeat { userId, dimension, reason: 'sharp_regression' }` from Phase 3.
- Cron logs `{ rowsClosed, freezesSpent, missed, complete, partial }` per run.

**Definition-of-done:**
- [ ] Migration 0023 applies clean.
- [ ] `closeOutDay` unit tests cover all 5 end-states + idempotent re-run.
- [ ] Cron returns 200 with empty body when no rows due.
- [ ] Freeze auto-consume verified: seed user with 1 freeze, simulate yesterday `not_started`, run cron, assert `frozen_skip` + freeze decremented + notification exists.
- [ ] Header streak pill renders correctly when freezes = 0.
- [ ] `prefers-reduced-motion` respected on achievement toast.
- [ ] Edge case: rep started 11:55pm Tue, saved 12:08am Wed lands on Tue's row (assert via `started_at`).
- [ ] Telemetry visible in dev logs.

**Checkpoint protocol:** Max verifies by (1) running cron route manually with `?dryRun=1`, (2) seeding a missed day and confirming modal copy on next open, (3) completing 4 reps and seeing toast fire exactly once, (4) confirming dashboard streak counter matches old `LevelStreakCard` value (no regression).

**Risks + what could derail the phase:**
- TZ default `'UTC'` — existing users get best-effort inference on next sign-in; misfires = ~1 day of wrong boundaries.
- Existing `getStreakStatus` (rep-day) + new muscle-group-day streak = double-counting. Phase 11 must collapse to one source.
- 1hr grace window interacts with cron — must skip rows whose newest rep `started_at` is within grace.
- Achievement double-fire — idempotency guard on `(user_id, achievement_id)`.

---

## Phase 11 — Skill Lab boundary refactor `[ ]`

**Goal:** Extract the shared "record one rep + score it" primitive from `RepSurface`/`SkillLabSession`/`WorkoutSession` into a single `<RepRunner>` module both the new Workout and the (preserved) Skill Lab consume, while explicitly preserving Skill Lab's freeform shape and reframing it as the secondary "Practice" surface.

**In scope:**
- New `src/components/product/rep-runner/`:
  - `RepRunner.tsx` — orchestrates `idle → recording → transcribing → scoring → reveal`. Owns the `useRepStatus` polling + `insertPendingRep`/`saveRep`/`getRepResult` lifecycle currently duplicated across `RepSurface` (~1236 LoC) and `SkillLabSession`.
  - `useRepRunner.ts` — hook for callers needing their own chrome (workout-station compact slot).
  - `types.ts` — `RepRunnerMode = 'skill-lab' | 'workout-station' | 'pressure' | 'scenario'`.
- Props contract: `{ exerciseId?: string | null; promptText: string; promptId?: string; framework?: Framework; mode: RepRunnerMode; pressureArchetypeId?: string | null; speakingThreshold?; previousRepSummary?; onComplete(repId, score); onRetry?; onDiscard? }`.
- Mode-conditional rendering:
  - `workout-station` → compact (no `RepFrameworkStrip` footer, no full `FeedbackPanel` — reveal delegated to Phase 5/7's `RepControls` via `onComplete`).
  - `skill-lab` → full-bleed (current `RepSurface` chrome).
  - `pressure` → archetype badge + tight reveal (no auto-advance).
  - `scenario` → full-bleed + scenario context strip.
- Skill Lab refactor (`src/components/product/SkillLabClient.tsx`, `SkillLabSession.tsx`, `src/app/(app)/skill-lab/page.tsx`):
  - Preserve mode picker, framework picker, scenario picker, "random rep", custom prompts, build-a-rep entry. URL structure `/skill-lab` + `/skill-lab/[dimension]/exemplars` untouched.
  - `SkillLabSession` swaps inline `<RepSurface>` for `<RepRunner mode={...}>`. "Random rep" path calls `src/lib/workout/random-rep.ts` wrapping Phase 3's samplers (exercise reuse, no muscle-group day shape).
  - Custom-prompt path: `exerciseId={null}`.
- Workout (`src/components/product/workout/RepControls.tsx` from Phase 5/7) consumes `<RepRunner mode="workout-station">` for `recording`/`scoring` states; mascot transitions stay owned by Phase 7.
- De-emphasis pass:
  - Sidebar nav demotes Skill Lab from primary CTA to "Practice" entry; Workout becomes daily-default. Surface diff to Max in PR before merge.
  - New `<SkillLabDailyPromo>` strip at top of `/skill-lab` linking back to `/workout` if today's day incomplete; hides post-completion.
- One-time onboarding tooltip on first post-pivot Skill Lab visit, dismiss persisted via existing `user_preferences`.

**Out of scope:**
- Mascot / muscle-group structure / 4-rep day shape in Skill Lab (Q6).
- Phase 5/7 Workout RepControls implementation itself.
- Re-skinning Skill Lab beyond demote + promo strip.
- Schema changes (`reps.exercise_id` already nullable; `muscle_group_day_id` stays null for Skill Lab — that's the structural signal distinguishing reps in retrospective queries).

**Schema changes:** none.

**Code/component changes:**
- New: `src/components/product/rep-runner/{RepRunner.tsx, useRepRunner.ts, types.ts}`, `src/lib/workout/random-rep.ts`, `src/components/product/SkillLabPivotTooltip.tsx`, `src/components/product/SkillLabDailyPromo.tsx`.
- Modified: `src/components/product/RepSurface.tsx` becomes thin wrapper around `<RepRunner mode="skill-lab">` OR is deleted if all 23 importers migrate cleanly.
- Modified: `SkillLabSession.tsx`, `SkillLabClient.tsx`, `WorkoutSession.tsx`, `BuildARepFlow.tsx`, `ChallengeRunner.tsx`, `QuickRepFlow.tsx`, `BaselineRep.tsx` — migrate from `RepSurface` to `RepRunner`.
- Deleted: any current Workout scenario-like behavior overlapping Skill Lab (audit `WorkoutSession.tsx` for `style='pressure'` / `mode='flow'` paths the muscle-group Workout no longer needs).

**Copy / voice considerations:**
- Demote stays encouraging: "Skill Lab is your practice room — daily Workout is your gym." Tooltip: "We moved the daily session to Workout. Skill Lab is still here for targeted drills, framework practice, and custom reps."
- Promo strip: "Today's Clarity day is waiting — 4 reps, ~8 min." Action: "Start workout →". Hide post-completion.
- No "deprecated", "legacy", "old" anywhere.

**Mobile-app conversion considerations:**
- `RepRunner` can't import anything web-only. `RecordButton`'s `getUserMedia` already abstracted in `src/lib/audio/capture.ts` — keep that boundary.
- Compact mode must fit ≤320px wide column for phone portrait.
- Tooltip dismiss ≥44px tap-target, no hover.

**Telemetry / observability:**
- `rep_runner_invoked { mode, exerciseId, hasFramework, hasPressureArchetype }` from RepRunner mount.
- `skill_lab_demote_seen` once per user.
- `skill_lab_daily_promo_clicked` per click.
- `skill_lab_pivot_tooltip_dismissed`.
- Reps from `mode='skill-lab'` continue writing `reps.exercise_id` nullable + `muscle_group_day_id = null`; calibration harness filters on `muscle_group_day_id IS NOT NULL` to separate Workout reps from Skill Lab noise.

**Definition-of-done:**
- [ ] `RepRunner` exists, all four modes render correctly in Storybook + real flows.
- [ ] All 23 `RepSurface` callers migrated; `RepSurface.tsx` deleted or reduced to thin wrapper.
- [ ] Skill Lab URL + pickers verifiably unchanged (manual smoke + existing Playwright passes).
- [ ] Random rep + custom prompt + build-a-rep paths produce valid `reps` rows with correct nullability.
- [ ] Workout's `RepControls` slot renders `<RepRunner mode="workout-station">`; `onComplete` advances day.
- [ ] Pressure rep at end of Workout day AND Skill Lab pressure session share `<RepRunner mode="pressure">` — grep proves no duplicated orchestration.
- [ ] Sidebar nav demote landed; promo strip + one-time tooltip ship.
- [ ] Calibration drift harness no regressions.

**Checkpoint protocol:** Max walks three flows end-to-end: (1) Workout-station rep on Clarity day, (2) Skill Lab random rep, (3) Skill Lab pressure session. Confirms sidebar demote + promo strip "doesn't feel like a demotion" — voice + visual review on staging before merge.

**Risks + what could derail the phase:**
- `RepSurface` is 1236 LoC with 23 consumers — under-scoping `RepRunner` props causes regressions in `BuildARepFlow`, `ChallengeRunner`, `BaselineRep`. Mitigation: enumerate every prop day one.
- Skill Lab heavy users resent demote — keep Skill Lab fully featured; only sidebar emphasis shifts.
- `useRepStatus` polling lifecycle (Supabase realtime + fallback poll) subtle. Extract with explicit test coverage on transcribe-failure + score-failure paths.
- Pressure mode in two callers risks divergence — lock `mode='pressure'` contract in `types.ts` with comment forbidding mode-specific forks.

---

## Phase 12 — Mobile conversion readiness `[ ]`

**Goal:** Ship the Workout pivot in a state that converts cleanly to a mobile app within ~1 sprint post-launch. Audit every new surface from Phases 5/6/7/9 for touch-first correctness, lock Capacitor as recommended native path, land PWA quick-win.

**In scope:**
- Touch-first audit across all Workout surfaces (mascot canvas, station bar, prompt picker, rep controls, day-start banner, retrospective, `/progress/muscle-groups`).
- Tap-target lint: Playwright test walking `/workout` + `/progress/muscle-groups` asserting every `button`, `[role=button]`, `a` has `getBoundingClientRect()` ≥44×44 CSS px. Tailwind class allowlist (`h-11`/`min-h-[44px]`).
- Replace hover-only affordances. Mascot tooltip taps, not hovers. Station tooltips tap-to-reveal.
- Swipe gestures via thin `useSwipe` hook (pointer events, no library): swipe-left/right in PromptPicker, swipe-down on mascot to pause/resume.
- Disable pull-to-refresh on `/workout` (`overscroll-behavior-y: contain` while session active).
- Bottom-sheet variant of PromptPicker on mobile (≤768px) via shared `Drawer` primitive (vaul).
- **Native path recommendation: Capacitor.** Rationale: Rive Canvas works in WKWebView/Chrome WebView identically; ~90% of Workout code runs as Next.js App Router on Vercel with thin Capacitor shell. RN would require rewriting routing, server actions, RSC. PWA-only blocks app stores. Plan future RN migration only if Rive WebView frame-time exceeds 8ms on mid-tier Android.
- Capacitor prep audit: catalog every server action / dynamic route in `src/server/actions/**` and `src/app/(app)/workout/**`. Confirm all work as HTTPS calls from shell. Document 3-4 routes needing `Cache-Control` tweaks for WebView caching.
- `requestMicrophonePermission()` shim at `src/lib/platform/mic.ts`: dispatches to `navigator.mediaDevices.getUserMedia` on web, `@capacitor/microphone` on native (stub now — signature matches).
- Recording storage shim at `src/lib/platform/recording-store.ts`: IndexedDB on web, `@capacitor/filesystem` on native. Buffer per-rep blob so backgrounded app doesn't lose in-progress rep.
- PWA quick-win (ships regardless): `public/manifest.webmanifest`, app icons (1024/512/192/180/32), splash with idle mascot, `display: standalone`, theme color matching Workout header. Service worker via `@serwist/next` caching `/api/exercise-catalog` and prompt JSON for offline prompt browsing.
- Haptic + lock-screen: `navigator.vibrate(20)` on station change (mascot arrives), no-op on iOS Safari but present for Capacitor. MediaSession metadata on active rep so iOS shows "Workout in progress" on lock screen.
- Perf budgets enforced in CI: FCP ≤2s on Moto-G7 Lighthouse profile, `/workout` JS bundle ≤200KB gzipped, mascot frame-time ≤8ms p95 via Rive `onAdvance` sampler. Rive loaded via `next/dynamic({ ssr: false })`.

**Out of scope:**
- `npx cap add ios|android`, app-store submission, signing certs, native push, deep linking.
- RN migration. Capacitor only.
- Offline recording + delayed sync (Phase 12.5 if needed).

**Schema changes:** none.

**Code/component changes:**
- `src/lib/platform/mic.ts`, `recording-store.ts`, `haptics.ts` — new platform abstraction layer.
- `src/components/product/workout/MascotCanvas.tsx` — wrap Rive in `next/dynamic`, add `onAdvance` perf sampler, tap-to-reveal tooltip.
- `src/components/product/workout/PromptPicker.tsx` — desktop modal + mobile bottom-sheet via shared Drawer, swipe-to-cycle.
- `src/app/(app)/workout/layout.tsx` — apply `overscroll-behavior-y: contain` while session active.
- `src/hooks/useSwipe.ts` — pointer-events swipe primitive.
- `public/manifest.webmanifest`, `public/icons/*`, `src/app/layout.tsx` — manifest link + theme color.
- `next.config.ts` — Serwist plugin, static-export compatibility audit comments.
- `tests/e2e/mobile-audit.spec.ts` — Playwright tap-target + reduced-motion + swipe coverage.
- `scripts/perf-budget.mjs` — CI bundle-size + Lighthouse gate.

**Copy / voice considerations:**
Tap-revealed mascot tooltips stay in voice: "She's loading her playlist…", "Catching her breath — tap to keep going." No "click here." Install-prompt: "Put Cognify on your home screen — your brain gym, one tap away." Lock-screen MediaSession: "Clarity Day · Rep 2 of 4."

**Mobile-app conversion considerations:** this phase IS the consideration. Net deliverable: Capacitor shell addable in <1 sprint with no Workout-code rewrites, PWA install path ships day one.

**Telemetry / observability:**
- `platform_detected` on session start (web / pwa-standalone / capacitor-ios / capacitor-android).
- `mascot_frame_time_p95` per session.
- `swipe_used` (surface, direction) — validate gestures get discovered.
- `install_prompt_{shown,accepted,dismissed}` PWA funnel.
- Bundle-size + Lighthouse CI to existing perf channel.

**Definition-of-done:**
- [ ] Playwright `mobile-audit.spec.ts` passes — every interactive ≥44×44.
- [ ] Zero hover-only affordances; mascot/station tooltips tap-driven.
- [ ] PromptPicker renders as bottom sheet ≤768px, modal on desktop, shared state.
- [ ] Swipe-to-cycle in PromptPicker + swipe-down-to-pause on mascot canvas working with pointer events.
- [ ] `manifest.webmanifest` served, installable from Chrome + Safari, idle-mascot splash visible.
- [ ] Service worker caches exercise + prompt JSON; `/workout` browsing works in airplane mode (recording disabled gracefully).
- [ ] Platform shims exist; web live, native stubbed with TODO + signature match.
- [ ] Rive lazy-loaded; `/workout` initial JS ≤200KB gzipped (CI gate).
- [ ] Moto-G7 Lighthouse: FCP ≤2s, mascot frame-time p95 ≤8ms.
- [ ] `prefers-reduced-motion` still-frame verified for every mascot state.
- [ ] Capacitor-compatibility audit doc lists every server action with web/native verdict.

**Checkpoint protocol:** Max verifies by installing Cognify to iPhone home screen, running a full Clarity day (4 reps) from standalone PWA, confirming smooth mascot animation, one-handed tap targets, prompt picker bottom sheet, no accidental pull-to-refresh, swipe gestures discoverable. Opens Capacitor-compatibility doc and signs off nothing blocks a future shell.

**Risks + what could derail the phase:**
- Rive frame-time on low-end Android exceeds 8ms — fallback: drop to still-frame on detected low-end devices, log to telemetry, escalate to RN evaluation.
- Service worker caching collides with App Router RSC payloads — mitigation: cache only static JSON, never HTML/RSC.
- iOS Safari standalone quirks (no `beforeinstallprompt`, partial MediaSession) — accept gracefully.
- Swipe conflicts with iOS back-swipe — confine swipe regions, never page edges.
- Bottom-sheet drawer bundle weight — audit before merging vaul.

---

## Phase 13 — Copy + voice system `[ ]`

**Goal:** Define and centralize every user-facing string in the Workout flow under one voice system with deterministic variation so the experience feels alive, never templated.

**In scope:**
- Mascot voice principles: encouraging without saccharine, specific over vague ("Tighten your first 5 words" not "Work on your opening"), ≤12 words per bubble, dry-witted but never condescending, first-name (`users.first_name`) sparingly (~1-in-5 lines).
- `src/content/mascot/voice.ts` as single source of truth. Categorized variation arrays:
  - `idleGreeting[]` — 4-6 variants, time-of-day branching (morning / afternoon / evening / late-night).
  - `walkingComments[]` — 8-10 variants per feel-bucket: `neutral`, `strong-rep`, `weak-rep`. Triggered between stations from prior rep's score band.
  - `atStationIntro[]` — keyed by `exercise_id`, 3-5 variants each, said as mascot arrives.
  - `scoreReactions` — 5×2 matrix: `{poor, below, ok, strong, excellent}` × `{first-of-day, late-in-day}`, each cell 4+ lines.
  - `dayCompleteCelebrations[]` — 6+ variants, sub-bucketed by delta-vs-last band: `first-ever | regression | flat | improvement | breakthrough`.
  - `retroNarratives` — templated sentences.
  - `freezeConsumed[]`, `streakSavedJustInTime[]`, `partialDay[]` (1-of-4 to 3-of-4), `fullDay[]`.
  - `errorFallbacks` — reuse tone of `buildFallbackScore` (`src/lib/scoring/deterministic-client.ts`, `src/app/api/score/route.ts`). Example: "Couldn't get a clean read — counting it as a rep and moving on."
- **Variation strategy:** seeded shuffle per (user_id, YYYY-MM-DD, bucket-name). Pick index = `hash(seed) mod variants.length`; track last-shown index in `localStorage` under `cognify.voice.shown.<bucket>` and skip collisions. Falls back to pure modulo when storage unavailable (SSR / private mode). Helper: `pickVoiceLine(bucket, ctx)` in `src/content/mascot/pick.ts`.
- **Day-comparison templates** (Q4 banner copy) — named-slot strings:
  - `firstEver(dim)` → "First {dim} day. Set the baseline."
  - `previousExists(dim, days, composite)` → "Last {dim} day ({days} days ago): composite {composite}. Beat it."
  - `previousStrong(dim, days, composite)` → "Last {dim} day: composite {composite} — strong. Don't slip."
  - `previousWeak(dim, days, composite)` → "Last {dim} day: composite {composite} — let's climb."
  - Slot names locked: `{dim}`, `{days}`, `{composite}`, `{deltaSign}`, `{deltaAbs}`, `{firstName}`. Interpolation via `formatVoice(template, slots)` — no template literals scattered.
- **Exercise rule reminders:** the `rule` field on each exercise (populated by Phase 2 from DNA doc) is the canonical in-rep reminder shown in the prompt picker. Voice file references by `exercise_id` only — does NOT duplicate rules. Missing rule → fallback to generic "Stay sharp" from `voice.ts`.
- **A11y copy:**
  - Mascot: `aria-label="Brain mascot, walking to station {n}"` / `at station {n}` / `celebrating, day complete`.
  - Station strip: `aria-label="Station {n} of 4: {exerciseName}, {locked|current|complete}"`.
  - Live region (`role="status"`, polite): "New score: {n}. {bandLabel}." Fires once per rep on score reveal.
- **Empty-state + error copy:** every fallback path routes through `voice.errorFallbacks[reason]` keyed on existing reason codes used by `buildFallbackScore` (no-transcript, too-short, scoring-failed, timeout). One voice source, one tone.

**Out of scope:**
- Localization. v1 is en-US. Centralized voice file is the i18n seam; no `t()` wrapper yet.
- TTS of mascot lines.
- A/B testing of copy variants.

**Schema changes:** none.

**Code/component changes:**
- New: `src/content/mascot/voice.ts`, `src/content/mascot/pick.ts`, `src/content/mascot/types.ts`.
- New: `src/content/banners/day-comparison.ts` — Q4 templates.
- Wire-up: `MascotBubble`, `StationStrip`, `MuscleGroupHeader` banner, `DayRetrospective`, `RepRunner` error states all consume `pickVoiceLine` / `formatVoice`. No inline strings remain in Workout components.

**Copy / voice considerations:** this phase **is** the copy phase.

**Mobile-app conversion considerations:** voice file is pure data, RN-portable as-is. `localStorage` access wrapped in `safeStorage` for RN/AsyncStorage swap. No DOM APIs in `pick.ts`.

**Telemetry / observability:**
- `voice.line_shown { bucket, variant_index, exercise_id? }` once per shown line — frequency data to catch over-rotation.

**Definition-of-done:**
- [ ] `voice.ts` populated with all named buckets above, every bucket ≥4 variants.
- [ ] `pickVoiceLine` deterministic given (user, date, bucket); never returns same index twice in a row when ≥3 variants.
- [ ] All Workout components reference voice file — zero inline user-facing strings (lint rule: regex check in CI).
- [ ] Day-comparison banner renders correct template for all 4 history states.
- [ ] A11y labels verified with screen reader on mascot transitions.
- [ ] Error fallback paths route through `voice.errorFallbacks[reason]`.
- [ ] Copy review checklist (below) run by Max.

**Checkpoint protocol — Max's copy review checklist:**
- No mascot bubble exceeds 12 words.
- No condescending phrases ("Don't worry!", "Almost!", "Good try!").
- No financial / sales jargon — brain-gym.
- Dim names capitalized consistently: Clarity, Structure, Conciseness, Thinking Quality, Pacing, Tone.
- First-name usage feels natural.
- Read 20 random variation samples aloud — none make Max wince.

**Risks + what could derail the phase:**
- Variation pool too small → repeats within session. Mitigation: ≥4 variants per bucket, ≥8 for high-frequency (`walkingComments`, `scoreReactions`).
- Drift between exercise `rule` (Phase 2) and voice file → duplicate or contradictory reminders. Mitigation: hard rule voice file never inlines exercise rule text.
- Copy feels GPT-generic. Mitigation: Max writes first pass; no LLM-generated voice lines in v1.
- `localStorage` quota / SSR edge cases. Mitigation: pure-modulo fallback tested.

---

## Phase 14 — Mascot character art polish (Max-authored, deferred to end) `[ ]`

**Goal:** Replace Phase 4's Claude-authored placeholder character with Max's final Figma-designed warmer/character-y version. The animation system, state machine, ARIA wiring, perf budget, and reduced-motion fallback all stay untouched. Only the SVG layer contents inside `MascotCharacter.tsx` change.

**Why this phase exists separately:** by the time we get here, every downstream system (Shell, Runtime, Copy, Mobile, Scoring) is built and verified against the placeholder. Max walks into the design work with full context — knows exactly which states matter, which transitions feel awkward, which size the mascot reads at on real devices, which color values clash with the rest of the UI. Design quality goes up because constraints are concrete, not speculative. If Max never gets to this phase (time crunch, priority shift), the product still ships looking deliberate.

**In scope:**
- Max designs the final mascot in Figma (~2-3 hrs):
  - Warmer character art than the placeholder — more personality details (eye shapes that emote, fabric folds on the headband, subtle texture on the brain cortex).
  - Same Cognify pink/coral palette anchor.
  - Same proportions as placeholder so timings + bone-equivalent positions don't shift.
  - Each layer exported as separate SVG: `head`, `body`, `left-leg`, `right-leg`, `left-arm`, `right-arm`, `headband`, `dumbbells`, `eyes`, `mouth`. Same `id` names as placeholder.
- Claude (or Max, whoever's at the keyboard) replaces the SVG layer contents inside `src/components/product/workout/mascot/MascotCharacter.tsx`:
  - Each `<g id="head">…</g>` block's children get swapped.
  - Container `<svg>` element, group `id`s, transform origins all preserved.
  - Framer Motion variants in `variants.ts` untouched.
- Verification on the `/dev/mascot` debug route: every state still animates correctly, walk cycle still reads cleanly, score-band celebrations still match their bands, reduced-motion fallback still works.
- A11y check: ARIA labels still accurate to the new character's visual states (e.g., if Max adds a sweat-drop in the `sweating` flavor state, mention it in the live region).

**Out of scope:**
- Animation timing changes (would require re-verifying Phases 5/7/12 — out of bounds here).
- New states (also out — locked in Phase 4).
- Voice / copy changes for the new character personality (Phase 13 already locked).
- Rive Editor or any GUI-tool dependency.

**Schema changes:** none.

**Code/component changes:**
- `src/components/product/workout/mascot/MascotCharacter.tsx` — layer contents swapped. Header comment updated with "v2 character, designed by Max [date]".
- Optional: minor `variants.ts` tuning if the new character has subtle proportion shifts that benefit from 50-100ms timing tweaks. Document any tuning in a comment.
- `public/animations/mascot-placeholder-v1.svg` — preserve the Phase 4 placeholder as a reference (in case Phase 14 v1 needs to roll back).

**Copy / voice considerations:** Voice file (Phase 13) untouched. If the new character has a flavor state the placeholder didn't (e.g., a yawning state for late-night Workouts), add the corresponding voice bucket — but defer to a Phase 15.5 follow-up if it's not load-bearing.

**Mobile-app conversion considerations:** Same SVG layer structure means RN/Capacitor port behavior identical to Phase 4's. No new mobile considerations.

**Telemetry / observability:** No new events. Existing `mascot.state_transition` continues working.

**Definition-of-done:**
- [ ] Max delivers Figma source file + SVG layer exports.
- [ ] `MascotCharacter.tsx` layer contents replaced; `<g id="...">` names preserved.
- [ ] `/dev/mascot` debug route exercises all states; walk cycle reads correctly; reduced-motion still works.
- [ ] Visual QA: mascot reads as warm + character-y, not just "geometric icon"; lands at 320px → 1280px viewports without distortion.
- [ ] Bundle budget still ≤30KB gzipped after swap (if new SVG is heavier, optimize via SVGO).
- [ ] ARIA labels updated for any new visual flavor states.
- [ ] Placeholder preserved at `public/animations/mascot-placeholder-v1.svg` for rollback reference.

**Checkpoint protocol:** Max walks `/dev/mascot` on real mobile + desktop, eyeballs the new character against the placeholder side-by-side, confirms the new version feels measurably warmer / more alive while everything still functions. Sign-off triggers Phase 15.

**Risks + what could derail the phase:**
- Time crunch — Max doesn't get to it. **Mitigation:** Phase 4 placeholder is already production-acceptable. Phase 14 is upgrade, not gate.
- New character has visual proportions that break the walk cycle timing — mitigation: keep placeholder + new character within ±15% on bounding box proportions.
- SVG bundle bloat from extra detail — run through SVGO; cap at 30KB gzipped.
- A11y regression from new visual states not reflected in ARIA — explicit a11y review step in DoD.

---

## Phase 15 — Verification + launch `[ ]`

**Goal:** Prove the muscle-group Workout pivot ships without regressing scoring quality, Skill Lab, or `/ops/calibration/drift` — and can be rolled back in <5 minutes if it does.

**In scope:**
- Extend `scripts/phase-baseline.mjs` to replay the existing 10-rep calibration set against post-pivot scoring path; persist new baseline to `plans/baselines/muscle-group-pivot-final.json` and diff vs pre-pivot baseline.
- Drift tolerance: composite ±5 per rep, dim-level ±8 per rep, must hold on ≥9 of 10 reps. Fail closed — drift outside tolerance blocks merge.
- Per-exercise mini-harness: pick 5-10 exercises with most dogfood usage (likely Explain Like I'm 12, Headline First, The 3 Point Rule, The 30 Second Rule, Bottom Line First) and replay 5 reps each through new exercise-aware scoring path.
- Smoke matrix executed manually pre-merge:
  - [ ] Start workout, complete 4 reps, finish → retrospective shows, status = complete
  - [ ] Start workout, complete 1 rep, close tab → status = partial, streak preserved
  - [ ] 0 reps, day ends → midnight cron sets status = missed (or frozen_skip)
  - [ ] Skip prompt picker (Surprise me) → auto-pick works
  - [ ] Re-shuffle prompts → new candidates returned
  - [ ] Pause mid-recording, resume → state persists, mascot at correct station
  - [ ] Graduation pressure rep accept → 5th rep tagged correctly in telemetry
  - [ ] Day-start banner shows correct "Last Clarity day: 64" copy
  - [ ] Retrospective shows side-by-side correctly
  - [ ] `/progress/muscle-groups` timeline filters by dim
  - [ ] Streak freeze auto-consumes on missed day
  - [ ] Mascot animations + `prefers-reduced-motion` fallback
  - [ ] Mobile breakpoints (375px, 768px, 1280px)
  - [ ] Skill Lab still works: framework-builder, scenario, random rep, custom prompt
  - [ ] `/ops/calibration/drift` regression check
  - [ ] Cron `/api/cron/muscle-group-day-rollover` writes correct status
- Telemetry KPIs before declaring shipped:
  - Workout completion (4/4) ≥35% on dogfood cohort
  - Workout open rate ≥0.6/active-day
  - Median time-to-complete ≤15 min
  - Scoring p95 ≤8s (unchanged from post-overhaul baseline)
  - Mock-fallback <2% (unchanged)
  - Mascot asset load ≤1.5s p95
  - Streak-freeze cron nightly without error
- Feature flag `FF_MUSCLE_GROUP_WORKOUT` gates the new `/workout` shell. Default off in production, on in dev.
- Rollout plan (compressed per Max 2026-05-21): Phase 0 internal (Max + Bob) → 5% → 25% → 100%, **each step observed ≥24h before next bump**. Total ~3-4 days from internal to 100%. Rationale: solid planning + smoke matrix + 48h-observation gates on KPIs reduce the need for long canary windows. Rollback: flip flag off, legacy serves; `muscle_group_days` data preserved.

**Out of scope:**
- App store submission, marketing copy, blog post, user-facing changelog.
- New exercise authoring or prompt-bank expansion (Phase 2).
- Calibration tuning beyond drift detection — Promote-to-bank stays independent.

**Schema changes:** none.

**Code/component changes:**
- `scripts/phase-baseline.mjs` — add `--mode=muscle-group-final` branch + per-exercise mini-harness.
- `plans/baselines/muscle-group-pivot-final.json` — new committed baseline.
- `src/lib/flags.ts` (or equivalent) — register `FF_MUSCLE_GROUP_WORKOUT`; read in `src/app/(app)/workout/page.tsx` to swap between legacy and new shell.
- `src/app/(app)/workout/page.tsx` — flag-gated entry: legacy preserved as `LegacyWorkoutPage` until 100% rollout settles.
- `.env.example` + production env docs.

**Copy / voice considerations:** Banner + retrospective phrasing verified as part of smoke matrix. No new copy authored.

**Mobile-app conversion considerations:** Smoke matrix walks all three breakpoints in DevTools and at least one real device (iOS Safari preferred). Rive asset load timing measured on throttled 4G.

**Telemetry / observability:**
- KPI dashboard reads from existing telemetry tables; no new events.
- Drift harness output committed to `plans/baselines/`.
- Cron error rates monitored for ≥48h after each rollout phase bump.

**Definition-of-done:**
- [ ] All 14 prior phases complete + checkpoints signed by Max (Phase 14 mascot polish is optional — if deferred, Phase 4 placeholder ships).
- [ ] `npm run typecheck`, `npm test`, `npm run lint` all pass.
- [ ] Calibration harness within tolerance (10-rep + per-exercise mini).
- [ ] Smoke matrix 100% green, mobile breakpoints verified on real device.
- [ ] `/ops/calibration/drift` unchanged behavior.
- [ ] `FF_MUSCLE_GROUP_WORKOUT` documented + off in production at merge.
- [ ] Rollback path tested: flip flag off in dev, confirm legacy serves, confirm `muscle_group_days` preserved.

**Checkpoint protocol:** Max walks smoke matrix on staging with flag on, watches Phase-0 dogfood metrics for 48h before authorizing 5% bump. Each rollout step requires explicit go from Max — no auto-progression.

**Risks + what could derail the phase:**
- Calibration drift exceeds tolerance because Phase 8 exercise-aware scoring shifted weights — requires re-tune, not rollback.
- Rive asset load fails p95 on real mobile — mitigated by still-frame fallback (Phase 4).
- Legacy Workout path bit-rots during flag-gated period — keep `LegacyWorkoutPage` import-tested in CI until 100% rollout settles 14 days, then delete in follow-up PR.
- Streak-freeze cron silently fails on first missed day post-launch — covered by smoke matrix + 48h gates.

---

## Decisions log

Captures the auto-mode Q1-Q7 calls made during the 2026-05-21 planning session. Flag any you want changed before Phase 1 starts; each one is load-bearing for the spec.

- **2026-05-21 — Q1 — Session shape per day:** 4 reps stacked into one continuous session, pause-and-resumable (same day). 4 is default ceiling; user can shorten to 2 or 3 in settings. Continuous flow matches "go to the gym"; resumability respects mobile life.
- **2026-05-21 — Q2 — Streak / completion:** 1 of 4 reps preserves streak ("showed up"); 4 of 4 = full day complete (sets baseline + unlocks achievement). Missed day resets streak unless streak-freeze consumed. Muscle group rotation does not pause — missed Clarity rolls back around in ~6 days regardless.
- **2026-05-21 — Q3 — Rotation cadence:** Hybrid — system suggests next muscle group by lowest recent dim score (weakest-first nudge); user can override before starting. Round-robin floor: same muscle group rolls around every 6 days minimum. May surface earlier if a dim regresses sharply.
- **2026-05-21 — Q4 — Progress surface:** All three, staged. (a) Banner on day-start screen ("Last Clarity day: composite 64 — beat it"). (b) End-of-day retrospective (per-dim delta vs last). (c) Standalone `/progress/muscle-groups` view (per-dim timeline).
- **2026-05-21 — Q5 — Relationship to current modes:** Daily Workout owns its own shape (4 reps + optional graduation pressure rep). Focus / combined / flow / scenario live in Skill Lab as user-chosen session shapes. Pressure mode appears in two places: graduation rep in Workout AND Skill Lab session shape. Intentional overlap.
- **2026-05-21 — Q6 — Skill Lab boundary:** Skill Lab keeps framework-builder, scenario practice, pressure archetypes, "random rep", custom prompts, build-a-rep. Skill Lab does NOT have muscle-group structure, mascot, or 4-rep day shape. Shared primitive: single rep recording + scoring extracted into `<RepRunner>` (Phase 11) both products consume.
- **2026-05-21 — Q7 — Schema appetite:** Full migration. New `cognify_v2` tables: `exercises`, `exercise_prompts`, `muscle_group_days`, `workout_sessions`, `exercise_engagement`. `reps` gets nullable `exercise_id` + `muscle_group_day_id` FKs. Overlay JSON rejected — rotation + retrospective queries need queryable structured data.
- **2026-05-21 — UI signature:** brain mascot with legs, headband, dumbbells walks between 4 stations on the top half of a split screen; bottom half holds the start button and per-rep controls. Engine: Rive (free for our use, native RN support). Mascot states: idle / walking / at-station / celebrating + optional flavor (stumbling / sweating / flexing). `prefers-reduced-motion` falls back to still-frame per state.
- **2026-05-21 — Asset sourcing:** commission a Rive rigger ($400-700, 7-10 days) — Phase 4's recommendation. Stub mascot ships first so dev unblocks.
- **2026-05-21 — Native path:** Capacitor for fastest time-to-store. RN migration only if Rive WebView frame-time exceeds 8ms on mid-tier Android. PWA-only blocks app stores so it ships in addition to, not instead of, Capacitor.
- **2026-05-21 — Phase count:** 15 phases. Bigger than the 8-phase scoring overhaul because the pivot spans data model, runtime, three UI surfaces, mascot animation system, mobile readiness, copy system, late-stage mascot polish, and verification. Combine-ideas memory: every phase ambitious-scope, no half measures.
- **2026-05-21 — Mascot pipeline (revised twice during planning):** final answer is **Claude authors the entire animation system + a placeholder SVG character in Phase 4 using Framer Motion (no Rive Editor, no GUI tool)**. Max's hands-on design work deferred to Phase 14 (final character art polish via Figma → SVG layer swap), which is optional — Phase 4 placeholder is production-acceptable. Commission path rejected entirely. This minimizes Max's mid-build context-switches into design work; he goes into Phase 14 with full system context.

---

## Resolved decisions (2026-05-21 review session)

All 7 open questions cleared with Max before Phase 1 cut. Locked in:

1. **Q3 rotation cadence:** 6-day floor stays — all 6 dims hit per week minimum.
2. **Q5 graduation rep:** opt-in default + **bonus XP reward** for completing it (+25 XP suggested, configurable). Reward is for opt-in + finish, not score-gated.
3. **Phase 4 asset path (revised):** **Claude authors the full animation system + a placeholder SVG character in Phase 4 using Framer Motion.** No Rive Editor, no commission, no GUI tool dependency. Max's design work deferred to new Phase 14 (final character art polish via Figma SVG layer swap), which is optional — Phase 4 placeholder is production-acceptable on its own.
4. **Phase 12 native path:** **Capacitor first.** RN deferred to a future Phase 15 trigger only if Capacitor frame-time / background-audio limits bite. Honest framing: Capacitor is production-grade for non-game apps; RN would require rewriting routing + server actions + RSC for a marginal win that doesn't materially help the muscle-group product.
5. **Mascot voice samples:** Claude drafts 10 representative lines before Phase 13 starts (delivered alongside this update).
6. **Phase ordering:** linear 1→14. Mascot Phase 4 blocks Phase 5 shell (which needs at least a stub). Cleaner dependency chain.
7. **Phase 14 rollout pace:** compressed to ~3-4 days end-to-end — Phase 0 internal → 5% → 25% → 100% with ≥24h observation per step (down from 48h). Better planning + smoke matrix justifies the tighter cadence.
