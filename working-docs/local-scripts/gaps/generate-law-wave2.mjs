// Wave 2 gap-fill generator for law vertical.
// Authors 3 prompts per (exercise, goal) triple based on a library of scenario fragments
// tuned to the exercise's "shape" and the goal's communication purpose.
// Appends to scripts/exercise-catalog/v1/vertical/law.json. Preserves shape.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const GAPS = path.join(ROOT, 'scripts', 'gaps', 'law.json');
const CAT = path.join(ROOT, 'scripts', 'exercise-catalog', 'v1', 'vertical', 'law.json');

const gaps = JSON.parse(fs.readFileSync(GAPS, 'utf8'));
const cat = JSON.parse(fs.readFileSync(CAT, 'utf8'));

// Helper to make catalog lookup
const findExercise = (dim, name) => cat.exercises.find(e => e.dimension === dim && e.name === name);

// Track existing texts for dedupe
const existing = new Set();
for (const ex of cat.exercises) for (const p of ex.prompts) existing.add(p.text.trim());

// ----- Prompt library: one entry per (exerciseName, goal) -> array of {text, difficulty} -----
// Each entry has ≥3 prompts so we always have enough headroom.

const L = {}; // L[exerciseName][goal] = [{text, difficulty}, ...]
const add = (ex, goal, items) => {
  L[ex] = L[ex] || {};
  L[ex][goal] = items;
};

// ============================================================
// CLARITY exercises
// ============================================================

// Answer the Confusion — clarify a confused listener
add('Answer the Confusion', 'handling_objections', [
  { t: "Opposing counsel insists the privilege log is incomplete; show them why it isn't.", d: 'core' },
  { t: "The client thinks the protective order lets opposing counsel keep their financials forever. Correct it.", d: 'core' },
  { t: "Your associate believes the work-product doctrine doesn't cover trial-prep memos. Set them straight.", d: 'intro' },
]);
add('Answer the Confusion', 'confidence', [
  { t: "Tell a panicked client why their indictment doesn't mean they're going to prison Monday.", d: 'core' },
  { t: "Explain to a scared deponent why answering 'I don't recall' is not a lie and not a confession.", d: 'intro' },
  { t: "Walk a first-time CEO through why a regulatory subpoena is not the end of the company.", d: 'stretch' },
]);
add('Answer the Confusion', 'thinking_on_the_spot', [
  { t: "The judge asks mid-argument why your client missed the meet-and-confer. Clear it up now.", d: 'core' },
  { t: "Opposing counsel says your interrogatory responses contradict the deposition. Answer on the record.", d: 'core' },
  { t: "A juror sends out a note asking what 'preponderance of the evidence' means. Brief the court's response.", d: 'stretch' },
]);
add('Answer the Confusion', 'giving_feedback', [
  { t: "A junior associate confused issue preclusion with claim preclusion in the brief. Walk them through the fix.", d: 'core' },
  { t: "A paralegal misindexed two hot documents in the trial binder. Explain the cleanup without crushing them.", d: 'intro' },
  { t: "Your second-chair mishandled an objection sequence at deposition. Coach them before the next session.", d: 'core' },
]);
add('Answer the Confusion', 'negotiation', [
  { t: "Opposing counsel thinks your indemnity cap floats with revenue. Reset what the deal actually says.", d: 'core' },
  { t: "The buyer's GC thinks the materiality scrape applies to all reps. Clarify which reps it actually touches.", d: 'core' },
  { t: "Plaintiff's counsel claims your last offer included costs and fees. Correct it before the next call.", d: 'intro' },
]);
add('Answer the Confusion', 'presenting', [
  { t: "Halfway through your CLE on Daubert, half the room looks lost. Reset the framework in one minute.", d: 'core' },
  { t: "At the partner meeting your slide on contingent fee math confused the room. Untangle it live.", d: 'core' },
  { t: "Opening the deposition prep, the witness clearly doesn't understand the ground rules. Restart.", d: 'intro' },
]);
add('Answer the Confusion', 'persuasion', [
  { t: "A juror in voir dire thinks your client's silence equals guilt. Reframe before they're seated.", d: 'core' },
  { t: "A judge in chambers says your settlement structure looks collusive. Talk her off that read.", d: 'stretch' },
  { t: "The mediator thinks both sides are dug in on damages. Show why your number is actually flexible.", d: 'core' },
]);
add('Answer the Confusion', 'storytelling', [
  { t: "The jury can't follow the chain of three corporate entities. Retell it as one human transaction.", d: 'core' },
  { t: "Your client's family thinks the plea deal is a defeat. Reframe what the last six months actually achieved.", d: 'core' },
  { t: "The board doesn't understand why the deal slipped. Tell the story of the regulator's last letter.", d: 'intro' },
]);
add('Answer the Confusion', 'asking_questions', [
  { t: "The witness keeps misunderstanding 'when did you last review the document.' Restructure the question.", d: 'intro' },
  { t: "Opposing counsel objects to form three times in a row. Diagnose what's actually wrong and rephrase.", d: 'core' },
  { t: "The deponent answers a different question than the one you asked. Ask the actual question, plainly.", d: 'core' },
]);

// Explain Like I'm 12
add('Explain Like I\'m 12', 'handling_objections', [
  { t: "Your client thinks the protective order means opposing counsel can never use the documents. Correct that.", d: 'core' },
  { t: "Explain to your client why pushing back on the subpoena doesn't make them look guilty.", d: 'intro' },
  { t: "Explain to a frantic CFO why the indemnity carve-out is fair even though it sounds one-sided.", d: 'stretch' },
]);
add('Explain Like I\'m 12', 'confidence', [
  { t: "Explain to your client why the long silences from opposing counsel are normal, not a red flag.", d: 'intro' },
  { t: "Tell a defendant in the hallway what a grand jury actually does, in language that calms them.", d: 'core' },
  { t: "Explain to the family of an accused why a continuance is good news, not bad.", d: 'core' },
]);
add('Explain Like I\'m 12', 'giving_feedback', [
  { t: "Tell a junior associate why their brief buried the holding in footnote 12.", d: 'intro' },
  { t: "Explain to a paralegal why their privilege log column for 'comments' isn't usable in court.", d: 'core' },
  { t: "Tell a second-chair why they shouldn't have agreed to opposing counsel's stipulation in the hallway.", d: 'core' },
]);
add('Explain Like I\'m 12', 'negotiation', [
  { t: "Explain to the client what an MFN clause does and why the other side wants it stripped.", d: 'core' },
  { t: "Walk your client through what 'split the baby' means when the mediator floats a midpoint.", d: 'intro' },
  { t: "Explain to a founder why a 12-month survival period for fundamental reps changes everything.", d: 'stretch' },
]);
add('Explain Like I\'m 12', 'presenting', [
  { t: "Explain to a town-hall room of employees what a litigation hold means for their email.", d: 'core' },
  { t: "Open the board meeting by explaining what a 10b5-1 plan actually buys an executive.", d: 'core' },
  { t: "Explain to a CLE audience what 'attorney work product' protects and what it does not.", d: 'intro' },
]);
add('Explain Like I\'m 12', 'persuasion', [
  { t: "Explain to a jury during opening why 'beyond a reasonable doubt' is not the same as no doubt.", d: 'core' },
  { t: "Tell a skeptical board why a structured settlement leaves the company stronger than a verdict win.", d: 'core' },
  { t: "Convince a hesitant client that taking the deferred prosecution agreement is the offensive move.", d: 'stretch' },
]);
add('Explain Like I\'m 12', 'storytelling', [
  { t: "Tell the jury the story of the contract dispute as if it happened between two neighbors.", d: 'core' },
  { t: "Recount your client's chain of custody troubles as a story about a missing package.", d: 'intro' },
  { t: "Tell the story of the breach to the jury using only the parties' actual texts.", d: 'core' },
]);
add('Explain Like I\'m 12', 'asking_questions', [
  { t: "Open the witness intake by explaining what you'll ask and why, before any real questions.", d: 'intro' },
  { t: "Explain to a custodian what 'reasonable search' for documents really means before they look.", d: 'core' },
  { t: "Tell a deponent why you'll ask the same question three different ways, before you do it.", d: 'core' },
]);

// Headline First — open with the answer
add('Headline First', 'explaining', [
  { t: "What's the holding of the Third Circuit's ruling on our motion to dismiss?", d: 'intro' },
  { t: "What does the new e-discovery protocol actually require of our custodians?", d: 'core' },
  { t: "What's the practical effect of the FTC's new HSR rule on next month's filing?", d: 'core' },
]);
add('Headline First', 'handling_objections', [
  { t: "The judge just sustained their hearsay objection on the email. Headline your move.", d: 'core' },
  { t: "Opposing counsel filed a motion to disqualify the firm. Lead with your one-sentence response.", d: 'core' },
  { t: "Your client wants to know if today's protective-order fight cost us the trial. Lead with the answer.", d: 'stretch' },
]);
add('Headline First', 'confidence', [
  { t: "Did you sandbag the prosecution on the alibi witness or not?", d: 'intro' },
  { t: "Is the firm's litigation practice growing or shrinking this fiscal year?", d: 'core' },
  { t: "Did the trial team carry their share of the workload this month?", d: 'core' },
]);
add('Headline First', 'giving_feedback', [
  { t: "Is the associate's draft brief filable as-is or not?", d: 'intro' },
  { t: "Did the second-chair's cross of the damages expert land or miss?", d: 'core' },
  { t: "Should the senior associate keep running the witness prep or be pulled off?", d: 'core' },
]);
add('Headline First', 'negotiation', [
  { t: "Are we taking the buyer's last indemnity package or walking?", d: 'intro' },
  { t: "Did opposing counsel signal real movement on damages this week?", d: 'core' },
  { t: "Is the mediator's bracket inside or outside your client's authority?", d: 'core' },
]);
add('Headline First', 'presenting', [
  { t: "What's the headline message of tomorrow's annual litigation report to the board?", d: 'core' },
  { t: "Open the trial-team standup with the single most important thing the team has to do today.", d: 'intro' },
  { t: "Lead the GC briefing with the one verdict outcome that moved your client's exposure.", d: 'core' },
]);
add('Headline First', 'persuasion', [
  { t: "Open closing with the one sentence the jury should write on the verdict form.", d: 'core' },
  { t: "Lead the appellate argument with the single sentence the panel should remember.", d: 'stretch' },
  { t: "Open the mediation with the one number that gets the other side talking.", d: 'core' },
]);
add('Headline First', 'storytelling', [
  { t: "Headline the story of the case in one sentence the jury will repeat to each other in the jury room.", d: 'core' },
  { t: "Open your firm-wide trial recap with the single moment that turned the verdict.", d: 'core' },
  { t: "Lead the CLE talk with the one trial moment that taught you the most about juries.", d: 'intro' },
]);
add('Headline First', 'asking_questions', [
  { t: "Open the deposition with the single question whose answer locks the case.", d: 'core' },
  { t: "Lead the custodian interview with the one question that decides whether they're material.", d: 'core' },
  { t: "Open the partner's status call with the one question whose answer determines next steps.", d: 'intro' },
]);

// Make It Real — concrete, scenario-driven
add('Make It Real', 'explaining', [
  { t: "Explain to your client what 'cooperation credit' will mean in their specific DOJ matter.", d: 'core' },
  { t: "Walk the GC through what a 'monitor' will actually do inside their company for two years.", d: 'core' },
  { t: "Explain to the founder what 'sandbagging' rights mean in the indemnification section they signed.", d: 'intro' },
]);
add('Make It Real', 'handling_objections', [
  { t: "Opposing counsel says your damages model double-counts lost profits. Show, with numbers, that it doesn't.", d: 'core' },
  { t: "The judge says your motion in limine is overbroad. Narrow it on the record, with specifics.", d: 'core' },
  { t: "Your client says the engagement letter overcharges. Walk them through three specific entries.", d: 'stretch' },
]);
add('Make It Real', 'confidence', [
  { t: "Tell the trial team exactly what each person is doing in the first 90 minutes of tomorrow's hearing.", d: 'intro' },
  { t: "Walk the jury through the specific moments their verdict has to account for.", d: 'core' },
  { t: "Show the client, with a calendar, exactly how the next sixty days of their criminal case unfold.", d: 'core' },
]);
add('Make It Real', 'thinking_on_the_spot', [
  { t: "The witness just gave a number that doesn't match their declaration. Reconcile it now on direct.", d: 'core' },
  { t: "Opposing counsel offered a side deal in the hallway. Decide and respond before lunch.", d: 'core' },
  { t: "The court reporter signals a problem with the record. Address it without losing the witness.", d: 'stretch' },
]);
add('Make It Real', 'giving_feedback', [
  { t: "Tell the associate, line by line, where their reply brief lost the appellate panel.", d: 'core' },
  { t: "Walk the paralegal through three specific deposition exhibits that were mislabeled.", d: 'intro' },
  { t: "Show the junior partner exactly where their cross undermined the witness's credibility for the wrong reason.", d: 'core' },
]);
add('Make It Real', 'negotiation', [
  { t: "Walk opposing counsel through the three specific reps where you'll move and the two where you won't.", d: 'core' },
  { t: "Show the mediator the exact math behind your bottom number, including reserves and fees.", d: 'core' },
  { t: "Take the GC through the actual difference between a 10% and 12.5% cap on a $300M deal.", d: 'stretch' },
]);
add('Make It Real', 'presenting', [
  { t: "Walk the board through three concrete scenarios from the regulatory inquiry, not abstractions.", d: 'core' },
  { t: "Present the litigation pipeline to the executive committee with three real matters at three postures.", d: 'core' },
  { t: "Open the partners' meeting with three specific client engagements that defined the quarter.", d: 'intro' },
]);
add('Make It Real', 'storytelling', [
  { t: "Tell the jury about the morning your client signed the disputed contract, not the legal theory.", d: 'core' },
  { t: "Recount the deposition moment when the truth fell out — exact words, exact pause.", d: 'core' },
  { t: "Walk the panel through the actual phone call that triggered the SEC inquiry.", d: 'intro' },
]);
add('Make It Real', 'asking_questions', [
  { t: "Question the witness about the specific Slack thread on March 14, not 'communications generally.'", d: 'core' },
  { t: "Ask the CFO about the exact line item in the Q3 earnings release, not the disclosure policy in the abstract.", d: 'core' },
  { t: "Question the custodian about the specific external drive they used, not their backup habits.", d: 'intro' },
]);

// No Jargon Allowed
add('No Jargon Allowed', 'handling_objections', [
  { t: "Explain to your client why a 12(b)(6) is not the judge saying their case is weak.", d: 'core' },
  { t: "Explain to a CEO why a sanctions motion isn't an accusation against them personally.", d: 'core' },
  { t: "Tell a defendant why a Brady disclosure helps them even though the prosecutor delivered it.", d: 'intro' },
]);
add('No Jargon Allowed', 'confidence', [
  { t: "Tell your client the case is going to trial — no Latin, no acronyms, no hedging.", d: 'intro' },
  { t: "Brief the CEO on the indictment in plain words; promise the company will survive it.", d: 'core' },
  { t: "Walk the family of a defendant through the next 90 days without one piece of legal jargon.", d: 'core' },
]);
add('No Jargon Allowed', 'thinking_on_the_spot', [
  { t: "The juror asks during a recess what 'sustained' means. Answer in 15 seconds in plain English.", d: 'intro' },
  { t: "A reporter calls about the verdict and asks what 'remittitur' is. Answer her in one sentence.", d: 'core' },
  { t: "Your client texts mid-trial asking what 'res judicata' is. Reply in plain English in one minute.", d: 'core' },
]);
add('No Jargon Allowed', 'giving_feedback', [
  { t: "Tell an associate their brief is too jargon-heavy without using the word 'jargon.'", d: 'intro' },
  { t: "Explain to a paralegal why their memo on equitable tolling reads like a treatise, not a tool.", d: 'core' },
  { t: "Coach a junior litigator on why their oral argument sounded like a law-review article, in plain words.", d: 'core' },
]);
add('No Jargon Allowed', 'negotiation', [
  { t: "Explain the basket and cap structure to a small-business seller without using either word.", d: 'core' },
  { t: "Walk a founder through the no-shop and break-up fee without legalese.", d: 'core' },
  { t: "Explain a most-favored-nation clause to the buyer's operations VP in plain English.", d: 'intro' },
]);
add('No Jargon Allowed', 'presenting', [
  { t: "Open a board meeting on a regulatory inquiry without saying 'Wells notice' or 'subpoena.'", d: 'core' },
  { t: "Present the firm's annual litigation results to the audit committee in language they actually use.", d: 'core' },
  { t: "Brief a town hall on what the consent decree changes for employees — no legal terms.", d: 'intro' },
]);
add('No Jargon Allowed', 'persuasion', [
  { t: "Convince the jury in plain English that circumstantial evidence is not weaker, it's just different.", d: 'core' },
  { t: "Persuade the client to settle, using no legal term they wouldn't hear at a kitchen table.", d: 'core' },
  { t: "Tell the GC why the consent decree is the better outcome, without a single defined term.", d: 'stretch' },
]);
add('No Jargon Allowed', 'storytelling', [
  { t: "Tell the story of the deal's collapse without using 'MAC,' 'closing condition,' or 'covenant.'", d: 'core' },
  { t: "Recount the trial's turning point to a non-lawyer friend, in plain English.", d: 'intro' },
  { t: "Tell the story of the internal investigation to the board without legal vocabulary.", d: 'core' },
]);
add('No Jargon Allowed', 'asking_questions', [
  { t: "Question your witness in plain English; if you say 'foundation' you reset and rephrase.", d: 'core' },
  { t: "Ask the corporate custodian about their document retention without using 'preservation.'", d: 'intro' },
  { t: "Question the expert on cross in language a juror has used at work this year.", d: 'core' },
]);

