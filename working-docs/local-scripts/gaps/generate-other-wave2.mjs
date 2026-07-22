// Wave 2 gap-fill generator for "other" vertical.
// Authors exactly `need` fresh prompts per (exercise × goal) gap.
// Appends to catalog without touching existing prompts.

import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/MaxVolkov/dev/cognify";
const GAPS = path.join(ROOT, "scripts/gaps/other.json");
const CATALOG = path.join(ROOT, "scripts/exercise-catalog/v1/vertical/other.json");

const gaps = JSON.parse(fs.readFileSync(GAPS, "utf-8"));
const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf-8"));

// Build catalog lookup by (dimension, name)
const catKey = (d, n) => `${d}::${n}`;
const catIndex = new Map();
for (const ex of catalog.exercises) catIndex.set(catKey(ex.dimension, ex.name), ex);

// Track all existing texts to enforce uniqueness across the file.
const allTexts = new Set();
for (const ex of catalog.exercises) for (const p of ex.prompts) allTexts.add(p.text);

// =============================================================================
// SCENARIO LIBRARY
// =============================================================================
// Each entry: a vivid mini-context spanning the "other" universe.
// Picker functions will weave these into goal-specific prompts.
// Keep prompts grounded, varied, ≤220 chars, plain spoken English.

// Difficulty mix per gap (need=1, need=2, need=3):
function difficultyMix(n) {
  if (n === 1) return ["core"];
  if (n === 2) return ["intro", "core"];
  if (n === 3) return ["intro", "core", "stretch"];
  // Fallback (shouldn't happen with threshold 3)
  const out = [];
  for (let i = 0; i < n; i++) out.push(["intro", "core", "stretch"][i % 3]);
  return out;
}

// =============================================================================
// PROMPT BANKS BY (exercise -> goal -> [intro, core, stretch] prompts)
// Each bank entry returns 3 prompts (one per difficulty) for that gap.
// Many exercises share goal patterns, but each prompt text is unique.
// =============================================================================

// Helpers to format common patterns.
const pick = (intro, core, stretch) => [
  { text: intro, difficulty: "intro" },
  { text: core, difficulty: "core" },
  { text: stretch, difficulty: "stretch" },
];

// Build the master bank.
// Keys: `${dimension}::${exerciseName}::${goal}` -> () => array of {text, difficulty}
const bank = {};

function add(dim, name, goal, intro, core, stretch) {
  const items = [];
  if (intro !== undefined) items.push({ text: intro, difficulty: "intro" });
  if (core !== undefined) items.push({ text: core, difficulty: "core" });
  if (stretch !== undefined) items.push({ text: stretch, difficulty: "stretch" });
  bank[`${dim}::${name}::${goal}`] = () => items;
}

// ===== CLARITY =====

// Answer the Confusion (clarity)
add("clarity", "Answer the Confusion", "handling_objections",
  "A skeptical peer says your roadmap is 'just last year repackaged.' Untangle what they actually mean and respond.",
  "A board member says your team's data 'doesn't add up.' Pin down which number they doubt and address it directly.",
  "A reporter says your safety record is 'misleading.' Sort out what they're conflating and respond on the record.");
add("clarity", "Answer the Confusion", "confidence",
  "Your skip-level asks why you keep saying 'I think' before every answer. Respond clearly.",
  "An interviewer asks why your last manager didn't promote you. Answer without flinching.",
  "An investor asks if you're actually ready to be CEO. Answer like you mean it.");
add("clarity", "Answer the Confusion", "thinking_on_the_spot",
  "A donor at a nonprofit gala asks where last year's funds actually went. Answer cleanly.",
  "A cross-functional partner asks why their request fell off your roadmap. Untangle the confusion.",
  "A journalist asks why your CEO went silent for two weeks. Answer without speculating.");
add("clarity", "Answer the Confusion", "giving_feedback",
  "A direct report says 'you've never told me what good looks like.' Untangle the misunderstanding.",
  "A peer asks why you keep rewriting their docs. Sort out the real issue and name it.");
add("clarity", "Answer the Confusion", "negotiation",
  "A vendor says your renewal terms 'changed without notice.' Sort out what they think changed and respond.",
  "A new hire says the offer doesn't match what the recruiter promised. Untangle and respond.",
  "A landlord says your sublease violates the contract. Pin down which clause and answer.");
add("clarity", "Answer the Confusion", "presenting",
  "Mid-keynote, an audience member says 'I don't follow.' Re-anchor the room in one line and continue.",
  "A board member says 'I'm lost on slide 4.' Clarify in plain words without restarting the deck.",
  "At a press conference, three reporters ask the same question three different ways. Answer the real one.");
add("clarity", "Answer the Confusion", "persuasion",
  "A skeptic says your proposal is 'just buzzwords.' Show them the substance underneath.",
  "Your skip-level says 'I don't get why this matters.' Make the case in concrete terms.",
  "An investor says your pitch is 'a solution looking for a problem.' Untangle the misread and respond.");
add("clarity", "Answer the Confusion", "storytelling",
  "A new hire asks why your team mythologizes the 'great outage of 2022.' Tell the real story.",
  "An interviewer asks why your last company really failed. Tell it straight, not the polished version.",
  "A documentary filmmaker asks what really happened the night your founder resigned. Tell the story.");
add("clarity", "Answer the Confusion", "asking_questions",
  "Your manager says 'just ask me when you're stuck.' What do you actually need to ask first?",
  "A confused stakeholder is sending three emails a day. What's the one question that closes the loop?",
  "A new exec asks for a 'state of the team.' What three questions back will give you the right framing?");

// Explain Like I'm 12 (clarity)
add("clarity", "Explain Like I'm 12", "handling_objections",
  "Explain to a non-technical exec why their 'simple fix' would actually break three other things.",
  "Explain to a board member why the cost overrun isn't proof the project should be killed.");
add("clarity", "Explain Like I'm 12", "confidence",
  "Explain to a panel of strangers why you're qualified to lead a team you've never managed before.",
  "Explain to your skip-level why you should run the new org, not the obvious internal candidate.");
add("clarity", "Explain Like I'm 12", "thinking_on_the_spot",
  "Explain to a journalist, on the spot, what your company does — without your usual scripted line.",
  "Explain to an audience member at a panel what you actually meant by your last answer.");
add("clarity", "Explain Like I'm 12", "giving_feedback",
  "Explain to a direct report why their slide deck didn't land with leadership.",
  "Explain to a peer why their tone in the all-hands chat is creating problems for the team.",
  "Explain to an underperforming colleague why their last project actually missed the mark.");
add("clarity", "Explain Like I'm 12", "negotiation",
  "Explain to a freelance client why your day rate is going up next quarter.",
  "Explain to a vendor why you need a 30-day extension on payment terms.",
  "Explain to the union rep why the company can't meet the wage ask this cycle.");
add("clarity", "Explain Like I'm 12", "presenting",
  "Explain to an all-hands what changed in this year's strategy without using one slide.",
  "Explain to a room of investors what your product does in two sentences.",
  "Explain to a school auditorium what your nonprofit actually accomplishes with a dollar of donations.");
add("clarity", "Explain Like I'm 12", "persuasion",
  "Explain to a co-founder why you should drop the side project everyone loves.",
  "Explain to a customer why upgrading is actually the cheaper option long-term.",
  "Explain to the city council why your grant proposal deserves to be funded over the others.");
add("clarity", "Explain Like I'm 12", "storytelling",
  "Explain to a new hire how your team came together by telling the story of the founding offsite.",
  "Explain to a documentary crew the day your nonprofit nearly shut down.",
  "Explain to an audience the night your launch went viral and what really happened backstage.");
add("clarity", "Explain Like I'm 12", "asking_questions",
  "Explain to a peer what you don't yet understand about their team's workflow.",
  "Explain to your mentor what you're trying to learn this quarter and where you're stuck.",
  "Explain to a researcher what gap in their published study you'd want investigated next.");

// Headline First (clarity)
add("clarity", "Headline First", "explaining",
  "Why did this week's launch underperform?",
  "Why did the partnership with the vendor fall apart?",
  "Why did the audit flag your team's controls?");
add("clarity", "Headline First", "handling_objections",
  "Is the company actually safer after the security incident?",
  "Did the layoff really save the money leadership promised?",
  "Was the rebrand worth the budget it consumed?");
add("clarity", "Headline First", "confidence",
  "Are you the right person to lead the new initiative?");
add("clarity", "Headline First", "giving_feedback",
  "Should your peer take the management track or stay IC?",
  "Did your direct report's last review reflect their actual performance?",
  "Is your co-founder slowing the company down right now?");
add("clarity", "Headline First", "negotiation",
  "Should we accept the vendor's revised SOW or push back?",
  "Should we close the contract at their number or hold for ours?",
  "Should the company accept the activist investor's slate?");
add("clarity", "Headline First", "presenting",
  "What's the one thing the board needs to walk away knowing today?",
  "What's the headline of this quarter's all-hands?",
  "What's the lede the press should run with after our announcement?");
add("clarity", "Headline First", "persuasion",
  "Should the team adopt the new tool the IT lead is pushing?",
  "Should we expand into the second city this year or wait?");
add("clarity", "Headline First", "storytelling",
  "What's the one moment that defined your team's year?",
  "What's the headline of your career arc so far?",
  "What's the title of the book you'd write about your last job?");
add("clarity", "Headline First", "asking_questions",
  "What's the single question you'd ask the new CEO on day one?",
  "What's the question your team avoids in retros?",
  "What's the one question that would unlock the customer interview you keep botching?");

// Make It Real (clarity)
add("clarity", "Make It Real", "explaining",
  "What does 'customer-obsessed' actually look like on a Tuesday afternoon at your company?",
  "What does 'cross-functional collaboration' look like when it's actually working?",
  "What does 'innovation' look like in a regulated industry that can't afford to break things?");
add("clarity", "Make It Real", "confidence",
  "Show me, with a specific example, why you're ready to run a team twice your current size.");
add("clarity", "Make It Real", "thinking_on_the_spot",
  "Give a specific example of a time you turned a hostile meeting around.",
  "Give a specific example of a decision you reversed within 24 hours and why.",
  "Give a specific example from the last week of an unscripted moment you handled well.");
add("clarity", "Make It Real", "giving_feedback",
  "Make the abstract feedback 'be more strategic' concrete for the report receiving it.",
  "Make the vague critique 'this isn't polished enough' specific for the designer in front of you.",
  "Make 'you're hard to work with' actionable for a senior peer who genuinely doesn't see it.");
add("clarity", "Make It Real", "negotiation",
  "Make 'we value our long partnership' concrete in a contract renewal conversation.",
  "Make the abstract 'we're flexible on terms' specific without giving away your real bottom line.",
  "Make 'no' concrete in a negotiation with a board member who outranks you.");
add("clarity", "Make It Real", "presenting",
  "Make your strategy slide real with a single anecdote your audience will remember a month later.",
  "Make 'we put users first' real in the next product all-hands.",
  "Make a 50-page report real in the three minutes you have at the board meeting.");
add("clarity", "Make It Real", "storytelling",
  "Tell a moment from your last project that proves the value your team adds, not just claims it.",
  "Tell a story from this year that shows what your culture is actually like at the worst moment.",
  "Tell the moment you understood what your company was really for, in a single scene.");
add("clarity", "Make It Real", "asking_questions",
  "Ask a question so specific it forces a peer off their talking points.",
  "Ask a stakeholder a question that turns a vague request into a real decision.",
  "Ask an exec a question in the hallway that gets you a clearer answer than the all-hands did.");

// No Jargon Allowed (clarity)
add("clarity", "No Jargon Allowed", "handling_objections",
  "Defend the new policy to an employee who's calling it 'corporate-speak nonsense.'",
  "Respond to a customer who says your terms of service are 'unreadable garbage.'",
  "Respond to a journalist who calls your press release 'word salad.'");
add("clarity", "No Jargon Allowed", "confidence",
  "Make your career pitch without saying 'leverage,' 'synergy,' or 'strategic.'",
  "Introduce yourself to a room of strangers without leaning on a single industry buzzword.",
  "Defend your accomplishments at a panel interview in language your grandparent would follow.");
add("clarity", "No Jargon Allowed", "thinking_on_the_spot",
  "On the spot, answer 'what does your team do?' without any acronyms.",
  "Answer a customer's question about your product without falling back on internal shorthand.",
  "Field a hostile question from a regulator using plain words only.");
add("clarity", "No Jargon Allowed", "giving_feedback",
  "Give a direct report 'you need to be more polished' in concrete, jargon-free terms.",
  "Tell a peer their work 'doesn't fit the vision' without using the word 'vision.'");
add("clarity", "No Jargon Allowed", "negotiation",
  "Negotiate a deadline extension with a client without falling into vague consultant-speak.",
  "Ask your manager for a raise in plain words, not HR euphemisms.",
  "Push back on a partnership term in a contract using everyday English the lawyers won't dodge.");
add("clarity", "No Jargon Allowed", "presenting",
  "Open a town hall without saying 'aligned,' 'optimize,' or 'transformative.'",
  "Present this quarter's roadmap to the company in language a new hire on day one can follow.",
  "Deliver the keynote at an industry conference without one buzzword the audience expects.");
add("clarity", "No Jargon Allowed", "persuasion",
  "Convince a customer to renew without one piece of marketing language.",
  "Make the case for a budget increase to finance without using 'ROI' or 'KPI.'",
  "Sell a skeptical investor on your seed round without resorting to startup shorthand.");
add("clarity", "No Jargon Allowed", "storytelling",
  "Tell the story of your last big project without any industry shorthand.",
  "Tell the founding story of your nonprofit without any sector buzzwords.",
  "Recount the launch night to a journalist using only words a teenager would use.");
add("clarity", "No Jargon Allowed", "asking_questions",
  "Ask a user three diagnostic questions in plain language during an interview.",
  "Ask a customer what they actually need without using any product terminology.",
  "Interview a candidate without leaning on any standard interview prompt phrases.");

// One Point Only (clarity)
add("clarity", "One Point Only", "explaining",
  "What's the single thing the new hire most needs to understand about the team?",
  "What's the one reason the partnership with the agency isn't working?",
  "What's the one truth about your industry that outsiders almost always miss?");
add("clarity", "One Point Only", "handling_objections",
  "What's the single objection the board will raise to your proposal?",
  "What's the one reason a customer would reject your pricing change?",
  "What's the single thing the activist investor will hammer on first?");
add("clarity", "One Point Only", "confidence",
  "What's the one thing you know better than anyone else in the room?");
add("clarity", "One Point Only", "giving_feedback",
  "What's the one piece of feedback your peer most needs to hear today?",
  "What's the single thing your direct report should stop doing immediately?");
add("clarity", "One Point Only", "negotiation",
  "What's the one term in this contract you absolutely won't move on?",
  "What's the single concession you'd take in exchange for the price you want?",
  "What's the one thing the other side wants that you can give away cheaply?");
