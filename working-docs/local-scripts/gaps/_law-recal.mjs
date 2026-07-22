// Generate 540 triples (54 exercises x 10 goals) x 3 archetypes (A/B/C) = 1,620 prompts
// for the law vertical. Appends to scripts/exercise-catalog/v1/vertical/law.json.
//
// Authoring rules per docs/prompt-design-canon.md:
//   - Repeatable on demand: no required setup
//   - Mechanic-aligned: each exercise's move is path of least resistance
//   - Vertical-flavored: law themes (clients, opposing counsel, judges, evidence,
//     arguments, persuasion) NOT vertical-locked specific scenes.
//   - Target user: junior associate, mid-level in-house, paralegal, public
//     defender, junior AUSA — NOT BigLaw partners.
//   - No MIL/voir dire/Daubert/30(b)(6) walls. Use lightly.
//   - ≤180 chars, conversational, second-person.
// Difficulty mix: ~50% intro / ~40% core / ~10% stretch.
// Archetypes A/B/C per (exercise x goal): universal / vertical-lensed universal / light scenario.

import fs from "node:fs";

const CATALOG_PATH = "C:/Users/MaxVolkov/dev/cognify/scripts/exercise-catalog/v1/vertical/law.json";

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

const D = { intro: "intro", core: "core", stretch: "stretch" };

// Difficulty plan per archetype: A mostly intro, B mostly core, C mix.
const archDiff = (arch, exIdx, goalIdx) => {
  const i = exIdx * 10 + goalIdx;
  if (arch === "A") return i % 5 === 0 ? D.core : D.intro;
  if (arch === "B") {
    const m = i % 10;
    if (m === 0) return D.stretch;
    if (m <= 3) return D.intro;
    return D.core;
  }
  const m = i % 10;
  if (m <= 1) return D.intro;
  if (m >= 8) return D.stretch;
  return D.core;
};

// ----------------------------------------------------------------------------
// A — Universal pools per exercise (10 prompts, one per goal slot).
// Calibration anchors:
//   A: "What's the truest thing about persuasion that no one writes down?"
//   B: "What's the difference between being right and winning?"
//   C: "Push back on an unfair characterization of your client."
// ----------------------------------------------------------------------------
const UNIVERSAL_A = {
  "Answer the Confusion": [
    "Someone pushes back on what you said. What's the cleanest way to address it?",
    "When you sense the room hasn't followed, what's your first move?",
    "Caught off guard by a sharp question — how do you avoid stalling?",
    "When your point lands wrong, how do you reset it?",
    "Someone disagrees mid-sentence. What's your move?",
    "How do you tell when an audience is lost?",
    "What changes a mind faster — proof or empathy?",
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
    "Explain what fairness actually is, in plain words.",
  ],
  "Headline First": [
    "What's the most important thing you'd say if you only had one sentence?",
    "Should you ever apologize for being right?",
    "Is being clear more important than being kind?",
    "Yes or no — does experience matter more than talent?",
    "Lead with the answer: what makes work meaningful?",
    "Should advocates ever pretend to be certain?",
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
    "What's the truest thing about persuasion that no one writes down?",
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
    "What's confidence like, if not confidence?",
    "Thinking on your feet is like ____ — fill it in.",
    "Feedback is like ____ — and what?",
    "Negotiation is like ____ — go.",
    "A great argument is like ____ — finish it.",
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
    "One sentence: pitch an argument you'd make.",
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
    "One point. Stay on it.",
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
    "What's the headline of your case?",
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
    "What would make you cut a point you love?",
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
    "What is an argument, stripped of its slides?",
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
    "Drop the deck — what's the real moment from your week?",
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
    "What does your last argument assume the room knows?",
    "What does your strongest claim assume?",
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
    "Skip the windup — open the case.",
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
    "Is the argument a footnote or a turning point?",
    "Is the claim a small shift or a flip?",
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
    "Shift from cool to warm mid-argument.",
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
    "Tell us where the case is going — then go.",
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
    "Open a case in one clean sentence.",
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
    "Three reasons the case matters.",
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
    "Open an argument with a claim, then prove it.",
    "Persuade with a claim, then proof.",
    "Story claim + a single moment of proof.",
    "Pose a question, then the proof of why it matters.",
    "Make a claim about how things work, then prove it.",
  ],
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
    "Talk about the case from the audience's seat.",
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
    "Real argument-blocker — real fix.",
    "Real persuasion problem — real fix.",
    "Story-shaped problem and fix.",
    "Real question that opens a problem — and the answer.",
    "Real explanation problem — real fix.",
  ],
  "The Story Arc": [
    "Beginning, middle, end — a true short story.",
    "Tell a story about confidence with an arc.",
    "Snap story — arc included.",
    "Tell a feedback story with an arc.",
    "Tell a negotiation story with an arc.",
    "Tell an argument story with an arc.",
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
    "Argument opener — then so what?",
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
    "Two short. Then one long. Open a case.",
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
    "Drop your volume mid-argument to take the room.",
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
    "Compare a great argument to a forgettable one.",
    "Compare persuasion to manipulation.",
    "Compare two ways to start a story.",
    "Compare a closed question to an open one.",
    "Compare a long explanation to a short one.",
  ],
};

