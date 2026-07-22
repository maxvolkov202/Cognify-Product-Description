// Wave 4 retry — second half of sales vertical recalibration.
// Generates 27 exercises × 10 goals × 3 archetypes (A/B/C) = 810 prompts.
//
// Targets the LAST 27 exercises when the sales catalog is sorted by
// (dimension ASC, name ASC). The first 27 are owned by a parallel agent.
//
// Authoring rules per docs/prompt-design-canon.md:
//   - Repeatable on demand (no required imagined scene)
//   - Mechanic-aligned: exercise's move is the path of least resistance
//   - Vertical-flavored, not vertical-locked (sales themes: deals, buyers,
//     pricing, objections, demos — without specific senior-only scenarios)
//   - Conversational tone, ≤180 chars
// Difficulty mix: ~50% intro / ~40% core / ~10% stretch across all 810.
// Target user: AE 1-3 years, SDR/BDR, CSM — NOT VPs.

import fs from "node:fs";

const CATALOG_PATH = "C:/Users/MaxVolkov/dev/cognify/scripts/exercise-catalog/v1/vertical/sales.json";

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

// Exercises in the SECOND HALF (rows 28-54 after dim/name sort).
const TARGET_EXERCISES = new Set([
  "Bottom Line First",
  "Compare and Contrast",
  "Monroe's Motivated Sequence",
  "Question Then Answer",
  "Signpost First",
  "The 3 Point Rule",
  "The Problem Solution Frame",
  "The Story Arc",
  "Two Then One",
  "Disconfirm Yourself",
  "Draw the Line",
  "First Principles",
  "Name the Assumption",
  "Order of Magnitude",
  "The Claim and Proof",
  "The Perspective Shift",
  "The So What Test",
  "The Steel Man",
  "Authority Voice",
  "Conviction Floor",
  "Curiosity Lift",
  "Downward Landing",
  "Pivot Tone",
  "Read the Room",
  "The Monotone Breaker",
  "Volume Dial",
  "Warmth Switch",
]);

const D = { intro: "intro", core: "core", stretch: "stretch" };

// Difficulty plan per archetype (canon: ~50/40/10).
// A=universal → mostly intro. B=vertical-lensed → core-leaning.
// C=light scenario → core/stretch leaning.
function archDiff(arch, exIdx, goalIdx) {
  const i = exIdx * 10 + goalIdx;
  if (arch === "A") {
    return i % 5 === 0 ? D.core : D.intro;
  }
  if (arch === "B") {
    const m = i % 10;
    if (m === 0) return D.stretch;
    if (m <= 3) return D.intro;
    return D.core;
  }
  // C
  const m = i % 10;
  if (m <= 1) return D.intro;
  if (m >= 8) return D.stretch;
  return D.core;
}