add("clarity", "One Point Only", "presenting",
  "What's the one slide that has to land if your board deck does nothing else?",
  "What's the single sentence you need the audience to repeat after your talk?",
  "What's the one moment in your keynote that has to make the room go silent?");
add("clarity", "One Point Only", "persuasion",
  "What's the one reason this customer should sign today instead of next quarter?",
  "What's the single argument that flips your skeptical co-founder?");
add("clarity", "One Point Only", "storytelling",
  "What's the one scene from this year that captures everything about your team?",
  "What's the single moment in your career arc you'd tell first in an interview?",
  "What's the one story your team tells about itself that says everything you need to know?");
add("clarity", "One Point Only", "asking_questions",
  "What's the one question that would force a vague stakeholder to commit?",
  "What's the single question you'd ask a user that would change your roadmap?",
  "What's the one question to ask the CEO that would reveal whether they actually have a plan?");

// Prove It (clarity)
add("clarity", "Prove It", "explaining",
  "Prove your team is actually faster than the agency you're competing against.",
  "Prove your nonprofit's model is more efficient than the established one in the same space.",
  "Prove that your company's brand reputation has actually improved after the rebrand.");
add("clarity", "Prove It", "handling_objections",
  "Prove the security incident wasn't caused by the cost-cutting the board pushed for.",
  "Prove the missed quarter wasn't your team's fault when leadership is implying it was.");
add("clarity", "Prove It", "thinking_on_the_spot",
  "On the spot, prove your team is on track when an exec drops by asking for evidence.",
  "Prove, with what you have in your head right now, that your product roadmap is the right one.",
  "Prove on the spot to a hostile journalist that your last public statement was accurate.");
add("clarity", "Prove It", "giving_feedback",
  "Prove to a direct report, with specifics, why they're not yet ready for promotion.",
  "Prove to a peer that the slide they're proud of is going to confuse the audience.",
  "Prove to your manager that the report they recommended is the wrong fit for the role.");
add("clarity", "Prove It", "negotiation",
  "Prove to a vendor that their price is above market without showing your cards.",
  "Prove to a candidate that your offer is competitive without disclosing internal salary bands.",
  "Prove to a customer that switching from you to a competitor would actually cost them more.");
add("clarity", "Prove It", "presenting",
  "Prove to a skeptical audience at a conference that your case study is real and reproducible.",
  "Prove to the board, with three numbers, that the strategy you proposed last quarter is working.",
  "Prove to the all-hands that this year's results justify keeping the same operating model.");
add("clarity", "Prove It", "storytelling",
  "Prove your team's resilience through a single story from last year, not a list of accomplishments.",
  "Prove the culture is healthy through a moment, not a survey result.",
  "Prove the founder is changeable by telling the story of a decision they reversed.");
add("clarity", "Prove It", "asking_questions",
  "Prove to a peer you understand their problem by asking the one question that demonstrates it.",
  "Prove to a candidate you take diversity seriously through the questions you ask in the interview.",
  "Prove to a researcher you've read their work by asking a question they haven't been asked before.");

// The Analogy Bridge (clarity)
add("clarity", "The Analogy Bridge", "handling_objections",
  "Use an analogy to explain why the project delay isn't a sign of failure.",
  "Use an analogy to defend why the price increase is fair, to a customer pushing back.",
  "Use an analogy to defend the layoff strategy to employees who feel betrayed.");
add("clarity", "The Analogy Bridge", "confidence",
  "Use an analogy to make the case, with conviction, that you're ready to lead this initiative.",
  "Use an analogy to explain why this is your moment, even though it doesn't look like it on paper.");
add("clarity", "The Analogy Bridge", "thinking_on_the_spot",
  "On the spot, find an analogy that helps a skeptical exec see your problem the way you do.",
  "Reach for an analogy that explains, mid-meeting, why a cross-functional partner is stuck.");
add("clarity", "The Analogy Bridge", "giving_feedback",
  "Use an analogy to deliver the feedback your direct report has dodged for six months.",
  "Use an analogy to tell a peer their leadership style is creating burnout on their team.",
  "Use an analogy to tell a senior exec their meeting cadence is breaking the org below them.");
add("clarity", "The Analogy Bridge", "negotiation",
  "Use an analogy to reframe a stalled negotiation with a vendor whose number won't move.",
  "Use an analogy to explain to a candidate why your compensation structure is actually a long-term win.",
  "Use an analogy to walk a hostile counterparty into the win-win you've been pushing toward.");
add("clarity", "The Analogy Bridge", "presenting",
  "Open your next presentation with an analogy that makes the central idea inescapable.",
  "Use an analogy in the middle of your talk to wake up a room that's drifting.",
  "Close a keynote with an analogy that makes the audience remember you a year later.");
add("clarity", "The Analogy Bridge", "persuasion",
  "Use an analogy to flip a board member who has publicly opposed your proposal.");
add("clarity", "The Analogy Bridge", "storytelling",
  "Use an analogy as the spine of a story you'd tell in an interview about your toughest year.",
  "Build an analogy into a customer story that makes the listener feel the stakes you felt.",
  "Use an extended analogy to tell the founding story of your company in a way no one has heard.");
add("clarity", "The Analogy Bridge", "asking_questions",
  "Ask a question, built around an analogy, that reframes how your team thinks about the problem.",
  "Use an analogy in your next user interview to surface a need the customer hasn't yet articulated.",
  "Pose an analogy to a panel of researchers that opens up a line of inquiry no one was pursuing.");

// The Word Budget (clarity)
add("clarity", "The Word Budget", "explaining",
  "In 25 words, explain why your team is restructuring this quarter.");
add("clarity", "The Word Budget", "handling_objections",
  "In 30 words, respond to a skeptical board member who thinks your forecast is too optimistic.",
  "In 25 words, respond to a journalist's leading question about your CEO's resignation.",
  "In 20 words, push back on a customer who claims your contract terms changed without notice.");
add("clarity", "The Word Budget", "confidence",
  "In 25 words, state why you're the right person for the role you're interviewing for.");
add("clarity", "The Word Budget", "giving_feedback",
  "In 30 words, deliver the hardest piece of feedback your direct report has heard from you.",
  "In 25 words, tell a peer their last presentation went poorly without softening the message.",
  "In 20 words, tell your manager their decision is hurting the team and what to do.");
add("clarity", "The Word Budget", "negotiation",
  "In 30 words, ask your manager for a 20% raise.",
  "In 25 words, decline a vendor's counteroffer without insulting them.",
  "In 20 words, give your final position to a candidate negotiating their offer.");
add("clarity", "The Word Budget", "presenting",
  "In 50 words, open the all-hands with the news the company has been bracing for.",
  "In 30 words, close a keynote so the audience remembers exactly one thing.");
add("clarity", "The Word Budget", "persuasion",
  "In 30 words, sell a customer on renewing for two years instead of one.",
  "In 25 words, convince a peer to swap projects with you.");
add("clarity", "The Word Budget", "storytelling",
  "In 30 words, tell the moment you knew the project was going to ship.",
  "In 25 words, tell the story of the worst week of your career.",
  "In 50 words, tell the story of how your nonprofit was founded.");
add("clarity", "The Word Budget", "asking_questions",
  "In 15 words, ask a candidate the question that reveals the most.",
  "In 20 words, ask a user the question that opens up their real frustration.");

// ===== CONCISENESS =====

// Cut by Half (conciseness)
add("conciseness", "Cut by Half", "handling_objections",
  "Defend the price hike, then cut your defense in half.",
  "Respond to the board's skepticism about the merger — then say it in half the words.",
  "Reply to a hostile reporter's accusation, then halve your reply without losing the point.");
add("conciseness", "Cut by Half", "confidence",
  "Pitch yourself for the promotion in 60 seconds, then cut it to 30.",
  "Defend your readiness for the C-suite in 90 seconds, then halve it for the elevator.");
add("conciseness", "Cut by Half", "thinking_on_the_spot",
  "On the spot, brief your skip-level on the incident — then cut your briefing in half.",
  "Field a hostile question, then re-answer it in half the words.");
add("conciseness", "Cut by Half", "giving_feedback",
  "Deliver your peer review, then cut everything that isn't the actual feedback.",
  "Give your direct report the hard conversation, then strip half the cushioning.",
  "Tell a senior exec their decision is wrong, then halve the message without softening it.");
add("conciseness", "Cut by Half", "negotiation",
  "Make your opening offer in a salary negotiation, then cut your justification in half.",
  "Pitch a vendor on your terms in 60 seconds, then in 30.",
  "Walk a customer through a renewal proposal, then say it in half the time.");
add("conciseness", "Cut by Half", "presenting",
  "Open the all-hands, then cut your opening in half without losing the headline.",
  "Pitch the board your new strategy, then cut to the version you'd give in a 5-minute slot.",
  "Deliver the keynote intro, then cut the warm-up entirely.");
add("conciseness", "Cut by Half", "storytelling",
  "Tell the story of the launch in 90 seconds, then in 45.",
  "Tell the most meaningful story of your career in two minutes, then in 60 seconds.",
  "Tell the donor the story of one beneficiary, then cut everything that isn't them.");
add("conciseness", "Cut by Half", "asking_questions",
  "Ask the panel the question on your mind, then cut every word that isn't the question.",
  "Open a user interview with a question — then cut the preamble.",
  "Ask the CEO a hard question in front of the whole company, in as few words as possible.");

// Kill the Filler (conciseness)
add("conciseness", "Kill the Filler", "explaining",
  "Explain how your team prioritizes work — without 'kind of,' 'basically,' or 'sort of.'",
  "Explain to a stakeholder why their project is deprioritized, without hedging language.",
  "Explain to the board why the partnership failed, without any softening filler.");
add("conciseness", "Kill the Filler", "handling_objections",
  "Respond to a customer complaint without filler words.",
  "Push back on an exec's critique of your strategy with zero verbal padding.",
  "Defend yourself in a board hearing without one 'um,' 'well,' or 'I think.'");
add("conciseness", "Kill the Filler", "thinking_on_the_spot",
  "Answer 'what's blocking your team?' without filler.",
  "Answer a question you didn't prepare for, with zero verbal stalling.",
  "Field a hostile follow-up at a press conference without one 'so.'");
add("conciseness", "Kill the Filler", "giving_feedback",
  "Give a direct report tough feedback with no softening words at all.",
  "Tell your peer their idea won't work without any cushioning language.",
  "Tell your manager their last decision damaged the team — no filler.");
add("conciseness", "Kill the Filler", "negotiation",
  "Make your ask of the recruiter without any apologetic filler.",
  "State your counteroffer to a vendor without 'I was just wondering' or 'maybe.'",
  "Tell a customer the contract terms are final without one hedge.");
add("conciseness", "Kill the Filler", "asking_questions",
  "Ask a candidate three diagnostic questions with no filler in between.",
  "Open a user interview with a question that has no warm-up.",
  "Ask the CEO a question at the all-hands without one 'just curious if maybe.'");

// No Hedging (conciseness)
add("conciseness", "No Hedging", "explaining",
  "Explain why your team missed the goal — no hedges, no excuses.",
  "Explain the partnership breakdown without softening blame.",
  "Explain to a regulator what happened, without one hedging word.");
add("conciseness", "No Hedging", "handling_objections",
  "Respond to the customer's complaint without one 'we'll look into it.'",
  "Push back on an investor's criticism without one defensive qualifier.",
  "Reply to a board member's pointed question without any hedge.");
add("conciseness", "No Hedging", "negotiation",
  "State your bottom line to a vendor without one hedge.",
  "Counter a recruiter's offer without one 'I think maybe.'",
  "Decline a partnership at a gala without one 'we'll consider it.'");
add("conciseness", "No Hedging", "presenting",
  "Open the all-hands with your conclusion, not a setup.",
  "Lead your board deck with the verdict, not the analysis.",
  "Pitch your fund-raising round to investors without one weasel word.");
add("conciseness", "No Hedging", "persuasion",
  "Tell a customer why they should sign, without 'I think' or 'we believe.'",
  "Make the case for the promotion you want, without one self-deprecating clause.",
  "Convince an investor in 60 seconds, without one hedging qualifier.");
add("conciseness", "No Hedging", "storytelling",
  "Tell the story of your last failure without protecting yourself.",
  "Tell the press the truth about the incident without one PR softening line.",
  "Tell a documentary crew about the day you nearly walked away, with no edges sanded.");
add("conciseness", "No Hedging", "asking_questions",
  "Ask the question on your mind without 'I was just wondering.'",
  "Ask the candidate what they really want, without 'if you don't mind sharing.'",
  "Ask the founder a direct question in front of the team, with no preamble.");

// No Throat Clearing (conciseness)
add("conciseness", "No Throat Clearing", "explaining",
  "Explain a stalled project without warming up to the answer.",
  "Explain to a partner why their request is blocked — first words count.",
  "Explain a regulatory finding to the team with no preamble.");
add("conciseness", "No Throat Clearing", "handling_objections",
  "Take a hostile question at a town hall — first three words have to be the answer.",
  "Reply to a customer's blunt complaint, no warming up.",
  "Respond to a press question about layoffs in one clean line.");
add("conciseness", "No Throat Clearing", "thinking_on_the_spot",
  "When asked the question you've been dreading, open with the answer, not the framing.");
add("conciseness", "No Throat Clearing", "giving_feedback",
  "Open a coaching conversation with the feedback, not the small talk.",
  "Open a peer 1:1 with the issue, not 'so I was thinking maybe.'");
add("conciseness", "No Throat Clearing", "negotiation",
  "Open the salary negotiation with your number.",
  "Open the vendor renewal with your terms.",
  "Open a board-level negotiation with your position, not your rationale.");
add("conciseness", "No Throat Clearing", "persuasion",
  "Open the pitch with the recommendation, not the agenda.",
  "Open the customer call with why they should renew, not how you're doing.",
  "Open a fundraising conversation with the ask, not the company history.");
add("conciseness", "No Throat Clearing", "storytelling",
  "Open the story with the moment, not 'so a few years ago.'",
  "Open a keynote with a scene, not 'thank you for having me.'",
  "Open a documentary interview with the truth, not the setup.");
add("conciseness", "No Throat Clearing", "asking_questions",
  "Open a user research session with the question, not your introduction.",
  "Open a 1:1 with your manager with what you need, not 'how was your weekend.'");

// One Idea Per Response (conciseness)
add("conciseness", "One Idea Per Response", "explaining",
  "Explain the reorg in one idea per answer when leadership asks for the rationale.",
  "Explain the launch delay in one idea per beat when the customer asks why.",
  "Explain the strategy shift to a journalist, one thread at a time.");
add("conciseness", "One Idea Per Response", "handling_objections",
  "Respond to a board member's three-part objection one piece at a time.",
  "Reply to a customer's stacked complaint without merging two issues into one answer.");
