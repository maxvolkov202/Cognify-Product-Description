// Generate 540 triples (54 exercises x 10 goals) x 3 archetypes (A/B/C) = 1,620 prompts
// for the education vertical. Appends to scripts/exercise-catalog/v1/vertical/education.json.
//
// Authoring rules per docs/prompt-design-canon.md:
//   - Repeatable on demand: no required setup
//   - Mechanic-aligned: each exercise's move is path of least resistance
//   - Vertical-flavored: education themes (classroom, students, parents, lessons, learning)
//                       not vertical-locked scenes
//   - ≤180 chars, conversational, second-person.
// Difficulty mix: ~50% intro / ~40% core / ~10% stretch across all 1,620.
// Archetypes A/B/C per (exercise x goal): universal / vertical-lensed universal / light scenario.

import fs from "node:fs";
import path from "node:path";

const CATALOG_PATH = "C:/Users/MaxVolkov/dev/cognify/scripts/exercise-catalog/v1/vertical/education.json";
const GAPS_PATH = "C:/Users/MaxVolkov/dev/cognify/scripts/gaps/education.json";

const GOALS = [
  "handling_objections",
  "confidence",
  "thinking_on_the_spot",
  "giving_feedback",
  "negotiation",
  "presenting",
  "persuasion",
  "storytelling",
  "asking_questions",
  "explaining",
];

// ----------------------------------------------------------------------------
// Per-exercise pools. Each exercise gets, per goal, three prompt builders
// (A universal, B vertical-lensed universal, C light scenario). Each builder
// returns { text, difficulty }. We hand-craft pools to avoid duplicates and
// keep mechanic alignment.
// ----------------------------------------------------------------------------

// Helpers --------------------------------------------------------------------
const D = { intro: "intro", core: "core", stretch: "stretch" };

// Difficulty plan per archetype: A mostly intro, B mostly core, C mix.
// Across 54 exercises x 10 goals, this yields ~50/40/10.
const archDiff = (arch, exIdx, goalIdx) => {
  const i = exIdx * 10 + goalIdx;
  if (arch === "A") {
    // ~80% intro, ~20% core, no stretch
    return i % 5 === 0 ? D.core : D.intro;
  }
  if (arch === "B") {
    // ~30% intro, ~60% core, ~10% stretch
    const m = i % 10;
    if (m === 0) return D.stretch;
    if (m <= 3) return D.intro;
    return D.core;
  }
  // C: ~20% intro, ~60% core, ~20% stretch
  const m = i % 10;
  if (m <= 1) return D.intro;
  if (m >= 8) return D.stretch;
  return D.core;
};