// ---------------------------------------------------------------------------
// Universal A pools per exercise (10 entries each — one per goal slot).
// Pure mechanic, no vertical. Canon archetype A.
// ---------------------------------------------------------------------------
const UNIVERSAL_A = {
  "Bottom Line First": [
    "What's the bottom line of what you actually believe about your work?",
    "Lead with the answer: what makes someone trust you fast?",
    "Bottom line first — what changes when you're under pressure?",
    "What's the headline feedback you'd give yourself?",
    "Lead with the call: should you ever take less than you asked for?",
    "What's the bottom line of a talk worth listening to?",
    "Bottom line first — what actually changes someone's mind?",
    "Lead with the punchline of a story you love.",
    "What's the bottom line question worth asking in any room?",
    "Lead with the answer: what's the simplest version of a hard idea?",
  ],
  "Compare and Contrast": [
    "Compare a pushback you took well to one you didn't.",
    "Compare quiet confidence to loud confidence.",
    "Compare a fast answer to a slow, considered one.",
    "Compare feedback that helps to feedback that hurts.",
    "Compare a fair trade to a bad one.",
    "Compare a talk you'd watch twice to one you'd leave.",
    "Compare persuasion that lasts to persuasion that fades.",
    "Compare a true story to a polished one.",
    "Compare a good question to a leading one.",
    "Compare a clear explanation to a clever one.",
  ],
  "Monroe's Motivated Sequence": [
    "Attention, need, satisfy, visualize, act — pitch any idea you care about.",
    "Walk an idea you believe in through attention → action.",
    "Pose attention, need, satisfy, visualize, act on something true to you.",
    "Run the five steps on a piece of feedback you wish people heard.",
    "Walk a fair ask through attention, need, satisfy, visualize, act.",
    "Run the sequence on the most important thing you'd say this year.",
    "Use the five steps to change someone's mind on something small.",
    "Tell a real story through attention → action.",
    "Open with attention — what's the question behind the question?",
    "Walk an idea anyone can understand through the full sequence.",
  ],
  "Question Then Answer": [
    "Pose a question worth answering — then answer it.",
    "Ask the question you wish people asked you. Then answer it.",
    "Pose the hardest question about your work — then answer.",
    "Ask the question your feedback should answer. Then answer it.",
    "What's the question behind a real negotiation? Pose it, answer it.",
    "Ask the question every talk should answer. Then answer it.",
    "Pose the question that changes minds. Answer it.",
    "Ask the question a story is really about. Then answer.",
    "What's the question worth posing out loud? Answer it.",
    "Pose the question a beginner would ask. Then answer.",
  ],
  "Signpost First": [
    "Tell me the shape of your answer before you give it.",
    "Signpost first: what are the two things you're about to say?",
    "Before you answer, tell me how you'll get there.",
    "Signpost first — say what the feedback is, then give it.",
    "Tell me the structure of a fair trade before you propose it.",
    "Signpost the three beats of a talk you'd actually give.",
    "Signpost first — what are you trying to change my mind about?",
    "Tell me the shape of the story before you tell it.",
    "Signpost the question you're really asking.",
    "Signpost first — what's the shape of the explanation?",
  ],
  "The 3 Point Rule": [
    "Three reasons your work matters — go.",
    "Three reasons confidence isn't loudness.",
    "Three things to do when your mind goes blank.",
    "Three rules for feedback that actually lands.",
    "Three things worth trading for in any negotiation.",
    "Three things a great talk always does.",
    "Three things that actually change a mind.",
    "Three beats of a story worth telling.",
    "Three questions worth asking in any room.",
    "Three rules for explaining something hard.",
  ],
  "The Problem Solution Frame": [
    "Name the problem with most pushback — then the fix.",
    "Name the problem with fake confidence — then what to do.",
    "Name the problem with stalling — then the fix.",
    "Name the problem with bad feedback — then a better way.",
    "Name a thing people lose in negotiations — then the fix.",
    "Name the problem most talks have — then the fix.",
    "Name the problem with most persuasion — then a better play.",
    "Name the problem with most stories — then a better one.",
    "Name the problem with bad questions — then a better one.",
    "Name the problem with most explanations — then the fix.",
  ],
  "The Story Arc": [
    "Tell a true story with a clear beginning, middle, and end.",
    "Tell a story about a moment you found your footing.",
    "Tell a true story about a time you had to think on your feet.",
    "Tell a story about feedback that changed you.",
    "Tell a story about a trade you made and what you got back.",
    "Tell a story you've never told a stage — short arc.",
    "Tell a story about changing someone's mind.",
    "Tell a story you tell new people about your work.",
    "Tell a story that ends in a question.",
    "Tell a story that made a hard idea click.",
  ],
  "Two Then One": [
    "Two short sentences, then one long one — on what you believe about work.",
    "Two short, one long — on what confidence actually is.",
    "Two short, one long — on thinking when you don't have time to think.",
    "Two short, one long — on what good feedback feels like.",
    "Two short, one long — on what's worth trading.",
    "Two short, one long — on opening a talk that holds the room.",
    "Two short, one long — on what changes a mind.",
    "Two short, one long — start a true story.",
    "Two short, one long — ask the real question.",
    "Two short, one long — explain a hard thing.",
  ],
  "Disconfirm Yourself": [
    "What would actually change your mind about how you work?",
    "What would prove your confidence is misplaced?",
    "What would prove your gut wrong on a snap call?",
    "What would prove your feedback style isn't landing?",
    "What would tell you you negotiated badly even if you won?",
    "What would prove your last big talk didn't land?",
    "What would change your mind about how you persuade?",
    "What would prove your favorite story is the wrong one to tell?",
    "What would prove your favorite question is the wrong one?",
    "What would prove your explanation isn't landing?",
  ],
  "Draw the Line": [
    "What's a line you don't cross in your work, even under pressure?",
    "What's the line between confident and arrogant?",
    "What's the line between thinking on your feet and winging it?",
    "What's the line between honest feedback and cruelty?",
    "What's the line you don't cross in a negotiation?",
    "What's the line between presenting and performing?",
    "What's the line between persuasion and manipulation?",
    "What's the line between a true story and a tidy one?",
    "What's the line between curious and intrusive?",
    "What's the line between explaining and lecturing?",
  ],
  "First Principles": [
    "Strip work to first principles — what's actually true?",
    "Strip confidence to first principles — what is it really?",
    "From first principles, what is thinking on your feet?",
    "From first principles, what is feedback even for?",
    "Strip negotiation to first principles — what's the real game?",
    "From first principles, what is a talk supposed to do?",
    "From first principles, what is persuasion?",
    "From first principles, what makes a story worth telling?",
    "From first principles, what makes a question good?",
    "From first principles, what makes an explanation land?",
  ],
  "Name the Assumption": [
    "Name the assumption behind your last hard call.",
    "Name the assumption hidden in 'just be confident'.",
    "Name the assumption you make when you answer fast.",
    "Name the assumption behind most feedback.",
    "Name the assumption behind 'meet in the middle'.",
    "Name the assumption your favorite opener relies on.",
    "Name the assumption behind 'logic wins'.",
    "Name the assumption behind your go-to story.",
    "Name the assumption behind your favorite question.",
    "Name the assumption behind your default explanation.",
  ],
  "Order of Magnitude": [
    "Roughly — is it a 1×, 10×, or 100× problem? Pick anything.",
    "Order of magnitude — how often does confidence actually matter?",
    "Order of magnitude — how often do snap decisions go right?",
    "Order of magnitude — how often does feedback change behavior?",
    "Order of magnitude — how much of a negotiation is preparation?",
    "Order of magnitude — how much of a talk's impact is the opener?",
    "Order of magnitude — how often does persuasion work the first time?",
    "Order of magnitude — how many stories does one good one beat?",
    "Order of magnitude — how often does asking beat telling?",
    "Order of magnitude — how often does a second explanation land better?",
  ],
  "The Claim and Proof": [
    "Make a real claim about your work — back it up.",
    "Make a claim about confidence. Now prove it.",
    "Make a claim about thinking under pressure. Now back it.",
    "Make a claim about feedback. Now prove it.",
    "Make a claim about what works in negotiation. Back it.",
    "Make a claim about what makes a talk work. Prove it.",
    "Make a claim about what changes minds. Back it.",
    "Make a claim about storytelling. Prove it with one.",
    "Make a claim about questions. Back it.",
    "Make a claim about explaining. Back it with one example.",
  ],
  "The Perspective Shift": [
    "Talk about your work from someone else's seat.",
    "Talk about confidence from the seat of someone who lacks it.",
    "Talk about a snap decision from the other person's view.",
    "Give feedback from the receiver's seat.",
    "Talk about a negotiation from the other side of the table.",
    "Talk about a talk from a bored listener's seat.",
    "Make your case from the seat of the person you're persuading.",
    "Tell your story from someone else inside it.",
    "Ask your favorite question from the other person's seat.",
    "Explain something from the seat of someone who doesn't get it.",
  ],
  "The So What Test": [
    "Make a point — then pass the so-what test.",
    "Say what confidence is — then so what?",
    "Say what to do when you blank — then so what?",
    "Give a piece of feedback — then so what?",
    "Make a point about negotiation — then so what?",
    "Make a point about presenting — then so what?",
    "Make a point about persuasion — then so what?",
    "Tell a story — then so what?",
    "Ask a question — then so what?",
    "Explain something — then so what?",
  ],
  "The Steel Man": [
    "Argue the strongest case against the way you work.",
    "Steel-man the people who say confidence is overrated.",
    "Steel-man the case for slowing down instead of thinking fast.",
    "Steel-man the people who say feedback should be private.",
    "Steel-man the people who refuse to negotiate.",
    "Steel-man a talk you usually skip.",
    "Steel-man the case against persuasion.",
    "Steel-man a story you usually dismiss.",
    "Steel-man the question you usually avoid.",
    "Steel-man an explanation you usually reject.",
  ],
  "Authority Voice": [
    "Say something true about your work — with weight behind it.",
    "Say what confidence sounds like — and sound like it.",
    "Make a snap call — and back it with your voice.",
    "Deliver hard feedback with weight, not volume.",
    "Hold a number out loud, with authority.",
    "Open a talk like you've earned the room.",
    "Make your strongest claim with weight, not volume.",
    "Open a story like it matters.",
    "Ask a question with the weight of someone who's thought about it.",
    "Explain something hard with the weight to make it land.",
  ],
  "Conviction Floor": [
    "What's the line you won't walk back, no matter who pushes?",
    "What do you actually believe about confidence — and won't soften?",
    "When pressed, what's the answer you won't change?",
    "What's the feedback you'd give again, even if it cost you?",
    "What's the term you won't move off in a negotiation?",
    "What's the line in a talk you won't drop?",
    "What's the claim you'd defend twice?",
    "What's the part of your story you won't sand down?",
    "What's the question you won't stop asking?",
    "What's the part of an explanation you won't shorten?",
  ],
  "Curiosity Lift": [
    "Open from real curiosity — what's a thing you don't fully understand?",
    "From curiosity: what makes someone actually confident?",
    "From curiosity: why do good answers come slower than fast ones?",
    "From curiosity: why does feedback work for some people and not others?",
    "From curiosity: why do people leave value on the table?",
    "From curiosity: why do some talks land and most don't?",
    "From curiosity: what actually changes a mind?",
    "From curiosity: why do some stories stick and others don't?",
    "From curiosity: what makes a question worth asking?",
    "From curiosity: what makes some explanations finally click?",
  ],
  "Downward Landing": [
    "End down, not up — say what's actually true about your work.",
    "Land it down — what does confidence really sound like?",
    "End down — what do you do when you don't know the answer?",
    "Land it down — what's the feedback that mattered most to you?",
    "End down — what's worth giving up to get something better?",
    "Land it down — what's the line a talk should end on?",
    "End down — what's the truest thing about changing minds?",
    "Land it down — end a story without a flourish.",
    "End down — ask the question with weight, not lift.",
    "Land it down — close the explanation, don't trail off.",
  ],
  "Pivot Tone": [
    "Start sharp, end warm — on something you believe about work.",
    "Start playful, end firm — on what confidence really is.",
    "Start serious, end light — on thinking on your feet.",
    "Start warm, end direct — on hard feedback.",
    "Start firm, end open — on a negotiation principle.",
    "Start dry, end with energy — on opening a talk.",
    "Start curious, end direct — on what changes minds.",
    "Start soft, end sharp — on a true story.",
    "Start direct, end curious — on a question worth asking.",
    "Start firm, end warm — on a hard explanation.",
  ],
  "Read the Room": [
    "When you sense the room turn, what's your first move?",
    "How do you tell when confidence is reading as arrogance?",
    "How do you know when to slow down and when to push through?",
    "How do you know feedback isn't landing?",
    "How do you read when someone's done negotiating?",
    "How do you know a talk is losing the room?",
    "How do you know you've stopped persuading?",
    "How do you know a story is overstaying its welcome?",
    "How do you know it's time to stop asking questions?",
    "How do you know your explanation isn't landing?",
  ],
  "The Monotone Breaker": [
    "Find the energy line in something you actually believe.",
    "Where's the energy in saying what confidence is?",
    "Where's the energy in 'I don't know yet'?",
    "Where's the energy in hard feedback?",
    "Where's the energy in holding a number?",
    "Find the energy line of a talk you'd give.",
    "Find the energy line in changing a mind.",
    "Find the energy line of your favorite story.",
    "Find the energy in the question you keep asking.",
    "Find the energy line in a clean explanation.",
  ],
  "Volume Dial": [
    "Drop your volume on the truest thing you'd say about work.",
    "Drop your volume on what confidence really is.",
    "Drop your volume on 'let me think about it'.",
    "Drop your volume on the hardest feedback line.",
    "Drop your volume on the number you won't move.",
    "Drop your volume on the key line of a talk.",
    "Drop your volume on the line that changes a mind.",
    "Drop your volume on the line of a story that matters.",
    "Drop your volume on the question worth asking.",
    "Drop your volume on the key line of an explanation.",
  ],
  "Warmth Switch": [
    "Make a hard claim about your work — then soften it without weakening it.",
    "Say what real confidence is, then make it human.",
    "Push back on a snap call, then warm up.",
    "Give critical feedback, then make it kind.",
    "Hold a hard line in a negotiation, then warm up.",
    "Open a talk firm, then warm.",
    "Make a strong claim, then make it personal.",
    "Tell a hard story, then warm the ending.",
    "Ask a sharp question, then warm the room.",
    "Explain a hard thing, then make it tender.",
  ],
};

