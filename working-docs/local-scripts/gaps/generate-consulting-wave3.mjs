// Wave 3 gap-fill generator for "consulting" vertical.
// Authors exactly `need` fresh prompts per (exercise × goal) gap.
// Appends to catalog without touching existing prompts.

import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/MaxVolkov/dev/cognify";
const GAPS = path.join(ROOT, "scripts/gaps/consulting.json");
const CATALOG = path.join(ROOT, "scripts/exercise-catalog/v1/vertical/consulting.json");

const gaps = JSON.parse(fs.readFileSync(GAPS, "utf-8"));
const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf-8"));

const catKey = (d, n) => `${d}::${n}`;
const catIndex = new Map();
for (const ex of catalog.exercises) catIndex.set(catKey(ex.dimension, ex.name), ex);

const allTexts = new Set();
for (const ex of catalog.exercises) for (const p of ex.prompts) allTexts.add(p.text);

// =============================================================================
// CONSULTING SCENARIO POOL
// Each scenario: { who, where, what } — yields rich McKinsey-style situations.
// =============================================================================

// Goal-keyed scenario banks. Each scenario is a noun-phrase situation.
// We compose: <MECHANIC PREFIX> + <scenario> to produce a prompt.

const sc = {};

sc.explaining = [
  "the CFO asks why the diagnostic burned three weeks on data structuring",
  "a procurement lead wants to know what your fixed-fee includes beyond the deck",
  "the CIO challenges why the MSA spans 18 months instead of six",
  "the COO asks what 'change management' actually buys her in week two",
  "the client champion wants to brief her CEO on the operating model shift",
  "a steering committee member asks how the synergy number was sized",
  "a new associate asks why we ran a hypothesis tree before the kickoff",
  "the partner asks how you'd explain the recommendation to a board chair",
  "the audit committee wants the methodology behind the benchmarking sample",
  "a junior consultant asks what the SCQA framework adds beyond a normal slide flow",
  "the CHRO asks how the workforce model handles attrition assumptions",
  "the working-team lead wants to know what a Day-One plan actually covers",
  "the deputy CIO asks how the AI-readiness score was constructed",
  "a board observer asks why the issue tree has six branches instead of three",
  "your engagement manager asks how you'd explain the cost-to-serve model to a CFO",
  "a vendor partner asks how the procurement workstream interacts with the IT one",
  "the program director asks what 'no-regrets moves' means in execution terms",
  "the client analyst asks how the size-of-prize was triangulated",
  "the CMO asks why the pricing recommendation is laddered by segment",
  "the CFO asks what's behind the working capital improvement number",
];

sc.handling_objections = [
  "a CFO says your savings number is 'consultant math'",
  "the COO says the operating model 'won't survive contact with the field'",
  "a steering committee member says your benchmark sample is 'cherry-picked'",
  "the CIO says your AI roadmap is 'a slideware fantasy'",
  "the CEO says she's 'seen this deck three times from three firms'",
  "a procurement director says your fees 'don't match the value'",
  "the CHRO says your org redesign 'ignores how the place actually works'",
  "a board member says your recommendation is 'just the obvious answer dressed up'",
  "a champion says her peers will call your plan 'McKinsey theater'",
  "the deputy CFO says the synergy math 'double-counts'",
  "a skeptical SVP says your hypothesis tree 'starts from the wrong root'",
  "the CTO says your AI use case 'isn't actually generative AI'",
  "a client partner says your readout 'sounds like a sales pitch'",
  "the audit chair says the cost baseline 'doesn't tie to the GL'",
  "an MD on the buy-side says the diligence 'left the real risks on the table'",
  "a procurement lead says you're 'changing scope without a change order'",
  "the CFO says the implementation timeline 'has no slack'",
  "a steering committee member says your team 'doesn't understand the regulator'",
  "the COO says your savings 'will evaporate in year two'",
  "the client champion says the recommendation 'will get killed in the boardroom'",
];