// Universal A pools per exercise (10 prompts per exercise; one per goal).
// Each is a short, mechanic-pulling, universally answerable question.
const UNIVERSAL_A = {
  "Answer the Confusion": [
    "Someone pushes back on what you said. What's the cleanest way to address it?",
    "When you sense confusion in the room, what do you do first?",
    "Caught off guard by a question — how do you avoid stalling?",
    "When your point lands wrong, how do you reset it?",
    "Someone disagrees mid-sentence. What's your move?",
    "How do you tell when an audience is lost?",
    "What changes their mind faster — proof or empathy?",
    "Open with the answer or the context?",
    "What question are people too afraid to ask out loud?",
    "What do you do when someone genuinely doesn't get it?",
  ],
  "Explain Like I'm 12": [
    "Explain something you know well to someone who knows nothing about it.",
    "What's something you understand that most people get wrong?",
    "Explain what you do for a living to a curious kid.",
    "How would you tell a 12-year-old what good work looks like?",
    "Explain why two reasonable people can disagree.",
    "Explain the most important idea in your field — no jargon.",
    "What's the simplest way to say what you actually believe?",
    "Explain a hard concept using only words a kid would use.",
    "What's the question kids ask that adults can't answer?",
    "Explain what learning actually is, in plain words.",
  ],
  "Headline First": [
    "What's the most important thing you'd say if you only had one sentence?",
    "Should you ever apologize for being right?",
    "Is being clear more important than being kind?",
    "Yes or no — does experience matter more than talent?",
    "Lead with the answer: what makes work meaningful?",
    "Should leaders ever pretend to be certain?",
    "What's the headline of your week?",
    "If you had ten seconds with the boss, what would you say?",
    "What's the one question worth asking in any meeting?",
    "What's the bottom line of what you actually believe?",
  ],
  "Cut by Half": [
    "Tell me everything you think about your job — then say it in half.",
    "Explain what you do — long version. Then cut it in half.",
    "Ramble about what makes work meaningful, then compress.",
    "Say everything you'd say in a feedback session. Now half it.",
    "What's the long pitch for what you believe? Now the short one.",
    "Talk about your day. Now make it half as long.",
    "Tell me everything you know about an audience. Then compress.",
    "Tell the long version of a story you love. Now cut it.",
    "Ask the long version of your favorite question. Now the short one.",
    "Explain something fully — then again in half the words.",
  ],
  "The Word Budget": [
    "In thirty words: what do you push back on most often?",
    "Twenty words: what does confidence actually look like?",
    "Thirty words: what do you do when your mind goes blank?",
    "Twenty-five words: what's the best feedback you ever got?",
    "Thirty words: what do you give up to get something you want?",
    "Twenty words: what makes a talk worth listening to?",
    "Thirty words: what changes someone's mind?",
    "Forty words: tell a true short story.",
    "Twenty words: what's the best question to ask anyone?",
    "Thirty words: explain something hard, simply.",
  ],
  "Kill the Filler": [
    "What's the hardest truth about your work? No um, no like.",
    "Talk about confidence without filler words.",
    "Think out loud about a hard decision — no fillers.",
    "Give honest feedback on a habit you don't like. No fillers.",
    "Talk through a trade-off you'd make. No fillers.",
    "Make a case for something. No 'um', no 'like'.",
    "Argue your strongest belief. No fillers.",
    "Tell a true story. No fillers.",
    "Ask a question worth asking. No fillers.",
    "Explain something you know cold. No fillers.",
  ],
  "The Steel Man": [
    "Argue against your own opinion as well as you can.",
    "Make the strongest case for the way you're not.",
    "Defend a position you usually reject.",
    "Steel-man someone whose feedback hurt.",
    "Make the strongest case for the other side of a tough call.",
    "Argue for the talk you'd never give.",
    "Argue against your favorite belief.",
    "Defend a story you'd usually criticize.",
    "Steel-man someone who keeps asking annoying questions.",
    "Make the case for the explanation you find weakest.",
  ],
  "Strategic Pause": [
    "What's a truth about your work worth pausing on?",
    "What's the thing about confidence that deserves a beat of silence?",
    "What do you wish people thought longer about before answering?",
    "What's something worth pausing before saying?",
    "What deserves a pause before agreeing?",
    "What's the line in a talk that should land in silence?",
    "What's worth saying slow enough that it lands?",
    "What's the moment in a story that deserves a beat?",
    "What's a question worth waiting on?",
    "What idea is worth pausing before you explain?",
  ],
  "Silence Over Filler": [
    "Why is silence so uncomfortable?",
    "When does staying quiet show more confidence than speaking?",
    "What's the value of not filling space?",
    "Why is silence harder than a difficult sentence?",
    "When does silence win a negotiation?",
    "When does a pause carry more weight than a word?",
    "When is silence more persuasive than argument?",
    "When does a story land harder with silence in it?",
    "When does silence get a better answer than a follow-up?",
    "When is the right answer to wait?",
  ],
  "Two-Beat Landing": [
    "What's a line in your life that deserves a two-beat pause?",
    "What's the line you wish people sat with longer?",
    "What's a true thing you'd land slowly?",
    "What feedback hits harder when you pause after it?",
    "What's the line you'd never rush past?",
    "What's the line you want to land on?",
    "What's the best closer you've ever heard?",
    "What's the punchline of your favorite story?",
    "What's a question worth pausing after?",
    "What's the line that ends a hard explanation?",
  ],
  "Warmth Switch": [
    "Take a tough opinion and soften it without weakening it.",
    "Start sharp, end warm. Pick anything.",
    "Say a hard truth — then make it human.",
    "Give critical feedback, then make it kind.",
    "Push back hard, then warm up.",
    "Make a strong claim, then make it human.",
    "Persuade someone, then soften your tone.",
    "Tell a hard story, then warm the ending.",
    "Challenge someone with a question, then warm the room.",
    "Explain a hard thing, then make it tender.",
  ],
  "Prove It": [
    "Make a claim about your work, then back it up.",
    "What's a belief you can actually defend with evidence?",
    "What's a hot take you can prove?",
    "Give feedback that has receipts.",
    "Make an offer, then justify it.",
    "Say something bold — and prove it.",
    "Make a claim, then prove it.",
    "Tell a true story you can defend with detail.",
    "Ask a sharp question, then justify why.",
    "Explain a claim and prove every part of it.",
  ],
  "One Point Only": [
    "If you could only land one point today, what would it be?",
    "What's the one belief about your work worth all the rest?",
    "If you had to say one thing under pressure, what?",
    "One point of feedback — what would it be?",
    "One ask. What is it?",
    "One slide. What does it say?",
    "One reason to change your mind. What is it?",
    "One scene from your week. What is it?",
    "One question to anyone you've ever met. What?",
    "One sentence to explain it. Go.",
  ],
  "The Analogy Bridge": [
    "What's the best analogy for what you do?",
    "What's leadership like, if not leadership?",
    "Thinking on your feet is like ____ — fill it in.",
    "Feedback is like ____ — and what?",
    "Negotiation is like ____ — go.",
    "A great talk is like ____ — finish it.",
    "Persuasion is like ____ — finish it.",
    "A good story is like ____ — explain.",
    "A great question is like ____ — explain.",
    "Explaining is like ____ — fill it in.",
  ],
  "The 30 Second Rule": [
    "In thirty seconds: what's true about your work?",
    "Thirty seconds: what is confidence?",
    "Thirty seconds: what do you do when blindsided?",
    "Thirty seconds: what's the best feedback move?",
    "Thirty seconds: what's the most useful trade?",
    "Thirty seconds: pitch your best idea.",
    "Thirty seconds: change someone's mind.",
    "Thirty seconds: tell a true story.",
    "Thirty seconds: ask one great question.",
    "Thirty seconds: explain something hard.",
  ],
  "The Hard Stop": [
    "Make a strong claim, then stop. Resist explaining.",
    "Say something true about confidence — then stop.",
    "Answer fast, then stop. Don't soften.",
    "Give feedback — then stop. Don't soften it.",
    "Make an ask — then stop. Don't justify.",
    "Land your point — then stop.",
    "Make your case — then stop.",
    "Tell a short story — then stop before the moral.",
    "Ask the question — then stop.",
    "Give the answer — then stop.",
  ],
  "The Single Sentence": [
    "In one sentence: what do you most often defend?",
    "One sentence: what is confidence?",
    "One sentence: what do you do under pressure?",
    "One sentence: what's the best feedback you've gotten?",
    "One sentence: what would you give up to win?",
    "One sentence: pitch a talk you'd give.",
    "One sentence: change someone's mind.",
    "One sentence: tell a true story.",
    "One sentence: ask the question you wish people asked you.",
    "One sentence: explain it.",
  ],
  "No Hedging": [
    "Make a strong claim with no softening.",
    "What do you believe — without 'I think'?",
    "Answer fast and don't soften it.",
    "Give feedback without softening it.",
    "Make an ask without hedging.",
    "Make a hard call out loud — no 'maybe'.",
    "Persuade without softening.",
    "Tell a story without minimizing.",
    "Ask a hard question without softening it.",
    "Explain it without 'kind of' or 'sort of'.",
  ],
  "No Jargon Allowed": [
    "Push back on someone without using buzzwords.",
    "Describe confidence without any jargon.",
    "Talk through a quick decision in plain English.",
    "Give feedback without using any insider terms.",
    "Negotiate without any insider terms.",
    "Pitch your idea in plain words.",
    "Persuade someone without using your usual lingo.",
    "Tell a work story in plain English.",
    "Ask a sharp question in plain English.",
    "Explain a complex idea without any jargon.",
  ],
  "One Idea Per Response": [
    "Push back on one — and only one — thing.",
    "Hold one idea about confidence. Stay there.",
    "Pick one thing and stay with it.",
    "Give one piece of feedback. Resist a second.",
    "One trade. Stay there.",
    "One slide. Stay on it.",
    "One reason to change someone's mind. Hold it.",
    "Tell one scene. Don't pile on.",
    "Ask one question. Don't add three.",
    "Explain one part. Don't drift.",
  ],
  "Authority Voice": [
    "Say what you mean like you mean it.",
    "What does authority sound like when it's honest?",
    "Speak with weight, on the spot.",
    "Deliver feedback with quiet authority — not volume.",
    "Make a clear ask. Don't apologize for it.",
    "Speak so the room turns. No tricks.",
    "Make a case with weight in your voice.",
    "Tell a story with calm authority.",
    "Ask with the voice of someone who expects an answer.",
    "Explain something with quiet certainty.",
  ],
  "Beat the Buzzer": [
    "You have ten seconds. What's your answer?",
    "Ten seconds — what does confidence look like to you?",
    "Ten seconds to answer cold. Go.",
    "Ten seconds of feedback. Go.",
    "Ten seconds — make your ask.",
    "Ten seconds — make your point.",
    "Ten seconds — change a mind.",
    "Ten seconds — set a scene.",
    "Ten seconds — ask the question.",
    "Ten seconds — explain it.",
  ],
  "Bottom Line First": [
    "Skip the windup. What's the bottom line?",
    "Lead with the conclusion: what makes someone trustworthy?",
    "Bottom line first — what's your snap answer?",
    "Lead with the verdict: was it good feedback or not?",
    "Lead with the offer. Reasons after.",
    "What's the headline of your talk?",
    "Lead with the recommendation. Reasons after.",
    "Skip the setup — what happened?",
    "Lead with the question you actually want answered.",
    "Lead with the punchline of the explanation.",
  ],
  "Conviction Floor": [
    "What's the line you won't walk back?",
    "What do you believe about your work that you'd never apologize for?",
    "What do you believe even under pressure?",
    "What feedback do you stand by — even when it stings?",
    "What's the offer you'd walk away from?",
    "What's the claim you'd repeat to anyone?",
    "What belief would you hold even if it cost you?",
    "What's the line in your own story you'd never soften?",
    "What's a question you'd never stop asking?",
    "What's the explanation you'd defend to the end?",
  ],
  "Curiosity Lift": [
    "What's a question you keep coming back to?",
    "What do you still find genuinely interesting?",
    "What still surprises you?",
    "What do you wish more people were curious about?",
    "What's worth being curious about in a tough call?",
    "What's a topic you'd give a whole talk on?",
    "What makes you curious about other people?",
    "What's a story you wish you knew more about?",
    "What's a question you'd ask anyone living or dead?",
    "What do you still want to understand better?",
  ],
  "Disconfirm Yourself": [
    "What evidence would make you change your mind today?",
    "What would prove your favorite belief wrong?",
    "Say what you'd accept as a clean disproof.",
    "What feedback would force you to update?",
    "What would make you walk away from a position?",
    "What would make you cut a slide you love?",
    "What would change your mind about a hot take?",
    "What part of your favorite story might be wrong?",
    "What's a question that could disconfirm your assumption?",
    "What explanation would falsify yours?",
  ],
  "Downward Landing": [
    "End on the bottom line — drop your voice.",
    "Say one true thing and land it down.",
    "Answer fast and land it down.",
    "Give feedback and land it down.",
    "Make your ask and land it down.",
    "Land the close — no upward lilt.",
    "Persuade — and land it down.",
    "Tell a short story — land the last line.",
    "Ask a question that lands flat.",
    "Explain something — close with weight.",
  ],
  "Draw the Line": [
    "Where do you draw the line at work?",
    "What's the line you won't cross for confidence?",
    "What won't you say, even on the spot?",
    "What's the line on feedback that goes too far?",
    "What's the line in a negotiation?",
    "What's the line you won't cross in a talk?",
    "What's the line in persuasion?",
    "What's the line you won't cross in a story?",
    "What question is over the line?",
    "What explanation is too much?",
  ],
  "First Principles": [
    "Strip the question down — what's actually being asked?",
    "Confidence — from first principles, what is it?",
    "What's the first principle of thinking on your feet?",
    "Feedback from first principles — what's it really for?",
    "What is negotiation, stripped to its core?",
    "What is a talk, stripped of its slides?",
    "What is persuasion, from first principles?",
    "What's a story, from first principles?",
    "What is a great question, stripped down?",
    "What is explaining, at its core?",
  ],
  "Make It Real": [
    "Don't talk theory — what really happened last time?",
    "Skip the lesson. What actually happened?",
    "Forget the framework — what's a real moment?",
    "Skip the model — what's a real piece of feedback you gave?",
    "Skip the script — what's a real trade you made?",
    "Drop the slides — what's the real moment from your week?",
    "Skip the theory — what's an actual case you changed?",
    "Drop the lesson — tell a real story.",
    "Skip the framework — what's a real question you've asked?",
    "Skip the textbook — explain it with what really happened.",
  ],
  "Metronome": [
    "Speak at an even tempo. Say something true.",
    "Steady tempo — describe confidence.",
    "Steady tempo, even when surprised.",
    "Give feedback at a steady pace.",
    "Stay steady through a hard ask.",
    "Hold tempo across a whole pitch.",
    "Persuade at a steady pace.",
    "Tell a story without rushing.",
    "Ask a steady question — no rush.",
    "Explain at a steady tempo.",
  ],
  "Monroe's Motivated Sequence": [
    "Attention, need, satisfaction, visualization, action — push back this way.",
    "Walk a confidence pitch through the five steps.",
    "Take any quick decision through attention → action.",
    "Take feedback through attention → action.",
    "Make a request through attention → action.",
    "Pitch an idea via attention, need, satisfy, visualize, act.",
    "Persuade with attention → action — go.",
    "Tell a story that ends in action.",
    "Ask a question that drives action.",
    "Explain a why and end with the ask.",
  ],
  "Name the Assumption": [
    "What assumption are you sitting on right now?",
    "What does confidence assume about you?",
    "What did you assume on your last quick decision?",
    "What does the feedback you gave assume?",
    "What does your last negotiation assume?",
    "What does your last talk assume the room knows?",
    "What does your strongest argument assume?",
    "What does your favorite story assume about the listener?",
    "What does your best question assume?",
    "What does your explanation assume?",
  ],
  "No Throat Clearing": [
    "Skip the windup — start with the answer.",
    "No 'so' — what's confidence to you?",
    "No 'um, so, well' — answer cold.",
    "No throat clearing — give feedback now.",
    "No 'just to set context' — make the ask.",
    "Skip the windup — open the talk.",
    "Skip the windup — start persuading.",
    "Skip the setup — start the story.",
    "No 'I was just wondering' — ask the question.",
    "Skip the windup — start the explanation.",
  ],
  "Order of Magnitude": [
    "Is your point ten times what you think, or a tenth?",
    "Is confidence a one-percent change or a ten-percent change?",
    "Was your last decision a small change or a big one?",
    "How big is the feedback — small fix or whole reset?",
    "Is the gap in the deal 5% or 50%?",
    "Is the talk a footnote or a turning point?",
    "Is the argument a small shift or a flip?",
    "Is the story a small moment or a big one?",
    "Is the question small or load-bearing?",
    "Is the explanation tiny or huge in scope?",
  ],
  "Pivot Tone": [
    "Shift from challenge to warmth without losing your point.",
    "Shift from confident to curious mid-thought.",
    "Shift tone mid-answer without losing the thread.",
    "Shift from sharp to kind without softening the truth.",
    "Shift from firm to flexible without giving up the line.",
    "Shift from cool to warm mid-talk.",
    "Shift from argument to invitation.",
    "Shift from suspense to relief in a short story.",
    "Shift from challenge to curiosity in your question.",
    "Shift from technical to human as you explain.",
  ],
  "Punctuation Breathing": [
    "Breathe with the punctuation — say a hard truth.",
    "Breathe at the commas — speak about confidence.",
    "Breathe through a fast answer.",
    "Breathe through tough feedback.",
    "Breathe through a tough ask.",
    "Breathe through your opening line.",
    "Breathe with the punctuation of a sharp claim.",
    "Breathe through the beats of a small story.",
    "Breathe before and after your question.",
    "Breathe through an explanation.",
  ],
  "Question Then Answer": [
    "Ask the pushback yourself — then answer it.",
    "Pose the confidence question, then answer it.",
    "Pose your own hardest question — and answer it.",
    "Ask the feedback question yourself, then answer.",
    "Ask what they want — then answer.",
    "Pose your opener as a question — then answer.",
    "Pose the doubt, then answer it.",
    "Ask the story's question, then answer.",
    "Pose a great question, then answer it.",
    "Ask a hard explainer question, then answer.",
  ],
  "Read the Room": [
    "Pick up a vibe from the room — name it.",
    "How can you tell when confidence is missing in a room?",
    "How do you read a room on the spot?",
    "How do you know your feedback isn't landing?",
    "How do you read where the other side is at?",
    "How do you tell when the room's drifting?",
    "How do you tell when you've lost them?",
    "How do you tell a story isn't landing?",
    "How do you tell when a question lands wrong?",
    "How do you tell when an explanation isn't sticking?",
  ],
  "Signpost First": [
    "Tell us where you're going before you go there.",
    "Signpost your answer about confidence — three beats.",
    "Signpost your answer before you give it.",
    "Signpost your feedback before delivering it.",
    "Signpost the offer before making it.",
    "Tell us where the talk is going — then go.",
    "Signpost the argument before making it.",
    "Signpost the story's shape before telling it.",
    "Signpost the question before asking it.",
    "Signpost the explanation before giving it.",
  ],
  "Slow Cooker": [
    "Slow your tempo. Say something true.",
    "Slow down to talk about confidence.",
    "Slow your answer — even under pressure.",
    "Slow your feedback. Let it sink in.",
    "Slow your ask. Let it land.",
    "Slow your pace across a whole pitch.",
    "Slow your persuasion — let weight build.",
    "Slow a story down. Let it breathe.",
    "Slow your question. Let them answer.",
    "Slow your explanation. Don't rush.",
  ],
  "Subject Verb Object": [
    "Push back in one clean sentence — subject, verb, object.",
    "Say what confidence is — subject, verb, object.",
    "Answer in one clean sentence — subject, verb, object.",
    "Give feedback in subject-verb-object form.",
    "Make the offer in one clean sentence.",
    "Open a talk in one clean sentence.",
    "Persuade in one clean sentence.",
    "Open a story in subject-verb-object form.",
    "Ask in one clean sentence.",
    "Explain in one clean sentence.",
  ],
  "Tempo Shift": [
    "Speed up for energy. Slow down for weight. Demo it.",
    "Shift tempo as you talk about confidence.",
    "Shift tempo as you answer on the spot.",
    "Shift tempo through tough feedback.",
    "Shift tempo through a hard ask.",
    "Shift tempo through your opener.",
    "Shift tempo to make a point land.",
    "Shift tempo through a small story.",
    "Shift tempo through a question and its answer.",
    "Shift tempo through an explanation.",
  ],
  "The 3 Point Rule": [
    "Three reasons you'd push back. Go.",
    "Three reasons confidence matters.",
    "Three reasons your snap answer holds.",
    "Three reasons your feedback is true.",
    "Three reasons your offer is fair.",
    "Three reasons the talk matters.",
    "Three reasons to change your mind.",
    "Three beats of a small story.",
    "Three questions worth asking.",
    "Three reasons your explanation works.",
  ],
  "The Claim and Proof": [
    "Make a claim. Then give one piece of proof.",
    "Claim something about confidence — and prove it.",
    "Snap claim plus one piece of proof.",
    "Make a feedback claim, then prove it.",
    "Make an offer claim, then prove it.",
    "Open a talk with a claim, then prove it.",
    "Persuade with a claim, then proof.",
    "Story claim + a single moment of proof.",
    "Pose a question, then the proof of why it matters.",
    "Make a claim about how things work, then prove it.",
  ],
  "The Hard Stop dup": [], // placeholder unused
  "The Monotone Breaker": [
    "Break a flat tone — say something true with energy.",
    "Break a monotone delivery to talk about confidence.",
    "Break a monotone delivery on the spot.",
    "Break a flat delivery on hard feedback.",
    "Break a flat delivery during a hard ask.",
    "Break a monotone delivery through your opener.",
    "Break a flat delivery while making a case.",
    "Break a monotone story — find the energy.",
    "Break a flat question — make it land.",
    "Break a monotone explanation — find the heat.",
  ],
  "The Perspective Shift": [
    "Argue from the other side as if you believe it.",
    "Pivot the confidence conversation to their side.",
    "Snap shift to their point of view.",
    "Give the feedback as if you were on the receiving end.",
    "Shift to the other side of the table — argue from there.",
    "Talk about the talk from the audience's seat.",
    "Persuade from the other side of the argument.",
    "Tell a story from the perspective of the other person.",
    "Ask the question from the other side.",
    "Explain it as if you were the one confused.",
  ],
  "The Problem Solution Frame": [
    "Name a real problem at work. Then a real fix.",
    "Real problem with confidence — real fix.",
    "Snap problem, snap fix.",
    "Real feedback problem — real fix.",
    "Real deal-blocker — real fix.",
    "Real talk-blocker — real fix.",
    "Real argument problem — real fix.",
    "Story-shaped problem and fix.",
    "Real question that opens a problem — and the answer.",
    "Real explanation problem — real fix.",
  ],
  "The Problem Solution Frame_dup": [],
  "The Story Arc": [
    "Beginning, middle, end — a true short story.",
    "Tell a story about confidence with an arc.",
    "Snap story — arc included.",
    "Tell a feedback story with an arc.",
    "Tell a negotiation story with an arc.",
    "Tell a talk story with an arc.",
    "Tell a story that changes someone's mind.",
    "Tell a story with a real beginning, middle, end.",
    "Tell a story that opens with a question.",
    "Tell a story that ends in an explanation.",
  ],
  "The So What Test": [
    "Make a point. Then ask: so what?",
    "What's the 'so what' of confidence?",
    "Snap answer — then so what?",
    "Feedback — then so what?",
    "Offer — then so what?",
    "Talk opener — then so what?",
    "Persuasion line — then so what?",
    "Story — then so what?",
    "Question — then so what?",
    "Explanation — then so what?",
  ],
  "The Stretch": [
    "Slow your line. Stretch it. Let it land.",
    "Stretch a confident line. Let it weigh.",
    "Stretch your answer. Don't rush.",
    "Stretch your feedback. Let it land.",
    "Stretch your ask. Let it weigh.",
    "Stretch the opener. Let it land.",
    "Stretch your case. Let it weigh.",
    "Stretch a story's key line. Let it sit.",
    "Stretch the question. Let it open.",
    "Stretch the explanation. Let it sink in.",
  ],
  "Two Then One": [
    "Two short. Then one long. About anything true.",
    "Two short. Then one long. About confidence.",
    "Two short. Then one long. Answer cold.",
    "Two short. Then one long. About feedback.",
    "Two short. Then one long. About a trade you'd make.",
    "Two short. Then one long. Open a talk.",
    "Two short. Then one long. Persuade.",
    "Two short. Then one long. Tell a tiny story.",
    "Two short. Then one long. Ask a question.",
    "Two short. Then one long. Explain.",
  ],
  "Volume Dial": [
    "Drop your volume to make a point.",
    "Soften your voice when you talk about confidence.",
    "Drop your volume on a snap answer.",
    "Drop your volume on hard feedback.",
    "Drop your volume to make an ask.",
    "Drop your volume mid-talk to take the room.",
    "Drop your volume to make a case.",
    "Drop your volume on the key line of a story.",
    "Drop your volume on the real question.",
    "Drop your volume on the key part of an explanation.",
  ],
  "Compare and Contrast": [
    "Compare two ways of thinking about your work.",
    "Compare quiet confidence to loud confidence.",
    "Compare a fast answer to a slow one.",
    "Compare critical feedback to coaching.",
    "Compare winning a deal to losing one well.",
    "Compare a great talk to a forgettable one.",
    "Compare persuasion to manipulation.",
    "Compare two ways to start a story.",
    "Compare a closed question to an open one.",
    "Compare a long explanation to a short one.",
  ],
};