// One Point Only
add('One Point Only', 'explaining', [
  { t: "What's the single thing the appellate panel needs to understand about the trial record?", d: 'core' },
  { t: "What's the one thing the GC needs to know about your motion before approving the fees?", d: 'intro' },
  { t: "What's the single feature of the new e-discovery protocol your team must internalize?", d: 'core' },
]);
add('One Point Only', 'handling_objections', [
  { t: "What's the one objection at trial that will lose us count one if we don't preempt it?", d: 'core' },
  { t: "What's the single weakness opposing counsel will hit when our witness takes the stand?", d: 'intro' },
  { t: "What's the one objection from the judge that would unravel the whole indemnity argument?", d: 'core' },
]);
add('One Point Only', 'confidence', [
  { t: "Why are you the right partner to first-chair the trial in March?", d: 'intro' },
  { t: "Why is your trial theory the one that wins the verdict?", d: 'core' },
  { t: "Why is the senior associate ready to take a deposition alone?", d: 'core' },
]);
add('One Point Only', 'negotiation', [
  { t: "What's the one term we cannot give on the indemnity package, no matter what?", d: 'core' },
  { t: "What's the single number we walk away from?", d: 'intro' },
  { t: "What's the single concession that closes the deal tonight?", d: 'core' },
]);
add('One Point Only', 'presenting', [
  { t: "What's the one slide the board has to remember from your annual litigation update?", d: 'core' },
  { t: "What's the single number you'd lead the partners' meeting with this quarter?", d: 'intro' },
  { t: "What's the one case outcome you'd build the firm pitch around?", d: 'core' },
]);
add('One Point Only', 'storytelling', [
  { t: "What's the single moment from the trial that defines how you'll tell this story for years?", d: 'core' },
  { t: "What's the one anecdote about your career that explains why you went into litigation?", d: 'intro' },
  { t: "What's the single courtroom moment from this matter that the firm should retell to recruits?", d: 'core' },
]);
add('One Point Only', 'asking_questions', [
  { t: "What's the single question that decides whether the witness is credible on cross?", d: 'core' },
  { t: "What's the one question that ends the deposition early in your client's favor?", d: 'intro' },
  { t: "What's the one question at the partner meeting that surfaces the real litigation risk?", d: 'core' },
]);

// Prove It
add('Prove It', 'explaining', [
  { t: "Show me why our reading of the contract's force majeure clause is correct.", d: 'core' },
  { t: "Show me why the e-discovery protocol covers our client's Slack data, not just email.", d: 'intro' },
  { t: "Walk me through why this fact pattern triggers Rule 23 commonality.", d: 'core' },
]);
add('Prove It', 'handling_objections', [
  { t: "Show me why opposing counsel's relevance objection on the email chain fails under FRE 401.", d: 'core' },
  { t: "Prove your motion to compel survives even if the magistrate applies the strictest proportionality test.", d: 'core' },
  { t: "Show me why the prosecutor's hearsay objection at trial collapses under the present-sense exception.", d: 'stretch' },
]);
add('Prove It', 'confidence', [
  { t: "Show me why your trial theory works even if the judge excludes your second expert.", d: 'core' },
  { t: "Prove your settlement number is right even if the mediator's bracket lands lower.", d: 'core' },
  { t: "Show me why your trial team can carry the case without bringing in additional senior counsel.", d: 'intro' },
]);
add('Prove It', 'thinking_on_the_spot', [
  { t: "The judge asks for legal authority for your hearsay objection right now. Prove it.", d: 'core' },
  { t: "Opposing counsel demands your basis for the sanctions motion at the lectern. Show it.", d: 'core' },
  { t: "The mediator asks why your client won't move from $9M. Prove the number on the spot.", d: 'stretch' },
]);
add('Prove It', 'giving_feedback', [
  { t: "Show the associate, with specific record citations, where their brief misstates the holding.", d: 'core' },
  { t: "Prove to a junior litigator why their cross sequence let the witness off the hook.", d: 'core' },
  { t: "Show the paralegal, with three concrete entries, why the privilege log won't survive a challenge.", d: 'intro' },
]);
add('Prove It', 'presenting', [
  { t: "Show the board, with three concrete data points, why the litigation reserves should rise.", d: 'core' },
  { t: "Prove to the partners that the new contingent-fee matter is worth opening.", d: 'core' },
  { t: "Show the GC, with last year's win-rate data, why this trial team should keep the matter.", d: 'intro' },
]);
add('Prove It', 'storytelling', [
  { t: "Tell the jury the story of the breach, then prove every fact with a document already in evidence.", d: 'core' },
  { t: "Walk the board through the chronology of the internal investigation; prove each step with a memo.", d: 'core' },
  { t: "Tell the panel the appeal's narrative, citing record evidence for every turn.", d: 'stretch' },
]);
add('Prove It', 'asking_questions', [
  { t: "Show me, with the questions, how you'd prove the witness destroyed the email through cross alone.", d: 'core' },
  { t: "Walk me through the questions that prove the custodian wasn't acting in good faith.", d: 'intro' },
  { t: "Prove with three deposition questions that the executive knew about the side letter before signing.", d: 'core' },
]);

// The Analogy Bridge
add('The Analogy Bridge', 'handling_objections', [
  { t: "Explain to your client why a denial of summary judgment is like a referee waving off a foul, not awarding a goal.", d: 'core' },
  { t: "Explain to a CFO why a discovery sanction is like a yellow card, not an ejection.", d: 'intro' },
  { t: "Explain to the board why a sealed filing is like a doctor's chart — still real, just not public.", d: 'core' },
]);
add('The Analogy Bridge', 'confidence', [
  { t: "Tell the client why your trial team is set up like a relay, not a single sprinter.", d: 'core' },
  { t: "Explain to a defendant why the trial process is more like an audit than an attack.", d: 'intro' },
  { t: "Walk a scared founder through the SEC inquiry as a physical exam, not a verdict.", d: 'core' },
]);
add('The Analogy Bridge', 'thinking_on_the_spot', [
  { t: "Explain to the judge in chambers why your motion to amend is like patching a roof, not rebuilding the house.", d: 'core' },
  { t: "Tell opposing counsel on the fly why their discovery demand is like asking for the kitchen sink to find a fork.", d: 'core' },
  { t: "On the record, compare the requested protective order to a vault, not a black hole.", d: 'stretch' },
]);
add('The Analogy Bridge', 'giving_feedback', [
  { t: "Tell the associate their brief reads like a treasure hunt, not a map.", d: 'intro' },
  { t: "Explain to your second-chair why their cross was a fishing expedition, not a guided dive.", d: 'core' },
  { t: "Walk the junior partner through why their opening felt like a syllabus, not a story.", d: 'core' },
]);
add('The Analogy Bridge', 'negotiation', [
  { t: "Tell opposing counsel why their indemnity ask is like buying insurance after the house burned down.", d: 'core' },
  { t: "Explain to the mediator why your bracket is the runway, not the destination.", d: 'core' },
  { t: "Walk the seller through why a survival period is the warranty on a used car — finite, not forever.", d: 'intro' },
]);
add('The Analogy Bridge', 'presenting', [
  { t: "Open the partners' meeting by comparing this quarter's docket to a busy ER triage.", d: 'core' },
  { t: "Brief the board: the regulator's monitorship is a tutor, not a warden.", d: 'core' },
  { t: "Present the e-discovery overhaul to the GC as switching from paper maps to GPS.", d: 'intro' },
]);
add('The Analogy Bridge', 'storytelling', [
  { t: "Tell the jury the conspiracy story as a band agreeing on a setlist before the show.", d: 'core' },
  { t: "Walk the appellate panel through the contract dispute as two captains misreading the same nautical chart.", d: 'stretch' },
  { t: "Recount the deposition as a chess game where the witness sacrificed the queen by mistake.", d: 'core' },
]);
add('The Analogy Bridge', 'asking_questions', [
  { t: "Tell the witness your cross will be like a doctor's exam, then ask the first question.", d: 'intro' },
  { t: "Open the custodian interview by comparing document preservation to keeping receipts for an audit.", d: 'core' },
  { t: "Tell the deponent your questions are like a checklist, not a trap, and ask the first one.", d: 'core' },
]);

// The Word Budget
add('The Word Budget', 'explaining', [
  { t: "Summarize the FCPA risk in the JV in 25 words.", d: 'core' },
  { t: "Explain the new privilege protocol to the team in two sentences.", d: 'intro' },
]);
add('The Word Budget', 'handling_objections', [
  { t: "In 30 words, address opposing counsel's relevance objection on the cross-examination exhibits.", d: 'core' },
  { t: "Respond to the judge's concern about overbreadth in your motion in limine — 25 words.", d: 'core' },
  { t: "In 30 words, address the GC's concern that the firm's billing has run away.", d: 'intro' },
]);
add('The Word Budget', 'confidence', [
  { t: "Pitch yourself for first-chair on the trial in 30 words.", d: 'intro' },
  { t: "In 25 words, defend the trial-team budget to a skeptical managing partner.", d: 'core' },
  { t: "Make the case to the GC, in 30 words, that you should keep the matter through trial.", d: 'core' },
]);
add('The Word Budget', 'giving_feedback', [
  { t: "Tell the associate, in 25 words, what was wrong with their motion-to-dismiss reply.", d: 'core' },
  { t: "Coach the second-chair on their opening in 30 words.", d: 'intro' },
  { t: "Tell the paralegal, in 25 words, why the privilege log needs another pass.", d: 'core' },
]);
add('The Word Budget', 'negotiation', [
  { t: "In 30 words, counter the buyer's indemnity demand without losing momentum.", d: 'core' },
  { t: "Pitch the settlement structure to the mediator in 25 words.", d: 'intro' },
]);
add('The Word Budget', 'presenting', [
  { t: "Open the board meeting on the regulatory inquiry in 30 words.", d: 'core' },
  { t: "Brief the executive committee on this quarter's verdict in 25 words.", d: 'intro' },
  { t: "Present the firm's annual litigation summary in 30 words.", d: 'core' },
]);
add('The Word Budget', 'storytelling', [
  { t: "In 30 words, tell the firm-wide story of the trial that defined your year.", d: 'core' },
  { t: "Recount the deposition turn in 25 words for the trial-team Slack.", d: 'intro' },
  { t: "Tell the partners, in 30 words, the story of how your team flipped the case.", d: 'core' },
]);
add('The Word Budget', 'asking_questions', [
  { t: "Frame the deposition's opening question in 25 words or fewer.", d: 'intro' },
  { t: "Ask the custodian about preservation in 30 words.", d: 'core' },
  { t: "Pose your closing question to the expert in 25 words.", d: 'core' },
]);

// ============================================================
// CONCISENESS
// ============================================================

// Cut by Half
add('Cut by Half', 'explaining', [
  { t: "Explain to your client why the protective order is good news.", d: 'intro' },
]);
add('Cut by Half', 'handling_objections', [
  { t: "Address opposing counsel's claim that your discovery responses are evasive.", d: 'core' },
  { t: "Respond to the judge's concern that your motion in limine is overbroad.", d: 'core' },
]);
add('Cut by Half', 'confidence', [
  { t: "Defend your decision to take the matter to verdict against an anxious GC.", d: 'core' },
  { t: "Tell the partner you'll first-chair the trial.", d: 'intro' },
]);
add('Cut by Half', 'thinking_on_the_spot', [
  { t: "The judge asks why the deposition ran six hours instead of four. Respond.", d: 'core' },
  { t: "Opposing counsel asks why you're objecting now and not yesterday. Answer.", d: 'core' },
]);
add('Cut by Half', 'giving_feedback', [
  { t: "Tell the associate what was wrong with their cross-examination outline.", d: 'core' },
  { t: "Coach the second-chair on how their opening landed.", d: 'core' },
  { t: "Tell the paralegal how to fix the trial binder.", d: 'intro' },
]);
add('Cut by Half', 'negotiation', [
  { t: "Counter the buyer's indemnity demand without losing momentum.", d: 'core' },
  { t: "Push back on the mediator's bracket without breaking the room.", d: 'core' },
  { t: "Open the renegotiation after the deal slipped at signing.", d: 'stretch' },
]);
add('Cut by Half', 'presenting', [
  { t: "Open the board meeting with the verdict outcome.", d: 'core' },
  { t: "Present this quarter's litigation pipeline to the executive committee.", d: 'core' },
  { t: "Brief the firm-wide on the new privilege protocol.", d: 'intro' },
]);
add('Cut by Half', 'storytelling', [
  { t: "Tell the firm-wide audience how your trial turned in week two.", d: 'core' },
  { t: "Recount the deposition that opened the case for the trial team.", d: 'intro' },
  { t: "Tell the panel the story of the engagement that taught you to negotiate.", d: 'core' },
]);
add('Cut by Half', 'asking_questions', [
  { t: "Ask the custodian about the missing external drive.", d: 'intro' },
  { t: "Question the expert about the assumptions in their damages model.", d: 'core' },
  { t: "Ask the CFO whether they reviewed the disclosure before it went out.", d: 'core' },
]);

// Kill the Filler
add('Kill the Filler', 'explaining', [
  { t: "Explain how a 30(b)(6) deposition is scoped before notice.", d: 'intro' },
  { t: "Explain how an attorney's eyes only designation works in practice.", d: 'core' },
  { t: "Explain how the appellate record gets assembled.", d: 'core' },
]);
add('Kill the Filler', 'handling_objections', [
  { t: "Respond to opposing counsel's claim that your privilege log is overbroad.", d: 'core' },
  { t: "Address the judge's skepticism about your work-product invocation.", d: 'core' },
]);
add('Kill the Filler', 'confidence', [
  { t: "Tell the partners the verdict came in your favor.", d: 'intro' },
]);
add('Kill the Filler', 'thinking_on_the_spot', [
  { t: "The judge asks why opposing counsel got a privileged document. Answer cleanly.", d: 'core' },
]);
add('Kill the Filler', 'giving_feedback', [
  { t: "Tell the associate their brief still buries the lead.", d: 'core' },
  { t: "Coach the second-chair on their opening — no hedging.", d: 'core' },
]);
add('Kill the Filler', 'negotiation', [
  { t: "Make the indemnity demand to opposing counsel directly.", d: 'core' },
  { t: "Counter the mediator's bracket without ums or qualifiers.", d: 'core' },
  { t: "Pitch the settlement structure to the GC clean.", d: 'intro' },
]);
add('Kill the Filler', 'presenting', [
  { t: "Brief the board on a new federal subpoena that arrived this morning.", d: 'core' },
  { t: "Open the firm-wide call on the new conflicts protocol.", d: 'intro' },
  { t: "Present the trial outcome to the executive committee.", d: 'core' },
]);
add('Kill the Filler', 'persuasion', [
  { t: "Argue your client should accept the deferred prosecution.", d: 'core' },
  { t: "Convince the GC to keep your firm on the matter through verdict.", d: 'core' },
  { t: "Persuade the jury that the witness is credible despite her prior statement.", d: 'core' },
]);
add('Kill the Filler', 'asking_questions', [
  { t: "Cross the expert on her damages assumptions — no fillers.", d: 'core' },
  { t: "Question the custodian about retention practices.", d: 'intro' },
  { t: "Ask the CEO about the side letter — clean, on the record.", d: 'core' },
]);

// No Hedging
add('No Hedging', 'explaining', [
  { t: "Will the protective order hold up on appeal?", d: 'intro' },
  { t: "Does the contract's force majeure clause cover the pandemic shutdown?", d: 'core' },
  { t: "Is the privilege log defensible in front of a hostile magistrate?", d: 'core' },
]);
add('No Hedging', 'handling_objections', [
  { t: "Was the objection at trial well-founded?", d: 'intro' },
  { t: "Did the judge buy our argument on the motion in limine?", d: 'core' },
  { t: "Will opposing counsel succeed on disqualifying the firm?", d: 'core' },
]);
add('No Hedging', 'confidence', [
  { t: "Will we win on liability?", d: 'intro' },
  { t: "Will the appeal succeed?", d: 'core' },
  { t: "Is your trial team ready for Monday?", d: 'core' },
]);
add('No Hedging', 'negotiation', [
  { t: "Should we take the latest offer from opposing counsel?", d: 'core' },
  { t: "Should we hold the line on the indemnity cap?", d: 'core' },
  { t: "Does the mediator's bracket give us room?", d: 'intro' },
]);
add('No Hedging', 'presenting', [
  { t: "Is the litigation pipeline growing this fiscal year?", d: 'core' },
  { t: "Is the new e-discovery vendor delivering on the contract?", d: 'core' },
  { t: "Should we present the case at the bar association annual meeting?", d: 'intro' },
]);
add('No Hedging', 'persuasion', [
  { t: "Should the jury convict on count one?", d: 'core' },
  { t: "Should the appellate panel reverse?", d: 'core' },
  { t: "Should the GC sign off on global settlement?", d: 'stretch' },
]);
add('No Hedging', 'storytelling', [
  { t: "Was that trial the most important of your career?", d: 'intro' },
  { t: "Did that deposition change how you practice?", d: 'core' },
  { t: "Was settling that case the right call?", d: 'core' },
]);
add('No Hedging', 'asking_questions', [
  { t: "Did the witness know about the side letter?", d: 'intro' },
  { t: "Did the CFO sign the disclosure?", d: 'core' },
  { t: "Did the custodian preserve the texts?", d: 'core' },
]);