// ---------------------------------------------------------------------------
// Sales-flavored goal seeds for archetypes B and C.
// B = vertical-lensed universal (sales themes; no specific scene).
// C = light scenario (the *kind* of moment anyone in sales encounters).
// 10+ seeds per goal so diagonalization across 27 exercises stays varied.
// ---------------------------------------------------------------------------
const GOAL_FLAVOR = {
  handling_objections: {
    bSeed: [
      "Why do buyers raise the price objection even when price isn't the issue?",
      "What does pushback actually mean when it shows up late in a deal?",
      "Why do the loudest objections usually hide a different worry?",
      "What's the difference between an objection and a stall?",
      "Why do most reps argue with objections instead of using them?",
      "What's the move when a buyer keeps repeating the same concern?",
      "When does answering an objection too fast cost you the deal?",
      "Why do reasonable buyers raise unreasonable objections?",
      "What changes when you treat an objection as a question, not an attack?",
      "What's the truest thing about handling pushback in a sales conversation?",
    ],
    cSeed: [
      "Push back on a buyer who keeps saying 'we're just not sure yet'.",
      "Respond to 'we're going with someone else' without sounding desperate.",
      "Respond to a buyer who keeps raising the same objection a third time.",
      "Push back on 'this is too expensive' without dropping price.",
      "Respond to 'we need to think about it' without folding.",
      "Push back on a buyer who keeps moving the goalposts.",
      "Respond to 'just send me pricing' without just sending pricing.",
      "Push back on a buyer who says they need every feature on the list.",
      "Respond to 'we'll come back to you next quarter' for real.",
      "Push back on a champion who suddenly goes cold on you.",
    ],
  },
  confidence: {
    bSeed: [
      "What does real confidence sound like on a discovery call?",
      "Where does a rep's confidence actually come from?",
      "Why do confident reps not need to talk as much?",
      "What's the difference between confident and pushy?",
      "When does confidence show up most in a sales conversation?",
      "What does it sound like when a rep believes the price is fair?",
      "Why do uncertain reps over-explain?",
      "Where does confidence end and arrogance begin in selling?",
      "What's the truest thing about confidence in a tough quarter?",
      "When does quiet confidence beat loud confidence on a call?",
    ],
    cSeed: [
      "Open a cold call like you've done it a hundred times.",
      "Open a demo to a skeptical room like you mean it.",
      "Lead a kickoff call like you've earned the seat.",
      "Open a pricing conversation without flinching.",
      "Take the first hard question on a call without hedging.",
      "Open a renewal conversation like you actually believe in the value.",
      "Hold the room when a deal slips and you have to say why.",
      "Lead a forecast call after a miss without losing the room.",
      "Open a deal review like you've thought about it hard.",
      "Open a difficult internal call about a stalled account.",
    ],
  },
  thinking_on_the_spot: {
    bSeed: [
      "What do you do when a buyer asks something you don't know on a call?",
      "How do you keep a conversation moving when a question knocks you off plan?",
      "What's the right way to say 'I'll get back to you' without losing trust?",
      "How do you think out loud on a call without sounding lost?",
      "What's the best way to buy yourself ten seconds in a tough moment?",
      "What changes when you stop trying to have the perfect answer?",
      "Why does rehearsing kill your ability to think on your feet?",
      "What's the truest thing about staying sharp when a call goes sideways?",
      "How do you reset a call after a question throws you?",
      "When does saying 'I don't know' actually help the deal?",
    ],
    cSeed: [
      "A buyer asks a question your demo doesn't cover. Answer.",
      "A buyer asks about a competitor mid-pitch. Respond.",
      "A buyer surprises you with a pricing question early. Respond.",
      "The decision-maker joins late and asks for the summary. Go.",
      "A buyer pushes you on a feature that doesn't exist yet.",
      "A new stakeholder asks why they should care. Answer.",
      "A buyer asks 'why you?' out of nowhere. Respond.",
      "A buyer says 'tell me about a deal that didn't go well'. Answer.",
      "A buyer asks for a use case you've never heard of. Respond.",
      "A buyer says 'we already tried something like this'. Respond.",
    ],
  },
  giving_feedback: {
    bSeed: [
      "What's the kind of feedback a rep actually grows from?",
      "Why does most coaching not change behavior on the next call?",
      "When does feedback to a teammate help vs. just hurt?",
      "What's the difference between feedback and venting after a lost deal?",
      "What's the best feedback you ever got on a call?",
      "Why do most deal reviews avoid the real issue?",
      "When does honest feedback to a peer cost more than it earns?",
      "What's the truest thing about feedback in a sales team?",
      "How do you tell someone they're losing a deal they think they're winning?",
      "What changes when feedback comes with the same risk you're asking them to take?",
    ],
    cSeed: [
      "Tell a teammate their last demo wasn't tight, without crushing them.",
      "Tell a teammate their discovery is missing the budget question.",
      "Give a peer feedback on a call that went off-script.",
      "Tell a teammate their forecast looks wrong.",
      "Tell a teammate they're talking too much on calls.",
      "Tell a peer their follow-up is hurting their pipeline.",
      "Tell your manager their advice on a deal didn't help.",
      "Tell a teammate their MEDDIC notes aren't matching reality.",
      "Give a teammate honest feedback on a deal they just lost.",
      "Tell a peer their cold email isn't going to convert.",
    ],
  },
  negotiation: {
    bSeed: [
      "What's worth trading in a deal and what isn't?",
      "Where do reps give up too much value, too early?",
      "What's the difference between a discount and a concession?",
      "What's the truest thing about negotiating with procurement?",
      "Why does 'split the difference' usually lose money?",
      "When does walking away actually save a deal?",
      "Where does the real negotiation in a deal actually happen?",
      "What do most reps misread as a hard 'no'?",
      "Why do reps cave on price they shouldn't?",
      "What's worth holding the line on, even when the deal might slip?",
    ],
    cSeed: [
      "Hold the line when a buyer asks for a discount you can't justify.",
      "Trade something other than price when a buyer asks for a cut.",
      "Push back on a buyer who wants longer terms for the same number.",
      "Respond to 'meet us halfway' without folding.",
      "Hold your number against a procurement team that wants 30% off.",
      "Trade scope for price when a buyer wants both.",
      "Push back on free pilot extensions without losing the deal.",
      "Hold a term you know is fair when the buyer says it's a deal-breaker.",
      "Negotiate when the buyer has the better leverage.",
      "Hold price when the buyer threatens to walk.",
    ],
  },
  presenting: {
    bSeed: [
      "What makes a demo worth watching all the way through?",
      "Why do most pitches lose in the first 30 seconds?",
      "What's the difference between a demo and a pitch?",
      "What does a great opening to a sales call sound like?",
      "What separates a presentation that holds a room from one that doesn't?",
      "Why do most decks talk about the product instead of the buyer?",
      "What's the truest thing about presenting to a buyer who's seen ten of these?",
      "What do most reps over-prepare and under-deliver?",
      "What makes a demo land with a technical buyer vs. a business one?",
      "What does a great close to a deck actually sound like?",
    ],
    cSeed: [
      "Open a demo without saying who you are first.",
      "Open a pitch to a room that's running late and tired.",
      "Open a pitch when the buyer already knows what you sell.",
      "Open a deck after a competitor just presented.",
      "Open a discovery call so the buyer wants to keep talking.",
      "Open a renewal pitch to a buyer who's already grumbling.",
      "Open a board-level pitch like the buyer will remember the first line.",
      "Open a virtual demo so people don't tune out.",
      "Open a quick pitch in an elevator without sounding canned.",
      "Open a pitch to a buyer who's already mostly sold.",
    ],
  },
  persuasion: {
    bSeed: [
      "What actually changes a buyer's mind?",
      "Why does logic alone almost never close a deal?",
      "What's more persuasive than a great feature list?",
      "What's the truest thing about persuading someone who's already heard the pitch?",
      "What separates persuading and pushing?",
      "Why do the best reps argue less, not more?",
      "When does pressure stop working in a deal?",
      "What's the move when the champion believes but the buyer doesn't?",
      "Why do buyers buy from people they trust more than people they like?",
      "What's the most persuasive thing a rep can do on a tough call?",
    ],
    cSeed: [
      "Convince a buyer to take a meeting they've already pushed.",
      "Convince a buyer that timing matters more than they think.",
      "Convince a champion to take this to their boss.",
      "Convince a buyer to consider an option they ruled out.",
      "Convince a buyer to revisit a deal they ghosted on.",
      "Convince a stakeholder who didn't ask for the meeting.",
      "Convince a buyer to share what's actually holding them up.",
      "Convince a buyer the value justifies the price.",
      "Convince a buyer to invest now instead of next year.",
      "Convince a buyer that switching from their current tool is worth it.",
    ],
  },
  storytelling: {
    bSeed: [
      "What's a customer story you tell when nothing else is working?",
      "What's the moment in a deal you've never forgotten?",
      "What's a story you tell new reps about losing a deal?",
      "What's a story about a buyer who became a believer?",
      "Why do most case studies fail as stories?",
      "What's the truest thing about using stories on sales calls?",
      "What's a story about a deal that closed because of one moment?",
      "What's a customer story that's earned its keep?",
      "What's a story about a deal you saved at the last minute?",
      "What's a story about a deal you lost — and what it taught you?",
    ],
    cSeed: [
      "Tell a story about a buyer who almost walked, then didn't.",
      "Tell a story about a deal that closed because of one question.",
      "Tell a story about the first time you saved a deal late.",
      "Tell a story about a customer who saw results faster than expected.",
      "Tell a story about a deal you should've won but didn't.",
      "Tell a story about a champion who changed everything.",
      "Tell a story about a demo that went wrong — and the deal you still got.",
      "Tell a story about a deal where the budget showed up out of nowhere.",
      "Tell a story about a deal where the buyer surprised you.",
      "Tell a story about losing a deal that taught you the most.",
    ],
  },
  asking_questions: {
    bSeed: [
      "What's a question that opens up a quiet buyer?",
      "What's the question every discovery call should answer?",
      "What's a question worth asking before you pitch anything?",
      "What's a question that pulls the real pain out of a buyer?",
      "What's a question you stopped asking and wish you hadn't?",
      "What's the question that surfaces the real decision-maker?",
      "What's the best question you ever asked on a sales call?",
      "What's the truest thing about asking instead of telling on a call?",
      "What's a question that changes the room's energy?",
      "What's the question that gets a one-word buyer to talk?",
    ],
    cSeed: [
      "Ask a quiet buyer the question that opens them up.",
      "Ask a buyer the question that surfaces the real timeline.",
      "Ask a buyer the question that uncovers the real objection.",
      "Ask a champion the question they're avoiding internally.",
      "Ask a buyer the question that exposes the budget reality.",
      "Ask a buyer the question that gets you to next steps.",
      "Ask a buyer the question that earns the second meeting.",
      "Ask the question that gets a guarded buyer to share what's actually wrong.",
      "Ask a buyer the question that flips them from polite to engaged.",
      "Ask a buyer the question that gets you to the real decision criteria.",
    ],
  },
  explaining: {
    bSeed: [
      "What do reps over-explain on demos?",
      "Why does jargon kill more deals than it helps?",
      "When does a good explanation make a buyer trust you less?",
      "What's the simplest way to know a buyer actually got it?",
      "Why do reps explain features when buyers want outcomes?",
      "What's the truest thing about explaining technical things to non-technical buyers?",
      "Why do buyers tune out the second a rep starts explaining?",
      "What's the difference between explaining and pitching?",
      "When is the right time to stop explaining and start asking?",
      "What makes an explanation actually land with a skeptical buyer?",
    ],
    cSeed: [
      "Explain what your product does to a buyer who's already lost.",
      "Explain pricing to a buyer who's only half listening.",
      "Explain a technical capability to a non-technical buyer.",
      "Explain why your roadmap matters to a buyer who's frustrated.",
      "Explain integration to a buyer who's worried about effort.",
      "Explain why you're more expensive than the alternative.",
      "Explain the implementation timeline without scaring the buyer.",
      "Explain why a feature they want isn't on the roadmap yet.",
      "Explain how your tool fits — to a buyer who's already invested in others.",
      "Explain a renewal price change without losing trust.",
    ],
  },
};