add("conciseness", "One Idea Per Response", "confidence",
  "Answer 'why you' in three separate, focused beats — not one rambling one.",
  "Answer 'why now' for the role with one idea, not five.",
  "Tell the board why you should run the new initiative — one idea at a time.");
add("conciseness", "One Idea Per Response", "giving_feedback",
  "Deliver feedback to a direct report one point at a time, even if you have five.",
  "Tell your peer the one thing you need from them, not the whole list.");
add("conciseness", "One Idea Per Response", "negotiation",
  "Make your three asks one at a time, not stacked into a paragraph.",
  "Push back on a contract revision one clause at a time.",
  "Walk a vendor through your concerns one issue at a time, not bundled.");
add("conciseness", "One Idea Per Response", "presenting",
  "Run your board update one idea per slide.",
  "Deliver the all-hands one announcement at a time, no bundling.",
  "Walk through your investor deck letting each slide stand alone.");
add("conciseness", "One Idea Per Response", "storytelling",
  "Tell the founding story one scene at a time.",
  "Recount the year's biggest moment without folding three stories into one.",
  "Walk a documentary crew through the incident one beat at a time.");
add("conciseness", "One Idea Per Response", "asking_questions",
  "Ask one question and stop. Don't load the second one until you've heard the first answer.",
  "Interview a candidate one question at a time, not in stacks of three.",
  "Run a user research session asking one thing at a time, even when you're curious about more.");

// Subject Verb Object (conciseness)
add("conciseness", "Subject Verb Object", "handling_objections",
  "Respond to a customer's claim that your product caused their downtime.",
  "Push back on a peer's claim that your team blocked their launch.",
  "Reply to a regulator's letter alleging your team withheld evidence.");
add("conciseness", "Subject Verb Object", "confidence",
  "State your contribution to the last project, in clean subject-verb-object lines.",
  "Tell the board what you decided, what you did, and what happened — no passive voice.",
  "Defend your record at a board meeting using direct, active sentences only.");
add("conciseness", "Subject Verb Object", "thinking_on_the_spot",
  "On the spot, tell your skip-level what happened — subject, verb, object.",
  "When a reporter asks what your team did, answer with active sentences only.",
  "Field a hostile question with a single direct sentence: who did what to whom.");
add("conciseness", "Subject Verb Object", "giving_feedback",
  "Tell a direct report what they did, what the impact was, and what to do next.",
  "Give a peer feedback in active sentences: not 'mistakes were made' — name them.",
  "Tell a senior exec the truth using direct sentences, no diplomatic passives.");
add("conciseness", "Subject Verb Object", "negotiation",
  "Make your ask in one active sentence: 'I want X by Y in exchange for Z.'",
  "State your bottom line to a vendor without one passive sentence.",
  "Open a partnership negotiation with active, direct sentences only.");
add("conciseness", "Subject Verb Object", "presenting",
  "Present this quarter's results in active sentences only.",
  "Open your keynote with five active sentences — no warm-up, no passives.",
  "Brief the board on the incident using active sentences: who did what, when.");
add("conciseness", "Subject Verb Object", "persuasion",
  "Make your case in clean active sentences: claim, evidence, ask.",
  "Sell your initiative to the board in active sentences only.",
  "Pitch an investor in active sentences — no 'it has been said' constructions.");
add("conciseness", "Subject Verb Object", "storytelling",
  "Tell a project story in active sentences: I did this, then this, then this.",
  "Tell a customer story in active sentences — they did, you responded, this happened.",
  "Tell the founding story in active sentences with the founder as the subject.");
add("conciseness", "Subject Verb Object", "asking_questions",
  "Ask the candidate active-voice questions: 'What did you do?' not 'What was done?'",
  "Ask a user research participant active questions about what they actually did last week.",
  "Ask the CEO active-voice questions at the all-hands that they can't dodge.");

// The 30 Second Rule (conciseness)
add("conciseness", "The 30 Second Rule", "handling_objections",
  "30 seconds: respond to an angry customer at the front of the line.",
  "30 seconds: defend the merger to an employee who is convinced it's the end.",
  "30 seconds: rebut a hostile reporter's question on live TV.");
add("conciseness", "The 30 Second Rule", "confidence",
  "30 seconds: pitch yourself for the promotion in the elevator with the CEO.",
  "30 seconds: introduce yourself at a board meeting as the new exec.",
  "30 seconds: pitch yourself to a stranger who could change your career.");
add("conciseness", "The 30 Second Rule", "giving_feedback",
  "30 seconds: give your direct report the feedback you've been postponing.",
  "30 seconds: tell a peer the meeting style isn't working — and what to change.",
  "30 seconds: tell your boss the team is losing trust in their decision.");
add("conciseness", "The 30 Second Rule", "negotiation",
  "30 seconds: make your salary counteroffer to the recruiter.",
  "30 seconds: ask for a deadline extension from a client you can't afford to lose.",
  "30 seconds: pitch a vendor on splitting a contract change down the middle.");
add("conciseness", "The 30 Second Rule", "presenting",
  "30 seconds: open the all-hands with the news no one wants.",
  "30 seconds: pitch the founder's keynote opening line in a hallway run-through.",
  "30 seconds: introduce yourself at the start of a TED-style talk to a thousand strangers.");
add("conciseness", "The 30 Second Rule", "persuasion",
  "30 seconds: convince your manager to back the project nobody else will sponsor.",
  "30 seconds: persuade a peer to join the cross-functional effort.",
  "30 seconds: pitch a billion-dollar partner on a five-year deal in the hallway.");
add("conciseness", "The 30 Second Rule", "storytelling",
  "30 seconds: tell a moment that captures everything about your team this year.",
  "30 seconds: tell an investor the moment you knew the product would work.",
  "30 seconds: tell a donor the story that explains why your nonprofit exists.");
add("conciseness", "The 30 Second Rule", "asking_questions",
  "30 seconds: ask a candidate the question that will make or break their interview.",
  "30 seconds: ask the founder, on the way out of the all-hands, the question no one else dared.",
  "30 seconds: ask a research participant the question that unlocks the whole study.");

// The Hard Stop (conciseness)
add("conciseness", "The Hard Stop", "explaining",
  "Explain the data anomaly without sliding into a full report.",
  "Explain why the partnership ended in three sentences, then stop.",
  "Explain to a regulator what happened — and stop the moment you've covered it.");
add("conciseness", "The Hard Stop", "handling_objections",
  "Respond to the customer's complaint and stop on the first complete answer.",
  "Reply to a board member's hostile question and stop — no over-explaining.",
  "Push back on a journalist's framing once, cleanly, then stop talking.");
add("conciseness", "The Hard Stop", "confidence",
  "Make your case for the promotion in two sentences, then close your mouth.",
  "Answer 'why are you the right one?' in one sentence, then sit back.");
add("conciseness", "The Hard Stop", "giving_feedback",
  "Deliver the feedback in three sentences, then stop and wait.",
  "Tell a direct report the truth, then let the silence do the rest.");
add("conciseness", "The Hard Stop", "negotiation",
  "State your number and then stop talking, even if the other side stays silent.",
  "Make your final offer in one sentence and refuse to fill the silence.",
  "Walk away from a stalled negotiation with one clean sentence — no backtracking.");
add("conciseness", "The Hard Stop", "presenting",
  "Close your keynote on the line that matters, then walk off — no thank-yous.",
  "End your board presentation on the recommendation, not the rationale.",
  "End the investor pitch on the ask, then shut up.");
add("conciseness", "The Hard Stop", "persuasion",
  "Make the pitch in 60 seconds and let it land — no follow-up bullets.",
  "Pitch the customer in two beats and stop selling.",
  "Pitch the board on the new initiative, land the ask, and stop.");
add("conciseness", "The Hard Stop", "storytelling",
  "Tell the moment and stop — don't explain what it meant.",
  "Tell the story of the launch night, end on the moment of impact, stop talking.",
  "End the founding story on the decision that mattered, not on a moral.");
add("conciseness", "The Hard Stop", "asking_questions",
  "Ask the question and stop — no clarifying afterthoughts.",
  "Ask a research participant a question and let the silence pull the answer.",
  "Ask the founder one question in the hallway and walk away.");

// The Single Sentence (conciseness)
add("conciseness", "The Single Sentence", "handling_objections",
  "In one sentence, respond to the claim that your team isn't pulling its weight.",
  "In one sentence, push back on a customer demanding a refund they don't deserve.",
  "In one sentence, rebut a journalist's loaded question.");
add("conciseness", "The Single Sentence", "confidence",
  "In one sentence, state why you're the right hire.");
add("conciseness", "The Single Sentence", "giving_feedback",
  "In one sentence, tell a direct report what they need to change.",
  "In one sentence, give a senior peer the feedback their team won't.",
  "In one sentence, tell the founder their last decision was a mistake.");
add("conciseness", "The Single Sentence", "negotiation",
  "In one sentence, make your salary ask.",
  "In one sentence, ask a vendor to split the difference.",
  "In one sentence, walk away from a deal that doesn't serve you.");
add("conciseness", "The Single Sentence", "presenting",
  "In one sentence, open the all-hands with the news.",
  "In one sentence, close your board presentation.");
add("conciseness", "The Single Sentence", "persuasion",
  "In one sentence, sell a customer on switching to your higher tier.",
  "In one sentence, convince a peer to take on the messy project.");
add("conciseness", "The Single Sentence", "storytelling",
  "In one sentence, tell the story that defines your company.",
  "In one sentence, tell the moment that made you the person you are.",
  "In one sentence, tell a donor what your nonprofit really does.");
add("conciseness", "The Single Sentence", "asking_questions",
  "In one sentence, ask a candidate the question that reveals the truth.",
  "In one sentence, ask a customer the question that unlocks the upsell.",
  "In one sentence, ask the CEO the question that the whole company is too scared to ask.");

// ===== PACING =====

// Beat the Buzzer (pacing)
add("pacing", "Beat the Buzzer", "explaining",
  "60 seconds: explain how your team works to someone who's never met you.");
add("pacing", "Beat the Buzzer", "handling_objections",
  "30 seconds: defend the budget cut to your team after they hear it from someone else.",
  "60 seconds: respond to an investor's skepticism about your churn numbers.",
  "30 seconds: rebut a journalist's hostile framing of your last earnings call.");
add("pacing", "Beat the Buzzer", "confidence",
  "30 seconds: introduce yourself as the new department head.");
add("pacing", "Beat the Buzzer", "thinking_on_the_spot",
  "45 seconds: answer the unexpected question from the back of the room.");
add("pacing", "Beat the Buzzer", "giving_feedback",
  "60 seconds: deliver year-end feedback to a peer in the elevator.",
  "30 seconds: tell your direct report the project failed and why.",
  "45 seconds: tell your manager their decision is hurting the team.");
add("pacing", "Beat the Buzzer", "negotiation",
  "30 seconds: pitch your counteroffer to the recruiter on a callback.",
  "60 seconds: walk a vendor through the three terms you can't accept.",
  "45 seconds: ask for a raise during your manager's office hours.");
add("pacing", "Beat the Buzzer", "storytelling",
  "60 seconds: tell the story of the worst incident your team ever handled.",
  "45 seconds: tell a story that demonstrates why you'd be a great founder.",
  "30 seconds: tell a moment from a project that captures your work style.");
add("pacing", "Beat the Buzzer", "asking_questions",
  "30 seconds: ask a candidate the question that will rank them against the field.",
  "60 seconds: ask a research participant three questions that open up the real signal.",
  "45 seconds: ask the founder, in the hallway, the question the company needs answered.");

// Metronome (pacing)
add("pacing", "Metronome", "handling_objections",
  "Steady through a customer escalation call without speeding up under pressure.",
  "Hold a constant pace while a board member challenges your strategy line by line.",
  "Keep your tempo steady while a hostile reporter cuts in repeatedly.");
add("pacing", "Metronome", "confidence",
  "Pitch yourself for the role at a constant, calm tempo — no rush, no drag.",
  "Hold a steady pace while explaining a complicated decision in a job interview.",
  "Keep an even tempo during a press Q&A about a high-stakes company decision.");
add("pacing", "Metronome", "thinking_on_the_spot",
  "On the spot, hold a steady pace while you work out an answer in real time.",
  "Keep your tempo when a panelist throws an unexpected question.",
  "Stay metronomic while you think through a multi-part board question live.");
add("pacing", "Metronome", "giving_feedback",
  "Deliver hard feedback at a constant tempo — don't speed up to escape the discomfort.",
  "Coach a struggling report at a steady, patient pace — no rushing to wrap.");
add("pacing", "Metronome", "negotiation",
  "Hold tempo through a contentious salary negotiation.",
  "Stay metronomic across a 90-minute contract negotiation.",
  "Match the other side's pace in a high-stakes vendor renewal — and never lose it.");
add("pacing", "Metronome", "presenting",
  "Deliver a 10-minute talk at a steady pace from open to close.",
  "Present a board update at constant tempo — no rushing the bad slide.",
  "Hold a metronomic tempo through a 30-minute keynote.");
add("pacing", "Metronome", "persuasion",
  "Pitch a customer at a calm, steady pace — even when they push back.",
  "Hold a constant pace while persuading a board member to back your plan.",
  "Stay metronomic during a fundraising pitch where investors keep interrupting.");
add("pacing", "Metronome", "storytelling",
  "Tell a story at a metronomic pace — no rushing the punchline.",
  "Tell a customer testimonial at constant tempo, building tension without speeding up.",
  "Tell your founding story at a steady pace from prologue to present day.");
add("pacing", "Metronome", "asking_questions",
  "Run a user interview at a steady, unhurried pace.",
  "Ask candidate questions at a constant pace, even when their answers race.",
  "Question the founder at a steady pace in a public Q&A — no rushing to fill silence.");

// Punctuation Breathing (pacing)
add("pacing", "Punctuation Breathing", "explaining",
  "Explain your team's structure, breathing fully at every comma and period.",
  "Explain a policy change to the company, taking real breaths at every stop.",
  "Explain a regulatory finding to the board, with full breath at every sentence break.");
add("pacing", "Punctuation Breathing", "handling_objections",
  "Respond to a hostile board question, breathing at every comma.",
  "Field a sharp customer complaint with full breaths between sentences.",
  "Respond to a journalist's attack with real breath between every clause.");
add("pacing", "Punctuation Breathing", "confidence",
  "Open a job interview answer with a full breath before every sentence.",
  "Pitch yourself for the role with deliberate breaths at each stop.",
  "Open the keynote with full breath at every break — even under house lights.");
add("pacing", "Punctuation Breathing", "thinking_on_the_spot",
  "On the spot, use your breath to buy thinking room between sentences.",
  "Take real breaths between answers to a panel of unfriendly press.",
  "Use breath between every sentence as you talk through a hard problem live on stage.");
