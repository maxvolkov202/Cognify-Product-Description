# Terminology Map — PRD ↔ code ↔ DB

Single source for naming during the PRD v3 rebuild. Rule: **user-facing copy uses PRD terms;
code identifiers and DB enums stay stable** (bridge via aliases). New code uses PRD-aligned
identifiers where no legacy identifier exists.

| PRD term (user-facing) | Code today | DB today | Ruling |
|---|---|---|---|
| Core Skills (the six) | `SKILL_DIMENSIONS` / "dimensions" | `dimension` enum | UI copy says "Core Skills"; code keeps `dimension`. New engine types may say `coreSkill` in UI-layer props only. |
| **Pacing** | `delivery` (rubric v3 canonical); muscle-group layer already `pacing` | enum has BOTH `pacing` (v1/mg) + `delivery` (v3) | UI label: **Pacing**. Scoring internals keep `delivery`. Bridge stays `src/lib/scoring/dimension-aliases.ts` (`muscleGroupToSkillDim`). No enum migration. |
| Thinking Quality | `thinking_quality` | `thinking_quality` | aligned |
| Clarity / Structure / Conciseness / Tone | same | same | aligned |
| Hidden Skills (= Subskills = Hidden Behaviors = Underlying Behaviors, PRD terminology note) | "sub-skills", `src/types/sub-skills.ts` — **148 ids, generated from `scripts/taxonomy/hidden-skills-v2.json` (D20)** | inside `dimension_scores.signals` jsonb + `communication_profile.hiddenSkills` | Internal-only per PRD. Code keeps `subSkill*` identifiers; docs/comments may say Hidden Skills. Old 34-id → new 148-id bridge: `plans/prd/taxonomy-migration-map.md`. |
| Communication Score (per rep) | `compositeScore` / "composite" | `reps.composite_score` | UI label: "Communication Score". Code keeps composite. |
| Overall Communication Score | — (net-new) | — (Phase 3) | new: `communication_profile.overall_score`; UI "Communication Score". |
| Fundamental Scores | dimension running averages | `progress_snapshots` | UI: "Core Skills"; profile-backed from Phase 3. |
| Application / Application Skills | — (net-new) | — (Phase 4) | new tables `applications`, `application_skills`. |
| Skill Lab (PRD also says "The Lab") | `/skill-lab` route (currently dimension drills) | `mode = 'skill_lab'` | Name stays **Skill Lab**. Semantics change in Phase 4 (applications). Current dimension drills → "Focus drills" (fate decided at Phase 4 start). |
| Build a Rep | `/build-a-rep` (scenario + talking points) | `mode = 'scenario_training'` | Name stays. Phase 5 adds `mode = 'build_a_rep'` for event-prep sessions; legacy scenario mode value untouched for history. |
| Exercise Framework | `exercises` row + code-side `EXERCISE_RUBRIC_HINTS` | `exercises` table | Phase 2.2 enriches `exercises` into full frameworks (objective, hiddenSkills, scoringLens, retryObjective, promptRules, responseWindow, constraintTypes). |
| Prompt | `exercisePrompts` / prompt banks | `exercise_prompts` | aligned |
| Coach's Insight | — (scattered: SkillScenariosCard, RuleReminder, framework strip) | — | new engine screen + generation, Phase 1. Identifier `coachInsight`. |
| Coach's Focus | `nextRepFocus` (score output) | in callouts/feedback jsonb | Formalized as `coachFocus` {dimension, hiddenSkill, text} in Phase 1; persisted `reps.coach_focus` + `coaching_events`. |
| First Rep / Retry / Rep | single `reps` rows, no lineage | `reps` | Phase 1: `reps.attempt_kind` ('first'\|'retry'\|'again') + `parent_rep_id`. |
| Improvement Review | — | — | new screen + scoring mode, Phase 1. `improvementReview`. |
| Core Skill Breakdown | `DimensionGrid` | `dimension_scores` | aligned; UI heading "Core Skill Breakdown". |
| Communication Profile / Snapshot | — (read-time EWA only) | — (Phase 3) | new `communication_profile*` tables + snapshot service. |
| Rank (Bronze I-IV → Grandmaster) | `users.level`/`xp` (1-100) + weekly `league_membership` (Bronze→Diamond) | same | Phase 6: new rank ladder absorbs levels; league tiers renamed (avoid two Bronzes). |
| Reps Earned / all-time reps | `users.lifetime_reps` | same | surfaced on completion (C17). |
| Critical Moment / Preparation Plan / Readiness Review | — | — (Phase 5) | new tables `critical_moments`, `prep_events`, `readiness_reviews`. |
| Guided Practice / Full Simulation | — | — | Phase 5 modes on prep sessions. |
| Assessment Phase | `cold_start` hardcode in `assignment.ts` | — | Phase 2.4 replaces with balanced 6-skill rotation state. |

Known copy debt to fix when touched: welcome email still lists v2 dimension names
(`src/lib/email/send.ts`); "Daily score" labels become "Communication Score".

## System Change v2 rulings (D20–D23, confirmed 2026-07-15)

| Decision | Terminology / naming consequence |
|---|---|
| **D20 — full 148-skill taxonomy adoption** | PRD §5.5's six tables are the canonical Hidden Skills. Ids are snake_case of the doc's skill names, dimension keys use CODE names (PRD "Pacing" table → `delivery` ids). Source of truth: `scripts/taxonomy/hidden-skills-v2.json`; `src/types/sub-skills.ts` is generated from it. |
| **D21 — prompt slate stays 5** | Doc's "4 prompt options" (Workout) / "6 options" (Lab) both read as "the slate"; code constant stays 5. |
| **D22 — grading rethink** | "Grading"/"scoring" = single unified pass, OpenAI primary + Anthropic fallback. "Tone graded from audio" — Tone (and Pacing) scores must consume the recording, not the transcript alone. Design doc: `plans/prd/grading-v3-design.md` (Phase 3). |
| **D23 — legacy prompt System A retired** | "Prompt system" means the DB catalog (`cognify_v2.exercises` / `exercise_prompts`) only. `src/lib/ai/prompts/*` + rep-type planners are legacy pending deletion (Phase 2); don't build against them. |
