// Pure, side-effect-free decision logic for the muscle-group adventure
// path. The caller fetches world state from the database (in
// `src/server/actions/workout-day.ts`) and passes it in; this module
// returns "today's muscle group + 4 stations + prompt candidates".
//
// Keeping these functions pure means every algorithm bullet in the
// Phase 3 plan is unit-testable without a DB. The corresponding wrapper
// actions only need a thin smoke test.
//
// See plans/muscle-group-pivot-progress.md → Phase 3 for the spec.

import { createHash } from "node:crypto";
import {
  MUSCLE_GROUP_IDS,
  type MuscleGroupId,
} from "@/types/domain";

// ─── Inputs ──────────────────────────────────────────────────────────────

/** Aggregated engagement signal for one (user, muscle-group) pair. */
export type EngagementSnapshot = {
  dimension: MuscleGroupId;
  /** 14d rolling avg of rep composites for this dim. NULL when untrained. */
  recentComposite: number | null;
  /** ISO timestamp of the most recent rep in this dim. NULL when untrained. */
  lastTrainedAt: string | null;
  /** Count of rows backing `recentComposite`. Used to gate sparse fallback. */
  rowCount: number;
};

/** Per-dim aggregate of rep composites; used when engagement is sparse. */
export type RecentRepsSnapshot = {
  dimension: MuscleGroupId;
  /** Last 14 days, avg composite. NULL when no reps. */
  avgComposite14d: number | null;
  /** Last 7 days, avg composite. NULL when no reps. */
  avgComposite7d: number | null;
  /** 14-7 days ago, avg composite (the regression baseline). NULL when none. */
  avgCompositePrior7d: number | null;
  /** Count of reps in last 14d. */
  count14d: number;
};

/** One past muscle-group day; used for "last trained" + dedupe. */
export type RecentDaySnapshot = {
  dayId: string;
  dimension: MuscleGroupId;
  dayDate: string; // YYYY-MM-DD
  plannedExerciseIds: string[];
  compositeAtClose: number | null;
};

/** One exercise from the catalog. */
export type CatalogExercise = {
  id: string;
  slug: string;
  name: string;
  dimension: MuscleGroupId;
  description: string; // = rule
  instructions: string | null; // = why
  sortOrder: number;
  /** PRD v3 Phase 2.2 — Exercise Framework fields (null pre-enrichment). */
  objective: string | null;
  hiddenSkills: string[] | null;
  responseWindow: { minSec: number; maxSec: number } | null;
  /** ADR-001 Decision 2 — constraint types (time|structure|tone|complexity). */
  constraintTypes: string[] | null;
  /** Phase 11.D2 — Lab Engine V1 Coach's Insight (null pre-enrichment). */
  coachInsight: string | null;
};

/** One prompt from the exercise's bank. */
export type CatalogPrompt = {
  id: string;
  promptId: string; // stable hash id
  text: string;
  difficulty: number; // 1=intro, 2=core, 3=stretch
  tags: string[];
};

export type SelectInput = {
  today: Date;
  engagement: EngagementSnapshot[];
  recentReps: RecentRepsSnapshot[];
  recentDays: RecentDaySnapshot[];
  /** Deterministic shuffle seed (tests). Wall-clock + userId in prod. */
  seed?: string;
  /** PRD v3 Phase 2.4 — run the Assessment Phase for new users
   *  (balanced rotation across all 6 Core Skills for ASSESSMENT_CYCLES
   *  full cycles before adaptive rotation). Set from
   *  isTrainingEngineV2Enabled() by the caller so this module stays
   *  pure; default false preserves legacy cold-start behavior. */
  assessmentEnabled?: boolean;
  /** PRD v3 Phase 2.5 — weakness-weighted re-entry floors + strong-skill
   *  maintenance cadence. Same caller flag as assessmentEnabled;
   *  default false keeps the uniform SIX_DAY_FLOOR. */
  weightedRotationEnabled?: boolean;
  /** PRD v3 Phase 3.5 (PRD §8.4.4) — dims currently flagged as plateaued
   *  (enough evidence, flat trend, headroom left). When today's weakest
   *  pick is plateaued and a close-scoring non-plateaued alternative is
   *  eligible, the engine swaps to the alternative — a change of
   *  stimulus, not more of the same. Computed by the caller from
   *  progress snapshots via detectPlateau(). */
  plateauedDims?: MuscleGroupId[];
  /** PRD v3 Phase 7.2 (PRD §8.4.4 confidence management) — after two
   *  consecutive rough days, deliberately serve the STRONGEST dim so the
   *  user banks a win before returning to weakness work. Caller flag
   *  (v2 engine); default false = legacy behavior. */
  confidenceBoostEnabled?: boolean;
};

