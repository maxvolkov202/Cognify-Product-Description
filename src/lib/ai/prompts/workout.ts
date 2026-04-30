import type { RepTypeId } from "@/lib/ai/rep-types";
import type { VerticalId } from "@/lib/onboarding/constants";
import {
  pickVerticalPrompts,
  pickVerticalPromptObjects,
  verticalBankSize,
} from "./verticals";
import type { VerticalPrompt, WorkoutPrompt, WorkoutTheme } from "./types";

/**
 * Daily Workout prompt bank.
 *
 * Per the team spec: Daily Workout prompts are **general**, not vertical-
 * specific. Life, health, habits, communication — topics everyone can
 * engage with regardless of career. Verticalized prompts live in
 * src/lib/ai/prompts/verticals.ts and power the Build a Rep flow.
 *
 * Each rep type's bank is keyed by `RepTypeId` and stores `WorkoutPrompt`
 * objects with a stable `id` and a `theme` tag. The id is `${repType}_NNN`
 * zero-padded so ordering is stable across diffs. Themes drive stratified
 * sampling (Phase B) — three buckets only (work / life / abstract) so
 * authoring doesn't drown in taxonomy.
 *
 * Authoring rules:
 *   - Concrete: name the setting, audience, stakes. No abstract "talk about X".
 *   - Realistic: lines a real person would actually say.
 *   - General-life flavored: workout prompts are not vertical-gated.
 *   - Pick one theme per prompt — don't try to cover all three at once.
 */

