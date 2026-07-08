# Phase 3 — Communication Profile & Snapshot: implementation design

Status: in progress 2026-07-02. PRD §8.2–8.3, §8.6.4, §10.3. Decisions D1/D6.

## Core idea (PRD §8.3: "profile ≠ rep history")

Rep scores are EVIDENCE; the profile is the slowly-evolving ESTIMATE. Today the
"long-term" numbers are read-time EWA over raw snapshots — evidence and estimate
are the same values. Phase 3 persists the estimate.

## Data model (migration 0030)

`communication_profile` — ONE row per user (PRD: one profile, every rep contributes):
- `user_id` uuid PK → users
- `overall_score` real NULL — the Overall Communication Score (PRD §10.3),
  weighted (DIMENSION_WEIGHTS) over core-skill estimates; null until ≥3 skills measured
- `core_skills` jsonb — `{ [dimension]: { score, sampleCount, updatedAt } }`
  (canonical v3 dims incl. `delivery`; UI labels it Pacing per terminology map)
- `hidden_skills` jsonb — `{ [subSkillId]: { score, sampleCount } }` (36 max)
- `total_reps` int — evidence count
- `updated_at`, `created_at`

## Update rule (pure: `src/lib/profile/communication-profile.ts`)

EMA with count-scaled learning rate: `k = 1 / min(sampleCount + 1, 12)`.
- Rep 1: k=1 (adopt first evidence outright)
- Converges to k=1/12 ≈ 0.083 — a mature profile moves ≤ ~2pts per typical rep
  ("scores should be stable; long-term trends matter more than single reps", §11.5)
- Mock-fallback reps are skipped (same guard as progressSnapshots).
- Retry attempts DO update the profile (they're real evidence — PRD: "every rep
  contributes"), which also means implementation gains show up immediately.
- structural_adherence and legacy dims are ignored; sub-skills validated against
  SUB_SKILL_TO_DIMENSION.

`applyRepToProfile(profile, {dimensions, subSkillScores}) → profile'` — pure,
tested in tests/communication-profile.test.ts.

## Write path

`saveRep` (after dimensionScores insert, non-mock, authenticated): read-modify-write
the profile row. Single-row upsert; last-writer-wins is acceptable (a user's reps
are serial in practice). Failures logged + swallowed (never lose the rep).

## Backfill (`scripts/backfill-communication-profile.ts`, tsx)

Replays each user's reps chronologically (reps + dimension_scores incl.
sub-skill signals) through applyRepToProfile; skips mock-fallback; idempotent
(rebuilds from scratch each run). Run on dev now; on prod at promotion.

## Snapshot (`src/lib/profile/snapshot.ts`)

`buildCommunicationSnapshot(userId)` → the PRD §8.3.11 pre-decision bundle:
profile scores, weakest/strongest core skill, plateaued dims, recent coaching
(last 5 coaching_events w/ verdicts, recurring-dimension counts), assessment
status. NOT stored — regenerated per call. Consumers now: coaching-memory
block + dashboard (later), Skill Lab/Build a Rep engines (Phase 4/5).

## Coaching memory (PRD §8.6.4)

Score routes fetch recent coaching_events → render a COACHING MEMORY block
(recent focuses + implemented verdicts + recurring weaknesses) into the scoring
user prompt, uncached (like the calibration block). Rules for the model:
acknowledge implemented coaching, don't repeat verbatim coaching that keeps
missing — change the angle. Calibration-safe: reference reps carry no userId →
no block → byte-identical prompts.

## Plateau detection (PRD §8.4.4)

`detectPlateau(series)` pure helper: ≥8 samples in 21 days AND |linear-regression
slope| < 0.15 pts/day AND score < 85 → plateaued. Exposed via snapshot;
rotation uses it as variety signal (plateaued weakest dim → prefer second-weakest
that day, logged as intervention).

## Communication Stage (PRD §8.2)

`users.communication_stage` text NULL (student | early_career | individual_contributor |
manager | senior_leader | executive) + onboarding step (after vertical) + settings
field. Personalization context only — never affects scoring.

## Deferred within Phase 3

- 3.7 engine consolidation (muscle-group + rep-type selectors) → re-scoped at
  Phase 4 start alongside 2.8 (they retire the same legacy surface).
- Overall Communication Score DISPLAY on dashboard/progress → lands with the
  Phase 6 progression overhaul (score exists in data from now, accumulating).