sc.confidence = [
  "your partner asks if you can run the readout solo on Thursday",
  "the CFO calls and asks you to defend the savings number alone",
  "a steering committee member calls you mid-flight to challenge the timeline",
  "the CEO pulls you aside and asks if you actually believe the recommendation",
  "an MD asks why you should staff the next phase, not someone more senior",
  "a hostile board chair asks if your team is in over its head",
  "a procurement panel asks why your firm should keep the work",
  "the client champion asks if you can hold the room without your partner there",
  "your engagement manager asks if you're ready to own the C-suite relationship",
  "the COO asks why she should trust your model over her own gut",
  "the CIO interrupts your readout and asks who really built this",
  "the audit committee asks if you can defend the methodology under cross-exam",
  "a senior partner asks if you can run the next steering meeting",
  "the CHRO asks if you're senior enough to coach her exec team",
  "an analyst on the client side asks if you actually know the industry",
  "your partner asks if you can debate the CFO live on the synergy number",
  "the CEO asks if your hypothesis would survive a hostile board",
  "a private-equity sponsor asks if you can pitch the value-creation plan unaided",
  "the regulator asks if you're qualified to certify the operating model",
  "the client champion asks if you can replace her in front of her own CEO",
];

sc.thinking_on_the_spot = [
  "the CFO interrupts the readout to ask what happens if oil prices double",
  "the CEO asks what you would cut from the plan if she gave you 30 days",
  "a steering committee member asks for the number behind the chart you skipped",
  "the COO asks what the recommendation looks like at half the budget",
  "the CIO asks how the AI use case changes if procurement vetoes the vendor",
  "a board member asks what you would do differently if you were the CEO",
  "the audit chair asks for the source of the benchmark on slide 12",
  "the CHRO asks what attrition assumption breaks the workforce model",
  "the client champion asks what to say if her CEO challenges the timeline",
  "the CFO asks for the synergy number net of one-time costs in real time",
  "the COO asks which workstream slips first if Q2 launches late",
  "the CIO asks what 'AI-native' actually means in your recommendation",
  "the regulator asks how the model handles a downturn scenario",
  "the CEO asks what story she should tell the board about the cost cuts",
  "the CMO asks how pricing changes if the competitor drops their list price",
  "a procurement lead asks what your fee looks like if scope shrinks 20%",
  "the deputy CFO asks for the working capital number broken out by region",
  "the steering committee asks what your team would do if the CEO resigned",
  "the audit committee asks how the savings tie to the next quarter's forecast",
  "the CTO asks what the recommendation looks like in a build-vs-buy frame",
];

sc.giving_feedback = [
  "a junior consultant keeps over-engineering every slide",
  "a senior associate buries the recommendation under context",
  "an engagement manager loses the room every time the CFO pushes back",
  "a partner over-promises in the steering committee",
  "an analyst on your team can't translate model output into board language",
  "your peer keeps pitching solutions before defining the problem",
  "a new hire reads from her notes during the readout",
  "an associate uses jargon the client champion has flagged twice",
  "a manager is letting the client set the agenda for every meeting",
  "your counterpart on the client team avoids hard decisions in writing",
  "the analyst rewrites the deck instead of fixing the recommendation",
  "the senior associate runs five-hour working sessions with no decisions",
  "your partner cuts off the client mid-question in every steering meeting",
  "the engagement manager keeps asking the team to 'just make it nicer'",
  "the junior consultant pushed back on the partner in front of the CFO",
  "the associate told the COO the timeline was fine when it wasn't",
  "a new manager keeps escalating decisions she should be making",
  "your peer keeps using your hypothesis tree without crediting the team",
  "the senior consultant edits the deck after the partner has signed off",
  "the analyst's executive summary still doesn't say what to do",
];

sc.negotiation = [
  "procurement opens the MSA renewal asking for a 20% fee cut",
  "the CFO wants to convert hours to fixed fee mid-engagement",
  "the client champion wants to extend the diagnostic by two weeks at no charge",
  "a vendor partner asks you to brief their CEO before signing the SOW",
  "procurement asks you to drop the offshore rate card to onshore rates",
  "the CIO wants to add an AI pilot to the existing scope for free",
  "the COO wants the partner on-site three days a week, no rate change",
  "a new champion wants to renegotiate deliverables her predecessor agreed to",
  "the CFO wants to switch payment terms from net-30 to net-90",
  "procurement wants to bundle three workstreams under one fee cap",
  "the CHRO wants a five-week extension on the org redesign at the current price",
  "the CEO wants a results-based fee tied to first-year savings",
  "your partner wants you to push back on a scope cut without breaking the relationship",
  "the client wants to swap your lead partner for a more senior one without a fee change",
  "a vendor in your delivery model asks for a higher cut of the savings pool",
  "the deputy CFO wants quarterly true-ups built into the fee structure",
  "procurement wants benchmarking data shared as a condition of renewal",
  "the COO wants two free coaching sessions per month added to the SOW",
  "the audit chair wants the methodology IP transferred at end of engagement",
  "the client champion wants to delay the final invoice until the board approves",
];

