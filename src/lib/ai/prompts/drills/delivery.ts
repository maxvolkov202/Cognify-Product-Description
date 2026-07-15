import type { DrillPrompt } from "../types";

/**
 * Delivery drill bank — DNA Ch.6b.
 *
 * 30 prompts targeting the 5 Delivery sub-skills:
 *   rate_awareness, strategic_pausing, filler_to_pause_substitution,
 *   rhythm_variation, pressure_pacing.
 *
 * Each pairs a low-stakes topic with a SPEECH MECHANIC CONSTRAINT.
 * The topic is intentionally simple — the load is on the mechanic, not
 * the content. Prompts assume the deterministic Delivery scorer is
 * extracting wpm / filler / pause stats from the audio (see
 * src/lib/audio/prosody-inline.ts).
 */
export const DELIVERY_DRILLS: readonly DrillPrompt[] = [
  // ——— rate_awareness (target 150-160 wpm; learn your own tempo) ——
  {
    id: "dl_ra_001",
    topic: "Describe what you ate for lunch yesterday.",
    drillInstruction:
      "Speak deliberately at 130 words per minute — slower than feels natural. Aim for 60 seconds of measured tempo.",
    targetSubSkill: "rate_awareness",
  },
  {
    id: "dl_ra_002",
    topic: "Explain how you got to where you live today.",
    drillInstruction:
      "Aim for 150 words per minute exactly. Use the rep to feel what that pace is.",
    targetSubSkill: "rate_awareness",
  },
  {
    id: "dl_ra_003",
    topic: "Recount the last book or article you read.",
    drillInstruction:
      "Vary your rate intentionally: slow for the headline, normal for the support, slow again for the close.",
    targetSubSkill: "rate_awareness",
  },
  {
    id: "dl_ra_004",
    topic: "Describe your morning routine in detail.",
    drillInstruction:
      "Speak at 170 wpm for the first half, then deliberately slow to 130 for the second. Notice the shift.",
    targetSubSkill: "rate_awareness",
  },
  {
    id: "dl_ra_005",
    topic: "Walk through how you'd plan a one-day trip.",
    drillInstruction:
      "Hold a steady 150 wpm throughout. No speeding up, no slowing down. Consistency is the rep.",
    targetSubSkill: "rate_awareness",
  },
  // ——— strategic_pausing (1-3s pauses after key points) ————————
  {
    id: "dl_sp_001",
    topic: "Make a recommendation to your team about a tool change.",
    drillInstruction:
      "Pause for two full seconds after your conclusion. Hold the silence — don't fill it with 'so' or 'um.'",
    targetSubSkill: "strategic_pausing",
  },
  {
    id: "dl_sp_002",
    topic: "Tell a short story about a time you changed your mind.",
    drillInstruction:
      "Use at least three intentional pauses of 1-2 seconds. Place them after the most important statements.",
    targetSubSkill: "strategic_pausing",
  },
  {
    id: "dl_sp_003",
    topic: "Deliver a piece of news to a colleague.",
    drillInstruction:
      "Pause for two seconds before stating the news, and again after. Frame it with silence.",
    targetSubSkill: "strategic_pausing",
  },
  {
    id: "dl_sp_004",
    topic: "Explain a complex idea to someone who doesn't have your background.",
    drillInstruction:
      "After every key concept, pause. Let the listener catch up before adding the next.",
    targetSubSkill: "strategic_pausing",
  },
  {
    id: "dl_sp_005",
    topic: "Open a meeting with the day's most important update.",
    drillInstruction:
      "Three-second pause before you say a single word. Then deliver the update slowly.",
    targetSubSkill: "strategic_pausing",
  },
  // ——— filler_to_pause_substitution (replace fillers with silence) ————
  {
    id: "dl_fw_001",
    topic: "Describe a recent project you worked on.",
    drillInstruction:
      "Speak for 60 seconds without using 'um,' 'uh,' or 'like.' If one slips out, finish the sentence and continue.",
    targetSubSkill: "filler_to_pause_substitution",
  },
  {
    id: "dl_fw_002",
    topic: "Recommend a book or movie to someone.",
    drillInstruction:
      "Zero filler words. Pause instead. The pauses will feel long — that's the rep.",
    targetSubSkill: "filler_to_pause_substitution",
  },
  {
    id: "dl_fw_003",
    topic: "Explain your job to a friend who doesn't know much about it.",
    drillInstruction:
      "Banned: 'um,' 'uh,' 'like,' 'you know,' 'basically.' Speak slowly enough to avoid them.",
    targetSubSkill: "filler_to_pause_substitution",
  },
  {
    id: "dl_fw_004",
    topic: "Make the case for an idea you actually believe in.",
    drillInstruction:
      "Catch every filler before it leaves your mouth. Replace with a one-second pause.",
    targetSubSkill: "filler_to_pause_substitution",
  },
  {
    id: "dl_fw_005",
    topic: "Walk through what you did this morning.",
    drillInstruction:
      "Speak for 90 seconds. Aim for fewer than 2 fillers total. Slow down whenever you feel one coming.",
    targetSubSkill: "filler_to_pause_substitution",
  },
  // ——— rhythm_variation (vary tempo intentionally) ——————————
  {
    id: "dl_rv_001",
    topic: "Recount a moment when you got something wrong.",
    drillInstruction:
      "Vary your tempo across the rep — slow for the lead-up, faster through the action, slow again for the lesson.",
    targetSubSkill: "rhythm_variation",
  },
  {
    id: "dl_rv_002",
    topic: "Explain a process from beginning to end.",
    drillInstruction:
      "Speed up through the connectors ('and then,' 'after that'). Slow down on the verbs that matter.",
    targetSubSkill: "rhythm_variation",
  },
  {
    id: "dl_rv_003",
    topic: "Describe a moment of surprise from your week.",
    drillInstruction:
      "Build tempo into the surprise, then drop tempo at the reveal. Use rate as a tool.",
    targetSubSkill: "rhythm_variation",
  },
  {
    id: "dl_rv_004",
    topic: "Make a case for a decision you're proud of.",
    drillInstruction:
      "Three different tempos in the same rep: slow open, brisk middle, deliberate close.",
    targetSubSkill: "rhythm_variation",
  },
  {
    id: "dl_rv_005",
    topic: "Tell a short story with a clear emotional arc.",
    drillInstruction:
      "Match tempo to emotion. Slow for weight, brisk for momentum, slow again for the punch.",
    targetSubSkill: "rhythm_variation",
  },
  // ——— pressure_pacing (hold pace under load) ——————————
  {
    id: "dl_pm_001",
    topic: "Defend a controversial opinion you actually hold.",
    drillInstruction:
      "Inhale through the nose before you start. Keep your pace steady — don't let conviction speed you up.",
    targetSubSkill: "pressure_pacing",
  },
  {
    id: "dl_pm_002",
    topic: "Make a high-stakes ask to someone you respect.",
    drillInstruction:
      "First three words at half-speed. Don't accelerate as you go. Hold the steady pace through the whole rep.",
    targetSubSkill: "pressure_pacing",
  },
  {
    id: "dl_pm_003",
    topic: "Brief a senior person on something you're not 100% sure about.",
    drillInstruction:
      "When you feel the rate creeping up, pause. Reset. Continue at the slower pace. Catch and correct mid-rep.",
    targetSubSkill: "pressure_pacing",
  },
  {
    id: "dl_pm_004",
    topic: "Push back on a decision you disagree with.",
    drillInstruction:
      "Hold a steady, controlled pace even as the content gets pointed. Disagreement at speed reads as defensive.",
    targetSubSkill: "pressure_pacing",
  },
  {
    id: "dl_pm_005",
    topic: "Apologize for a mistake without over-explaining.",
    drillInstruction:
      "Slower than feels natural — pressure shrinks the time you think you have. Take it back deliberately.",
    targetSubSkill: "pressure_pacing",
  },
  // ——— Filler / variation grab-bag (extras for picker headroom) ——
  {
    id: "dl_fw_006",
    topic: "Pitch your favorite hobby to someone who doesn't share it.",
    drillInstruction:
      "Zero fillers, normal tempo. The pitch should sound effortless even though the constraint isn't.",
    targetSubSkill: "filler_to_pause_substitution",
  },
  {
    id: "dl_sp_006",
    topic: "Deliver a one-line piece of advice to someone earlier in their career.",
    drillInstruction:
      "Pause for three full seconds before the line. Let the silence build the weight.",
    targetSubSkill: "strategic_pausing",
  },
  {
    id: "dl_ra_006",
    topic: "Walk through a recipe step-by-step.",
    drillInstruction:
      "Steady 145 wpm throughout. Use the rep to internalize what 'recipe pace' should sound like.",
    targetSubSkill: "rate_awareness",
  },
  {
    id: "dl_rv_006",
    topic: "Recount a long day in 60 seconds.",
    drillInstruction:
      "Compress without rushing. Vary tempo to signal which moments mattered.",
    targetSubSkill: "rhythm_variation",
  },
  {
    id: "dl_pm_006",
    topic: "Respond to a hard question with a thoughtful answer.",
    drillInstruction:
      "Two-second pause before you start. Then steady tempo. Pressure rewards deliberation.",
    targetSubSkill: "pressure_pacing",
  },
];