// ─── Outputs ─────────────────────────────────────────────────────────────

export type RationaleCode =
  | "cold_start"
  | "assessment"
  | "sharp_regression"
  | "six_day_floor"
  | "weakest_recent"
  | "oldest_fallback"
  | "confidence_builder";

export type SelectResult = {
  suggested: MuscleGroupId;
  alternates: MuscleGroupId[]; // exactly 2
  rationale: string;
  rationaleCode: RationaleCode;
  /** For telemetry: the composite drop that triggered sharp_regression, if any. */
  regressionDrop?: number;
};

// ─── Constants ───────────────────────────────────────────────────────────

/** Rotation floor: same dim rolls around at most every N days. */
export const SIX_DAY_FLOOR = 6;
/** PRD v3 Phase 2.4 (PRD §8.4.2) — Assessment Phase length: every new
 *  user rotates through all six Core Skills this many full cycles
 *  before adaptive rotation takes over. */
export const ASSESSMENT_CYCLES = 2;
export const ASSESSMENT_DAYS = ASSESSMENT_CYCLES * 6;
/** PRD v3 Phase 2.5 (PRD §5.4) — weighted-rotation floors. Weak skills
 *  return sooner; strong skills stretch to a weekly maintenance cadence
 *  but never longer (strong-skill maintenance). */
export const WEAK_SKILL_FLOOR = 4;
export const STRONG_SKILL_FLOOR = 7;
/** Composite drop that surfaces a dim early regardless of floor. */
export const SHARP_REGRESSION_THRESHOLD = 8;
/** Phase 7.2 — two consecutive attempted days closing below this
 *  composite trigger a confidence-builder day on the strongest dim. */
export const CONFIDENCE_LOW_THRESHOLD = 55;
/** Recent-engagement row count below which we fall back to recent reps. */
export const SPARSE_ENGAGEMENT_THRESHOLD = 3;
/** A user's last N muscle-group days that exercise sampling dedupes against. */
export const DEDUPE_WINDOW_DAYS = 2;
/** A user's last N reps that prompt sampling biases away from. */
export const PROMPT_BIAS_WINDOW = 30;

// ─── Helpers ─────────────────────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.floor(ms / 86_400_000);
}

/** Stable per-call shuffle. */
export function seededShuffle<T>(arr: readonly T[], seed: string): T[] {
  const copy = arr.slice();
  // Mulberry32 seeded by sha256(seed) — deterministic, fast.
  const hash = createHash("sha256").update(seed).digest();
  let state = hash.readUInt32LE(0) || 1;
  function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const tmp = copy[i] as T;
    copy[i] = copy[j] as T;
    copy[j] = tmp;
  }
  return copy;
}

/** Resolve the recentComposite for a dim, falling back to recent reps when engagement is sparse. */
export function effectiveCompositeFor(
  dim: MuscleGroupId,
  engagement: EngagementSnapshot[],
  recentReps: RecentRepsSnapshot[],
): number | null {
  const eng = engagement.find((e) => e.dimension === dim);
  if (eng && eng.rowCount >= SPARSE_ENGAGEMENT_THRESHOLD) {
    return eng.recentComposite;
  }
  const reps = recentReps.find((r) => r.dimension === dim);
  return reps?.avgComposite14d ?? null;
}

/** Detect a sharp regression in this dim's 7d composite vs prior 14-7d baseline. */
export function detectSharpRegression(
  rs: RecentRepsSnapshot,
): { drop: number } | null {
  if (
    rs.avgComposite7d == null ||
    rs.avgCompositePrior7d == null ||
    rs.count14d < 3
  ) {
    return null;
  }
  const drop = rs.avgCompositePrior7d - rs.avgComposite7d;
  if (drop >= SHARP_REGRESSION_THRESHOLD) return { drop };
  return null;
}

