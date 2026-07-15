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

### Phase 0 — Doc sync + taxonomy data ✅ planned / ⬜ done
*PRD refs: whole doc; §5.5. Small phase, same session as planning is fine.*

- [ ] 0.1 New PRD imported at `plans/prd/cognify-system-change-v2-2026-07.md` (done 2026-07-15)
- [ ] 0.2 Extract §5.5 tables into structured data: `scripts/taxonomy/hidden-skills-v2.json`
      (`{dimension, id(snake_case), label, definition}` × ~149). Verify counts per dimension against
      the doc tables.
- [ ] 0.3 Write `plans/prd/taxonomy-migration-map.md`: old 34 sub-skill ids → new ids (rename / keep /
      split), so profile `hiddenSkills` data can migrate without losing history.
- [ ] 0.4 Update `plans/prd/terminology-map.md` with D20–D23.
- **Exit criteria:** JSON validates, every old id has a mapping, doc counts match.
- **Verify after merge:** none user-facing (data-only).

### Phase 1 — Hidden Skill Taxonomy v2 (D20) ⬜
*PRD refs: §5.5, §8.3.5, §10.4. Fresh session. This underpins Phases 2–4 — do first.*

- [ ] 1.1 Replace `src/types/sub-skills.ts` with generated types from `hidden-skills-v2.json`
      (keep `SUB_SKILL_TO_DIMENSION`, `SUB_SKILL_LABELS`, add `SUB_SKILL_DEFINITIONS`).
- [ ] 1.2 Profile migration: fold old `communication_profile.hiddenSkills` keys through the
      migration map (script + drizzle migration; jsonb keys only, no enum changes).
- [ ] 1.3 Exercise re-tagging: LLM-assisted script proposes `hiddenSkills` tags for all ~94 exercises
      from the new taxonomy (2–4 skills each); human-reviewable diff (`--dry-run` → JSON) before
      `--apply`. Update catalog JSON manifests too (source of truth).
- [ ] 1.4 Update `renderSubSkillReference()` and every prompt that enumerates sub-skills to use
      definitions (scoring, coaching attribution, prompt-gen). Token-budget check: don't dump all 149
      into every call — render only the active dimension's skills.
- [ ] 1.5 Update signal mapper `mapSignalsToSubSkillScores` for renamed ids; add deterministic
      mappings only where signals genuinely measure the skill (filler→filler_reduction, wpm→rate
      awareness, etc.). Everything else = LLM-attributed.
- [ ] 1.6 Tests: taxonomy integrity (unique ids, dimension totals), migration-map round trip,
      profile fold with new keys.
- **Exit criteria:** typecheck + tests green; a scored dev rep attributes new-taxonomy skills in
  feedback bullets; profile shows migrated hidden skills.
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