// No Throat Clearing
add('No Throat Clearing', 'explaining', [
  { t: "Explain why the motion to compel was filed.", d: 'intro' },
  { t: "Walk the client through the next 30 days of their case.", d: 'core' },
  { t: "Tell the partner how the protective order works.", d: 'core' },
]);
add('No Throat Clearing', 'handling_objections', [
  { t: "Respond to opposing counsel's relevance objection.", d: 'core' },
  { t: "Address the judge's concern about overbreadth.", d: 'core' },
  { t: "Answer the GC's pushback on firm billing.", d: 'intro' },
]);
add('No Throat Clearing', 'giving_feedback', [
  { t: "Tell the associate where the brief failed.", d: 'core' },
  { t: "Coach the second-chair on their cross.", d: 'core' },
  { t: "Tell the paralegal what's wrong with the binder.", d: 'intro' },
]);
add('No Throat Clearing', 'negotiation', [
  { t: "Open the offer to opposing counsel.", d: 'core' },
  { t: "Counter the buyer's indemnity demand.", d: 'core' },
  { t: "Make the settlement pitch to the mediator.", d: 'intro' },
]);
add('No Throat Clearing', 'presenting', [
  { t: "Open the trial team standup.", d: 'intro' },
]);
add('No Throat Clearing', 'persuasion', [
  { t: "Open the closing argument to the jury.", d: 'core' },
  { t: "Lead the appellate argument with the central point.", d: 'stretch' },
]);
add('No Throat Clearing', 'storytelling', [
  { t: "Open the firm-wide retelling of last month's verdict.", d: 'core' },
  { t: "Lead the CLE talk with your most memorable trial moment.", d: 'intro' },
  { t: "Open the recruiting pitch with how the firm shapes new partners.", d: 'core' },
]);
add('No Throat Clearing', 'asking_questions', [
  { t: "Open the deposition.", d: 'intro' },
  { t: "Begin the witness intake interview.", d: 'core' },
]);

// One Idea Per Response
add('One Idea Per Response', 'explaining', [
  { t: "What does the new protective order do?", d: 'intro' },
  { t: "What's the discovery deadline?", d: 'core' },
  { t: "What changed in this morning's amended complaint?", d: 'core' },
]);
add('One Idea Per Response', 'handling_objections', [
  { t: "What's opposing counsel's single best objection to your direct?", d: 'core' },
]);
add('One Idea Per Response', 'confidence', [
  { t: "What's the strongest fact in our case?", d: 'intro' },
  { t: "Why are you the right partner for trial?", d: 'core' },
  { t: "What's the one number you'd stake the verdict on?", d: 'core' },
]);
add('One Idea Per Response', 'giving_feedback', [
  { t: "What's the single thing the associate's brief needs?", d: 'intro' },
]);
add('One Idea Per Response', 'negotiation', [
  { t: "What's the one term we cannot give?", d: 'core' },
  { t: "What's the single concession that closes the deal?", d: 'core' },
  { t: "What's the one number the GC will sign off on?", d: 'intro' },
]);
add('One Idea Per Response', 'presenting', [
  { t: "What's the single takeaway from the verdict for the board?", d: 'core' },
  { t: "What's the one thing the partners need to know about Q3?", d: 'core' },
  { t: "What's the single message in the firm-wide email?", d: 'intro' },
]);
add('One Idea Per Response', 'persuasion', [
  { t: "What's the one fact that wins the jury?", d: 'core' },
]);
add('One Idea Per Response', 'storytelling', [
  { t: "What's the single moment from the trial that you'd tell first?", d: 'core' },
  { t: "What's the one detail that makes the deposition story land?", d: 'core' },
  { t: "What's the single image from the courtroom that defines this case?", d: 'intro' },
]);
add('One Idea Per Response', 'asking_questions', [
  { t: "What's the single question that ends the deposition early?", d: 'core' },
  { t: "What's the one question that surfaces the witness's bias?", d: 'intro' },
  { t: "What's the single question your cross has to answer?", d: 'core' },
]);

// Subject Verb Object
add('Subject Verb Object', 'handling_objections', [
  { t: "State the basis for your hearsay objection.", d: 'intro' },
  { t: "Tell the judge why opposing counsel's discovery demand fails.", d: 'core' },
  { t: "Respond to the magistrate's concern about your privilege log.", d: 'core' },
]);
add('Subject Verb Object', 'confidence', [
  { t: "Tell the client we are going to trial.", d: 'intro' },
  { t: "Tell the partners the verdict is in.", d: 'core' },
  { t: "Tell the GC the firm will hold the line on indemnity.", d: 'core' },
]);
add('Subject Verb Object', 'thinking_on_the_spot', [
  { t: "The judge asks why the deposition ran long. Answer.", d: 'core' },
  { t: "The mediator asks if your client has authority. Answer.", d: 'core' },
  { t: "The witness asks if they can refuse the question. Answer.", d: 'intro' },
]);
add('Subject Verb Object', 'giving_feedback', [
  { t: "Tell the associate the cross missed.", d: 'intro' },
  { t: "Tell the paralegal the binder is wrong.", d: 'core' },
  { t: "Tell the second-chair the opening dragged.", d: 'core' },
]);
add('Subject Verb Object', 'negotiation', [
  { t: "Make the offer.", d: 'intro' },
  { t: "Counter the demand.", d: 'core' },
  { t: "Close the deal.", d: 'core' },
]);
add('Subject Verb Object', 'presenting', [
  { t: "Open the board meeting with the verdict.", d: 'core' },
  { t: "Brief the partners on the docket.", d: 'core' },
  { t: "Present the GC with the trial plan.", d: 'intro' },
]);
add('Subject Verb Object', 'persuasion', [
  { t: "Tell the jury our client did not lie.", d: 'core' },
  { t: "Tell the panel the trial court erred.", d: 'core' },
  { t: "Tell the mediator the case is worth more.", d: 'intro' },
]);
add('Subject Verb Object', 'storytelling', [
  { t: "Tell the jury what happened on March 14.", d: 'core' },
  { t: "Tell the panel how the deal collapsed.", d: 'intro' },
  { t: "Tell the board how the investigation began.", d: 'core' },
]);
add('Subject Verb Object', 'asking_questions', [
  { t: "Ask the witness when she signed the document.", d: 'intro' },
  { t: "Ask the custodian where the texts are stored.", d: 'core' },
  { t: "Ask the CFO who approved the disclosure.", d: 'core' },
]);

// The 30 Second Rule
add('The 30 Second Rule', 'explaining', [
  { t: "Explain the new protective order to the trial team in 30 seconds.", d: 'core' },
]);
add('The 30 Second Rule', 'handling_objections', [
  { t: "Respond to the judge's relevance objection on the email chain — 30 seconds.", d: 'core' },
  { t: "Address opposing counsel's claim of work-product abuse in 30 seconds.", d: 'core' },
  { t: "Answer the GC's pushback on the firm's discovery costs — 30 seconds.", d: 'intro' },
]);
add('The 30 Second Rule', 'confidence', [
  { t: "Pitch yourself for first-chair on the trial in 30 seconds.", d: 'intro' },
  { t: "Defend the litigation budget in 30 seconds to the audit committee.", d: 'core' },
  { t: "Tell the firm-wide audience the matter is going to verdict — 30 seconds.", d: 'core' },
]);
add('The 30 Second Rule', 'giving_feedback', [
  { t: "Tell the associate, in 30 seconds, what failed in the brief.", d: 'core' },
  { t: "Coach the second-chair on their opening — 30 seconds.", d: 'intro' },
  { t: "Tell the paralegal in 30 seconds what to redo on the privilege log.", d: 'core' },
]);
add('The 30 Second Rule', 'negotiation', [
  { t: "Counter the buyer's indemnity demand in 30 seconds.", d: 'core' },
  { t: "Open the mediation with a 30-second framing.", d: 'core' },
  { t: "Pitch the deferred prosecution to the GC in 30 seconds.", d: 'intro' },
]);
add('The 30 Second Rule', 'presenting', [
  { t: "Open the board meeting on the verdict in 30 seconds.", d: 'core' },
  { t: "Present the quarter's pipeline to the partners in 30 seconds.", d: 'intro' },
  { t: "Brief the GC on the federal subpoena in 30 seconds.", d: 'core' },
]);
add('The 30 Second Rule', 'persuasion', [
  { t: "Open the closing argument with a 30-second hook.", d: 'core' },
  { t: "Pitch the mediator on your client's number — 30 seconds.", d: 'core' },
  { t: "Convince the GC to keep the firm on the matter — 30 seconds.", d: 'intro' },
]);
add('The 30 Second Rule', 'storytelling', [
  { t: "Tell the firm-wide story of the verdict in 30 seconds.", d: 'core' },
  { t: "Recount the deposition turn in 30 seconds for the trial-team Slack.", d: 'intro' },
  { t: "Tell the recruiting class about your most memorable trial — 30 seconds.", d: 'core' },
]);
add('The 30 Second Rule', 'asking_questions', [
  { t: "Open the deposition with a 30-second framing.", d: 'core' },
  { t: "Open the custodian interview in 30 seconds.", d: 'intro' },
  { t: "Frame the partners' meeting question in 30 seconds.", d: 'core' },
]);

// The Hard Stop
add('The Hard Stop', 'explaining', [
  { t: "Object now or hold for redirect?", d: 'intro' },
  { t: "Move to strike or let it stand?", d: 'core' },
  { t: "Stipulate to authenticity or force them to call the custodian?", d: 'core' },
]);
add('The Hard Stop', 'handling_objections', [
  { t: "Stand on your hearsay objection or withdraw?", d: 'intro' },
  { t: "Take the bench conference or push the objection on the record?", d: 'core' },
  { t: "Concede the foundation point or hold the line?", d: 'core' },
]);
add('The Hard Stop', 'confidence', [
  { t: "Take first chair on the trial or step back?", d: 'intro' },
  { t: "Argue the appeal yourself or hand it to appellate counsel?", d: 'core' },
  { t: "Tell the client we go to verdict or signal flexibility?", d: 'core' },
]);
add('The Hard Stop', 'giving_feedback', [
  { t: "Move the associate to partner track or hold them another year?", d: 'core' },
  { t: "Tell the second-chair to redo their opening or rewrite it yourself?", d: 'core' },
]);
add('The Hard Stop', 'presenting', [
  { t: "Open the board meeting with the verdict or with the appeal plan?", d: 'core' },
  { t: "Lead the partners' meeting with the win or with the loss?", d: 'intro' },
  { t: "Present at the CLE or send a junior partner instead?", d: 'core' },
]);
add('The Hard Stop', 'persuasion', [
  { t: "Open closing on the witness or on the documents?", d: 'core' },
  { t: "Pitch the GC on settlement or on trial?", d: 'core' },
  { t: "Lead the appellate argument with constitutional or statutory grounds?", d: 'stretch' },
]);
add('The Hard Stop', 'storytelling', [
  { t: "Tell the jury about the day of the breach or the day of the cover-up?", d: 'core' },
  { t: "Lead the firm-wide story with the witness's collapse or the verdict?", d: 'intro' },
  { t: "Open the CLE with your best trial or your worst?", d: 'core' },
]);
add('The Hard Stop', 'asking_questions', [
  { t: "Open the deposition with the easy question or the hard one?", d: 'core' },
  { t: "Cross the witness on motive first or opportunity first?", d: 'core' },
  { t: "Ask the CFO directly or work up to the disclosure question?", d: 'intro' },
]);

// The Single Sentence
add('The Single Sentence', 'explaining', [
  { t: "Define attorney-client privilege.", d: 'intro' },
  { t: "Define the work-product doctrine.", d: 'core' },
]);
add('The Single Sentence', 'handling_objections', [
  { t: "Summarize your response to the motion to disqualify in one sentence.", d: 'core' },
  { t: "State, in one sentence, why opposing counsel's discovery demand fails.", d: 'core' },
  { t: "Sum up the GC's objection to firm billing — and your answer — in one sentence.", d: 'intro' },
]);
add('The Single Sentence', 'confidence', [
  { t: "State your trial team's win condition in one sentence.", d: 'intro' },
  { t: "Define your case theory in one sentence the jury can repeat.", d: 'core' },
  { t: "Tell the partners in one sentence why you should keep the matter.", d: 'core' },
]);
add('The Single Sentence', 'giving_feedback', [
  { t: "Tell the associate in one sentence what their brief is missing.", d: 'intro' },
  { t: "Sum up the second-chair's opening in one sentence of coaching.", d: 'core' },
  { t: "State in one sentence what the paralegal must redo on the privilege log.", d: 'core' },
]);
add('The Single Sentence', 'negotiation', [
  { t: "State your bottom line to opposing counsel in one sentence.", d: 'core' },
  { t: "Define the indemnity package's purpose in one sentence.", d: 'core' },
  { t: "Pitch the mediator's bracket back to your client in one sentence.", d: 'intro' },
]);
add('The Single Sentence', 'presenting', [
  { t: "Open the board meeting in one sentence.", d: 'core' },
  { t: "Sum up the firm's quarter in one sentence for the executive committee.", d: 'core' },
  { t: "Define the new conflict policy in one sentence for the firm-wide email.", d: 'intro' },
]);
add('The Single Sentence', 'storytelling', [
  { t: "Tell the trial story in one sentence the firm will repeat.", d: 'core' },
  { t: "Sum up the deposition turn in one sentence for the trial team.", d: 'intro' },
  { t: "State, in one sentence, what this case taught you about juries.", d: 'core' },
]);
add('The Single Sentence', 'asking_questions', [
  { t: "Frame the deposition's central question in one sentence.", d: 'core' },
  { t: "State, in one sentence, the question your cross has to answer.", d: 'core' },
  { t: "Open the custodian interview with one sentence and one question.", d: 'intro' },
]);

// ============================================================
// PACING
// ============================================================

// Beat the Buzzer (45-second prompts)
add('Beat the Buzzer', 'explaining', [
  { t: "45 seconds: explain the new privilege protocol to a new lateral associate.", d: 'intro' },
]);
add('Beat the Buzzer', 'handling_objections', [
  { t: "45 seconds: respond to opposing counsel's claim your privilege log is overbroad.", d: 'core' },
  { t: "45 seconds: address the judge's skepticism about your motion in limine.", d: 'core' },
  { t: "45 seconds: answer the GC's pushback on firm billing.", d: 'intro' },
]);
add('Beat the Buzzer', 'confidence', [
  { t: "45 seconds: defend the litigation budget to a hostile audit committee.", d: 'core' },
  { t: "45 seconds: tell the trial team you're going to verdict.", d: 'core' },
]);
add('Beat the Buzzer', 'giving_feedback', [
  { t: "45 seconds: tell the associate where their brief failed.", d: 'core' },
  { t: "45 seconds: coach the second-chair on their opening.", d: 'intro' },
  { t: "45 seconds: tell the paralegal what to redo on the privilege log.", d: 'core' },
]);
add('Beat the Buzzer', 'negotiation', [
  { t: "45 seconds: counter the buyer's indemnity demand on a $250M deal.", d: 'core' },
  { t: "45 seconds: pitch the mediator on your client's number.", d: 'core' },
  { t: "45 seconds: open the renegotiation after signing slipped.", d: 'stretch' },
]);
add('Beat the Buzzer', 'presenting', [
  { t: "45 seconds: open the executive committee on the verdict.", d: 'core' },
  { t: "45 seconds: brief the GC on the federal subpoena.", d: 'core' },
]);
add('Beat the Buzzer', 'storytelling', [
  { t: "45 seconds: tell the firm-wide story of the trial that defined your year.", d: 'core' },
  { t: "45 seconds: recount the deposition turn for the trial team.", d: 'intro' },
  { t: "45 seconds: tell the recruiting class your most memorable courtroom moment.", d: 'core' },
]);
add('Beat the Buzzer', 'asking_questions', [
  { t: "45 seconds: open the deposition of a difficult fact witness.", d: 'core' },
  { t: "45 seconds: open the custodian interview on missing data.", d: 'intro' },
  { t: "45 seconds: frame your cross of the damages expert.", d: 'core' },
]);

// Metronome (rhythm)
add('Metronome', 'handling_objections', [
  { t: "Walk through how you respond to a string of hearsay objections at trial.", d: 'core' },
  { t: "Explain how you address a judge's skepticism on your motion in limine.", d: 'core' },
  { t: "Talk through how you respond when opposing counsel lobs a sanctions motion mid-discovery.", d: 'intro' },
]);
add('Metronome', 'confidence', [
  { t: "Walk through how you tell a client they're going to trial.", d: 'intro' },
  { t: "Talk through how you take first-chair on a complex commercial trial.", d: 'core' },
  { t: "Explain how you brief the GC on a verdict that just came in.", d: 'core' },
]);
add('Metronome', 'thinking_on_the_spot', [
  { t: "Walk through how you respond when the judge asks a question you didn't prepare for.", d: 'core' },
  { t: "Talk through how you handle a witness who changes their answer mid-direct.", d: 'core' },
  { t: "Explain how you adjust when opposing counsel introduces a new exhibit at deposition.", d: 'intro' },
]);
add('Metronome', 'giving_feedback', [
  { t: "Walk through how you debrief an associate after a lost motion.", d: 'core' },
]);
add('Metronome', 'negotiation', [
  { t: "Walk through how you pace an M&A negotiation from term sheet to signing.", d: 'core' },
]);
add('Metronome', 'presenting', [
  { t: "Walk through how you brief the executive committee on quarterly litigation outcomes.", d: 'core' },
]);
add('Metronome', 'persuasion', [
  { t: "Walk through how you build a closing argument over the course of trial.", d: 'core' },
  { t: "Talk through how you persuade a board to authorize a deferred prosecution.", d: 'core' },
  { t: "Explain how you sell the GC on settling a high-profile matter.", d: 'intro' },
]);
add('Metronome', 'storytelling', [
  { t: "Walk through how you tell the story of your firm's litigation practice at a pitch.", d: 'intro' },
  { t: "Talk through how you build the case narrative for the jury across two weeks of trial.", d: 'core' },
  { t: "Explain how you recount a verdict at the firm's annual retreat.", d: 'core' },
]);
add('Metronome', 'asking_questions', [
  { t: "Walk through how you pace a six-hour deposition.", d: 'core' },
]);