add("pacing", "Punctuation Breathing", "giving_feedback",
  "Deliver coaching with full breaths between sentences — slow it down.",
  "Tell your peer a hard truth, breathing between every line.",
  "Give your manager pointed feedback, breathing fully at every stop.");
add("pacing", "Punctuation Breathing", "negotiation",
  "Make your salary ask, breathing fully between every sentence.",
  "Negotiate contract terms with deliberate breath at every comma.",
  "Hold the other side in a vendor negotiation by breathing fully into every stop.");
add("pacing", "Punctuation Breathing", "presenting",
  "Open your talk breathing fully at every line break.",
  "Present a board update with real breath between every claim.",
  "Deliver a 30-minute keynote breathing fully at every stop.");
add("pacing", "Punctuation Breathing", "persuasion",
  "Pitch your initiative with full breaths between sentences.",
  "Convince a customer to renew, breathing at every comma.",
  "Persuade an investor with full breath between every claim.");
add("pacing", "Punctuation Breathing", "asking_questions",
  "Ask a research participant questions with real breath between each one.",
  "Interview a candidate breathing fully between every question.",
  "Question the founder publicly with full breath between each follow-up.");

// Silence Over Filler (pacing)
add("pacing", "Silence Over Filler", "explaining",
  "Explain a complicated decision to the team, using silence instead of 'um' to think.",
  "Explain to a stakeholder why their request is being deprioritized, using silence to land it.");
add("pacing", "Silence Over Filler", "handling_objections",
  "Field a sharp customer question, using silence to weigh your answer instead of 'so.'",
  "Respond to a board member's pointed critique using pauses, not fillers.",
  "Take a hostile press question and let silence sit before answering.");
add("pacing", "Silence Over Filler", "confidence",
  "Pitch yourself for the role, using silence instead of fillers between sentences.",
  "Answer the unexpected interview question with a pause, not 'um, well.'",
  "Open a town hall with silence, then your line — no warm-up fillers.");
add("pacing", "Silence Over Filler", "giving_feedback",
  "Give a direct report tough news, using silence instead of cushioning words.",
  "Tell your peer their meeting went badly, letting silence carry the message.");
add("pacing", "Silence Over Filler", "negotiation",
  "After making your offer, sit in silence instead of filling it with caveats.",
  "Negotiate a vendor contract using silence as leverage.",
  "Hold the room in a board negotiation by trusting silence over your impulse to talk.");
add("pacing", "Silence Over Filler", "presenting",
  "Deliver a 5-minute talk with no fillers, even when your mind blanks.",
  "Open the keynote on a beat of silence, then your first line.",
  "Present quarterly results without one 'so' or 'um' — let silence do the work.");
add("pacing", "Silence Over Filler", "persuasion",
  "Make the pitch, then sit in silence and let the customer respond first.",
  "Pitch the investor and use silence to let the ask land.",
  "Persuade a peer using pauses instead of stacking arguments on top of each other.");
add("pacing", "Silence Over Filler", "asking_questions",
  "Ask a research participant a question and stay silent through their long pause.",
  "Interview a candidate by asking the question once, then waiting in silence.",
  "Question the founder publicly, then hold silence until they answer.");

// Slow Cooker (pacing)
add("pacing", "Slow Cooker", "explaining",
  "Slowly walk a new hire through how decisions are actually made at your company.",
  "Take your time explaining a major operational change to a partner team.");
add("pacing", "Slow Cooker", "handling_objections",
  "Slowly take apart a customer's objection without rushing to soothe.",
  "Take your time responding to a board member who has already made up their mind.");
add("pacing", "Slow Cooker", "confidence",
  "Slowly walk into the room and open the all-hands at your own pace.",
  "Take your time answering the unexpected interview question.",
  "Open a keynote slowly enough that the room comes with you.");
add("pacing", "Slow Cooker", "thinking_on_the_spot",
  "Slowly work through a question you didn't prepare for, on stage.",
  "Take your time answering a board question instead of grabbing the first sentence.");
add("pacing", "Slow Cooker", "giving_feedback",
  "Slowly walk a direct report through what's not working and what you need.",
  "Take your time delivering the feedback your peer has been waiting six months for.",
  "Slowly explain to a senior exec how their behavior is breaking the team.");
add("pacing", "Slow Cooker", "negotiation",
  "Slowly walk through your negotiation position with a vendor.",
  "Take your time stating your salary ask to a recruiter — no rushing.",
  "Slowly close a complex partnership negotiation across many hours.");
add("pacing", "Slow Cooker", "presenting",
  "Slowly walk the audience through your strategy without speeding past the hard slide.",
  "Take your time presenting quarterly results — let each number land.",
  "Slowly walk the press through the company's response to a public incident.");
add("pacing", "Slow Cooker", "persuasion",
  "Slowly persuade a customer to switch tiers, without urgency in your voice.",
  "Take your time selling a peer on a hard cross-functional ask.",
  "Slowly walk an investor toward the close — no rushing to the ask.");
add("pacing", "Slow Cooker", "asking_questions",
  "Slowly draw out a user research participant's full answer with patient follow-ups.",
  "Take your time asking a candidate the question that matters most.",
  "Slowly question the founder in a public Q&A — let the silence work for you.");

// Strategic Pause (pacing)
add("pacing", "Strategic Pause", "explaining",
  "Use a pause to land the key data point in your team explainer.",
  "Pause before delivering the headline finding to a partner team.",
  "Pause before the surprising number when explaining the quarterly results.");
add("pacing", "Strategic Pause", "handling_objections",
  "Pause before responding to the most hostile question in the Q&A.",
  "Pause before answering an exec who's clearly looking for a fight.",
  "Pause before responding to a hostile reporter and let them feel the silence.");
add("pacing", "Strategic Pause", "thinking_on_the_spot",
  "Pause to think before answering the unexpected board question.",
  "Pause before answering the question you weren't ready for at a panel.");
add("pacing", "Strategic Pause", "giving_feedback",
  "Pause before delivering the actual feedback — let the discomfort do the work.",
  "Pause before naming the behavior you're asking your direct report to change.");
add("pacing", "Strategic Pause", "negotiation",
  "Pause before stating your number in a salary negotiation.",
  "Pause before answering a vendor's counteroffer.",
  "Pause before delivering your walkaway line in a partnership negotiation.");
add("pacing", "Strategic Pause", "storytelling",
  "Pause before the moment in your story that you want them to remember.",
  "Pause at the inflection point of your founding story.",
  "Pause before the line that turns the entire keynote story.");
add("pacing", "Strategic Pause", "asking_questions",
  "Pause before asking the candidate the hardest question on your list.",
  "Pause before asking a customer the question that unlocks the truth.",
  "Pause before asking the CEO the question no one else will ask.");

// Tempo Shift (pacing)
add("pacing", "Tempo Shift", "explaining",
  "Speed up through context, slow down on the result, in your team explainer.",
  "Run fast through history, slow down on the takeaway, in your strategy walkthrough.",
  "Race through process, slow down on the implication, when briefing the board.");
add("pacing", "Tempo Shift", "handling_objections",
  "Speed up through your defense, slow down on your final stance, in the hostile Q&A.",
  "Race past the noise, slow down on the actual answer, in a board interrogation.",
  "Fast through the press accusation, slow down on the rebuttal that matters.");
add("pacing", "Tempo Shift", "confidence",
  "Speed up through your background, slow down on what you uniquely bring.",
  "Race through the resume, slow down on the moment that proves you.",
  "Run fast through credentials, slow down on the conviction in your voice.");
add("pacing", "Tempo Shift", "thinking_on_the_spot",
  "Speed up through framing, slow down on your real answer, on the spot.",
  "Race through 'let me think about that,' slow down on the actual point.",
  "Fast through the warmup, slow down on the answer you didn't prepare.");
add("pacing", "Tempo Shift", "giving_feedback",
  "Race through context, slow down on the feedback itself.",
  "Speed up through pleasantries, slow down on the request for change.",
  "Race through 'how was your week,' slow down on the hard truth for your report.");
add("pacing", "Tempo Shift", "negotiation",
  "Speed up through your rationale, slow down on the number.",
  "Race through context, slow down on your walk-away condition.",
  "Run fast through the agenda, slow down on the ask.");
add("pacing", "Tempo Shift", "storytelling",
  "Race through setup, slow down on the moment that lands.");
add("pacing", "Tempo Shift", "asking_questions",
  "Speed up through your preamble, slow down on the question.",
  "Race through warm-up questions, slow down on the one that reveals the truth.",
  "Run fast through 'just curious,' slow down on the real question.");

// The Stretch (pacing)
add("pacing", "The Stretch", "explaining",
  "Stretch your explanation of the team's strategy across a longer arc — don't compress it.",
  "Take your time explaining a complicated technical decision to a non-technical exec.",
  "Stretch the regulatory briefing into something the board can actually follow.");
add("pacing", "The Stretch", "handling_objections",
  "Stretch your response to a hostile customer email into a longer, more thoughtful reply.",
  "Take your time defending the merger across a full board interrogation.",
  "Stretch your reply to a press accusation into a measured, full-context response.");
add("pacing", "The Stretch", "giving_feedback",
  "Stretch a hard 1:1 conversation across the full hour — don't rush to the close.",
  "Take your time giving year-end feedback to a senior peer.",
  "Stretch a coaching conversation across multiple sessions rather than dumping it all at once.");
add("pacing", "The Stretch", "negotiation",
  "Stretch a salary negotiation across multiple rounds.",
  "Take your time across a multi-day vendor negotiation — don't close prematurely.",
  "Stretch a partnership negotiation over weeks to get the right terms.");
add("pacing", "The Stretch", "presenting",
  "Stretch a 10-minute talk to a full keynote without padding.",
  "Take your time across a 60-minute board presentation.",
  "Stretch a press briefing across the full hour without losing the audience.");
add("pacing", "The Stretch", "persuasion",
  "Stretch a customer pitch across multiple touchpoints.",
  "Take your time persuading a peer across several conversations.",
  "Stretch an investor pitch across a multi-meeting cycle.");
add("pacing", "The Stretch", "asking_questions",
  "Stretch a candidate interview across the full hour without rushing to your favorite question.",
  "Take your time across a user research session — let the silence work.",
  "Stretch a public Q&A with the founder across many questions without grabbing the mic.");

// Two-Beat Landing (pacing)
add("pacing", "Two-Beat Landing", "explaining",
  "Land your explanation on a two-beat pause before moving on.",
  "Drop your final line, then count two beats before continuing.",
  "Explain the new strategy, then leave two beats of silence before the next slide.");
add("pacing", "Two-Beat Landing", "handling_objections",
  "Respond to the objection, then two beats — let it land before continuing.",
  "Push back on the board member, then hold two beats of silence.");
add("pacing", "Two-Beat Landing", "thinking_on_the_spot",
  "Answer the unexpected question, then two beats — don't rush to qualify.",
  "Deliver your on-the-spot answer, hold two beats, then sit back.",
  "Answer the panel's curveball, two beats, then pass the mic.");
add("pacing", "Two-Beat Landing", "giving_feedback",
  "Deliver the feedback, hold two beats, then ask 'how does that land?'",
  "Tell your peer the hard truth, hold two beats, then wait for a response.",
  "Tell your manager the team is unhappy, hold two beats, then pass the floor.");
add("pacing", "Two-Beat Landing", "negotiation",
  "State your number, two beats, then sit back and wait.",
  "Make your final offer, hold two beats, then pass.",
  "Decline the counter, hold two beats, then close the meeting.");
add("pacing", "Two-Beat Landing", "storytelling",
  "End the story on the moment, then two beats — don't explain.",
  "Land the punchline of your founding story on a two-beat pause.",
  "End your keynote story on the line, then two beats of silence before walking off.");
add("pacing", "Two-Beat Landing", "asking_questions",
  "Ask the question, two beats, then say nothing else.",
  "Ask the user a question, hold two beats, then wait for them to fill the space.",
  "Ask the CEO a public question, hold two beats, then sit down.");

// ===== STRUCTURE =====

// Bottom Line First (structure)
add("structure", "Bottom Line First", "explaining",
  "Bottom-line first: what is your team actually doing this quarter?",
  "Bottom-line first: where did the budget overrun come from?",
  "Bottom-line first: what changed in the regulatory environment this year?");
add("structure", "Bottom Line First", "handling_objections",
  "Bottom-line first: respond to a board member calling the launch a failure.",
  "Bottom-line first: reply to a customer who claims the contract was misrepresented.",
  "Bottom-line first: respond to the press question about the senior departure.");
add("structure", "Bottom Line First", "confidence",
  "Bottom-line first: state why you're ready to step into the open VP role.");
add("structure", "Bottom Line First", "giving_feedback",
  "Bottom-line first: tell a direct report they're not getting promoted this cycle.");
add("structure", "Bottom Line First", "negotiation",
  "Bottom-line first: state your salary expectation in the first reply to the recruiter.",
  "Bottom-line first: open the vendor negotiation with your final number.",
  "Bottom-line first: open the partnership negotiation with what you'll walk for.");
add("structure", "Bottom Line First", "presenting",
  "Bottom-line first: open the all-hands with the headline, not the agenda.",
  "Bottom-line first: open the board deck with the verdict, not the analysis.",
  "Bottom-line first: open the press conference with the resolution, not the timeline.");
add("structure", "Bottom Line First", "persuasion",
  "Bottom-line first: convince your manager to back the project nobody else likes.",
  "Bottom-line first: pitch the customer on the upgrade in the first sentence.",
  "Bottom-line first: pitch the investor with the ask, not the company history.");
add("structure", "Bottom Line First", "storytelling",
  "Bottom-line first: start the story with how it ended, then walk backward.",
  "Bottom-line first: tell the founding story by leading with the outcome.",
  "Bottom-line first: tell the keynote story by giving away the ending in line one.");
add("structure", "Bottom Line First", "asking_questions",
  "Bottom-line first: ask a candidate the deciding question before any others.",
  "Bottom-line first: ask the user the question that matters most before any others.",
  "Bottom-line first: ask the founder the make-or-break question before the warm-up.");

// Compare and Contrast (structure)
add("structure", "Compare and Contrast", "explaining",
  "In-house team vs outside agency — for the new initiative.",
  "Quarterly planning vs OKRs — which actually drives the work?");
add("structure", "Compare and Contrast", "handling_objections",
  "Their version of events vs yours — for the board.",
  "The customer's complaint vs the actual data — respond.",
  "Your CEO's public statement vs the internal reality — address the gap.");
add("structure", "Compare and Contrast", "confidence",
  "Your career path vs the obvious one — make the case for yours.",
  "Your team's track record vs the peer team's — make the case in front of leadership.",
  "Your strategy this year vs the consensus advice — defend yours publicly.");
add("structure", "Compare and Contrast", "negotiation",
  "Your offer vs the market — explain to a candidate.",
  "Your terms vs the competitor's — explain to a customer renewing.",
  "Your partnership terms vs the industry standard — defend at the board.");