// Mechanic frames — short prefixes that pull the exercise mechanic.
// Some exercises don't need a prefix (open prompts).
const MECHANIC_FRAMES = {
  "Bottom Line First": { b: "Bottom line first: ", c: "Lead with the bottom line: " },
  "Compare and Contrast": { b: "Compare and contrast: ", c: "Compare two versions: " },
  "Monroe's Motivated Sequence": { b: "Attention, need, satisfy, visualize, act — ", c: "Walk it through attention → action: " },
  "Question Then Answer": { b: "Pose it, then answer: ", c: "Ask, then answer: " },
  "Signpost First": { b: "Signpost first: ", c: "Tell them the shape first: " },
  "The 3 Point Rule": { b: "Three reasons: ", c: "Three reasons, not four: " },
  "The Problem Solution Frame": { b: "Name the problem, name the fix: ", c: "Problem and fix: " },
  "The Story Arc": { b: "Beginning, middle, end: ", c: "Tell it with an arc: " },
  "Two Then One": { b: "Two short, then one long: ", c: "Two short, one long: " },
  "Disconfirm Yourself": { b: "What would change your mind: ", c: "Try to prove yourself wrong: " },
  "Draw the Line": { b: "Draw the line: ", c: "Name your line: " },
  "First Principles": { b: "From first principles: ", c: "Strip it to first principles: " },
  "Name the Assumption": { b: "Name the assumption: ", c: "What's the assumption underneath: " },
  "Order of Magnitude": { b: "Order of magnitude: ", c: "Is it 1×, 10×, or 100×: " },
  "The Claim and Proof": { b: "Claim plus one proof: ", c: "Make the claim, give the proof: " },
  "The Perspective Shift": { b: "From their seat: ", c: "Shift to their perspective: " },
  "The So What Test": { b: "Make the point, then so what: ", c: "Pass the so-what test: " },
  "The Steel Man": { b: "Argue the strongest version: ", c: "Steel-man it: " },
  "Authority Voice": { b: "With weight: ", c: "Speak with authority: " },
  "Conviction Floor": { b: "Hold the line: ", c: "What's the line you won't walk back: " },
  "Curiosity Lift": { b: "From real curiosity: ", c: "With curiosity in front: " },
  "Downward Landing": { b: "Land it down: ", c: "End down, not up: " },
  "Pivot Tone": { b: "Pivot your tone mid-answer: ", c: "Shift tone halfway through: " },
  "Read the Room": { b: "Read the room first: ", c: "Read the room: " },
  "The Monotone Breaker": { b: "Break the monotone: ", c: "Find the energy: " },
  "Volume Dial": { b: "Drop your volume: ", c: "Soften the volume: " },
  "Warmth Switch": { b: "Start firm, end warm: ", c: "Switch from challenge to warmth: " },
};

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------
function makePrompt(text, difficulty, tags) {
  let t = text.trim();
  if (t.length > 180) t = t.slice(0, 178).trimEnd() + "…";
  return { text: t, difficulty, tags };
}

