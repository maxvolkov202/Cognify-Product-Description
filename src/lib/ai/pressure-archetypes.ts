import type { SkillDimension } from "@/types/domain";

/**
 * Cognify Pressure Archetypes — WS-3 foundation
 *
 * Five distinct mechanisms that stress a rep, so "pressure" doesn't
 * habituate to a single pattern. Selected per session by the workout
 * orchestrator; always placed at the penultimate position (Build → Build
 * → Stress → Reinforce arc).
 *
 * Why five, not more: a week of daily sessions produces ~5 pressure reps.
 * Five archetypes means the user sees each once per week, preventing
 * habituation without exhausting the catalog. See
 * `docs/proposals/pressure-system.md` §3 for the full spec.
 *
 * Weight profiles: each archetype boosts the dimensions it actually
 * stresses. Composite score is normalized so aggressive boosts don't
 * punish other dimensions — they just emphasize what the archetype was
 * designed to measure.
 *
 * WS-1 dependency: weight keys reference the v2-beta.2 rubric
 * (clarity/structure/relevance/confidence/pacing/tone). When WS-1 signs
 * off and the rubric upgrades to v2.0.0 (clarity/structure/conciseness/
 * thinking_quality/delivery/tone), a codemod updates these keys.
 * The `WEIGHT_PROFILE_RUBRIC_VERSION` constant pins the current mapping.
 */

/** The version of the rubric these weight profiles were authored against.
 *  Bump when the rubric changes so the scoring pipeline can detect and
 *  migrate historical profiles without silent drift. */
export const WEIGHT_PROFILE_RUBRIC_VERSION = "v3.0.0";

export type PressureArchetypeId =
  | "pushback"
  | "time_compression"
  | "audience_switch"
  | "clarifying_interrupt"
  | "stakes_raise";

export type PressureArchetype = {
  readonly id: PressureArchetypeId;
  /** User-facing short name. */
  readonly name: string;
  /** One-line explanation shown above the prompt on the pre-start screen. */
  readonly tagline: string;
  /** Longer paragraph the user can expand to read before starting. */
  readonly whatToExpect: string;
  /** How the rep's own timer differs from the rep type's baseline.
   *  Applied in the orchestrator as `repType.timeBudgetSec + durationDeltaSec`.
   *  Negative values = shorter. Zero = use rep type default. */
  readonly durationDeltaSec: number;
  /** Dimensions this archetype stresses most — surfaced in the post-rep
   *  "what you trained" tile. Order matters (primary first). */
  readonly stressedDimensions: readonly SkillDimension[];
  /** Scoring weight overrides for this archetype, applied on top of rep
   *  type defaults. Missing keys = use rep type / rubric default (1.0). */
  readonly weightProfile: Partial<Record<SkillDimension, number>>;
  /** Color token for the PressureRepIndicator. Keeps archetype
   *  differentiation subtle but present. All warm amber/orange to stay
   *  semantically "pressure" without clashing with the brand gradient. */
  readonly accentColor:
    | "amber"
    | "orange"
    | "rose";
};

/**
 * The five archetypes. Ordered here roughly by cognitive-load difficulty
 * so UI affordances (like "coming soon" docs or archetype explainers)
 * can render them in a sensible order.
 */
export const PRESSURE_ARCHETYPES: Record<
  PressureArchetypeId,
  PressureArchetype
