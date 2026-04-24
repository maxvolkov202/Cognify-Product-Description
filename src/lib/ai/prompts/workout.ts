import type { RepTypeId } from "@/lib/ai/rep-types";
import type { VerticalId } from "@/lib/onboarding/constants";
import { pickVerticalPrompts, verticalBankSize } from "./verticals";

/**
 * Daily Workout prompt bank.
 *
 * Per the team spec: Daily Workout prompts are **general**, not vertical-
 * specific. Life, health, habits, communication — topics everyone can
 * engage with regardless of career. Verticalized prompts live in
 * src/lib/ai/prompts/verticals.ts and power the Build a Rep flow.
 *
 * Each rep type has ~15 prompts. The workout picker shows 5 at a time
 * and exposes a Refresh button to see 5 more from the same bank.
 */

export const WORKOUT_PROMPTS: Record<RepTypeId, readonly string[]> = {
  simplify: [
    "Explain how the internet works to someone who has never used it",
    "Explain how money works to a child",
    "Explain how exercise helps the body",
    "Explain how habits are formed",
    "Explain how sleep affects your energy",
    "Explain how airplanes stay in the air",
    "Explain why the sky is blue",
    "Explain how a smartphone takes a photo",
    "Explain what electricity is",
    "Explain how language learning works in the brain",
    "Explain what the stock market is",
    "Explain how a refrigerator keeps food cold",
    "Explain why we dream",
    "Explain what AI actually does",
    "Explain how vaccines work",
  ],
  structure: [
    "Why is communication important in everyday life?",
    "What makes a good leader?",
    "Why is staying healthy important?",
    "What makes a strong team?",
    "Why is learning new skills important?",
    "What makes a city livable?",
    "Why do routines matter?",
    "What defines a successful career?",
    "Why is sleep non-negotiable?",
    "What makes feedback effective?",
    "Why does reading matter?",
    "What separates good decisions from bad ones?",
    "Why do some habits stick and others don't?",
    "What makes a meeting productive?",
    "Why is trust the foundation of every relationship?",
  ],
  think_fast: [
    "Is technology making people more connected or less?",
    "Should people work from home or in an office?",
    "What is the most important skill to learn today?",
    "Is failure necessary for success?",
    "Are routines helpful or limiting?",
    "Should curiosity be taught, or is it innate?",
    "Is social media net positive or net negative?",
    "Should you trust your gut or the data?",
    "Is hard work overrated?",
    "Should schools prioritize creativity or discipline?",
    "Are meetings ever actually useful?",
    "Should you follow your passion or your strengths?",
    "Is optimism a choice or a trait?",
    "Should we automate everything we can?",
    "Is reading fiction a waste of time?",
  ],
  be_concise: [
    "Explain how investing works in 20 seconds",
    "Explain how habits are formed in 20 seconds",
    "Explain why exercise is important in 15 seconds",
    "Explain how the internet works in 20 seconds",
    "Explain how sleep impacts your health in 20 seconds",
    "Explain what leadership means in 15 seconds",
    "Explain why time management matters in 20 seconds",
    "Explain how decisions get made in 20 seconds",
    "Explain what makes feedback useful in 15 seconds",
    "Explain why consistency beats intensity in 20 seconds",
    "Explain how to learn a new skill in 20 seconds",
    "Explain what makes a team work in 15 seconds",
    "Explain why clarity matters in 15 seconds",
    "Explain what curiosity does in 20 seconds",
    "Explain how focus works in 20 seconds",
  ],
  reinforce: [
    "Explain how to build a good habit",
    "Explain how to stay organized",
    "Explain how to cook a simple meal",
    "Explain how to improve focus",
    "Explain how to manage your time",
    "Explain how to give clear instructions",
    "Explain how to apologize effectively",
    "Explain how to say no politely",
    "Explain how to take useful notes",
    "Explain how to make a decision under uncertainty",
    "Explain how to break a bad habit",
    "Explain how to ask a good question",
    "Explain how to remember names",
    "Explain how to get better at listening",
    "Explain how to recover from a mistake",
  ],
  persuade: [
    "Convince someone to exercise regularly",
    "Convince someone to read more",
    "Convince someone to wake up earlier",
    "Convince someone to save money",
    "Convince someone to learn a new skill",
    "Convince someone to prioritize sleep",
    "Convince someone to take a calculated risk",
    "Convince someone to try meditation",
    "Convince someone to spend less time on social media",
    "Convince someone to ask for a raise",
    "Convince someone to write more clearly",
    "Convince someone to take a vacation",
    "Convince someone to start a side project",
    "Convince someone to speak up more in meetings",
    "Convince someone to stop multitasking",
  ],
  adapt: [
    "Explain how money works to a child, then to an adult",
    "Explain exercise to a beginner, then to an athlete",
    "Explain the internet to a senior, then to a teenager",
    "Explain teamwork to a student, then to a manager",
    "Explain healthy eating to a child, then to a parent",
    "Explain coding to a non-technical friend, then to a colleague",
    "Explain leadership to an intern, then to a CEO",
    "Explain AI to a skeptic, then to an enthusiast",
    "Explain budgeting to a student, then to a retiree",
    "Explain storytelling to a writer, then to an engineer",
    "Explain failure to a perfectionist, then to a risk-taker",
    "Explain focus to a procrastinator, then to a workaholic",
    "Explain feedback to a junior employee, then to a VP",
    "Explain habits to a child, then to a busy professional",
    "Explain change to someone who fears it, then to someone who craves it",
  ],
  deliver: [
    "Explain why communication matters — pause between ideas for emphasis",
    "Explain how habits are formed — slow and deliberate",
    "Describe your daily routine with clear pauses",
    "Explain why sleep is important with controlled pacing",
    "Explain a topic while emphasizing key ideas through tempo",
    "Share a lesson you learned — let the important beats breathe",
    "Explain a decision — use silence to signal weight",
    "Describe a place that mattered to you — pace it like a story",
    "Explain a concept with three deliberate peaks",
    "Share an opinion with controlled cadence",
    "Explain a memory — slow for emphasis, speed for action",
    "Give advice with pauses after each point",
    "Describe something you love — let rhythm carry the warmth",
    "Explain a rule you live by — deliberate and unhurried",
    "Describe a turning point — use tempo to mark the shift",
  ],
  handle_pressure: [
    "You're explaining why exercising is important. Someone says: 'That doesn't make sense.' Respond.",
    "You're saying people should limit social media. Someone says: 'I don't agree.' Respond.",
    "You're explaining saving money. Someone says: 'Why does this matter?' Respond.",
    "You're suggesting waking up early. Someone says: 'This is unnecessary.' Respond.",
    "You're proposing reading more. Someone says: 'That won't work.' Respond.",
    "You're advocating for routines. Someone says: 'I find routines suffocating.' Respond.",
    "You're recommending meditation. Someone says: 'That's a waste of time.' Respond.",
    "You're explaining why feedback is important. Someone says: 'Feedback is just criticism.' Respond.",
    "You're encouraging skill learning. Someone says: 'I'm too old for that.' Respond.",
    "You're making a case for sleep. Someone says: 'I function fine on 5 hours.' Respond.",
    "You're suggesting writing things down. Someone says: 'I remember everything.' Respond.",
    "You're recommending walks. Someone says: 'That's not real exercise.' Respond.",
    "You're advocating taking breaks. Someone says: 'Breaks make me lazy.' Respond.",
    "You're explaining why listening matters. Someone says: 'I'd rather be talking.' Respond.",
    "You're recommending journaling. Someone says: 'That's for teenagers.' Respond.",
  ],
};

