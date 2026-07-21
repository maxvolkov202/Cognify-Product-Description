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
- **D24 — Score-movement softening kept (confirmed by Max 2026-07-17, Phase 6).** Owen C10's
  `softenScoreDelta` hides the raw numeral for large single-attempt drops (delta < −3 → soft coaching
  copy; −3…0 → shown neutral; ≥ +1 → celebrated). This resolves the PR #11 conflict with PRD §4.7's
  "score movement should be highly visible": Max's ruling is that "highly visible" governs improvement,
  while a noisy retry's large negative reads as "this system is bogus" and is softened. Direction is
  always shown; only the numeral for a big drop is withheld. Do NOT restore visible large negatives.
  PRD §4.7.2 amended with the display rule so code and doc agree.

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
- **Prompts**: DB catalog 102 exercises / **4,148 active prompts** (38,962 total; the rest deactivated,
  reversible `is_active=false`). **This IS the prod catalog** — dev `.env.local` and prod Vercel point at
  ONE Supabase DB, so Phase 2's reseed+prune (session 4) already promoted to prod; the earlier "~31k
  stale rows never promoted" note is obsolete (verified 2026-07-17 in Phase 6: 0 exercises below the
  slate floor). Universality rule landed in the generator 2026-07-07 (`src/lib/ai/prompt-gen.ts`);
  `docs/prompt-design-canon.md` is the authoring canon. Legacy System A banks retired in Phase 2 (D23).
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
  definitions). **Replay RAN 2026-07-15 (session 3) after Max refilled OpenAI credits** — serving
  provider was gpt-4o (Anthropic still dead), so the measurement is provider-shift + prompt-shift
  combined against Anthropic-Haiku-era baselines: **0/48 reps within ±5**; per-dim mean drift
  modest (+1.3 structure … +11.3 conciseness) but variance huge (−40…+52). Verdict: baselines are
  UNUSABLE while OpenAI serves; a clean re-baseline is Phase 3's job (D22 flips provider
  officially + rubric rewrite + recalibration 3.6). Until then treat drift-cron alerts as noise.
  Raw results: session scratchpad `calibration-full.json`; harness now needs
  `CALIBRATION_GUEST_ID=<uuid>` env (auth gate on /api/score).
- **Verify after merge (Max):** complete one dev workout rep → feedback bullets name plausible
  hidden skills for the trained dimension; `/progress` unaffected.

### Phase 2 — Prompt architecture overhaul (D21, D23) ⬜
*PRD refs: §5.6, §9 (all), Daily Workout Engine V1 + Lab Engine V1 sections, §11.3,
`docs/prompt-design-canon.md`. Fresh session. Likely the longest phase — 2.A and 2.B can be separate
sessions.*

**2.A — Generation engine rewrite**
- [x] 2A.1 `src/lib/ai/prompt-gen.ts` rewritten to the doc's engine specs (session 4, 2026-07-15):
      generation unit = core skill → hidden behaviors (taxonomy v2, labels + definitions) → coach's
      insight → 5 prompt options (D21) → scoring lens → retry instruction, all rendered as
      generation context when authored (conditional rendering — unauthored fields render nothing).
      Per-application Lab Engine V1 rule blocks (storytelling/presenting/teaching/interviewing/
      persuasion). Universality hard rule kept + merged with the canon (3-second test, no personas,
      no jargon walls, one challenge, retryable) into a CANON_RULES block shared by generator AND
      judge so they can't drift. New `generatePromptPack` emits the full unit for tooling.
- [x] 2A.2 LLM canon verification pass: `verifyPromptsCanon` (same CANON_RULES; violation tags
      required-setup/persona/not-universal/jargon-wall/mechanic-mismatch/exam-tone/
      stacked-constraints/not-retryable). Wired into `generateAndCachePrompts` — runtime top-up
      prompts are canon-screened before becoming permanent bank members (fail-open on judge outage
      so a verify failure never empties a slate; unjudged indices fail closed).