// Backfills for any names I left blank
delete UNIVERSAL_A["The Hard Stop dup"];
delete UNIVERSAL_A["The Problem Solution Frame_dup"];

// Per-goal vertical-lensed universal B pool — uses education themes
// without requiring an imagined scene. We index by [exercise][goal].
// To stay maintainable, B and C use template families per exercise that
// take a goal-flavored noun cluster.

const GOAL_FLAVOR = {
  handling_objections: {
    bSeed: [
      "What do you do when a kid says 'this is stupid'?",
      "When a parent pushes back on a grade, where do you start?",
      "How do you respond when a student says you're wrong — and they're right?",
      "How do you take pushback in front of the whole class?",
      "What changes a kid's mind faster — logic or trust?",
    ],
    cSeed: [
      "Push back when a parent says their kid is being singled out — without shutting them down.",
      "Respond to 'we never use this stuff' from a teenager who means it.",
      "Push back on a student who says the rubric isn't fair.",
      "Respond to a colleague who says your lesson didn't go well — and is half right.",
      "Push back on an admin who says you should change your approach.",
    ],
  },
  confidence: {
    bSeed: [
      "What does confidence look like on a hard teaching day?",
      "Where does a teacher's confidence actually come from?",
      "What does it sound like when a teacher really believes their plan will work?",
      "When does a teacher know they've earned a class?",
      "What's the difference between confident teaching and loud teaching?",
    ],
    cSeed: [
      "Walk into a class that's not listening yet. What's your first line?",
      "Open a hard parent conversation like you've done it a hundred times.",
      "Stand up at a faculty meeting and say what you actually believe.",
      "Take the room on the first day of a new prep.",
      "Reset a class after a transition gone sideways.",
    ],
  },
  thinking_on_the_spot: {
    bSeed: [
      "A student asks you something you don't know. What's the right move?",
      "What do you do when the lesson breaks down in real time?",
      "How do you stay flexible when the room takes the lesson somewhere new?",
      "How do you think out loud in front of students without losing the room?",
      "What's the right way to admit you don't know something to a class?",
    ],
    cSeed: [
      "A kid asks the question your lesson didn't plan for. Answer.",
      "The tech fails mid-lesson. Keep teaching.",
      "A student gives an answer that's better than the one in your plan. Respond.",
      "A parent surprises you with a hard question at pickup. Answer.",
      "An admin walks in mid-lesson and asks you to explain your approach.",
    ],
  },
  giving_feedback: {
    bSeed: [
      "What's the kind of feedback students actually grow from?",
      "How do you give feedback to a kid who's already trying?",
      "What's the difference between feedback that helps and feedback that hurts?",
      "When does honest feedback do more harm than good?",
      "What's the best feedback you ever got — and why did it work?",
    ],
    cSeed: [
      "Give a student feedback on writing that's trying hard and missing.",
      "Tell a class their test results were lower than you expected.",
      "Give a colleague honest feedback on a lesson that didn't land.",
      "Hand back a paper that's clearly rushed — without crushing the kid.",
      "Tell a parent their child's effort isn't matching their potential.",
    ],
  },
  negotiation: {
    bSeed: [
      "What do you trade for engagement in a hard class?",
      "Where do you give a little in a parent meeting and where do you hold?",
      "What's worth negotiating with students and what isn't?",
      "What do you trade for time when the curriculum is too big?",
      "How do you keep authority while still meeting kids halfway?",
    ],
    cSeed: [
      "A class wants to skip the lesson for free time. Negotiate.",
      "A parent wants an extension you weren't planning to give.",
      "A colleague wants to swap duty days. Negotiate.",
      "A student wants a retake. Talk through it.",
      "A team wants to cut a topic from the unit. Hold or trade?",
    ],
  },
  presenting: {
    bSeed: [
      "What makes a lesson worth listening to?",
      "What separates a teacher who holds a room from one who doesn't?",
      "Why do most lesson hooks fail in the first minute?",
      "What's the opening line of a lesson that wakes a room up?",
      "What does a great teacher do in the first 30 seconds?",
    ],
    cSeed: [
      "Open a Monday morning lesson like the kids actually want to be there.",
      "Open a presentation to staff on something they've heard before.",
      "Open a back-to-school night with a line parents remember.",
      "Open a unit you've taught ten times — fresh.",
      "Open a class after a fire drill killed your hook.",
    ],
  },
  persuasion: {
    bSeed: [
      "What actually changes a student's mind?",
      "What changes a parent's mind in a tough conversation?",
      "What changes a colleague's mind about how to teach something?",
      "Why does logic alone almost never persuade kids?",
      "What's the most persuasive thing a teacher can do?",
    ],
    cSeed: [
      "Convince a class that today's lesson is worth the effort.",
      "Convince a parent to support a tougher grade you gave.",
      "Convince a colleague to try a new routine with you.",
      "Convince a student to redo a paper they think is fine.",
      "Convince a team to adopt a new structure for next year.",
    ],
  },
  storytelling: {
    bSeed: [
      "What's a true classroom moment that stays with you?",
      "What's a story you tell new teachers about the job?",
      "What's a small thing a student did that changed how you teach?",
      "What's a story you tell about why you stayed in this work?",
      "What's a moment with a parent that changed your mind?",
    ],
    cSeed: [
      "Tell a story about a kid who turned a year around.",
      "Tell a story about a lesson that worked when you didn't expect it.",
      "Tell a story about a parent meeting that surprised you.",
      "Tell a story about the first time a kid 'got it'.",
      "Tell a story about a year when teaching almost broke you.",
    ],
  },
  asking_questions: {
    bSeed: [
      "What's a question that opens a quiet class?",
      "What's a question that gets a real answer from a parent?",
      "What's a question worth asking every day in a classroom?",
      "What's a question you stopped asking — and wish you hadn't?",
      "What's the best question you've ever asked a student?",
    ],
    cSeed: [
      "Ask the class a question that gets the quiet kid to talk.",
      "Ask a parent the question that opens up the real concern.",
      "Ask a colleague the question they're avoiding.",
      "Ask a kid who says 'I don't know' a better question.",
      "Ask a question that turns a one-word answer into a real conversation.",
    ],
  },
  explaining: {
    bSeed: [
      "What do most teachers over-explain?",
      "What's the difference between explaining and telling?",
      "When does a good explanation make things worse?",
      "Why do kids tune out the second a teacher starts explaining?",
      "What's the simplest way to know your explanation landed?",
    ],
    cSeed: [
      "Explain a hard concept to a kid who's already lost.",
      "Explain a topic to a class after the first try failed.",
      "Explain why a grade is what it is — to a parent who's upset.",
      "Explain what you mean by 'effort' to a student who thinks they're trying.",
      "Explain a rule the class doesn't like, without sounding like a rulebook.",
    ],
  },
};