// ----------------------------------------------------------------------------
// B and C goal-flavor seeds. Law themes: clients, opposing counsel, judges,
// witnesses, juries, evidence, arguments, persuasion — but NO required scene.
// Calibration anchors:
//   B: "What's the difference between being right and winning?"
//   C: "Push back on an unfair characterization of your client."
// ----------------------------------------------------------------------------
const GOAL_FLAVOR = {
  handling_objections: {
    bSeed: [
      "What's the difference between being right and winning?",
      "When opposing counsel pushes back, where do you start?",
      "How do you take a hit in front of the judge without flinching?",
      "What's the right way to discredit someone without seeming personal?",
      "What changes a judge's mind faster — citation or framing?",
    ],
    cSeed: [
      "Push back on an unfair characterization of your client.",
      "Respond to opposing counsel saying your client lacks credibility.",
      "Push back when a partner says your motion is too aggressive.",
      "Respond to a judge who says you're stretching the rule.",
      "Push back when a client says your strategy is too cautious.",
    ],
  },
  confidence: {
    bSeed: [
      "What does confidence look like on a bad day in court?",
      "Where does a lawyer's confidence actually come from?",
      "What does it sound like when a lawyer believes their own argument?",
      "When does a lawyer know they've earned a judge's attention?",
      "What's the difference between confident advocacy and loud advocacy?",
    ],
    cSeed: [
      "Stand up to argue a motion you're not sure you'll win.",
      "Open a tough client meeting like you've been here before.",
      "Speak first in a meeting full of senior partners — and say what you think.",
      "Take the room when opposing counsel is more senior than you.",
      "Hold your ground on the record when the judge is irritated.",
    ],
  },
  thinking_on_the_spot: {
    bSeed: [
      "A judge asks you something you didn't prep for. What's the move?",
      "What do you do when your theory of the case wobbles mid-argument?",
      "How do you stay flexible when a witness goes off-script?",
      "How do you think out loud at the podium without losing the bench?",
      "What's the right way to admit you don't know something in court?",
    ],
    cSeed: [
      "A judge surprises you with a question outside the briefing. Answer.",
      "A witness gives an answer you didn't expect. Keep going.",
      "Opposing counsel raises a new objection mid-argument. Respond.",
      "A client asks you a hard question in the elevator. Answer.",
      "A partner pulls you into a meeting cold and asks where things stand.",
    ],
  },
  giving_feedback: {
    bSeed: [
      "What's the kind of feedback junior lawyers actually grow from?",
      "How do you give feedback to a paralegal who's already working hard?",
      "What's the difference between feedback that helps and feedback that humiliates?",
      "When does honest feedback do more harm than good in a law firm?",
      "What's the best feedback you ever got — and why did it work?",
    ],
    cSeed: [
      "Give a junior associate feedback on a brief that's trying hard and missing.",
      "Tell a colleague their oral argument practice wasn't sharp enough.",
      "Give a paralegal honest feedback on a sloppy production.",
      "Hand back a redline to someone who's clearly rushed — without crushing them.",
      "Tell a junior their tone in the deposition was off.",
    ],
  },
  negotiation: {
    bSeed: [
      "What do you trade for in a hard settlement conversation?",
      "Where do you give a little and where do you hold?",
      "What's worth negotiating with opposing counsel and what isn't?",
      "What do you trade for time when discovery is closing?",
      "How do you keep authority while still meeting the other side halfway?",
    ],
    cSeed: [
      "Opposing counsel asks for a deadline extension you didn't plan to give.",
      "A client wants a position that gives away too much. Talk through it.",
      "A colleague wants to swap coverage on a hearing. Negotiate.",
      "Opposing counsel wants to narrow discovery in a way that hurts you.",
      "A team wants to cut a claim from the complaint. Hold or trade?",
    ],
  },
  presenting: {
    bSeed: [
      "What makes an oral argument worth listening to?",
      "What separates a lawyer who holds a courtroom from one who doesn't?",
      "Why do most opening lines in court land flat?",
      "What's the opening line of an argument that wakes a judge up?",
      "What does a great advocate do in the first 30 seconds?",
    ],
    cSeed: [
      "Open an argument on a motion you've made ten times — fresh.",
      "Open a closing on a hard case the night before.",
      "Open a CLE on a topic the room has heard before.",
      "Open a client pitch like the room actually wants to listen.",
      "Open a meeting with senior partners on a case they don't know well.",
    ],
  },
  persuasion: {
    bSeed: [
      "What actually changes a judge's mind?",
      "What changes a jury's mind in a tough case?",
      "What changes a partner's mind about how to approach a brief?",
      "Why does authority alone rarely persuade?",
      "What's the most persuasive thing a lawyer can do?",
    ],
    cSeed: [
      "Convince a client that today's strategy is worth the cost.",
      "Convince a partner to back a riskier theory.",
      "Convince opposing counsel to take a deal off the table.",
      "Convince a judge that the obvious read of the rule isn't the right one.",
      "Convince a colleague to adopt a routine you think works.",
    ],
  },
  storytelling: {
    bSeed: [
      "What's a true case moment that stays with you?",
      "What's a story you tell new associates about the work?",
      "What's a small thing a client said that changed how you practice?",
      "What's a story you tell about why you stayed in this work?",
      "What's a moment with a judge that changed your mind?",
    ],
    cSeed: [
      "Tell a story about a case that turned at an unexpected moment.",
      "Tell a story about an argument that worked when you didn't expect it.",
      "Tell a story about a client meeting that surprised you.",
      "Tell a story about the first time you ran a hearing alone.",
      "Tell a story about a year when the practice almost broke you.",
    ],
  },
  asking_questions: {
    bSeed: [
      "What's a question that opens up a quiet witness?",
      "What's a question that gets a real answer from a client?",
      "What's a question worth asking in every intake?",
      "What's a question you stopped asking — and wish you hadn't?",
      "What's the best question you've ever asked on a fact pattern?",
    ],
    cSeed: [
      "Ask a witness the question that gets them to drop the rehearsed answer.",
      "Ask a client the question that surfaces what they're really worried about.",
      "Ask a colleague the question they're avoiding about the case.",
      "Ask a paralegal a better question than 'is it done'.",
      "Ask a question that turns a one-word answer into a real conversation.",
    ],
  },
  explaining: {
    bSeed: [
      "What do most lawyers over-explain?",
      "What's the difference between explaining the law and telling someone the answer?",
      "When does a good legal explanation make things worse?",
      "Why do clients tune out the second a lawyer starts citing?",
      "What's the simplest way to know your explanation landed with a client?",
    ],
    cSeed: [
      "Explain a procedural posture to a client who's already lost.",
      "Explain a ruling to a client after the first try failed.",
      "Explain why the outcome is what it is — to a client who's upset.",
      "Explain what 'reasonable' means to a client who thinks it's obvious.",
      "Explain a rule the client doesn't like, without sounding like a rulebook.",
    ],
  },
};

