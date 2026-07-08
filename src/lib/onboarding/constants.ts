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
      "Economic buyer",
      "Champion / end user",
      "VP of Sales",
      "CFO",
      "Director of Revenue",
      "Procurement lead",
      "Sales manager",
      "Solutions engineer",
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
      "Investment committee",
      "MD / partner",
      "VP / director",
      "Client / LP",
      "CFO",
      "Board member",
      "Portfolio manager",
      "Equity analyst",
      "External auditor",
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
    description: "Something else, general prompts",
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
  | "other_persona"
  // Expanded IDs — power richer per-vertical labels. Stored as string[] in
  // jsonb, so no migration is needed when adding more here.
  | "economic_buyer"
  | "champion"
  | "procurement"
  | "direct_report"
  | "board_investor"
  | "opposing_counsel"
  | "judge_arbiter"
  | "patient_role"
  | "student_role"
  | "parent_guardian"
  | "care_team"
  | "audience_room"
  | "skip_level"
  | "external_partner";

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

// ——— Vertical-aware persona + goal surfacing ———————————————
// IDs stay stable so saved rows survive vertical changes. Labels adapt so the
// UI speaks the user's native vocabulary.

export type ContextualPersona = {
  readonly id: PersonaId;
  readonly label: string;
  readonly description: string;
};

const PERSONAS_BY_VERTICAL: Record<VerticalId, ReadonlyArray<ContextualPersona>> = {
  sales: [
    { id: "economic_buyer", label: "Economic buyer", description: "Decision-maker with budget authority" },
    { id: "vp_executive", label: "C-suite / VP", description: "Senior leadership on the call" },
    { id: "champion", label: "Champion", description: "Internal advocate selling for you" },
    { id: "client_customer", label: "End user", description: "Day-to-day user of the product" },
    { id: "procurement", label: "Procurement", description: "Legal, finance, or purchasing gate" },
    { id: "stakeholder", label: "Skeptic", description: "Objection-heavy prospect" },
    { id: "manager", label: "Sales manager", description: "Your pipeline reviews and coaching" },
    { id: "peer", label: "SE / co-seller", description: "Solutions engineer or teammate" },
    { id: "other_persona", label: "Someone else", description: "Another counterpart" },
  ],
  consulting: [
    { id: "economic_buyer", label: "Client exec sponsor", description: "C-suite backing the engagement" },
    { id: "vp_executive", label: "Client C-suite", description: "Broader senior leadership" },
    { id: "client_customer", label: "Client working group", description: "Day-to-day project stakeholders" },
    { id: "stakeholder", label: "Steering committee", description: "Cross-functional oversight" },
    { id: "manager", label: "Partner / MD", description: "Your engagement partner" },
    { id: "peer", label: "Project team", description: "Fellow consultants on the case" },
    { id: "champion", label: "Change lead", description: "On-the-ground transformation owner" },
    { id: "procurement", label: "Procurement / vendor mgmt", description: "Contract and vendor gatekeepers" },
    { id: "other_persona", label: "Someone else", description: "Another counterpart" },
  ],
  finance: [
    { id: "vp_executive", label: "CFO", description: "Your finance executive" },
    { id: "board_investor", label: "Board / audit committee", description: "Governance body you report to" },
    { id: "stakeholder", label: "Investment committee", description: "Approval body for capital" },
    { id: "client_customer", label: "Portfolio manager", description: "Investor you cover" },
    { id: "economic_buyer", label: "Equity / credit analyst", description: "Sell-side or buy-side analyst" },
    { id: "procurement", label: "External auditor", description: "Audit partner reviewing the numbers" },
    { id: "manager", label: "Your director / VP", description: "Reports and reviews land here" },
    { id: "peer", label: "FP&A / treasury peer", description: "Cross-functional finance counterpart" },
    { id: "other_persona", label: "Someone else", description: "Another counterpart" },
  ],
  healthcare: [
    { id: "patient_role", label: "Patient", description: "Primary clinical conversation" },
    { id: "parent_guardian", label: "Family / caregiver", description: "Loved ones in the care decision" },
    { id: "care_team", label: "Nurse / care team", description: "Clinicians you coordinate with" },
    { id: "peer", label: "Attending / consulting physician", description: "Specialist handoffs and consults" },
    { id: "manager", label: "Department lead", description: "Your supervising clinician" },
    { id: "vp_executive", label: "Hospital administration", description: "Exec or operations leadership" },
    { id: "stakeholder", label: "Insurance / payer", description: "Auth and reimbursement contact" },
    { id: "procurement", label: "Pharma / device rep", description: "External vendor on the ward" },
    { id: "other_persona", label: "Someone else", description: "Another counterpart" },
  ],
  law: [
    { id: "client_customer", label: "Client", description: "Person or entity you represent" },
    { id: "opposing_counsel", label: "Opposing counsel", description: "Across-the-table lawyer" },
    { id: "judge_arbiter", label: "Judge / arbitrator", description: "Trier of law or fact" },
    { id: "audience_room", label: "Jury", description: "The twelve you're persuading" },
    { id: "manager", label: "Partner / GC", description: "Your supervising attorney" },
    { id: "peer", label: "Associate / paralegal", description: "Co-counsel or case support" },
    { id: "stakeholder", label: "Expert witness", description: "Testifying expert on your side" },
    { id: "champion", label: "Investigator / fact-finder", description: "Deposition and discovery contact" },
    { id: "other_persona", label: "Someone else", description: "Another counterpart" },
  ],
  education: [
    { id: "student_role", label: "Student", description: "Primary teaching conversation" },
    { id: "parent_guardian", label: "Parent / guardian", description: "Family of the student" },
    { id: "audience_room", label: "Full classroom", description: "Whole-group teaching moment" },
    { id: "peer", label: "Colleague teacher", description: "Peer educators and co-teachers" },
    { id: "manager", label: "Dept chair / principal", description: "Your supervising educator" },
    { id: "vp_executive", label: "Dean / school board", description: "Higher-level administration" },
    { id: "stakeholder", label: "Counselor / specialist", description: "IEP / support staff collaborator" },
    { id: "champion", label: "Student ambassador", description: "Motivated student you're coaching up" },
    { id: "other_persona", label: "Someone else", description: "Another counterpart" },
  ],
  leadership: [
    { id: "direct_report", label: "Direct report", description: "Someone you manage" },
    { id: "skip_level", label: "Skip-level report", description: "Your report's report" },
    { id: "peer", label: "Peer leader", description: "Other managers and department heads" },
    { id: "vp_executive", label: "Executive team", description: "Senior leadership you report into" },
    { id: "board_investor", label: "Board / investor", description: "External governance and capital" },
    { id: "external_partner", label: "External partner", description: "Vendors, customers, or allies" },
    { id: "stakeholder", label: "Cross-functional partner", description: "Other-org collaborator" },
    { id: "audience_room", label: "All-hands / town hall", description: "Whole-team moment" },
    { id: "other_persona", label: "Someone else", description: "Another counterpart" },
  ],
  other: [
    { id: "vp_executive", label: "VP / Executive", description: "Senior leaders, C-suite" },
    { id: "manager", label: "Manager", description: "Your direct manager or team lead" },
    { id: "direct_report", label: "Direct report", description: "Someone you manage" },
    { id: "client_customer", label: "Client / Customer", description: "External buyers or service users" },
    { id: "peer", label: "Team member / peer", description: "Colleagues at the same level" },
    { id: "stakeholder", label: "Cross-functional partner", description: "Product, design, legal, etc." },
    { id: "audience_room", label: "Audience / room", description: "Presentations and talks" },
    { id: "hiring_manager", label: "Hiring manager / interviewer", description: "Interviews and recruiting calls" },
    { id: "other_persona", label: "Someone else", description: "Another counterpart" },
  ],
} as const;