/**
 * Pick N random prompts from a rep type's bank. Used by the Daily
 * Workout's 5-prompt selector (initial load) and its Refresh button
 * (reload). Shuffles each call so refreshes actually feel fresh.
 */
export function pickWorkoutPrompts(
  repType: RepTypeId,
  count: number = 5,
): string[] {
  const bank = WORKOUT_PROMPTS[repType];
  if (!bank || bank.length === 0) return [];
  const shuffled = [...bank].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
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
): string[] {
  const repTypeBank = WORKOUT_PROMPTS[repType] ?? [];
  if (!vertical) return pickWorkoutPrompts(repType, count);

  if (verticalBankSize(vertical) === 0) {
    return pickWorkoutPrompts(repType, count);
  }

  const verticalShare = Math.max(1, Math.round(count * 0.4));
  const repTypeShare = Math.max(1, count - verticalShare);

  const repTypePicks = (() => {
    const shuffled = [...repTypeBank].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(repTypeShare, shuffled.length));
  })();
  const verticalPicks = pickVerticalPrompts(vertical, verticalShare);

  // De-dup + shuffle the blend so the vertical prompts don't always
  // cluster at the top.
  const seen = new Set<string>();
  const blend: string[] = [];
  for (const p of [...verticalPicks, ...repTypePicks]) {
    if (!seen.has(p)) {
      seen.add(p);
      blend.push(p);
    }
  }
  return blend.sort(() => Math.random() - 0.5).slice(0, count);
}
