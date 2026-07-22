# Task brief — Holistic prompt-bank completion & expansion (paste into a fresh session)

You are working in the Cognify v2 repo. Your job is to make Cognify's speaking-prompt bank
**complete, high-quality, and larger** — every exercise across every dimension and application
generating prompts from its own authored criteria, with **zero prompts that a general user
can't answer**. This is a fill-gaps + scale + upgrade job, NOT a rebuild: the generation engine
and per-exercise criteria framework already exist. Read before touching anything, then execute
autonomously, pausing only for a real blocker (provider quota, destructive-DB risk, or a scope
call only Max can make).

## PRIME DIRECTIVE — universality (this is the #1 recurring failure)

The problem we keep hitting is **bad prompts: overly specific, or answerable only by someone with
a particular job / possession / biography.** Every prompt you generate or accept MUST pass this bar:

> **ANY adult can answer it truthfully from their own real life or common knowledge, within the
> response window, with no preparation.** No imagined meeting to construct, no required persona,
> credential, possession, hobby, or biographical event ("your band", "your startup's near-death",
> "the wedding you attended"), no jargon wall. The challenge is HOW they communicate, never
> understanding the prompt. 3-second test: the user thinks "I know exactly what I'd say" and starts
> speaking. If even one user would think "but that never happened to me," the prompt is invalid.

This rule is already codified as `CANON_RULES` in `src/lib/ai/prompt-gen.ts` and enforced by the
`verifyPromptsCanon` LLM judge. **Do not weaken it. Route every new/edited prompt through that judge
and drop anything it flags** (`required-setup`, `persona`, `not-universal`, `jargon-wall`,
`mechanic-mismatch`, `exam-tone`, `stacked-constraints`, `not-retryable`).

## Source of truth (read these first, in order)

1. `C:\Users\MaxVolkov\Downloads\Cognify System Change.md` (2.5MB full design doc) — esp.
   §5.5 Core Skill Framework, §5.6 Prompt Selection + **Prompt Design Principles**, the
   **Daily Work Engine V1** meta-prompt, §Step 3 Prompt Generation, the per-dimension Exercise
   sections and Prompt Banks, and The Lab / Application sections. This is the spec; follow it.
2. `docs/prompt-design-canon.md` — the authoring canon (3 rules, mechanic→prompt-shape table,
   good/bad examples). Non-negotiable.