// Per-exercise mechanic frames for B and C prompts.
const MECHANIC_FRAMES = {
  "Answer the Confusion": { b: "", c: "" },
  "Explain Like I'm 12": { b: "In a kid's words: ", c: "Like you're talking to a curious 12-year-old: " },
  "Headline First": { b: "Lead with the headline: ", c: "Headline first: " },
  "Cut by Half": { b: "Say the long version, then half it: ", c: "Long version first, then cut it: " },
  "The Word Budget": { b: "In thirty words: ", c: "Thirty words, no more: " },
  "Kill the Filler": { b: "No um, no like — ", c: "No filler — " },
  "The Steel Man": { b: "Argue the strongest version: ", c: "Steel-man it: " },
  "Strategic Pause": { b: "Pause before the key beat: ", c: "Pause where it matters: " },
  "Silence Over Filler": { b: "Use silence, not filler: ", c: "Let the silence carry it: " },
  "Two-Beat Landing": { b: "Land it, then two beats: ", c: "Land it — two beats: " },
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

function makePrompt(text, difficulty, tags) {
  let t = text.trim();
  if (t.length > 180) t = t.slice(0, 178).trimEnd() + "…";
  return { text: t, difficulty, tags };
}

function pickFromPool(pool, exIdx, goalIdx) {
  return pool[(exIdx + goalIdx * 3) % pool.length];
}

function buildAuthored(exercises) {
  const newInserts = [];
  const seen = new Set();
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
          const suffix = ` (on ${goal.replace(/_/g, " ")})`;
          tr.text = (tr.text + suffix).slice(0, 180);
        }
        seen.add(tr.text.toLowerCase().trim());
        list.push(makePrompt(tr.text, tr.difficulty, ["law", goal]));
      }
    }
    newInserts.push({ name: exName, prompts: list });
  }
  return newInserts;
}

// Load catalog and dedupe vs existing prompts ------------------------------
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
      const goalTag = p.tags.find(t => t !== "law") || "law";
      const suffix = ` — on ${goalTag.replace(/_/g, " ")}`;
      p.text = (p.text + suffix).slice(0, 180);
      collisions++;
    }
    existingText.add(p.text.toLowerCase().trim());
    catEx.prompts.push(p);
  }
}

const allNew = inserts.flatMap(i => i.prompts);
const counts = { intro: 0, core: 0, stretch: 0 };
for (const p of allNew) counts[p.difficulty]++;
console.log("authored:", allNew.length);
console.log("difficulty:", counts);
console.log("collisions resolved:", collisions);

fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log("wrote", CATALOG_PATH);