sc.presenting = [
  "the readout to the steering committee starts in 10 minutes",
  "you're opening the board meeting on the operating model recommendation",
  "the CEO wants you to present the diagnostic findings at her town hall",
  "the working session opens with the CFO and her finance team",
  "you're presenting the AI roadmap to a hostile CIO and his architects",
  "the partner asks you to brief the audit committee on the cost baseline",
  "you're opening the procurement panel with the fee defense",
  "the keynote at the client offsite is yours to deliver",
  "you're presenting the workforce model to the CHRO and her HRBPs",
  "the readout to the private-equity sponsor is in your hands",
  "you're presenting the synergy plan to the integration steering committee",
  "the CEO wants you to brief her board chair before Friday's meeting",
  "you're opening the launch event for the transformation program",
  "the regulator wants a 30-minute walkthrough of the operating model",
  "you're presenting the AI use-case pipeline to the CTO and his leads",
  "the client champion asks you to brief her CEO one-on-one before the readout",
  "you're presenting the cost-to-serve findings to the COO and ops leads",
  "the board observer wants a private briefing on the recommendation",
  "you're opening the all-hands at the client to introduce the program",
  "the deputy CFO wants you to present the working capital plan to her treasury team",
];

sc.persuasion = [
  "the CFO is leaning against funding the AI workstream",
  "the COO wants to delay the operating model launch by a quarter",
  "the CEO is unconvinced the cost cuts will land",
  "the CIO is pushing for a build over the recommended buy",
  "the steering committee is split on the geographic rollout sequence",
  "the audit chair wants more proof before signing off on the methodology",
  "the CHRO is resisting the span-of-control changes",
  "a board member is championing a different firm's recommendation",
  "the procurement lead wants to delay the vendor consolidation",
  "the client champion needs ammunition to take to her CEO",
  "the deputy CFO wants to renegotiate the synergy targets downward",
  "the CMO is resisting the pricing model change",
  "a steering committee member wants the AI pilot delayed by six months",
  "the regulator wants a more conservative timeline",
  "the CTO wants to swap your reference architecture for an internal one",
  "the program director wants to keep the legacy PMO in place",
  "the partner wants the client to commit to phase two before phase one closes",
  "a board observer wants the recommendation watered down before the vote",
  "the new champion wants to relitigate the operating model design",
  "the CEO wants the savings pulled forward into the current fiscal year",
];

sc.storytelling = [
  "you're telling the story of the team that turned around the Asia-Pacific business in 18 months",
  "you're telling the story of the diagnostic that uncovered the synergy nobody had priced",
  "you're telling the story of the operating model launch that almost slipped and didn't",
  "you're telling the story of the AI pilot that went from skeptic territory to board agenda",
  "you're telling the story of the engagement that started in conflict and ended in an MSA",
  "you're telling the story of the working session where the CFO finally said yes",
  "you're telling the story of the readout that turned a hostile audit committee into champions",
  "you're telling the story of the cost transformation that survived two CEO changes",
  "you're telling the story of the integration that doubled the deal thesis in year one",
  "you're telling the story of the diligence that killed the bid and saved the sponsor a billion",
  "you're telling the story of the post-merger redesign that kept the talent that mattered",
  "you're telling the story of the AI roadmap that the CTO tried to bury before launch",
  "you're telling the story of the procurement reset that won back the client relationship",
  "you're telling the story of the diagnostic that found the answer in week one",
  "you're telling the change story the CHRO took to her field organization",
  "you're telling the story of the recommendation the board adopted after a tense first vote",
  "you're telling the story of the partner-led pitch that won the work with no leave-behind",
  "you're telling the story of the engagement that ended with a multi-year MSA",
  "you're telling the story of the steering meeting that decided the program in 20 minutes",
  "you're telling the story of the day the CEO called your partner to extend the work",
];