> = {
  pushback: {
    id: "pushback",
    name: "Pushback",
    tagline: "Make the case. Then defend it when someone disagrees.",
    whatToExpect:
      "The prompt sets up a claim you need to argue. Toward the end, a specific objection arrives in the prompt itself — a line someone might actually say. You acknowledge it and redirect without abandoning your original point. Hold structure under disagreement.",
    durationDeltaSec: 0,
    stressedDimensions: ["thinking_quality", "tone", "structure"],
    weightProfile: {
      thinking_quality: 1.4,
      tone: 1.3,
      structure: 1.0,
      clarity: 0.9,
      conciseness: 0.9,
      delivery: 0.8,
    },
    accentColor: "amber",
  },
  time_compression: {
    id: "time_compression",
    name: "Time Compression",
    tagline: "Same idea. Half the time.",
    whatToExpect:
      "You'll explain something that normally needs a minute — in 15 to 20 seconds. No preamble. Every word has to earn its place. If the real answer doesn't fit, say the shortest version that does.",
    durationDeltaSec: -40,
    stressedDimensions: ["conciseness", "delivery", "clarity"],
    weightProfile: {
      conciseness: 1.5,
      delivery: 1.3,
      clarity: 1.2,
      structure: 0.9,
      tone: 0.8,
      thinking_quality: 0.8,
    },
    accentColor: "orange",
  },
  audience_switch: {
    id: "audience_switch",
    name: "Audience Switch",
    tagline: "Explain it twice. Two different listeners. One rep.",
    whatToExpect:
      "You'll make the same point to two very different people in the same rep. Halfway through, the prompt says: \"Now tell it to [the other audience].\" The facts stay. The register, vocabulary, and stakes shift. Don't restart — pivot.",
    durationDeltaSec: 15,
    stressedDimensions: ["tone", "clarity", "structure"],
    weightProfile: {
      tone: 1.5,
      clarity: 1.2,
      structure: 1.1,
      delivery: 0.9,
      thinking_quality: 0.9,
      conciseness: 0.9,
    },
    accentColor: "amber",
  },
  clarifying_interrupt: {
    id: "clarifying_interrupt",
    name: "Clarifying Interrupt",
    tagline: "Mid-sentence, someone says: that doesn't make sense.",
    whatToExpect:
      "You're explaining something. Partway through, the prompt simulates an interruption — a specific line that says you've lost them. You acknowledge, recover, and land the point. The interruption is in the prompt text; it's on you to build it into your rep.",
    durationDeltaSec: 0,
    stressedDimensions: ["thinking_quality", "structure", "tone"],
    weightProfile: {
      thinking_quality: 1.4,
      structure: 1.2,
      tone: 1.2,
      clarity: 1.0,
      delivery: 0.9,
      conciseness: 0.9,
    },
    accentColor: "rose",
  },
  stakes_raise: {
    id: "stakes_raise",
    name: "Stakes Raise",
    tagline: "The moment that matters. Don't break.",
    whatToExpect:
      "The prompt names a real consequence — offer, promotion, deal, trust with your team. The mechanics are normal: prompt, 45 seconds, speak. What's different is the framing. The test is whether your delivery holds when the frame says it counts.",
    durationDeltaSec: 0,
    stressedDimensions: ["thinking_quality", "delivery", "tone"],
    weightProfile: {
      thinking_quality: 1.4,
      delivery: 1.2,
      tone: 1.2,
      clarity: 1.0,
      structure: 1.0,
      conciseness: 0.9,
    },
    accentColor: "amber",
  },
} as const;

export const PRESSURE_ARCHETYPE_IDS: readonly PressureArchetypeId[] = [
  "pushback",
  "time_compression",
  "audience_switch",
  "clarifying_interrupt",
  "stakes_raise",
];

/**
 * Select a pressure archetype for a new session. Uniformly random with
 * one exclusion: the archetype used in the previous session (if known).
 * Keeps users from seeing the same archetype back-to-back when running
 * multiple sessions in a day.
 *
 * Accepts an optional `rand` function for deterministic testing.
 */
export function selectPressureArchetype(opts: {
  previousArchetype?: PressureArchetypeId | null;
  rand?: () => number;
} = {}): PressureArchetype {
  const { previousArchetype, rand = Math.random } = opts;
  const pool = previousArchetype
    ? PRESSURE_ARCHETYPE_IDS.filter((id) => id !== previousArchetype)
    : PRESSURE_ARCHETYPE_IDS;
  const idx = Math.floor(rand() * pool.length);
  const id = pool[idx] ?? pool[0]!;
  return PRESSURE_ARCHETYPES[id];
}

export function getPressureArchetype(
  id: PressureArchetypeId,
): PressureArchetype {
  return PRESSURE_ARCHETYPES[id];
}

export function isPressureArchetypeId(
  value: string,
): value is PressureArchetypeId {
  return PRESSURE_ARCHETYPE_IDS.includes(value as PressureArchetypeId);
}