// Punctuation Breathing
add('Punctuation Breathing', 'explaining', [
  { t: "Walk me through how an M&A deal moves from term sheet to closing.", d: 'core' },
  { t: "Explain how an internal investigation scopes its first thirty days.", d: 'core' },
  { t: "Walk through how a class action survives motion to dismiss into discovery.", d: 'intro' },
]);
add('Punctuation Breathing', 'handling_objections', [
  { t: "Walk through how you respond to a hostile judge sustaining every objection.", d: 'core' },
  { t: "Explain how you handle opposing counsel filing for sanctions days before trial.", d: 'core' },
  { t: "Talk through how you address a client demanding the firm cut fees mid-matter.", d: 'intro' },
]);
add('Punctuation Breathing', 'confidence', [
  { t: "Tell the story of the matter you bet your career on.", d: 'core' },
  { t: "Walk through the moment you knew you were ready for first-chair trials.", d: 'core' },
  { t: "Talk about the year you took the firm into a new practice area.", d: 'intro' },
]);
add('Punctuation Breathing', 'thinking_on_the_spot', [
  { t: "Walk through the morning a key witness recanted on the courthouse steps.", d: 'core' },
  { t: "Talk through the call where opposing counsel offered a side deal in the hallway.", d: 'core' },
  { t: "Explain the moment you realized the judge had read your brief differently than you'd expected.", d: 'intro' },
]);
add('Punctuation Breathing', 'giving_feedback', [
  { t: "Walk through how you debriefed an associate after a tough loss in court.", d: 'core' },
  { t: "Tell the story of coaching a second-chair through their first cross.", d: 'intro' },
  { t: "Talk through the moment you had to fire a senior associate.", d: 'core' },
]);
add('Punctuation Breathing', 'negotiation', [
  { t: "Walk through the negotiation that closed at three in the morning before signing.", d: 'core' },
  { t: "Tell the story of the mediation that bracketed for six hours before breaking through.", d: 'core' },
  { t: "Talk through the renegotiation that saved the deal after the regulatory letter.", d: 'stretch' },
]);
add('Punctuation Breathing', 'presenting', [
  { t: "Walk through your annual litigation report to the board.", d: 'core' },
  { t: "Tell the firm-wide story of the year's biggest verdict at the retreat.", d: 'core' },
  { t: "Talk through the CLE you delivered on Daubert challenges.", d: 'intro' },
]);
add('Punctuation Breathing', 'persuasion', [
  { t: "Walk through the closing argument that turned the jury in week two.", d: 'core' },
  { t: "Tell the story of how you sold the GC on a high-risk trial strategy.", d: 'core' },
  { t: "Talk through the appellate argument that reversed a verdict against your client.", d: 'stretch' },
]);
add('Punctuation Breathing', 'asking_questions', [
  { t: "Walk through how you opened the deposition that broke the case.", d: 'core' },
  { t: "Tell the story of the custodian interview that surfaced the hidden drive.", d: 'intro' },
  { t: "Talk through the cross that turned the prosecution's witness into yours.", d: 'core' },
]);

// Silence Over Filler
add('Silence Over Filler', 'explaining', [
  { t: "Explain the impact of the new discovery rules on your team's workflow.", d: 'core' },
  { t: "Walk through how the protective order routes confidential ESI between firms.", d: 'core' },
  { t: "Explain how a deferred prosecution agreement reshapes a client's compliance program.", d: 'intro' },
]);
add('Silence Over Filler', 'handling_objections', [
  { t: "Address the GC's claim that the firm is over-litigating.", d: 'core' },
]);
add('Silence Over Filler', 'confidence', [
  { t: "Tell a defendant the prosecution rejected your plea offer.", d: 'core' },
]);
add('Silence Over Filler', 'giving_feedback', [
  { t: "Tell the senior associate they're not making partner this cycle.", d: 'stretch' },
  { t: "Coach the second-chair on a witness prep that went poorly.", d: 'core' },
]);
add('Silence Over Filler', 'negotiation', [
  { t: "Counter the buyer's indemnity demand after they walked away from the table.", d: 'core' },
  { t: "Open the mediation after both sides have refused to move.", d: 'core' },
  { t: "Sit with silence after the mediator floats a bracket below your client's authority.", d: 'stretch' },
]);
add('Silence Over Filler', 'presenting', [
  { t: "Open the board meeting on a verdict that came in against the company.", d: 'core' },
  { t: "Present the firm's response to a major loss at the partners' retreat.", d: 'stretch' },
  { t: "Brief the executive committee on a regulatory subpoena.", d: 'core' },
]);
add('Silence Over Filler', 'persuasion', [
  { t: "Persuade the jury after the witness on direct underperformed.", d: 'core' },
  { t: "Convince the GC to authorize trial after they pushed for settlement.", d: 'core' },
  { t: "Sell the audit committee on increased litigation reserves.", d: 'stretch' },
]);
add('Silence Over Filler', 'storytelling', [
  { t: "Tell the story of a deposition that broke into silence at the key moment.", d: 'core' },
  { t: "Walk through the closing argument where the loudest beat was the pause.", d: 'core' },
]);
add('Silence Over Filler', 'asking_questions', [
  { t: "Cross the hostile witness with a question, then let the silence carry the answer.", d: 'core' },
  { t: "Ask the custodian about the missing data and wait for the explanation.", d: 'intro' },
]);

// Slow Cooker
add('Slow Cooker', 'explaining', [
  { t: "Walk through how a Section 220 books-and-records demand actually unfolds for a corporate board.", d: 'core' },
  { t: "Explain how an internal investigation moves from intake through final report.", d: 'core' },
  { t: "Walk through how an M&A deal handles a closing condition that triggers a MAC carve-out.", d: 'intro' },
]);
add('Slow Cooker', 'handling_objections', [
  { t: "Explain how you handled opposing counsel filing for sanctions the week before trial.", d: 'core' },
  { t: "Walk through how you responded when the judge accused your team of bad faith.", d: 'stretch' },
]);
add('Slow Cooker', 'confidence', [
  { t: "Tell the story of the verdict you took to trial when everyone else said settle.", d: 'core' },
  { t: "Walk through the moment you knew you'd built your own book of business.", d: 'core' },
  { t: "Explain how you stayed in the deposition seat when the witness tried to walk out.", d: 'intro' },
]);
add('Slow Cooker', 'giving_feedback', [
  { t: "Walk through how you delivered the news to a senior associate they were off the partnership track.", d: 'stretch' },
  { t: "Tell the story of coaching an associate through their first failed motion.", d: 'core' },
  { t: "Explain how you debriefed a second-chair after a lost trial day.", d: 'core' },
]);
add('Slow Cooker', 'presenting', [
  { t: "Walk through your annual litigation report to the executive committee.", d: 'core' },
  { t: "Tell the firm-wide story of the practice group's defining year.", d: 'core' },
  { t: "Explain how you opened the CLE on FCPA defense in front of 200 in-house lawyers.", d: 'intro' },
]);
add('Slow Cooker', 'persuasion', [
  { t: "Walk through the closing argument that turned the jury in the second week.", d: 'core' },
  { t: "Tell the story of how you sold the GC on a high-risk trial strategy.", d: 'core' },
  { t: "Explain how you persuaded a hostile board to authorize a global settlement.", d: 'stretch' },
]);
add('Slow Cooker', 'storytelling', [
  { t: "Tell the story of the trial where the verdict came in at three in the morning.", d: 'core' },
]);
add('Slow Cooker', 'asking_questions', [
  { t: "Walk through how you opened the deposition that broke the case.", d: 'core' },
  { t: "Tell the story of the custodian interview that surfaced the hidden archive.", d: 'core' },
  { t: "Explain how you crossed the hostile expert without losing the jury.", d: 'intro' },
]);

// Strategic Pause
add('Strategic Pause', 'explaining', [
  { t: "Explain to your client what the verdict actually means for their next two years.", d: 'core' },
  { t: "Walk the board through what an SEC inquiry will look like for the next six months.", d: 'core' },
  { t: "Explain to the GC how a deferred prosecution agreement reshapes their compliance program.", d: 'intro' },
]);
add('Strategic Pause', 'handling_objections', [
  { t: "Address opposing counsel's claim that your trial strategy is overreaching — pause where it matters.", d: 'core' },
  { t: "Respond to the judge's skepticism about your motion in limine, using the pause for emphasis.", d: 'core' },
]);
add('Strategic Pause', 'confidence', [
  { t: "Tell the client they're going to trial, and let the silence land.", d: 'intro' },
  { t: "Pitch yourself for first-chair on a bet-the-company matter and pause before the close.", d: 'core' },
]);
add('Strategic Pause', 'thinking_on_the_spot', [
  { t: "The judge asks why opposing counsel got a privileged document. Pause, then answer.", d: 'core' },
  { t: "The mediator asks what your client's bottom number is. Pause, then deliver.", d: 'core' },
]);
add('Strategic Pause', 'giving_feedback', [
  { t: "Tell the associate, with a deliberate pause, what their brief is missing.", d: 'core' },
  { t: "Coach the second-chair on their opening; pause before the toughest point.", d: 'core' },
  { t: "Tell the paralegal what to redo on the binder; pause before the why.", d: 'intro' },
]);
add('Strategic Pause', 'negotiation', [
  { t: "Counter opposing counsel's indemnity demand; pause before the number.", d: 'core' },
  { t: "Open the mediation with a pause that sets the stakes.", d: 'core' },
]);
add('Strategic Pause', 'presenting', [
  { t: "Open the board meeting with a pause before the verdict.", d: 'core' },
  { t: "Brief the executive committee on the federal subpoena; pause where it matters.", d: 'core' },
]);
add('Strategic Pause', 'storytelling', [
  { t: "Tell the firm-wide story of the trial; pause on the moment the jury turned.", d: 'core' },
  { t: "Recount the deposition turn at the partners' retreat; pause before the answer.", d: 'core' },
  { t: "Tell the recruiting class about your most memorable courtroom moment; pause before the punchline.", d: 'intro' },
]);
add('Strategic Pause', 'asking_questions', [
  { t: "Open the cross with a question, then pause for the answer.", d: 'core' },
  { t: "Ask the custodian about the missing drive; pause before the follow-up.", d: 'intro' },
]);

// Tempo Shift
add('Tempo Shift', 'explaining', [
  { t: "Explain to the GC how a 30(b)(6) deposition is scoped, then accelerate into how prep actually works.", d: 'core' },
  { t: "Walk a board through the privilege log, slowly, then accelerate into the production timeline.", d: 'core' },
  { t: "Explain the protective order's mechanics, then shift into how it changes the trial calendar.", d: 'intro' },
]);
add('Tempo Shift', 'handling_objections', [
  { t: "Slow when you address the judge's relevance objection; speed up on the legal authority.", d: 'core' },
  { t: "Slow on the GC's claim that the firm is over-litigating; speed up on the data that refutes it.", d: 'core' },
  { t: "Slow on opposing counsel's claim of work-product abuse; speed up on the rule that defeats it.", d: 'intro' },
]);
add('Tempo Shift', 'confidence', [
  { t: "Open slow on why you should first-chair the trial; accelerate into the case theory.", d: 'core' },
  { t: "Open slow on why your team is ready; accelerate into the trial calendar.", d: 'core' },
  { t: "Slow on the case theory; speed up on the verdict you're chasing.", d: 'intro' },
]);
add('Tempo Shift', 'thinking_on_the_spot', [
  { t: "Slow when the judge asks a question you didn't prepare for; speed up on the authority.", d: 'core' },
  { t: "Slow when the mediator floats a bracket you can't accept; speed up on the counter.", d: 'core' },
  { t: "Slow when opposing counsel hands you an unexpected exhibit; speed up on the rebuttal.", d: 'intro' },
]);
add('Tempo Shift', 'giving_feedback', [
  { t: "Slow on the praise for the associate; speed up on what they need to redo.", d: 'core' },
  { t: "Slow on the second-chair's strengths; speed up on the gaps in their cross.", d: 'core' },
  { t: "Slow on the paralegal's wins this month; speed up on the privilege log fixes.", d: 'intro' },
]);
add('Tempo Shift', 'negotiation', [
  { t: "Slow on the indemnity package's structure; speed up on the cap and the basket.", d: 'core' },
  { t: "Open slow on the mediator's framing; accelerate into your client's bottom line.", d: 'core' },
  { t: "Slow on the regulator's posture; speed up on your counteroffer.", d: 'intro' },
]);
add('Tempo Shift', 'storytelling', [
  { t: "Slow on the morning of the breach; speed up on the cover-up.", d: 'core' },
]);
add('Tempo Shift', 'asking_questions', [
  { t: "Slow on the foundation questions at deposition; speed up on the impeachment block.", d: 'core' },
  { t: "Slow on background questions for the witness; speed up on the central event.", d: 'core' },
  { t: "Slow on the custodian's role; speed up on the missing data window.", d: 'intro' },
]);

// The Stretch
add('The Stretch', 'explaining', [
  { t: "Take your time explaining how a deferred prosecution agreement reshapes compliance for two years.", d: 'core' },
  { t: "Walk the GC unhurriedly through how an SEC parallel investigation unfolds.", d: 'core' },
  { t: "Take your time explaining how an MDL coordinates discovery across thirty plaintiffs.", d: 'intro' },
]);
add('The Stretch', 'handling_objections', [
  { t: "Stretch into your full response to opposing counsel's claim that the privilege log is overbroad.", d: 'core' },
]);
add('The Stretch', 'confidence', [
  { t: "Take your time telling the GC why your team is the right choice for the trial.", d: 'core' },
  { t: "Stretch into the case for first-chairing the bet-the-company matter.", d: 'core' },
  { t: "Tell the partners, unhurried, why you should keep the matter through verdict.", d: 'intro' },
]);
add('The Stretch', 'giving_feedback', [
  { t: "Take your time delivering the year-end review to a senior associate falling behind.", d: 'core' },
  { t: "Stretch into the coaching conversation with the second-chair after the lost motion.", d: 'core' },
]);
add('The Stretch', 'negotiation', [
  { t: "Take your time walking opposing counsel through the indemnity package you'll accept.", d: 'core' },
  { t: "Stretch into the mediator's bracket conversation without rushing the bottom line.", d: 'core' },
  { t: "Take your time pitching the global settlement to the hostile board.", d: 'stretch' },
]);
add('The Stretch', 'presenting', [
  { t: "Take your time presenting the year's litigation outcomes to the executive committee.", d: 'core' },
  { t: "Stretch into the firm-wide retelling of the trial that defined your year.", d: 'core' },
  { t: "Present the new conflicts protocol at the partners' meeting, unhurried.", d: 'intro' },
]);
add('The Stretch', 'persuasion', [
  { t: "Take your time on the closing argument's central image.", d: 'core' },
  { t: "Stretch into the appellate argument's strongest authority.", d: 'stretch' },
  { t: "Pitch the GC on trial over settlement, taking your time on the upside.", d: 'core' },
]);
add('The Stretch', 'asking_questions', [
  { t: "Stretch into the opening question of the deposition; let the witness fill the room.", d: 'core' },
  { t: "Take your time framing the cross-examination's first three questions.", d: 'core' },
  { t: "Stretch into the custodian interview's opening; let the silence pull the answer.", d: 'intro' },
]);

// Two-Beat Landing
add('Two-Beat Landing', 'explaining', [
  { t: "Explain why we filed the motion to compel — land on the two-beat.", d: 'core' },
  { t: "Walk the GC through the indemnity package — land on the two-beat.", d: 'core' },
  { t: "Explain to the client how the protective order works — land on the two-beat.", d: 'intro' },
]);
add('Two-Beat Landing', 'handling_objections', [
  { t: "Respond to opposing counsel's relevance objection — land on the two-beat.", d: 'core' },
  { t: "Address the judge's skepticism on the motion in limine — land on the two-beat.", d: 'core' },
  { t: "Answer the GC's pushback on firm billing — land on the two-beat.", d: 'intro' },
]);
add('Two-Beat Landing', 'confidence', [
  { t: "Tell the client we're going to trial — land on the two-beat.", d: 'intro' },
  { t: "Tell the partners the verdict is in — land on the two-beat.", d: 'core' },
]);
add('Two-Beat Landing', 'thinking_on_the_spot', [
  { t: "The judge asks why the deposition ran long — answer with a two-beat landing.", d: 'core' },
  { t: "The mediator asks for your bottom number — answer with a two-beat landing.", d: 'core' },
  { t: "Opposing counsel asks why you didn't object yesterday — answer with a two-beat landing.", d: 'intro' },
]);
add('Two-Beat Landing', 'giving_feedback', [
  { t: "Tell the associate what their brief needs — land on the two-beat.", d: 'core' },
  { t: "Coach the second-chair on their opening — land on the two-beat.", d: 'core' },
  { t: "Tell the paralegal to redo the privilege log — land on the two-beat.", d: 'intro' },
]);
add('Two-Beat Landing', 'presenting', [
  { t: "Open the board meeting on the verdict — land on the two-beat.", d: 'core' },
  { t: "Brief the executive committee on the federal subpoena — land on the two-beat.", d: 'core' },
  { t: "Present the firm's new conflicts protocol — land on the two-beat.", d: 'intro' },
]);
add('Two-Beat Landing', 'storytelling', [
  { t: "Tell the firm-wide story of the trial — land on the two-beat.", d: 'core' },
  { t: "Recount the deposition's turn at the partners' retreat — land on the two-beat.", d: 'core' },
  { t: "Tell the recruiting class about your most memorable courtroom moment — land on the two-beat.", d: 'intro' },
]);
add('Two-Beat Landing', 'asking_questions', [
  { t: "Open the deposition with a question — land on the two-beat.", d: 'core' },
  { t: "Cross the expert on assumptions — land on the two-beat.", d: 'core' },
  { t: "Ask the custodian about the missing drive — land on the two-beat.", d: 'intro' },
]);