function pickFromPool(pool, exIdx, goalIdx) {
  // Diagonalize for variety
  return pool[(exIdx * 7 + goalIdx * 3) % pool.length];
}

function buildAuthored(targetExercises) {
  const newInserts = []; // {exerciseName, prompts:[…]}
  const seen = new Set();
  for (const [exIdx, exName] of targetExercises.entries()) {
    const frames = MECHANIC_FRAMES[exName] || { b: "", c: "" };
    const universalPool = UNIVERSAL_A[exName] || [];
    const list = [];
    for (const [goalIdx, goal] of GOALS.entries()) {
      const flavor = GOAL_FLAVOR[goal];
      const aText =
        universalPool[goalIdx] ||
        universalPool[goalIdx % Math.max(1, universalPool.length)] ||
        `What's true about ${goal.replace(/_/g, " ")} in your work?`;
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
        list.push(makePrompt(tr.text, tr.difficulty, ["sales", goal]));
      }
    }
    newInserts.push({ name: exName, prompts: list });
  }
  return newInserts;
}

// ---------------------------------------------------------------------------
// Load catalog, build, dedupe against existing, append, write.
// ---------------------------------------------------------------------------
const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
const existingText = new Set();
for (const ex of catalog.exercises) {
  for (const p of ex.prompts) existingText.add(p.text.toLowerCase().trim());
}

