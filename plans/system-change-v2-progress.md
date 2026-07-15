# System Change v2 — Progress Tracker

**Source of truth:** `plans/prd/cognify-system-change-v2-2026-07.md` (the July 2026 revision of the
Cognify System Change doc; supersedes `plans/prd/cognify-system-change-prd.md`, which drove the PRD v3
rebuild). Read the relevant PRD section in full before starting each phase.

**How to use this file:** one phase per work session (start each session by reading this file top to
bottom, then the PRD section(s) the phase cites). Update the checkboxes + session log as work lands.
Each phase ends with: `/code-review` → fix findings → PR → merge → prod verify checklist (listed per
phase) → check the phase off here. Never commit to main directly.

---

## What's new in the July 2026 doc vs the version already implemented

1. **§5.5 Skill Taxonomy** — expanded from ~34 hidden behaviors to **~149 hidden skills with
   definitions** (Clarity 23, Structure 23, Conciseness 22, Thinking Quality 29, Pacing 22, Tone 30).
2. **"Edits" section** — 12 dogfooding fixes for Build a Rep (configurable moments, notes/structure
   panel, stronger version, core-skill feedback, retry insights, post-rep nav, faster grading,
   playback on improvement review, photo upload, copy polish).
3. Everything else is carried over — for those areas the work is *implementation fidelity*, not new
   requirements.

## Decision log (D-records, confirmed by Max 2026-07-15)

- **D20 — Taxonomy: full adoption.** The doc's ~149-skill taxonomy becomes the canonical hidden-skill
  layer (types, exercise tagging, coaching attribution, profile storage). Deterministic scoring only
  where measurable; the rest LLM-attributed.
- **D21 — Prompt slate stays 5.** D10 stands; doc's 4/6 numbers treated as flexible.
- **D22 — Grading rethink: OpenAI primary, single unified grading pass ("all at once"), doc-guided
  rubric rewrite. Tone (and pacing) must be graded from AUDIO, not text alone** — design spike to pick
  audio-capable model vs enhanced prosody features. Anthropic becomes the fallback provider.
- **D23 — Legacy prompt System A retired.** Hardcoded banks (`src/lib/ai/prompts/*`) + rep-type
  planners migrated-or-deleted; the DB catalog (`cognify_v2.exercises`/`exercise_prompts`) is the only
  prompt system.

## Current-state map (from 2026-07-15 codebase audit)

- **Training engine v2** (insight → first rep → feedback → required retry → improvement review) built,
  flag-gated `FF_TRAINING_ENGINE_V2`; pure FSM `src/lib/workout/session-machine.ts`.
- **Daily Workout**: 6 core skills as muscle groups, assessment phase, weighted rotation, hidden-skill
  aware sampling (`src/server/lib/workout/assignment.ts`), slate=5, adaptive windows. Flag
  `FF_MUSCLE_GROUP_WORKOUT` (off in prod).
- **Skill Lab v2**: 5 applications × 8 exercises, 40 hidden application skills, adaptive selection
  (`src/server/lib/skill-lab/selection.ts`), 3/5/10 sessions, resume. Flag `FF_SKILL_LAB_APPS`.
- **Build a Rep v2**: prep events, 4–8 editable critical moments, guided + full simulation, readiness
  reviews, context uploads (pdf/docx/pptx/txt/md), cross-event memory. Flag `FF_BUILD_A_REP_V2`.
- **Grading**: unified hybrid pipeline (`src/lib/ai/score.ts` + `score-stages.ts`), two sequential
  LLM calls (Haiku), stage2 redoes RAG/prosody (+500ms), no streaming; deterministic pacing + 60/40
  thinking-quality blend; coaching memory; calibration drift cron + reference bank.
- **Prompts**: DB catalog ~94 exercises / 6,714 active prompts on dev after reseed+prune; **PROD still
  carries ~31k stale rows** (reseed+prune never promoted). Universality rule landed in the generator
  2026-07-07 (`src/lib/ai/prompt-gen.ts`); `docs/prompt-design-canon.md` is the authoring canon.
  Legacy System A banks (~1,275 hardcoded prompts) still in tree and corporate-skewed.