sc.asking_questions = [
  "the CFO keeps saying 'maybe' but never 'yes'",
  "the COO hasn't shown up to the last three working sessions",
  "the CIO agreed to the AI pilot then quietly defunded it",
  "the CEO deferred every decision to the board last quarter",
  "a steering committee member's silence is louder than the others' notes",
  "the client champion keeps asking for one more slide before deciding",
  "the procurement lead softened on fees the moment you mentioned timeline",
  "the audit chair circled back to slide 12 three times",
  "the CHRO said 'interesting' to the org redesign and changed the subject",
  "the deputy CFO keeps revisiting the synergy math after every meeting",
  "the partner keeps reframing the question instead of answering",
  "the board observer has been taking notes but never speaks",
  "the CTO agreed to the architecture but not the migration plan",
  "the CMO keeps asking for benchmarks you've already shared",
  "the regulator hasn't responded to the model walkthrough",
  "the program director wants weekly checkpoints suddenly",
  "the new champion is relitigating decisions her predecessor made",
  "the analyst on the client side keeps catching errors in the model",
  "the CEO asked for the recommendation in three words last week",
  "the audit committee chair's questions all start with 'walk me through'",
];

// =============================================================================
// EXERCISE MECHANICS
// Each entry: function(scenario, difficulty) -> prompt text.
// The mechanic shapes the *prompt language*; the scenario provides the context.
// =============================================================================

// Map exerciseName -> mechanic builder (takes scenario string + difficulty).
// Each builder returns a complete prompt sentence in McKinsey-style consulting voice.
// We design 2 distinct phrasings per (mechanic, difficulty) so we can produce
// 2 unique prompts when need=2 from the same scenario list (different scenarios).

const mech = {};

// --- CLARITY ---

mech["Answer the Confusion"] = (s, d) =>
  d === "intro" ? `Pin down what's really being asked when ${s}, then answer in one line.`
  : d === "core" ? `Untangle the real question when ${s}, name what they're conflating, and answer cleanly.`
  : `Cut through the noise when ${s} — surface the misread, name it, and respond on the record.`;

mech["Explain Like I'm 12"] = (s, d) =>
  d === "intro" ? `Explain it in plain words when ${s}, no jargon, no acronyms.`
  : d === "core" ? `Translate the consulting framework into plain language when ${s}.`
  : `Make it land in plain English when ${s}, even if the room expects a 40-slide deck.`;

mech["Headline First"] = (s, d) =>
  d === "intro" ? `Open with the headline when ${s}, then the rationale.`
  : d === "core" ? `Lead with the one-line headline when ${s} — verdict before evidence.`
  : `Open with a board-ready headline when ${s} and earn the right to keep talking.`;

mech["Make It Real"] = (s, d) =>
  d === "intro" ? `Ground the recommendation in a real example when ${s}.`
  : d === "core" ? `Replace the abstraction with a concrete client case when ${s}.`
  : `Make it tangible when ${s} — name the company, the number, the week it happened.`;

mech["No Jargon Allowed"] = (s, d) =>
  d === "intro" ? `Strip every consulting term out of your answer when ${s}.`
  : d === "core" ? `Answer without 'synergy', 'leverage', or 'optimize' when ${s}.`
  : `Answer in operator language when ${s} — zero buzzwords, zero hedges.`;

mech["One Point Only"] = (s, d) =>
  d === "intro" ? `Make one point and stop when ${s}.`
  : d === "core" ? `Pick the single most important point when ${s} and resist the urge to add a second.`
  : `Land one point only when ${s}, even if you have three you could make.`;

mech["Prove It"] = (s, d) =>
  d === "intro" ? `Back your claim with one piece of evidence when ${s}.`
  : d === "core" ? `Pair every assertion with a number, source, or case when ${s}.`
  : `Prove it cold when ${s} — claim, evidence, citation, in that order.`;

mech["The Analogy Bridge"] = (s, d) =>
  d === "intro" ? `Build a one-sentence analogy when ${s} to make the concept stick.`
  : d === "core" ? `Bridge to a familiar industry analogy when ${s} so the room actually gets it.`
  : `Use an analogy from outside their industry when ${s} to reframe the recommendation.`;

mech["The Word Budget"] = (s, d) =>
  d === "intro" ? `Answer in 30 words or fewer when ${s}.`
  : d === "core" ? `Cap your answer at two sentences when ${s} and still land the recommendation.`
  : `Stay under 50 words when ${s} — including the rationale.`;

// --- CONCISENESS ---

mech["Cut by Half"] = (s, d) =>
  d === "intro" ? `Say it in half the words when ${s}.`
  : d === "core" ? `Cut your draft answer in half when ${s} without losing the recommendation.`
  : `Halve the word count and double the punch when ${s}.`;

mech["Kill the Filler"] = (s, d) =>
  d === "intro" ? `Strip out 'kind of', 'sort of', 'basically' when ${s}.`
  : d === "core" ? `Drop every filler phrase when ${s} and answer in five seconds.`
  : `Eliminate every hedge and filler when ${s} — answer like the partner you'll be in three years.`;

