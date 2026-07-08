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
| Hidden Skills (= Subskills = Hidden Behaviors = Underlying Behaviors, PRD terminology note) | "sub-skills", `src/types/sub-skills.ts` (36) | inside `dimension_scores.signals` jsonb | Internal-only per PRD. Retire `FF_SUBSKILL_UI` surfacing. Code keeps `subSkill*` identifiers; docs/comments may say Hidden Skills. |
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
