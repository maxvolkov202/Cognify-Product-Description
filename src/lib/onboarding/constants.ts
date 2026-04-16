/**
 * Typed constants for Cognify's onboarding. Single source of truth for
 * verticals, personas, and improvement goals used across:
 *
 * - The onboarding flow (/onboarding/*)
 * - The settings page (/settings)
 * - The scoring and framework pipelines (persona injection into system prompts)
 * - The Build a Rep vertical-specific prompt banks (Phase 3)
 *
 * Adding a new vertical requires a matching file in
 * src/lib/ai/prompts/verticals/<id>.ts (Phase 3).
 *
 * The ids here MUST match the values in `verticalEnum` in db/schema.ts.
 */

export type VerticalId =
  | "sales"
  | "consulting"
  | "finance"
  | "healthcare"
  | "law"
  | "education"
  | "leadership"
  | "other";

export type Vertical = {
  readonly id: VerticalId;
  readonly label: string;
  readonly description: string;
  /** Typical stakeholders a user in this vertical speaks to. Used to tailor
   *  Build-a-Rep prompts, custom-scenario builder dropdowns, and
   *  talking-points generation. */
  readonly stakeholders: readonly string[];
};

export const VERTICALS: readonly Vertical[] = [
  {
    id: "sales",
    label: "Sales",
    description: "B2B sales, cold calls, demos, discovery",
    stakeholders: [
      "VP of Sales",
      "CFO",
      "Director of Revenue",
      "Procurement lead",
      "Champion / end user",
      "Skeptical prospect",
    ],
  },
  {
    id: "consulting",
    label: "Consulting",
    description: "Recommendations, analysis, advisory",
    stakeholders: [
      "Client executive sponsor",
      "IT director",
      "Change-management lead",
      "End-user working group",
      "Partner / managing director",
      "Project steering committee",
    ],
  },
  {
    id: "finance",
    label: "Finance",
    description: "Reporting, investment, metrics",
    stakeholders: [
      "CFO",
      "Board member",
      "External auditor",
      "Portfolio manager",
      "Equity analyst",
      "Investment committee",
    ],
  },
  {
    id: "healthcare",
    label: "Healthcare",
    description: "Patient conversations, clinical handoffs",
    stakeholders: [
      "Patient",
      "Family member / caregiver",
      "Attending physician",
      "Hospital administrator",
      "Nurse / care team",
      "Insurance representative",
    ],
  },
  {
    id: "law",
    label: "Law",
    description: "Argument, advocacy, legal reasoning",
    stakeholders: [
      "Client",
      "Judge",
      "Opposing counsel",
      "Jury",
      "Paralegal / associate",
      "Expert witness",
    ],
  },
  {
    id: "education",
    label: "Education",
    description: "Teaching, explaining, student guidance",
    stakeholders: [
      "Student",
      "Parent / guardian",
      "Department chair",
      "Principal / dean",
      "Colleague teacher",
      "School board",
    ],
  },
  {
    id: "leadership",
    label: "Leadership",
    description: "Team management, feedback, alignment",
    stakeholders: [
      "Direct report",
      "Peer leader",
      "Executive team",
      "Board member",
      "External stakeholder",
      "Skip-level employee",
    ],
  },
  {
    id: "other",
    label: "Other",
    description: "Something else — general prompts",
    stakeholders: [
      "Colleague",
      "Manager",
      "Client",
      "Audience / room",
      "Stranger",
      "Friend or family",
    ],
  },
] as const;

export type PersonaId =
  | "vp_executive"
  | "manager"
  | "client_customer"
  | "hiring_manager"
  | "peer"
  | "stakeholder"
  | "other_persona";

export type Persona = {
  readonly id: PersonaId;
  readonly label: string;
  readonly description: string;
};

export const PERSONAS: readonly Persona[] = [
  {
    id: "vp_executive",
    label: "VP / Executive",
    description: "Senior leaders, C-suite, VP-level",
  },
  {
    id: "manager",
    label: "Manager",
    description: "Your direct manager or team lead",
  },
  {
    id: "client_customer",
    label: "Client / Customer",
    description: "External buyers or service users",
  },
  {
    id: "hiring_manager",
    label: "Hiring Manager",
    description: "Interviewers and recruiters",
  },
  {
    id: "peer",
    label: "Team Member / Peer",
    description: "Colleagues at the same level",
  },
  {
    id: "stakeholder",
    label: "Stakeholder",
    description: "Cross-functional partners — product, design, legal",
  },
  {
    id: "other_persona",
    label: "Other",
    description: "Someone else",
  },
] as const;

export type ImprovementGoalId =
  | "explaining"
  | "handling_objections"
  | "confidence"
  | "thinking_on_the_spot"
  | "giving_feedback"
  | "negotiation"
  | "presenting"
  | "persuasion"
  | "storytelling"
  | "asking_questions";

export type ImprovementGoal = {
  readonly id: ImprovementGoalId;
  readonly label: string;
  readonly description: string;
};

export const IMPROVEMENT_GOALS: readonly ImprovementGoal[] = [
  {
    id: "explaining",
    label: "Explaining",
    description: "Making complex ideas land simply",
  },
  {
    id: "handling_objections",
    label: "Handling objections",
    description: "Responding to pushback under pressure",
  },
  {
    id: "confidence",
    label: "Confidence",
    description: "Sounding sure of yourself without rehearsing",
  },
  {
    id: "thinking_on_the_spot",
    label: "Thinking on the spot",
    description: "Responding clearly with no prep",
  },
  {
    id: "giving_feedback",
    label: "Giving feedback",
    description: "Tough conversations that actually land",
  },
  {
    id: "negotiation",
    label: "Negotiation",
    description: "Getting to agreement under contested stakes",
  },
  {
    id: "presenting",
    label: "Presenting",
    description: "Talking to a room, holding attention",
  },
  {
    id: "persuasion",
    label: "Persuasion",
    description: "Moving people to decisions and action",
  },
  {
    id: "storytelling",
    label: "Storytelling",
    description: "Making ideas memorable through narrative",
  },
  {
    id: "asking_questions",
    label: "Asking good questions",
    description: "Questions that open up the conversation",
  },
] as const;

// ——— Type guards ———————————————————————————————————————

export function isVerticalId(id: string): id is VerticalId {
  return VERTICALS.some((v) => v.id === id);
}

export function isPersonaId(id: string): id is PersonaId {
  return PERSONAS.some((p) => p.id === id);
}

export function isImprovementGoalId(id: string): id is ImprovementGoalId {
  return IMPROVEMENT_GOALS.some((g) => g.id === id);
}

// ——— Lookup helpers ———————————————————————————————————————

export function getVertical(id: VerticalId): Vertical {
  const v = VERTICALS.find((v) => v.id === id);
  if (!v) throw new Error(`Unknown vertical: ${id}`);
  return v;
}

export function getStakeholdersForVertical(
  id: VerticalId | null | undefined,
): readonly string[] {
  if (!id) return getVertical("other").stakeholders;
  return getVertical(id).stakeholders;
}

export function getPersonasByIds(ids: readonly PersonaId[]): Persona[] {
  return PERSONAS.filter((p) => ids.includes(p.id));
}

export function getGoalsByIds(
  ids: readonly ImprovementGoalId[],
): ImprovementGoal[] {
  return IMPROVEMENT_GOALS.filter((g) => ids.includes(g.id));
}