3. `plans/prd/cognify-system-change-v2-2026-07.md` — repo PRD; §5.6, §9.3/§9.4, §11.3. Standing
   decision **D21: slate = 5 prompt options** (overrides the doc's 4/6). Terms map in
   `plans/prd/terminology-map.md`.
4. `src/lib/ai/prompt-gen.ts` — the generation engine (DO NOT rebuild). Entry points:
   `generatePrompts` (runtime slate top-up, topic-only refresh), `generatePromptPack` (full unit:
   coachInsight + prompts + scoringLens + retryObjective + commonFailureModes), `verifyPromptsCanon`
   (canon judge). Persistence/cache-back: `src/server/lib/prompt-gen-cache.ts`.
5. `scripts/exercise-catalog/` — the authoring manifests (see below). `README.md` documents the shape.
6. `scripts/expand-prompt-bank.ts` — offline batch generator (runs the SAME runtime gen+QA+cache-back
   pipeline over the catalog). `scripts/seed-exercise-catalog.mjs` — upserts manifests → DB.

## Current state (so you fill/scale, don't rebuild)

- The engine already implements the doc's Engine V1: per exercise it renders
  `rule → hidden_skills → coach_insight → prompt options → scoring_lens → retry_objective →
  common_failure_modes → prompt_rules`, varying ONLY topic. Prod already has ~4,148 active prompts.
- **Per-exercise criteria coverage** (`scripts/exercise-catalog/v1/`):
  - **6 core dimensions**: 62 exercises. `scoring_lens` / `common_failure_modes` / `coach_insight`
    / `retry_objective` = 62/62. **`prompt_rules` + `hidden_skills` = 57/62.**
  - **5 application skills** (storytelling, presenting, teaching, interviewing, persuasion) under
    `v1/applications/`: 40 exercises, fully authored (0 gaps).
  - `v1/general/`: 54 exercises, 1,080 static prompts, **no `prompt_rules`**.
  - `v1/vertical/`: 432 exercises, 4,324 static prompts, **no `prompt_rules`**.
- Manifest exercise fields (source of truth for "good-prompt criteria" per exercise):
  `dimension, name, rule, why, default_difficulty, ordering, tags, objective, hidden_skills,
  scoring_lens, coach_insight, secondary_core_skills, common_failure_modes, scoring_emphasis,
  retry_objective, prompt_rules, response_window, constraint_types, prompts`.

## Workstream 1 — Fill the criteria gaps (do first; no model spend)

Author the missing per-exercise "good-prompt criteria" so every generation target is fully specified:
1. The **5 Pressure archetypes** in `scripts/exercise-catalog/v1/pressure.json` (Pushback, Time
   Compression, Audience Switch, Clarifying Interrupt, Stakes Raise) are missing `prompt_rules` +
   `hidden_skills`. Author both, matching the shape of the fully-authored core exercises and drawing
   `hidden_skills` from the taxonomy (`src/types/sub-skills.ts`, incl. ≥1 primary-dimension skill).
2. Spot-audit the 57/62 core exercises: confirm every `prompt_rules` / `scoring_lens` actually
   encodes what makes a GOOD prompt for that exercise (audience/constraint/mechanic that pulls the
   skill), and that none smuggle in required setup or personas.
Then `node scripts/seed-exercise-catalog.mjs --dry-run`, review the diff, `--apply`.

## Workstream 2 — Add criteria to general/ and vertical/ (upgrade static banks to generation targets)

`v1/general/` (54) and `v1/vertical/` (432) are large static banks with no `prompt_rules`, so they
can't regenerate/top-up. Decide with Max whether to (a) author `prompt_rules` + `scoring_lens` +
`hidden_skills` + `common_failure_modes` + `retry_objective` per exercise so they become first-class
generation frameworks, or (b) leave `vertical/` as curated flavor and only upgrade `general/`.
When authoring, keep vertical banks **vertical-flavored, never vertical-locked** — subject matter and
reference points may lean toward the vertical, but required knowledge must not (PRD §11.3, CLAUDE.md).
Given 432 vertical exercises, do this dimension-by-dimension and canon-judge every batch.

## Workstream 3 — Grow the bank volume (costs Anthropic/OpenAI tokens — estimate + confirm first)

Use the EXISTING offline pipeline; do not write a new one:
```
npx tsx scripts/expand-prompt-bank.ts --dry-run                     # plan only
npx tsx scripts/expand-prompt-bank.ts --dim clarity --per-exercise 10 --apply
npx tsx scripts/expand-prompt-bank.ts --app storytelling --per-exercise 10 --apply
```
It runs generate → `verifyPromptsCanon` → cache-back for real. Before any `--apply` that hits the
model, **estimate token spend** (exercises × per-exercise × ~120 output tokens + QA) and get Max's
go-ahead — this account has hit quota before.

**Depth targets (current baseline → target):** core 6 dims ~16 → **~30/exercise**; applications
~12 → **~30**; general ~20 → **~25**; vertical ~10 → **keep lean ~10–15** (it's 432 exercises —
do NOT inflate to 30, that's ~13k prompts of flavor content at real dup/quality/token risk).
**Hard cap ~40/exercise; 25–35 is the sweet spot.**

**Quality-taper stop rule (most important):** the ceiling is distinct universal topics under a fixed
mechanic, not a number. Let the pipeline's own signals call it: when an exercise's batch comes back
with **>~30% `verifyPromptsCanon` rejects or dedup collisions** (the 80%-word-overlap guard in
`qaFilterPrompts`), that exercise is saturated — stop there regardless of the target. Report
generated-vs-rejected-vs-deduped counts per exercise so saturated exercises are visible.

## Guardrails

- **Shared prod DB:** dev `.env.local` and prod point at ONE Supabase DB. Run NO destructive scripts.
  `seed-exercise-catalog.mjs` and `expand-prompt-bank.ts` upsert idempotently — safe. Nothing else.
- **Provider budget:** Workstreams 1–2 are authoring (free). Workstream 3 spends tokens — estimate,
  confirm, and stop if a call returns a quota/`mock-fallback` signal.
- **QA is the gate, not vibes:** every generated OR newly-authored prompt goes through
  `verifyPromptsCanon`; reject on any violation. Prefer dropping a prompt to shipping a marginal one.
- **Never touch scoring prompts** (`src/lib/ai/score.ts`, `rubric*.ts`) — this job is prompts only,
  and those are calibration-guarded.

## Definition of done

- Every core + application + (agreed) general/vertical exercise has complete generation criteria
  (`prompt_rules`, `scoring_lens`, `hidden_skills`, `common_failure_modes`, `retry_objective`).
- Bank grown to the agreed depth per exercise; per-exercise generated/rejected counts reported.
- 100% of new prompts pass `verifyPromptsCanon`; a fresh audit sample shows none require setup,
  persona, jargon, or biography — the universality bar holds.
- `seed-exercise-catalog.mjs --apply` clean; typecheck + lint green; tracker
  (`plans/system-change-v2-progress.md`) updated; a concrete verify checklist handed to Max.
- Branch per change, PR + self-merge (Max authorized), no commits to main.