// ============================================================
// STRUCTURE
// ============================================================

// Bottom Line First
add('Bottom Line First', 'explaining', [
  { t: "How does our protective order route opposing counsel's confidential ESI?", d: 'intro' },
  { t: "What does the new e-discovery rule require of our team?", d: 'core' },
  { t: "What does a deferred prosecution agreement actually do to a company's operations?", d: 'core' },
]);
add('Bottom Line First', 'handling_objections', [
  { t: "Bottom-line your response to opposing counsel's motion for sanctions.", d: 'core' },
  { t: "Bottom-line your answer to the judge's skepticism about your discovery responses.", d: 'core' },
  { t: "Bottom-line the GC's claim that the firm is over-litigating.", d: 'intro' },
]);
add('Bottom Line First', 'confidence', [
  { t: "Bottom-line why you should first-chair the trial.", d: 'intro' },
  { t: "Bottom-line why the firm should keep the matter through verdict.", d: 'core' },
  { t: "Bottom-line your trial team's win condition.", d: 'core' },
]);
add('Bottom Line First', 'presenting', [
  { t: "Bottom-line the executive committee on this quarter's matters.", d: 'core' },
  { t: "Bottom-line the firm's pitch to the new GC.", d: 'core' },
  { t: "Bottom-line tomorrow's board meeting on the regulatory inquiry.", d: 'intro' },
]);
add('Bottom Line First', 'persuasion', [
  { t: "Bottom-line your closing argument to the jury.", d: 'core' },
  { t: "Bottom-line the appellate argument to the panel.", d: 'stretch' },
  { t: "Bottom-line the case for trial to a settlement-leaning GC.", d: 'core' },
]);
add('Bottom Line First', 'storytelling', [
  { t: "Bottom-line the firm-wide story of last month's verdict.", d: 'core' },
  { t: "Bottom-line the deposition turn for the trial team.", d: 'intro' },
  { t: "Bottom-line the trial story for the recruiting class.", d: 'core' },
]);
add('Bottom Line First', 'asking_questions', [
  { t: "Bottom-line the cross-examination of the prosecution's lead witness.", d: 'core' },
  { t: "Bottom-line the deposition with one decisive question.", d: 'core' },
  { t: "Bottom-line the custodian interview on missing data.", d: 'intro' },
]);

// Compare and Contrast
add('Compare and Contrast', 'handling_objections', [
  { t: "A relevance objection vs a hearsay objection on the same email exhibit.", d: 'core' },
  { t: "Responding to opposing counsel's sanctions motion vs the judge's sua sponte order to show cause.", d: 'core' },
  { t: "Addressing a GC who's worried about billing vs one worried about exposure.", d: 'intro' },
]);
add('Compare and Contrast', 'confidence', [
  { t: "Telling the client we're settling vs telling them we're going to trial.", d: 'core' },
  { t: "Pitching yourself for first-chair on liability vs first-chair on damages.", d: 'core' },
  { t: "Defending the firm's litigation budget to an audit committee vs to the GC.", d: 'intro' },
]);
add('Compare and Contrast', 'giving_feedback', [
  { t: "Coaching an associate after a lost motion vs after a won one.", d: 'core' },
  { t: "Telling a paralegal about a privilege-log error vs about a missed deadline.", d: 'intro' },
  { t: "Reviewing a second-chair's cross vs their opening.", d: 'core' },
]);
add('Compare and Contrast', 'presenting', [
  { t: "Presenting verdict outcomes to the board vs to the partners.", d: 'core' },
  { t: "Briefing the GC on a regulatory subpoena vs a class action complaint.", d: 'core' },
  { t: "Opening a CLE on Daubert vs on FCPA defense.", d: 'intro' },
]);
add('Compare and Contrast', 'persuasion', [
  { t: "Persuading the jury with documents vs with witness testimony.", d: 'core' },
  { t: "Selling the GC on trial vs on a deferred prosecution.", d: 'core' },
  { t: "Convincing the mediator's bracket vs the opposing counsel's authority.", d: 'intro' },
]);
add('Compare and Contrast', 'storytelling', [
  { t: "Telling the trial story to the firm vs to a recruiting class.", d: 'core' },
  { t: "Recounting a verdict to the board vs to the partners' retreat.", d: 'core' },
  { t: "Walking through a deposition turn for the trial team vs for the GC.", d: 'intro' },
]);
add('Compare and Contrast', 'asking_questions', [
  { t: "Crossing a fact witness vs an expert witness on the same exhibit.", d: 'core' },
  { t: "Opening a deposition of a CEO vs a custodian on the same matter.", d: 'core' },
  { t: "Questioning a cooperating witness vs a hostile one at trial.", d: 'intro' },
]);

// Monroe's Motivated Sequence
add('Monroe\'s Motivated Sequence', 'explaining', [
  { t: "Walk the GC through why a litigation hold has to start today, not next week.", d: 'core' },
  { t: "Explain to the board why the privilege program needs an overhaul this quarter.", d: 'core' },
  { t: "Walk a new client through why the firm structures matters this way, not the way they expect.", d: 'intro' },
]);
add('Monroe\'s Motivated Sequence', 'handling_objections', [
  { t: "Address the partner's concern that the case is over-staffed by walking them to the alternative.", d: 'core' },
  { t: "Address the client's pushback on hourly billing with the alternative they'll actually accept.", d: 'core' },
  { t: "Address the GC's concern about firm exposure by walking through the solution.", d: 'intro' },
]);
add('Monroe\'s Motivated Sequence', 'confidence', [
  { t: "Convince yourself out loud that you're the right partner to first-chair the trial.", d: 'intro' },
  { t: "Walk the trial team through why they can win — and what they have to do today.", d: 'core' },
  { t: "Pitch the GC on why the firm should keep the matter and the path to verdict.", d: 'core' },
]);
add('Monroe\'s Motivated Sequence', 'thinking_on_the_spot', [
  { t: "The judge asks why your motion in limine should be granted. Walk her through to the relief.", d: 'core' },
  { t: "Opposing counsel asks why you won't stipulate. Walk them through to the alternative they need.", d: 'core' },
  { t: "The mediator asks for your bottom number. Walk her through the path to your client's yes.", d: 'intro' },
]);
add('Monroe\'s Motivated Sequence', 'giving_feedback', [
  { t: "Walk the associate from the problem in their brief to the rewrite that gets filed.", d: 'core' },
  { t: "Walk the second-chair from where their cross failed to the structure that succeeds.", d: 'core' },
  { t: "Walk the paralegal from the privilege-log error to the redo that holds up.", d: 'intro' },
]);
add('Monroe\'s Motivated Sequence', 'presenting', [
  { t: "Walk the board from the regulatory subpoena's arrival to the response plan you're proposing.", d: 'core' },
  { t: "Walk the executive committee from this quarter's verdicts to next year's strategy.", d: 'core' },
  { t: "Walk the partners' retreat from the year's losses to the practice's new direction.", d: 'intro' },
]);
add('Monroe\'s Motivated Sequence', 'storytelling', [
  { t: "Walk the jury from the morning of the breach to the verdict you want them to return.", d: 'core' },
  { t: "Walk the appellate panel from the trial court's error to the reversal you're asking for.", d: 'stretch' },
  { t: "Walk the firm-wide audience from the trial's lowest point to the verdict that turned it.", d: 'core' },
]);
add('Monroe\'s Motivated Sequence', 'asking_questions', [
  { t: "Walk the witness from the background to the central event with a sequence of questions.", d: 'core' },
  { t: "Walk the custodian from the retention policy to the missing drive with a question sequence.", d: 'core' },
  { t: "Walk the cross from the witness's prior statement to the impeachment with a sequence.", d: 'intro' },
]);

// Question Then Answer
add('Question Then Answer', 'handling_objections', [
  { t: "Why does opposing counsel object on hearsay even when the statement isn't offered for truth?", d: 'core' },
  { t: "Why does the judge sustain relevance objections that look weak on the record?", d: 'core' },
  { t: "Why does the GC push back on firm billing even when the matter is going well?", d: 'intro' },
]);
add('Question Then Answer', 'confidence', [
  { t: "Why do trial lawyers lose their nerve in front of appellate panels?", d: 'core' },
  { t: "Why do senior associates hesitate to take first chair even when they're ready?", d: 'core' },
  { t: "Why do litigators second-guess themselves on closing-argument structure?", d: 'intro' },
]);
add('Question Then Answer', 'giving_feedback', [
  { t: "Why do associates resist feedback on brief structure more than on substance?", d: 'core' },
  { t: "Why do second-chairs struggle with cross-examination feedback after a trial?", d: 'core' },
  { t: "Why do paralegals push back on privilege-log feedback more than other corrections?", d: 'intro' },
]);
add('Question Then Answer', 'presenting', [
  { t: "Why does the executive committee tune out litigation reports faster than transactional ones?", d: 'core' },
  { t: "Why does the board want fewer slides on verdicts and more on regulatory exposure?", d: 'core' },
  { t: "Why do partners' meetings get derailed when conflicts come up?", d: 'intro' },
]);
add('Question Then Answer', 'persuasion', [
  { t: "Why does the jury believe the witness who pauses more than the witness who answers fast?", d: 'core' },
  { t: "Why do appellate panels reverse on procedure more often than on substance?", d: 'stretch' },
  { t: "Why does the mediator's bracket move further when one side is silent?", d: 'core' },
]);
add('Question Then Answer', 'storytelling', [
  { t: "Why does the deposition story land harder than the trial transcript?", d: 'core' },
  { t: "Why does the verdict tell a different story than the closing argument?", d: 'core' },
  { t: "Why does the firm's retelling of a trial change three times in the first year?", d: 'intro' },
]);
add('Question Then Answer', 'asking_questions', [
  { t: "Why does the best deposition question always look obvious in hindsight?", d: 'core' },
  { t: "Why does the cross collapse when the question runs three lines instead of one?", d: 'core' },
  { t: "Why does the custodian interview surface more in the second hour than the first?", d: 'intro' },
]);

// Signpost First
add('Signpost First', 'handling_objections', [
  { t: "Signpost how you'll respond to opposing counsel's claim that the privilege log is overbroad, then deliver it.", d: 'core' },
  { t: "Signpost your three-part response to the judge's skepticism on the motion in limine.", d: 'core' },
  { t: "Signpost how you'll address the GC's concern about firm billing, then walk through it.", d: 'intro' },
]);
add('Signpost First', 'confidence', [
  { t: "Signpost the three reasons you should first-chair the trial.", d: 'intro' },
  { t: "Signpost the case for keeping the matter through verdict, then deliver it.", d: 'core' },
  { t: "Signpost your trial team's plan for the next 60 days.", d: 'core' },
]);
add('Signpost First', 'thinking_on_the_spot', [
  { t: "The judge asks for your discovery plan. Signpost it, then deliver it on the record.", d: 'core' },
  { t: "The mediator asks for your authority. Signpost the structure, then disclose the number.", d: 'core' },
]);
add('Signpost First', 'giving_feedback', [
  { t: "Signpost the associate's strengths and the three things they need to redo on the brief.", d: 'core' },
  { t: "Signpost the second-chair's opening, then walk through the gaps.", d: 'core' },
  { t: "Signpost the paralegal's privilege-log progress, then explain what to redo.", d: 'intro' },
]);
add('Signpost First', 'negotiation', [
  { t: "Signpost the indemnity package's three moving pieces before the counteroffer.", d: 'core' },
  { t: "Signpost the mediator's bracket against your client's authority, then move.", d: 'core' },
]);
add('Signpost First', 'presenting', [
  { t: "Signpost the board meeting's three agenda items on the regulatory inquiry.", d: 'core' },
  { t: "Signpost the executive committee briefing on this quarter's verdicts.", d: 'core' },
  { t: "Signpost the firm-wide email on the new conflicts protocol.", d: 'intro' },
]);
add('Signpost First', 'persuasion', [
  { t: "Signpost the three reasons the appellate panel should reverse, then deliver them.", d: 'stretch' },
  { t: "Signpost the closing argument's three themes for the jury, then deliver them.", d: 'core' },
]);
add('Signpost First', 'storytelling', [
  { t: "Signpost the three turns in the trial story, then tell it firm-wide.", d: 'core' },
  { t: "Signpost the deposition's three movements for the trial team.", d: 'core' },
  { t: "Signpost your career's three defining matters for the recruiting class.", d: 'intro' },
]);
add('Signpost First', 'asking_questions', [
  { t: "Signpost the cross-examination's three blocks before the first question.", d: 'core' },
  { t: "Signpost the deposition's three movements before the witness sits down.", d: 'core' },
]);

// The 3 Point Rule
add('The 3 Point Rule', 'explaining', [
  { t: "Give three reasons the new e-discovery protocol changes how your team prepares matters.", d: 'core' },
  { t: "Give three reasons the privilege log structure has to change this quarter.", d: 'core' },
  { t: "Give three reasons a deferred prosecution agreement is more invasive than clients expect.", d: 'intro' },
]);
add('The 3 Point Rule', 'handling_objections', [
  { t: "Give three reasons opposing counsel's motion to disqualify fails on the record.", d: 'core' },
  { t: "Give three reasons the judge should reconsider the in limine ruling on the financial documents.", d: 'core' },
]);
add('The 3 Point Rule', 'confidence', [
  { t: "Give three reasons you're the right partner to first-chair the trial.", d: 'intro' },
  { t: "Give three reasons the trial team is ready for verdict.", d: 'core' },
  { t: "Give three reasons the firm should keep the matter through trial.", d: 'core' },
]);
add('The 3 Point Rule', 'thinking_on_the_spot', [
  { t: "The judge asks for three reasons we object to the exhibit. Give them.", d: 'core' },
  { t: "The mediator asks for three reasons your client won't move. Give them.", d: 'core' },
  { t: "Opposing counsel asks for three reasons we deserve sanctions relief. Give them.", d: 'intro' },
]);
add('The 3 Point Rule', 'giving_feedback', [
  { t: "Give three reasons the associate's brief is not yet filable.", d: 'core' },
  { t: "Give three reasons the second-chair's cross missed the witness's bias.", d: 'core' },
  { t: "Give three reasons the paralegal's binder needs another pass.", d: 'intro' },
]);
add('The 3 Point Rule', 'presenting', [
  { t: "Give the board three reasons to authorize the global settlement.", d: 'core' },
  { t: "Give the executive committee three reasons to increase litigation reserves.", d: 'core' },
  { t: "Give the partners three reasons to open a regulatory enforcement practice.", d: 'intro' },
]);
add('The 3 Point Rule', 'storytelling', [
  { t: "Tell the firm three reasons the trial's turn defined your year.", d: 'core' },
  { t: "Tell the recruiting class three reasons litigation is the most demanding practice.", d: 'core' },
  { t: "Tell the partners' retreat three reasons last quarter's verdict will reshape the practice.", d: 'intro' },
]);
add('The 3 Point Rule', 'asking_questions', [
  { t: "Ask the witness three questions that establish bias before the central event.", d: 'core' },
  { t: "Ask the custodian three questions that surface the missing drive.", d: 'core' },
  { t: "Ask the CFO three questions that establish what they knew before the disclosure.", d: 'intro' },
]);

// The Problem Solution Frame
add('The Problem Solution Frame', 'explaining', [
  { t: "Discovery costs are doubling. Frame the problem and explain the fix.", d: 'core' },
  { t: "Privilege-log quality is slipping. Frame the problem and explain the fix.", d: 'core' },
  { t: "Outside counsel spend is over budget by 30%. Frame the problem and explain the fix.", d: 'intro' },
]);
add('The Problem Solution Frame', 'confidence', [
  { t: "The trial team lost two associates in a month. Frame and solve.", d: 'core' },
  { t: "The firm's litigation win rate dropped this year. Frame and solve.", d: 'core' },
  { t: "The GC has lost confidence in the trial team. Frame and solve.", d: 'intro' },
]);
add('The Problem Solution Frame', 'giving_feedback', [
  { t: "The associate's briefs are consistently late. Frame the problem and propose the fix.", d: 'core' },
  { t: "The second-chair's cross style is hurting your trial outcomes. Frame and solve.", d: 'intro' },
]);
add('The Problem Solution Frame', 'negotiation', [
  { t: "The deal slipped at signing because of an indemnity dispute. Frame and solve.", d: 'core' },
  { t: "The mediator's bracket lands outside your client's authority. Frame and solve.", d: 'core' },
  { t: "Opposing counsel won't move on the survival period. Frame and solve.", d: 'intro' },
]);
add('The Problem Solution Frame', 'presenting', [
  { t: "The board wants fewer surprises about regulatory exposure. Frame and solve.", d: 'core' },
  { t: "The executive committee wants better visibility on outside counsel spend. Frame and solve.", d: 'core' },
  { t: "The partners want a unified pitch story across practice groups. Frame and solve.", d: 'intro' },
]);
add('The Problem Solution Frame', 'persuasion', [
  { t: "The jury is leaning the wrong way after week one. Frame and solve in closing.", d: 'core' },
  { t: "The appellate panel signaled skepticism in argument. Frame and solve in the reply brief.", d: 'stretch' },
  { t: "The GC wants to settle the case you can win at trial. Frame and solve.", d: 'core' },
]);
add('The Problem Solution Frame', 'storytelling', [
  { t: "Tell the firm-wide story of the trial where the witness collapsed — frame and solve.", d: 'core' },
  { t: "Recount the deal that almost died at signing — frame and solve.", d: 'core' },
  { t: "Tell the recruiting class about your hardest matter — frame and solve.", d: 'intro' },
]);
add('The Problem Solution Frame', 'asking_questions', [
  { t: "The witness is non-responsive on direct. Frame the problem and pose the next question.", d: 'core' },
  { t: "The custodian's retention answer doesn't match the documents. Frame and ask.", d: 'core' },
  { t: "The cross is bleeding without impeaching. Frame and ask the next question.", d: 'intro' },
]);