mech["No Hedging"] = (s, d) =>
  d === "intro" ? `Answer without 'I think' or 'maybe' when ${s}.`
  : d === "core" ? `Strip every hedge when ${s} and commit to the recommendation.`
  : `No hedges, no qualifiers when ${s} — the room needs a position.`;

mech["No Throat Clearing"] = (s, d) =>
  d === "intro" ? `Start with the answer when ${s}, not the preamble.`
  : d === "core" ? `Skip the warm-up when ${s} — first sentence is the answer.`
  : `Cut the throat-clearing when ${s} and open with the verdict.`;

mech["One Idea Per Response"] = (s, d) =>
  d === "intro" ? `Land one idea when ${s} and stop.`
  : d === "core" ? `Hold yourself to one idea per answer when ${s} — pick the load-bearing one.`
  : `One idea, one sentence when ${s} — let it breathe before adding anything.`;

mech["Subject Verb Object"] = (s, d) =>
  d === "intro" ? `Use a clean subject-verb-object sentence when ${s}.`
  : d === "core" ? `Drop the qualifiers and use SVO when ${s} — name the actor, the action, the object.`
  : `Force every sentence into subject-verb-object when ${s}, even under cross-exam.`;

mech["The 30 Second Rule"] = (s, d) =>
  d === "intro" ? `Make the full answer fit in 30 seconds when ${s}.`
  : d === "core" ? `Land the recommendation in 30 seconds when ${s} — headline, why, what's next.`
  : `30-second answer when ${s} — and you'll get the next three minutes if it lands.`;

mech["The Hard Stop"] = (s, d) =>
  d === "intro" ? `Stop talking when you've made the point when ${s}.`
  : d === "core" ? `Hit the hard stop after the recommendation when ${s} — don't soften it.`
  : `Land the answer and stop cold when ${s} — let the silence do the work.`;

mech["The Single Sentence"] = (s, d) =>
  d === "intro" ? `Answer in one sentence when ${s}.`
  : d === "core" ? `Pack the recommendation into one sentence when ${s}.`
  : `Single sentence, full position when ${s} — no semicolons.`;

// --- PACING ---

mech["Beat the Buzzer"] = (s, d) =>
  d === "intro" ? `Land the full answer before the 60-second timer when ${s}.`
  : d === "core" ? `Get to the recommendation inside 90 seconds when ${s}.`
  : `Beat the partner's two-minute attention span when ${s} — land it fast and clean.`;

mech["Metronome"] = (s, d) =>
  d === "intro" ? `Hold a steady cadence when ${s} — don't speed up under pressure.`
  : d === "core" ? `Keep the metronome steady when ${s}, even as the CFO leans in.`
  : `Run the answer at a metronomic pace when ${s} — control the room with rhythm.`;

mech["Punctuation Breathing"] = (s, d) =>
  d === "intro" ? `Breathe at the punctuation when ${s} — period, breath, next sentence.`
  : d === "core" ? `Pace yourself with the punctuation when ${s}, especially through the recommendation.`
  : `Use punctuation as breath when ${s} — full stops carry the weight.`;

mech["Silence Over Filler"] = (s, d) =>
  d === "intro" ? `Hold the silence instead of filling it when ${s}.`
  : d === "core" ? `Let silence sit when ${s} — don't fill the gap after the question.`
  : `Use silence as a tool when ${s} — the room will lean in.`;

mech["Slow Cooker"] = (s, d) =>
  d === "intro" ? `Slow the delivery when ${s} so each clause lands.`
  : d === "core" ? `Drop the pace when ${s} — slower words carry more weight in the boardroom.`
  : `Slow the cadence deliberately when ${s} and let conviction do the work.`;

mech["Strategic Pause"] = (s, d) =>
  d === "intro" ? `Place a deliberate pause before the answer when ${s}.`
  : d === "core" ? `Use a strategic pause before the recommendation when ${s}.`
  : `Land a strategic pause right before the verdict when ${s} — make them lean in.`;

mech["Tempo Shift"] = (s, d) =>
  d === "intro" ? `Shift tempo when you hit the recommendation when ${s}.`
  : d === "core" ? `Vary tempo across the answer when ${s} — fast through context, slow through the verdict.`
  : `Use tempo shifts to mark what matters when ${s} — context fast, recommendation slow.`;