add("structure", "Compare and Contrast", "presenting",
  "Last year's all-hands vs this year's — what's actually changed?",
  "Your team's current strategy vs last quarter's — present the shift to the org.",
  "This year's plan vs the activist investor's plan — make the case at the AGM.");
add("structure", "Compare and Contrast", "storytelling",
  "Tell the story of your last job vs this one — what's actually different.",
  "Your team's worst quarter vs its best — what changed.",
  "Your nonprofit's first year vs this year — tell both stories at a donor event.");
add("structure", "Compare and Contrast", "asking_questions",
  "Your team's perspective vs the customer's — ask the question that bridges them.",
  "Your engineering team's framing vs your sales team's — ask the question that surfaces it.",
  "Your board's framing vs the team's — ask the founder the question that puts them side by side.");

// Monroe's Motivated Sequence (structure)
add("structure", "Monroe's Motivated Sequence", "explaining",
  "Walk the team through why the strategy is changing, end with what they should do Monday.",
  "Explain to a partner team why the operating model is shifting, ending in their next step.",
  "Walk regulators through the policy change ending with what compliance requires.");
add("structure", "Monroe's Motivated Sequence", "handling_objections",
  "Respond to a board member's pushback using Monroe's full sequence to close them out.",
  "Use Monroe's sequence to convert a customer ready to churn into a renewal.");
add("structure", "Monroe's Motivated Sequence", "confidence",
  "Use Monroe's sequence to pitch yourself for the VP role.",
  "Walk a hiring panel through your case for the senior IC slot using the full sequence.",
  "Use Monroe's sequence at a board meeting to make the case for taking on the new role.");
add("structure", "Monroe's Motivated Sequence", "thinking_on_the_spot",
  "On the spot, walk through Monroe's sequence to pitch a fix to an exec in the hallway.",
  "Use Monroe's sequence to talk a peer off a bad decision in real time.",
  "Use Monroe's sequence in a Q&A to flip the audience's mood on the spot.");
add("structure", "Monroe's Motivated Sequence", "giving_feedback",
  "Use Monroe's sequence to deliver year-end feedback to a senior peer.",
  "Walk your direct report through the gap between current state and expectation using Monroe's sequence.",
  "Use Monroe's sequence to tell your manager their behavior is breaking the team.");
add("structure", "Monroe's Motivated Sequence", "negotiation",
  "Use Monroe's sequence to walk a vendor to your final terms.",
  "Pitch a salary increase to your manager using Monroe's full sequence.",
  "Use Monroe's sequence in a high-stakes acquisition negotiation.");
add("structure", "Monroe's Motivated Sequence", "presenting",
  "Open the all-hands with Monroe's sequence to land the strategy shift.");
add("structure", "Monroe's Motivated Sequence", "storytelling",
  "Tell the story of a project recovery using Monroe's sequence as the spine.",
  "Use Monroe's sequence to tell a donor the story of a beneficiary.",
  "Use Monroe's sequence to tell the founding story at an investor day.");
add("structure", "Monroe's Motivated Sequence", "asking_questions",
  "Use Monroe's sequence to lead a user research interview from rapport to ask.",
  "Use Monroe's sequence to question a founder publicly in a way that gets a real answer.",
  "Use Monroe's sequence to ask the board the question that forces a decision.");

// Question Then Answer (structure)
add("structure", "Question Then Answer", "handling_objections",
  "Open with the question the board is really asking, then answer it.",
  "Open with the customer's real complaint as a question, then answer it.",
  "Open with the press's underlying question, then answer it directly.");
add("structure", "Question Then Answer", "confidence",
  "Open with 'why me?' then answer it for a panel that's clearly skeptical.",
  "Open with 'why now?' then answer it for a board choosing between candidates.",
  "Open with 'why this company?' then answer it for an investor in the room.");
add("structure", "Question Then Answer", "thinking_on_the_spot",
  "Repeat the unexpected question back as a frame, then answer it.",
  "Use the form 'the real question is...' to reframe a hostile question on the spot.",
  "Open with 'let me restate the question,' then answer the one that matters.");
add("structure", "Question Then Answer", "giving_feedback",
  "Open feedback with the question your direct report has been avoiding, then answer it.",
  "Open the peer review with the question they should have asked themselves, then answer it.");
add("structure", "Question Then Answer", "negotiation",
  "Open the negotiation with the question both sides are dancing around, then answer it.",
  "Open the salary conversation with 'what's the number?' then answer it.",
  "Open the vendor negotiation with the deal-breaker question, then your position.");
add("structure", "Question Then Answer", "presenting",
  "Open the all-hands with the question employees have been whispering about, then answer it.",
  "Open the board presentation with the question they've been wanting to ask, then answer it.",
  "Open the keynote with the question the audience didn't think you'd touch, then answer it.");
add("structure", "Question Then Answer", "persuasion",
  "Open the pitch with the buyer's real question, then answer it.",
  "Open the fundraising conversation with the investor's quiet doubt, then answer it.",
  "Open the partnership pitch with the question your counterpart is asking themselves.");
add("structure", "Question Then Answer", "storytelling",
  "Open the story with the question you couldn't answer at the time, then walk us through.",
  "Open a customer story with the question the customer had at the start, then resolve it.",
  "Open the founding story with the question the founder couldn't shake, then tell us why.");
add("structure", "Question Then Answer", "asking_questions",
  "Open the user research session with a question, then offer a hypothesis as the answer.",
  "Open a candidate interview with a question that frames the whole hour.",
  "Open a public Q&A with the question the audience is hoping you'd ask.");

// Signpost First (structure)
add("structure", "Signpost First", "handling_objections",
  "Signpost: 'three reasons to keep this initiative alive,' then defend it.",
  "Signpost: 'two things the data actually says,' then refute the criticism.",
  "Signpost: 'three errors in the press framing,' then correct each.");
add("structure", "Signpost First", "confidence",
  "Signpost: 'three reasons I'm the right hire,' then deliver each.",
  "Signpost: 'two moments that prove I'm ready,' then walk through them.",
  "Signpost: 'three commitments I make to this board,' then deliver them.");
add("structure", "Signpost First", "thinking_on_the_spot",
  "On the spot, signpost: 'two parts to your question,' then answer each.");
add("structure", "Signpost First", "giving_feedback",
  "Signpost: 'three things to start, two things to stop,' then walk through.",
  "Signpost: 'one specific behavior and its impact,' then deliver feedback.",
  "Signpost: 'two patterns I've noticed,' then name them to a senior peer.");
add("structure", "Signpost First", "negotiation",
  "Signpost: 'three terms I need, two I can flex on,' then walk a vendor through them.",
  "Signpost: 'two non-negotiables in this contract,' then state them.",
  "Signpost: 'three deal-breakers for the partnership,' then deliver each at the negotiation.");
add("structure", "Signpost First", "presenting",
  "Signpost: 'three things you'll hear today,' then deliver the all-hands.",
  "Signpost: 'four parts to the keynote,' then run through it.");
add("structure", "Signpost First", "persuasion",
  "Signpost: 'three reasons to back this project,' then defend each.",
  "Signpost: 'two arguments for the renewal,' then walk through them with the customer.",
  "Signpost: 'three reasons to invest now,' then close.");
add("structure", "Signpost First", "storytelling",
  "Signpost: 'three chapters to this story,' then tell them.",
  "Signpost: 'two acts in the founding story,' then walk through.",
  "Signpost: 'three turning points in my career,' then tell them at a panel.");
add("structure", "Signpost First", "asking_questions",
  "Signpost: 'three questions I need to ask,' then ask the candidate.",
  "Signpost: 'two questions for the user,' then run the research session.",
  "Signpost: 'three things I'd like the founder to answer,' then ask publicly.");

// The 3 Point Rule (structure)
add("structure", "The 3 Point Rule", "explaining",
  "Three reasons the team missed the goal, plainly.",
  "Three changes in the operating model — explain to the partner team.",
  "Three things that broke down in the partnership — explain to the board.");
add("structure", "The 3 Point Rule", "handling_objections",
  "Three reasons the layoff was necessary — defend at the all-hands.",
  "Three reasons the price hike is fair — defend to the customer.",
  "Three reasons the public statement holds up — defend to the press.");
add("structure", "The 3 Point Rule", "confidence",
  "Three reasons you're the right one to lead the new initiative.",
  "Three commitments you'll make if the board picks you for the role.");
add("structure", "The 3 Point Rule", "thinking_on_the_spot",
  "On the spot, three things you'd change in the company tomorrow.",
  "On the spot, three things you'd say to the press about the senior departure.",
  "On the spot, three reasons the project is still on track when an exec asks.");
add("structure", "The 3 Point Rule", "giving_feedback",
  "Three things your direct report does well, then three to change.",
  "Three behaviors a peer should keep, three to stop.");
add("structure", "The 3 Point Rule", "negotiation",
  "Three non-negotiables in the contract — state to the vendor.",
  "Three reasons your salary number stands — make to the recruiter.",
  "Three terms to win, two to give — pitch in a board-level negotiation.");
add("structure", "The 3 Point Rule", "presenting",
  "Three things you want the audience to remember from your talk.",
  "Three takeaways from the quarter — present to the board.");
add("structure", "The 3 Point Rule", "storytelling",
  "Three moments that defined the year — tell them as a story.",
  "Three turning points in the founding story — walk through them.",
  "Three scenes from your career that tell who you are — deliver at a panel.");
add("structure", "The 3 Point Rule", "asking_questions",
  "Three questions to ask the candidate that reveal the real signal.",
  "Three questions to ask the user that open up the research.",
  "Three questions to ask the founder that the team is too scared to ask.");

// The Problem Solution Frame (structure)
add("structure", "The Problem Solution Frame", "explaining",
  "Frame the missed quarter as problem-then-solution for the team.",
  "Frame the rebrand as problem-then-solution for the customer base.",
  "Frame the new compliance regime as problem-then-solution for the board.");
add("structure", "The Problem Solution Frame", "confidence",
  "Frame the open VP role as problem-then-solution, with you as the answer.",
  "Frame the company's missing capability as problem-then-solution, with you as the hire.");
add("structure", "The Problem Solution Frame", "giving_feedback",
  "Frame your direct report's pattern as problem-then-solution.",
  "Frame the team's morale as problem-then-solution for your skip-level.",
  "Frame the senior peer's behavior as problem-then-solution in a tough conversation.");
add("structure", "The Problem Solution Frame", "negotiation",
  "Frame the recruiter's gap as problem-then-solution to justify your salary ask.",
  "Frame the vendor's billing issue as problem-then-solution to anchor the renegotiation.",
  "Frame the partnership friction as problem-then-solution to close a stalled deal.");
add("structure", "The Problem Solution Frame", "presenting",
  "Frame the strategy shift as problem-then-solution in the all-hands.",
  "Frame the year's headwinds as problem-then-solution in the board update.",
  "Frame the company's existential question as problem-then-solution in the keynote.");
add("structure", "The Problem Solution Frame", "persuasion",
  "Frame the customer's pain as problem-then-solution in the pitch.",
  "Frame the missing capability as problem-then-solution to justify the hire.",
  "Frame the market gap as problem-then-solution in the investor pitch.");
add("structure", "The Problem Solution Frame", "storytelling",
  "Tell a customer story as problem-then-solution that lands on a number.",
  "Tell the founding story as problem-then-solution.",
  "Tell a postmortem story as problem-then-solution at the all-hands.");
add("structure", "The Problem Solution Frame", "asking_questions",
  "Ask user research questions framed as problem-then-solution.",
  "Ask a candidate to walk through their last project as problem-then-solution.",
  "Ask the founder a question that forces them to frame the company's risk as problem-then-solution.");

// The Story Arc (structure)
add("structure", "The Story Arc", "explaining",
  "Use a story arc to explain how your team came to its current shape.",
  "Use a story arc to explain the rebrand to the company.",
  "Use a story arc to explain the regulatory shift to your board.");
add("structure", "The Story Arc", "handling_objections",
  "Use a story arc to push back on the layoff criticism at the all-hands.",
  "Use a story arc to respond to a customer who feels betrayed by the price hike.",
  "Use a story arc to respond to the press accusation that your company misled customers.");
add("structure", "The Story Arc", "confidence",
  "Use a story arc to tell why you're ready to lead the open team.",
  "Use a story arc to defend your readiness for the C-suite role.",
  "Use a story arc to land your candidacy in a panel interview.");
add("structure", "The Story Arc", "thinking_on_the_spot",
  "On the spot, build a story arc around the question you didn't see coming.",
  "Construct a story arc in real time to explain a decision that just got criticized.",
  "Build a story arc on the spot to defend a controversial move in front of a hostile audience.");
add("structure", "The Story Arc", "negotiation",
  "Use a story arc to walk a vendor toward your final offer.",
  "Use a story arc to anchor your salary ask in your career trajectory.",
  "Use a story arc in a high-stakes acquisition negotiation to ground the price.");
add("structure", "The Story Arc", "persuasion",
  "Use a story arc to pitch the new initiative to leadership.",
  "Use a story arc to sell a customer on the upgrade.",
  "Use a story arc to close the investor on the round.");
add("structure", "The Story Arc", "asking_questions",
  "Use a story arc to draw out a candidate's real history through questions.",
  "Use a story arc to lead a user research session toward the truth.",
  "Use a story arc when questioning the founder publicly to make the answer matter.");

// Two Then One (structure)
add("structure", "Two Then One", "explaining",
  "Two reasons the strategy works, one why it might not — explain to the team.",
  "Two reasons the partnership succeeded, one why it's at risk — explain to the board.",
  "Two reasons the system is stable, one reason to worry — explain to the regulators.");
add("structure", "Two Then One", "handling_objections",
  "Two strengths in the proposal, one weakness — defend against board pushback.",
  "Two reasons the customer should renew, one reason they shouldn't — respond honestly.");
add("structure", "Two Then One", "confidence",
  "Two reasons you're ready for the role, one reason it's a stretch — own it in the interview.",
  "Two strengths you bring, one gap you'll close — pitch yourself authentically.");
add("structure", "Two Then One", "thinking_on_the_spot",
  "Two arguments for the decision, one against — answer on the spot in front of leadership.",
  "Two reasons to proceed, one reason to pause — when an exec asks for your read.",
  "Two reasons the timing is right, one reason it's risky — when the board asks live.");
add("structure", "Two Then One", "giving_feedback",
  "Two things your report is doing well, one thing to change — at year-end review.",
  "Two strengths of your peer's work, one critical flaw — give honest feedback.");
add("structure", "Two Then One", "negotiation",
  "Two terms you'll accept, one you'll walk for — open the negotiation cleanly.",
  "Two compromises you can offer, one you can't — anchor the vendor talks.",
  "Two reasons to take the deal, one reason to push back — in a board-level negotiation.");