export const WORKOUT_PROMPTS: Record<RepTypeId, readonly WorkoutPrompt[]> = {
  simplify: [
    { id: "simplify_001", text: "Explain how the internet works to someone who has never used it", theme: "abstract" },
    { id: "simplify_002", text: "Explain how money works to a child", theme: "life" },
    { id: "simplify_003", text: "Explain how exercise helps the body", theme: "life" },
    { id: "simplify_004", text: "Explain how habits are formed", theme: "life" },
    { id: "simplify_005", text: "Explain how sleep affects your energy", theme: "life" },
    { id: "simplify_006", text: "Explain how airplanes stay in the air", theme: "abstract" },
    { id: "simplify_007", text: "Explain why the sky is blue", theme: "abstract" },
    { id: "simplify_008", text: "Explain how a smartphone takes a photo", theme: "abstract" },
    { id: "simplify_009", text: "Explain what electricity is", theme: "abstract" },
    { id: "simplify_010", text: "Explain how language learning works in the brain", theme: "abstract" },
    { id: "simplify_011", text: "Explain what the stock market is", theme: "abstract" },
    { id: "simplify_012", text: "Explain how a refrigerator keeps food cold", theme: "abstract" },
    { id: "simplify_013", text: "Explain why we dream", theme: "abstract" },
    { id: "simplify_014", text: "Explain what AI actually does", theme: "abstract" },
    { id: "simplify_015", text: "Explain how vaccines work", theme: "abstract" },
  ],
  structure: [
    { id: "structure_001", text: "Why is communication important in everyday life?", theme: "abstract" },
    { id: "structure_002", text: "What makes a good leader?", theme: "work" },
    { id: "structure_003", text: "Why is staying healthy important?", theme: "life" },
    { id: "structure_004", text: "What makes a strong team?", theme: "work" },
    { id: "structure_005", text: "Why is learning new skills important?", theme: "life" },
    { id: "structure_006", text: "What makes a city livable?", theme: "abstract" },
    { id: "structure_007", text: "Why do routines matter?", theme: "life" },
    { id: "structure_008", text: "What defines a successful career?", theme: "work" },
    { id: "structure_009", text: "Why is sleep non-negotiable?", theme: "life" },
    { id: "structure_010", text: "What makes feedback effective?", theme: "work" },
    { id: "structure_011", text: "Why does reading matter?", theme: "life" },
    { id: "structure_012", text: "What separates good decisions from bad ones?", theme: "abstract" },
    { id: "structure_013", text: "Why do some habits stick and others don't?", theme: "life" },
    { id: "structure_014", text: "What makes a meeting productive?", theme: "work" },
    { id: "structure_015", text: "Why is trust the foundation of every relationship?", theme: "life" },
  ],
  think_fast: [
    { id: "think_fast_001", text: "Is technology making people more connected or less?", theme: "abstract" },
    { id: "think_fast_002", text: "Should people work from home or in an office?", theme: "work" },
    { id: "think_fast_003", text: "What is the most important skill to learn today?", theme: "life" },
    { id: "think_fast_004", text: "Is failure necessary for success?", theme: "abstract" },
    { id: "think_fast_005", text: "Are routines helpful or limiting?", theme: "life" },
    { id: "think_fast_006", text: "Should curiosity be taught, or is it innate?", theme: "abstract" },
    { id: "think_fast_007", text: "Is social media net positive or net negative?", theme: "abstract" },
    { id: "think_fast_008", text: "Should you trust your gut or the data?", theme: "abstract" },
    { id: "think_fast_009", text: "Is hard work overrated?", theme: "abstract" },
    { id: "think_fast_010", text: "Should schools prioritize creativity or discipline?", theme: "abstract" },
    { id: "think_fast_011", text: "Are meetings ever actually useful?", theme: "work" },
    { id: "think_fast_012", text: "Should you follow your passion or your strengths?", theme: "life" },
    { id: "think_fast_013", text: "Is optimism a choice or a trait?", theme: "abstract" },
    { id: "think_fast_014", text: "Should we automate everything we can?", theme: "abstract" },
    { id: "think_fast_015", text: "Is reading fiction a waste of time?", theme: "abstract" },
  ],
  be_concise: [
    { id: "be_concise_001", text: "Explain how investing works in 20 seconds", theme: "life" },
    { id: "be_concise_002", text: "Explain how habits are formed in 20 seconds", theme: "life" },
    { id: "be_concise_003", text: "Explain why exercise is important in 15 seconds", theme: "life" },
    { id: "be_concise_004", text: "Explain how the internet works in 20 seconds", theme: "abstract" },
    { id: "be_concise_005", text: "Explain how sleep impacts your health in 20 seconds", theme: "life" },
    { id: "be_concise_006", text: "Explain what leadership means in 15 seconds", theme: "work" },
    { id: "be_concise_007", text: "Explain why time management matters in 20 seconds", theme: "life" },
    { id: "be_concise_008", text: "Explain how decisions get made in 20 seconds", theme: "abstract" },
    { id: "be_concise_009", text: "Explain what makes feedback useful in 15 seconds", theme: "work" },
    { id: "be_concise_010", text: "Explain why consistency beats intensity in 20 seconds", theme: "life" },
    { id: "be_concise_011", text: "Explain how to learn a new skill in 20 seconds", theme: "life" },
    { id: "be_concise_012", text: "Explain what makes a team work in 15 seconds", theme: "work" },
    { id: "be_concise_013", text: "Explain why clarity matters in 15 seconds", theme: "abstract" },
    { id: "be_concise_014", text: "Explain what curiosity does in 20 seconds", theme: "abstract" },
    { id: "be_concise_015", text: "Explain how focus works in 20 seconds", theme: "life" },
  ],
  reinforce: [
    { id: "reinforce_001", text: "Explain how to build a good habit", theme: "life" },
    { id: "reinforce_002", text: "Explain how to stay organized", theme: "life" },
    { id: "reinforce_003", text: "Explain how to cook a simple meal", theme: "life" },
    { id: "reinforce_004", text: "Explain how to improve focus", theme: "life" },
    { id: "reinforce_005", text: "Explain how to manage your time", theme: "life" },
    { id: "reinforce_006", text: "Explain how to give clear instructions", theme: "work" },
    { id: "reinforce_007", text: "Explain how to apologize effectively", theme: "life" },
    { id: "reinforce_008", text: "Explain how to say no politely", theme: "life" },
    { id: "reinforce_009", text: "Explain how to take useful notes", theme: "life" },
    { id: "reinforce_010", text: "Explain how to make a decision under uncertainty", theme: "abstract" },
    { id: "reinforce_011", text: "Explain how to break a bad habit", theme: "life" },
    { id: "reinforce_012", text: "Explain how to ask a good question", theme: "abstract" },
    { id: "reinforce_013", text: "Explain how to remember names", theme: "life" },
    { id: "reinforce_014", text: "Explain how to get better at listening", theme: "life" },
    { id: "reinforce_015", text: "Explain how to recover from a mistake", theme: "life" },
  ],
  persuade: [
    { id: "persuade_001", text: "Convince someone to exercise regularly", theme: "life" },
    { id: "persuade_002", text: "Convince someone to read more", theme: "life" },
    { id: "persuade_003", text: "Convince someone to wake up earlier", theme: "life" },
    { id: "persuade_004", text: "Convince someone to save money", theme: "life" },
    { id: "persuade_005", text: "Convince someone to learn a new skill", theme: "life" },
    { id: "persuade_006", text: "Convince someone to prioritize sleep", theme: "life" },
    { id: "persuade_007", text: "Convince someone to take a calculated risk", theme: "abstract" },
    { id: "persuade_008", text: "Convince someone to try meditation", theme: "life" },
    { id: "persuade_009", text: "Convince someone to spend less time on social media", theme: "life" },
    { id: "persuade_010", text: "Convince someone to ask for a raise", theme: "work" },
    { id: "persuade_011", text: "Convince someone to write more clearly", theme: "abstract" },
    { id: "persuade_012", text: "Convince someone to take a vacation", theme: "life" },
    { id: "persuade_013", text: "Convince someone to start a side project", theme: "life" },
    { id: "persuade_014", text: "Convince someone to speak up more in meetings", theme: "work" },
    { id: "persuade_015", text: "Convince someone to stop multitasking", theme: "life" },
  ],
  adapt: [
    { id: "adapt_001", text: "Explain how money works to a child, then to an adult", theme: "life" },
    { id: "adapt_002", text: "Explain exercise to a beginner, then to an athlete", theme: "life" },
    { id: "adapt_003", text: "Explain the internet to a senior, then to a teenager", theme: "life" },
    { id: "adapt_004", text: "Explain teamwork to a student, then to a manager", theme: "work" },
    { id: "adapt_005", text: "Explain healthy eating to a child, then to a parent", theme: "life" },
    { id: "adapt_006", text: "Explain coding to a non-technical friend, then to a colleague", theme: "work" },
    { id: "adapt_007", text: "Explain leadership to an intern, then to a CEO", theme: "work" },
    { id: "adapt_008", text: "Explain AI to a skeptic, then to an enthusiast", theme: "abstract" },
    { id: "adapt_009", text: "Explain budgeting to a student, then to a retiree", theme: "life" },
    { id: "adapt_010", text: "Explain storytelling to a writer, then to an engineer", theme: "work" },
    { id: "adapt_011", text: "Explain failure to a perfectionist, then to a risk-taker", theme: "abstract" },
    { id: "adapt_012", text: "Explain focus to a procrastinator, then to a workaholic", theme: "life" },
    { id: "adapt_013", text: "Explain feedback to a junior employee, then to a VP", theme: "work" },
    { id: "adapt_014", text: "Explain habits to a child, then to a busy professional", theme: "life" },
    { id: "adapt_015", text: "Explain change to someone who fears it, then to someone who craves it", theme: "abstract" },
  ],
  deliver: [
    { id: "deliver_001", text: "Explain why communication matters — pause between ideas for emphasis", theme: "abstract" },
    { id: "deliver_002", text: "Explain how habits are formed — slow and deliberate", theme: "life" },
    { id: "deliver_003", text: "Describe your daily routine with clear pauses", theme: "life" },
    { id: "deliver_004", text: "Explain why sleep is important with controlled pacing", theme: "life" },
    { id: "deliver_005", text: "Explain a topic while emphasizing key ideas through tempo", theme: "abstract" },
    { id: "deliver_006", text: "Share a lesson you learned — let the important beats breathe", theme: "life" },
    { id: "deliver_007", text: "Explain a decision — use silence to signal weight", theme: "abstract" },
    { id: "deliver_008", text: "Describe a place that mattered to you — pace it like a story", theme: "life" },
    { id: "deliver_009", text: "Explain a concept with three deliberate peaks", theme: "abstract" },
    { id: "deliver_010", text: "Share an opinion with controlled cadence", theme: "abstract" },
    { id: "deliver_011", text: "Explain a memory — slow for emphasis, speed for action", theme: "life" },
    { id: "deliver_012", text: "Give advice with pauses after each point", theme: "abstract" },
    { id: "deliver_013", text: "Describe something you love — let rhythm carry the warmth", theme: "life" },
    { id: "deliver_014", text: "Explain a rule you live by — deliberate and unhurried", theme: "life" },
    { id: "deliver_015", text: "Describe a turning point — use tempo to mark the shift", theme: "life" },
  ],
  handle_pressure: [
    { id: "handle_pressure_001", text: "You're explaining why exercising is important. Someone says: 'That doesn't make sense.' Respond.", theme: "life" },
    { id: "handle_pressure_002", text: "You're saying people should limit social media. Someone says: 'I don't agree.' Respond.", theme: "life" },
    { id: "handle_pressure_003", text: "You're explaining saving money. Someone says: 'Why does this matter?' Respond.", theme: "life" },
    { id: "handle_pressure_004", text: "You're suggesting waking up early. Someone says: 'This is unnecessary.' Respond.", theme: "life" },
    { id: "handle_pressure_005", text: "You're proposing reading more. Someone says: 'That won't work.' Respond.", theme: "life" },
    { id: "handle_pressure_006", text: "You're advocating for routines. Someone says: 'I find routines suffocating.' Respond.", theme: "life" },
    { id: "handle_pressure_007", text: "You're recommending meditation. Someone says: 'That's a waste of time.' Respond.", theme: "life" },
    { id: "handle_pressure_008", text: "You're explaining why feedback is important. Someone says: 'Feedback is just criticism.' Respond.", theme: "work" },
    { id: "handle_pressure_009", text: "You're encouraging skill learning. Someone says: 'I'm too old for that.' Respond.", theme: "life" },
    { id: "handle_pressure_010", text: "You're making a case for sleep. Someone says: 'I function fine on 5 hours.' Respond.", theme: "life" },
    { id: "handle_pressure_011", text: "You're suggesting writing things down. Someone says: 'I remember everything.' Respond.", theme: "life" },
    { id: "handle_pressure_012", text: "You're recommending walks. Someone says: 'That's not real exercise.' Respond.", theme: "life" },
    { id: "handle_pressure_013", text: "You're advocating taking breaks. Someone says: 'Breaks make me lazy.' Respond.", theme: "work" },
    { id: "handle_pressure_014", text: "You're explaining why listening matters. Someone says: 'I'd rather be talking.' Respond.", theme: "life" },
    { id: "handle_pressure_015", text: "You're recommending journaling. Someone says: 'That's for teenagers.' Respond.", theme: "life" },
  ],
};

