import type { VerticalId } from "@/lib/onboarding/constants";
import type { VerticalPrompt } from "./types";

/**
 * Vertical prompt bank — real-world scenarios organized by vertical.
 *
 * Used by the Build a Rep flow (Phase 5) to show 5 vertical-appropriate
 * prompts based on the user's onboarding selection. Per the team spec,
 * Build a Rep prompts ARE vertical-specific — the opposite rule from
 * Daily Workout which uses general prompts.
 *
 * Stored as `VerticalPrompt` objects with stable `id`. The optional
 * `stakeholder` field is left undefined here; expansion-pass prompts
 * populate it (drawn from VERTICALS[id].stakeholders) so the picker can
 * stratify by counterpart and avoid a slate of five "explain to your
 * client" prompts.
 */

export const VERTICAL_PROMPTS: Record<VerticalId, readonly VerticalPrompt[]> = {
  sales: [
    { id: "sales_001", vertical: "sales", text: "Explain the value of your product clearly to a skeptical buyer" },
    { id: "sales_002", vertical: "sales", text: "Respond to a pricing objection without dropping your price" },
    { id: "sales_003", vertical: "sales", text: "Walk through a discovery call recap with a stakeholder" },
    { id: "sales_004", vertical: "sales", text: "Summarize ROI to a buyer in under 60 seconds" },
    { id: "sales_005", vertical: "sales", text: "Pitch your solution concisely to a distracted executive" },
    { id: "sales_006", vertical: "sales", text: "Handle a 'we already have a vendor' objection" },
    { id: "sales_007", vertical: "sales", text: "Open a cold call that gets a yes to a 15-minute meeting" },
    { id: "sales_008", vertical: "sales", text: "Explain why your product is worth the price premium" },
    { id: "sales_009", vertical: "sales", text: "Respond to 'send me more info and I'll get back to you'" },
    { id: "sales_010", vertical: "sales", text: "Deliver a case study that lands in 30 seconds" },
    { id: "sales_011", vertical: "sales", text: "Ask a discovery question that uncovers a real pain point" },
    { id: "sales_012", vertical: "sales", text: "Explain your competitive differentiator without trash-talking" },
    { id: "sales_013", vertical: "sales", text: "Handle a CFO asking 'what's the hard ROI?'" },
    { id: "sales_014", vertical: "sales", text: "Defend your product against a lower-priced alternative" },
    { id: "sales_015", vertical: "sales", text: "Respond to 'we don't have budget for this'" },
  ],
  consulting: [
    { id: "consulting_001", vertical: "consulting", text: "Present a recommendation to a client CFO" },
    { id: "consulting_002", vertical: "consulting", text: "Defend your analysis under pointed pushback" },
    { id: "consulting_003", vertical: "consulting", text: "Explain your analytical approach to a non-analyst" },
    { id: "consulting_004", vertical: "consulting", text: "Walk through your reasoning for a strategic choice" },
    { id: "consulting_005", vertical: "consulting", text: "Communicate a counterintuitive insight clearly" },
    { id: "consulting_006", vertical: "consulting", text: "Explain why the client's current approach isn't working" },
    { id: "consulting_007", vertical: "consulting", text: "Deliver bad news that the client will thank you for later" },
    { id: "consulting_008", vertical: "consulting", text: "Present three options and make the case for one" },
    { id: "consulting_009", vertical: "consulting", text: "Explain a framework to a client unfamiliar with it" },
    { id: "consulting_010", vertical: "consulting", text: "Handle a client who disagrees with your recommendation" },
    { id: "consulting_011", vertical: "consulting", text: "Tell a client their favorite initiative should be killed" },
    { id: "consulting_012", vertical: "consulting", text: "Walk an executive through a complex model in 90 seconds" },
    { id: "consulting_013", vertical: "consulting", text: "Explain a risk without sounding alarmist" },
    { id: "consulting_014", vertical: "consulting", text: "Defend a recommendation against political pushback" },
    { id: "consulting_015", vertical: "consulting", text: "Translate a quantitative insight into a strategic decision" },
  ],
  finance: [
    { id: "finance_001", vertical: "finance", text: "Explain Q3 results to non-financial executives" },
    { id: "finance_002", vertical: "finance", text: "Justify a proposed investment to the board" },
    { id: "finance_003", vertical: "finance", text: "Present insights from last month's performance" },
    { id: "finance_004", vertical: "finance", text: "Walk through key metrics in under 60 seconds" },
    { id: "finance_005", vertical: "finance", text: "Explain a tradeoff between short-term and long-term spend" },
    { id: "finance_006", vertical: "finance", text: "Defend a budget variance to a skeptical manager" },
    { id: "finance_007", vertical: "finance", text: "Explain why margins compressed this quarter" },
    { id: "finance_008", vertical: "finance", text: "Present a sensitivity analysis to a non-technical audience" },
    { id: "finance_009", vertical: "finance", text: "Explain a forecasting change to the CEO" },
    { id: "finance_010", vertical: "finance", text: "Justify headcount for a team you're growing" },
    { id: "finance_011", vertical: "finance", text: "Explain a cash flow concern to a founder" },
    { id: "finance_012", vertical: "finance", text: "Walk through a capital allocation decision" },
    { id: "finance_013", vertical: "finance", text: "Translate a finance insight into an operational action" },
    { id: "finance_014", vertical: "finance", text: "Explain why you're recommending against a buyback" },
    { id: "finance_015", vertical: "finance", text: "Present a risk the board hasn't yet noticed" },
  ],
  healthcare: [
    { id: "healthcare_001", vertical: "healthcare", text: "Explain a diagnosis to a patient who's scared" },
    { id: "healthcare_002", vertical: "healthcare", text: "Recommend a treatment plan to a skeptical patient" },
    { id: "healthcare_003", vertical: "healthcare", text: "Handle concerns from a patient's family member" },
    { id: "healthcare_004", vertical: "healthcare", text: "Break down a medical condition in plain language" },
    { id: "healthcare_005", vertical: "healthcare", text: "Guide a patient through the next steps in their care" },
    { id: "healthcare_006", vertical: "healthcare", text: "Explain side effects without minimizing them" },
    { id: "healthcare_007", vertical: "healthcare", text: "Discuss a change in treatment plan with a patient" },
    { id: "healthcare_008", vertical: "healthcare", text: "Deliver a difficult prognosis with compassion" },
    { id: "healthcare_009", vertical: "healthcare", text: "Explain lab results to a patient without medical background" },
    { id: "healthcare_010", vertical: "healthcare", text: "Handoff a patient to a colleague during shift change" },
    { id: "healthcare_011", vertical: "healthcare", text: "Respond to a patient refusing a recommended treatment" },
    { id: "healthcare_012", vertical: "healthcare", text: "Explain a procedure to reduce pre-op anxiety" },
    { id: "healthcare_013", vertical: "healthcare", text: "Present a case to an attending physician" },
    { id: "healthcare_014", vertical: "healthcare", text: "Discuss lifestyle changes without sounding preachy" },
    { id: "healthcare_015", vertical: "healthcare", text: "Explain a medication regimen so it actually gets followed" },
  ],
  law: [
    { id: "law_001", vertical: "law", text: "Defend your legal argument to opposing counsel" },
    { id: "law_002", vertical: "law", text: "Explain a legal concept to a non-lawyer client" },
    { id: "law_003", vertical: "law", text: "Respond to a judge's pointed question about your position" },
    { id: "law_004", vertical: "law", text: "Present your client's position in opening remarks" },
    { id: "law_005", vertical: "law", text: "Break down a case to a jury" },
    { id: "law_006", vertical: "law", text: "Explain a precedent's relevance to the current matter" },
    { id: "law_007", vertical: "law", text: "Handle a cross-examination answer under pressure" },
    { id: "law_008", vertical: "law", text: "Counter an argument from opposing counsel" },
    { id: "law_009", vertical: "law", text: "Explain the risks of a decision to a client" },
    { id: "law_010", vertical: "law", text: "Walk a client through their options" },
    { id: "law_011", vertical: "law", text: "Explain why you're recommending settlement" },
    { id: "law_012", vertical: "law", text: "Respond to a client second-guessing your strategy" },
    { id: "law_013", vertical: "law", text: "Translate a statute into plain-language implications" },
    { id: "law_014", vertical: "law", text: "Explain a contract clause to a business stakeholder" },
    { id: "law_015", vertical: "law", text: "Deliver a verdict outcome to a client" },
  ],
  education: [
    { id: "education_001", vertical: "education", text: "Teach a concept to a student who's struggling" },
    { id: "education_002", vertical: "education", text: "Simplify a complex idea for different learning levels" },
    { id: "education_003", vertical: "education", text: "Guide a student through a problem without giving the answer" },
    { id: "education_004", vertical: "education", text: "Explain a concept step-by-step" },
    { id: "education_005", vertical: "education", text: "Help someone understand a topic they're intimidated by" },
    { id: "education_006", vertical: "education", text: "Give a student feedback on work that isn't quite there" },
    { id: "education_007", vertical: "education", text: "Explain why a subject matters outside the classroom" },
    { id: "education_008", vertical: "education", text: "Respond to 'when will I ever use this in real life?'" },
    { id: "education_009", vertical: "education", text: "Walk a parent through their child's progress" },
    { id: "education_010", vertical: "education", text: "Introduce a new topic to get students curious" },
    { id: "education_011", vertical: "education", text: "Handle a student who disagrees with you in class" },
    { id: "education_012", vertical: "education", text: "Explain a historical event to make it feel present" },
    { id: "education_013", vertical: "education", text: "Teach a concept to a mixed-ability classroom" },
    { id: "education_014", vertical: "education", text: "Respond to a student's genuine confusion with patience" },
    { id: "education_015", vertical: "education", text: "Explain a correction without discouraging the student" },
  ],
  leadership: [
    { id: "leadership_001", vertical: "leadership", text: "Give a direct report feedback on their performance" },
    { id: "leadership_002", vertical: "leadership", text: "Address a team member whose work is slipping" },
    { id: "leadership_003", vertical: "leadership", text: "Align the team around a new priority" },
    { id: "leadership_004", vertical: "leadership", text: "Handle a conflict between two direct reports" },
    { id: "leadership_005", vertical: "leadership", text: "Communicate an unpopular decision to the team" },
    { id: "leadership_006", vertical: "leadership", text: "Explain a change that people won't like" },
    { id: "leadership_007", vertical: "leadership", text: "Praise someone publicly in a way that lands" },
    { id: "leadership_008", vertical: "leadership", text: "Coach a report through a mistake without lecturing" },
    { id: "leadership_009", vertical: "leadership", text: "Deliver news that a project is being cancelled" },
    { id: "leadership_010", vertical: "leadership", text: "Tell a high performer they won't get promoted this cycle" },
    { id: "leadership_011", vertical: "leadership", text: "Defend a team member to a skeptical VP" },
    { id: "leadership_012", vertical: "leadership", text: "Explain why you're reorganizing the team" },
    { id: "leadership_013", vertical: "leadership", text: "Handle a report who disagrees with a decision you made" },
    { id: "leadership_014", vertical: "leadership", text: "Give feedback to your own manager" },
    { id: "leadership_015", vertical: "leadership", text: "Announce a layoff to a team you care about" },
  ],
  other: [
    { id: "other_001", vertical: "other", text: "Explain why a habit matters to you" },
    { id: "other_002", vertical: "other", text: "Give a short talk on something you've learned recently" },
    { id: "other_003", vertical: "other", text: "Make a case for something you believe in" },
    { id: "other_004", vertical: "other", text: "Teach someone a skill you know well" },
    { id: "other_005", vertical: "other", text: "Respond to a question you weren't prepared for" },
    { id: "other_006", vertical: "other", text: "Describe a problem you're currently working through" },
    { id: "other_007", vertical: "other", text: "Explain a decision you're about to make" },
    { id: "other_008", vertical: "other", text: "Share a lesson from a failure" },
    { id: "other_009", vertical: "other", text: "Defend an opinion you hold" },
    { id: "other_010", vertical: "other", text: "Describe a challenge you're facing and your approach" },
    { id: "other_011", vertical: "other", text: "Make a recommendation to a friend" },
    { id: "other_012", vertical: "other", text: "Explain something you find fascinating" },
    { id: "other_013", vertical: "other", text: "Walk through your reasoning for a recent choice" },
    { id: "other_014", vertical: "other", text: "Respond to honest feedback you disagree with" },
    { id: "other_015", vertical: "other", text: "Tell a story with a clear point" },
  ],
};

