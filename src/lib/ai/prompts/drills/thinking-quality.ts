import type { DrillPrompt } from "../types";

/**
 * Thinking Quality drill bank — DNA Ch.6b.
 *
 * 30 prompts targeting the 6 Thinking Quality sub-skills:
 *   claim_support, first_principles_reasoning, counterargument_awareness,
 *   depth_of_analysis, intellectual_honesty, perspective_taking.
 *
 * Each prompt pairs a topic with a drillInstruction that forces the
 * sub-skill. The user reads both before recording. Banks may grow to 60+
 * over time; 30 is the v1 ship size that gives stratified picker enough
 * headroom (~5 per sub-skill).
 */
export const THINKING_QUALITY_DRILLS: readonly DrillPrompt[] = [
  // ——— claim_support (every claim → reason / evidence) ————————
  {
    id: "tq_cs_001",
    topic: "Make a case for switching to a four-day work week.",
    drillInstruction:
      "Every claim must be followed by a number, study, or concrete example. No naked assertions.",
    targetSubSkill: "claim_support",
  },
  {
    id: "tq_cs_002",
    topic: "Argue why your team should adopt code reviews.",
    drillInstruction:
      "State a claim, then in the next sentence cite a specific reason or piece of evidence. Repeat for every point.",
    targetSubSkill: "claim_support",
  },
  {
    id: "tq_cs_003",
    topic: "Explain why daily standups are worth keeping.",
    drillInstruction:
      "Use the word 'because' at least three times. Each 'because' must be followed by a substantive reason.",
    targetSubSkill: "claim_support",
  },
  {
    id: "tq_cs_004",
    topic: "Defend the choice to ship a v1 with known limitations.",
    drillInstruction:
      "Three claims, three pieces of evidence, in alternating order. No claim without immediate support.",
    targetSubSkill: "claim_support",
  },
  {
    id: "tq_cs_005",
    topic: "Argue that mentorship is undervalued in tech.",
    drillInstruction:
      "Cite at least one statistic and one personal example to back the central claim.",
    targetSubSkill: "claim_support",
  },
  // ——— first_principles_reasoning ————————————————————————————
  {
    id: "tq_fp_001",
    topic: "Justify why we still use email instead of newer tools.",
    drillInstruction:
      "Strip the assumption. Don't argue from analogy ('email is like X'). Build from what email actually IS — the underlying mechanics.",
    targetSubSkill: "first_principles_reasoning",
  },
  {
    id: "tq_fp_002",
    topic: "Make the case for or against asynchronous work.",
    drillInstruction:
      "Don't reference how other companies do it. Start from what work actually requires and rebuild the argument.",
    targetSubSkill: "first_principles_reasoning",
  },
  {
    id: "tq_fp_003",
    topic: "Should programming languages have semicolons?",
    drillInstruction:
      "Answer from first principles — what does a parser actually need? Skip 'because Python doesn't' style reasoning.",
    targetSubSkill: "first_principles_reasoning",
  },
  {
    id: "tq_fp_004",
    topic: "Why do meetings tend to expand to fill their scheduled time?",
    drillInstruction:
      "Bypass Parkinson's Law as a one-liner. Build the actual mechanism: what creates the pressure to fill time?",
    targetSubSkill: "first_principles_reasoning",
  },
  {
    id: "tq_fp_005",
    topic: "Defend why we should or shouldn't measure engineer productivity.",
    drillInstruction:
      "Don't cite Google's research or a famous quote. Reason from what 'productivity' even means for cognitive work.",
    targetSubSkill: "first_principles_reasoning",
  },
  // ——— counterargument_awareness ————————————————————————————
  {
    id: "tq_ca_001",
    topic: "Argue that AI will replace junior engineers.",
    drillInstruction:
      "After your case, state the strongest counterargument in the same voice as someone who actually believes it. Then address it.",
    targetSubSkill: "counterargument_awareness",
  },
  {
    id: "tq_ca_002",
    topic: "Make the case for working from the office.",
    drillInstruction:
      "Open by naming the strongest argument AGAINST your position. Then explain why your case still holds despite it.",
    targetSubSkill: "counterargument_awareness",
  },
  {
    id: "tq_ca_003",
    topic: "Argue that startups should raise less money, not more.",
    drillInstruction:
      "Halfway through, say 'the case against this is...' and lay it out fairly before continuing.",
    targetSubSkill: "counterargument_awareness",
  },
  {
    id: "tq_ca_004",
    topic: "Defend why your team's velocity has slowed.",
    drillInstruction:
      "Pre-empt the two objections you expect to hear. Don't strawman them — steelman them.",
    targetSubSkill: "counterargument_awareness",
  },
  {
    id: "tq_ca_005",
    topic: "Argue against shipping the new feature this quarter.",
    drillInstruction:
      "Acknowledge what makes shipping it tempting — then explain why you still think waiting wins.",
    targetSubSkill: "counterargument_awareness",
  },
  // ——— depth_of_analysis (why + so what, not just what) ———————
  {
    id: "tq_da_001",
    topic: "Explain why the company missed its quarterly target.",
    drillInstruction:
      "Get past 'what happened.' Spend at least half the rep on WHY it happened and SO WHAT it means going forward.",
    targetSubSkill: "depth_of_analysis",
  },
  {
    id: "tq_da_002",
    topic: "Analyze a decision your team made last quarter.",
    drillInstruction:
      "Three layers: the decision itself, the mechanism that drove it, and what it implies about how the team operates.",
    targetSubSkill: "depth_of_analysis",
  },
  {
    id: "tq_da_003",
    topic: "What's actually broken about modern hiring processes?",
    drillInstruction:
      "Don't list complaints. Identify ONE root cause and trace its downstream effects through the rest of the process.",
    targetSubSkill: "depth_of_analysis",
  },
  {
    id: "tq_da_004",
    topic: "Why do most acquisitions destroy value?",
    drillInstruction:
      "Move past the surface answer ('integration is hard'). Identify the structural force that creates the problem.",
    targetSubSkill: "depth_of_analysis",
  },
  {
    id: "tq_da_005",
    topic: "What's the real reason most New Year's resolutions fail?",
    drillInstruction:
      "Reject the obvious answer. Spend the rep getting one layer below the conventional explanation.",
    targetSubSkill: "depth_of_analysis",
  },
  // ——— intellectual_honesty (calibrate certainty, name unknowns) —
  {
    id: "tq_ih_001",
    topic: "Predict where AI will be in three years.",
    drillInstruction:
      "Calibrate every claim. Use 'I'm confident,' 'I think,' or 'I'd guess' — pick the one that matches your actual certainty.",
    targetSubSkill: "intellectual_honesty",
  },
  {
    id: "tq_ih_002",
    topic: "Make a recommendation about a technical decision you're unsure about.",
    drillInstruction:
      "Name the parts you don't know BEFORE making the recommendation. Don't bury the uncertainty.",
    targetSubSkill: "intellectual_honesty",
  },
  {
    id: "tq_ih_003",
    topic: "Walk through your reasoning on a contentious product call.",
    drillInstruction:
      "End the rep by naming the one thing that could change your mind. Be specific.",
    targetSubSkill: "intellectual_honesty",
  },
  {
    id: "tq_ih_004",
    topic: "Brief a stakeholder on a project you only partially understand.",
    drillInstruction:
      "Distinguish what you know from what you've inferred from what you're guessing at. Mark the boundaries audibly.",
    targetSubSkill: "intellectual_honesty",
  },
  {
    id: "tq_ih_005",
    topic: "Describe the limits of your own expertise on a topic.",
    drillInstruction:
      "Spend the first 10 seconds on what you DON'T know. Then talk about what you do.",
    targetSubSkill: "intellectual_honesty",
  },
  // ——— perspective_taking ————————————————————————————————————
  {
    id: "tq_pt_001",
    topic: "Argue against a recent decision you actually agreed with.",
    drillInstruction:
      "Inhabit the opposing view fully. Don't telegraph that you don't believe it.",
    targetSubSkill: "perspective_taking",
  },
  {
    id: "tq_pt_002",
    topic: "Explain a feature your customers asked for that your engineering team resisted.",
    drillInstruction:
      "Tell it twice — once from the customer's perspective, once from engineering's. Both versions must sound sympathetic.",
    targetSubSkill: "perspective_taking",
  },
  {
    id: "tq_pt_003",
    topic: "Defend a position your past self held that your current self disagrees with.",
    drillInstruction:
      "Don't condescend to your past self. Make the original reasoning sound coherent given what you knew then.",
    targetSubSkill: "perspective_taking",
  },
  {
    id: "tq_pt_004",
    topic: "Argue for a policy change from the perspective of the people most disadvantaged by the current system.",
    drillInstruction:
      "Don't speak as yourself describing them. Speak from inside their frame.",
    targetSubSkill: "perspective_taking",
  },
  {
    id: "tq_pt_005",
    topic: "Explain why someone might rationally disagree with you on a topic you feel strongly about.",
    drillInstruction:
      "Steelman the disagreement. Make the other side's case as well as they would.",
    targetSubSkill: "perspective_taking",
  },
];