// Verify all target exercises exist and grab the canonical sorted order.
const sortedExercises = catalog.exercises
  .slice()
  .sort((a, b) => a.dimension.localeCompare(b.dimension) || a.name.localeCompare(b.name))
  .map(e => e.name);
const targetNames = sortedExercises.slice(27); // rows 28-54
if (targetNames.length !== 27) {
  console.error("expected 27 target exercises, got", targetNames.length);
  process.exit(1);
}
for (const n of targetNames) {
  if (!TARGET_EXERCISES.has(n)) {
    console.error("target mismatch:", n);
    process.exit(1);
  }
}

const inserts = buildAuthored(targetNames);
let collisions = 0;
for (const ins of inserts) {
  const catEx = catalog.exercises.find(e => e.name === ins.name);
  if (!catEx) {
    console.error("missing exercise in catalog:", ins.name);
    process.exit(1);
  }
  for (const p of ins.prompts) {
    let key = p.text.toLowerCase().trim();
    if (existingText.has(key)) {
      const goalTag = p.tags.find(t => t !== "sales") || "g";
      const suffix = ` — on ${goalTag.replace(/_/g, " ")}`;
      p.text = (p.text + suffix).slice(0, 180);
      key = p.text.toLowerCase().trim();
      collisions++;
    }
    existingText.add(key);
    catEx.prompts.push(p);
  }
}

// Difficulty stats
const allNew = inserts.flatMap(i => i.prompts);
const counts = { intro: 0, core: 0, stretch: 0 };
for (const p of allNew) counts[p.difficulty]++;
console.log("authored:", allNew.length);
console.log("difficulty:", counts);
console.log("collisions resolved:", collisions);

// Char-length sanity
const tooLong = allNew.filter(p => p.text.length > 180);
console.log("over-180:", tooLong.length);

fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log("wrote", CATALOG_PATH);