- [x] 2A.3 Coach-field refresh from the doc: 3 coach_insight updates (explain-like-im-12,
      the-3-point-rule, the-so-what-test — doc's lines were more canonical); other 21 matched
      exercises kept (catalog versions more behavioral). **Zero scoring_lens changes on existing
      exercises** (doc lenses are academic dimension-level prose; catalog lenses are operator
      constraints). ⚠️ calibration note: coach_insight byte-changes on those 3 exercises + 3 brand-new
      exercises' lens blocks — no existing reference rep renders the new blocks; baselines already
      unusable pending Phase 3 re-baseline.
- **2.B — Bank content + legacy retirement**
- [x] 2B.1 Doc bank content merged (session 4): 3 new exercises (pacing "The Speed Shift", tone
      "The Emotional Dial" + "The Resonance Rep", full pack fields + 15 prompts each), 62 prompts
      merged into matching exercises (ELI12 32, Analogy Bridge 18, No Jargon 1, One Point Only 3,
      Word Budget 3 — 75-word suffix dropped to match the exercise's 30-word rule, flagged for Max —
      Story Arc 1, Bottom Line First 2, Monroe's 1, Claim and Proof 1, interviewing "Why This, Why
      You" 1). Skipped with reasons: teaching + persuasion workout one-liners (need supplied reading
      material), six-word-story (no storytelling exercise has a delivery-pause mechanic), doc's
      "Rhythm Check" (catalog "Tempo Shift" already covers the mechanic).
- [x] 2B.2 LLM universality audit tooling: `scripts/audit-canon-llm.ts` (new — complements the
      regex-only `prune-canon-violators.mjs` rather than extending it) runs `verifyPromptsCanon`
      over every active prompt, deactivates violators (`is_active=false`), fail-closed on judge
      failures, pressure-bank exempt (light-scenario genre, canon-screened at relocation).
      **Run + counts recorded in 2B.4.**
- [x] 2B.3 System A retired (D23): deleted `src/lib/ai/prompts/*` (~3,600 lines), rep-type planners
      in `workout-prompts.ts`, `exercises.ts` named-drill registry, bank tooling
      (generate-prompts/triage-prompts.mjs). Catalog-backed replacement: pure
      `src/lib/workout/lab-plan.ts` + `planLabSession` server action (rotation, preferSubSkill bias,
      pressure slot at N-1, flow ramp). Cutovers: /drills + /skill-lab (SkillLabClient async
      planning), prompt-select Refresh (re-slates from the slot's catalog exercise via
      fetchPromptCandidates — session exclusion + generated top-up now apply there too), /try,
      legacy Build-a-Rep (catalog vertical tags via `pickVerticalPrompts`), dashboard drill CTAs
      (all 6 dims drillable now). KEPT: rep-types.ts (framework scaffolds/budgets),
      frameworks-rep-variants, pressure-archetypes (scoring weight profiles). Pressure prompt bank
      relocated into the catalog as `v1/pressure.json` (application='pressure', one exercise per
      archetype, keyed by archetype id in application_skills — invisible to Daily Workout/Skill Lab
      queries). Tests rewritten against the pure builders (session-types, pressure-orchestrator;
      dna-signals trimmed of deleted-registry sections).
- [x] 2B.4 Reseed + audit on dev (= PROD DB — same Supabase instance), 2026-07-15 session 4:
      seed --apply → 8 new exercises (3 core + 5 pressure), 3 updated (coach_insight), 222 new
      prompts; catalog then 102 active exercises / 6,936 active prompts. LLM canon audit --apply
      (gpt-4o-mini judge, curated-manifest + pressure exempt) deactivated **2,788 Wave-era
      violators** (clarity 475, structure 406, conciseness 429, thinking_quality 496, pacing 555,
      tone 427; top tags jargon-wall + not-universal + persona) → **4,148 active prompts**, zero
      exercises below 8 active (slate floor is 5; FF_PROMPT_GEN top-up self-heals thin banks).
      Deactivation is reversible (is_active=false; details in audit-canon-results-*.json).
- **Exit criteria:** generator emits doc-conformant packs (spot-check 10 per dimension + 5 per
  application); zero legacy bank imports; dev catalog clean.
- **Verify after merge (Max):** refresh prompt slates across 3 dimensions + 2 Lab applications on
  dev — every prompt answerable by anyone, topics spread beyond workplace, refresh never repeats.

### Phase 3 — Grading rethink (D22) ✅ (2026-07-17, feat/grading-v3 — two items blocked on API credits, see session-5 log)
*PRD refs: §4.5–4.7, §8.6, §11.4–11.5, exercise scoring lenses. Fresh session. Design-first: write
`plans/prd/grading-v3-design.md` and get Max's sign-off on the design BEFORE implementation
(provider/model choice, audio-grading approach, cost + latency budget, calibration plan).*

- [x] 3.1 **Design spike — audio tone grading.** Evaluate: (a) OpenAI audio-input model scoring
      tone+pacing directly from the recording, (b) enhanced prosody feature extraction (pitch
      variation, end-of-sentence inflection ratio, volume emphasis, WPM bands) feeding the text
      grader. Compare on ~10 reference reps with known tone quality. Decide + document.
- [x] 3.2 Provider flip: OpenAI primary for scoring, Anthropic fallback (invert `AI_PROVIDER`
      handling in `src/lib/ai/claude.ts`; pick current best OpenAI model for structured scoring).
- [x] 3.3 **Single unified grading pass** ("all at once"): one call producing scores + all feedback
      copy (kills the two-stage sequential latency + stage2 context rework). Fold in: doc-rewritten
      rubric (per-dimension definitions + scoring lens + edge-case rules), taxonomy-v2 attribution,
      implementation review for retries.
- [x] 3.4 **Stronger Version (§4.6, Edit #5):** grading output includes a stronger version of what
      the user actually said (their content, upgraded — not a generic exemplar), shown on feedback +
      carried into retry screen.
- [x] 3.5 Latency work: measure p50/p95 before/after; prosody + RAG stay parallel; audio path must
      not regress total time beyond current baseline (budget in design doc).
- [x] 3.6 Recalibration: rebuild reference baselines on the new pipeline (audio fixtures needed if
      3.1 chooses audio-in grading — record or synthesize reference audio). Update drift cron
      tolerances for the new provider.
- [x] 3.7 Simplify: delete two-stage code paths once single-pass is stable (stage1/stage2 routes,
      `score-stages.ts`) — keep `score-internal` for the async worker.
- **Exit criteria:** calibration suite within tolerance on new pipeline; p95 grading time recorded
  and improved; tone scores demonstrably react to delivery (test: same script read flat vs expressive
  scores differently).
- **Verify after merge (Max):** grade 3 reps on dev — feedback arrives noticeably faster, includes
  stronger version, tone score changes when you deliberately speak in monotone vs with energy.

### Phase 4 — Build a Rep edits (the 12) + coaching quality ✅ (2026-07-17, feat/bar-edits)
*PRD refs: "Edits" section, §7, §4.6–4.7. Fresh session. Depends on Phase 3 (stronger version,
grading speed already fixed there).*

- [x] 4.1 (#2) Moment intake honors user-specified questions: when the description names specific
      questions/moments, generate ONLY those + clearly-offered "add more" suggestions; full
      configurability (already have add/rename/reorder/delete — fix generation respecting intent).
- [x] 4.2 (#3) Rep screen redesign: show just the user's question/moment title as the prompt; add
      side notes panel with AI-generated editable speaking structure (persisted per moment).
- [x] 4.3 (#1) Context upload: accept images (photo library) — vision parse to text; fix `accept`
      attr (already missing `.pptx`).
- [x] 4.4 (#5/#7/#8) Coaching quality: coach's focus grounded in user's transcript with actionable
      retry insights; implementation-rep insights must be event-relevant (interview prep ≠ generic);
      improvement review reports core-skill movement + how well feedback was implemented + what to
      do next rep.
- [x] 4.5 (#6) Core-skill feedback always present in Build a Rep feedback panel (audit why it was
      absent; likely feedbackVariant/v2 gap).
- [x] 4.6 (#10) Post-rep options everywhere in BaR: Retry / Next moment / Back to plan / Exit —
      audit each screen's CTA set.
- [x] 4.7 (#12) Recording playback on Improvement Review + Readiness Review screens.
- [x] 4.8 (#4/#9) Copy pass: plain language, no em-dashes, no jargon; "events" section headers;
      kill the "0 critical moments" state (show real count or better empty state).
- [x] 4.9 Session summary header (#1's second half): cleaner "what I'm practicing" framing.
- **Exit criteria:** all 12 edits addressed or explicitly deferred with reason logged here.
- **Verify after merge (Max):** run a full BaR flow on dev: create event naming 3 specific questions
  → plan shows exactly those 3 → rep screen shows question + notes panel → feedback has core skills +
  stronger version → improvement review has playback → post-rep offers retry/next/exit.

### Phase 5 — Doc-fidelity pass: Skill Lab + Daily Workout + engine ✅ (2026-07-17, feat/doc-fidelity-sweep)
*PRD refs: §4, §5, §6, §8.5. Fresh session. Smaller "sweep" phase.*

- [x] 5.1 Cross-check every §4 design decision against the shipped loop (insight consumable in
      seconds, single coach objective, score movement visibility, next-actions).
- [x] 5.2 §5.7 Workout Complete + §6.8 Session Complete field-by-field audit (coach recommendation
      quality, most-improved logic, reps earned).
- [x] 5.3 §8.5 content selection principles audit (intentional variety, content memory, assessment
      coverage) — confirm selection engines honor them; fix gaps.
- [x] 5.4 Copy sweep for doc terminology (Core Skills, Coach's Focus, Communication Score labels).
- **Verify after merge (Max):** one full Daily Workout + one 3-exercise Lab session on dev feel
  doc-conformant end to end.

### Phase 6 — Production promotion 🟡 (2026-07-17 session 9 — code deployed + verified; 3 items need Max)
*Refs: `plans/prod-promotion-runbook.md`, `plans/project_vercel-env-newline-gotcha` memory. Fresh
session. Requires Max + coordination on prod (Bob per earlier handoffs).*

- [x] 6.1 Prod reseed + prune — **already applied via the shared DB in Phase 2** (dev = prod DB). Verified
      2026-07-17: 102 exercises / 4,148 active prompts / 0 exercises below the slate floor. Did NOT
      hard-delete the 34.8k `is_active=false` rows — deactivation is deliberately reversible and they
      don't serve; a hard prune is optional table hygiene, deferred to preserve reversibility.
- [x] 6.2 Flag promotion — the 5 v2 flags were **already `true` in prod** (set 10–51d ago in earlier
      deploys; the tracker's "off in prod" notes were stale). Only change needed + made:
      `FF_PROSODY_WORKER` was wrongly `true` → set to `false` (Max: prosody worker not deployed to prod;
      `vercel env rm` then `add --value false --no-sensitive --yes`, verified via `env pull`). `AI_PROVIDER=openai`
      confirmed. `NEXT_PUBLIC_USE_ASYNC_SCORING=false` in prod (so the sync `/api/score` path serves everyone).
- [x] 6.3 Prod smoke matrix — **non-auth critical items green** on `cognify-v2-neon.vercel.app`: `/` 200 +
      all 6 security headers (CSP/HSTS/Permissions-Policy `microphone=(self)`/X-Frame-Options DENY/etc.),
      `/try` + `/dashboard` 200 (no 500), scoring health OpenAI. **SIGNALS score-compression bug confirmed
      FIXED in prod:** band reps spread 17→73 (poor=17, below=34, competent-exceptional 71–73), real
      gpt-4o (`openai:gpt-4o-2024-08-06`), rubric v4.0.0, 0 calibration failures. ⛔ **Auth + mic items
      (matrix #3–#17: Google/email sign-in, workout golden path recording) need Max** — require real
      credentials + a mic + a connected browser.
- [ ] 6.4 Post-promotion watch (Max): scoring telemetry p95, drift cron next 3 nights, error rates.
      **Drift cron pre-validated green 2026-07-17** (`GET /api/cron/calibration-drift?dryRun=1` on the v4
      pipeline): 29/29 reps ok, 0 drift, 0 fallback, avg |Δcomposite| 2.03 (gate >5), worst 5 (gate >15),
      alert skipped. The cron alerts on COMPOSITE drift only (stable ±6), not per-dim noise (±15), so the
      gpt-4o per-dim noise floor won't false-alarm. Max still watches the real nightly runs, but the
      "hold until one run passes" condition is effectively met.
- [x] `supabase functions deploy process-rep` — **DONE 2026-07-17** (Max supplied a token; deployed
      to project `dunnoccrvrqzsgxsfjuv`, status ACTIVE v1, current v4 code = audioUrl forwarding +
      coachFocus/feedback writes). Stays off the critical path until `NEXT_PUBLIC_USE_ASYNC_SCORING`
      is flipped on (deliberately left off — enabling async is a separate, separately-validated change).
- **⛔ Remaining follow-ups (need Max):**
  - Deploy the prosody worker to prod (`modal deploy` + set `FF_PROSODY_WORKER`/`PROSODY_WORKER_URL`) — Max
    does this as a follow-up; until then prod tone stays on the text-conservative tier (no breakage).
  - Drift cron judgment — hold until one nightly run passes on the new pipeline.
  - Anthropic fallback low on credits — **intentional (Max 2026-07-17: OpenAI-only, Anthropic not used).**
    The dead fallback only costs the second hop; no action needed.
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
- **2026-07-15 (session 3) — prod promotion of Phases 0+1.** Max refilled OpenAI credits and
  authorized self-merge. PR #5 merged; hotfix PR #6 merged (role-aware OpenAI PRIMARY scoring
  timeout 45s — prod was timing out gpt-4o at the 15s fallback-tuned budget, cascading to dead
  Anthropic → mock scores). Deployed twice to prod (cognify-v2-neon.vercel.app, final dpl on
  merge 4f38aff6). **Discovery: dev `.env.local` and prod Vercel point at the SAME Supabase DB**
  (postgres.dunnoccrvrqzsgxsfjuv) — so migration 0041 + the 94-exercise re-tag were already
  live for prod; 0041 re-applied idempotently via apply-prod-migration.mjs. Prod env already had
  `AI_PROVIDER=openai`. Calibration replay ran (see Phase 1 note). Prod smoke: pages 200, real
  scoring at ~20s via gpt-4o, dims sane. **One item needs Max (prod flag write blocked for the
  agent):** bullet sub-skill attribution on prod returns null because
  `FF_DETERMINISTIC_SIGNALS=false` there — reproduced locally: with the flag off, gpt-4o stops
  emitting `subSkill` (the SIGNALS block's presence is what cues attribution). To enable:
  `vercel env rm FF_DETERMINISTIC_SIGNALS production --yes && printf 'true' | vercel env add
  FF_DETERMINISTIC_SIGNALS production` then `vercel deploy --prod` (percent already 100; the
  taxonomy-v2 mapper is evidence-gated so the old fallback-flooding risk is gone). Also worth a
  password rotation: the prod DATABASE_URL (incl. password) got echoed into a local session
  transcript by a node error during env plumbing.
- **2026-07-15 (session 4) — Chore: prod FF_DETERMINISTIC_SIGNALS flip + Phase 2 (prompt
  architecture overhaul, D21+D23) on `feat/prompt-architecture-v2`.**
  - **Prod flag flip DONE + smoked:** two gotchas beyond the known newline one — (1) piping
    `printf 'true'` (no trailing newline) into `vercel env add` stores an EMPTY value (CLI 56
    readline discards a non-newline-terminated line); (2) stdin-piped adds are created as
    write-only "Sensitive" vars, so `env pull` can't verify them. Reliable pattern:
    `vercel env add NAME production --value true --no-sensitive --yes`, then env pull shows the
    exact bytes. Smoke: POST /api/score with guest cookie → 4/4 bullets carry v2 subSkill ids
    (~14s, gpt-4o). Note: `modelVersion` in score responses is a hardcoded constant
    (MODEL_VERSIONS.scoring, claude-haiku id) — NOT the serving model; /api/score/health shows
    the real provider.
  - **Phase 2 shipped** (2A.1–2B.3 checked above; 2B.4 counts below). Legacy-planner behaviors
    preserved on purpose: Build→Stress→Reinforce pressure slot at N-1 (4+ rep sessions), flow
    ramp archetype order, framework rotation. Behavior changes to know about: Focus Drills
    header now names the CATALOG exercise (was rep-type displayTitle); prompt-select Refresh is
    async from the catalog (session exclusion + generated top-up now apply there); /try serves a
    random intro conciseness catalog prompt; legacy BaR slates come from catalog vertical tags.
    Smoked via direct server-action POSTs on dev: focus/clarity plan (exercise rotation +
    doc-merged prompts in slates) and pressure plan (ramp order, relocated pressure exercises,
    correct budgets) both green; /try serving varied catalog prompts.
  - **Chore 2 (credential maintenance) skipped by Max's instruction this session** ("we don't
    need that yet, focus on builds").
  - Deferred/flagged: Word Budget doc prompts say "75 words max" but the exercise rule is 30
    words — doc suffix dropped, needs Max ruling if 75-word variant wanted; six-word-story +
    read-and-teach one-liners skipped (see 2B.1); SkillLabSession reps now record exerciseId
    (was null for legacy Skill Lab reps).
  - **/code-review high (8 finder angles + verify) → 10 verified findings, all fixed** in commit
    6d2d2425. Headliners: unclamped planLabSession counts (public action, unbounded DB/LLM work);
    canon-verdict schema capped below the judge's own tag count (a maximally-tagged verdict
    failed the batch and the runtime path failed OPEN, caching condemned prompts); vertical
    picker could return an empty Build-a-Rep slate; seen-ids cap kept FIRST 500 (heavy users got
    repeat slates on refresh); mixed sessions lost interleaving and wrongly gained a pressure
    rep; the pressure bank could create a phantom profile.applications['pressure']; pressure
    slots rendered the wrong scaffold; pressure ramp always started at time_compression. Also:
    pure planning logic extracted to src/server/lib/lab-session-planning.ts (+tests), slates
    parallelized per exercise group, pacing↔delivery alias consolidated into
    dimension-aliases.ts, em-dash copy fixed in new catalog content (reseeded: 3 new rows, 3
    orphans deactivated — active count still 4,148).
  - Known non-blockers: /try uses ORDER BY random() over the filtered intro-conciseness pool
    (small set, marketing page); audit exemption matches curated manifests by normalized TEXT
    (provenance tags would be sturdier — future improvement); stripFences is the codebase's 7th
    fence-stripper (consolidation deferred); prompt-gen-cache still runs the canon judge
    inline on the user-blocking top-up path (quality-over-latency, top-up is rare).
- **2026-07-16/17 (session 5) — Phase 3: Grading rethink (D22) on `feat/grading-v3`.**
  - **Spike verdict (3.1): enhanced DSP prosody wins.** OpenAI audio-in models (gpt-audio,
    gpt-audio-1.5, gpt-audio-mini) cannot discriminate prosody in structured text-output scoring
    (identical tone for flat AND expressive clips); the Praat-worker DSP block through the text
    grader separated tone 25–38 pts. Full record: `plans/prd/grading-v3-design.md` +
    `plans/spike-audio-grading-results.json`; 15 validated fixtures (PSOLA pitch-flattened true
    monotones) in `tests/fixtures/audio-grading/`.
  - **v4 contract shipped (3.3/3.4):** one unified pass emits per-skill `feedback`+`subSkill`,
    ONE `coachFocus {behavior, why, action}`, verbatim-quote-validated `strongerVersion`,
    headline/tone/hint; callouts/didWell/didntLand/nextRepFocus left the model output
    (legacy-read only). FEEDBACK_VERSION v4.0.0, RUBRIC_VERSION v4.0.0. `reps.feedback` jsonb
    (migration 0042, applied to the shared DB) + widened `coach_focus` persist the full doc;
    async path reaches write/read parity (audioUrl forwarding via signed URL in process-rep —
    **needs `supabase functions deploy process-rep`** — coachFocus/coaching_events/feedback
    writes, 60s/120s client watchdog). UI converged on the v2 layout everywhere; two-stage
    pipeline deleted (3.7). Provider flip (3.2): AI_PROVIDER default openai, role-key model
    resolution, honest `modelVersion` from call metrics, real Anthropic fallback budget (20s).
  - **Latency (3.5):** total p50 13.6s → 9.3s, p95 20.3s → 11.8s (`plans/baselines/
    phase-grading-v3-pre|post.json`), 0% fallback. OpenAI primary timeout 45s → 35s.
  - **Recalibration (3.6) — found a live prod bug:** the Ch.11 SIGNALS block told the model to
    score content dims "PRIMARILY against" regex numbers that miss implicit structure/evidence
    (elite ref rep measured "logical flow 9/100, claim-support 0%" → gpt-4o crushed everything
    into 40–65, breaking band semantics). The flag went live in prod 2026-07-15, so PROD WAS
    AFFECTED for ~2 days. Fixes: signals demoted to corroborating evidence; band anchors now
    unconditional (FF_BAND_ANCHORS retired); SCORE CALIBRATION + DIMENSION INDEPENDENCE + edge
    rules 2b/7/8; MEASURED RATE wpm line (computed in code). Bank re-authored from 3× replays
    (`scripts/calibration/reauthor-expectations.mjs`), independence thresholds relaxed to
    observed-stable with auditable rationale stamps (`rethreshold-independence.mjs`), durations
    normalized where hand-invented values implied absurd WPM. Harness tolerances split
    (composite ±6, per-dim ±15 = measured gpt-4o noise floor at temp 0.2); harness hard-fails
    on mock-fallback responses. **Ordering caveat:** the pipeline inverts some hand-authored
    family rankings (excellent-tier reps landing below competent-tier); bank now pins CURRENT
    behavior for drift detection, not quality endorsement.
  - **Audio exit criterion PASS:** 15 clips promoted into the bank (kind=audio-tone, uploaded to
    rep-audio/calibration-audio/) + `scripts/calibrate-audio-tone.mjs` (serves clips over local
    HTTP, toneSource provenance gate): all per-clip bounds green, 4/4 valid tone pairs separate
    +25…+38 (flat 25–40 vs expressive 60–70). One TTS "expressive" clip measured upspeakRatio
    0.5 at the worker → re-tagged as a DNA-rule-4 upspeak specimen. Pacing pairs advisory-only
    (TTS clips aren't rate-controlled; production delivery is deterministic from timings).
    Dev env now runs the local Praat worker (infra/prosody-worker/.venv, uvicorn :8080;
    FF_PROSODY_WORKER=true + PROSODY_WORKER_URL in .env.local).
  - **/code-review high (8 finder angles; 7 reported, simplification agent hung + killed) →
    fix wave committed:** headliners — v4 reps returned NULL from every callout scavenge, so
    /try guests saw zero coaching copy, progression lost its top-weakness line on 4 surfaces,
    and prep readiness reviews graded from averages alone (all now derive from coachFocus via
    shared `deriveRetryFocus`/`deriveTopWeakness` in coach-focus.ts); async watchdog could
    double-fire onComplete (poll/realtime race); Anthropic-as-PRIMARY ran on the 5s quick-fail
    budget; progression rows misattributed gpt-4o output to the hardcoded claude id; worker
    prosody was discarded whenever word timings were absent (+ forked filler semantics — now
    `synthesizeProsodyBaseline` shares the timed path's lexicon); legacy coach_focus rows
    rendered duplicated copy; delivery override could show feedback praising a number it
    replaced; em-dash copy violations; stale primaryFocusDimension prompt refs.
  - **BLOCKED on API credits (both providers dead as of 2026-07-17):** OpenAI
    `insufficient_quota` + Anthropic "credit balance too low" — **PROD SCORING IS SERVING MOCK
    FALLBACKS until Max re-ups billing.** Pending once credits return: (1) full-bank text
    verification under the final prompt (`CALIBRATION_GUEST_ID=<uuid> node
    scripts/calibrate-scoring.mjs`, expect ≤5 noise-level failures; micro-adjust expectations if
    the small post-re-author prompt fixes shifted anything), (2) `PHASE=v2-3
    node scripts/phase-baseline.mjs` final latency record.
  - Phase 6 checklist additions: `supabase functions deploy process-rep`; deploy prosody worker
    (`modal deploy infra/prosody-worker/modal_app.py` or container) + set FF_PROSODY_WORKER/
    PROSODY_WORKER_URL in prod (until then prod tone runs the text-conservative tier — no
    breakage); prod flag state otherwise unchanged (v4 pass itself ships unflagged per Max's
    approved clean-break ruling — prod only changes when Phase 6 deploys).
- **2026-07-17 (session 6, same session as Phase 3) — Phase 4: Build a Rep edits (the 12) on
  `feat/bar-edits`.** All 12 edits addressed (#5 stronger version + #11 faster grading were
  Phase 3's; #6 verified fixed by Phase 3's layout convergence).
  - **#2 user-named questions:** planner rule 1a — named questions become EXACTLY the plan
    (schema min 4→1, first 9 kept, max_tokens 3200 so long lists can't truncate into the
    generic fallback); extras persist as source='suggested' (sortOrder band 1000+) in a
    dismissible "Want to add any of these?" rail; acceptSuggestedMoment promotes them.
    getPrepEvent splits moments/suggestions so all consumers keep treating moments as the
    practice list; all-suggested plans are promoted rather than creating zero-practice events.
  - **#3 rep screen:** RepSurface gained `scoringPromptText` — BaR shows just the question
    while the grader keeps the full event sentence (format kept byte-identical to pre-branch:
    promptText is /compare's grouping key). Per-moment speaking notes
    (critical_moments.notes jsonb, migration 0043, applied to shared DB): auto-drafted via the
    talking-points generator (moment-specific deterministic fallback when the model's down;
    failed REGENERATE never overwrites user edits), edited in place via TalkingPointsSidebar,
    sticky beside the recorder. Pure logic in src/lib/prep/moment-notes.ts (+tests).
  - **#1 uploads:** accept fixed (.pptx was parseable but not accepted) + image/* for the photo
    library; images vision-parse to text (OpenAI, best-effort); client-side downscale to
    1600px JPEG keeps phone photos under the 4MB cap, cuts vision cost, and transcodes HEIC
    where the browser can decode it (HEIC on Chrome stays unsupported — known limitation).
  - **#7/#8 coaching:** event-context block now instructs coaching outputs to target THIS
    event (only-when-present ⇒ reference prompts stay byte-identical; formal replay still
    queued behind the credits blocker with Phase 3's); Improvement Review renders the v4
    behavior/why/action focus, per-skill deltas, implementation verdict, and (#12) Listen-back
    scrubbers for both takes; Readiness Review plays the simulation recording; blob URLs
    revoked when reviews are left (leak fix).
  - **#10 CTAs:** first-rep feedback offers Retry (primary) / skip-to-next / back-to-plan;
    scored retries land on Improvement Review's next/again/plan set. (A naive retry-branch CTA
    row was caught by review rendering stale navigation under a live recorder — removed.)
  - **#4/#9 copy:** all user-facing em-dashes out of BaR (incl. ~40 fallback-plan strings;
    paired dashes → parentheses); planner prompt bans em-dashes in every generated user-facing
    field; "Events you're preparing for" header; no "0 Critical Moments" (→ "Plan ready to
    build"); plan header gains the "You're practicing N moments (~M min)" summary line.
  - **/code-review (6 finder angles) → all verified findings fixed** (headliners in the fix
    commit: stale CTA row, regenerate-destroys-notes, unreachable fallback, zero-practice
    plans, promptText identity break, notes dead ends, blob leak, 4MB photo wall).
    Accepted trade-offs logged: acceptSuggestedMoment does 3 sequential round trips (minor
    race on concurrent accepts), generateMomentStructure uses two selects not a join.
  - **Verification limitation: both AI providers are still out of credits**, so plan
    generation/notes/vision were exercised through their deterministic fallbacks + unit tests
    only; the LLM paths need a live smoke after re-up (see Max checklist in the PR).
- **2026-07-17 (session 7, same session) — Phase 5: doc-fidelity sweep on
  `feat/doc-fidelity-sweep`.** Four parallel audits (§4 loop, §5.7/§6.8 screens, §8.5
  selection, terminology) → fix waves + a 2-angle review wave.
  - **§4 loop:** "Run it again" now implements the focus the Improvement Review just assigned
    (was re-coaching the FIRST rep's objective — overlay, scoring context, comparison, and
    parentRepId lineage all follow the attempt being implemented against); retry screens no
    longer stack generic sub-skill hints beside the Coach's Focus overlay.
  - **§5.7/§6.8 screens:** Core Skill breakdown (current values) always on Workout Complete;
    coach recommendation value-driven only (calendar-parity branch removed; sub-70 users keep
    Lab discovery via a secondary "Or apply it" link); improvement/most-improved fall back to
    all attempts on single-exercise days (labeled "Includes your coached retry"); Lab
    completion labels the degraded-fetch metric honestly + lists all six Core Skills.
  - **§8.5 selection:** lab planner personalizes for signed-in users (3-day recent-exercise
    demotion, automatic weakest-hidden-skill bias — soft, recency-aware; user deep-links stay
    hard), hash-spread deterministic rotation seeds + pressure-archetype rotation (guests keep
    legacy random); prompt skip memory persists (migration 0044:
    prompt_selection_events.skipped_prompt_ids; 7-day soft deprioritization wired through
    PromptPicker → fetchPromptCandidates, truncation-proofed); assessment-phase slates stay
    broad (30-day windowed gate matching isAssessmentActive) instead of vertical-narrowed from
    day one.
  - **Terminology (5.4):** "Composite"→"Communication Score", "dimensions"→"Core Skills",
    tutorial "Delivery"→"Pacing" across dashboard/progress/report/completion surfaces.
    (SubSkillBreakdownCard is already dead behind the retired FF_SUBSKILL_UI — untouched.)
  - **Surfaced to Max, not relitigated (PRD-vs-code conflicts):** (1) Owen C10 score-movement
    softening (negatives < −3 hidden) contradicts PRD §4.7 "score movement should be highly
    visible" and C10 isn't in the D-log — needs a ruling: amend §4.7 or restore numeric
    visibility. (2) §8.5 "recently used communication contexts / speaking scenarios" memory
    remains unimplemented (needs tag-level schema design — deferred; prompt-id-level memory
    only). (3) The Lab core-skill planner personalizes now, but §8.5's full
    strengths/weaknesses/goals matrix is Phase-7-intelligence scope.
  - Review wave (2 angles) fixed: skip-memory silently no-op for active users (bias-window
    truncation), rotation-counter modulo aliasing, guest-cookie identities taking the
    personalized path, auto-bias monotony (single tagged exercise leading forever), stale W7
    docstring, em-dash regressions.
- **2026-07-17 (session 8) — Post-re-up verifications (the Phase-3/4 credit-blocked queue) +
  a real quote-cap hotfix, on `fix/stronger-version-quote-cap`.** Max re-upped billing;
  probe result: **OpenAI (scoring primary) live; Anthropic (fallback) still "credit balance
  too low"** — flagged, work continued since primary is what all scoring/gen uses (Anthropic-dead
  only costs the fallback hop).
  - **Found + fixed a live latent bug (score.ts):** `strongerVersion.quote` had a Zod `max(400)`
    but the prompt states NO quote cap, so on comma-spliced run-on answers gpt-4o quotes a long
    span (e.g. the whole 859-char transcript) → the ENTIRE scoring response failed validation →
    cascaded to the dead Anthropic fallback → **mock-fallback served for a real answer** (mis-logged
    as "provider unreachable"). Same "weaponized cap" failure the `headline` cap already documents.
    Fix: quote `max(400→1000)`, rewrite `max(600→700)` margin; schema-only, so scoring-prompt BYTES
    are unchanged (no calibration re-author needed). Regression test added
    (grading-v3-contract: 600-char quote parses). This bug is in prod now (Phase 3 shipped it) — it
    silently mock-scores any long/run-on rep; the fix ships to prod in Phase 6.
  - **Calibration (2, ≤5-noise criterion MET):** across 4 full-bank runs the failure count was
    3/1/4/2, always ≤5 and on **rotating** reps (band-exceptional, interview-excellent, qa-competent,
    velocity, objection-excellent each fail once) = the temp-0.2 gpt-4o noise floor, not drift
    (no uniform direction; interview-excellent drifts UP +18 structure). Two surgical bank
    adjustments (Max-authorized tooling):
    (a) `rethreshold-independence.mjs` on **indep-launch-miss-breathless** thinking_quality min
    65→35 — its old rationale literally read "observed **70/70/70**", i.e. it was thresholded
    against MOCK output (mock returns ~70) because the quote-cap bug mock-failed this exact rep
    during the Phase-3 re-author; real gpt-4o scores its thinking a stable 40/42/40.
    (b) `reauthor-expectations.mjs` on **qa-excellent-board-regulatory** (single-rep replay files
    → only this rep) composite 77→68, band strong→competent — consistent across 3 dedicated runs
    (69/68/67), another instance of the documented §3.6 "pipeline under-rates upper-tier reps"
    limitation. ⚠️ **For Max:** the bank pins CURRENT behavior for drift detection, not quality
    endorsement — qa-excellent-board and the rotating upper-tier reps land ~8 below their
    hand-authored composites; if that under-rating is a real quality gap, that's Phase-7 grading
    work, not a bank problem.
  - **Audio tone exit criterion (3): PASS.** Clean re-run 0 failures; all 4 valid tone pairs
    separate +20…+35 with `toneSource:prosody` (real Praat-worker audio grading, worker on :8080).
    band-competent's expressive clip stays excluded (the known upspeak specimen). One boundary-noise
    clip (qa-strong expressive 55↔60) self-cleared on re-run.
  - **Latency (4): `PHASE=v2-3 phase-baseline.mjs`** → total p50/p95 **7.66s / 10.27s**, model
    7.1s / 9.4s, **0% mock-fallback, 0% OpenAI-fallback**, 100% cache. Better than the Phase-3
    post-baseline (9.3s/11.8s). Persisted `plans/baselines/phase-v2-3.json`.
  - **Phase-4 LLM smokes (5): all PASS with real model output** (`scripts/smoke-bar-llm.ts`, new).
    #2 named questions → EXACTLY the user's 3 questions verbatim as practice moments, 0 fabricated,
    suggestions-rail mechanism intact (`suggested:true`), coachCue+scoringHint present. #3 moment
    notes auto-draft → clean STAR sections (the editability/persist half was Phase-4 unit-tested +
    reviewed). #1 OpenAI vision parsed a generated JD image (1080 chars, accurate) → regenerated a
    document-specific plan ("Final Panel Interview at Aurora Payments"). Browser extension wasn't
    connected, so validated via direct LLM-function calls (the exact "LLM paths need a live smoke"
    gap the Phase-4 log named).
  - **verify-scoring.mjs (6): all assertions PASS** (coachFocus/strongerVersion grounding/per-skill
    6/6/headlineTone/nextRepHint/non-mock). Trailing `UV_HANDLE_CLOSING` line is a Windows/libuv
    teardown race after success, not an assertion failure.
  - typecheck + full test suite + lint green. Next: Phase 6 prod promotion.
- **2026-07-17 (session 9) — Phase 6 prod promotion on `phase-6-prod-promotion`.** Max authorized the
  prod work. Vercel CLI authed (`maxvolkov202`), project `cognify-v2` (`cognify-v2-neon.vercel.app` is its
  prod alias). Executed:
  - **D24 ruling (PR #11 conflict):** kept Owen C10 score-movement softening; amended PRD §4.7.2 with the
    display rule (delta < −3 → soft copy, ≥ +1 → celebrate) and logged D24. Code and doc now agree; large
    negatives stay hidden.
  - **Flag promotion (6.2):** discovered the 5 v2 flags were ALREADY `true` in prod (stale tracker notes);
    fixed the one wrong one (`FF_PROSODY_WORKER` true→false per Max). `AI_PROVIDER=openai`,
    `NEXT_PUBLIC_USE_ASYNC_SCORING=false` (sync path serves everyone → the blocked process-rep edge fn is
    off the critical path).
  - **Reseed (6.1):** already applied via the shared DB in Phase 2 (4,148 active prompts, 0 thin); no
    destructive hard-prune (preserves `is_active=false` reversibility).
  - **Deploy (the headline item):** first `vercel deploy --prod` **build FAILED** — a real latent Phase-4
    bug: `PrepEventClient` (client) + the client image-downscaler imported constants from `prep/parse.ts`,
    which dynamic-imports node-only extractors (unpdf/pptx → `node:zlib`), so webpack pulled `node:zlib`
    into the browser bundle. Tests/typecheck/lint never exercise the bundle boundary, so it only surfaced
    at deploy. Fixed by splitting client-safe constants into `src/lib/prep/parse-constants.ts` (parse.ts
    re-exports for server importers); local `next build` + full suite green; redeploy READY
    (`dpl_7kydKi…`, prod alias repointed).
  - **Smoke (6.3):** headers + pages + scoring health green; **SIGNALS score-compression bug fixed in
    prod** (band spread 17→73, real gpt-4o, rubric v4.0.0, 0 calibration failures). Auth/mic matrix items
    left for Max.
  - **Handed to Max (blocked/follow-up):** `supabase functions deploy process-rep` (CLI unauthenticated;
    non-critical while async scoring is off), prosody-worker prod deploy (Modal), drift-cron hold, and the
    Anthropic-fallback low-credit flag. `/code-review` + PR + self-merge as usual.

- **2026-07-20 (session 10) — Phase 7 grading recalibration (rubric v4.1.0) + PROD INCIDENT.**
  Branch `fix/grading-recalibration-v4-1` (NOT merged, NOT deployed). Addresses the upper-tier
  under-rating from `plans/verification-2026-07-20-holistic.md` (elite reps clustered 75-78).
  - **🔴 PROD SCORING INCIDENT (needs Max — billing):** midway through local validation, OpenAI
    returned `429 "You exceeded your current quota"` and Anthropic fallback is still out of credits
    → **prod `/api/score` is serving `mock-fallback-v1` (composite 70, canned coaching) to real
    users.** Prod was confirmed non-mock at session start (18-rep baseline, 0 mock), so the quota
    was exhausted DURING this session — the ~250+ gpt-4o validation calls I ran (local + prod share
    the OpenAI account) are the overwhelmingly likely cause. **Fix = re-up OpenAI quota (or Anthropic
    credits so the fallback works).** I stopped all scoring calls on detection.
  - **Rubric changes (DONE, typecheck+lint+contract-tests green, code reviewed by eye):**
    `score.ts` — anti-middle-compression rule; a clarity/structure "clean-arc ceiling" rule;
    thinking_quality "depth ≠ evidence-count" recalibration (edge rules 5/7 reinforced, 2b
    strengthened for disorganized-but-deep, 2 strengthened for numbered-scaffold structure);
    widened delivery band 150-160 → 130-165 with a >170-wpm fast-penalty retained and a no-audio
    delivery-grounding rule. `rubric.ts` — RUBRIC_VERSION v4.0.0 → **v4.1.0**, delivery def/​signals
    130-165. `rubric-anchors.ts` — thinking 61-100 + delivery 61-80 anchors rewritten.
    `scripts/qa/grading-quality-reps.mjs` — +6 fresh excellent/elite reps (2nd pitch, behavioral,
    objection, teaching, toast, technical explainer).
  - **Validation captured BEFORE quota died (local, 24-rep QA, averaged):** junk 16 / poor 26 held;
    independence gaps clean (org-empty str−thk +15, clear-shallow cla−thk +15, concise-vague
    con−thk +53); deep-but-disorganized FIXED — thinking 62-72 > structure 42-45 (was thk40<str50),
    5/5 runs; excellent reps clear 80 (teaching 81, technical 81, investor 84); elite reps 82-85
    (climate pitch hit 85). The calibration bank replay (run 1 of 3, 48 reps, 0 mock) showed the
    intended upper-tier lift: interview-excellent-leadership-failure 59→71 (thinking 47→72),
    band-exceptional 70→79, +7 more upper-tier band reps drifting UP — these are the sanctioned
    re-baseline targets, not drift.
  - **⚠️ BLOCKED on credits — remaining Job-1 gates NOT done:** (a) finish the 3× calibration replay
    → `reauthor-expectations.mjs` re-baseline of upper-tier band reps; (b) full `calibrate-scoring` /
    `verify-scoring` / `phase-baseline` / `calibrate-audio-tone` suite; (c) `/code-review high`;
    (d) PR + self-merge + `next build` + `vercel deploy --prod` + prod elite-rep smoke. Resume once
    OpenAI/Anthropic credits are restored. Text-only tone caps ~70 by design, so text-only elite
    tops ~85; 85-90 elite is audio-gated (needs Job 2 prosody).
  - **Job 2 (prosody worker) — DOUBLE BLOCKED, see `plans/job2-prosody-blocker-2026-07-20.md`:**
    (1) the Modal token in the prompt was the literal placeholder `<PASTE MODAL TOKEN HERE>`;
    (2) the prod SYNC path (`RepSurface.tsx:568-609`) never sends `audioUrl` to `/api/score`, so
    flipping `FF_PROSODY_WORKER=true` alone is a no-op for tone — fix + latency tradeoff documented.

- **2026-07-20 (session 10, cont.) — Job 1 SHIPPED after OpenAI re-up.** Max re-upped OpenAI;
  prod + local confirmed non-mock. Resumed and completed all gates:
  - 3× calibration replay (0 mock, **0 independence failures**) → `reauthor-expectations.mjs`
    re-baselined the 29 band reps (upper tier +8-12, low/mid ±2-6). Post-reauthor
    `calibrate-scoring` **1/48** (indep-earnings-explainer thk 65>60, documented aspirational),
    0 mock — within ≤5. `verify-scoring` all-pass (v4.1.0, non-mock). `phase-baseline` p50/p95
    **9.1s/9.9s**, 0 mock, not regressed. `calibrate-audio-tone` **4/4 tone pairs +25**, prosody
    end-to-end (worker :8080), 1 documented per-clip TTS boundary noise.
  - `/code-review high` → 1 low-severity DEFERRED finding: edge rule 3 (>170 wpm docks delivery)
    vs deterministic `scorePacing` (penalizes only >220) — each governs a different path
    (deterministic override wins when words present), so no wrong behavior; left for a future
    decision on whether to add a 170-220 band to scorePacing.
  - **PR #17 merged → main** (`08e29d52`). `next build` green. `vercel deploy --prod` →
    `dpl_FGrqmk2kNU1Qcd89nGBb3Lp8rKQA` (production, READY). **Prod smoke: elite pitch composite
    81, non-mock (openai:gpt-4o), rubricVersion v4.1.0 live, rep-specific headline.** Max's target
    (excellent reps reach 80+) is met in prod. Text-only tone still caps ~70 by design → elite
    85-90 remains audio-gated (Job 2).
  - **Incident postmortem:** the mid-session prod mock-fallback was OpenAI quota exhaustion (429)
    from the validation burst + Anthropic fallback also out of credits; resolved by Max's re-up.
    Consider raising the OpenAI spend cap and re-upping Anthropic so the fallback can absorb the
    next quota event instead of dropping to mock.

- **2026-07-20 (session 10, cont.) — Job 2 SHIPPED: prosody audio-tone grading LIVE in prod.**
  Max authed Modal (`modal token new`). Executed:
  - **Modal worker deployed** (`cognify-prosody-worker`, URL
    `https://maxvolkov202--cognify-prosody-worker-fastapi-app.modal.run`) from
    `infra/prosody-worker/modal_app.py`. Hardened with a shared-secret (`cognify-prosody-secret`)
    so a leaked URL can't burn credits; worker verified returning real prosody for wav + mp3.
  - **PR #19** — sync path now uploads audio BEFORE scoring and sends the signed `audioUrl` to
    `/api/score` (gated by `NEXT_PUBLIC_PROSODY_SYNC`, default off = byte-identical). This closed the
    original blocker (sync path never sent audioUrl).
  - **PR #20** — `extractWorkerProsody` now tries the Praat worker FIRST, Hume as fallback. Prod had
    a stale `HUME_API_KEY` that returned null and short-circuited the worker (tone fell to text tier
    despite a healthy worker). Fixed + latent "Hume-null-no-fallback" bug removed.
  - **Prod env set** (verified via `vercel env pull`): `PROSODY_WORKER_URL`, `PROSODY_WORKER_TOKEN`,
    `NEXT_PUBLIC_PROSODY_SYNC=true`, `FF_PROSODY_WORKER=true`. Two `vercel deploy --prod` cycles.
  - **Smoke PASS:** prod `/api/score` with a signed audioUrl → `toneSource: prosody`,
    `prosodyAvailable:true`, non-mock; tone REACTS — expressive clip 65 vs flat clip 35 (+30).
  - **Watch-items for Max:** (1) `min_containers=1` on the worker = continuous Modal credit burn
    against ~$30 — consider `min_containers=0` (graceful cold-start degradation to text) after
    handoff. (2) sync reps now upload before scoring → slightly slower perceived scoring. (3) the
    stale `HUME_API_KEY` is now inert (Praat is primary); remove it if Hume is truly dead.
  - **Job 3 (Max-owned) still open:** manual auth + mic smoke matrix.

- **2026-07-21 (session 11) — WebM prosody decode + unified scoring display SHIPPED (PR #22 →
  `2e235342`).** Verification found the Job-2 prosody worker couldn't decode the real browser format:
  it called `parselmouth.Sound()` directly, but Praat has no WebM/Matroska reader, so
  `audio/webm;codecs=opus` (the format `capture.ts:24` records) returned all-null prosody and tone
  silently fell back to text tier — only the wav/mp3 calibration fixtures ever worked. Proven 3 ways
  (local parselmouth `PraatError: Not an audio file`, live worker all-null, prod `/api/score` with a
  real webm → `[toneSource: text]`).
  - **Fix:** `infra/prosody-worker/main.py` `_load_sound()` tries Praat directly (fast path for
    wav/mp3/flac/ogg) then transcodes to 16kHz mono WAV via the ffmpeg already in the Modal image on
    any failure. `modal deploy` done. **Verified end-to-end:** real webm → non-null prosody
    (pitchMeanHz 141.6) and prod `/api/score` → `[toneSource: prosody]` (was text), non-mock.
  - **Scoring display:** removed the optimistic deterministic preview in `RepSurface.tsx` (showed
    delivery + a thinking_quality BASELINE 85 that the LLM blends down to ~71 — users watched a score
    "drop"). Now one skeleton runs during grading and all six FINAL dims appear together when
    `/api/score` returns. Pure scorers unchanged; UI-only. `computeOptimisticDims`/
    `OptimisticDimensionPreview` removed from the UI.
  - build + lint + tsc green. PR #22 merged, `vercel deploy --prod` (`cognify-v2-pkb8s0o6x`) + alias
    repointed, prod health green. **Remaining launch gate: Google OAuth** (needs Max's `GOCSPX-`
    secret in Supabase — a wrong non-Google value was in the field). Modal `min_containers=1` cost
    still open. Prompt-bank expansion is the next workstream (`plans/prompt-bank-holistic-brief.md`).