/** O(1) id → prompt lookup, built once at module load. */
const VERTICAL_PROMPT_INDEX: ReadonlyMap<string, VerticalPrompt> = (() => {
  const map = new Map<string, VerticalPrompt>();
  for (const bank of Object.values(VERTICAL_PROMPTS)) {
    for (const p of bank) map.set(p.id, p);
  }
  return map;
})();

/** Look up a single vertical prompt object by id. */
export function getVerticalPromptById(id: string): VerticalPrompt | undefined {
  return VERTICAL_PROMPT_INDEX.get(id);
}

/**
 * Pick N prompt objects from a vertical's bank. Vertical banks are
 * single-vertical by definition, so there's no theme stratification —
 * the whole bank is the user's vertical. Stakeholder-based stratification
 * activates once expansion-pass prompts populate the optional
 * `stakeholder` field.
 */
export function pickVerticalPromptObjects(
  vertical: VerticalId,
  count: number = 5,
  opts: { rand?: () => number } = {},
): VerticalPrompt[] {
  const bank = VERTICAL_PROMPTS[vertical];
  if (!bank || bank.length === 0) return [];
  const rand = opts.rand ?? Math.random;
  const shuffled = [...bank];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/** Text-returning picker — thin wrapper for callers that don't need ids. */
export function pickVerticalPrompts(
  vertical: VerticalId,
  count: number = 5,
  opts: { rand?: () => number } = {},
): string[] {
  return pickVerticalPromptObjects(vertical, count, opts).map((p) => p.text);
}

/** Total number of prompts available in a vertical's bank. */
export function verticalBankSize(vertical: VerticalId): number {
  return VERTICAL_PROMPTS[vertical]?.length ?? 0;
}