/** Build the user-facing rationale string. Each is ≤60 chars, encouraging. */
export function buildRationale(
  code: RationaleCode,
  dim: MuscleGroupId,
  ctx: { drop?: number; daysSince?: number; composite?: number | null } = {},
): string {
  const label = ({
    clarity: "Clarity",
    structure: "Structure",
    conciseness: "Conciseness",
    thinking_quality: "Thinking Quality",
    pacing: "Pacing",
    tone: "Tone",
  } satisfies Record<MuscleGroupId, string>)[dim];

  switch (code) {
    case "cold_start":
      return "Clarity is the highest-leverage muscle — we'll start here.";
    case "assessment": {
      const day = (ctx.daysSince ?? 0) + 1;
      return `Baseline day ${day} of ${ASSESSMENT_DAYS} — mapping your ${label}.`;
    }
    case "sharp_regression": {
      const drop = ctx.drop != null ? Math.round(ctx.drop) : 0;
      return `${label} dropped ${drop} pts this week — let's tighten it.`;
    }
    case "six_day_floor":
      return `${ctx.daysSince ?? 6} days since ${label} — time to revisit.`;
    case "weakest_recent": {
      if (ctx.composite == null) {
        return `${label}'s ready for another rep.`;
      }
      const c = Math.round(ctx.composite);
      return `${label}'s at ${c} — let's push it higher.`;
    }
    case "oldest_fallback":
      return `${label}'s overdue. Let's bring it back into rotation.`;
    case "confidence_builder":
      return `Rough couple of days — bank a win with ${label} today.`;
  }
}

/** PRD v3 Phase 7.3 — multi-session planning (v1): simulate the next N
 *  selections so today's suggestion can say where the week is headed.
 *  Pure: replays selectMuscleGroupForToday against hypothetical closed
 *  days. Confidence-builder is disabled inside the simulation (it needs
 *  real composites); assessment/floors/weakness all project forward. */
export function planUpcomingDims(
  input: SelectInput,
  todayPick: MuscleGroupId,
  count = 2,
): MuscleGroupId[] {
  const picks: MuscleGroupId[] = [];
  let days = [...input.recentDays];
  let cursor = new Date(input.today);
  let lastPick = todayPick;
  for (let i = 0; i < count; i++) {
    days = [
      ...days,
      {
        dayId: `sim-${i}`,
        dimension: lastPick,
        dayDate: cursor.toISOString().slice(0, 10),
        plannedExerciseIds: [],
        compositeAtClose: null,
      },
    ];
    cursor = new Date(cursor.getTime() + 86_400_000);
    const res = selectMuscleGroupForToday({
      ...input,
      today: cursor,
      recentDays: days,
      confidenceBoostEnabled: false,
    });
    picks.push(res.suggested);
    lastPick = res.suggested;
  }
  return picks;
}

// ─── 1. Muscle-group selector ────────────────────────────────────────────

/** PRD v3 Phase 2.4 — is the user still inside the Assessment Phase?
 *  True while they have fewer than ASSESSMENT_DAYS muscle-group days
 *  with at least one rep logged (attempted days count; frozen/missed
 *  days don't advance the assessment). */
export function isAssessmentActive(recentDays: RecentDaySnapshot[]): boolean {
  return countAssessmentDays(recentDays) < ASSESSMENT_DAYS;
}

function countAssessmentDays(recentDays: RecentDaySnapshot[]): number {
  // recentDays is capped at a 30-day lookback upstream, which always
  // covers the 12-day assessment window for active users. Days with a
  // recorded composite OR planned exercises count as attempted training
  // days for rotation purposes.
  return recentDays.length;
}

/** Assessment rotation: the canonical Core Skill with the FEWEST days
 *  so far, ties broken by canonical order. Robust to gaps (a skipped
 *  day doesn't derail the cycle — the least-covered skill always comes
 *  next). */