- **Progression** (rank 32 tiers, XP, committed-day streaks + freezes, achievements, leaderboards,
  weekly/team challenges, leagues) matches PRD §10 — no major work planned.

---

## Phases

### Phase 0 — Doc sync + taxonomy data ✅ done 2026-07-15
*PRD refs: whole doc; §5.5. Small phase, same session as planning is fine.*

- [x] 0.1 New PRD imported at `plans/prd/cognify-system-change-v2-2026-07.md` (done 2026-07-15)
- [x] 0.2 Extract §5.5 tables into structured data: `scripts/taxonomy/hidden-skills-v2.json`
      (`{dimension, id(snake_case), label, definition}`). **Actual doc counts: Clarity 23,
      Structure 23, Conciseness 22, Thinking Quality 28, Pacing 22, Tone 30 = 148 total** (the
      "~149" in the planning notes was an estimate; Thinking Quality table has 28 rows).
- [x] 0.3 `plans/prd/taxonomy-migration-map.md` written: 34 old ids → new ids (24 keep, 8 rename,
      2 move across dimension — old Tone prosody skills fold into `delivery`). No splits.
      Machine-readable copy: `scripts/taxonomy/migration-map.json`.
- [x] 0.4 `plans/prd/terminology-map.md` updated with D20–D23 rulings table.
- **Exit criteria:** ✅ JSON validates (unique ids, counts match tables), every old id mapped.
- **Verify after merge:** none user-facing (data-only).

### Phase 1 — Hidden Skill Taxonomy v2 (D20) ✅ done 2026-07-15
*PRD refs: §5.5, §8.3.5, §10.4. Fresh session. This underpins Phases 2–4 — do first.*

- [x] 1.1 `src/types/sub-skills.ts` now derives everything from generated
      `src/types/hidden-skills.generated.ts` (emitted by `scripts/taxonomy/generate-sub-skills.mjs`
      from the JSON). Kept `SUB_SKILL_TO_DIMENSION`/`SUB_SKILL_LABELS`; added
      `SUB_SKILL_DEFINITIONS`, `canonicalizeSubSkillId` (legacy-id bridge), per-dimension
      `renderSubSkillReference(dims?)` + `renderSubSkillReferenceWithDefinitions(dim)`.
- [x] 1.2 Profile migration applied to DEV (`drizzle/migrations/0041_hidden_skills_taxonomy_v2.sql`,
      idempotent DO-block; verified 0 old keys remain across 7 profiles). Belt-and-suspenders:
      `applyRepToProfile` canonicalizes legacy ids at fold time, so historical-rep evidence and
      backfills keep working. **Run 0041 on PROD during Phase 6.**
- [x] 1.3 `scripts/taxonomy/retag-exercises.mjs` (dry-run → `retag-proposals.json` → `--apply`,
      validation: 2–4 valid ids, ≥1 from primary dim, secondary dims allowed). NOTE: both
      Anthropic + OpenAI API keys were out of credits, so the 94 proposals were authored by Claude
      in-session (source:"manual" in the proposals file — reviewable) instead of via API; the
      script works once credits return. Manifests updated + `seed-exercise-catalog.mjs --apply`
      ran on dev (94 exercises updated, 0 prompt changes). Seed-script validation now reads the
      taxonomy JSON.
- [x] 1.4 Scoring prompt keeps the all-dimension labels-only SUB-SKILL REFERENCE block (bullets
      span dims) and adds a definitions block for ONLY the focus dimension in the MODE context;
      prompt-gen renders `HIDDEN SKILLS TRAINED` as label — definition lines.
- [x] 1.5 Mapper renamed to v2 ids; **dimension_fallback removed entirely** (D20: deterministic
      only where measurable, everything else LLM-attributed — with 148 skills, fallback copies
      would flood rep jsonb + profile). New genuine mappings: prosody fillerRatePerMinute →
      `filler_reduction`, WPM band → `rate_awareness`. Hume voice skills now split
      delivery (`prosodic_alignment`, `emphasis_timing`) / tone (`confidence`,
      `emotional_authenticity`, `gravitas`, `warmth`). Legacy System A banks/hints/exercises
      renamed in place (System A still dies in Phase 2).