mech["The Stretch"] = (s, d) =>
  d === "intro" ? `Stretch out the key phrase when ${s} so it lands.`
  : d === "core" ? `Hold the key word longer than feels natural when ${s}.`
  : `Stretch the recommendation across a slow beat when ${s} — make it impossible to miss.`;

mech["Two-Beat Landing"] = (s, d) =>
  d === "intro" ? `End with a two-beat landing when ${s} — pause, restate.`
  : d === "core" ? `Close with a two-beat landing when ${s}: pause, then the headline.`
  : `Drive home a two-beat landing when ${s} — silence, headline, silence again.`;

// --- STRUCTURE ---

mech["Bottom Line First"] = (s, d) =>
  d === "intro" ? `Open with the bottom line when ${s}, then the rationale.`
  : d === "core" ? `Lead BLUF when ${s} — verdict in the first sentence.`
  : `Force the bottom line into sentence one when ${s}, no setup, no preamble.`;

mech["Compare and Contrast"] = (s, d) =>
  d === "intro" ? `Frame the answer as a clean compare-and-contrast when ${s}.`
  : d === "core" ? `Structure the response as 'option A vs option B' when ${s}.`
  : `Use a sharp compare-and-contrast when ${s} — same axes, same depth, both sides.`;

mech["Monroe's Motivated Sequence"] = (s, d) =>
  d === "intro" ? `Run Monroe's sequence — attention, need, satisfaction — when ${s}.`
  : d === "core" ? `Use Monroe's motivated sequence when ${s} to drive the room to a decision.`
  : `Apply Monroe's sequence in full when ${s}: attention, need, satisfaction, visualization, action.`;

mech["Question Then Answer"] = (s, d) =>
  d === "intro" ? `Pose the question, then answer it when ${s}.`
  : d === "core" ? `Frame your answer as 'the real question is X — here's the answer' when ${s}.`
  : `Restate the question sharper than they asked it when ${s}, then answer.`;

mech["Signpost First"] = (s, d) =>
  d === "intro" ? `Signpost the structure of your answer when ${s} — 'three things' before the three things.`
  : d === "core" ? `Open with the signpost when ${s} so the room can follow you.`
  : `Lead with a tight signpost when ${s} — 'two reasons, one ask' — then deliver.`;

mech["The 3 Point Rule"] = (s, d) =>
  d === "intro" ? `Structure the answer in three points when ${s}.`
  : d === "core" ? `Use the rule of three when ${s} — three reasons, three implications, three asks.`
  : `Land three points cleanly when ${s} — MECE, parallel, evidence-backed.`;

mech["The Problem Solution Frame"] = (s, d) =>
  d === "intro" ? `Frame it as problem then solution when ${s}.`
  : d === "core" ? `Use the problem-solution frame when ${s} — name the problem before the fix.`
  : `Use SCQA when ${s} — situation, complication, question, answer.`;

mech["The Story Arc"] = (s, d) =>
  d === "intro" ? `Tell it as a story arc when ${s} — beginning, turn, end.`
  : d === "core" ? `Frame the answer as a story arc when ${s} — setup, complication, resolution.`
  : `Use a story arc when ${s} — open with tension, close with the recommendation.`;

mech["Two Then One"] = (s, d) =>
  d === "intro" ? `Make two supporting points then land one big one when ${s}.`
  : d === "core" ? `Use two-then-one structure when ${s} — two reasons, then the recommendation.`
  : `Build with two-then-one when ${s} — two pieces of evidence, one verdict.`;

// --- THINKING QUALITY ---

mech["Disconfirm Yourself"] = (s, d) =>
  d === "intro" ? `Name what would prove you wrong when ${s}.`
  : d === "core" ? `Disconfirm your own recommendation when ${s} before they do it for you.`
  : `Lead with the disconfirming evidence when ${s} — earn the room's trust by naming the risks first.`;

mech["Draw the Line"] = (s, d) =>
  d === "intro" ? `Draw the line on what's in and what's out when ${s}.`
  : d === "core" ? `Define the boundary of your recommendation when ${s} — what you're not claiming matters too.`
  : `Draw the line clean when ${s} — say what's in scope, what's out, and why.`;

mech["First Principles"] = (s, d) =>
  d === "intro" ? `Reason from first principles when ${s} — strip the assumptions.`
  : d === "core" ? `Work from first principles when ${s}, not from how it's always been done.`
  : `Rebuild the answer from first principles when ${s} — ignore the industry's defaults.`;