function selectAssessmentDim(recentDays: RecentDaySnapshot[]): {
  dim: MuscleGroupId;
  daysSoFar: number;
} {
  const counts = new Map<MuscleGroupId, number>();
  for (const dim of MUSCLE_GROUP_IDS) counts.set(dim, 0);
  for (const d of recentDays) {
    counts.set(d.dimension, (counts.get(d.dimension) ?? 0) + 1);
  }
  let best: MuscleGroupId = MUSCLE_GROUP_IDS[0]!;
  let bestCount = Number.POSITIVE_INFINITY;
  for (const dim of MUSCLE_GROUP_IDS) {
    const c = counts.get(dim) ?? 0;
    if (c < bestCount) {
      best = dim;
      bestCount = c;
    }
  }
  return { dim: best, daysSoFar: countAssessmentDays(recentDays) };
}

export function selectMuscleGroupForToday(input: SelectInput): SelectResult {
  const { today, engagement, recentReps, recentDays } = input;

  // 0) PRD v3 Assessment Phase (v2 engine only): balanced rotation
  //    through all six Core Skills before any adaptive decision. Sharp
  //    regression, floors, and weakness weighting all wait until the
  //    baseline exists (PRD §8.4.2: "collect enough evidence before
  //    heavily personalizing").
  if (input.assessmentEnabled && isAssessmentActive(recentDays)) {
    const { dim, daysSoFar } = selectAssessmentDim(recentDays);
    const alternates = MUSCLE_GROUP_IDS.filter((d) => d !== dim).slice(0, 2);
    return {
      suggested: dim,
      alternates,
      rationale: buildRationale("assessment", dim, { daysSince: daysSoFar }),
      rationaleCode: "assessment",
    };
  }

  // 1) Cold-start: no engagement and no recent reps at all.
  const anyEngagement = engagement.some((e) => e.rowCount > 0);
  const anyRecent = recentReps.some((r) => (r.count14d ?? 0) > 0);
  if (!anyEngagement && !anyRecent) {
    return {
      suggested: "clarity",
      alternates: ["structure", "conciseness"],
      rationale: buildRationale("cold_start", "clarity"),
      rationaleCode: "cold_start",
    };
  }

  // 1.5) PRD v3 Phase 7.2 — confidence management (PRD §8.4.4: balance
  //      challenge with reinforcement). Two consecutive attempted days
  //      closing under CONFIDENCE_LOW_THRESHOLD → serve the STRONGEST
  //      dim instead of piling onto a weakness. Deliberately checked
  //      BEFORE sharp regression: "you dropped 8 points, now drill your
  //      worst skill" is exactly the demoralizing pile-on to avoid.
  if (input.confidenceBoostEnabled) {
    const closedDays = [...recentDays]
      .filter((d) => d.compositeAtClose != null)
      .sort((a, b) => (a.dayDate < b.dayDate ? 1 : -1));
    if (
      closedDays.length >= 2 &&
      closedDays[0]!.compositeAtClose! < CONFIDENCE_LOW_THRESHOLD &&
      closedDays[1]!.compositeAtClose! < CONFIDENCE_LOW_THRESHOLD
    ) {
      let strongest: MuscleGroupId | null = null;
      let strongestComposite = -1;
      for (const dim of MUSCLE_GROUP_IDS) {
        const c = effectiveCompositeFor(dim, engagement, recentReps);
        if (c != null && c > strongestComposite) {
          strongestComposite = c;
          strongest = dim;
        }
      }
      // Don't fire when the "strongest" skill is itself weak — a
      // confidence day needs something to actually lean on.
      if (strongest && strongestComposite >= CONFIDENCE_LOW_THRESHOLD + 5) {
        const alternates = pickAlternates(strongest, engagement, recentReps);
        return {
          suggested: strongest,
          alternates,
          rationale: buildRationale("confidence_builder", strongest),
          rationaleCode: "confidence_builder",
        };
      }
    }
  }

  // 2) Sharp-regression override: surface the dim with the largest 7d drop.
  const regressions = recentReps
    .map((r) => ({ dim: r.dimension, hit: detectSharpRegression(r) }))
    .filter((x): x is { dim: MuscleGroupId; hit: { drop: number } } =>
      x.hit !== null,
    )
    .sort((a, b) => b.hit.drop - a.hit.drop);

  if (regressions.length > 0) {
    const top = regressions[0]!;
    const alternates = pickAlternates(top.dim, engagement, recentReps);
    return {
      suggested: top.dim,
      alternates,
      rationale: buildRationale("sharp_regression", top.dim, {
        drop: top.hit.drop,
      }),
      rationaleCode: "sharp_regression",
      regressionDrop: top.hit.drop,
    };
  }

  // 3) 6-day floor: any dim last trained >=6 days ago is eligible.
  const lastTrainedByDim = new Map<MuscleGroupId, Date | null>();
  for (const d of MUSCLE_GROUP_IDS) lastTrainedByDim.set(d, null);
  for (const day of recentDays) {
    const cur = lastTrainedByDim.get(day.dimension);
    const dt = new Date(day.dayDate + "T00:00:00Z");
    if (!cur || dt > cur) lastTrainedByDim.set(day.dimension, dt);
  }

  // PRD v3 Phase 2.5 (PRD §5.4) — weighted rotation. With the v2 engine
  // on, each dim's re-entry floor scales with relative weakness: the
  // weakest third comes back in 4 days (≈50% more volume), the middle
  // keeps the 6-day floor, and the strongest third stretches to 7 —
  // still cycling weekly, so strengths get maintenance reps and never
  // disappear (PRD: "no Core Skill permanently ignored"). Flag off →
  // uniform SIX_DAY_FLOOR, byte-identical to legacy.
  const floorByDim = new Map<MuscleGroupId, number>();
  if (input.weightedRotationEnabled) {
    const byWeakness = [...MUSCLE_GROUP_IDS]
      .map((dim) => ({
        dim,
        composite: effectiveCompositeFor(dim, engagement, recentReps),
      }))
      .sort((a, b) => {
        if (a.composite == null && b.composite == null) return 0;
        if (a.composite == null) return -1;
        if (b.composite == null) return 1;
        return a.composite - b.composite;
      });
    byWeakness.forEach((entry, rank) => {
      const floor = rank < 2 ? WEAK_SKILL_FLOOR : rank < 4 ? SIX_DAY_FLOOR : STRONG_SKILL_FLOOR;
      floorByDim.set(entry.dim, floor);
    });
  }

  const eligibleByFloor: MuscleGroupId[] = [];
  for (const dim of MUSCLE_GROUP_IDS) {
    const last = lastTrainedByDim.get(dim);
    const floor = floorByDim.get(dim) ?? SIX_DAY_FLOOR;
    if (!last || daysBetween(today, last) >= floor) {
      eligibleByFloor.push(dim);
    }
  }

  // No dim past floor → fall back to oldest last-trained dim.
  if (eligibleByFloor.length === 0) {
    let oldest: MuscleGroupId = MUSCLE_GROUP_IDS[0];
    let oldestDate: Date = lastTrainedByDim.get(oldest)!;
    for (const dim of MUSCLE_GROUP_IDS) {
      const d = lastTrainedByDim.get(dim);
      if (d && d < oldestDate) {
        oldest = dim;
        oldestDate = d;
      }
    }
    const alternates = pickAlternates(oldest, engagement, recentReps);
    return {
      suggested: oldest,
      alternates,
      rationale: buildRationale("oldest_fallback", oldest),
      rationaleCode: "oldest_fallback",
    };
  }

  // 4) Weakest-recent: among eligible dims, rank ascending by effective composite.
  const ranked = eligibleByFloor
    .map((dim) => ({
      dim,
      composite: effectiveCompositeFor(dim, engagement, recentReps),
    }))
    // Untrained (null) → push to front (highest priority).
    .sort((a, b) => {
      if (a.composite == null && b.composite == null) return 0;
      if (a.composite == null) return -1;
      if (b.composite == null) return 1;
      return a.composite - b.composite;
    });

  // PRD v3 Phase 3.5 — plateau intervention: when the weakest pick is
  // plateaued and the next-ranked non-plateaued dim is within striking
  // distance (≤6 pts), train THAT instead. Variety restarts progress
  // better than repetition (PRD §8.4.4).
  const PLATEAU_SWAP_MARGIN = 6;
  const plateaued = new Set(input.plateauedDims ?? []);
  let pickIdx = 0;
  if (plateaued.has(ranked[0]!.dim)) {
    const alt = ranked.findIndex(
      (r, i) =>
        i > 0 &&
        !plateaued.has(r.dim) &&
        (r.composite == null ||
          ranked[0]!.composite == null ||
          r.composite - ranked[0]!.composite <= PLATEAU_SWAP_MARGIN),
    );
    if (alt > 0) pickIdx = alt;
  }

  const suggested = ranked[pickIdx]!.dim;
  const altCandidates = ranked
    .filter((_, i) => i !== pickIdx)
    .slice(0, 2)
    .map((r) => r.dim);
  // Fill to 2 alternates if needed (small catalogs, early days).
  while (altCandidates.length < 2) {
    const next = MUSCLE_GROUP_IDS.find(
      (d) => d !== suggested && !altCandidates.includes(d),
    );
    if (!next) break;
    altCandidates.push(next);
  }

  // Decide which rationale: if the suggested dim's last-trained is >=6 days
  // ago, lean on the 6-day floor framing; otherwise weakest-recent.
  const last = lastTrainedByDim.get(suggested);
  const daysSince = last ? daysBetween(today, last) : null;
  if (daysSince != null && daysSince >= SIX_DAY_FLOOR) {
    return {
      suggested,
      alternates: altCandidates,
      rationale: buildRationale("six_day_floor", suggested, { daysSince }),
      rationaleCode: "six_day_floor",
    };
  }
  return {
    suggested,
    alternates: altCandidates,
    rationale: buildRationale("weakest_recent", suggested, {
      composite: ranked[pickIdx]!.composite,
    }),
    rationaleCode: "weakest_recent",
  };
}