add("structure", "Two Then One", "presenting",
  "Two wins, one loss — present this quarter to the board honestly.",
  "Two confirmed plans, one open question — present the roadmap to the team.",
  "Two reasons to celebrate, one reason to brace — present at the all-hands.");
add("structure", "Two Then One", "storytelling",
  "Two moments that worked, one that didn't — tell the year as a story.",
  "Two scenes from the launch, one from the failure — tell at the offsite.",
  "Two highs, one low — tell the founding story at the investor day.");
add("structure", "Two Then One", "asking_questions",
  "Two warm-up questions, one hard one — interview a candidate.",
  "Two open questions, one closing one — run a user research session.",
  "Two safe questions, one risky one — question the founder at the AMA.");

// ===== THINKING QUALITY =====

// Disconfirm Yourself (thinking_quality)
add("thinking_quality", "Disconfirm Yourself", "explaining",
  "Explain your team's strategy, then explain the case that it's wrong.",
  "Explain the rebrand's logic, then explain why customers might reject it.",
  "Explain the new operating model, then explain why it might fail in 18 months.");
add("thinking_quality", "Disconfirm Yourself", "handling_objections",
  "Respond to the board's pushback, then disconfirm your own response.",
  "Reply to a customer's complaint, then disconfirm your reply.",
  "Defend the press statement, then disconfirm your own defense.");
add("thinking_quality", "Disconfirm Yourself", "giving_feedback",
  "Deliver feedback to a direct report, then disconfirm your own assessment.",
  "Tell a peer their idea is wrong, then disconfirm your judgment.",
  "Tell your manager their decision is hurting the team, then disconfirm your read.");
add("thinking_quality", "Disconfirm Yourself", "negotiation",
  "State your negotiating position, then disconfirm it from the other side.",
  "Make your salary ask, then disconfirm why it's reasonable.",
  "Open the partnership negotiation, then disconfirm your terms publicly.");
add("thinking_quality", "Disconfirm Yourself", "presenting",
  "Present this quarter's plan, then present the case it's wrong.",
  "Open the board deck, then walk them through what would prove your plan wrong.",
  "Deliver the keynote thesis, then disconfirm it publicly.");
add("thinking_quality", "Disconfirm Yourself", "persuasion",
  "Pitch the customer, then disconfirm your own pitch.",
  "Persuade a peer to join the project, then disconfirm your case.",
  "Pitch the investor, then disconfirm why your company is the right bet.");
add("thinking_quality", "Disconfirm Yourself", "storytelling",
  "Tell the story of your success, then tell why it might be a fluke.",
  "Tell the founding story, then disconfirm the founder myth.",
  "Tell the customer story at the offsite, then disconfirm the lesson.");
add("thinking_quality", "Disconfirm Yourself", "asking_questions",
  "Ask the candidate the question, then ask the question that disconfirms your read.",
  "Ask the user a question, then ask the one that disconfirms what you expect.",
  "Ask the founder a question, then ask the one that disconfirms their answer.");

// Draw the Line (thinking_quality)
add("thinking_quality", "Draw the Line", "explaining",
  "Will the team hit next month's goal? Draw the line on your confidence.",
  "Will the partnership last another year? Draw the line.",
  "Will the regulatory environment loosen by next year? Draw the line.");
add("thinking_quality", "Draw the Line", "handling_objections",
  "When a board member challenges your forecast, draw the confidence line for them.",
  "When a customer demands certainty on the renewal, draw the line you can defend.",
  "When the press asks whether the company will weather the storm, draw the line publicly.");
add("thinking_quality", "Draw the Line", "giving_feedback",
  "Tell your direct report exactly where your confidence in them ends.",
  "Tell a peer where your confidence in the project ends.",
  "Tell a senior exec where your confidence in their decision drops to zero.");
add("thinking_quality", "Draw the Line", "negotiation",
  "Draw the line on your walk-away in the negotiation.",
  "Draw the line on what you'd accept from the recruiter.",
  "Draw the line on the partnership terms you won't move on.");
add("thinking_quality", "Draw the Line", "presenting",
  "Present the quarterly forecast, then draw the line of confidence around each number.",
  "Open the board presentation by drawing the line on what you actually know.",
  "Deliver the keynote, drawing the line on which claims are confident and which are bets.");
add("thinking_quality", "Draw the Line", "persuasion",
  "Pitch the customer the upgrade, then draw the line on the savings you can guarantee.",
  "Pitch a peer on the project, then draw the line on what you'll commit to.",
  "Pitch the investor, drawing the line on what's projection vs. what's signed.");
add("thinking_quality", "Draw the Line", "storytelling",
  "Tell the story of last year, drawing the line between what you knew and what you guessed.",
  "Tell the founding story, drawing the line between mythology and what really happened.",
  "Tell the launch story, drawing the line between strategy and luck.");
add("thinking_quality", "Draw the Line", "asking_questions",
  "Ask the candidate questions that force them to draw the line on their own claims.",
  "Ask the user questions that draw the line between recall and reconstruction.",
  "Ask the founder questions that draw the line between what they know and what they hope.");

// First Principles (thinking_quality)
add("thinking_quality", "First Principles", "handling_objections",
  "From first principles, why does anyone need a performance review at all?",
  "From first principles, why should the company keep its current OKR structure?",
  "From first principles, why does the company need a CFO?");
add("thinking_quality", "First Principles", "confidence",
  "From first principles, why are you actually qualified for the role you want?",
  "From first principles, why should the board trust your judgment over the consensus?");
add("thinking_quality", "First Principles", "thinking_on_the_spot",
  "On the spot, reason from first principles about whether the company should pivot.",
  "Reason from first principles, live, about whether the new hire should be promoted.",
  "On the spot, reason from first principles about whether to take the offer in front of you.");
add("thinking_quality", "First Principles", "giving_feedback",
  "From first principles, what does 'good performance' mean for this report?",
  "From first principles, what does coaching even do for an underperforming peer?",
  "From first principles, what makes feedback useful versus theatrical?");
add("thinking_quality", "First Principles", "negotiation",
  "From first principles, what is salary actually compensating for?",
  "From first principles, what does a contract actually exist to do?",
  "From first principles, what should a partnership agreement protect against?");
add("thinking_quality", "First Principles", "presenting",
  "From first principles, what is a town hall actually for?",
  "From first principles, what does a board presentation need to deliver to be worth the time?",
  "From first principles, what makes a keynote work?");
add("thinking_quality", "First Principles", "persuasion",
  "From first principles, why does persuasion work at all?",
  "From first principles, what does it take to actually change a peer's mind?",
  "From first principles, what does an investor pitch need to do?");
add("thinking_quality", "First Principles", "storytelling",
  "From first principles, why do humans need stories at work?",
  "From first principles, what makes a founding story actually useful versus theatrical?",
  "From first principles, why do leaders tell stories instead of presenting data?");
add("thinking_quality", "First Principles", "asking_questions",
  "From first principles, what is an interview actually trying to measure?",
  "From first principles, what is user research actually for?",
  "From first principles, what does the board actually need from a Q&A session?");

// Name the Assumption (thinking_quality)
add("thinking_quality", "Name the Assumption", "explaining",
  "Explain your strategy and name the load-bearing assumption underneath it.",
  "Explain the rebrand and name the assumption it depends on.",
  "Explain the new operating model and name the assumption that could break it.");
add("thinking_quality", "Name the Assumption", "handling_objections",
  "Respond to the board's pushback by naming the assumption you and they disagree on.",
  "Reply to a customer's complaint by naming the assumption behind their frustration.",
  "Respond to the press by naming the assumption built into their question.");
add("thinking_quality", "Name the Assumption", "confidence",
  "State why you're the right hire and name the assumption your case rests on.",
  "Defend your readiness for the role and name the assumption that could break it.",
  "Make the case for the C-suite role and name the assumption the board hasn't tested.");
add("thinking_quality", "Name the Assumption", "thinking_on_the_spot",
  "On the spot, name the assumption inside the unexpected question.",
  "Respond to a panel question by surfacing the assumption that frames it.",
  "Reply to a hostile reporter by naming the assumption their question depends on.");
add("thinking_quality", "Name the Assumption", "giving_feedback",
  "Deliver feedback by naming the assumption your direct report is operating on.");
add("thinking_quality", "Name the Assumption", "negotiation",
  "Open the negotiation by naming the assumption the other side is making.",
  "Make your salary ask by naming the assumption the recruiter is built around.",
  "Open the partnership negotiation by naming the assumption underneath their first offer.");
add("thinking_quality", "Name the Assumption", "presenting",
  "Open the all-hands by naming the assumption that drove the strategy change.",
  "Present the board deck by naming the assumption every recommendation rests on.",
  "Open the keynote by naming the assumption your industry refuses to question.");
add("thinking_quality", "Name the Assumption", "storytelling",
  "Tell the project story by naming the assumption that nearly killed it.",
  "Tell the founding story by naming the assumption the founder was operating on.",
  "Tell a customer story by naming the assumption that turned out to be wrong.");
add("thinking_quality", "Name the Assumption", "asking_questions",
  "Ask a candidate a question that surfaces their core assumption about the work.",
  "Ask a user a question that surfaces the assumption built into their feedback.",
  "Ask the founder a question that surfaces the assumption underneath their strategy.");

// Order of Magnitude (thinking_quality)
add("thinking_quality", "Order of Magnitude", "explaining",
  "Explain order-of-magnitude how much your team's last project actually cost.",
  "Explain order-of-magnitude the size of the market your company is going after.",
  "Explain order-of-magnitude the cost of the regulatory exposure if things go wrong.");
add("thinking_quality", "Order of Magnitude", "handling_objections",
  "Defend the budget request with order-of-magnitude reasoning when the board pushes back.",
  "Defend the hiring plan with order-of-magnitude logic to a skeptical CFO.",
  "Defend the partnership at the board with order-of-magnitude framing of the upside.");
add("thinking_quality", "Order of Magnitude", "confidence",
  "Reason order-of-magnitude through your own readiness for the role you want.",
  "Use order-of-magnitude framing to argue why you should be CEO.",
  "Use order-of-magnitude reasoning to defend your career bet to your spouse or partner.");
add("thinking_quality", "Order of Magnitude", "giving_feedback",
  "Give your direct report order-of-magnitude feedback on the gap between current and expected.",
  "Tell your peer order-of-magnitude how much their behavior is costing the team.",
  "Tell a senior exec order-of-magnitude how much their meeting cadence is costing the org.");
add("thinking_quality", "Order of Magnitude", "negotiation",
  "Reason order-of-magnitude through your salary expectation versus the offer.",
  "Reason order-of-magnitude through the value at stake in a vendor negotiation.",
  "Reason order-of-magnitude through the partnership deal in front of you.");
add("thinking_quality", "Order of Magnitude", "presenting",
  "Open the all-hands with an order-of-magnitude framing of the year.",
  "Open the board deck with order-of-magnitude framing of the market opportunity.",
  "Open the keynote with order-of-magnitude framing of the problem the industry is facing.");
add("thinking_quality", "Order of Magnitude", "persuasion",
  "Pitch a customer with order-of-magnitude framing of the value.",
  "Pitch a peer on the project with order-of-magnitude framing of the upside.",
  "Pitch an investor with order-of-magnitude framing of the market.");
add("thinking_quality", "Order of Magnitude", "storytelling",
  "Tell a story whose punchline is order-of-magnitude impact.",
  "Tell the founding story whose climax is an order-of-magnitude bet.",
  "Tell a customer story whose moral is an order-of-magnitude shift.");
add("thinking_quality", "Order of Magnitude", "asking_questions",
  "Ask a candidate an order-of-magnitude question to test their judgment.",
  "Ask a user an order-of-magnitude question to surface what they actually value.",
  "Ask the founder an order-of-magnitude question to test whether the strategy is real.");

// The Claim and Proof (thinking_quality)
add("thinking_quality", "The Claim and Proof", "explaining",
  "Claim: your team is the most reliable in the org. Prove it with two pieces of evidence.",
  "Claim: the rebrand is working. Prove it with specifics, not vibes.",
  "Claim: the new operating model is more efficient. Prove it on the spot.");
add("thinking_quality", "The Claim and Proof", "handling_objections",
  "Claim: the layoff was necessary. Prove it to the all-hands.",
  "Claim: the price increase is fair. Prove it to a churning customer.",
  "Claim: the merger created value. Prove it to a hostile board member.");
add("thinking_quality", "The Claim and Proof", "thinking_on_the_spot",
  "Claim something true about your team on the spot, and prove it with one example.",
  "Make a claim about the company's strategy live, and back it with evidence in real time.",
  "Make a claim under press scrutiny, and prove it with the facts in your head.");
add("thinking_quality", "The Claim and Proof", "negotiation",
  "Claim your salary number is fair. Prove it with market data.",
  "Claim your vendor terms are below market. Prove it without showing your cards.",
  "Claim the partnership is asymmetric. Prove it in a board-level renegotiation.");
add("thinking_quality", "The Claim and Proof", "presenting",
  "Open the all-hands with a claim, then prove it with one number.",
  "Open the board deck with a claim, then back it with two pieces of evidence.",
  "Open the keynote with a claim, then prove it with a story and a number.");
add("thinking_quality", "The Claim and Proof", "storytelling",
  "Tell a story that opens with a claim and ends with the proof.",
  "Tell the founding story whose claim is what the founder believed and whose proof is the present.",
  "Tell a customer story whose claim is impact and whose proof is the customer's words.");
add("thinking_quality", "The Claim and Proof", "asking_questions",
  "Ask a candidate to make a claim and prove it inside the interview.",
  "Ask a user to make a claim about their workflow and prove it with their actual behavior.",
  "Ask the founder a claim-and-proof question in front of the board.");

// The Perspective Shift (thinking_quality)
add("thinking_quality", "The Perspective Shift", "explaining",
  "Explain the new strategy from the perspective of the customer it most affects.",
  "Explain the rebrand from the perspective of the longest-tenured employee.",
  "Explain the new compliance regime from the perspective of the regulator.");
add("thinking_quality", "The Perspective Shift", "confidence",
  "Defend your candidacy from the perspective of the board member most skeptical of you.",
  "Defend your readiness from the perspective of the panel's hardest interviewer.",
  "Defend your case for the C-suite role from the perspective of the activist investor.");
add("thinking_quality", "The Perspective Shift", "giving_feedback",
  "Deliver feedback from your direct report's perspective, then from yours.",
  "Deliver peer feedback from the perspective of the person who hired them.");
add("thinking_quality", "The Perspective Shift", "negotiation",
  "Open the negotiation from the other side's perspective, then state your terms.");
add("thinking_quality", "The Perspective Shift", "presenting",
  "Present the strategy from the perspective of the front-line team affected.",
  "Present quarterly results from the perspective of the most skeptical board member.",
  "Open the keynote from the perspective of the customer whose life you're trying to change.");