mech["Name the Assumption"] = (s, d) =>
  d === "intro" ? `Name the load-bearing assumption when ${s}.`
  : d === "core" ? `Surface the assumption the room is making when ${s} and challenge it.`
  : `Name the assumption nobody's said out loud when ${s} — and stress-test it on the spot.`;

mech["Order of Magnitude"] = (s, d) =>
  d === "intro" ? `Size the answer by order of magnitude when ${s}.`
  : d === "core" ? `Lead with the order-of-magnitude estimate when ${s} — get the scale right before the digits.`
  : `Defend the order of magnitude when ${s} — even when the room wants false precision.`;

mech["The Claim and Proof"] = (s, d) =>
  d === "intro" ? `Open with the claim, follow with the proof when ${s}.`
  : d === "core" ? `Pair the claim and the proof tightly when ${s} — one sentence each.`
  : `Deliver claim-and-proof when ${s} — every assertion gets one anchor of evidence.`;

mech["The Perspective Shift"] = (s, d) =>
  d === "intro" ? `Answer from the CFO's perspective first when ${s}, then your own.`
  : d === "core" ? `Shift to the client's perspective when ${s} before stating the recommendation.`
  : `Run the perspective shift when ${s} — answer from the COO's seat, then the CEO's, then yours.`;

mech["The So What Test"] = (s, d) =>
  d === "intro" ? `Apply the so-what test when ${s} — strip everything that doesn't move the decision.`
  : d === "core" ? `Run the so-what test when ${s} on every line of your answer.`
  : `Pass the so-what test cold when ${s} — every sentence earns its place.`;

mech["The Steel Man"] = (s, d) =>
  d === "intro" ? `Steel-man the other side when ${s} before responding.`
  : d === "core" ? `Build the steel-man of the objection when ${s} and then dismantle it.`
  : `Present the steel-man so well when ${s} that they nod, then deliver your counter.`;

// --- TONE ---

mech["Authority Voice"] = (s, d) =>
  d === "intro" ? `Use authority voice when ${s} — lower, slower, definitive.`
  : d === "core" ? `Hold authority voice when ${s}, especially when the room pushes back.`
  : `Anchor in authority voice when ${s} — the kind that closes the question.`;

mech["Conviction Floor"] = (s, d) =>
  d === "intro" ? `Hold the conviction floor when ${s} — don't drop into hedging.`
  : d === "core" ? `Keep the conviction floor steady when ${s}, even as the CFO interrupts.`
  : `Hold the conviction floor through the whole answer when ${s} — no apologetic clauses.`;

mech["Curiosity Lift"] = (s, d) =>
  d === "intro" ? `Lift the tone with curiosity when ${s} — sound interested, not defensive.`
  : d === "core" ? `Bring curiosity into your answer when ${s} — invite the harder question.`
  : `Use curiosity to reframe the room when ${s} — turn the challenge into a working session.`;

mech["Downward Landing"] = (s, d) =>
  d === "intro" ? `Land each sentence downward when ${s} — closure, not question.`
  : d === "core" ? `Use downward landings on every claim when ${s} — no upward inflection.`
  : `Hit downward landings on every key sentence when ${s} — sound like the decision is made.`;

mech["Pivot Tone"] = (s, d) =>
  d === "intro" ? `Pivot tone when the topic shifts when ${s} — match the moment.`
  : d === "core" ? `Shift tone deliberately when ${s} — warm into challenge, firm into recommendation.`
  : `Pivot tone three times when ${s} — empathize, challenge, recommend.`;

mech["Read the Room"] = (s, d) =>
  d === "intro" ? `Read the room first when ${s}, then adjust your opening.`
  : d === "core" ? `Calibrate to the room when ${s} — match the energy before steering it.`
  : `Read the room and adjust mid-answer when ${s} — the recommendation doesn't change, the framing does.`;

mech["The Monotone Breaker"] = (s, d) =>
  d === "intro" ? `Break the monotone when ${s} — vary the pitch on the headline.`
  : d === "core" ? `Use a pitch break when ${s} to mark the recommendation.`
  : `Break the monotone hard when ${s} — make the verdict sound different from the setup.`;

mech["Volume Dial"] = (s, d) =>
  d === "intro" ? `Drop the volume when you hit the recommendation when ${s}.`
  : d === "core" ? `Dial the volume down on the verdict when ${s} — the room will lean in.`
  : `Use the volume dial deliberately when ${s} — louder on context, quieter on conviction.`;

