import type { DrillPrompt } from "../types";

/**
 * Tone drill bank — DNA Ch.6b.
 *
 * 30 prompts targeting the 6 Tone sub-skills:
 *   pitch_variation, volume_control, downward_inflection,
 *   emotional_authenticity, vocal_presence, warmth.
 *
 * Each pairs a topic with a vocal-control constraint that demands
 * specific prosodic moves. Assumes Ch.3b prosody worker is wired (when
 * not, scoring grades the constraint via LLM-only judgment with
 * prosodyAvailable=false). Tone drills are deliberately short — vocal
 * mechanics fatigue fast and concentrated reps train better than long ones.
 */
export const TONE_DRILLS: readonly DrillPrompt[] = [
  // ——— pitch_variation (≥3 semitones range) ————————————————
  {
    id: "tn_pv_001",
    topic: "Read a one-paragraph product description as if you wrote it.",
    drillInstruction:
      "Vary your pitch by at least three semitones across the response. Avoid the flat-line.",
    targetSubSkill: "pitch_variation",
  },
  {
    id: "tn_pv_002",
    topic: "Tell a short anecdote with a clear punchline.",
    drillInstruction:
      "Build pitch into the setup, drop pitch on the punchline. Use pitch as a tool, not decoration.",
    targetSubSkill: "pitch_variation",
  },
  {
    id: "tn_pv_003",
    topic: "Describe three things that surprised you recently.",
    drillInstruction:
      "Each item gets its own pitch contour. Don't deliver them in the same melodic shape.",
    targetSubSkill: "pitch_variation",
  },
  {
    id: "tn_pv_004",
    topic: "Read a quote from someone you admire and react to it.",
    drillInstruction:
      "Quote in one register, your reaction in another. Make the shift audible.",
    targetSubSkill: "pitch_variation",
  },
  {
    id: "tn_pv_005",
    topic: "Walk through your favorite restaurant order.",
    drillInstruction:
      "Lift pitch on the verbs that carry pleasure. Drop on the connectors. Let your voice show what mattered.",
    targetSubSkill: "pitch_variation",
  },
  // ——— volume_control (intentional emphasis variation) ————————
  {
    id: "tn_vc_001",
    topic: "Make a short pitch for an idea you believe in.",
    drillInstruction:
      "Raise your volume by ~30% on the verb that carries the meaning. Drop volume on the supporting clauses.",
    targetSubSkill: "volume_control",
  },
  {
    id: "tn_vc_002",
    topic: "Recount a moment that taught you something.",
    drillInstruction:
      "Quiet on the setup, full volume on the moment of learning, quiet again on the reflection.",
    targetSubSkill: "volume_control",
  },
  {
    id: "tn_vc_003",
    topic: "Deliver a series of three related claims.",
    drillInstruction:
      "Each claim gets a slight volume lift. The third one — the strongest — gets the loudest delivery.",
    targetSubSkill: "volume_control",
  },
  {
    id: "tn_vc_004",
    topic: "State your conviction on a contested topic.",
    drillInstruction:
      "Volume drops to a near-whisper on the most important word. Force the listener to lean in.",
    targetSubSkill: "volume_control",
  },
  {
    id: "tn_vc_005",
    topic: "Describe a moment of high tension you experienced.",
    drillInstruction:
      "Match volume to tension. Build it as the story builds, drop it when the tension breaks.",
    targetSubSkill: "volume_control",
  },
  // ——— downward_inflection (statements close on a falling note) ——
  {
    id: "tn_di_001",
    topic: "State three facts about your work, one at a time.",
    drillInstruction:
      "Every sentence ends with downward pitch. No statement may sound like a question.",
    targetSubSkill: "downward_inflection",
  },
  {
    id: "tn_di_002",
    topic: "Make a recommendation to your team.",
    drillInstruction:
      "Land every claim with a falling pitch. Test the close: would it sound right at a podium?",
    targetSubSkill: "downward_inflection",
  },
  {
    id: "tn_di_003",
    topic: "Brief a senior person on a decision you made.",
    drillInstruction:
      "Conviction in the close of every sentence. Falling pitch reads as authority — even on uncertain content.",
    targetSubSkill: "downward_inflection",
  },
  {
    id: "tn_di_004",
    topic: "Walk through your reasoning on a recent call.",
    drillInstruction:
      "If a sentence rises at the end, restart it. The drill is catching upspeak in real time.",
    targetSubSkill: "downward_inflection",
  },
  {
    id: "tn_di_005",
    topic: "Defend a strong position you actually hold.",
    drillInstruction:
      "Every assertion lands on a downward beat. Conviction is a vocal pattern, not just a content choice.",
    targetSubSkill: "downward_inflection",
  },
  // ——— emotional_authenticity (let the content's weight come through) ——
  {
    id: "tn_ea_001",
    topic: "Talk about something that genuinely matters to you.",
    drillInstruction:
      "Let the emotion through your voice. Don't flatten it for professionalism — match the stakes.",
    targetSubSkill: "emotional_authenticity",
  },
  {
    id: "tn_ea_002",
    topic: "Recount a moment of real disappointment.",
    drillInstruction:
      "Tone matches content. Don't deliver this one cheerfully. Let your voice carry the weight.",
    targetSubSkill: "emotional_authenticity",
  },
  {
    id: "tn_ea_003",
    topic: "Share a piece of news you're genuinely excited about.",
    drillInstruction:
      "Energy in the voice, not just the words. The listener should hear the excitement before they parse it.",
    targetSubSkill: "emotional_authenticity",
  },
  {
    id: "tn_ea_004",
    topic: "Acknowledge a hard piece of feedback you received.",
    drillInstruction:
      "Don't perform composure you don't feel. Let the difficulty be audible.",
    targetSubSkill: "emotional_authenticity",
  },
  {
    id: "tn_ea_005",
    topic: "Describe what you'd do with a free year.",
    drillInstruction:
      "If the answer matters to you, let your voice show it. If it doesn't, the rep is whether you can find one that does.",
    targetSubSkill: "emotional_authenticity",
  },
  // ——— vocal_presence (project from the chest, hold the room) ——
  {
    id: "tn_vp_001",
    topic: "Open a meeting with a single sentence that sets the tone.",
    drillInstruction:
      "Project from the chest. The voice should fill the room before the words do.",
    targetSubSkill: "vocal_presence",
  },
  {
    id: "tn_vp_002",
    topic: "Deliver one piece of news as if to a room of fifty.",
    drillInstruction:
      "Hold the back-of-the-room test. Even on solo recording, deliver as if presence is required.",
    targetSubSkill: "vocal_presence",
  },
  {
    id: "tn_vp_003",
    topic: "Make an opening statement you'd be willing to repeat publicly.",
    drillInstruction:
      "Energy holds from the first word to the last. No fade in the final third.",
    targetSubSkill: "vocal_presence",
  },
  {
    id: "tn_vp_004",
    topic: "Welcome a new team member.",
    drillInstruction:
      "Warmth + presence. The voice should sound generous AND grounded — neither timid nor performative.",
    targetSubSkill: "vocal_presence",
  },
  {
    id: "tn_vp_005",
    topic: "Make the case for the most important point of your week.",
    drillInstruction:
      "Speak from the diaphragm. Resonance over volume. Hold the same energy through to the close.",
    targetSubSkill: "vocal_presence",
  },
  // ——— warmth (approachability, generosity, connection) ————————
  {
    id: "tn_wm_001",
    topic: "Thank someone for help you actually received.",
    drillInstruction:
      "Smile while speaking — listeners hear it. Warmth is a pitch + breath signature, not a content choice.",
    targetSubSkill: "warmth",
  },
  {
    id: "tn_wm_002",
    topic: "Reassure someone who's anxious about an upcoming event.",
    drillInstruction:
      "Soften the voice without losing presence. Warmth that sounds confident, not soothing-fake.",
    targetSubSkill: "warmth",
  },
  {
    id: "tn_wm_003",
    topic: "Invite someone to take on a stretch opportunity.",
    drillInstruction:
      "Warmth + directness. They should hear that you believe in them AND that the ask is real.",
    targetSubSkill: "warmth",
  },
  {
    id: "tn_wm_004",
    topic: "Acknowledge a colleague's contribution publicly.",
    drillInstruction:
      "Genuine warmth, no hype. The acknowledgment should sound like it cost you something to think of.",
    targetSubSkill: "warmth",
  },
  {
    id: "tn_wm_005",
    topic: "Open a conversation with someone you haven't spoken to in a while.",
    drillInstruction:
      "Warmth in the open, even before the words land. Voice carries the relational signal first.",
    targetSubSkill: "warmth",
  },
];