function pickAlternates(
  exclude: MuscleGroupId,
  engagement: EngagementSnapshot[],
  recentReps: RecentRepsSnapshot[],
): MuscleGroupId[] {
  const others = MUSCLE_GROUP_IDS.filter((d) => d !== exclude);
  const ranked = others
    .map((dim) => ({
      dim,
      composite: effectiveCompositeFor(dim, engagement, recentReps),
    }))
    .sort((a, b) => {
      if (a.composite == null && b.composite == null) return 0;
      if (a.composite == null) return -1;
      if (b.composite == null) return 1;
      return a.composite - b.composite;
    });
  return ranked.slice(0, 2).map((r) => r.dim);
}

// ─── 2. Exercise sampler ─────────────────────────────────────────────────

export type SampleExercisesInput = {
  available: CatalogExercise[]; // already filtered to (dimension=dim, is_active=true)
  recentDays: RecentDaySnapshot[]; // dedupe input
  n?: number;
  seed: string;
  /** PRD v3 Phase 2.3 — the user's Hidden Skill running averages for
   *  this dimension (sub-skill id → 0-100 avg, null = never measured).
   *  When provided, selection weights toward exercises targeting weak
   *  Hidden Skills AND spreads picks across DIFFERENT Hidden Skills
   *  (PRD §5.5: a workout should cover distinct behaviors, not repeat
   *  one). When omitted, behavior is byte-identical to the legacy
   *  seeded shuffle — the v1 loop and tests are unaffected. */
  subSkillAverages?: Record<string, number | null>;
};