- [x] 1.6 `tests/taxonomy.test.ts` (30 asserts: integrity, JSON↔generated sync, migration
      round-trip, profile fold incl. legacy keys + cross-dim moves, reference rendering) wired
      into `npm test`. Full suite + typecheck + lint green.
- **Exit criteria:** typecheck + tests green ✅; feedback-bullet attribution + profile check =
  Max's verify list below.
- **⚠️ Calibration guardrail:** the scoring prompt BYTES changed (new reference block + focus-dim
  definitions). Calibration suite could NOT be re-run this session — both Anthropic and OpenAI
  API keys are out of credits (retag hit the same wall). **Re-run
  `scripts/calibrate-with-signals.mjs` as soon as a provider is re-upped, before trusting scores
  for drift monitoring.** (Suite itself updated: dimension_fallback gate removed.)
- **Verify after merge (Max):** complete one dev workout rep → feedback bullets name plausible
  hidden skills for the trained dimension; `/progress` unaffected.

### Phase 2 — Prompt architecture overhaul (D21, D23) ⬜
*PRD refs: §5.6, §9 (all), Daily Workout Engine V1 + Lab Engine V1 sections, §11.3,
`docs/prompt-design-canon.md`. Fresh session. Likely the longest phase — 2.A and 2.B can be separate
sessions.*

**2.A — Generation engine rewrite**
- [ ] 2A.1 Rewrite `src/lib/ai/prompt-gen.ts` to the doc's engine specs: generation unit = core skill
      → hidden behaviors (from taxonomy v2) → coach's insight → 5 prompt options → scoring lens →
      retry instruction. Per-application rules from Lab Engine V1 (audience/setting/stakes required,
      structure implied, "theory implicitly never academically", no unrealistic roleplay, drawable
      from real experience). Keep + strengthen the universality hard rule.
- [ ] 2A.2 Prompt QA filter upgrade: add canon checks (no personas, no required setup, no jargon
      walls, answerable-by-anyone) as an LLM verification pass, not just regex.
- [ ] 2A.3 Regenerate/refresh exercise `coachInsight` / `scoringLens` / `retryObjective` where the
      doc provides better ones (doc's workout banks) — catalog manifest updates.
- **2.B — Bank content + legacy retirement**
- [ ] 2B.1 Seed the doc's new bank content (Core Skills Workout Bank exercises + prompt lists that
      aren't already in the catalog; doc's Clarity prompt bank has ~32 new "Explain Like I'm 12"
      prompts etc.).
- [ ] 2B.2 Universality audit of the ACTIVE catalog: LLM audit pass over all 6,714 active prompts
      against the canon; deactivate violators (extend `prune-canon-violators.mjs`).
- [ ] 2B.3 Retire System A: identify any legacy bank prompts worth keeping → migrate into catalog
      manifests; delete `src/lib/ai/prompts/*`, rep-type planners in `workout-prompts.ts`, and dead
      call sites (grep for `WORKOUT_PROMPTS`, `PRESSURE_PROMPTS`, `VERTICAL_PROMPTS`,
      `planTodaysWorkout`). Keep pressure archetypes if the v2 engine still uses them (it does —
      graduation reps); relocate their prompts into the catalog.
- [ ] 2B.4 Reseed + prune on dev; record counts here.
- **Exit criteria:** generator emits doc-conformant packs (spot-check 10 per dimension + 5 per
  application); zero legacy bank imports; dev catalog clean.
- **Verify after merge (Max):** refresh prompt slates across 3 dimensions + 2 Lab applications on
  dev — every prompt answerable by anyone, topics spread beyond workplace, refresh never repeats.

### Phase 3 — Grading rethink (D22) ⬜
*PRD refs: §4.5–4.7, §8.6, §11.4–11.5, exercise scoring lenses. Fresh session. Design-first: write
`plans/prd/grading-v3-design.md` and get Max's sign-off on the design BEFORE implementation
(provider/model choice, audio-grading approach, cost + latency budget, calibration plan).*