export function personasForVertical(
  id: VerticalId | null | undefined,
): ReadonlyArray<ContextualPersona> {
  if (!id) return PERSONAS_BY_VERTICAL.other;
  return PERSONAS_BY_VERTICAL[id];
}

/** Map the user's currently-saved persona IDs into the vertical's contextual
 *  labels. IDs not offered by the vertical fall back to the generic label so
 *  we never silently drop data. */
export function contextualizePersonas(
  ids: readonly PersonaId[],
  vertical: VerticalId | null | undefined,
): ContextualPersona[] {
  const set = new Set(ids);
  const contextual = personasForVertical(vertical);
  return contextual.filter((p) => set.has(p.id));
}

// Top 3 improvement goals most relevant per vertical. Surfaced with a
// "Common for {vertical}" badge and sorted to the top — all goals stay
// selectable.
export const TOP_GOALS_BY_VERTICAL: Record<VerticalId, readonly ImprovementGoalId[]> = {
  sales: ["handling_objections", "negotiation", "persuasion"],
  consulting: ["explaining", "presenting", "asking_questions"],
  finance: ["explaining", "presenting", "thinking_on_the_spot"],
  healthcare: ["explaining", "asking_questions", "giving_feedback"],
  law: ["thinking_on_the_spot", "persuasion", "asking_questions"],
  education: ["explaining", "storytelling", "asking_questions"],
  leadership: ["giving_feedback", "persuasion", "storytelling"],
  other: ["confidence", "thinking_on_the_spot", "explaining"],
} as const;

export function goalsForVertical(
  id: VerticalId | null | undefined,
): ReadonlyArray<{ goal: ImprovementGoal; featured: boolean }> {
  const featuredIds = id ? TOP_GOALS_BY_VERTICAL[id] : [];
  const featured = featuredIds
    .map((gid) => IMPROVEMENT_GOALS.find((g) => g.id === gid))
    .filter((g): g is ImprovementGoal => !!g)
    .map((goal) => ({ goal, featured: true }));
  const rest = IMPROVEMENT_GOALS.filter(
    (g) => !featuredIds.includes(g.id),
  ).map((goal) => ({ goal, featured: false }));
  return [...featured, ...rest];
}

// ─── PRD v3 Phase 3 (PRD §8.2) — Communication Stage ─────────────────────
// Career-stage context for prompt/coaching personalization. Never affects
// scoring. Surfaced in /settings (and a future onboarding step).

export const COMMUNICATION_STAGES = [
  { id: "student", label: "Student" },
  { id: "early_career", label: "Early career" },
  { id: "individual_contributor", label: "Individual contributor" },
  { id: "manager", label: "Manager" },
  { id: "senior_leader", label: "Senior leader" },
  { id: "executive", label: "Executive" },
] as const;

export type CommunicationStageId =
  (typeof COMMUNICATION_STAGES)[number]["id"];

export function isCommunicationStage(
  id: string,
): id is CommunicationStageId {
  return COMMUNICATION_STAGES.some((s) => s.id === id);
}