mech["Warmth Switch"] = (s, d) =>
  d === "intro" ? `Switch to warmth before the hard message when ${s}.`
  : d === "core" ? `Use the warmth switch when ${s} — soften the delivery, sharpen the message.`
  : `Open with warmth when ${s} and close with steel — earn the right to be direct.`;

// =============================================================================
// GENERATION
// =============================================================================

// Target distribution ~30/50/20 (intro/core/stretch) across all authored prompts.
// For need=1: always core. For need=2: rotate through [core,intro], [core,stretch], [core,core]
// to push core toward 50% while intro and stretch take the remainder.
let need2Cursor = 0;
const need2Patterns = [
  ["core", "intro"],     // pattern A
  ["core", "stretch"],   // pattern B
  ["core", "intro"],     // pattern A again (intro slightly more than stretch)
  ["intro", "core"],     // pattern C
  ["stretch", "core"],   // pattern D
];
function difficultyMix(n) {
  if (n === 1) return ["core"];
  if (n === 2) {
    const pat = need2Patterns[need2Cursor % need2Patterns.length];
    need2Cursor++;
    return [...pat];
  }
  if (n === 3) return ["intro", "core", "stretch"];
  const out = [];
  const order = ["core", "intro", "core", "stretch"];
  for (let i = 0; i < n; i++) out.push(order[i % order.length]);
  return out;
}

let totalNew = 0;
let gapsFilled = 0;
const unfilled = [];
const diffCount = { intro: 0, core: 0, stretch: 0 };

// Per-(exercise,goal) scenario rotation so we don't reuse the same scenarios
// across multiple gaps for the same exercise.
const scenarioCursor = new Map(); // key: `${exerciseName}::${goal}` -> next index

for (const ex of gaps.exercises) {
  const catExercise = catIndex.get(catKey(ex.dimension, ex.exerciseName));
  if (!catExercise) {
    unfilled.push(`MISSING_CATALOG: ${ex.dimension}::${ex.exerciseName}`);
    continue;
  }
  const builder = mech[ex.exerciseName];
  if (!builder) {
    unfilled.push(`MISSING_MECHANIC: ${ex.exerciseName}`);
    continue;
  }
  for (const g of ex.gaps) {
    const pool = sc[g.goal];
    if (!pool) {
      unfilled.push(`MISSING_GOAL_POOL: ${g.goal}`);
      continue;
    }
    const cursorKey = `${ex.exerciseName}::${g.goal}`;
    let cursor = scenarioCursor.get(cursorKey) ?? 0;
    const targetMix = difficultyMix(g.need);
    let added = 0;
    let attempts = 0;
    const maxAttempts = pool.length * 3;
    for (const d of targetMix) {
      let prompt = null;
      while (attempts < maxAttempts) {
        const scenario = pool[cursor % pool.length];
        cursor++;
        attempts++;
        const text = builder(scenario, d);
        if (text.length > 220) continue;
        if (allTexts.has(text)) continue;
        prompt = { text, difficulty: d };
        break;
      }
      if (!prompt) {
        // Last-ditch: try every difficulty against every scenario
        outer: for (const altD of ["core", "intro", "stretch"]) {
          for (const scenario of pool) {
            const text = builder(scenario, altD);
            if (text.length > 220) continue;
            if (allTexts.has(text)) continue;
            prompt = { text, difficulty: d };
            break outer;
          }
        }
      }
      if (!prompt) {
        unfilled.push(`OUT_OF_SCENARIOS: ${ex.exerciseName}::${g.goal} (need=${d})`);
        continue;
      }
      allTexts.add(prompt.text);
      catExercise.prompts.push({
        text: prompt.text,
        difficulty: prompt.difficulty,
        tags: ["consulting", g.goal],
      });
      totalNew++;
      diffCount[prompt.difficulty]++;
      added++;
    }
    scenarioCursor.set(cursorKey, cursor);
    if (added === g.need) gapsFilled++;
    else unfilled.push(`PARTIAL: ${ex.exerciseName}::${g.goal} added=${added}/${g.need}`);
  }
}

fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2));

console.log(JSON.stringify({
  totalGapsDeclared: gaps.totalGaps,
  gapsFilled,
  totalNewPrompts: totalNew,
  difficultyDistribution: diffCount,
  unfilledCount: unfilled.length,
  unfilledSample: unfilled.slice(0, 20),
}, null, 2));
