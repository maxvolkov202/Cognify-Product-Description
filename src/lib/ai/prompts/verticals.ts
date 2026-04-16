import type { VerticalId } from "@/lib/onboarding/constants";

/**
 * Vertical prompt bank — real-world scenarios organized by vertical.
 *
 * Used by the Build a Rep flow (Phase 5) to show 5 vertical-appropriate
 * prompts based on the user's onboarding selection. Per the team spec,
 * Build a Rep prompts ARE vertical-specific — the opposite rule from
 * Daily Workout which uses general prompts.
 *
 * Each vertical has ~15 prompts, expanded from the team's 5 seed
 * examples. The selector shows 5 at a time with a Refresh button to
 * surface the next 5.
 */

export const VERTICAL_PROMPTS: Record<VerticalId, readonly string[]> = {
  sales: [
    "Explain the value of your product clearly to a skeptical buyer",
    "Respond to a pricing objection without dropping your price",
    "Walk through a discovery call recap with a stakeholder",
    "Summarize ROI to a buyer in under 60 seconds",
    "Pitch your solution concisely to a distracted executive",
    "Handle a 'we already have a vendor' objection",
    "Open a cold call that gets a yes to a 15-minute meeting",
    "Explain why your product is worth the price premium",
    "Respond to 'send me more info and I'll get back to you'",
    "Deliver a case study that lands in 30 seconds",
    "Ask a discovery question that uncovers a real pain point",
    "Explain your competitive differentiator without trash-talking",
    "Handle a CFO asking 'what's the hard ROI?'",
    "Defend your product against a lower-priced alternative",
    "Respond to 'we don't have budget for this'",
  ],
  consulting: [
    "Present a recommendation to a client CFO",
    "Defend your analysis under pointed pushback",
    "Explain your analytical approach to a non-analyst",
    "Walk through your reasoning for a strategic choice",
    "Communicate a counterintuitive insight clearly",
    "Explain why the client's current approach isn't working",
    "Deliver bad news that the client will thank you for later",
    "Present three options and make the case for one",
    "Explain a framework to a client unfamiliar with it",
    "Handle a client who disagrees with your recommendation",
    "Tell a client their favorite initiative should be killed",
    "Walk an executive through a complex model in 90 seconds",
    "Explain a risk without sounding alarmist",
    "Defend a recommendation against political pushback",
    "Translate a quantitative insight into a strategic decision",
  ],
  finance: [
    "Explain Q3 results to non-financial executives",
    "Justify a proposed investment to the board",
    "Present insights from last month's performance",
    "Walk through key metrics in under 60 seconds",
    "Explain a tradeoff between short-term and long-term spend",
    "Defend a budget variance to a skeptical manager",
    "Explain why margins compressed this quarter",
    "Present a sensitivity analysis to a non-technical audience",
    "Explain a forecasting change to the CEO",
    "Justify headcount for a team you're growing",
    "Explain a cash flow concern to a founder",
    "Walk through a capital allocation decision",
    "Translate a finance insight into an operational action",
    "Explain why you're recommending against a buyback",
    "Present a risk the board hasn't yet noticed",
  ],
  healthcare: [
    "Explain a diagnosis to a patient who's scared",
    "Recommend a treatment plan to a skeptical patient",
    "Handle concerns from a patient's family member",
    "Break down a medical condition in plain language",
    "Guide a patient through the next steps in their care",
    "Explain side effects without minimizing them",
    "Discuss a change in treatment plan with a patient",
    "Deliver a difficult prognosis with compassion",
    "Explain lab results to a patient without medical background",
    "Handoff a patient to a colleague during shift change",
    "Respond to a patient refusing a recommended treatment",
    "Explain a procedure to reduce pre-op anxiety",
    "Present a case to an attending physician",
    "Discuss lifestyle changes without sounding preachy",
    "Explain a medication regimen so it actually gets followed",
  ],
  law: [
    "Defend your legal argument to opposing counsel",
    "Explain a legal concept to a non-lawyer client",
    "Respond to a judge's pointed question about your position",
    "Present your client's position in opening remarks",
    "Break down a case to a jury",
    "Explain a precedent's relevance to the current matter",
    "Handle a cross-examination answer under pressure",
    "Counter an argument from opposing counsel",
    "Explain the risks of a decision to a client",
    "Walk a client through their options",
    "Explain why you're recommending settlement",
    "Respond to a client second-guessing your strategy",
    "Translate a statute into plain-language implications",
    "Explain a contract clause to a business stakeholder",
    "Deliver a verdict outcome to a client",
  ],
  education: [
    "Teach a concept to a student who's struggling",
    "Simplify a complex idea for different learning levels",
    "Guide a student through a problem without giving the answer",
    "Explain a concept step-by-step",
    "Help someone understand a topic they're intimidated by",
    "Give a student feedback on work that isn't quite there",
    "Explain why a subject matters outside the classroom",
    "Respond to 'when will I ever use this in real life?'",
    "Walk a parent through their child's progress",
    "Introduce a new topic to get students curious",
    "Handle a student who disagrees with you in class",
    "Explain a historical event to make it feel present",
    "Teach a concept to a mixed-ability classroom",
    "Respond to a student's genuine confusion with patience",
    "Explain a correction without discouraging the student",
  ],
  leadership: [
    "Give a direct report feedback on their performance",
    "Address a team member whose work is slipping",
    "Align the team around a new priority",
    "Handle a conflict between two direct reports",
    "Communicate an unpopular decision to the team",
    "Explain a change that people won't like",
    "Praise someone publicly in a way that lands",
    "Coach a report through a mistake without lecturing",
    "Deliver news that a project is being cancelled",
    "Tell a high performer they won't get promoted this cycle",
    "Defend a team member to a skeptical VP",
    "Explain why you're reorganizing the team",
    "Handle a report who disagrees with a decision you made",
    "Give feedback to your own manager",
    "Announce a layoff to a team you care about",
  ],
  other: [
    "Explain why a habit matters to you",
    "Give a short talk on something you've learned recently",
    "Make a case for something you believe in",
    "Teach someone a skill you know well",
    "Respond to a question you weren't prepared for",
    "Describe a problem you're currently working through",
    "Explain a decision you're about to make",
    "Share a lesson from a failure",
    "Defend an opinion you hold",
    "Describe a challenge you're facing and your approach",
    "Make a recommendation to a friend",
    "Explain something you find fascinating",
    "Walk through your reasoning for a recent choice",
    "Respond to honest feedback you disagree with",
    "Tell a story with a clear point",
  ],
};

/** Pick N random prompts from a vertical's bank. */
export function pickVerticalPrompts(
  vertical: VerticalId,
  count: number = 5,
): string[] {
  const bank = VERTICAL_PROMPTS[vertical];
  if (!bank || bank.length === 0) return [];
  const shuffled = [...bank].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/** Total number of prompts available in a vertical's bank. */
export function verticalBankSize(vertical: VerticalId): number {
  return VERTICAL_PROMPTS[vertical]?.length ?? 0;
}