// The Story Arc
add('The Story Arc', 'explaining', [
  { t: "Walk through how a complex commercial trial unfolds from intake to verdict.", d: 'core' },
  { t: "Walk through the arc of an internal investigation from first interview to final report.", d: 'core' },
  { t: "Walk through the arc of an M&A deal from term sheet to closing.", d: 'intro' },
]);
add('The Story Arc', 'handling_objections', [
  { t: "Tell the story of the trial day the judge sustained every objection.", d: 'core' },
  { t: "Tell the story of the deposition where opposing counsel objected to every question.", d: 'core' },
  { t: "Tell the story of the matter the GC almost pulled because of firm billing.", d: 'intro' },
]);
add('The Story Arc', 'confidence', [
  { t: "Tell the story of the trial that made you a first-chair lawyer.", d: 'core' },
  { t: "Tell the story of the year you built your book of business from scratch.", d: 'core' },
  { t: "Tell the story of the matter where you held the line against everyone else's pressure to settle.", d: 'intro' },
]);
add('The Story Arc', 'thinking_on_the_spot', [
  { t: "Tell the story of the trial morning a key witness recanted in the witness room.", d: 'core' },
  { t: "Tell the story of the deposition where the witness produced a document you'd never seen.", d: 'core' },
  { t: "Tell the story of the closing argument you rewrote on the courthouse steps.", d: 'stretch' },
]);
add('The Story Arc', 'giving_feedback', [
  { t: "Tell the story of the associate who failed their first motion — and how you debriefed them.", d: 'core' },
  { t: "Tell the story of the second-chair who became a partner because of one tough conversation.", d: 'core' },
  { t: "Tell the story of the paralegal who reshaped the trial team after one piece of feedback.", d: 'intro' },
]);
add('The Story Arc', 'negotiation', [
  { t: "Tell the story of the mediation that broke through at three in the morning.", d: 'core' },
  { t: "Tell the story of the renegotiation that saved the deal after the regulatory letter.", d: 'core' },
  { t: "Tell the story of the indemnity fight that made you rewrite the firm's playbook.", d: 'stretch' },
]);
add('The Story Arc', 'presenting', [
  { t: "Tell the story of the board meeting where you delivered the verdict against the company.", d: 'core' },
  { t: "Tell the story of the executive committee briefing that changed the firm's litigation strategy.", d: 'core' },
  { t: "Tell the story of the CLE that made you rethink your trial-prep approach.", d: 'intro' },
]);
add('The Story Arc', 'persuasion', [
  { t: "Tell the story of the closing argument that turned the jury in week two.", d: 'core' },
  { t: "Tell the story of the appellate argument that reversed the trial court.", d: 'stretch' },
  { t: "Tell the story of how you persuaded the GC to authorize trial over settlement.", d: 'core' },
]);
add('The Story Arc', 'asking_questions', [
  { t: "Tell the story of the deposition that broke the case open in the third hour.", d: 'core' },
  { t: "Tell the story of the cross that turned the prosecution's lead witness into yours.", d: 'core' },
  { t: "Tell the story of the custodian interview that surfaced the missing drive.", d: 'intro' },
]);

// Two Then One
add('Two Then One', 'explaining', [
  { t: "Argue why the privilege log needs an overhaul this quarter.", d: 'core' },
  { t: "Argue why the firm's e-discovery vendor isn't working anymore.", d: 'core' },
  { t: "Argue why the new deferred prosecution policy changes the playbook.", d: 'intro' },
]);
add('Two Then One', 'handling_objections', [
  { t: "Argue why opposing counsel's motion to disqualify the firm fails.", d: 'core' },
  { t: "Argue why the judge should reconsider the protective order ruling.", d: 'core' },
  { t: "Argue why the GC's concerns about firm billing are misplaced.", d: 'intro' },
]);
add('Two Then One', 'confidence', [
  { t: "Argue why you should first-chair the upcoming trial.", d: 'intro' },
  { t: "Argue why your trial team should be staffed at full capacity.", d: 'core' },
  { t: "Argue why the firm should keep the matter through verdict.", d: 'core' },
]);
add('Two Then One', 'thinking_on_the_spot', [
  { t: "Argue, on the spot, why the deposition should run another two hours.", d: 'core' },
  { t: "Argue, on the spot, why the bench conference is the right move now.", d: 'core' },
  { t: "Argue, on the spot, why the mediator's bracket needs to move before lunch.", d: 'intro' },
]);
add('Two Then One', 'giving_feedback', [
  { t: "Argue why the associate's brief should be rewritten before filing.", d: 'core' },
  { t: "Argue why the second-chair's cross strategy needs an overhaul.", d: 'core' },
  { t: "Argue why the paralegal's privilege log needs a second pass.", d: 'intro' },
]);
add('Two Then One', 'presenting', [
  { t: "Argue why the board should authorize the global settlement.", d: 'core' },
  { t: "Argue why the executive committee should increase litigation reserves this year.", d: 'core' },
  { t: "Argue why the partners should fund the new regulatory enforcement group.", d: 'intro' },
]);
add('Two Then One', 'storytelling', [
  { t: "Tell the firm-wide story of the verdict, building to the central turn.", d: 'core' },
  { t: "Tell the recruiting class your trial story, building to the verdict you remember most.", d: 'core' },
  { t: "Tell the partners' retreat the year's trial story, building to what it taught the firm.", d: 'intro' },
]);
add('Two Then One', 'asking_questions', [
  { t: "Ask two foundation questions, then the central question that decides the cross.", d: 'core' },
  { t: "Ask two background questions of the custodian, then the question about missing data.", d: 'core' },
  { t: "Ask two warm-up questions of the CEO, then the question about the disclosure.", d: 'intro' },
]);

// ============================================================
// THINKING QUALITY
// ============================================================

// Disconfirm Yourself
add('Disconfirm Yourself', 'explaining', [
  { t: "You believe the protective order will hold up on appeal. What would tell you otherwise?", d: 'core' },
  { t: "You think the privilege log is bulletproof. What would prove it isn't?", d: 'core' },
  { t: "You believe the new e-discovery vendor is reducing costs. What would disconfirm that?", d: 'intro' },
]);
add('Disconfirm Yourself', 'handling_objections', [
  { t: "You believe opposing counsel's motion to disqualify fails. What would change your mind?", d: 'core' },
  { t: "You think the judge will reverse her relevance ruling. What would tell you she won't?", d: 'core' },
  { t: "You believe the GC's concerns about billing are misplaced. What would prove they aren't?", d: 'intro' },
]);
add('Disconfirm Yourself', 'confidence', [
  { t: "You believe you're the right partner to first-chair. What would tell you you're not?", d: 'intro' },
  { t: "You believe your trial team is ready. What would prove they aren't?", d: 'core' },
  { t: "You believe the firm should keep the matter. What would tell you to refer it out?", d: 'core' },
]);
add('Disconfirm Yourself', 'negotiation', [
  { t: "You believe the indemnity cap of 15% holds. What would tell you 12% is the right number?", d: 'core' },
  { t: "You believe the mediator's bracket is fair. What would prove it isn't?", d: 'core' },
  { t: "You believe opposing counsel's last offer is final. What would tell you they have more room?", d: 'intro' },
]);
add('Disconfirm Yourself', 'presenting', [
  { t: "You believe the board approves the global settlement. What would tell you they won't?", d: 'core' },
  { t: "You believe the executive committee wants more litigation detail. What would tell you they want less?", d: 'core' },
  { t: "You believe the firm's pitch story works for new GCs. What would prove it doesn't?", d: 'intro' },
]);
add('Disconfirm Yourself', 'persuasion', [
  { t: "You believe the jury accepts your trial theme. What would tell you they don't?", d: 'core' },
  { t: "You believe the appellate panel will reverse. What would disconfirm that?", d: 'stretch' },
  { t: "You believe the GC will authorize trial. What would prove she'll push you to settle?", d: 'core' },
]);
add('Disconfirm Yourself', 'storytelling', [
  { t: "You believe the firm-wide trial story lands. What would tell you it falls flat?", d: 'core' },
  { t: "You believe your deposition turn defines the case. What would prove it doesn't?", d: 'core' },
  { t: "You believe the recruiting class connects with your trial origin story. What would tell you they don't?", d: 'intro' },
]);

// Draw the Line
add('Draw the Line', 'explaining', [
  { t: "Where will outside counsel spend land for the year?", d: 'core' },
  { t: "How long will the consent decree actually shape compliance after it ends?", d: 'core' },
  { t: "Where does AI document review break the conventional discovery cost curve?", d: 'intro' },
]);
add('Draw the Line', 'handling_objections', [
  { t: "Predict how the magistrate rules on the discovery dispute set for Friday.", d: 'core' },
  { t: "Predict whether opposing counsel files for sanctions on the privilege log this quarter.", d: 'core' },
  { t: "Predict whether the GC pushes back on firm billing this fiscal year.", d: 'intro' },
]);
add('Draw the Line', 'confidence', [
  { t: "Predict whether you make first chair on the next bet-the-company trial.", d: 'intro' },
  { t: "Predict where your trial team's win rate lands this year.", d: 'core' },
  { t: "Predict whether the firm keeps the matter through trial or refers it out.", d: 'core' },
]);
add('Draw the Line', 'giving_feedback', [
  { t: "Predict whether the associate makes partner this cycle.", d: 'core' },
  { t: "Predict whether the second-chair takes first chair within two years.", d: 'core' },
  { t: "Predict whether the paralegal moves into a litigation manager role.", d: 'intro' },
]);
add('Draw the Line', 'negotiation', [
  { t: "Predict where the indemnity cap lands when the deal closes.", d: 'core' },
  { t: "Predict whether the mediator's final bracket moves before midnight.", d: 'core' },
  { t: "Predict whether opposing counsel pushes for arbitration in the next round.", d: 'intro' },
]);
add('Draw the Line', 'presenting', [
  { t: "Predict whether the board approves the global settlement this quarter.", d: 'core' },
  { t: "Predict whether the executive committee increases litigation reserves at year-end.", d: 'core' },
  { t: "Predict whether the partners fund a new regulatory enforcement group.", d: 'intro' },
]);
add('Draw the Line', 'persuasion', [
  { t: "Predict whether the jury convicts on the lead count.", d: 'core' },
  { t: "Predict whether the appellate panel reverses on procedural grounds.", d: 'stretch' },
  { t: "Predict whether the GC authorizes trial over settlement.", d: 'core' },
]);
add('Draw the Line', 'storytelling', [
  { t: "Predict whether the firm-wide retelling of the trial holds up at next year's retreat.", d: 'core' },
  { t: "Predict whether the deposition turn becomes part of the firm's recruiting pitch.", d: 'intro' },
  { t: "Predict whether the verdict reshapes how the practice tells its origin story.", d: 'core' },
]);

// First Principles
add('First Principles', 'handling_objections', [
  { t: "What is an objection actually for? Build the answer from scratch.", d: 'core' },
  { t: "What is the work-product doctrine really protecting, ignoring case law?", d: 'core' },
  { t: "What is a sanctions motion fundamentally accomplishing for the system?", d: 'intro' },
]);
add('First Principles', 'confidence', [
  { t: "What is a trial lawyer's confidence built on, fundamentally? Skip the inspirational answer.", d: 'core' },
  { t: "What does a first-chair lawyer actually owe the trial team, at the most basic level?", d: 'core' },
  { t: "What is the firm's reputation actually made of? Strip it to fundamentals.", d: 'intro' },
]);
add('First Principles', 'thinking_on_the_spot', [
  { t: "Why does the legal system put lawyers on their feet at all? Strip it to fundamentals.", d: 'core' },
  { t: "What is oral argument actually for, fundamentally?", d: 'core' },
  { t: "Why do trial lawyers need to think on their feet at all? Build the answer from zero.", d: 'intro' },
]);
add('First Principles', 'giving_feedback', [
  { t: "What is feedback to a junior associate actually for, at the most basic level?", d: 'core' },
  { t: "Why do partners need to coach second-chairs at all? Build the answer from zero.", d: 'core' },
  { t: "What is a year-end review actually accomplishing for a litigation associate?", d: 'intro' },
]);
add('First Principles', 'negotiation', [
  { t: "What is a negotiation actually trying to produce, fundamentally?", d: 'core' },
  { t: "Why does the legal system rely on settlement at all? Strip it to fundamentals.", d: 'core' },
  { t: "What is an indemnity package actually doing for the parties, fundamentally?", d: 'intro' },
]);
add('First Principles', 'presenting', [
  { t: "What is a litigation update to a board actually for? Build from zero.", d: 'core' },
  { t: "Why do partners' meetings exist at all? Strip them to fundamentals.", d: 'intro' },
  { t: "What is a CLE actually accomplishing for the profession?", d: 'core' },
]);
add('First Principles', 'persuasion', [
  { t: "What is persuasion in a courtroom fundamentally relying on? Skip the rhetoric.", d: 'core' },
  { t: "Why does a jury believe one lawyer over another? Build the answer from zero.", d: 'core' },
  { t: "What is the appellate brief actually trying to do, at its most basic level?", d: 'stretch' },
]);
add('First Principles', 'storytelling', [
  { t: "Why do trial lawyers tell stories at all? Build the answer from zero.", d: 'core' },
  { t: "What is a closing argument actually doing for the jury, fundamentally?", d: 'core' },
  { t: "Why do firms retell their best matters at every retreat? Strip it to fundamentals.", d: 'intro' },
]);

// Name the Assumption
add('Name the Assumption', 'explaining', [
  { t: "Argue that the privilege log structure no longer matches how the firm works.", d: 'core' },
  { t: "Argue that the firm's e-discovery vendor is operating on stale assumptions.", d: 'core' },
  { t: "Argue that the deferred prosecution playbook hasn't kept up with the new DOJ guidance.", d: 'intro' },
]);
add('Name the Assumption', 'handling_objections', [
  { t: "Argue that opposing counsel's motion to disqualify rests on an assumption that doesn't hold.", d: 'core' },
  { t: "Argue that the judge's skepticism on the in limine ruling assumes facts that aren't in the record.", d: 'core' },
  { t: "Argue that the GC's billing concerns assume a workload that no longer matches reality.", d: 'intro' },
]);
add('Name the Assumption', 'confidence', [
  { t: "Argue that you're the right partner for first-chair — name the assumption that makes you wrong.", d: 'intro' },
  { t: "Argue that the firm should keep the matter through trial — name what you're assuming about the client.", d: 'core' },
  { t: "Argue that your trial team is ready — name what you're assuming about the witnesses.", d: 'core' },
]);
add('Name the Assumption', 'thinking_on_the_spot', [
  { t: "The mediator asks for your client's bottom number. Name the assumption you're betting on.", d: 'core' },
]);
add('Name the Assumption', 'giving_feedback', [
  { t: "Argue the associate's brief assumes a holding the appellate panel hasn't reached.", d: 'core' },
  { t: "Argue the second-chair's cross assumes the witness will hold a position they've already abandoned.", d: 'core' },
  { t: "Argue the paralegal's privilege log assumes a custodian list that's no longer accurate.", d: 'intro' },
]);
add('Name the Assumption', 'presenting', [
  { t: "Argue the board's litigation report assumes a regulatory posture that's already shifted.", d: 'core' },
  { t: "Argue the executive committee's reserve model assumes a settlement rate that's outdated.", d: 'core' },
  { t: "Argue the partners' pitch story assumes a GC profile that no longer exists.", d: 'intro' },
]);
add('Name the Assumption', 'storytelling', [
  { t: "Argue the firm-wide trial story assumes a turn the recruits won't recognize.", d: 'core' },
  { t: "Argue the partners' retreat retelling assumes a verdict significance that's faded.", d: 'core' },
  { t: "Argue the recruiting class connects with a courtroom moment that no longer holds.", d: 'intro' },
]);
add('Name the Assumption', 'asking_questions', [
  { t: "Argue the deposition outline assumes a witness who will sit for six hours — and won't.", d: 'core' },
  { t: "Argue the cross assumes the witness's prior statement is impeaching — when it isn't.", d: 'core' },
  { t: "Argue the custodian interview assumes a retention policy that the IT team never enforced.", d: 'intro' },
]);