function fisherYates<T>(arr: readonly T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Stratified sampling. Round-robins across present themes (work / life /
 * abstract) before doubling up, so a slate covers every present theme
 * when `count >= present-theme count`. Theme visit order is shuffled per
 * call so consecutive refreshes vary the blend, not just permute it.
 *
 * Why this matters: a flat shuffle on a work-heavy bank surfaces work
 * prompts disproportionately; users perceive the bank as "all corporate"
 * even when the bank is large. Stratification eliminates that.
 */
function pickStratifiedByTheme(
  bank: readonly WorkoutPrompt[],
  count: number,
  rand: () => number = Math.random,
): WorkoutPrompt[] {
  if (bank.length === 0 || count <= 0) return [];

  const buckets: Record<WorkoutTheme, WorkoutPrompt[]> = {
    work: [],
    life: [],
    abstract: [],
  };
  for (const p of bank) buckets[p.theme].push(p);

  const ordered: Record<WorkoutTheme, WorkoutPrompt[]> = {
    work: fisherYates(buckets.work, rand),
    life: fisherYates(buckets.life, rand),
    abstract: fisherYates(buckets.abstract, rand),
  };

  const presentThemes: WorkoutTheme[] = (
    Object.keys(ordered) as WorkoutTheme[]
  ).filter((t) => ordered[t].length > 0);
  const themeOrder = fisherYates(presentThemes, rand);

  const picked: WorkoutPrompt[] = [];
  while (picked.length < count) {
    let advanced = false;
    for (const theme of themeOrder) {
      if (picked.length >= count) break;
      const next = ordered[theme].shift();
      if (next) {
        picked.push(next);
        advanced = true;
      }
    }
    if (!advanced) break; // all buckets drained
  }
  return picked;
}

/**
 * O(1) id → prompt lookup, built once at module load. The expansion-pass
 * banks (1500+ prompts) make per-call linear scans untenable for the
 * history filter, which calls getById per candidate during filtering.
 */
const WORKOUT_PROMPT_INDEX: ReadonlyMap<string, WorkoutPrompt> = (() => {
  const map = new Map<string, WorkoutPrompt>();
  for (const bank of Object.values(WORKOUT_PROMPTS)) {
    for (const p of bank) map.set(p.id, p);
  }
  return map;
})();

/** Look up a single workout prompt object by id. */
export function getWorkoutPromptById(id: string): WorkoutPrompt | undefined {
  return WORKOUT_PROMPT_INDEX.get(id);
}

/** Theme of a given workout prompt id, for telemetry / picker rebalancing. */
export function getWorkoutPromptTheme(id: string): WorkoutTheme | undefined {
  return WORKOUT_PROMPT_INDEX.get(id)?.theme;
}

/**
 * Pick N prompt objects from a rep type's bank using stratified theme
 * sampling. The object form preserves stable ids so the per-user history
 * filter can record what was shown without round-tripping through text.
 *
 * Round-robins across present themes (work / life / abstract) before
 * doubling up, so a 5-prompt slate always shows variety when the bank
 * has multiple themes. Theme visit order shuffles per call.
 *
 * `excludeIds` filters the candidate pool. Falls back to the seen pool
 * only when filtering empties the bank, so a power user past saturation
 * still sees prompts — just ones they've seen before.
 */
export function pickWorkoutPromptObjects(
  repType: RepTypeId,
  count: number = 5,
  opts: { rand?: () => number; excludeIds?: ReadonlySet<string> } = {},
): WorkoutPrompt[] {
  const bank = WORKOUT_PROMPTS[repType];
  if (!bank || bank.length === 0) return [];

  const exclude = opts.excludeIds;
  if (!exclude || exclude.size === 0) {
    return pickStratifiedByTheme(bank, count, opts.rand);
  }

  const unseen = bank.filter((p) => !exclude.has(p.id));
  // Saturation fallback: when every prompt has been seen, pick from the
  // full bank rather than returning nothing — the user sees a familiar
  // prompt instead of an empty slate.
  const pool = unseen.length > 0 ? unseen : bank;
  const picks = pickStratifiedByTheme(pool, count, opts.rand);

  // Top up from the seen pool when the unseen pool was non-empty but
  // smaller than `count`. Maintains slate size at the cost of mixing in
  // a familiar prompt — better than serving fewer than 5.
  if (picks.length < count && pool === unseen && unseen.length < bank.length) {
    const seen = bank.filter((p) => exclude.has(p.id));
    const extras = pickStratifiedByTheme(seen, count - picks.length, opts.rand);
    return [...picks, ...extras];
  }
  return picks;
}

/** Text-returning picker — thin wrapper for callers that don't need ids. */
export function pickWorkoutPrompts(
  repType: RepTypeId,
  count: number = 5,
  opts: { rand?: () => number; excludeIds?: ReadonlySet<string> } = {},
): string[] {
  return pickWorkoutPromptObjects(repType, count, opts).map((p) => p.text);
}

/** Total number of prompts available in a rep type's bank. */
export function workoutBankSize(repType: RepTypeId): number {
  return WORKOUT_PROMPTS[repType]?.length ?? 0;
}

/**
 * Pick N prompts blending rep-type drills with the user's vertical
 * scenarios. Default mix: ~60% rep-type / ~40% vertical so users see
 * industry-specific flavor without losing the drill focus.
 *
 * Falls back to pure rep-type prompts when no vertical is provided or
 * the vertical bank is empty — identical to pickWorkoutPrompts in
 * that case, so swapping this in is safe.
 */
export function pickBlendedWorkoutPrompts(
  repType: RepTypeId,
  vertical: VerticalId | undefined | null,
  count: number = 5,
  opts: { excludeIds?: ReadonlySet<string> } = {},
): string[] {
  return pickBlendedWorkoutPromptObjects(repType, vertical, count, opts).map(
    (p) => p.text,
  );
}

/**
 * Object-form blended picker — same shape as pickBlendedWorkoutPrompts
 * but returns the typed prompt objects so callers can record stable ids
 * via /api/prompt-history. Each result is either a WorkoutPrompt or a
 * VerticalPrompt; both share `id` and `text` fields.
 */
export function pickBlendedWorkoutPromptObjects(
  repType: RepTypeId,
  vertical: VerticalId | undefined | null,
  count: number = 5,
  opts: { excludeIds?: ReadonlySet<string> } = {},
): Array<WorkoutPrompt | VerticalPrompt> {
  const repTypeBank = WORKOUT_PROMPTS[repType] ?? [];
  if (!vertical) {
    return pickWorkoutPromptObjects(repType, count, {
      ...(opts.excludeIds ? { excludeIds: opts.excludeIds } : {}),
    });
  }

  if (verticalBankSize(vertical) === 0) {
    return pickWorkoutPromptObjects(repType, count, {
      ...(opts.excludeIds ? { excludeIds: opts.excludeIds } : {}),
    });
  }

  const verticalShare = Math.max(1, Math.round(count * 0.4));
  const repTypeShare = Math.max(1, count - verticalShare);

  const repTypePicks = pickWorkoutPromptObjects(repType, repTypeShare, {
    ...(opts.excludeIds ? { excludeIds: opts.excludeIds } : {}),
  });
  const verticalPicks = pickVerticalPromptObjects(
    vertical,
    verticalShare,
    opts.excludeIds ? { excludeIds: opts.excludeIds } : {},
  );

  // De-dup by text — banks across rep types and verticals carry distinct
  // ids, so id-based dedup wouldn't catch the case that actually fires
  // here: an authoring overlap where two banks happen to ship the same
  // sentence. Text dedup is the right key for cross-bank blending.
  const seen = new Set<string>();
  const blend: Array<WorkoutPrompt | VerticalPrompt> = [];
  for (const p of [...verticalPicks, ...repTypePicks]) {
    if (!seen.has(p.text)) {
      seen.add(p.text);
      blend.push(p);
    }
  }
  // Final shuffle so vertical picks don't always cluster at the top.
  for (let i = blend.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [blend[i], blend[j]] = [blend[j]!, blend[i]!];
  }
  return blend.slice(0, count);
}