export function sampleExercises(input: SampleExercisesInput): CatalogExercise[] {
  const { available, recentDays, seed } = input;
  const n = input.n ?? 4;

  // Build the dedupe set: exercises planned in the user's last N same-dim days.
  // We only dedupe when we can do so without starving the sample.
  const sameDim =
    available.length > 0
      ? recentDays
          .filter((d) => d.dimension === available[0]!.dimension)
          .slice(0, DEDUPE_WINDOW_DAYS)
      : [];
  const dedupeSet = new Set<string>();
  for (const d of sameDim) {
    for (const id of d.plannedExerciseIds) dedupeSet.add(id);
  }

  // Try the dedupe-respecting path first.
  const preferred = available.filter((e) => !dedupeSet.has(e.id));
  const pool = preferred.length >= n ? preferred : available;
  const shuffled = seededShuffle(pool, seed);

  // Legacy path — no Hidden Skill signal supplied.
  if (!input.subSkillAverages) {
    return shuffled.slice(0, n);
  }
  return pickHiddenSkillAware(shuffled, n, input.subSkillAverages);
}

/** Greedy Hidden-Skill-aware pick over an already-seeded-shuffled pool.
 *
 * Each candidate gets a score = the WEAKEST of its targeted Hidden
 * Skills (never-measured skills count as 45 — slightly weaker than the
 * scale midpoint, so unmeasured behaviors get explored) + a diversity
 * penalty per Hidden Skill already covered by earlier picks. Lowest
 * score wins each round; the shuffle order is the deterministic
 * tiebreak. Exercises without hiddenSkills (pre-enrichment rows) score
 * a neutral 60.
 */