// Order of Magnitude
add('Order of Magnitude', 'explaining', [
  { t: "How many custodians does an average mid-size litigation actually preserve from?", d: 'core' },
  { t: "How many depositions does a typical commercial trial need?", d: 'core' },
  { t: "How many privilege log entries can a single reviewer realistically code per hour?", d: 'intro' },
]);
add('Order of Magnitude', 'handling_objections', [
  { t: "How many discovery objections does a magistrate typically sustain per hearing?", d: 'core' },
  { t: "How many motions to compel does a typical class action see before trial?", d: 'core' },
  { t: "How many GC pushbacks on billing does an average matter generate per year?", d: 'intro' },
]);
add('Order of Magnitude', 'confidence', [
  { t: "How many first-chair trials does a senior associate need to be partnership-ready?", d: 'intro' },
  { t: "How many billable hours does a healthy litigation partner clock in a year?", d: 'core' },
  { t: "How many losses does it take before a litigator loses their nerve?", d: 'core' },
]);
add('Order of Magnitude', 'giving_feedback', [
  { t: "How many year-end reviews does it take to move an associate's writing meaningfully?", d: 'core' },
  { t: "How many mock crosses does a second-chair need before they're trial-ready?", d: 'core' },
  { t: "How many privilege-log corrections does a paralegal typically need before the pattern sticks?", d: 'intro' },
]);
add('Order of Magnitude', 'negotiation', [
  { t: "How many indemnity rounds does an average M&A deal go through before signing?", d: 'core' },
  { t: "How many mediation sessions does a complex commercial dispute typically need?", d: 'core' },
  { t: "How many counteroffers does a regulatory settlement actually require?", d: 'intro' },
]);
add('Order of Magnitude', 'presenting', [
  { t: "How many slides should an annual litigation report to the board actually have?", d: 'core' },
  { t: "How many CLEs does an average partner deliver in a strong year?", d: 'core' },
  { t: "How many client pitches does a litigation group win per year to grow at industry rate?", d: 'intro' },
]);
add('Order of Magnitude', 'persuasion', [
  { t: "How many themes can a closing argument carry without losing the jury?", d: 'core' },
  { t: "How many cases does an appellate panel actually reverse per year on procedural grounds?", d: 'stretch' },
  { t: "How many counts does a federal prosecutor typically charge per matter?", d: 'core' },
]);
add('Order of Magnitude', 'storytelling', [
  { t: "How many trial moments make it into a partner's actual war-story repertoire?", d: 'intro' },
  { t: "How many times does a firm retell its biggest verdict before the story stabilizes?", d: 'core' },
  { t: "How many recruiting classes hear the same trial story from the same partner?", d: 'core' },
]);

// The Claim and Proof
add('The Claim and Proof', 'explaining', [
  { t: "Argue that the firm's privilege log structure is the strongest in the market — prove it.", d: 'core' },
  { t: "Argue that the new e-discovery vendor reduces costs by at least 30% — prove it.", d: 'core' },
  { t: "Argue that the deferred prosecution playbook is the right model for next year — prove it.", d: 'intro' },
]);
add('The Claim and Proof', 'handling_objections', [
  { t: "Claim that opposing counsel's motion to disqualify is meritless — prove it on the record.", d: 'core' },
  { t: "Claim that the judge's relevance ruling is reversible — prove it with authority.", d: 'core' },
  { t: "Claim that the GC's billing concerns are misplaced — prove it with the time entries.", d: 'intro' },
]);
add('The Claim and Proof', 'confidence', [
  { t: "Claim that you're the right partner for first-chair on the trial — prove it.", d: 'intro' },
  { t: "Claim that your trial team is ready for verdict — prove it.", d: 'core' },
  { t: "Claim that the firm should keep the matter through trial — prove it.", d: 'core' },
]);
add('The Claim and Proof', 'thinking_on_the_spot', [
  { t: "The judge asks for authority on your hearsay objection. Claim and prove.", d: 'core' },
  { t: "The mediator asks why your client won't move. Claim and prove on the spot.", d: 'core' },
  { t: "Opposing counsel demands you defend the sanctions motion. Claim and prove.", d: 'intro' },
]);
add('The Claim and Proof', 'giving_feedback', [
  { t: "Claim that the associate's brief is not yet filable — prove it line by line.", d: 'core' },
  { t: "Claim that the second-chair's cross missed the witness's bias — prove it from the transcript.", d: 'core' },
  { t: "Claim that the paralegal's privilege log needs a redo — prove it with three entries.", d: 'intro' },
]);
add('The Claim and Proof', 'presenting', [
  { t: "Claim that the board should authorize the global settlement — prove it.", d: 'core' },
  { t: "Claim that the executive committee should increase litigation reserves — prove it.", d: 'core' },
  { t: "Claim that the partners should open a regulatory enforcement group — prove it.", d: 'intro' },
]);
add('The Claim and Proof', 'storytelling', [
  { t: "Claim that the trial's turn defines the firm's year — prove it with the verdict.", d: 'core' },
  { t: "Claim that the deposition's third hour broke the case — prove it from the transcript.", d: 'core' },
  { t: "Claim that the closing argument moved three jurors — prove it from the verdict form.", d: 'intro' },
]);
add('The Claim and Proof', 'asking_questions', [
  { t: "Claim that one question on cross collapses the witness — prove it by asking it.", d: 'core' },
  { t: "Claim that the custodian interview will surface the missing drive — prove it with the sequence.", d: 'core' },
  { t: "Claim that the deposition's opening question wins the case — prove it by asking.", d: 'intro' },
]);

// The Perspective Shift
add('The Perspective Shift', 'explaining', [
  { t: "Explain the privilege log overhaul from the magistrate's chair.", d: 'core' },
  { t: "Explain the new e-discovery protocol from the perspective of the document reviewer.", d: 'core' },
  { t: "Explain the deferred prosecution agreement from the regulator's seat.", d: 'intro' },
]);
add('The Perspective Shift', 'handling_objections', [
  { t: "Argue opposing counsel's motion to disqualify as if you were filing it.", d: 'core' },
  { t: "Defend the judge's relevance ruling from the bench's perspective.", d: 'core' },
  { t: "Argue the GC's billing concerns from the audit committee's chair.", d: 'intro' },
]);
add('The Perspective Shift', 'confidence', [
  { t: "Defend the partner who passed on first-chairing the trial — from her chair.", d: 'core' },
  { t: "Argue as the trial team that's lost confidence in your strategy.", d: 'core' },
  { t: "Defend the GC who pushed back on the firm's trial budget.", d: 'intro' },
]);
add('The Perspective Shift', 'giving_feedback', [
  { t: "Defend the associate whose brief you sent back for a rewrite — from their seat.", d: 'core' },
  { t: "Argue as the second-chair you pulled off the cross at trial.", d: 'core' },
  { t: "Defend the paralegal whose privilege log you sent back twice.", d: 'intro' },
]);
add('The Perspective Shift', 'presenting', [
  { t: "Argue as the board member who voted against the global settlement.", d: 'core' },
  { t: "Defend the executive committee that froze litigation reserves this year.", d: 'core' },
  { t: "Argue as the partner who voted against opening the regulatory enforcement group.", d: 'intro' },
]);
add('The Perspective Shift', 'persuasion', [
  { t: "Argue as the juror who's holding out against your verdict.", d: 'core' },
  { t: "Defend the appellate panel that affirmed the verdict against your client.", d: 'stretch' },
  { t: "Argue as the GC who chose settlement over the trial you wanted.", d: 'core' },
]);
add('The Perspective Shift', 'storytelling', [
  { t: "Tell the trial story from the witness's seat, not your podium.", d: 'core' },
  { t: "Tell the deposition's turn from the deponent's perspective.", d: 'core' },
  { t: "Tell the firm-wide verdict story from the GC's chair.", d: 'intro' },
]);
add('The Perspective Shift', 'asking_questions', [
  { t: "Cross your witness as if you were opposing counsel.", d: 'core' },
  { t: "Question the custodian as if you were the IT director defending the retention policy.", d: 'core' },
  { t: "Ask the CFO about the disclosure as if you were the SEC staff attorney.", d: 'intro' },
]);

// The So What Test
add('The So What Test', 'explaining', [
  { t: "Walk through the new privilege log structure — and tell me why it changes how trials run.", d: 'core' },
  { t: "Explain the new e-discovery protocol — and tell me what it means for next year's budget.", d: 'core' },
]);
add('The So What Test', 'handling_objections', [
  { t: "List the discovery objections the magistrate sustained this week — and tell me what it means for trial.", d: 'core' },
  { t: "Recap the GC's billing pushback — and tell me what changes about how we staff the matter.", d: 'core' },
]);
add('The So What Test', 'confidence', [
  { t: "Tell me your trial team's win rate — and tell me what that means for the firm's pitch.", d: 'core' },
  { t: "Tell me how many first-chair trials you've run — and tell me what that means for partnership.", d: 'core' },
  { t: "Recap the firm's litigation outcomes — and tell me what they mean for next year's strategy.", d: 'intro' },
]);
add('The So What Test', 'giving_feedback', [
  { t: "Recap the associate's brief — and tell me what the rewrite has to deliver.", d: 'core' },
  { t: "Walk through the second-chair's cross — and tell me what they have to change.", d: 'core' },
  { t: "Recap the paralegal's privilege log — and tell me what the redo has to fix.", d: 'intro' },
]);
add('The So What Test', 'negotiation', [
  { t: "Recap the indemnity package's moving pieces — and tell me what's actually at stake.", d: 'core' },
  { t: "Walk through the mediator's bracket — and tell me what it means for your client's authority.", d: 'core' },
  { t: "Recap opposing counsel's last offer — and tell me what changes in your counter.", d: 'intro' },
]);
add('The So What Test', 'persuasion', [
  { t: "Recap the trial's turning points — and tell me what they mean for closing argument.", d: 'core' },
  { t: "Walk through the appellate record — and tell me what it means for the reversal argument.", d: 'stretch' },
  { t: "Recap the GC's posture on settlement — and tell me what it means for your pitch to trial.", d: 'core' },
]);
add('The So What Test', 'storytelling', [
  { t: "Walk through the firm-wide trial story — and tell me why it lands or doesn't.", d: 'core' },
]);
add('The So What Test', 'asking_questions', [
  { t: "Walk through the deposition's questions — and tell me which one matters for trial.", d: 'core' },
  { t: "Recap the cross — and tell me which question changed the case.", d: 'core' },
  { t: "Walk through the custodian interview — and tell me what surfaced and what didn't.", d: 'intro' },
]);

// The Steel Man
add('The Steel Man', 'explaining', [
  { t: "Steel man the privilege log structure the firm just abandoned.", d: 'core' },
  { t: "Steel man the e-discovery vendor the firm is about to replace.", d: 'core' },
  { t: "Steel man the deferred prosecution playbook the firm has been pushing for years.", d: 'intro' },
]);
add('The Steel Man', 'handling_objections', [
  { t: "Steel man opposing counsel's motion to disqualify the firm.", d: 'core' },
  { t: "Steel man the judge's skepticism on your motion in limine.", d: 'core' },
  { t: "Steel man the GC's claim that the firm is over-litigating.", d: 'intro' },
]);
add('The Steel Man', 'confidence', [
  { t: "Steel man the partner who didn't put you on first-chair for the trial.", d: 'core' },
  { t: "Steel man the trial team that doesn't think they're ready for verdict.", d: 'core' },
  { t: "Steel man the GC who wants to pull the firm off the matter.", d: 'intro' },
]);
add('The Steel Man', 'presenting', [
  { t: "Steel man the board member voting against the global settlement.", d: 'core' },
  { t: "Steel man the executive committee that froze litigation reserves this year.", d: 'core' },
  { t: "Steel man the partner blocking the new regulatory enforcement group.", d: 'intro' },
]);
add('The Steel Man', 'persuasion', [
  { t: "Steel man the juror who would vote to convict on count one.", d: 'core' },
  { t: "Steel man the appellate panel that would affirm the verdict against your client.", d: 'stretch' },
  { t: "Steel man the GC who chose settlement over the trial you wanted.", d: 'core' },
]);
add('The Steel Man', 'storytelling', [
  { t: "Steel man the firm-wide retelling of the verdict that didn't go your way.", d: 'core' },
  { t: "Steel man the deposition turn that the trial team thinks didn't matter.", d: 'core' },
  { t: "Steel man the trial moment the firm has stopped including in the recruiting pitch.", d: 'intro' },
]);
add('The Steel Man', 'asking_questions', [
  { t: "Steel man the deposition outline the trial team abandoned.", d: 'core' },
  { t: "Steel man the cross-examination structure your second-chair argued for.", d: 'core' },
  { t: "Steel man the custodian interview approach the firm is moving away from.", d: 'intro' },
]);

// ============================================================
// TONE
// ============================================================

// Authority Voice
add('Authority Voice', 'explaining', [
  { t: "Tell the trial team how the privilege log will be rebuilt before the next discovery deadline.", d: 'core' },
  { t: "Tell the GC how the firm will respond to the new e-discovery protocol.", d: 'core' },
  { t: "Tell the partners how the regulatory enforcement group will be staffed.", d: 'intro' },
]);
add('Authority Voice', 'handling_objections', [
  { t: "Tell opposing counsel the motion to disqualify is going to lose.", d: 'core' },
  { t: "Tell the judge, with authority, that the in limine ruling needs reconsideration.", d: 'core' },
  { t: "Tell the GC that the firm's billing on this matter is not the issue.", d: 'intro' },
]);
add('Authority Voice', 'thinking_on_the_spot', [
  { t: "The judge demands authority for your hearsay objection now. Deliver.", d: 'core' },
  { t: "The mediator demands your client's authority. Deliver.", d: 'core' },
  { t: "Opposing counsel demands a basis for your sanctions motion. Deliver.", d: 'intro' },
]);
add('Authority Voice', 'giving_feedback', [
  { t: "Tell the associate, with authority, that the brief is not yet filable.", d: 'core' },
  { t: "Tell the second-chair, with authority, that the cross has to change.", d: 'core' },
  { t: "Tell the paralegal, with authority, that the privilege log needs a redo.", d: 'intro' },
]);
add('Authority Voice', 'negotiation', [
  { t: "Tell opposing counsel, with authority, that the indemnity cap will not move.", d: 'core' },
]);
add('Authority Voice', 'presenting', [
  { t: "Tell the executive committee, with authority, that litigation reserves must increase.", d: 'core' },
]);
add('Authority Voice', 'storytelling', [
  { t: "Tell the firm-wide audience, with authority, that the trial defined the year.", d: 'core' },
  { t: "Tell the recruiting class, with authority, that litigation will demand everything.", d: 'core' },
  { t: "Tell the partners' retreat, with authority, that the verdict reshaped the practice.", d: 'intro' },
]);
add('Authority Voice', 'asking_questions', [
  { t: "Cross the witness with the authority of a partner who knows the answer.", d: 'core' },
  { t: "Open the custodian interview with the authority of someone who's seen the data.", d: 'core' },
  { t: "Ask the CFO with the authority of a lawyer who's read the disclosure twice.", d: 'intro' },
]);

// Conviction Floor
add('Conviction Floor', 'explaining', [
  { t: "Explain the firm's privilege program with the conviction of someone who built it.", d: 'core' },
  { t: "Explain the new e-discovery protocol with the conviction of someone who designed it.", d: 'core' },
  { t: "Explain the deferred prosecution playbook with the conviction of someone who's run it.", d: 'intro' },
]);
add('Conviction Floor', 'handling_objections', [
  { t: "Address opposing counsel's claim with the conviction of someone who's seen this fight before.", d: 'core' },
  { t: "Respond to the judge's skepticism with the conviction of a lawyer who's read every relevant case.", d: 'core' },
  { t: "Address the GC's billing concerns with the conviction of someone who knows every entry.", d: 'intro' },
]);
add('Conviction Floor', 'thinking_on_the_spot', [
  { t: "The judge asks why we object now. Answer with conviction.", d: 'core' },
  { t: "The mediator asks for your client's authority. Answer with conviction.", d: 'core' },
  { t: "Opposing counsel demands justification for the sanctions motion. Answer with conviction.", d: 'intro' },
]);
add('Conviction Floor', 'giving_feedback', [
  { t: "Tell the associate the brief needs a rewrite — with conviction, not hesitation.", d: 'core' },
]);
add('Conviction Floor', 'negotiation', [
  { t: "Counter opposing counsel's indemnity demand with the conviction of someone who's run this deal type before.", d: 'core' },
]);
add('Conviction Floor', 'presenting', [
  { t: "Open the board meeting on the global settlement with conviction.", d: 'core' },
  { t: "Brief the executive committee on litigation reserves with conviction.", d: 'core' },
  { t: "Present the firm's new conflicts protocol at the partners' meeting with conviction.", d: 'intro' },
]);
add('Conviction Floor', 'storytelling', [
  { t: "Tell the trial story to the firm with conviction, not nostalgia.", d: 'core' },
  { t: "Recount the deposition turn at the partners' retreat with conviction.", d: 'core' },
  { t: "Tell the recruiting class about your most memorable courtroom moment with conviction.", d: 'intro' },
]);
add('Conviction Floor', 'asking_questions', [
  { t: "Open the cross with a question delivered with conviction.", d: 'core' },
]);