add("thinking_quality", "The Perspective Shift", "persuasion",
  "Pitch the customer from their perspective first, then make your ask.",
  "Persuade a peer from their perspective first, then offer your case.",
  "Pitch the investor from their LPs' perspective, then make the case.");
add("thinking_quality", "The Perspective Shift", "storytelling",
  "Tell the project story from the perspective of the person who almost killed it.",
  "Tell the founding story from the perspective of the first employee.",
  "Tell a customer story from the perspective of the customer's customer.");
add("thinking_quality", "The Perspective Shift", "asking_questions",
  "Ask a candidate a question from the perspective of their last manager.",
  "Ask a user a question from the perspective of someone who would never buy your product.",
  "Ask the founder a question from the perspective of an employee who's about to quit.");

// The So What Test (thinking_quality)
add("thinking_quality", "The So What Test", "handling_objections",
  "Respond to a critic's claim that the launch failed, with 'so what?' answered cleanly.",
  "Respond to a customer's churn email by answering the 'so what?' for them and for you.",
  "Respond to the press accusation by answering the 'so what?' that matters to readers.");
add("thinking_quality", "The So What Test", "confidence",
  "Make the case for your candidacy and answer 'so what?' for the board.",
  "Defend your readiness and answer 'so what does this mean for them?'",
  "Pitch yourself for the C-suite role and answer 'so what?' for the activist investor.");
add("thinking_quality", "The So What Test", "thinking_on_the_spot",
  "Field a question and answer 'so what?' on the spot.",
  "Take the unexpected board question and run the 'so what?' test live.",
  "Take the hostile reporter's framing and answer the underlying 'so what?' directly.");
add("thinking_quality", "The So What Test", "giving_feedback",
  "Give a direct report feedback that answers 'so what should I do differently?'",
  "Give a peer feedback that answers 'so what does this cost the team?'",
  "Give your manager feedback that answers 'so what should you change Monday?'");
add("thinking_quality", "The So What Test", "negotiation",
  "Open the negotiation by answering 'so what does this matter to you?' for the other side.",
  "Make your salary ask and answer 'so what should the company care about?' upfront.",
  "Open the partnership negotiation by answering 'so what is at stake here?' for both sides.");
add("thinking_quality", "The So What Test", "persuasion",
  "Pitch the customer by answering 'so what?' before they ask.",
  "Persuade a peer by leading with 'so what changes for you?'",
  "Pitch the investor by answering 'so what does this fund unlock?'");
add("thinking_quality", "The So What Test", "storytelling",
  "Tell a story and end on the 'so what?' that lands.",
  "Tell the founding story and end on the 'so what?' that explains the company today.",
  "Tell a customer story whose 'so what?' is the reason your team exists.");
add("thinking_quality", "The So What Test", "asking_questions",
  "Ask a candidate the 'so what?' follow-up that turns a fluffy answer into a real one.",
  "Ask a user the 'so what?' follow-up that converts a complaint into a feature decision.",
  "Ask the founder a 'so what?' question that forces them to defend the strategy in concrete terms.");

// The Steel Man (thinking_quality)
add("thinking_quality", "The Steel Man", "explaining",
  "Explain the strongest case for the strategy you privately disagree with.",
  "Explain the strongest case for the operating model you've been criticizing internally.",
  "Explain the strongest case for the compliance approach the company is taking, in plain words.");
add("thinking_quality", "The Steel Man", "confidence",
  "Steel man the case against your own promotion.",
  "Steel man the case for the candidate the board picked over you.",
  "Steel man the case that you're not actually ready for the C-suite role.");
add("thinking_quality", "The Steel Man", "giving_feedback",
  "Steel man your direct report's worst project before delivering feedback.",
  "Steel man a peer's tone in the all-hands chat before telling them to change it.");
add("thinking_quality", "The Steel Man", "negotiation",
  "Steel man the vendor's pricing before opening your counter.",
  "Steel man the recruiter's offer before making your counter ask.",
  "Steel man the activist investor's plan before opening the board negotiation.");
add("thinking_quality", "The Steel Man", "presenting",
  "Open the all-hands by steel-manning the most common employee objection.",
  "Open the board deck by steel-manning the case against your recommendation.");
add("thinking_quality", "The Steel Man", "persuasion",
  "Pitch a customer by first steel-manning their reason to walk away.",
  "Persuade a peer by first steel-manning the case for the path they're already on.",
  "Pitch an investor by steel-manning their reason to pass.");
add("thinking_quality", "The Steel Man", "storytelling",
  "Tell the founding story by first steel-manning the smart person who said it would fail.",
  "Tell a customer story by first steel-manning the customer who churned.",
  "Tell the launch story by first steel-manning the team member who voted against it.");
add("thinking_quality", "The Steel Man", "asking_questions",
  "Ask a candidate a question that requires them to steel man the opposing view.",
  "Ask a user a question that surfaces the case against your product.",
  "Ask the founder a question that requires them to steel man their critic.");

// ===== TONE =====

// Authority Voice (tone)
add("tone", "Authority Voice", "explaining",
  "Explain your team's structure with the authority of someone who built it.",
  "Explain the rebrand with the authority of someone who led it.",
  "Explain a regulatory finding to the board with the authority of someone who's seen this before.");
add("tone", "Authority Voice", "handling_objections",
  "Respond with authority when a board member challenges your data.",
  "Respond with authority when a customer escalates past your front line.",
  "Respond with authority when a journalist accuses your company of misleading customers.");
add("tone", "Authority Voice", "thinking_on_the_spot",
  "On the spot, deliver an authoritative answer to a question you didn't prepare for.",
  "Deliver an authoritative response live to an unexpected board question.",
  "Deliver an authoritative answer on stage when the moderator throws a curveball.");
add("tone", "Authority Voice", "giving_feedback",
  "Deliver feedback to a senior peer with the authority your title gives you.",
  "Tell a direct report the truth with the authority of someone who's accountable for them.",
  "Tell your manager their decision is wrong with the authority your tenure earns you.");
add("tone", "Authority Voice", "negotiation",
  "Open a salary negotiation with the authority of someone who knows their worth.",
  "Open a vendor negotiation with the authority of someone who controls the budget.",
  "Open a partnership negotiation with the authority of someone the board has empowered.");
add("tone", "Authority Voice", "storytelling",
  "Tell the founding story with the authority of someone who was there.",
  "Tell a customer story with the authority of someone who watched it happen.",
  "Tell the company's biggest crisis story with the authority of someone who led the response.");
add("tone", "Authority Voice", "asking_questions",
  "Ask a candidate questions with the authority your role gives you.",
  "Ask a customer questions in research with the authority of curiosity, not interrogation.",
  "Ask the founder questions at the all-hands with the authority of someone speaking for the team.");

// Conviction Floor (tone)
add("tone", "Conviction Floor", "explaining",
  "Explain the new strategy with conviction even when you have doubts.",
  "Explain the rebrand with conviction to the company even after a bad week.",
  "Explain the new operating model with conviction to the board after a tough quarter.");
add("tone", "Conviction Floor", "handling_objections",
  "Respond to a hostile board question with floor-of-conviction calm.",
  "Reply to a customer escalation with floor-of-conviction certainty about your team.",
  "Respond to a press accusation with floor-of-conviction language, not defensiveness.");
add("tone", "Conviction Floor", "thinking_on_the_spot",
  "On the spot, answer with conviction even when you're still working it out.",
  "Hold the conviction floor in your voice when a panel asks an unexpected question.",
  "Hold the conviction floor in a live press Q&A about a difficult company decision.");
add("tone", "Conviction Floor", "giving_feedback",
  "Deliver feedback with conviction-floor steadiness, not hesitation.",
  "Tell your peer the truth from the conviction floor — no upspeak.",
  "Tell your manager the team is unhappy from the conviction floor.");
add("tone", "Conviction Floor", "negotiation",
  "Make your salary ask from the conviction floor — no question mark at the end.",
  "Open the vendor negotiation from the conviction floor — no apologetic energy.",
  "Open a partnership negotiation from the conviction floor — no upspeak on the asks.");
add("tone", "Conviction Floor", "presenting",
  "Hold the conviction floor through the bad slide in your board deck.");
add("tone", "Conviction Floor", "storytelling",
  "Tell the project story from the conviction floor — no nervous laughter.",
  "Tell the founding story from the conviction floor — let the room feel you mean it.",
  "Tell a customer story from the conviction floor — no hedges, no upspeak.");
add("tone", "Conviction Floor", "asking_questions",
  "Ask the candidate questions from the conviction floor — no question mark in your delivery.",
  "Ask the user research participant questions from the conviction floor — they'll trust you more.",
  "Ask the founder questions at the AMA from the conviction floor.");

// Curiosity Lift (tone)
add("tone", "Curiosity Lift", "explaining",
  "Explain your team's approach with audible curiosity about what's still unknown.",
  "Explain a new strategy with the curiosity of someone still figuring it out.",
  "Explain the regulatory shift with curiosity, not certainty.");
add("tone", "Curiosity Lift", "handling_objections",
  "Respond to a customer complaint with curiosity, not defensiveness.",
  "Reply to a board member's pushback with audible curiosity about their view.",
  "Reply to the press with curiosity instead of practiced talking points.");
add("tone", "Curiosity Lift", "confidence",
  "Pitch yourself for the role with audible curiosity about the company.",
  "Defend your readiness with curiosity about what you'd still learn in the role.");
add("tone", "Curiosity Lift", "giving_feedback",
  "Give feedback with curiosity in your voice — 'what am I missing here?'",
  "Tell a peer the gap with curiosity, not certainty.",
  "Tell your manager the issue with curiosity about their view.");
add("tone", "Curiosity Lift", "negotiation",
  "Negotiate with curiosity in your voice about what the other side actually wants.",
  "Open the vendor talk with curiosity about their constraints.",
  "Open the partnership conversation with curiosity, not posturing.");
add("tone", "Curiosity Lift", "presenting",
  "Open the all-hands with audible curiosity about what's still unsolved.",
  "Present the board deck with curiosity in your voice, not certainty.",
  "Deliver the keynote with curiosity about where your industry goes next.");
add("tone", "Curiosity Lift", "persuasion",
  "Pitch a customer with curiosity about their world, not assertion.",
  "Persuade a peer with curiosity about why they're hesitating.",
  "Pitch an investor with audible curiosity about the market itself.");
add("tone", "Curiosity Lift", "storytelling",
  "Tell the project story with curiosity in your voice about why it surprised you.",
  "Tell the founding story with curiosity about what the founder didn't know.",
  "Tell a customer story with curiosity about what they did that you didn't expect.");

// Downward Landing (tone)
add("tone", "Downward Landing", "handling_objections",
  "Respond to a board member's challenge with sentences that land down, not up.",
  "Reply to a customer escalation with downward landings — sound steady, not anxious.",
  "Respond to a press question with downward landings, not upspeak.");
add("tone", "Downward Landing", "confidence",
  "Pitch yourself for the role with sentences that land down.",
  "Defend your readiness in the panel interview with downward landings.");
add("tone", "Downward Landing", "thinking_on_the_spot",
  "On the spot, deliver answers that land down even while you're still thinking.",
  "Land down on the answer to an unexpected board question.",
  "Land down on a panel answer even when the moderator throws a curveball.");
add("tone", "Downward Landing", "giving_feedback",
  "Deliver feedback with sentences that land down — no upspeak at the end of the sentence.",
  "Tell a peer the gap with downward landings — sounds like a fact, not a question.",
  "Tell your manager the truth with sentences that land down.");
add("tone", "Downward Landing", "negotiation",
  "Make your salary ask with sentences that land down — not raised in pitch.",
  "Open the vendor negotiation with downward landings.",
  "Open the partnership negotiation with downward landings on every line.");
add("tone", "Downward Landing", "persuasion",
  "Pitch the customer with sentences that land down on every claim.",
  "Persuade a peer with downward landings on every ask.",
  "Pitch an investor with downward landings on every milestone.");
add("tone", "Downward Landing", "storytelling",
  "Tell the project story with sentences that land down on the moments that mattered.",
  "Tell the founding story with downward landings on every claim.",
  "Tell a customer story with downward landings on the punchline.");
add("tone", "Downward Landing", "asking_questions",
  "Ask the candidate questions that land down — not lift up like a request.",
  "Ask user research questions that land down — they'll feel like real questions.",
  "Ask the founder questions at the AMA that land down, not soften into requests.");

// Pivot Tone (tone)
add("tone", "Pivot Tone", "handling_objections",
  "Pivot tone from defensive to confident mid-response when challenged on the data.",
  "Pivot tone from formal to warm when a customer escalates emotionally.",
  "Pivot tone from rehearsed to candid when a journalist's question goes deeper than expected.");
add("tone", "Pivot Tone", "confidence",
  "Pivot tone from polite to assertive mid-interview when the panel tests you.",
  "Pivot tone from peer to leader when the room shifts and you need to take charge.",
  "Pivot tone from analyst to executive when the board asks you to decide on the spot.");
add("tone", "Pivot Tone", "thinking_on_the_spot",
  "Pivot tone from light to serious mid-answer when the question gets real.",
  "Pivot tone from speculation to certainty when you land on the answer mid-thought.");
add("tone", "Pivot Tone", "giving_feedback",
  "Pivot tone from coaching to direct when you realize the report isn't hearing you.",
  "Pivot tone from peer to firm mid-feedback when a peer dismisses what you're saying.",
  "Pivot tone from deferential to clear when your manager isn't taking the issue seriously.");
add("tone", "Pivot Tone", "negotiation",
  "Pivot tone from collaborative to firm when the vendor crosses your walk-away line.",
  "Pivot tone from polite to direct when the recruiter starts negotiating against your interests.",
  "Pivot tone from cooperative to combative when the partnership negotiation turns hostile.");
add("tone", "Pivot Tone", "persuasion",
  "Pivot tone from rational to emotional mid-pitch when you sense the customer is moved.",
  "Pivot tone from data to story mid-presentation when the room needs a beat.",
  "Pivot tone from professional to personal mid-investor pitch when you're closing.");
add("tone", "Pivot Tone", "storytelling",
  "Pivot tone from observer to participant mid-story when the moment becomes yours.",
  "Pivot tone from light to heavy mid-founding story when the stakes land.",
  "Pivot tone from formal to intimate mid-keynote story to bring the room with you.");
add("tone", "Pivot Tone", "asking_questions",
  "Pivot tone from warm to probing mid-interview when a candidate gives a rehearsed answer.",
  "Pivot tone from open to focused mid-user-session when you hit the real insight.",
  "Pivot tone from polite to insistent mid-Q&A when the founder dodges.");

// Read the Room (tone)
add("tone", "Read the Room", "explaining",
  "Explain your team's strategy to a room that came in skeptical.");
add("tone", "Read the Room", "handling_objections",
  "Respond to objections from a board where two members already side with you.",
  "Respond to a customer escalation when you can hear they're at the end of their patience.");