// Build per-exercise B and C generators by mixing the exercise's mechanic
// frame with the goal flavor. We keep the exercise mechanic obvious by
// adding an exercise-flavored verb stem.

const MECHANIC_FRAMES = {
  // Each entry returns { bPrefix, cPrefix } — text added before goal seeds to
  // make the mechanic the path of least resistance. Some exercises don't need
  // a frame; we leave the prefix empty in those cases.
  "Answer the Confusion": { b: "", c: "" },
  "Explain Like I'm 12": { b: "In a kid's words: ", c: "Like you're talking to a curious 12-year-old: " },
  "Headline First": { b: "Lead with the headline: ", c: "Headline first: " },
  "Cut by Half": { b: "Say the long version, then half it: ", c: "Long version first, then cut it: " },
  "The Word Budget": { b: "In thirty words: ", c: "Thirty words, no more: " },
  "Kill the Filler": { b: "No um, no like — ", c: "No filler — " },
  "The Steel Man": { b: "Argue the strongest version: ", c: "Steel-man it: " },
  "Strategic Pause": { b: "Pause before the key beat: ", c: "Pause where it matters: " },
  "Silence Over Filler": { b: "Use silence, not filler: ", c: "Let the silence carry it: " },
  "Two-Beat Pause": { b: "Land it, then two beats: ", c: "Land it — two beats: " },
  "Warmth Switch": { b: "Start firm, end warm: ", c: "Switch from challenge to warmth: " },
  "Prove It": { b: "Make the claim, then prove it: ", c: "Claim plus proof: " },
  "One Point Only": { b: "One point only — ", c: "Stay on one point: " },
  "The Analogy Bridge": { b: "Use an analogy: ", c: "Bridge with an analogy: " },
  "The 30 Second Rule": { b: "Thirty seconds: ", c: "Thirty seconds flat: " },
  "The Hard Stop": { b: "Say it, then stop: ", c: "Hit it, then stop: " },
  "The Single Sentence": { b: "In one sentence: ", c: "One sentence: " },
  "No Hedging": { b: "No 'I think' — ", c: "No hedging: " },
  "No Jargon Allowed": { b: "In plain English: ", c: "No jargon — " },
  "One Idea Per Response": { b: "One idea only: ", c: "Hold one idea: " },
  "Authority Voice": { b: "With weight: ", c: "Speak with authority: " },
  "Beat the Buzzer": { b: "Ten seconds: ", c: "Beat the buzzer — ten seconds: " },
  "Bottom Line First": { b: "Bottom line first: ", c: "Lead with the bottom line: " },
  "Conviction Floor": { b: "Hold the line: ", c: "What's the line you won't walk back: " },
  "Curiosity Lift": { b: "From real curiosity: ", c: "With curiosity in front: " },
  "Disconfirm Yourself": { b: "What would change your mind here: ", c: "Try to prove yourself wrong: " },
  "Downward Landing": { b: "Land it down: ", c: "End down, not up: " },
  "Draw the Line": { b: "Draw the line: ", c: "Name your line: " },
  "First Principles": { b: "From first principles: ", c: "Strip it to first principles: " },
  "Make It Real": { b: "Skip the theory — ", c: "Skip the theory: " },
  "Metronome": { b: "Steady tempo: ", c: "Hold steady tempo: " },
  "Monroe's Motivated Sequence": { b: "Attention, need, satisfy, visualize, act: ", c: "Walk it through attention → action: " },
  "Name the Assumption": { b: "Name the assumption: ", c: "What's the assumption underneath: " },
  "No Throat Clearing": { b: "Skip the windup: ", c: "No windup: " },
  "Order of Magnitude": { b: "Order of magnitude: ", c: "Is it 1×, 10×, or 100×: " },
  "Pivot Tone": { b: "Pivot your tone mid-answer: ", c: "Shift tone halfway through: " },
  "Punctuation Breathing": { b: "Breathe with the punctuation: ", c: "Breathe at the commas: " },
  "Question Then Answer": { b: "Pose the question, then answer: ", c: "Ask, then answer: " },
  "Read the Room": { b: "Read the room first: ", c: "Read the room: " },
  "Signpost First": { b: "Signpost first: ", c: "Tell them the shape first: " },
  "Slow Cooker": { b: "Slow it down: ", c: "Slow your tempo: " },
  "Subject Verb Object": { b: "Subject, verb, object: ", c: "One clean sentence: " },
  "Tempo Shift": { b: "Shift tempo: ", c: "Shift tempo mid-answer: " },
  "The 3 Point Rule": { b: "Three reasons: ", c: "Three reasons, not four: " },
  "The Claim and Proof": { b: "Claim plus one proof: ", c: "Make the claim, give the proof: " },
  "The Monotone Breaker": { b: "Break the monotone: ", c: "Find the energy: " },
  "The Perspective Shift": { b: "From their seat: ", c: "Shift to their perspective: " },
  "The Problem Solution Frame": { b: "Name the problem, name the fix: ", c: "Problem and fix: " },
  "The Story Arc": { b: "Beginning, middle, end: ", c: "Tell it with an arc: " },
  "The So What Test": { b: "Make the point, then so what: ", c: "Pass the so-what test: " },
  "The Stretch": { b: "Stretch the line: ", c: "Stretch the key line: " },
  "Two Then One": { b: "Two short, then one long: ", c: "Two short, one long: " },
  "Volume Dial": { b: "Drop your volume: ", c: "Soften the volume: " },
  "Compare and Contrast": { b: "Compare and contrast: ", c: "Compare two versions: " },
};