// Curiosity Lift
add('Curiosity Lift', 'explaining', [
  { t: "Walk through the new privilege protocol with the curiosity of someone still testing it.", d: 'core' },
  { t: "Explain how the new e-discovery vendor is reshaping costs — out loud, still figuring it out.", d: 'core' },
  { t: "Explain the deferred prosecution playbook as something the firm is still iterating on.", d: 'intro' },
]);
add('Curiosity Lift', 'handling_objections', [
  { t: "Address opposing counsel's motion with the curiosity of someone genuinely working through it.", d: 'core' },
  { t: "Respond to the judge's concern by thinking out loud about why the rule applies.", d: 'core' },
  { t: "Address the GC's billing concerns with curiosity about what's actually driving the spend.", d: 'intro' },
]);
add('Curiosity Lift', 'confidence', [
  { t: "Talk about why you should first-chair the trial as a question you're still answering.", d: 'core' },
  { t: "Tell the team your case theory as something you're still pressure-testing.", d: 'core' },
  { t: "Brief the partners on the matter as something you're still curious about.", d: 'intro' },
]);
add('Curiosity Lift', 'giving_feedback', [
  { t: "Coach the associate on the brief with the curiosity of someone still discovering its strengths.", d: 'core' },
  { t: "Walk the second-chair through the cross with curiosity about why it almost worked.", d: 'core' },
  { t: "Tell the paralegal about the privilege-log redo with curiosity about the pattern.", d: 'intro' },
]);
add('Curiosity Lift', 'negotiation', [
  { t: "Counter opposing counsel's indemnity demand with curiosity about why they're stuck on the number.", d: 'core' },
  { t: "Engage the mediator with the curiosity of someone still exploring the bracket.", d: 'core' },
  { t: "Open the renegotiation with curiosity about what the regulatory letter actually changed.", d: 'intro' },
]);
add('Curiosity Lift', 'presenting', [
  { t: "Open the board meeting on the global settlement with curiosity about the alternatives.", d: 'core' },
  { t: "Brief the executive committee on litigation reserves with curiosity about the model.", d: 'core' },
  { t: "Present the firm's new conflicts protocol with curiosity about how it'll behave in practice.", d: 'intro' },
]);
add('Curiosity Lift', 'persuasion', [
  { t: "Convince the jury with the curiosity of a lawyer still discovering the truth.", d: 'core' },
  { t: "Pitch the GC on trial with the curiosity of someone still exploring the upside.", d: 'core' },
  { t: "Persuade the partners with the curiosity of someone still asking the right question.", d: 'intro' },
]);
add('Curiosity Lift', 'storytelling', [
  { t: "Tell the trial story with the curiosity of someone still trying to understand the verdict.", d: 'core' },
  { t: "Recount the deposition turn with curiosity about why the witness broke.", d: 'core' },
  { t: "Tell the recruiting class about your most memorable matter with curiosity, not certainty.", d: 'intro' },
]);
add('Curiosity Lift', 'asking_questions', [
  { t: "Open the cross with the curiosity of a lawyer still discovering the witness's story.", d: 'core' },
  { t: "Question the custodian with curiosity about how the data actually moved.", d: 'core' },
  { t: "Ask the CFO with the curiosity of a lawyer still building the timeline.", d: 'intro' },
]);

// Downward Landing
add('Downward Landing', 'handling_objections', [
  { t: "Respond to opposing counsel's motion to disqualify with a definitive downward landing.", d: 'core' },
  { t: "Address the judge's relevance objection with finality.", d: 'core' },
  { t: "Answer the GC's billing concerns with a clean downward landing.", d: 'intro' },
]);
add('Downward Landing', 'confidence', [
  { t: "Tell the trial team you're first-chairing the case — land definitively.", d: 'core' },
  { t: "Tell the GC the firm will see the matter through verdict — land definitively.", d: 'core' },
]);
add('Downward Landing', 'thinking_on_the_spot', [
  { t: "The judge asks why we object. Answer and land.", d: 'core' },
]);
add('Downward Landing', 'giving_feedback', [
  { t: "Tell the associate the brief needs a rewrite — and land it.", d: 'core' },
  { t: "Coach the second-chair on their opening — land the feedback.", d: 'core' },
  { t: "Tell the paralegal to redo the privilege log — land the directive.", d: 'intro' },
]);
add('Downward Landing', 'negotiation', [
  { t: "Counter opposing counsel's indemnity demand — land the number.", d: 'core' },
  { t: "Open the mediation with a definitive framing.", d: 'core' },
  { t: "Tell the GC the firm's bottom-line settlement number — land it.", d: 'intro' },
]);
add('Downward Landing', 'presenting', [
  { t: "Open the board meeting on the verdict — land the headline.", d: 'core' },
  { t: "Brief the executive committee on the federal subpoena — land the headline.", d: 'core' },
]);
add('Downward Landing', 'persuasion', [
  { t: "Open the closing argument — land the central image.", d: 'core' },
  { t: "Lead the appellate argument — land the central authority.", d: 'stretch' },
  { t: "Pitch the GC on trial over settlement — land the verdict you're chasing.", d: 'core' },
]);
add('Downward Landing', 'storytelling', [
  { t: "Tell the firm-wide trial story — land the verdict.", d: 'core' },
  { t: "Recount the deposition turn at the partners' retreat — land the answer.", d: 'core' },
]);
add('Downward Landing', 'asking_questions', [
  { t: "Open the cross — land the first question on the floor.", d: 'core' },
  { t: "Question the custodian about the missing drive — land the follow-up.", d: 'core' },
  { t: "Ask the CFO about the disclosure — land the question with no upward inflection.", d: 'intro' },
]);

// Pivot Tone
add('Pivot Tone', 'explaining', [
  { t: "Walk the GC through the privilege log overhaul, then shift to the trial calendar.", d: 'core' },
  { t: "Explain the new e-discovery protocol, then pivot to what it means for next year's matters.", d: 'intro' },
]);
add('Pivot Tone', 'handling_objections', [
  { t: "Respond to opposing counsel's motion to disqualify, then pivot to your counter.", d: 'core' },
  { t: "Address the judge's relevance objection, then pivot to the authority that wins.", d: 'core' },
  { t: "Answer the GC's billing concerns, then pivot to the structure that fixes them.", d: 'intro' },
]);
add('Pivot Tone', 'confidence', [
  { t: "Open by telling the trial team they're ready, then pivot to what they still have to do.", d: 'core' },
  { t: "Open by telling the GC you'll see it through verdict, then pivot to the costs.", d: 'core' },
  { t: "Open by telling the partners the matter is going well, then pivot to the risks.", d: 'intro' },
]);
add('Pivot Tone', 'giving_feedback', [
  { t: "Open the review with the associate's wins, then pivot to the rewrite the brief needs.", d: 'core' },
  { t: "Open with the second-chair's strengths, then pivot to the cross-examination gaps.", d: 'core' },
  { t: "Open with the paralegal's progress, then pivot to the privilege-log fixes.", d: 'intro' },
]);
add('Pivot Tone', 'negotiation', [
  { t: "Open with what's working in opposing counsel's package, then pivot to what changes.", d: 'core' },
  { t: "Open with the mediator's framing, then pivot to your client's actual authority.", d: 'core' },
  { t: "Open with the regulator's posture, then pivot to the counter your client will sign.", d: 'intro' },
]);
add('Pivot Tone', 'storytelling', [
  { t: "Tell the trial story warm, then pivot to the verdict cold.", d: 'core' },
  { t: "Recount the deposition turn warm, then pivot to the impeachment cold.", d: 'core' },
  { t: "Tell the recruiting class about your career warm, then pivot to what the practice demands.", d: 'intro' },
]);

// Read the Room
add('Read the Room', 'explaining', [
  { t: "Explain the privilege protocol — to the trial team, then to the GC.", d: 'core' },
]);
add('Read the Room', 'handling_objections', [
  { t: "Respond to opposing counsel's motion — to the judge in chambers, then on the record.", d: 'core' },
  { t: "Address the GC's billing concerns — privately, then at the audit committee.", d: 'core' },
]);
add('Read the Room', 'confidence', [
  { t: "Pitch yourself for first-chair — to your partner, then to the GC.", d: 'core' },
  { t: "Tell the trial team you're ready — privately, then at the firm-wide meeting.", d: 'core' },
]);
add('Read the Room', 'thinking_on_the_spot', [
  { t: "The judge asks why we object — answer for the bench, then for the jury in the moment.", d: 'core' },
  { t: "The mediator asks for your client's authority — answer for the mediator, then for opposing counsel.", d: 'core' },
  { t: "Opposing counsel hands you a new exhibit at deposition — respond to her, then to the witness.", d: 'intro' },
]);
add('Read the Room', 'giving_feedback', [
  { t: "Tell the associate the brief needs work — privately, then in the team meeting.", d: 'core' },
  { t: "Coach the second-chair on the cross — privately, then in front of the trial team.", d: 'core' },
  { t: "Tell the paralegal about the privilege log — privately, then to the discovery team.", d: 'intro' },
]);
add('Read the Room', 'negotiation', [
  { t: "Counter opposing counsel's indemnity demand — to her on the call, then to your client after.", d: 'core' },
]);
add('Read the Room', 'storytelling', [
  { t: "Tell the trial story — to the firm-wide retreat, then to a recruiting class.", d: 'core' },
]);
add('Read the Room', 'asking_questions', [
  { t: "Cross the witness — at trial, then in the deposition prep with your team.", d: 'core' },
  { t: "Question the custodian — in the formal interview, then in the follow-up call.", d: 'core' },
  { t: "Ask the CFO about the disclosure — in the formal meeting, then in the hallway.", d: 'intro' },
]);

// The Monotone Breaker
add('The Monotone Breaker', 'handling_objections', [
  { t: "Respond to opposing counsel's motion to disqualify with energy that won't let the room drift.", d: 'core' },
  { t: "Address the judge's relevance objection with vocal variation that holds the bench.", d: 'core' },
  { t: "Answer the GC's billing pushback with energy that doesn't sound defensive.", d: 'intro' },
]);
add('The Monotone Breaker', 'confidence', [
  { t: "Tell the trial team you're first-chairing the case with vocal energy that lands.", d: 'core' },
  { t: "Pitch yourself to the GC for the matter with vocal range that holds attention.", d: 'core' },
  { t: "Brief the partners on the case with energy that keeps the room.", d: 'intro' },
]);
add('The Monotone Breaker', 'giving_feedback', [
  { t: "Tell the associate the brief needs a rewrite with vocal variation that doesn't crush them.", d: 'core' },
  { t: "Coach the second-chair on cross with energy that lifts, not levels.", d: 'core' },
  { t: "Tell the paralegal about the privilege log with vocal range that motivates the redo.", d: 'intro' },
]);
add('The Monotone Breaker', 'negotiation', [
  { t: "Counter opposing counsel's indemnity demand with vocal range that won't bore the room.", d: 'core' },
  { t: "Open the mediation with energy that breaks the room's stasis.", d: 'core' },
  { t: "Pitch the GC on a structured settlement with vocal range that lands the upside.", d: 'intro' },
]);
add('The Monotone Breaker', 'persuasion', [
  { t: "Open closing with vocal energy that breaks the jury's two-week monotony.", d: 'core' },
  { t: "Pitch the GC on trial with vocal range that beats the settlement instinct.", d: 'core' },
  { t: "Persuade the appellate panel with vocal variation that survives the cold reading of the brief.", d: 'stretch' },
]);
add('The Monotone Breaker', 'storytelling', [
  { t: "Tell the trial story with vocal variation that earns the firm-wide silence.", d: 'core' },
  { t: "Recount the deposition turn with energy that survives the partners' retreat fatigue.", d: 'core' },
  { t: "Tell the recruiting class your origin story with vocal range that holds them through it.", d: 'intro' },
]);
add('The Monotone Breaker', 'asking_questions', [
  { t: "Cross the witness with vocal variation that keeps the jury on every word.", d: 'core' },
  { t: "Question the custodian with energy that won't let them disengage.", d: 'core' },
  { t: "Ask the CFO about the disclosure with vocal range that surfaces the answer.", d: 'intro' },
]);

// Volume Dial
add('Volume Dial', 'explaining', [
  { t: "Explain the privilege protocol — quietly to the team, then louder for the firm-wide call.", d: 'core' },
  { t: "Explain the new e-discovery protocol — softly to the GC, then loudly at the board meeting.", d: 'core' },
  { t: "Explain the deferred prosecution playbook — quietly to a new lateral, then loudly at a CLE.", d: 'intro' },
]);
add('Volume Dial', 'handling_objections', [
  { t: "Respond to opposing counsel's motion — softly in chambers, loudly on the record.", d: 'core' },
  { t: "Address the judge's skepticism — quietly at sidebar, loudly in open court.", d: 'core' },
  { t: "Answer the GC's billing concerns — softly in the meeting, loudly at the audit committee.", d: 'intro' },
]);
add('Volume Dial', 'thinking_on_the_spot', [
  { t: "The judge asks why we object — answer softly first, then deliver the rule loudly.", d: 'core' },
  { t: "The mediator asks for your authority — answer softly, then deliver the number with confidence.", d: 'core' },
  { t: "Opposing counsel hands you a new exhibit — respond softly, then loudly object.", d: 'intro' },
]);
add('Volume Dial', 'giving_feedback', [
  { t: "Tell the associate the brief needs a rewrite — softly in private, more firmly in team review.", d: 'core' },
  { t: "Coach the second-chair on the cross — softly in prep, more loudly in front of the team.", d: 'core' },
  { t: "Tell the paralegal about the privilege log — quietly in private, firmly with the discovery team.", d: 'intro' },
]);
add('Volume Dial', 'negotiation', [
  { t: "Counter opposing counsel's indemnity demand — softly on the call, more loudly at signing.", d: 'core' },
  { t: "Open the mediation softly, then deliver your client's bottom line loudly.", d: 'core' },
  { t: "Pitch the GC on the settlement — quietly in the meeting, loudly at the board.", d: 'intro' },
]);
add('Volume Dial', 'asking_questions', [
  { t: "Cross the witness — softly on the warm-up, loudly on the impeachment.", d: 'core' },
  { t: "Question the custodian — quietly on retention, loudly on the missing drive.", d: 'core' },
  { t: "Ask the CFO about the disclosure — softly on background, loudly on the signature.", d: 'intro' },
]);

// Warmth Switch
add('Warmth Switch', 'explaining', [
  { t: "Explain the privilege protocol warmly to your team, then formally to the GC.", d: 'core' },
  { t: "Explain the new e-discovery protocol warmly to a new associate, then formally to the partners.", d: 'core' },
  { t: "Explain the deferred prosecution playbook warmly to a junior litigator, then formally to a CLE.", d: 'intro' },
]);
add('Warmth Switch', 'handling_objections', [
  { t: "Respond to opposing counsel's motion warmly in the hallway, then formally on the record.", d: 'core' },
  { t: "Address the judge's skepticism warmly in chambers, then formally on the record.", d: 'core' },
  { t: "Answer the GC's billing concerns warmly on the call, then formally at the audit committee.", d: 'intro' },
]);
add('Warmth Switch', 'confidence', [
  { t: "Tell the trial team you're first-chairing warmly, then formally to the GC.", d: 'core' },
  { t: "Pitch yourself for the matter warmly to your partner, then formally to the client.", d: 'core' },
  { t: "Brief the partners warmly on the case in private, then formally at the meeting.", d: 'intro' },
]);
add('Warmth Switch', 'thinking_on_the_spot', [
  { t: "The judge asks why we object — answer warmly when appropriate, formally when on the record.", d: 'core' },
  { t: "The mediator asks for your authority — answer warmly, then formally for the record.", d: 'core' },
  { t: "Opposing counsel hands you a new exhibit — respond warmly to her, then formally on the transcript.", d: 'intro' },
]);
add('Warmth Switch', 'giving_feedback', [
  { t: "Tell the associate the brief needs work — warmly in private, professionally in the team meeting.", d: 'core' },
]);
add('Warmth Switch', 'negotiation', [
  { t: "Counter opposing counsel's indemnity demand warmly on the call, formally in the redline.", d: 'core' },
  { t: "Open the mediation warmly, then deliver the bottom line formally.", d: 'core' },
  { t: "Pitch the GC warmly on the settlement, then formally at the board meeting.", d: 'intro' },
]);
add('Warmth Switch', 'asking_questions', [
  { t: "Cross the witness with warmth that disarms, then formality that locks the answer.", d: 'core' },
  { t: "Question the custodian warmly on retention, formally on the missing drive.", d: 'core' },
  { t: "Ask the CFO warmly about background, formally about the disclosure signature.", d: 'intro' },
]);

// ============================================================
// Build appended prompts
// ============================================================

let appended = 0;
const difficultyCounts = { intro: 0, core: 0, stretch: 0 };
const unfilled = [];

for (const ex of gaps.exercises) {
  const catEx = findExercise(ex.dimension, ex.exerciseName);
  if (!catEx) { unfilled.push(`MISSING CATALOG ENTRY: ${ex.dimension}/${ex.exerciseName}`); continue; }
  const lib = L[ex.exerciseName] || {};
  for (const g of ex.gaps) {
    const pool = lib[g.goal];
    if (!pool || pool.length < 3) {
      unfilled.push(`${ex.exerciseName} / ${g.goal} (have ${pool ? pool.length : 0}, need 3)`);
      continue;
    }
    // Always emit 3 prompts per gap per the spec.
    const slice = pool.slice(0, 3);
    for (const item of slice) {
      const text = item.t.trim();
      if (text.length > 220) { unfilled.push(`TOO LONG: ${ex.exerciseName}/${g.goal} -> ${text.slice(0, 60)}...`); continue; }
      if (existing.has(text)) { unfilled.push(`DUPE: ${ex.exerciseName}/${g.goal} -> ${text.slice(0, 60)}...`); continue; }
      existing.add(text);
      catEx.prompts.push({ text, difficulty: item.d, tags: ['law', g.goal] });
      appended++;
      difficultyCounts[item.d]++;
    }
  }
}

fs.writeFileSync(CAT, JSON.stringify(cat, null, 2) + '\n', 'utf8');

console.log('Appended:', appended);
console.log('Difficulty:', difficultyCounts);
console.log('Unfilled (' + unfilled.length + '):');
for (const u of unfilled.slice(0, 50)) console.log(' -', u);
if (unfilled.length > 50) console.log(' ... and', unfilled.length - 50, 'more');