- [ ] 3.1 **Design spike — audio tone grading.** Evaluate: (a) OpenAI audio-input model scoring
      tone+pacing directly from the recording, (b) enhanced prosody feature extraction (pitch
      variation, end-of-sentence inflection ratio, volume emphasis, WPM bands) feeding the text
      grader. Compare on ~10 reference reps with known tone quality. Decide + document.
- [ ] 3.2 Provider flip: OpenAI primary for scoring, Anthropic fallback (invert `AI_PROVIDER`
      handling in `src/lib/ai/claude.ts`; pick current best OpenAI model for structured scoring).
- [ ] 3.3 **Single unified grading pass** ("all at once"): one call producing scores + all feedback
      copy (kills the two-stage sequential latency + stage2 context rework). Fold in: doc-rewritten
      rubric (per-dimension definitions + scoring lens + edge-case rules), taxonomy-v2 attribution,
      implementation review for retries.
- [ ] 3.4 **Stronger Version (§4.6, Edit #5):** grading output includes a stronger version of what
      the user actually said (their content, upgraded — not a generic exemplar), shown on feedback +
      carried into retry screen.
- [ ] 3.5 Latency work: measure p50/p95 before/after; prosody + RAG stay parallel; audio path must
      not regress total time beyond current baseline (budget in design doc).
- [ ] 3.6 Recalibration: rebuild reference baselines on the new pipeline (audio fixtures needed if
      3.1 chooses audio-in grading — record or synthesize reference audio). Update drift cron
      tolerances for the new provider.
- [ ] 3.7 Simplify: delete two-stage code paths once single-pass is stable (stage1/stage2 routes,
      `score-stages.ts`) — keep `score-internal` for the async worker.
- **Exit criteria:** calibration suite within tolerance on new pipeline; p95 grading time recorded
  and improved; tone scores demonstrably react to delivery (test: same script read flat vs expressive
  scores differently).
- **Verify after merge (Max):** grade 3 reps on dev — feedback arrives noticeably faster, includes
  stronger version, tone score changes when you deliberately speak in monotone vs with energy.

### Phase 4 — Build a Rep edits (the 12) + coaching quality ⬜
*PRD refs: "Edits" section, §7, §4.6–4.7. Fresh session. Depends on Phase 3 (stronger version,
grading speed already fixed there).*

- [ ] 4.1 (#2) Moment intake honors user-specified questions: when the description names specific
      questions/moments, generate ONLY those + clearly-offered "add more" suggestions; full
      configurability (already have add/rename/reorder/delete — fix generation respecting intent).
- [ ] 4.2 (#3) Rep screen redesign: show just the user's question/moment title as the prompt; add
      side notes panel with AI-generated editable speaking structure (persisted per moment).
- [ ] 4.3 (#1) Context upload: accept images (photo library) — vision parse to text; fix `accept`
      attr (already missing `.pptx`).
- [ ] 4.4 (#5/#7/#8) Coaching quality: coach's focus grounded in user's transcript with actionable
      retry insights; implementation-rep insights must be event-relevant (interview prep ≠ generic);
      improvement review reports core-skill movement + how well feedback was implemented + what to
      do next rep.
- [ ] 4.5 (#6) Core-skill feedback always present in Build a Rep feedback panel (audit why it was
      absent; likely feedbackVariant/v2 gap).
- [ ] 4.6 (#10) Post-rep options everywhere in BaR: Retry / Next moment / Back to plan / Exit —
      audit each screen's CTA set.
- [ ] 4.7 (#12) Recording playback on Improvement Review + Readiness Review screens.
- [ ] 4.8 (#4/#9) Copy pass: plain language, no em-dashes, no jargon; "events" section headers;
      kill the "0 critical moments" state (show real count or better empty state).
- [ ] 4.9 Session summary header (#1's second half): cleaner "what I'm practicing" framing.
- **Exit criteria:** all 12 edits addressed or explicitly deferred with reason logged here.
- **Verify after merge (Max):** run a full BaR flow on dev: create event naming 3 specific questions
  → plan shows exactly those 3 → rep screen shows question + notes panel → feedback has core skills +
  stronger version → improvement review has playback → post-rep offers retry/next/exit.

### Phase 5 — Doc-fidelity pass: Skill Lab + Daily Workout + engine ⬜
*PRD refs: §4, §5, §6, §8.5. Fresh session. Smaller "sweep" phase.*

- [ ] 5.1 Cross-check every §4 design decision against the shipped loop (insight consumable in
      seconds, single coach objective, score movement visibility, next-actions).
- [ ] 5.2 §5.7 Workout Complete + §6.8 Session Complete field-by-field audit (coach recommendation
      quality, most-improved logic, reps earned).
- [ ] 5.3 §8.5 content selection principles audit (intentional variety, content memory, assessment
      coverage) — confirm selection engines honor them; fix gaps.
- [ ] 5.4 Copy sweep for doc terminology (Core Skills, Coach's Focus, Communication Score labels).
- **Verify after merge (Max):** one full Daily Workout + one 3-exercise Lab session on dev feel
  doc-conformant end to end.

### Phase 6 — Production promotion ⬜
*Refs: `plans/prod-promotion-runbook.md`, `plans/project_vercel-env-newline-gotcha` memory. Fresh
session. Requires Max + coordination on prod (Bob per earlier handoffs).*

- [ ] 6.1 Prod reseed + prune (`seed-exercise-catalog` + general + vertical seeds, then
      `prune-stale-prompts --generated --orphaned`, `prune-prompts`) — record before/after counts.
- [ ] 6.2 Flag promotion: enable `FF_MUSCLE_GROUP_WORKOUT`, `FF_TRAINING_ENGINE_V2`,
      `FF_SKILL_LAB_APPS`, `FF_BUILD_A_REP_V2`, `FF_PROMPT_GEN` in prod (beware trailing-newline env
      gotcha — verify with `vercel env pull` + grep, then smoke a flag-dependent surface).
- [ ] 6.3 Prod smoke matrix (see `plans/smoke-matrix.md`) + calibration drift green on new grading.
- [ ] 6.4 Post-promotion watch: scoring telemetry p95, drift cron next 3 nights, error rates.
- **Verify (Max, on prod):** full workout, Lab session, and BaR event end to end; prompt slates
  general + fresh; grading fast; tone reacts to delivery.

---

## Session log

- **2026-07-15** — Planning session. Read July 2026 PRD in full; 6-agent codebase audit (prompts,
  grading, Skill Lab, Daily Workout, Build a Rep, schema/progression); delta analysis vs implemented
  PRD v3; decisions D20–D23 confirmed with Max; this tracker created; new PRD imported to
  `plans/prd/cognify-system-change-v2-2026-07.md`. Next: Phase 0 remainder (taxonomy JSON extraction)
  — can run in a fresh session.
- **2026-07-15 (session 2)** — Phases 0 + 1 shipped on `feat/system-change-v2`. Actual taxonomy
  count is 148 (Thinking Quality table has 28 rows, not 29). Dev DB migrated (profiles + 94
  re-tagged exercises). Two external blockers logged: (1) calibration replay pending API credits
  (see Phase 1 guardrail note), (2) exercise re-tag proposals authored in-session instead of via
  API for the same reason. `/code-review` high (8 finder angles + adversarial verify) surfaced 10
  verified findings — 9 fixed in commit 300843e1, headline items: legacy-id canonicalization was
  missing at every historical read boundary (sub-skill averages window, OutcomeCard chips, retry
  context, prompt-gen, scoring normalizer), the ACTIVE two-stage dev scoring path had no
  sub-skill reference/normalization at all, degenerate recordings could inject junk deterministic
  scores into the profile, calibrate-prosody could never pass post-v2, and 10 tone drills were
  tagged with unreachable delivery skills. PR #5 opened; merge = Max (review required). Deferred
  cleanup (not bugs): consolidate the 3 script-side taxonomy loaders/validators + pacing→delivery
  alias maps into one shared scripts/taxonomy lib — fold into Phase 2's tooling rewrite. Next:
  Phase 2 (prompt architecture overhaul, D21+D23) in a fresh session.