// Build B and C prompts for any exercise×goal by:
// B = prefix + bSeed[exIdx % bSeed.length] (varied across goal seeds)
// C = prefix + cSeed[exIdx % cSeed.length]
// We diagonalize: each (ex, goal) picks a unique seed from the goal pool.

function makePrompt(text, difficulty, tags) {
  // Trim to ≤180 chars (we author short)
  let t = text.trim();
  if (t.length > 180) t = t.slice(0, 178).trimEnd() + "…";
  return { text: t, difficulty, tags };
}

function pickFromPool(pool, exIdx, goalIdx) {
  // Diagonal pick to maximize variety: shift by exIdx across goals
  return pool[(exIdx + goalIdx * 3) % pool.length];
}

function buildAuthored(exercises) {
  const newInserts = []; // {exerciseName, prompts:[…]}
  const seen = new Set(); // global text dedup (lowercased)
  for (const [exIdx, ex] of exercises.entries()) {
    const exName = ex.name;
    const frames = MECHANIC_FRAMES[exName] || { b: "", c: "" };
    const universalPool = UNIVERSAL_A[exName] || [];
    const list = [];
    for (const [goalIdx, goal] of GOALS.entries()) {
      const flavor = GOAL_FLAVOR[goal];
      const aText = universalPool[goalIdx] || universalPool[goalIdx % universalPool.length] || `What's true about ${goal.replace(/_/g, " ")}?`;
      const bText = (frames.b || "") + pickFromPool(flavor.bSeed, exIdx, goalIdx);
      const cText = (frames.c || "") + pickFromPool(flavor.cSeed, exIdx, goalIdx);
      const triples = [
        { arch: "A", text: aText, difficulty: archDiff("A", exIdx, goalIdx) },
        { arch: "B", text: bText, difficulty: archDiff("B", exIdx, goalIdx) },
        { arch: "C", text: cText, difficulty: archDiff("C", exIdx, goalIdx) },
      ];
      for (const tr of triples) {
        const key = tr.text.toLowerCase().trim();
        if (seen.has(key)) {
          // Disambiguate with a goal-flavored micro-suffix to keep uniqueness
          const suffix = ` (on ${goal.replace(/_/g, " ")})`;
          tr.text = (tr.text + suffix).slice(0, 180);
        }
        seen.add(tr.text.toLowerCase().trim());
        list.push(makePrompt(tr.text, tr.difficulty, ["education", goal]));
      }
    }
    newInserts.push({ name: exName, prompts: list });
  }
  return newInserts;
}