const UNMEASURED_SUB_SKILL_SCORE = 45;
const NO_METADATA_SCORE = 60;
const SKILL_OVERLAP_PENALTY = 15;

function pickHiddenSkillAware(
  shuffled: CatalogExercise[],
  n: number,
  averages: Record<string, number | null>,
): CatalogExercise[] {
  const picked: CatalogExercise[] = [];
  const coveredSkills = new Set<string>();
  const remaining = [...shuffled];

  while (picked.length < n && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i++) {
      const ex = remaining[i]!;
      let base = NO_METADATA_SCORE;
      if (ex.hiddenSkills && ex.hiddenSkills.length > 0) {
        base = Math.min(
          ...ex.hiddenSkills.map((s) =>
            averages[s] == null ? UNMEASURED_SUB_SKILL_SCORE : averages[s]!,
          ),
        );
      }
      const overlap = ex.hiddenSkills
        ? ex.hiddenSkills.filter((s) => coveredSkills.has(s)).length
        : 0;
      const score = base + overlap * SKILL_OVERLAP_PENALTY;
      // Strict < keeps the earliest (shuffle-ordered) candidate on ties.
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    const chosen = remaining.splice(bestIdx, 1)[0]!;
    picked.push(chosen);
    for (const s of chosen.hiddenSkills ?? []) coveredSkills.add(s);
  }
  return picked;
}

// ─── 3. Prompt candidate picker ──────────────────────────────────────────

export type PickPromptsInput = {
  available: CatalogPrompt[]; // already filtered to is_active=true for this exercise
  recentPromptIds: string[]; // user's last 30 reps' prompt_ids for THIS exercise
  k?: number;
  seed: string;
  /** When set, bias toward the easier end (composite < 60 case). */
  preferEasier?: boolean;
  /** PRD v3 Phase 10 (§8.4.3 "the difficulty and challenge level of the
   *  workout") — three-way difficulty bias. "easier" = intro-first
   *  (legacy behavior, and the preferEasier case); "neutral" = same
   *  intro-first ordering (byte-identical legacy default); "harder" =
   *  stretch-first for users performing ≥80 in the dim, so strong users
   *  finally see stretch prompts inside the slate. */
  challengeBias?: "easier" | "neutral" | "harder";
};

// D10 (final, Max 2026-07-06) — prompt slate is FIVE options: a
// deliberate deviation from both PRD numbers (Engine specs say 4,
// §5.6/§6.5 say 6). Logged in the tracker Decision Log.
export const PROMPT_SLATE_SIZE = 5;

export function pickPromptCandidates(
  input: PickPromptsInput,
): CatalogPrompt[] {
  const { available, recentPromptIds, seed } = input;
  const k = input.k ?? PROMPT_SLATE_SIZE;
  const bias =
    input.challengeBias ?? (input.preferEasier ? "easier" : "neutral");
  const recent = new Set(recentPromptIds.slice(0, PROMPT_BIAS_WINDOW));

  // 1) Split bank into "fresh" (not in recent) vs "used".
  const fresh = available.filter((p) => !recent.has(p.promptId));
  const used = available.filter((p) => recent.has(p.promptId));

  // 2) Shuffle each pool independently, then apply the difficulty bias
  //   WITHIN each pool, BEFORE concatenation — otherwise a low-difficulty
  //   "used" prompt would jump above a higher-difficulty "fresh" one and
  //   defeat the anti-repetition guard. Stable sort preserves the
  //   seeded shuffle order within each difficulty tier.
  const byBias = (a: CatalogPrompt, b: CatalogPrompt) =>
    bias === "harder" ? b.difficulty - a.difficulty : a.difficulty - b.difficulty;
  const sortedFresh = seededShuffle(fresh, seed).sort(byBias);
  const sortedUsed = seededShuffle(used, seed + ":u").sort(byBias);

  // 3) Prefer fresh, fill from used if needed.
  const pool = [...sortedFresh, ...sortedUsed];

  return pool.slice(0, k);
}
