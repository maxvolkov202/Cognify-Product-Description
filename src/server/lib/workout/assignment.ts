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
};

// ─── Outputs ─────────────────────────────────────────────────────────────

export type RationaleCode =
  | "cold_start"
  | "sharp_regression"
  | "six_day_floor"
  | "weakest_recent"
  | "oldest_fallback";

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
/** Composite drop that surfaces a dim early regardless of floor. */
export const SHARP_REGRESSION_THRESHOLD = 8;
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
    [copy[i]!, copy[j]!] = [copy[j]!, copy[i]!];
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
  }
}

// ─── 1. Muscle-group selector ────────────────────────────────────────────

export function selectMuscleGroupForToday(input: SelectInput): SelectResult {
  const { today, engagement, recentReps, recentDays } = input;

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

  const eligibleByFloor: MuscleGroupId[] = [];
  for (const dim of MUSCLE_GROUP_IDS) {
    const last = lastTrainedByDim.get(dim);
    if (!last || daysBetween(today, last) >= SIX_DAY_FLOOR) {
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

  const suggested = ranked[0]!.dim;
  const altCandidates = ranked.slice(1, 3).map((r) => r.dim);
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
      composite: ranked[0]!.composite,
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
  if (preferred.length >= n) {
    return seededShuffle(preferred, seed).slice(0, n);
  }

  // Catalog too small to dedupe cleanly — relax + use the whole pool.
  return seededShuffle(available, seed).slice(0, n);
}

// ─── 3. Prompt candidate picker ──────────────────────────────────────────

export type PickPromptsInput = {
  available: CatalogPrompt[]; // already filtered to is_active=true for this exercise
  recentPromptIds: string[]; // user's last 30 reps' prompt_ids for THIS exercise
  k?: number;
  seed: string;
  /** When set, bias toward the easier end (composite < 60 case). */
  preferEasier?: boolean;
};

export function pickPromptCandidates(
  input: PickPromptsInput,
): CatalogPrompt[] {
  const { available, recentPromptIds, seed } = input;
  const k = input.k ?? 5;
  const recent = new Set(recentPromptIds.slice(0, PROMPT_BIAS_WINDOW));

  // 1) Split bank into "fresh" (not in recent) vs "used".
  const fresh = available.filter((p) => !recent.has(p.promptId));
  const used = available.filter((p) => recent.has(p.promptId));

  // 2) Shuffle each pool, prefer fresh, fill from used if needed.
  let pool = [...seededShuffle(fresh, seed), ...seededShuffle(used, seed + ":u")];

  // 3) Difficulty bias toward intro+core when the user's recent composite is low.
  if (input.preferEasier) {
    pool = pool.sort((a, b) => a.difficulty - b.difficulty);
  }

  return pool.slice(0, k);
}