add("tone", "Read the Room", "confidence",
  "Pitch yourself for the role to a panel that's running 30 minutes late.",
  "Defend your candidacy in a board interview where one member is openly hostile.");
add("tone", "Read the Room", "thinking_on_the_spot",
  "On the spot, read the room and answer the question they're asking, not the one in front of you.",
  "Read the panel mid-answer and pivot to what they actually need to hear.",
  "Read a hostile press room and shift mid-answer to defuse the temperature.");
add("tone", "Read the Room", "giving_feedback",
  "Give a direct report feedback after reading their mood — they're already on the edge.",
  "Give a peer hard feedback after reading they came in defensive.",
  "Give your manager feedback after reading they're under pressure from above.");
add("tone", "Read the Room", "negotiation",
  "Open a salary negotiation after reading the recruiter's tone in the first 30 seconds.",
  "Open a vendor negotiation after reading how desperate the other side actually is.",
  "Open a partnership negotiation after reading whether the room wants a deal or wants out.");
add("tone", "Read the Room", "persuasion",
  "Pitch a customer after reading they came in resistant.");
add("tone", "Read the Room", "storytelling",
  "Tell the founding story to a room that's heard versions of it before.");
add("tone", "Read the Room", "asking_questions",
  "Ask a candidate a follow-up after reading whether they're confident or rattled.",
  "Ask a user research participant a question after reading whether they're guarded or open.",
  "Ask the founder a question at the AMA after reading whether the room wants courage or caution.");

// The Monotone Breaker (tone)
add("tone", "The Monotone Breaker", "handling_objections",
  "Break monotone while defending the budget request under board pressure.",
  "Break monotone while responding to a customer escalation that wants to be heard.",
  "Break monotone while answering a press question on a live broadcast.");
add("tone", "The Monotone Breaker", "confidence",
  "Break monotone while pitching yourself for the senior IC role.",
  "Break monotone while defending your candidacy in a panel interview.",
  "Break monotone while pitching yourself to the board for the CEO role.");
add("tone", "The Monotone Breaker", "thinking_on_the_spot",
  "On the spot, break monotone mid-answer when the room is drifting.",
  "Break monotone live on stage when the moderator gives you a curveball.");
add("tone", "The Monotone Breaker", "giving_feedback",
  "Break monotone while delivering hard feedback — let the gravity vary by sentence.",
  "Break monotone while giving a peer review — vary tone across each section.",
  "Break monotone while telling your manager the team is unhappy.");
add("tone", "The Monotone Breaker", "negotiation",
  "Break monotone across a long salary negotiation.",
  "Break monotone across a multi-hour vendor renewal negotiation.",
  "Break monotone across a complex partnership negotiation.");
add("tone", "The Monotone Breaker", "persuasion",
  "Break monotone across the customer pitch.",
  "Break monotone across a peer-to-peer persuasion conversation.",
  "Break monotone across a 30-minute fundraising pitch.");
add("tone", "The Monotone Breaker", "storytelling",
  "Break monotone across the founding story.",
  "Break monotone across a customer testimonial story.",
  "Break monotone across the keynote story.");
add("tone", "The Monotone Breaker", "asking_questions",
  "Break monotone across a candidate interview — vary tone by question.",
  "Break monotone across a user research session — vary energy by question.",
  "Break monotone across a public Q&A with the founder.");

// Volume Dial (tone)
add("tone", "Volume Dial", "explaining",
  "Vary volume while explaining how your team works to a roomful of strangers.",
  "Vary volume while explaining the rebrand to the company.",
  "Vary volume while explaining the new regulatory regime to the board.");
add("tone", "Volume Dial", "handling_objections",
  "Dial volume up and down while defending the layoff at the all-hands.",
  "Dial volume up and down while responding to a hostile customer.",
  "Dial volume up and down while answering a press accusation live.");
add("tone", "Volume Dial", "confidence",
  "Dial volume while pitching yourself for the role.",
  "Dial volume while defending your candidacy under pressure.",
  "Dial volume while pitching yourself for the CEO role to the board.");
add("tone", "Volume Dial", "thinking_on_the_spot",
  "Dial volume mid-answer to mark when you've landed on the real point.",
  "Dial volume live on stage when the moderator gives you a curveball.",
  "Dial volume live in a press conference to mark the moment that matters.");
add("tone", "Volume Dial", "giving_feedback",
  "Dial volume across a hard 1:1 to mark where the actual feedback is.",
  "Dial volume mid-peer-conversation to make the request unmissable.",
  "Dial volume mid-manager-conversation to make the issue land.");
add("tone", "Volume Dial", "negotiation",
  "Dial volume across a salary negotiation to mark your final number.",
  "Dial volume across a vendor negotiation to mark non-negotiables.",
  "Dial volume across a partnership negotiation to mark walk-away lines.");
add("tone", "Volume Dial", "presenting",
  "Dial volume across the all-hands to land the headline.");
add("tone", "Volume Dial", "asking_questions",
  "Dial volume on the question that matters most in a candidate interview.",
  "Dial volume on the key question in a user research session.",
  "Dial volume on the question that matters most when questioning the founder publicly.");

// Warmth Switch (tone)
add("tone", "Warmth Switch", "handling_objections",
  "Switch warmth on while defending a controversial reorg.",
  "Switch warmth on while answering a customer escalation.",
  "Switch warmth on while responding to a hostile journalist about layoffs.");
add("tone", "Warmth Switch", "confidence",
  "Pitch yourself for the role with warmth turned up.",
  "Defend your candidacy with warmth alongside the conviction.",
  "Pitch yourself for the CEO role with warmth that the board can feel.");
add("tone", "Warmth Switch", "thinking_on_the_spot",
  "On the spot, switch warmth on while delivering an answer you weren't ready for.",
  "Switch warmth on live in a panel Q&A when the moderator throws a personal question.",
  "Switch warmth on live in a press conference to defuse a hostile question.");
add("tone", "Warmth Switch", "giving_feedback",
  "Deliver hard feedback with warmth alongside it — not cold, not soft.",
  "Tell a peer the truth with warmth that doesn't dilute it.",
  "Tell your manager the team is unhappy with warmth that doesn't lose the point.");
add("tone", "Warmth Switch", "negotiation",
  "Open the salary negotiation with warmth in your voice.",
  "Open the vendor negotiation with warmth alongside the firmness.",
  "Open a partnership negotiation with warmth that the other side can feel.");
add("tone", "Warmth Switch", "persuasion",
  "Pitch the customer with warmth alongside the case.");
add("tone", "Warmth Switch", "asking_questions",
  "Ask a candidate the hard question with warmth in your voice.",
  "Ask the user research participant with warmth that makes them open up.",
  "Ask the founder a hard question at the AMA with warmth that doesn't soften the point.");

// ===== MISSING BANK ENTRIES (filling specific gaps from generation pass 1) =====

add("conciseness", "Kill the Filler", "presenting",
  "Open the all-hands without one verbal hedge or pad word.",
  "Deliver the board update with zero filler words throughout.",
  "Deliver a keynote without one 'um,' 'so,' or 'you know.'");
add("conciseness", "Kill the Filler", "persuasion",
  "Pitch the customer on the upgrade without one filler word.",
  "Persuade a peer to join the cross-functional project without one verbal hedge.",
  "Pitch the investor with zero filler words across the full ask.");
add("conciseness", "No Hedging", "giving_feedback",
  "Tell your direct report exactly where they fell short — no hedges.",
  "Tell a peer their work is below the bar with no softening.",
  "Tell your manager their decision is costing the team — no qualifiers.");
add("conciseness", "One Idea Per Response", "persuasion",
  "Pitch the customer the renewal one idea at a time, not stacked.");
add("pacing", "Beat the Buzzer", "persuasion",
  "60 seconds: pitch a customer on switching tiers.",
  "30 seconds: pitch a board member on backing your initiative.",
  "45 seconds: pitch an investor on the seed round in the elevator.");
add("pacing", "Silence Over Filler", "thinking_on_the_spot",
  "Field an unexpected board question using silence to think, not 'um.'");
add("pacing", "Strategic Pause", "confidence",
  "Pause before stating your number in the salary negotiation interview.");
add("pacing", "Strategic Pause", "persuasion",
  "Pause before the close in your customer pitch.");
add("pacing", "Tempo Shift", "persuasion",
  "Speed up through history, slow down on the offer, in the customer pitch.",
  "Race through context, slow down on the ask, in the fundraising pitch.",
  "Race through warm-up, slow down on the close, in a peer-to-peer ask.");
add("pacing", "Tempo Shift", "storytelling",
  "Race through setup of your career story, slow down on the moment it changed.",
  "Race through the founding history, slow down on the inflection point.",
  "Race through prologue of your customer story, slow down on the resolution.");
add("pacing", "Two-Beat Landing", "confidence",
  "State your value at the panel interview, then two beats — let the room sit with it.");
add("pacing", "Two-Beat Landing", "presenting",
  "End the all-hands on the headline, then two beats before walking off.");
add("structure", "Bottom Line First", "confidence",
  "Bottom-line first: open the panel interview with why you'll get the offer.",
  "Bottom-line first: state your conviction about the new role before any context.",
  "Bottom-line first: pitch the board on your CEO candidacy with the verdict on line one.");
add("structure", "Bottom Line First", "giving_feedback",
  "Bottom-line first: open a peer review with the verdict, not the analysis.",
  "Bottom-line first: open a coaching conversation with the change needed.",
  "Bottom-line first: open a year-end review with the rating before the rationale.");
add("structure", "Compare and Contrast", "giving_feedback",
  "Your direct report's first half of the year vs the second — frame the year-end feedback.");
add("structure", "Monroe's Motivated Sequence", "presenting",
  "Use Monroe's sequence to deliver the board presentation that lands on a decision.",
  "Use Monroe's sequence to deliver the strategy keynote at the company offsite.");
add("structure", "The Story Arc", "giving_feedback",
  "Use a story arc to deliver year-end feedback to a senior peer.",
  "Use a story arc to walk your direct report through a year of growth and gaps.");
add("structure", "The Story Arc", "presenting",
  "Use a story arc to deliver the company-wide strategy update at the all-hands.",
  "Use a story arc as the spine of the keynote.");
add("thinking_quality", "Name the Assumption", "giving_feedback",
  "Give peer feedback by naming the assumption they're operating on without realizing it.",
  "Tell your manager their decision rests on a load-bearing assumption — name it.");
add("thinking_quality", "The Claim and Proof", "giving_feedback",
  "Deliver year-end feedback as claim and proof: 'this pattern, this evidence, this change.'");
add("thinking_quality", "The Perspective Shift", "negotiation",
  "Make your salary ask from the recruiter's perspective first, then your own.",
  "Open a vendor renegotiation from the vendor's CFO perspective, then state your terms.");
add("thinking_quality", "The Steel Man", "handling_objections",
  "Steel man your critic's strongest objection before responding at the all-hands.");
add("tone", "Authority Voice", "persuasion",
  "Pitch the new initiative to the board with the authority of someone who's already started it.");
add("tone", "Conviction Floor", "presenting",
  "Hold the conviction floor through the all-hands after a tough quarter.",
  "Hold the conviction floor through the board presentation after a missed forecast.");
add("tone", "Downward Landing", "presenting",
  "Deliver the all-hands with downward landings on every key claim.");
add("tone", "Read the Room", "persuasion",
  "Pitch the customer after reading they came in resistant — adjust your opening live.",
  "Pitch the investor after reading whether they're warming up or already checked out.");
add("tone", "Read the Room", "storytelling",
  "Tell the founding story to a room that's heard versions of it before — adjust the framing.",
  "Tell a customer story at a sales kickoff after reading whether the room wants drama or data.");
add("tone", "Volume Dial", "presenting",
  "Dial volume across the all-hands to land the headline cleanly.",
  "Dial volume across the board presentation to mark the moments that matter most.");
add("tone", "Volume Dial", "persuasion",
  "Dial volume across the customer pitch to mark the moments that matter.");
add("tone", "Warmth Switch", "persuasion",
  "Pitch a peer with warmth that doesn't dilute the urgency of your ask.",
  "Pitch a customer with warmth that makes the upgrade feel like a partnership, not a sale.");
add("tone", "Warmth Switch", "storytelling",
  "Tell a customer story with warmth turned up where the human moment lives.");

// =============================================================================
// GENERATION
// =============================================================================

let totalNew = 0;
let gapsFilled = 0;
const unfilled = [];
const diffCount = { intro: 0, core: 0, stretch: 0 };

for (const ex of gaps.exercises) {
  const catExercise = catIndex.get(catKey(ex.dimension, ex.exerciseName));
  if (!catExercise) {
    unfilled.push(`MISSING_CATALOG: ${ex.dimension}::${ex.exerciseName}`);
    continue;
  }
  for (const g of ex.gaps) {
    const key = `${ex.dimension}::${ex.exerciseName}::${g.goal}`;
    const fn = bank[key];
    if (!fn) {
      unfilled.push(`MISSING_BANK: ${key} (need ${g.need})`);
      continue;
    }
    const allPrompts = fn();
    // We must use exactly g.need prompts following the difficulty mix.
    const targetMix = difficultyMix(g.need);
    // From allPrompts (which always has intro/core/stretch in order), pick to match mix.
    const picked = [];
    const used = new Set();
    for (const d of targetMix) {
      let idx = allPrompts.findIndex((p, i) => p.difficulty === d && !used.has(i));
      if (idx === -1) {
        // Fallback: take any unused prompt regardless of difficulty.
        idx = allPrompts.findIndex((p, i) => !used.has(i));
      }
      if (idx === -1) {
        unfilled.push(`OUT_OF_PROMPTS: ${key} need=${d}`);
        continue;
      }
      used.add(idx);
      picked.push(allPrompts[idx]);
    }
    for (const p of picked) {
      if (!p || !p.text) {
        unfilled.push(`UNDEFINED_PROMPT: ${key}`);
        continue;
      }
      if (p.text.length > 220) {
        unfilled.push(`TOO_LONG: ${key} :: ${p.text.length}ch :: ${p.text}`);
        continue;
      }
      if (allTexts.has(p.text)) {
        unfilled.push(`DUPLICATE: ${key} :: ${p.text}`);
        continue;
      }
      allTexts.add(p.text);
      catExercise.prompts.push({
        text: p.text,
        difficulty: p.difficulty,
        tags: ["other", g.goal],
      });
      totalNew++;
      diffCount[p.difficulty]++;
    }
    gapsFilled++;
  }
}

console.log("UNFILLED DETAILS:");
unfilled.forEach(u => console.log("  " + u));
fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2));
console.log(JSON.stringify({
  totalGapsDeclared: gaps.totalGaps,
  gapsFilled,
  totalNewPrompts: totalNew,
  difficultyDistribution: diffCount,
  unfilledCount: unfilled.length,
  unfilledSample: unfilled.slice(0, 20),
}, null, 2));