// Load existing catalog and check duplicates against existing text -----------
const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
const existingText = new Set();
for (const ex of catalog.exercises) {
  for (const p of ex.prompts) existingText.add(p.text.toLowerCase().trim());
}

const inserts = buildAuthored(catalog.exercises);
let collisions = 0;
for (const ins of inserts) {
  const catEx = catalog.exercises.find(e => e.name === ins.name);
  if (!catEx) {
    console.error("missing exercise in catalog:", ins.name);
    process.exit(1);
  }
  for (const p of ins.prompts) {
    const key = p.text.toLowerCase().trim();
    if (existingText.has(key)) {
      // append a tiny disambiguator using the goal tag
      const goalTag = p.tags.find(t => t !== "education") || "ed";
      const suffix = ` — on ${goalTag.replace(/_/g, " ")}`;
      p.text = (p.text + suffix).slice(0, 180);
      collisions++;
    }
    existingText.add(p.text.toLowerCase().trim());
    catEx.prompts.push(p);
  }
}

// Difficulty stats -----------------------------------------------------------
const allNew = inserts.flatMap(i => i.prompts);
const counts = { intro: 0, core: 0, stretch: 0 };
for (const p of allNew) counts[p.difficulty]++;
console.log("authored:", allNew.length);
console.log("difficulty:", counts);
console.log("collisions resolved:", collisions);

// Write back -----------------------------------------------------------------
fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log("wrote", CATALOG_PATH);
