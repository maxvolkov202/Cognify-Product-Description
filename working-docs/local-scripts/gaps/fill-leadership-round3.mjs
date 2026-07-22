#!/usr/bin/env node
// Round-3 leadership top-up: per (exercise, goal) author exactly `need` prompts.
// Authoring only. No seed.

import fs from "node:fs";
import path from "node:path";

const GAPS_PATH = path.resolve("scripts/gaps/leadership.json");
const CATALOG_PATH = path.resolve(
  "scripts/exercise-catalog/v1/vertical/leadership.json",
);

const gaps = JSON.parse(fs.readFileSync(GAPS_PATH, "utf8"));
const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));

// ---------------------------------------------------------------------------
// Prompt library: per (exerciseSlug, goal) -> array of {text, difficulty}.
// Each entry has >= 2 prompts; we slice `need`.
// Tags applied automatically: ["leadership", goal].
// ---------------------------------------------------------------------------

const LIB = {
  // ============================== CLARITY =================================
  "answer-the-confusion": {
    handling_objections: [
      { d: "core", t: "Your VP says hybrid hurts culture. Answer the real worry behind that line, not the slogan." },
      { d: "stretch", t: "A board member says your reorg signals panic. Answer the fear under the words." },
    ],
    confidence: [
      { d: "core", t: "A skip-level asks if you actually believe the plan. Answer in a way that settles the room." },
      { d: "intro", t: "A direct report asks if layoffs are coming. Answer the worry, not just the question." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec drops a surprise metric question in an offsite. Answer the actual confusion live." },
      { d: "stretch", t: "An activist investor asks a pointed question on the earnings call. Answer the confusion under it on the spot." },
    ],
    giving_feedback: [
      { d: "core", t: "A senior IC says your feedback felt vague. Answer the confusion they actually have, then redo it." },
      { d: "intro", t: "A new manager says they don't know what 'be more strategic' means. Answer the real confusion." },
    ],
    negotiation: [
      { d: "core", t: "A counter-party says your offer is insulting. Answer what they actually misread before re-pitching." },
      { d: "stretch", t: "A union rep says your comp letter feels like a trick. Answer the suspicion before the math." },
    ],
    presenting: [
      { d: "core", t: "Mid all-hands, an engineer says 'I don't understand the strategy'. Answer the actual confusion live." },
      { d: "intro", t: "After your town hall, an analyst asks what the headline meant. Answer the underlying confusion." },
    ],
    persuasion: [
      { d: "stretch", t: "Your CFO says the AI bet feels like FOMO. Answer the real doubt before you push the ask." },
    ],
    storytelling: [
      { d: "core", t: "Your team says your origin story didn't land. Answer the part that confused them, then retell it tighter." },
    ],
    asking_questions: [
      { d: "core", t: "A direct report asks why you keep asking 'what would you do?'. Answer the confusion behind the pattern." },
      { d: "intro", t: "A new hire asks why you skip status in 1:1s. Answer the confusion about what 1:1s are for." },
    ],
  },
  "explain-like-im-12": {
    handling_objections: [
      { d: "core", t: "An engineer says calibration is rigged. Explain in plain terms why it isn't, like they're new to the company." },
      { d: "intro", t: "A new hire says PIPs are firings in disguise. Explain plainly what a PIP actually is." },
    ],
    confidence: [
      { d: "core", t: "Explain to a nervous new manager what 'owning the room' actually looks like in a 1:1." },
      { d: "intro", t: "Explain to a junior IC what 'executive presence' really means, no buzzwords." },
    ],
    thinking_on_the_spot: [
      { d: "stretch", t: "An intern asks why CEOs answer hard questions fast. Explain what 'thinking on the spot' actually is." },
      { d: "core", t: "Explain to a first-time manager why pausing before answering isn't weakness." },
    ],
    giving_feedback: [
      { d: "core", t: "Explain to a new lead what 'kind and direct' feedback sounds like, with one tiny example." },
      { d: "intro", t: "Explain to a junior IC what SBI feedback means, no acronyms." },
    ],
    negotiation: [
      { d: "core", t: "Explain to a first-time manager what BATNA means using your own comp talk last cycle." },
      { d: "intro", t: "Explain to a new lead what 'walking away' actually looks like in a vendor call." },
    ],
    presenting: [
      { d: "core", t: "Explain to a junior PM what a 'narrative deck' is versus a slide dump." },
      { d: "intro", t: "Explain to a new hire what 'reading the room' looks like in an all-hands." },
    ],
    storytelling: [
      { d: "core", t: "Explain to a new manager why leaders open with a story instead of stats." },
      { d: "intro", t: "Explain to a junior IC what 'show don't tell' means in a status update." },
    ],
    asking_questions: [
      { d: "core", t: "Explain to a new manager why 'what's hard right now?' beats 'are things okay?' in a 1:1." },
      { d: "intro", t: "Explain to a junior IC what an 'open question' is, using a skip-level example." },
    ],
  },
  "headline-first": {
    explaining: [
      { d: "stretch", t: "Open the post-mortem on the outage with the headline before anyone asks 'what happened?'" },
    ],
    handling_objections: [
      { d: "core", t: "Your CFO says hiring is frozen. Lead with the headline that reframes the freeze before defending headcount." },
      { d: "intro", t: "A direct report says the deadline is impossible. Lead with the headline that resets the frame." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands after a missed quarter with the headline a confident leader would lead with." },
      { d: "intro", t: "Open your first skip-level with the headline that says who you are as a manager." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "A board member asks 'why should we trust this plan?' Headline first, then back it up." },
      { d: "stretch", t: "On a hot mic, a reporter asks if you're losing share. Headline first, on the spot." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Open a tough perf review with the headline before the SBI." },
    ],
    negotiation: [
      { d: "core", t: "Open the renewal call with the headline on price before walking through line items." },
      { d: "intro", t: "Open a comp conversation with a direct report by leading with the headline number." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR with the one-line headline the exec team will remember next quarter." },
      { d: "intro", t: "Open the all-hands with the headline before the agenda." },
    ],
    storytelling: [
      { d: "core", t: "Open your founding story with a headline sentence that tees up the arc." },
      { d: "intro", t: "Open your team's launch retro with the headline of the journey, not the timeline." },
    ],
    asking_questions: [
      { d: "core", t: "Open a 1:1 with the headline of what you want to learn, then ask the question." },
      { d: "intro", t: "Open a skip-level with the headline of the topic before asking your first question." },
    ],
  },
  "make-it-real": {
    explaining: [
      { d: "core", t: "Explain 'customer obsession' using a real ticket your team mishandled this month." },
      { d: "intro", t: "Explain what 'one team' means using a specific moment two teams collided last sprint." },
    ],
    handling_objections: [
      { d: "core", t: "An engineer says priorities shift weekly. Make it real with one example that proves them right and reframe it." },
      { d: "intro", t: "A peer says 1:1s are a waste. Make it real with one 1:1 where something actually shifted." },
    ],
    confidence: [
      { d: "core", t: "Tell your team you trust the plan and make it real with one decision you'd stake your job on." },
      { d: "intro", t: "Tell a direct report you believe in them by pointing to a real moment they earned it." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "On a Q&A, asked 'is the strategy real?' — answer with one concrete decision that proves it, live." },
      { d: "stretch", t: "An investor asks 'where's the moat?' — answer with a real customer story, on the spot." },
    ],
    giving_feedback: [
      { d: "core", t: "Tell a senior IC their PR reviews are slowing the team — make it real with one PR from last week." },
      { d: "intro", t: "Tell a new manager their 1:1s feel like status — make it real with one example from yesterday." },
    ],
    negotiation: [
      { d: "core", t: "Push back on the vendor's price hike using a real usage number from your dashboard." },
      { d: "intro", t: "Make a counteroffer to a direct report by pointing to a real promotion bar they cleared." },
    ],
    presenting: [
      { d: "core", t: "Open the strategy review with one real customer call that proves the bet." },
      { d: "intro", t: "Open the team meeting with one real metric that landed this week." },
    ],
    persuasion: [
      { d: "stretch", t: "Sell the board on a risky pivot using one real signal from the market this quarter." },
    ],
    storytelling: [
      { d: "core", t: "Tell the company a story about resilience using one real teammate who carried us through Q3." },
      { d: "intro", t: "Tell a new hire the team's story using a real war story from last year's launch." },
    ],
    asking_questions: [
      { d: "core", t: "Ask your skip-level about morale using a real moment you noticed in standup, not a survey result." },
      { d: "intro", t: "Ask a new report about blockers using a real artifact — a PR, a ticket, a doc." },
    ],
  },
  "no-jargon-allowed": {
    handling_objections: [
      { d: "core", t: "An IC says strategy is buzzwords. Answer the objection without using 'alignment', 'synergy', or 'leverage'." },
      { d: "intro", t: "A peer says your roadmap is fluff. Defend it with zero jargon." },
    ],
    confidence: [
      { d: "core", t: "Tell your team you've got the wheel — without saying 'I've got this', 'trust the process', or 'we got this'." },
      { d: "intro", t: "Open a tough 1:1 confidently without leaning on 'circle back' or 'sync'." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks why headcount is up. Answer in plain English with no 'capacity planning' or 'velocity'." },
      { d: "stretch", t: "A reporter asks about layoffs live. Answer with zero euphemisms — no 'right-sizing' or 'restructuring'." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Tell a senior IC they're not promoted — no 'scope', 'impact', 'narrative', or 'next cycle'." },
    ],
    negotiation: [
      { d: "core", t: "Push back on a vendor without 'value-add', 'TCO', or 'partnership'." },
      { d: "intro", t: "Offer a direct report a comp number with zero euphemisms — no 'investing in you' or 'market alignment'." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR without 'pipeline', 'flywheel', or 'north star'." },
      { d: "intro", t: "Open the all-hands without 'mission', 'execution', or 'cadence'." },
    ],
    storytelling: [
      { d: "core", t: "Tell the team how we won the deal — no 'cross-functional', 'wins', or 'leverage'." },
      { d: "intro", t: "Tell a new hire how the company started — no 'mission-driven' or 'disruption'." },
    ],
    asking_questions: [
      { d: "core", t: "Ask your direct report a hard question without 'bandwidth', 'circle back', or 'level-set'." },
      { d: "intro", t: "Ask your skip-level a hard question without 'pulse-check', 'sync', or 'touch base'." },
    ],
  },
  "one-point-only": {
    explaining: [
      { d: "stretch", t: "Explain the reorg in one point. Not three. One." },
    ],
    handling_objections: [
      { d: "core", t: "An IC says the layoffs were unfair. Make one point — the one that actually answers the objection." },
      { d: "intro", t: "A direct report says the timeline is unrealistic. Hold the line with one point only." },
    ],
    confidence: [
      { d: "core", t: "Open the calibration debrief with one confident point — no caveats, no hedging." },
      { d: "intro", t: "Open a tough 1:1 with one point you actually believe — nothing else." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks 'why are we still doing this?' Answer with one point on the spot." },
      { d: "stretch", t: "A board member asks 'what's your edge?' Answer with one point — live." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give a senior IC promotion feedback with one point only." },
    ],
    negotiation: [
      { d: "core", t: "Counter a comp request from a flight risk with one point only." },
      { d: "intro", t: "Push back on a vendor's renewal hike with one point only." },
    ],
    presenting: [
      { d: "core", t: "Open the board update with one point — the one number that matters." },
      { d: "intro", t: "Open the all-hands with one point about what this quarter is for." },
    ],
    persuasion: [
      { d: "stretch", t: "Sell your CFO on the new hire plan with one point only." },
    ],
    storytelling: [
      { d: "core", t: "Tell the launch story with one point of tension — not the whole arc." },
    ],
    asking_questions: [
      { d: "core", t: "Ask your skip-level a 1:1 question that surfaces one point only — no compound questions." },
      { d: "intro", t: "Ask a new report a calibration question that has one point and no follow-ons." },
    ],
  },
  "prove-it": {
    explaining: [
      { d: "core", t: "Explain why your team is high-performing — prove it with one metric and one story." },
      { d: "intro", t: "Explain why 1:1s matter — prove it with a moment one actually changed an outcome." },
    ],
    handling_objections: [
      { d: "core", t: "An engineer says the roadmap drifts. Prove it doesn't — with a date and a delivered artifact." },
      { d: "intro", t: "A peer says your team is overstaffed. Prove it isn't — with one workload number." },
    ],
    confidence: [
      { d: "core", t: "Tell the board you've got the right plan — prove it with one customer win and one talent win." },
      { d: "intro", t: "Tell your team you can lead this — prove it with one decision you made under fire." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks 'is morale really fine?' — prove it on the spot with a number and a quote." },
      { d: "stretch", t: "A reporter asks if churn is rising. Prove your answer live with one data point." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Tell a senior IC the bar is going up — prove it with one promotion that just landed." },
    ],
    negotiation: [
      { d: "core", t: "Push back on a vendor's price — prove your case with two competing quotes." },
      { d: "intro", t: "Counter a comp ask from a direct report — prove your number with one market benchmark." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR by proving the bet from last quarter paid off — one chart, one quote." },
      { d: "intro", t: "Open the team review by proving the past two sprints landed — one shipped item each." },
    ],
    asking_questions: [
      { d: "core", t: "Ask your direct report 'are you stretched?' — prove the question is real with one observation from this week." },
      { d: "intro", t: "Ask your skip-level 'is the team healthy?' — prove the question with one signal from your standup." },
    ],
  },
  "the-analogy-bridge": {
    handling_objections: [
      { d: "core", t: "Your CFO says the AI bet is reckless. Bridge with one analogy that reframes risk." },
      { d: "intro", t: "An IC says calibration is a black box. Bridge with one analogy that opens it." },
    ],
    confidence: [
      { d: "core", t: "Open a tough all-hands with one analogy that captures why you're confident in the path." },
      { d: "intro", t: "Tell a new manager what leadership feels like with one analogy from their world." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks 'what's your edge?' — bridge with one analogy live." },
      { d: "stretch", t: "A board member asks if AI changes our moat. Bridge with one analogy under time pressure." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give a senior IC stretch feedback by bridging with one analogy from their hobby." },
    ],
    negotiation: [
      { d: "core", t: "Hold a counter-offer with a vendor using one analogy that reframes 'fair price'." },
      { d: "intro", t: "Counter a comp ask from a direct report with one analogy about the promotion ladder." },
    ],
    presenting: [
      { d: "core", t: "Open the strategy review with one analogy that captures the whole bet in a sentence." },
      { d: "intro", t: "Open the team launch review with one analogy that frames the work as a journey." },
    ],
    asking_questions: [
      { d: "core", t: "Ask your direct report about burnout using one analogy — not a survey question." },
      { d: "intro", t: "Ask a peer about their team's morale using one analogy from sports or music." },
    ],
  },
  "the-word-budget": {
    handling_objections: [
      { d: "core", t: "Answer 'why are we reorging?' in 30 words. Use every one." },
      { d: "intro", t: "Defend the new comp band to a direct report in 30 words flat." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands after a missed quarter in 25 words. Confident, no hedge." },
      { d: "intro", t: "Open a 1:1 with bad news in 20 words. Steady tone." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks 'is the strategy working?' Answer live in 25 words." },
      { d: "stretch", t: "A reporter asks if you'd repeat the launch. Answer on camera in 20 words." },
    ],
    negotiation: [
      { d: "core", t: "Counter a renewal offer in 30 words. No fluff." },
      { d: "intro", t: "Counter a comp ask from a direct report in 25 words." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR in 30 words. Headline, signal, plan." },
      { d: "intro", t: "Open the all-hands in 25 words. Set the tone, set the topic." },
    ],
    persuasion: [
      { d: "core", t: "Sell your CFO on next year's headcount in 40 words." },
      { d: "intro", t: "Sell a peer leader on a joint initiative in 35 words." },
    ],
    storytelling: [
      { d: "core", t: "Tell the team's origin story in 50 words. Beginning, middle, end." },
      { d: "intro", t: "Tell a new hire your last launch story in 40 words." },
    ],
    asking_questions: [
      { d: "core", t: "Ask your skip-level about morale in 20 words. One question, no preamble." },
      { d: "intro", t: "Ask your direct report about blockers in 15 words. One sentence." },
    ],
  },

  // ============================ CONCISENESS ===============================
  "cut-by-half": {
    explaining: [
      { d: "core", t: "Explain your team's mission in 30 words, then cut to 15." },
      { d: "intro", t: "Explain what your team does to a new hire in 20 seconds, then cut to 10." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the headcount freeze in 40 words, then cut to 20." },
      { d: "intro", t: "Defend the new comp band to a direct report in 30 words, then cut to 15." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands in 40 words, then cut to 20. No hedge survives." },
      { d: "intro", t: "Open a 1:1 with hard news in 30 words, then cut to 15." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks 'is the bet working?' Answer in 40 words live, then redo in 20." },
      { d: "stretch", t: "On a hot mic, answer 'why this pivot?' in 40 words, then cut live to 20." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give perf-cycle feedback in 60 words, then cut to 30." },
    ],
    negotiation: [
      { d: "core", t: "Make a counter-offer to a flight risk in 40 words, then cut to 20." },
      { d: "intro", t: "Counter a vendor's renewal hike in 30 words, then cut to 15." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR in 60 seconds, then redo in 30." },
      { d: "intro", t: "Open the team meeting in 40 seconds, then redo in 20." },
    ],
    storytelling: [
      { d: "core", t: "Tell the launch story in 90 seconds, then cut to 45." },
      { d: "intro", t: "Tell a new hire your team's origin in 60 seconds, then cut to 30." },
    ],
    asking_questions: [
      { d: "core", t: "Ask your skip-level the one question that matters in 30 words, then cut to 15." },
      { d: "intro", t: "Ask a direct report about blockers in 20 words, then cut to 10." },
    ],
  },
  "kill-the-filler": {
    explaining: [
      { d: "core", t: "Explain the reorg without 'kind of', 'sort of', 'basically', or 'just'." },
      { d: "intro", t: "Explain to a new hire what your team owns — zero filler." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the layoff decision without 'unfortunately', 'honestly', or 'to be fair'." },
      { d: "intro", t: "Defend the bonus pool to a direct report — no 'honestly' allowed." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands without 'um', 'uh', 'so', or 'I mean'." },
      { d: "intro", t: "Open a 1:1 with bad news — no filler, no warm-up." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks 'why this strategy?' Answer live with zero filler." },
      { d: "stretch", t: "On a board call, answer 'are we losing share?' with zero filler." },
    ],
    giving_feedback: [
      { d: "core", t: "Tell a senior IC their PR reviews are slow — zero filler." },
      { d: "intro", t: "Tell a new manager their 1:1s are status — zero filler." },
    ],
    negotiation: [
      { d: "core", t: "Counter a renewal hike with the vendor — zero filler." },
      { d: "intro", t: "Counter a comp ask from a direct report — zero filler." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR with zero filler in the first 60 seconds." },
      { d: "intro", t: "Open the team meeting with zero filler in the first 30 seconds." },
    ],
    persuasion: [
      { d: "stretch", t: "Sell the board on the new headcount plan with zero filler." },
    ],
    asking_questions: [
      { d: "core", t: "Ask a 1:1 question with zero filler — no 'just curious' or 'wondering'." },
      { d: "intro", t: "Ask a peer leader about their roadmap with zero filler." },
    ],
  },
  "no-hedging": {
    handling_objections: [
      { d: "core", t: "Defend the freeze without 'I think', 'maybe', 'probably', or 'we'll see'." },
      { d: "intro", t: "Defend the deadline to a direct report — no hedges." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands after a miss — no hedges, no qualifiers." },
      { d: "intro", t: "Open a 1:1 with a calibration update — no hedges." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks 'will we hit Q4?' Answer live without 'we should' or 'I hope'." },
      { d: "stretch", t: "On the earnings call, answer 'is growth back?' with zero hedges." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Tell a senior IC they aren't promoted — no hedging." },
    ],
    negotiation: [
      { d: "core", t: "Counter a vendor's renewal hike — no hedges." },
      { d: "intro", t: "Counter a comp ask from a direct report — no hedges." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR with no hedges — the plan, the bet, the ask." },
      { d: "intro", t: "Open the all-hands with no hedges in the first minute." },
    ],
    persuasion: [
      { d: "stretch", t: "Pitch the board on the AI bet without 'might', 'could', or 'we'd hope'." },
    ],
    storytelling: [
      { d: "core", t: "Tell the launch story without hedging on the wins." },
      { d: "intro", t: "Tell a new hire the team's origin without hedging on what worked." },
    ],
    asking_questions: [
      { d: "core", t: "Ask your skip-level about morale without 'I'm just curious' or 'maybe'." },
      { d: "intro", t: "Ask your direct report about blockers without 'I'm wondering' or 'kind of'." },
    ],
  },
  "no-throat-clearing": {
    explaining: [
      { d: "stretch", t: "Explain the reorg in the first sentence. No 'as you know', no 'I want to share'." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the comp freeze. First sentence is the answer — no warm-up." },
      { d: "intro", t: "Defend the deadline. No 'great question' before the answer." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands. First sentence is the message — no 'thanks for being here'." },
      { d: "intro", t: "Open a 1:1 with a hard topic. No 'I just wanted to chat' opener." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks the hard question. Skip 'great question' — answer." },
      { d: "stretch", t: "A reporter asks about layoffs. First sentence is the answer." },
    ],
    negotiation: [
      { d: "core", t: "Open the renewal call. First sentence is the price — no warm-up." },
      { d: "intro", t: "Open a comp talk with a direct report. No 'I wanted to check in' before the number." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR. First sentence is the headline — no agenda recap." },
      { d: "intro", t: "Open the team meeting. First sentence is the topic — no 'let's see'." },
    ],
    persuasion: [
      { d: "stretch", t: "Pitch the board the AI bet. First sentence is the ask — no preamble." },
    ],
    storytelling: [
      { d: "core", t: "Tell the launch story. First sentence is the tension — no setup." },
      { d: "intro", t: "Tell a new hire your origin. First sentence is the moment — no resume." },
    ],
    asking_questions: [
      { d: "core", t: "Ask your skip-level a hard question. No 'I just wanted to ask' — ask." },
      { d: "intro", t: "Ask your direct report about blockers. No 'curious how things are' — ask." },
    ],
  },
  "one-idea-per-response": {
    explaining: [
      { d: "stretch", t: "Explain the reorg in one idea per answer. The exec will ask follow-ups." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze with one idea. If they push, give the next one — not all at once." },
      { d: "intro", t: "Defend the deadline with one idea. Let them probe." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands with one idea. The Q&A handles the rest." },
      { d: "intro", t: "Open a 1:1 with one idea. Let the report respond before adding more." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks 'why this strategy?' Answer with one idea, then stop." },
      { d: "stretch", t: "A board member asks the hard one. One idea, then silence." },
    ],
    negotiation: [
      { d: "core", t: "Counter a renewal hike with one point. Let them respond." },
      { d: "intro", t: "Counter a comp ask with one point. Let the report respond." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR with one idea per slide for the first three slides." },
      { d: "intro", t: "Open the all-hands with one idea per minute for the first three." },
    ],
    persuasion: [
      { d: "stretch", t: "Pitch the board with one idea per turn. They'll ask the next question." },
    ],
    asking_questions: [
      { d: "core", t: "Ask your skip-level one question at a time. No compound questions." },
      { d: "intro", t: "Ask a direct report one question at a time in the 1:1." },
    ],
  },
  "subject-verb-object": {
    handling_objections: [
      { d: "core", t: "Defend the freeze in pure subject-verb-object. No clauses. No qualifiers." },
      { d: "intro", t: "Defend the deadline in pure SVO. Three sentences max." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands in SVO. 'We did. We learned. We will.'" },
      { d: "intro", t: "Open a 1:1 in SVO. Three short lines." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks the hard one. Answer in SVO live. Three sentences." },
      { d: "stretch", t: "A reporter asks about churn. Answer in SVO on camera." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give a senior IC perf feedback in pure SVO. Three sentences." },
    ],
    negotiation: [
      { d: "core", t: "Counter a vendor's renewal in pure SVO. Three sentences max." },
      { d: "intro", t: "Counter a comp ask in pure SVO. Three lines." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR in SVO for the first 60 seconds." },
      { d: "intro", t: "Open the team meeting in SVO for the first 30 seconds." },
    ],
    persuasion: [
      { d: "core", t: "Pitch the new headcount plan in pure SVO. No qualifiers." },
      { d: "intro", t: "Pitch your peer leader on a joint project in SVO." },
    ],
    storytelling: [
      { d: "stretch", t: "Tell the launch story in SVO. 'We saw. We built. We won.'" },
    ],
    asking_questions: [
      { d: "core", t: "Ask your skip-level in SVO. One subject, one verb, one object." },
      { d: "intro", t: "Ask a direct report in SVO. One question, three words minimum." },
    ],
  },
  "the-30-second-rule": {
    handling_objections: [
      { d: "core", t: "Defend the freeze in 30 seconds. Time yourself." },
      { d: "intro", t: "Defend the comp band to a direct report in 30 seconds." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands in 30 seconds. The rest can wait." },
      { d: "intro", t: "Open a 1:1 with a hard topic in 30 seconds." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks the surprise question. Answer in 30 seconds live." },
      { d: "stretch", t: "A reporter asks about layoffs. Answer in 30 seconds on camera." },
    ],
    giving_feedback: [
      { d: "core", t: "Give perf feedback to a senior IC in 30 seconds. Time it." },
      { d: "intro", t: "Give a new manager feedback on their first 1:1 in 30 seconds." },
    ],
    negotiation: [
      { d: "core", t: "Counter a vendor's renewal hike in 30 seconds." },
      { d: "intro", t: "Counter a comp ask from a direct report in 30 seconds." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR in 30 seconds. The rest is detail." },
      { d: "intro", t: "Open the all-hands in 30 seconds. Then the agenda." },
    ],
    storytelling: [
      { d: "core", t: "Tell the launch story in 30 seconds. The arc, not the calendar." },
      { d: "intro", t: "Tell a new hire your team's origin in 30 seconds." },
    ],
    asking_questions: [
      { d: "core", t: "Ask your skip-level the one big question in 30 seconds — context plus ask." },
      { d: "intro", t: "Ask a direct report a 1:1 question in 30 seconds — context plus ask." },
    ],
  },
  "the-hard-stop": {
    explaining: [
      { d: "core", t: "Explain the freeze and stop talking. Resist the urge to add 'does that make sense?'" },
      { d: "intro", t: "Explain to a new hire what your team owns. Stop. Let them ask." },
    ],
    handling_objections: [
      { d: "core", t: "Answer the objection and stop. Don't follow up with 'thoughts?'" },
      { d: "intro", t: "Defend the deadline once. Stop. Let them respond." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands message. Hard stop. Let the silence land." },
      { d: "intro", t: "Open a 1:1 with hard news. Stop. Wait." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. You answer. Hard stop. No 'happy to dig deeper'." },
      { d: "stretch", t: "On the earnings call, answer the analyst. Hard stop. No softener." },
    ],
    negotiation: [
      { d: "core", t: "State your counter. Hard stop. Let them respond." },
      { d: "intro", t: "State your comp number to a direct report. Hard stop." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR with the headline. Hard stop. Let the room sit with it." },
      { d: "intro", t: "Open the team meeting with the topic. Hard stop." },
    ],
    storytelling: [
      { d: "stretch", t: "End the launch story on the moment of decision. No moral. No bow." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level question. Hard stop. Let them think." },
      { d: "intro", t: "Ask the 1:1 question. Hard stop. Don't rescue them." },
    ],
  },
  "the-single-sentence": {
    handling_objections: [
      { d: "core", t: "Defend the freeze in one sentence." },
      { d: "intro", t: "Defend the deadline to a direct report in one sentence." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands in one sentence." },
      { d: "intro", t: "Open a 1:1 with hard news in one sentence." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Answer in one sentence live." },
      { d: "stretch", t: "A board member asks the hard one. Answer in one sentence." },
    ],
    negotiation: [
      { d: "core", t: "Counter the vendor's renewal in one sentence." },
      { d: "intro", t: "Counter a direct report's comp ask in one sentence." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR in one sentence." },
      { d: "intro", t: "Open the all-hands in one sentence." },
    ],
    persuasion: [
      { d: "core", t: "Sell the board on next year's plan in one sentence." },
      { d: "intro", t: "Sell a peer leader on a joint initiative in one sentence." },
    ],
    storytelling: [
      { d: "core", t: "Tell the launch story in one sentence." },
      { d: "intro", t: "Tell your team's origin in one sentence." },
    ],
    asking_questions: [
      { d: "core", t: "Ask your skip-level the one question that matters in one sentence." },
      { d: "intro", t: "Ask your direct report a 1:1 question in one sentence." },
    ],
  },

  // ============================== PACING ==================================
  "beat-the-buzzer": {
    explaining: [
      { d: "stretch", t: "Explain the reorg in 45 seconds. The buzzer doesn't care about your nuance." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze in 45 seconds. Buzzer ends you." },
      { d: "intro", t: "Defend the deadline in 30 seconds." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands in 60 seconds — beat the clock." },
      { d: "intro", t: "Open a 1:1 with hard news in 30 seconds." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks the surprise. Answer in 45 seconds, buzzer." },
      { d: "stretch", t: "On a board panel, answer the hard one in 30 seconds. Beat the gavel." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give perf feedback in 60 seconds. Buzzer." },
    ],
    negotiation: [
      { d: "core", t: "Counter a vendor's renewal in 45 seconds. Buzzer." },
      { d: "intro", t: "Counter a comp ask in 30 seconds." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR in 60 seconds. Buzzer." },
      { d: "intro", t: "Open the team meeting in 30 seconds." },
    ],
    storytelling: [
      { d: "core", t: "Tell the launch story in 60 seconds. Beat the buzzer." },
      { d: "intro", t: "Tell the team's origin in 45 seconds." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level question in 20 seconds — context plus ask." },
      { d: "intro", t: "Ask the 1:1 question in 15 seconds." },
    ],
  },
  "metronome": {
    handling_objections: [
      { d: "core", t: "Defend the freeze at a steady 120 words per minute. No surge, no drag." },
      { d: "intro", t: "Defend the deadline at one beat per syllable. Stay even." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands at a metronome pace — same tempo first sentence to last." },
      { d: "intro", t: "Open a 1:1 with bad news at a metronome — no rush." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec presses you. Answer at a metronome — don't speed up under pressure." },
      { d: "stretch", t: "A reporter pushes hard. Hold the tempo across the answer." },
    ],
    negotiation: [
      { d: "core", t: "State the counter at a metronome — don't accelerate at the price." },
      { d: "intro", t: "Walk the comp number at a metronome — don't rush past it." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR at a metronome for the first minute." },
      { d: "intro", t: "Open the team meeting at a metronome for the first 30 seconds." },
    ],
    persuasion: [
      { d: "stretch", t: "Pitch the board at a metronome — don't speed up at the ask." },
    ],
    storytelling: [
      { d: "core", t: "Tell the launch story at a metronome — even tempo across the arc." },
      { d: "intro", t: "Tell the team's origin at a metronome." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level question at a metronome — don't rush the ask." },
      { d: "intro", t: "Ask the 1:1 question at a metronome." },
    ],
  },
  "punctuation-breathing": {
    explaining: [
      { d: "core", t: "Explain the reorg, breathing at every period. Run-ons disqualify." },
      { d: "intro", t: "Explain what your team does, breathing at every comma." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze, breathing at every period." },
      { d: "intro", t: "Defend the deadline, breathing at every comma." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands breathing at every period. No rushed sentences." },
      { d: "intro", t: "Open a 1:1 with bad news breathing at every comma." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Answer breathing at every period." },
      { d: "stretch", t: "A reporter asks. Hold the breaths under pressure." },
    ],
    giving_feedback: [
      { d: "core", t: "Give perf feedback breathing at every period. Let it land." },
      { d: "intro", t: "Give a new manager feedback breathing at every comma." },
    ],
    negotiation: [
      { d: "core", t: "Counter the renewal breathing at every period." },
      { d: "intro", t: "Counter the comp ask breathing at every comma." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR breathing at every period." },
      { d: "intro", t: "Open the all-hands breathing at every comma." },
    ],
    persuasion: [
      { d: "core", t: "Pitch the board breathing at every period — make the ask land." },
      { d: "intro", t: "Pitch a peer leader breathing at every comma." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level question, breathing at the comma before the ask." },
      { d: "intro", t: "Ask the 1:1 question, breathing at the period after." },
    ],
  },
  "silence-over-filler": {
    explaining: [
      { d: "core", t: "Explain the reorg with silence in place of every 'um' or 'so'." },
      { d: "intro", t: "Explain what your team owns — substitute silence for filler." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze. Where filler would go, sit in silence." },
      { d: "intro", t: "Defend the deadline. Use silence where 'I mean' would land." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands. Use silence at every filler-craving moment." },
      { d: "intro", t: "Open a 1:1 with hard news using silence instead of 'so, yeah'." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Sit in 2 seconds of silence before answering." },
      { d: "stretch", t: "On the board call, pause 3 seconds before the hard answer." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give perf feedback with deliberate silence in place of every hedge." },
    ],
    negotiation: [
      { d: "core", t: "State the counter, then silence. No filler after the price." },
      { d: "intro", t: "State the comp number, then silence. Don't rescue it." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR with two beats of silence before the headline." },
      { d: "intro", t: "Open the all-hands with one beat of silence before the topic." },
    ],
    storytelling: [
      { d: "stretch", t: "Tell the launch story with a 3-second silence at the turning point." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level question, then silence. Don't fill it." },
      { d: "intro", t: "Ask the 1:1 question, then silence. Wait for them." },
    ],
  },
  "slow-cooker": {
    explaining: [
      { d: "core", t: "Explain the reorg at half your normal pace. Don't summarize fast — slow-cook it." },
      { d: "intro", t: "Explain what your team owns at half pace." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze at half pace. Let each sentence land." },
      { d: "intro", t: "Defend the deadline at half pace. Don't rush the reason." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands at half pace — confidence comes from slow." },
      { d: "intro", t: "Open a 1:1 with hard news at half pace." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Answer at half pace — don't rush under pressure." },
      { d: "stretch", t: "On the board, hold the slow pace through the hard answer." },
    ],
    negotiation: [
      { d: "core", t: "Walk the counter at half pace. Let the price land." },
      { d: "intro", t: "Walk the comp number at half pace." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR at half pace for the first minute." },
      { d: "intro", t: "Open the team meeting at half pace for the first 30 seconds." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level question at half pace. Slow-cook the setup." },
      { d: "intro", t: "Ask the 1:1 question at half pace." },
    ],
  },
  "strategic-pause": {
    explaining: [
      { d: "core", t: "Explain the reorg with a 2-second pause before the punchline of each sentence." },
      { d: "intro", t: "Explain what your team owns with one strategic pause before the key word." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze with a strategic pause before the reason." },
      { d: "intro", t: "Defend the deadline with a strategic pause before the date." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands with a strategic pause before the headline." },
      { d: "intro", t: "Open a 1:1 with a strategic pause before the hard sentence." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Pause 3 seconds, then answer. Don't apologize for the pause." },
      { d: "stretch", t: "On the press call, pause 3 seconds before the hard answer." },
    ],
    giving_feedback: [
      { d: "core", t: "Give perf feedback with a strategic pause before the rating." },
      { d: "intro", t: "Give a new manager feedback with a pause before the headline." },
    ],
    negotiation: [
      { d: "core", t: "Pause 3 seconds before stating the counter price." },
      { d: "intro", t: "Pause 2 seconds before stating the comp number." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR with a strategic pause before the bet." },
      { d: "intro", t: "Open the all-hands with a strategic pause before the topic." },
    ],
    persuasion: [
      { d: "stretch", t: "Pitch the board with a strategic pause before the ask." },
    ],
    storytelling: [
      { d: "core", t: "Tell the launch story with a strategic pause at the moment of choice." },
      { d: "intro", t: "Tell the team's origin with a strategic pause at the turning point." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level question with a 2-second pause before the verb." },
      { d: "intro", t: "Ask the 1:1 question with a pause before the noun." },
    ],
  },
  "tempo-shift": {
    explaining: [
      { d: "stretch", t: "Explain the reorg — slow on stakes, fast on logistics." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze — fast on context, slow on the reason." },
      { d: "intro", t: "Defend the deadline — fast on logistics, slow on the why." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands — slow on the headline, faster on the plan." },
      { d: "intro", t: "Open a 1:1 — slow on the bad news, faster on the next step." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Slow on the answer, faster on the rationale." },
      { d: "stretch", t: "On the board, slow on the verdict, faster on the proof." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give perf feedback — slow on the rating, faster on the plan." },
    ],
    negotiation: [
      { d: "core", t: "Counter the renewal — slow on the price, faster on the terms." },
      { d: "intro", t: "Counter the comp ask — slow on the number, faster on the rationale." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR — slow on the bet, faster on the data." },
      { d: "intro", t: "Open the all-hands — slow on the topic, faster on the agenda." },
    ],
    storytelling: [
      { d: "core", t: "Tell the launch story — slow at the choice, faster on the journey." },
      { d: "intro", t: "Tell the team's origin — slow on the spark, faster on the build." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level question — slow on the topic, faster on the ask." },
      { d: "intro", t: "Ask the 1:1 question — slow on the context, faster on the ask." },
    ],
  },
  "the-stretch": {
    explaining: [
      { d: "core", t: "Explain the reorg, stretching each key word so it lands. No mumble-throughs." },
      { d: "intro", t: "Explain what your team owns, stretching the verbs." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze, stretching the reason word so it lands." },
      { d: "intro", t: "Defend the deadline, stretching the date." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands, stretching the headline noun." },
      { d: "intro", t: "Open a 1:1, stretching the verb in the hard sentence." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Stretch the key word in your answer so it lands live." },
      { d: "stretch", t: "On the board, stretch the verdict word — own it." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give perf feedback, stretching the rating word so they hear it." },
    ],
    negotiation: [
      { d: "core", t: "Counter the renewal, stretching the price." },
      { d: "intro", t: "Counter the comp ask, stretching the number." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR, stretching the bet word." },
      { d: "intro", t: "Open the all-hands, stretching the headline word." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level question, stretching the noun that matters." },
      { d: "intro", t: "Ask the 1:1 question, stretching the verb that matters." },
    ],
  },
  "two-beat-landing": {
    explaining: [
      { d: "core", t: "Explain the reorg, then land with two beats of silence." },
      { d: "intro", t: "Explain what your team owns, then two beats of silence." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze, then two beats of silence before any follow-up." },
      { d: "intro", t: "Defend the deadline, then two beats." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands, then two beats before the next sentence." },
      { d: "intro", t: "Open a 1:1, then two beats." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Answer, then two beats before any sweetener." },
      { d: "stretch", t: "On the board, answer, then two beats. Let them respond." },
    ],
    giving_feedback: [
      { d: "core", t: "Give the rating, then two beats before the plan." },
      { d: "intro", t: "Give a new manager feedback, then two beats." },
    ],
    negotiation: [
      { d: "core", t: "State the counter, then two beats. Don't rescue." },
      { d: "intro", t: "State the comp number, then two beats." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR with the headline, then two beats." },
      { d: "intro", t: "Open the all-hands with the topic, then two beats." },
    ],
    storytelling: [
      { d: "stretch", t: "Land the launch story on the choice, then two beats of silence." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level question, then two beats. Don't fill." },
      { d: "intro", t: "Ask the 1:1 question, then two beats." },
    ],
  },

  // ============================= STRUCTURE ================================
  "bottom-line-first": {
    explaining: [
      { d: "core", t: "Explain the freeze bottom-line first. Then the why." },
      { d: "intro", t: "Explain what your team owns bottom-line first." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze bottom-line first. The rest is detail." },
      { d: "intro", t: "Defend the deadline bottom-line first." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands bottom-line first." },
      { d: "intro", t: "Open a 1:1 with hard news bottom-line first." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Bottom-line first, then the rationale." },
      { d: "stretch", t: "A reporter asks live. Bottom-line first, on camera." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give perf feedback bottom-line first — the rating, then the why." },
    ],
    negotiation: [
      { d: "core", t: "Counter the renewal bottom-line first. The price, then the case." },
      { d: "intro", t: "Counter the comp ask bottom-line first. The number, then the rationale." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR bottom-line first. The bet won or it didn't." },
      { d: "intro", t: "Open the all-hands bottom-line first." },
    ],
    storytelling: [
      { d: "stretch", t: "Tell the launch story bottom-line first — we won, here's how." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level question bottom-line first — the ask, then the context." },
      { d: "intro", t: "Ask the 1:1 question bottom-line first." },
    ],
  },
  "compare-and-contrast": {
    explaining: [
      { d: "core", t: "Explain hybrid vs. remote using compare-and-contrast — same dimension, two outcomes." },
      { d: "intro", t: "Explain 1:1 vs. skip-level using compare-and-contrast." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze by comparing this year's plan to last year's — same dimension, different bet." },
      { d: "intro", t: "Defend the deadline by comparing the new path to the old path." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands comparing the bet you made then to the bet you're making now." },
      { d: "intro", t: "Open a 1:1 comparing last quarter's plan to this quarter's." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks 'is this risky?' Compare to a past bet that paid off, on the spot." },
      { d: "stretch", t: "A reporter asks. Compare two strategies — yours and the obvious alternative — live." },
    ],
    negotiation: [
      { d: "core", t: "Counter the vendor by comparing your two options — them vs. alternative." },
      { d: "intro", t: "Counter the comp ask by comparing the role at two bands." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR comparing this quarter's bet to last quarter's — same shape, different outcome." },
      { d: "intro", t: "Open the team meeting comparing this sprint to the last one." },
    ],
    storytelling: [
      { d: "stretch", t: "Tell the launch story comparing day one and day ninety — same team, different shape." },
    ],
    asking_questions: [
      { d: "core", t: "Ask your skip-level a compare-and-contrast question — between two options you've narrowed to." },
      { d: "intro", t: "Ask your direct report a compare-and-contrast question about two project paths." },
    ],
  },
  "monroes-motivated-sequence": {
    explaining: [
      { d: "core", t: "Explain the freeze using Monroe's — attention, need, satisfaction, visualization, action." },
      { d: "intro", t: "Explain the new ladder using Monroe's five steps." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze using Monroe's — start with attention to the cash problem." },
      { d: "intro", t: "Defend the deadline using Monroe's — start with attention on the customer risk." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands using Monroe's — confident attention, then need, then plan." },
      { d: "intro", t: "Open a 1:1 using Monroe's — attention, need, action — for the topic at hand." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks 'why this bet?' Answer in Monroe's order live." },
      { d: "stretch", t: "On the board call, answer 'why now?' in Monroe's order live." },
    ],
    giving_feedback: [
      { d: "core", t: "Give perf feedback using Monroe's — attention to the gap, need, satisfaction, visualization, action." },
      { d: "intro", t: "Give a new manager feedback using Monroe's five steps." },
    ],
    negotiation: [
      { d: "core", t: "Counter the vendor using Monroe's — attention to the gap, need, action." },
      { d: "intro", t: "Counter the comp ask using Monroe's — attention to the bar, need, action." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR in Monroe's — attention, need, satisfaction, visualization, action." },
      { d: "intro", t: "Open the all-hands in Monroe's order for the headline topic." },
    ],
    storytelling: [
      { d: "stretch", t: "Tell the launch story in Monroe's — attention, need, satisfaction, visualization, action." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level question framed in Monroe's — attention to the gap, then the ask." },
      { d: "intro", t: "Ask the 1:1 question framed in Monroe's — attention, need, ask." },
    ],
  },
  "question-then-answer": {
    explaining: [
      { d: "core", t: "Explain the freeze with question-then-answer — pose the question, then resolve." },
      { d: "intro", t: "Explain what your team owns with question-then-answer." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze with question-then-answer — pose their concern, then close it." },
      { d: "intro", t: "Defend the deadline with question-then-answer." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands with question-then-answer — 'why this bet now?' then resolve." },
      { d: "intro", t: "Open a 1:1 with question-then-answer — pose the worry, then resolve." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Restate as a sharper question, then answer it." },
      { d: "stretch", t: "A reporter asks. Restate as a clearer question, then answer live." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give perf feedback with question-then-answer — 'why did you not get promoted?' then resolve." },
    ],
    negotiation: [
      { d: "core", t: "Counter the renewal with question-then-answer — 'what's a fair price?' then state it." },
      { d: "intro", t: "Counter the comp ask with question-then-answer — 'what's the bar?' then state it." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR with question-then-answer — 'did we win the bet?' then resolve." },
      { d: "intro", t: "Open the all-hands with question-then-answer." },
    ],
    persuasion: [
      { d: "stretch", t: "Pitch the board with question-then-answer — 'why now, why us?' then resolve." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level a question-then-answer — frame the question they should be asking, then ask." },
      { d: "intro", t: "Ask the 1:1 question with question-then-answer framing." },
    ],
  },
  "signpost-first": {
    explaining: [
      { d: "stretch", t: "Explain the freeze — signpost the three sections first, then walk through." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze — signpost the three concerns you'll address, then address them." },
      { d: "intro", t: "Defend the deadline — signpost the two reasons first." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands signposting the three things you'll cover." },
      { d: "intro", t: "Open a 1:1 signposting the two topics for the meeting." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Signpost 'two reasons', then walk them — live." },
      { d: "stretch", t: "A reporter asks. Signpost three points, then walk them live." },
    ],
    giving_feedback: [
      { d: "core", t: "Give perf feedback signposting the three areas first." },
      { d: "intro", t: "Give a new manager feedback signposting two themes first." },
    ],
    negotiation: [
      { d: "core", t: "Open the renewal call signposting the three terms you want to walk." },
      { d: "intro", t: "Open the comp talk signposting the two parts — base and equity." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR signposting the four sections." },
      { d: "intro", t: "Open the all-hands signposting the three topics." },
    ],
    persuasion: [
      { d: "stretch", t: "Pitch the board signposting the three reasons before any one of them." },
    ],
    asking_questions: [
      { d: "core", t: "Ask your skip-level signposting the three things you're trying to understand." },
      { d: "intro", t: "Ask your direct report signposting the two areas you're checking on." },
    ],
  },
  "the-3-point-rule": {
    explaining: [
      { d: "core", t: "Explain the freeze in three points. Not four." },
      { d: "intro", t: "Explain what your team owns in three points." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze in three points. Not four." },
      { d: "intro", t: "Defend the deadline in three points." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands in three points." },
      { d: "intro", t: "Open a 1:1 with hard news in three points." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Answer in three points live." },
      { d: "stretch", t: "A reporter asks. Answer in three points on camera." },
    ],
    giving_feedback: [
      { d: "core", t: "Give perf feedback in three points." },
      { d: "intro", t: "Give a new manager feedback in three points." },
    ],
    negotiation: [
      { d: "core", t: "Counter the renewal in three points." },
      { d: "intro", t: "Counter the comp ask in three points." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR in three points." },
      { d: "intro", t: "Open the all-hands in three points." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level three questions only — not four." },
      { d: "intro", t: "Ask the 1:1 in three questions only." },
    ],
  },
  "the-problem-solution-frame": {
    explaining: [
      { d: "core", t: "Explain the freeze using problem-solution — the cash problem, then the freeze as solution." },
      { d: "intro", t: "Explain what your team owns using problem-solution framing." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze in problem-solution form — state the problem first, then your solution." },
      { d: "intro", t: "Defend the deadline using problem-solution — risk first, then date." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands using problem-solution — the headwind, then the plan." },
      { d: "intro", t: "Open a 1:1 using problem-solution — the gap, then the next step." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks 'why now?' Answer in problem-solution form live." },
      { d: "stretch", t: "A reporter asks 'why this pivot?' Answer in problem-solution form live." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give perf feedback in problem-solution form — the gap, then the plan." },
    ],
    negotiation: [
      { d: "core", t: "Counter the renewal in problem-solution form — your problem with the price, then your offer." },
      { d: "intro", t: "Counter the comp ask in problem-solution form — bar gap, then the number." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR in problem-solution form — the headwind, then the bet." },
      { d: "intro", t: "Open the all-hands in problem-solution form — the topic, then the plan." },
    ],
    persuasion: [
      { d: "stretch", t: "Pitch the board in problem-solution form — the market shift, then the bet." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level a problem-solution question — frame the problem, then ask for the solution." },
      { d: "intro", t: "Ask the 1:1 question in problem-solution form." },
    ],
  },
  "the-story-arc": {
    explaining: [
      { d: "core", t: "Explain the freeze as a three-beat story — setup, turn, resolution." },
      { d: "intro", t: "Explain what your team owns using a three-beat arc." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze as a story arc — where we were, what changed, what we're doing." },
      { d: "intro", t: "Defend the deadline as a three-beat arc." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands as a story arc — last quarter, the turn, the path forward." },
      { d: "intro", t: "Open a 1:1 with a hard topic as a three-beat arc." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Answer as a three-beat story arc on the spot." },
      { d: "stretch", t: "A reporter asks. Answer as a story arc live." },
    ],
    giving_feedback: [
      { d: "core", t: "Give perf feedback as a story arc — start of cycle, the turn, where we are now." },
      { d: "intro", t: "Give a new manager feedback as a three-beat arc." },
    ],
    negotiation: [
      { d: "core", t: "Frame the counter-offer as a story arc — context, shift, ask." },
      { d: "intro", t: "Frame the comp talk as a three-beat arc." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR as a story arc — the bet, the turn, where we are." },
      { d: "intro", t: "Open the all-hands as a three-beat arc." },
    ],
    persuasion: [
      { d: "core", t: "Pitch the board as a story arc — context, shift, ask." },
      { d: "intro", t: "Pitch a peer leader on a joint initiative as a three-beat arc." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level a question framed as a three-beat arc — setup, turn, ask." },
      { d: "intro", t: "Ask the 1:1 question framed as a three-beat arc." },
    ],
  },
  "two-then-one": {
    explaining: [
      { d: "core", t: "Explain the freeze with two reasons then the one that matters." },
      { d: "intro", t: "Explain what your team owns with two outputs then the one priority." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze with two reasons then the real reason." },
      { d: "intro", t: "Defend the deadline with two pressures then the one customer pressure." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands with two wins then the one bet that matters." },
      { d: "intro", t: "Open a 1:1 with two updates then the one thing to discuss." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Answer with two minor factors then the one decisive one — live." },
      { d: "stretch", t: "A reporter asks. Answer with two trends then the one big one live." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give perf feedback with two strengths then the one gap." },
    ],
    negotiation: [
      { d: "core", t: "Counter the renewal with two acceptable terms then the one non-negotiable." },
      { d: "intro", t: "Counter the comp ask with two flexibilities then the one cap." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR with two wins then the one bet." },
      { d: "intro", t: "Open the all-hands with two updates then the one priority." },
    ],
    storytelling: [
      { d: "stretch", t: "Tell the launch story with two small turning points then the one big one." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level with two warm-up questions then the one that matters." },
      { d: "intro", t: "Ask the 1:1 with two context questions then the one ask." },
    ],
  },

  // ========================= THINKING_QUALITY ============================
  "disconfirm-yourself": {
    explaining: [
      { d: "core", t: "Explain the freeze, then list the two strongest pieces of evidence it's wrong." },
      { d: "intro", t: "Explain what your team owns, then name the one piece of evidence that contradicts it." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze, then name two ways it could be wrong." },
      { d: "intro", t: "Defend the deadline, then name one way it could be wrong." },
    ],
    confidence: [
      { d: "core", t: "Tell the all-hands you're confident, then name what would change your mind." },
      { d: "intro", t: "Tell a direct report you back the plan, then name what would make you flip." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks 'are you sure?' Disconfirm your own answer live, then re-anchor." },
      { d: "stretch", t: "A reporter asks. Disconfirm your own claim live, then close." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give perf feedback, then say what evidence would make you reverse the rating." },
    ],
    negotiation: [
      { d: "core", t: "State the counter, then name two things that would make you raise it." },
      { d: "intro", t: "State the comp number, then name what would make you raise it." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR with the bet, then state what would have made you walk away." },
      { d: "intro", t: "Open the all-hands with the bet, then name one risk to it." },
    ],
    persuasion: [
      { d: "stretch", t: "Pitch the board, then disconfirm your own thesis with one piece of evidence." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level a question framed to disconfirm your own assumption." },
      { d: "intro", t: "Ask the 1:1 question framed to disconfirm your read of the team." },
    ],
  },
  "draw-the-line": {
    explaining: [
      { d: "core", t: "Explain the freeze by drawing the line — what's in scope and what isn't." },
      { d: "intro", t: "Explain what your team owns by drawing the line on what it doesn't." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze by drawing the line between what's frozen and what isn't." },
      { d: "intro", t: "Defend the deadline by drawing the line between must-haves and nice-to-haves." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands by drawing the line between what you'll commit to and what you won't." },
      { d: "intro", t: "Open a 1:1 by drawing the line between what you can promise and what you can't." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks 'will we ship X?' Draw the line live between in-scope and not." },
      { d: "stretch", t: "A reporter asks. Draw the line live between what you'll confirm and what you won't." },
    ],
    giving_feedback: [
      { d: "core", t: "Give perf feedback by drawing the line between what counted and what didn't." },
      { d: "intro", t: "Give a new manager feedback by drawing the line between in-role and stretch." },
    ],
    negotiation: [
      { d: "core", t: "Counter the renewal by drawing the line between flexible and fixed terms." },
      { d: "intro", t: "Counter the comp ask by drawing the line between this band and the next." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR by drawing the line between bets that paid and bets that didn't." },
      { d: "intro", t: "Open the all-hands by drawing the line on what this quarter is and isn't." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level a draw-the-line question — force a clear scope boundary." },
      { d: "intro", t: "Ask the 1:1 a draw-the-line question on what's their job vs. not." },
    ],
  },
  "first-principles": {
    handling_objections: [
      { d: "core", t: "Defend the freeze from first principles — start with cash in, cash out." },
      { d: "intro", t: "Defend the deadline from first principles — customer commitment, then date." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands by rebuilding the strategy from first principles." },
      { d: "intro", t: "Open a 1:1 by rebuilding the project from first principles." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks 'why this strategy?' Answer from first principles live." },
      { d: "stretch", t: "A reporter asks. Answer from first principles live." },
    ],
    giving_feedback: [
      { d: "core", t: "Give perf feedback from first principles — what is the senior bar actually for?" },
      { d: "intro", t: "Give a new manager feedback from first principles — what is a 1:1 actually for?" },
    ],
    negotiation: [
      { d: "core", t: "Counter the renewal from first principles — what's the value, what's the cost." },
      { d: "intro", t: "Counter the comp ask from first principles — what's the role worth, what can you pay." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR from first principles — rebuild the bet, then the numbers." },
      { d: "intro", t: "Open the all-hands from first principles — what is this quarter actually for." },
    ],
    storytelling: [
      { d: "stretch", t: "Tell the launch story from first principles — what existed, what we built, what changed." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level a first-principles question — strip the project to its core." },
      { d: "intro", t: "Ask the 1:1 a first-principles question — strip the role to its core." },
    ],
  },
  "name-the-assumption": {
    explaining: [
      { d: "core", t: "Explain the freeze and name the load-bearing assumption underneath it." },
      { d: "intro", t: "Explain what your team owns and name the assumption it depends on." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze by naming the assumption your opponent is making." },
      { d: "intro", t: "Defend the deadline by naming the assumption the team is making." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands by naming the assumption that has to hold for the plan to work." },
      { d: "intro", t: "Open a 1:1 by naming the assumption you're making about the team." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Answer by naming the assumption behind their question live." },
      { d: "stretch", t: "A reporter asks. Name the assumption in the question before you answer." },
    ],
    giving_feedback: [
      { d: "core", t: "Give perf feedback by naming the assumption you used to judge their work." },
      { d: "intro", t: "Give a new manager feedback by naming the assumption they're making about scope." },
    ],
    negotiation: [
      { d: "core", t: "Counter the renewal by naming the vendor's assumption about your switching cost." },
      { d: "intro", t: "Counter the comp ask by naming the assumption about the market." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR by naming the load-bearing assumption from last quarter." },
      { d: "intro", t: "Open the team meeting by naming the assumption you're testing this sprint." },
    ],
    storytelling: [
      { d: "core", t: "Tell the launch story by naming the assumption that was wrong." },
      { d: "intro", t: "Tell the team's origin by naming the assumption that turned out true." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level a question that surfaces a hidden assumption." },
      { d: "intro", t: "Ask the 1:1 question that names the assumption in the way they framed the problem." },
    ],
  },
  "order-of-magnitude": {
    explaining: [
      { d: "stretch", t: "Explain the freeze with an order-of-magnitude estimate — millions or tens of millions?" },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze with an order-of-magnitude estimate of the cash gap." },
      { d: "intro", t: "Defend the deadline with an order-of-magnitude estimate of the customer impact." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands with an order-of-magnitude bet — what we're playing for." },
      { d: "intro", t: "Open a 1:1 with an order-of-magnitude take on the project's value." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks 'how big is this?' Answer in orders of magnitude live." },
      { d: "stretch", t: "A reporter asks 'how much will this cost?' Answer in order-of-magnitude live." },
    ],
    negotiation: [
      { d: "core", t: "Counter the renewal with an order-of-magnitude argument on TCO." },
      { d: "intro", t: "Counter the comp ask with an order-of-magnitude argument on the bar." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR with an order-of-magnitude on the bet size." },
      { d: "intro", t: "Open the team meeting with an order-of-magnitude on this sprint's impact." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level an order-of-magnitude question — is this 10% or 50% of the problem?" },
      { d: "intro", t: "Ask the 1:1 an order-of-magnitude question — is this hours or days of work?" },
    ],
  },
  "the-claim-and-proof": {
    explaining: [
      { d: "core", t: "Explain the freeze as a claim and one piece of proof." },
      { d: "intro", t: "Explain what your team owns as a claim and one piece of proof." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze as a claim and proof — the claim, then the dashboard." },
      { d: "intro", t: "Defend the deadline as a claim and proof." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands with a claim and one proof point." },
      { d: "intro", t: "Open a 1:1 with a claim and one proof point about the project." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Answer as a claim and one proof live." },
      { d: "stretch", t: "A reporter asks. Answer as a claim and one proof live." },
    ],
    giving_feedback: [
      { d: "core", t: "Give perf feedback as a claim and proof — the rating, then the receipt." },
      { d: "intro", t: "Give a new manager feedback as a claim and one proof point." },
    ],
    negotiation: [
      { d: "core", t: "Counter the renewal as a claim and proof — the price, then the benchmark." },
      { d: "intro", t: "Counter the comp ask as a claim and proof." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR as a claim and proof — the bet won or it didn't, here's the chart." },
      { d: "intro", t: "Open the all-hands as a claim and one proof point." },
    ],
    storytelling: [
      { d: "stretch", t: "Tell the launch story as a claim and proof — we shipped on time, here's the receipt." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level a claim-and-proof question — 'I believe X; what would change your mind?'" },
      { d: "intro", t: "Ask the 1:1 a claim-and-proof question — 'I think Y; what's the evidence against?'" },
    ],
  },
  "the-perspective-shift": {
    explaining: [
      { d: "core", t: "Explain the freeze from the CFO's perspective, then from an IC's." },
      { d: "intro", t: "Explain what your team owns from a new hire's perspective, then a tenured one's." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze from your CFO's lens, then your most senior IC's." },
      { d: "intro", t: "Defend the deadline from the customer's lens, then the team's." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands from a flight-risk IC's perspective — what they need to hear." },
      { d: "intro", t: "Open a 1:1 from your report's perspective — what they came in hoping to hear." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Answer first from your view, then from theirs — live." },
      { d: "stretch", t: "A reporter asks. Answer first from your team's lens, then from the public's." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give perf feedback from your seat, then from theirs." },
    ],
    negotiation: [
      { d: "core", t: "Counter the renewal from your finance lens, then from the vendor's." },
      { d: "intro", t: "Counter the comp ask from your seat, then from theirs." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR from the board's lens, then from your team's." },
      { d: "intro", t: "Open the all-hands from a new hire's lens." },
    ],
    persuasion: [
      { d: "core", t: "Pitch the board from their lens — the risk they fear most." },
      { d: "intro", t: "Pitch a peer leader from their lens — the win they need." },
    ],
    storytelling: [
      { d: "core", t: "Tell the launch story from the customer's perspective, not yours." },
      { d: "intro", t: "Tell the team's origin from the perspective of the first engineer hired." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level a question framed from your direct report's perspective." },
      { d: "intro", t: "Ask the 1:1 a question framed from the cross-team partner's perspective." },
    ],
  },
  "the-so-what-test": {
    handling_objections: [
      { d: "core", t: "Defend the freeze, then add the 'so what' — what changes for the team." },
      { d: "intro", t: "Defend the deadline, then add the 'so what' for the customer." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands with the 'so what' — what this means for their job tomorrow." },
      { d: "intro", t: "Open a 1:1 with the 'so what' for the report's week." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Answer with the 'so what' upfront live." },
      { d: "stretch", t: "A reporter asks. Answer with the 'so what' for the market live." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give perf feedback ending on the 'so what' — what changes for them next cycle." },
    ],
    negotiation: [
      { d: "core", t: "Counter the renewal with the 'so what' — what each party gets." },
      { d: "intro", t: "Counter the comp ask with the 'so what' — what changes if you say yes." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR with the 'so what' for the board." },
      { d: "intro", t: "Open the all-hands with the 'so what' for the company." },
    ],
    persuasion: [
      { d: "stretch", t: "Pitch the board with the 'so what' as the first sentence." },
    ],
    storytelling: [
      { d: "stretch", t: "End the launch story on the 'so what' — what's different now." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level the 'so what' question — force them to make the implication explicit." },
      { d: "intro", t: "Ask the 1:1 the 'so what' question — what changes for them after this." },
    ],
  },
  "the-steel-man": {
    explaining: [
      { d: "core", t: "Explain the freeze, then steel-man the case against it." },
      { d: "intro", t: "Explain what your team owns, then steel-man the case for letting someone else own it." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze by first steel-manning the case against it, then closing it." },
      { d: "intro", t: "Defend the deadline by first steel-manning the slip request." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands by steel-manning the doubters, then answering them." },
      { d: "intro", t: "Open a 1:1 by steel-manning the report's hesitation, then closing it." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec pushes back. Steel-man their view first, then answer." },
      { d: "stretch", t: "A reporter pushes. Steel-man the critique, then close it live." },
    ],
    giving_feedback: [
      { d: "core", t: "Give perf feedback after first steel-manning their case for the next level." },
      { d: "intro", t: "Give a new manager feedback after first steel-manning their concern." },
    ],
    negotiation: [
      { d: "core", t: "Counter the renewal by first steel-manning the vendor's case." },
      { d: "intro", t: "Counter the comp ask by first steel-manning the report's number." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR by steel-manning the case for killing the bet, then defending it." },
      { d: "intro", t: "Open the team meeting by steel-manning the case for a different priority." },
    ],
    storytelling: [
      { d: "stretch", t: "Tell the launch story by steel-manning the path you didn't take." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level a steel-man question — frame the strongest version of their objection back to them." },
      { d: "intro", t: "Ask the 1:1 a steel-man question about a path you've already rejected." },
    ],
  },

  // ================================ TONE ==================================
  "authority-voice": {
    explaining: [
      { d: "core", t: "Explain the freeze in authority voice — declarative, low pitch end, no upward inflection." },
      { d: "intro", t: "Explain what your team owns in authority voice." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze in authority voice — no upspeak, no apology." },
      { d: "intro", t: "Defend the deadline in authority voice." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands in authority voice." },
      { d: "intro", t: "Open a 1:1 with hard news in authority voice." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Answer in authority voice live — no upspeak under pressure." },
      { d: "stretch", t: "A reporter asks. Hold authority voice under camera pressure." },
    ],
    negotiation: [
      { d: "core", t: "State the counter in authority voice." },
      { d: "intro", t: "State the comp number in authority voice." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR in authority voice for the first minute." },
      { d: "intro", t: "Open the all-hands in authority voice for the first 30 seconds." },
    ],
    storytelling: [
      { d: "stretch", t: "Tell the launch story in authority voice on the moment of decision." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level question in authority voice — don't upspeak the ask." },
      { d: "intro", t: "Ask the 1:1 question in authority voice." },
    ],
  },
  "conviction-floor": {
    explaining: [
      { d: "core", t: "Explain the freeze with a floor of conviction — no upward drift in tone." },
      { d: "intro", t: "Explain what your team owns from a conviction floor." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze with a conviction floor — every sentence ends down." },
      { d: "intro", t: "Defend the deadline from a conviction floor." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands from a conviction floor — root the voice down." },
      { d: "intro", t: "Open a 1:1 from a conviction floor." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Hold the conviction floor under pressure — no rising inflection." },
      { d: "stretch", t: "On the board call, hold the conviction floor on the hard answer." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give perf feedback from a conviction floor — don't upspeak the rating." },
    ],
    negotiation: [
      { d: "core", t: "State the counter from a conviction floor." },
      { d: "intro", t: "State the comp number from a conviction floor." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR from a conviction floor." },
      { d: "intro", t: "Open the all-hands from a conviction floor." },
    ],
    storytelling: [
      { d: "core", t: "Tell the launch story from a conviction floor on the moments that mattered." },
      { d: "intro", t: "Tell the team's origin from a conviction floor." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level question from a conviction floor — don't apologize with tone." },
      { d: "intro", t: "Ask the 1:1 question from a conviction floor." },
    ],
  },
  "curiosity-lift": {
    explaining: [
      { d: "core", t: "Explain the freeze with a curiosity lift at the key word — invite the room in." },
      { d: "intro", t: "Explain what your team owns with a curiosity lift at the verb." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze with a curiosity lift on 'why now' — invite them to think with you." },
      { d: "intro", t: "Defend the deadline with a curiosity lift on the reason." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands with a curiosity lift on the bet — confident, not boring." },
      { d: "intro", t: "Open a 1:1 with a curiosity lift on the topic." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Answer with a curiosity lift on the key claim live." },
      { d: "stretch", t: "A reporter asks. Lift on the surprising number live." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give perf feedback with a curiosity lift on the gap — open, not closed." },
    ],
    negotiation: [
      { d: "core", t: "Counter the renewal with a curiosity lift on 'what if we did X' — invite the trade." },
      { d: "intro", t: "Counter the comp ask with a curiosity lift on the next level." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR with a curiosity lift on the bet of the quarter." },
      { d: "intro", t: "Open the all-hands with a curiosity lift on the topic." },
    ],
    persuasion: [
      { d: "core", t: "Pitch the board with a curiosity lift on the market shift." },
      { d: "intro", t: "Pitch a peer leader with a curiosity lift on the joint upside." },
    ],
    storytelling: [
      { d: "core", t: "Tell the launch story with a curiosity lift at the turning point." },
      { d: "intro", t: "Tell the team's origin with a curiosity lift on the spark moment." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level with a curiosity lift on the noun." },
      { d: "intro", t: "Ask the 1:1 with a curiosity lift on the verb." },
    ],
  },
  "downward-landing": {
    handling_objections: [
      { d: "core", t: "Defend the freeze landing every sentence down. No upspeak." },
      { d: "intro", t: "Defend the deadline landing every sentence down." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands landing every sentence down. Confidence travels through floor pitch." },
      { d: "intro", t: "Open a 1:1 landing every sentence down." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Land every sentence in your answer down — live." },
      { d: "stretch", t: "A reporter asks. Land every sentence down on camera." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give perf feedback landing every sentence down. Don't ask permission with tone." },
    ],
    negotiation: [
      { d: "core", t: "State the counter landing every sentence down." },
      { d: "intro", t: "State the comp number landing the sentence down." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR landing every sentence in the first minute down." },
      { d: "intro", t: "Open the all-hands landing every sentence in the first 30 seconds down." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level question landing it down. Don't upspeak the ask." },
      { d: "intro", t: "Ask the 1:1 question landing it down." },
    ],
  },
  "pivot-tone": {
    explaining: [
      { d: "core", t: "Explain the freeze — start warm on context, pivot firm on the reason." },
      { d: "intro", t: "Explain what your team owns — pivot from open to grounded at the verb." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze — pivot from empathetic to firm at the key sentence." },
      { d: "intro", t: "Defend the deadline — pivot from open to grounded at the date." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands — pivot from warm to authoritative at the bet." },
      { d: "intro", t: "Open a 1:1 — pivot from open to grounded at the hard sentence." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec presses. Pivot from open to firm live — no apology in the second beat." },
      { d: "stretch", t: "A reporter presses. Pivot tone live without going defensive." },
    ],
    giving_feedback: [
      { d: "core", t: "Give perf feedback — pivot from warm intro to firm rating." },
      { d: "intro", t: "Give a new manager feedback — pivot from open to grounded at the plan." },
    ],
    negotiation: [
      { d: "core", t: "Counter the renewal — pivot from warm to firm at the price." },
      { d: "intro", t: "Counter the comp ask — pivot from warm to firm at the number." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR — pivot from warm welcome to grounded verdict." },
      { d: "intro", t: "Open the all-hands — pivot from open hello to firm topic." },
    ],
    persuasion: [
      { d: "stretch", t: "Pitch the board — pivot from open question to firm ask." },
    ],
    storytelling: [
      { d: "core", t: "Tell the launch story — pivot from warm setup to firm decision." },
      { d: "intro", t: "Tell the team's origin — pivot from open spark to grounded build." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level question — pivot from warm context to grounded ask." },
      { d: "intro", t: "Ask the 1:1 question — pivot from open setup to firm ask." },
    ],
  },
  "read-the-room": {
    explaining: [
      { d: "core", t: "Explain the freeze in two reads — to a quiet room, then a tense one." },
      { d: "intro", t: "Explain what your team owns to a curious room, then a skeptical one." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze read for a calm room, then for a fired-up one." },
      { d: "intro", t: "Defend the deadline read for an anxious team, then a frustrated one." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands read for an anxious room, then for a hopeful one." },
      { d: "intro", t: "Open a 1:1 read for an upset report, then a withdrawn one." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks in a tense room. Answer read for that room — live." },
      { d: "stretch", t: "A reporter asks in a friendly room and then a hostile one. Read each live." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give perf feedback read for an open report, then for a defensive one." },
    ],
    negotiation: [
      { d: "core", t: "Counter the renewal read for a willing vendor, then a stubborn one." },
      { d: "intro", t: "Counter the comp ask read for an open report, then a flight risk." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR read for a confident board, then a worried one." },
      { d: "intro", t: "Open the all-hands read for a celebrating team, then a grieving one." },
    ],
    persuasion: [
      { d: "core", t: "Pitch the board read for risk-averse mode, then for risk-on mode." },
      { d: "intro", t: "Pitch a peer leader read for cooperative mode, then defensive." },
    ],
    storytelling: [
      { d: "core", t: "Tell the launch story read for a hopeful room, then a cynical one." },
      { d: "intro", t: "Tell the team's origin read for a new hire group, then a veteran group." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level question read for a busy 1:1, then a relaxed one." },
      { d: "intro", t: "Ask the 1:1 question read for an open report, then a guarded one." },
    ],
  },
  "the-monotone-breaker": {
    handling_objections: [
      { d: "core", t: "Defend the freeze breaking monotone every third sentence." },
      { d: "intro", t: "Defend the deadline breaking monotone at the verb." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands breaking monotone twice in the first minute." },
      { d: "intro", t: "Open a 1:1 breaking monotone at the hard sentence." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Answer breaking monotone live — don't flatline under stress." },
      { d: "stretch", t: "A reporter asks. Break monotone on the headline word live." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give perf feedback breaking monotone on the rating word." },
    ],
    negotiation: [
      { d: "core", t: "State the counter breaking monotone on the price." },
      { d: "intro", t: "State the comp number breaking monotone on the number." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR breaking monotone twice in the first minute." },
      { d: "intro", t: "Open the all-hands breaking monotone at the headline." },
    ],
    persuasion: [
      { d: "stretch", t: "Pitch the board breaking monotone on the ask line." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level question breaking monotone on the verb." },
      { d: "intro", t: "Ask the 1:1 question breaking monotone on the key noun." },
    ],
  },
  "volume-dial": {
    explaining: [
      { d: "core", t: "Explain the freeze starting at 6, dropping to 4 on the reason." },
      { d: "intro", t: "Explain what your team owns starting at 5, lifting to 7 on the verb." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze starting at 6, dropping to 3 on the reason — gravity through quiet." },
      { d: "intro", t: "Defend the deadline starting at 5, dropping to 3 on the why." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands at volume 5, lifting to 7 on the bet." },
      { d: "intro", t: "Open a 1:1 at volume 4, dropping to 3 on the hard sentence." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Answer at volume 6, dropping to 4 on the key claim — live." },
      { d: "stretch", t: "On the board, answer at volume 5, dropping to 3 on the verdict." },
    ],
    giving_feedback: [
      { d: "core", t: "Give perf feedback at volume 5, dropping to 4 on the rating." },
      { d: "intro", t: "Give a new manager feedback at volume 4, lifting to 5 on the plan." },
    ],
    negotiation: [
      { d: "core", t: "State the counter at volume 6, holding steady — no drift up or down." },
      { d: "intro", t: "State the comp number at volume 5, holding steady." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR at volume 6, dropping to 4 on the verdict." },
      { d: "intro", t: "Open the all-hands at volume 5, lifting to 7 on the headline." },
    ],
    persuasion: [
      { d: "core", t: "Pitch the board at volume 5, lifting to 7 on the ask." },
      { d: "intro", t: "Pitch a peer leader at volume 5, dropping to 4 on the trade." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level question at volume 4 — quiet, deliberate, hard to ignore." },
      { d: "intro", t: "Ask the 1:1 question at volume 4 — let quiet make space." },
    ],
  },
  "warmth-switch": {
    explaining: [
      { d: "core", t: "Explain the freeze with a warmth switch — warmer on the team impact, cooler on the math." },
      { d: "intro", t: "Explain what your team owns with a warmth switch — warmer on the why, cooler on the what." },
    ],
    handling_objections: [
      { d: "core", t: "Defend the freeze with a warmth switch — warmer on the empathy, cooler on the reason." },
      { d: "intro", t: "Defend the deadline with a warmth switch — warmer on the team, cooler on the date." },
    ],
    confidence: [
      { d: "core", t: "Open the all-hands with a warmth switch — warm on the team, grounded on the bet." },
      { d: "intro", t: "Open a 1:1 with a warmth switch — warm on the person, grounded on the topic." },
    ],
    thinking_on_the_spot: [
      { d: "core", t: "An exec asks. Switch warm-to-grounded inside the answer — live." },
      { d: "stretch", t: "A reporter asks. Switch warmth across the answer live." },
    ],
    giving_feedback: [
      { d: "stretch", t: "Give perf feedback with a warmth switch — warm on the relationship, grounded on the rating." },
    ],
    negotiation: [
      { d: "core", t: "Counter the renewal with a warmth switch — warm on partnership, cool on price." },
      { d: "intro", t: "Counter the comp ask with a warmth switch — warm on the person, grounded on the band." },
    ],
    presenting: [
      { d: "core", t: "Open the QBR with a warmth switch — warm on the team, grounded on the bet." },
      { d: "intro", t: "Open the all-hands with a warmth switch — warm on the wins, grounded on the topic." },
    ],
    persuasion: [
      { d: "core", t: "Pitch the board with a warmth switch — warm on the mission, cool on the ask." },
      { d: "intro", t: "Pitch a peer leader with a warmth switch — warm on the relationship, cool on the trade." },
    ],
    asking_questions: [
      { d: "core", t: "Ask the skip-level question with a warmth switch — warm context, grounded ask." },
      { d: "intro", t: "Ask the 1:1 question with a warmth switch — warm setup, grounded ask." },
    ],
  },
};

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

const exerciseByName = new Map();
for (const ex of catalog.exercises) {
  // map by slugified name for matching
  const slug = ex.name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  exerciseByName.set(slug, ex);
}

// Track all existing prompt texts for global uniqueness within file
const allTexts = new Set();
for (const ex of catalog.exercises) {
  for (const p of ex.prompts) {
    allTexts.add(p.text);
  }
}

let totalAuthored = 0;
let gapsClosed = 0;
let unfilled = [];
const diffCount = { intro: 0, core: 0, stretch: 0 };

for (const exGap of gaps.exercises) {
  const slug = exGap.exerciseSlug;
  const ex = exerciseByName.get(slug);
  if (!ex) {
    unfilled.push(`MISSING EXERCISE: ${slug}`);
    continue;
  }
  const lib = LIB[slug];
  if (!lib) {
    unfilled.push(`MISSING LIB: ${slug}`);
    continue;
  }
  for (const g of exGap.gaps) {
    const pool = lib[g.goal];
    if (!pool || pool.length < g.need) {
      unfilled.push(`SHORT POOL: ${slug}/${g.goal} need ${g.need} have ${pool?.length ?? 0}`);
      continue;
    }
    let added = 0;
    for (const item of pool) {
      if (added >= g.need) break;
      if (allTexts.has(item.t)) {
        // try next; skip dupes
        continue;
      }
      if (item.t.length > 220) {
        unfilled.push(`TOO LONG: ${slug}/${g.goal} -> ${item.t.length}`);
        continue;
      }
      ex.prompts.push({
        text: item.t,
        difficulty: item.d,
        tags: ["leadership", g.goal],
      });
      allTexts.add(item.t);
      diffCount[item.d]++;
      added++;
      totalAuthored++;
    }
    if (added < g.need) {
      unfilled.push(`UNDER-FILLED: ${slug}/${g.goal} got ${added} of ${g.need}`);
    } else {
      gapsClosed++;
    }
  }
}

fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf8");

console.log(
  JSON.stringify(
    {
      gapsTotal: gaps.exercises.reduce((s, e) => s + e.gaps.length, 0),
      gapsClosed,
      promptsAuthored: totalAuthored,
      difficulty: diffCount,
      unfilled,
    },
    null,
    2,
  ),
);
