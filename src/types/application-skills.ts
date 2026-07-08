// PRD v3 Phase 4 — Skill Lab application taxonomy (PRD §6 + Lab Engine V1).
//
// Applications are the real-world communication contexts users choose to
// train ("The user chooses WHAT to improve; Cognify determines HOW").
// Application Skills are the hidden per-application abilities that power
// exercise selection, coaching, and mastery tracking — like Core Skill
// sub-skills, they are internal-only (PRD §8.3.7).
//
// Application exercises live in cognify_v2.exercises with
// `application` set to one of these ids; their `dimension` column holds
// the exercise's PRIMARY Core Skill so the entire scoring pipeline
// (exercise XML, scoring lens, RAG dim pinning) works unchanged.

export const APPLICATION_IDS = [
  "storytelling",
  "presenting",
  "teaching",
  "interviewing",
  "persuasion",
] as const;

export type ApplicationId = (typeof APPLICATION_IDS)[number];

export const APPLICATION_LABELS: Record<ApplicationId, string> = {
  storytelling: "Storytelling",
  presenting: "Presenting",
  teaching: "Teaching",
  interviewing: "Interviewing",
  persuasion: "Persuasion",
};

export const APPLICATION_DESCRIPTIONS: Record<ApplicationId, string> = {
  storytelling:
    "Communicate experiences and ideas through compelling narratives.",
  presenting: "Organize and deliver information to an audience.",
  teaching:
    "Help someone understand something they didn't understand before.",
  interviewing:
    "Answer questions in a clear, compelling, evidence-based way.",
  persuasion:
    "Influence beliefs, decisions, and actions through communication.",
};

/** Hidden Application Skills per application — the FULL 8-per-app canon
 *  from the PRD's Lab Engine V1 lists (D11: restored 2026-07-06 after an
 *  earlier 6-skill MVP trim). snake_case ids; labels derived at display
 *  time if ever needed (internal-only today). */
export const APPLICATION_SKILLS: Record<ApplicationId, readonly string[]> = {
  storytelling: [
    "establishing_stakes",
    "narrative_tension",
    "concrete_detail",
    "showing_change",
    "clear_takeaway",
    "balancing_context_action",
    "making_listener_care",
    "connecting_to_broader_point",
  ],
  presenting: [
    "framing_main_message",
    "through_line",
    "memorable_chunks",
    "signposting_transitions",
    "explaining_evidence",
    "adapting_to_audience",
    "closing_implication",
    "concretizing_abstraction",
  ],
  teaching: [
    "simplifying_complexity",
    "explaining_with_analogy",
    "known_to_unknown",
    "anticipating_confusion",
    "defining_terms",
    "examples_and_nonexamples",
    "teaching_for_application",
    "adjusting_depth",
  ],
  interviewing: [
    "evidence_based_answers",
    "concise_personal_examples",
    "self_awareness",
    "explaining_motivation",
    "handling_weakness_questions",
    "connecting_to_fit",
    "judgment_under_pressure",
    "credible_specifics",
  ],
  persuasion: [
    "framing_recommendation",
    "handling_objections",
    "audience_priorities",
    "building_credibility",
    "selective_evidence",
    "calibrated_urgency",
    "warmth_and_conviction",
    "clear_ask",
  ],
};

/** The most closely related application, for Coach Recommendations on the
 *  Session Complete screen (PRD §6.8: "Train a related Application"). */
export const RELATED_APPLICATION: Record<ApplicationId, ApplicationId> = {
  storytelling: "presenting",
  presenting: "persuasion",
  teaching: "presenting",
  interviewing: "storytelling",
  persuasion: "presenting",
};

/** Display label for a hidden Application Skill id, for the rare surfaces
 *  that name one (Session Complete's "Most Improved"): snake_case →
 *  Title Case. Skills stay internal otherwise. */
export function applicationSkillLabel(id: string): string {
  return id
    .split("_")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function isApplicationId(id: string): id is ApplicationId {
  return (APPLICATION_IDS as readonly string[]).includes(id);
}

export function isApplicationSkill(
  app: ApplicationId,
  skill: string,
): boolean {
  return APPLICATION_SKILLS[app].includes(skill);
}
