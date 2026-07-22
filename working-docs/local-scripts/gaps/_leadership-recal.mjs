// Wave 4 recalibration for "leadership" vertical.
// Authors 3 canon-aligned prompts per (exercise × goal): A/B/C archetype mix.
// 54 exercises × 10 goals × 3 prompts = 1,620 prompts. APPEND only.
//
// Target user: first-time manager 1-2 yrs, senior IC running 1:1s, team lead,
// small-startup founder pre-traction. NOT C-suite. Conversational tone.
// Banned: mechanic-prefix, specific-scene, exam-question voice, PIP/calibration/
// promo-packet/comp-politics jargon walls.
//
// Calibration anchors:
//   A: "What's the truest thing about feedback that most people get wrong?"
//   B: "Why are most 1:1s a waste of time?"
//   C: "Tell someone who reports to you that their work isn't good enough yet."

import fs from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/MaxVolkov/dev/cognify";
const CATALOG = path.join(ROOT, "scripts/exercise-catalog/v1/vertical/leadership.json");
const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf-8"));

const allTexts = new Set();
for (const ex of catalog.exercises) for (const p of ex.prompts) allTexts.add(p.text.trim().toLowerCase());

const GOALS = [
  "explaining","handling_objections","confidence","thinking_on_the_spot",
  "giving_feedback","negotiation","presenting","persuasion","storytelling","asking_questions"
];

// ---- helpers -----------------------------------------------------------------
function uniquePick(candidates, used) {
  for (const c of candidates) {
    const key = c.trim().toLowerCase();
    if (!used.has(key) && !allTexts.has(key) && c.length <= 180) {
      used.add(key);
      allTexts.add(key);
      return c;
    }
  }
  for (const c of candidates) {
    for (const suffix of [" — say it plain.", " — keep it tight.", " — start there.", " — your take?", " — go."]) {
      const t = (c.replace(/[.?!]$/, "") + suffix).trim();
      const k = t.toLowerCase();
      if (!used.has(k) && !allTexts.has(k) && t.length <= 180) {
        used.add(k); allTexts.add(k); return t;
      }
    }
  }
  throw new Error("Could not find unique prompt from candidates: " + JSON.stringify(candidates));
}

// =============================================================================
// THEME BANKS — universal (A), leadership-lensed (B), light-scenario (C).
// =============================================================================

// A-themes: pure universal craft, no leadership scene at all
const A_themes = {
  explaining: [
    "explaining something complicated to someone who's smart but new to it",
    "the difference between explaining a thing and selling a thing",
    "why most explanations are too long",
    "what makes an explanation actually stick",
    "the moment you realize the other person isn't following",
    "the hardest thing you've ever had to explain",
    "what good explainers do that bad ones don't",
    "explaining your job to your parents",
    "why analogies sometimes do more than examples",
    "the explanation you wish someone had given you earlier",
  ],
  handling_objections: [
    "what to do when someone says 'I just don't buy it'",
    "the difference between a real objection and a stalling one",
    "why pushback usually isn't about what people say it's about",
    "the objection you hear most and how you'd answer it cold",
    "what makes a good answer to a hard question",
    "the time someone challenged you and you handled it well",
    "the time someone challenged you and you didn't",
    "why agreeing too fast can hurt you",
    "the pushback you've never had a great answer for",
    "what calm sounds like when someone's coming at you",
  ],
  confidence: [
    "what confidence actually sounds like out loud",
    "the difference between confident and certain",
    "what people get wrong about looking confident",
    "the moment you started sounding like you knew what you were doing",
    "how you sound when you're faking it",
    "why low-confidence people often have the better answer",
    "the cost of always sounding sure",
    "how you talk to yourself before a hard conversation",
    "what real confidence does that performed confidence doesn't",
    "the most confident person you know — what do they do differently",
  ],
  thinking_on_the_spot: [
    "what to do when someone asks you something you don't know",
    "the difference between thinking out loud and stalling",
    "the time you got asked something hard and froze",
    "how you buy yourself a second without anyone noticing",
    "what your brain does when you don't have an answer",
    "the question you wish you'd answered better",
    "why fast answers usually aren't better answers",
    "the trick to staying steady when blindsided",
    "what good 'I don't know' actually sounds like",
    "the move that keeps you composed under a hard question",
  ],
  giving_feedback: [
    "what makes feedback land vs bounce",
    "the kindest hard thing anyone's ever said to you",
    "why most feedback is useless",
    "the difference between honest and harsh",
    "feedback you should've given but didn't",
    "what good critics get that bad ones don't",
    "the time feedback changed how you worked",
    "what's the truest thing about feedback that most people get wrong",
    "what makes 'good job' actually mean something",
    "why timing matters more than wording, with feedback",
  ],
  negotiation: [
    "what people get wrong about negotiating",
    "the difference between winning and getting what you want",
    "why the first offer matters less than people think",
    "what you do when someone won't move",
    "the time you got a yes you weren't expecting",
    "the move that breaks a deadlock",
    "why walking away is sometimes the strongest play",
    "what silence does in a hard conversation",
    "the difference between asking and demanding",
    "the moment in a negotiation when you know it's over",
  ],
  presenting: [
    "what makes a talk memorable a week later",
    "the difference between presenting and reciting",
    "why most slide decks are too long",
    "what you notice about presenters who are actually good",
    "the moment a talk comes alive",
    "the worst presenting habit you've broken",
    "why eye contact does more than slides",
    "how you'd open a talk you didn't want to give",
    "what makes the first 30 seconds matter so much",
    "what bad presenters do that they can't see",
  ],
  persuasion: [
    "what actually changes someone's mind",
    "the difference between persuading and pressuring",
    "why facts alone rarely move people",
    "what you say when logic isn't working",
    "the time you persuaded someone of something hard",
    "why agreement isn't always belief",
    "how you sell an idea without selling it",
    "the line between influence and manipulation",
    "what makes someone trust you enough to follow",
    "why short answers persuade more than long ones",
  ],
  storytelling: [
    "what makes a story worth retelling",
    "the difference between a story and a list of things that happened",
    "why most work stories are boring",
    "the shortest story you can tell that still has a point",
    "the moment in a story when the listener actually leans in",
    "a story you tell about yourself that you've earned",
    "what kids' stories get right that adult ones forget",
    "why the ending matters more than the setup",
    "the smallest story that's stuck with you longest",
    "what good storytellers do at the start that bad ones skip",
  ],
  asking_questions: [
    "what makes a great question different from a good one",
    "the question you ask when you don't know what to ask",
    "the difference between curious and interrogating",
    "why most questions are statements in disguise",
    "the question that's changed how you think about your work",
    "what you do when someone gives a non-answer",
    "the best question you've been asked at work",
    "why short questions usually beat long ones",
    "the question you ask when nothing's working",
    "what 'good listener' actually looks like in practice",
  ],
};

// B-themes: leadership-lensed universal — anyone managing people meets these
const B_themes = {
  explaining: [
    "why your team keeps asking the same question you thought you'd answered",
    "the gap between what you said and what your team heard",
    "what 'strategy' actually means when your team asks",
    "why repeating yourself isn't a failure of clarity, it's the job",
    "the difference between explaining and announcing",
    "what makes a goal feel real to the person doing the work",
    "why 'context' is the word managers say when they mean 'why'",
    "the part of your job that's hardest to explain to your team",
    "what changes when you stop explaining and start asking",
    "why your team needs the why more than the what",
  ],
  handling_objections: [
    "what your team is really saying when they say 'we don't have time'",
    "the pushback that means 'I disagree' and the one that means 'I'm tired'",
    "why 'this won't work' usually isn't the real objection",
    "the difference between pushback and disengagement",
    "what to do when someone says 'we've tried that before'",
    "why your team's pushback is often about trust, not the plan",
    "what an objection from your best person means vs your weakest",
    "the right way to take pushback in front of the whole team",
    "what to do when someone challenges you in a meeting and they're right",
    "why letting an objection sit longer than it feels comfortable usually helps",
  ],
  confidence: [
    "what changes the day you stop sounding like a senior IC and start sounding like a manager",
    "why first-time managers undersell their own decisions",
    "the difference between sounding senior and being senior",
    "what new managers do that signals they don't believe their own decision",
    "how you sound when you actually own the call",
    "why hedging in front of your team costs more than being wrong",
    "the move that signals you've grown into the role",
    "how you talk about a decision you're not 100% on",
    "what real authority sounds like vs performed authority",
    "the first time you felt like you actually belonged in the room",
  ],
  thinking_on_the_spot: [
    "what you do when your skip-level asks something you don't know",
    "how to buy yourself ten seconds without saying 'great question'",
    "what to say when someone asks for a decision before you've made one",
    "the move when your team asks you something you should know",
    "what good 'let me think on that' actually looks like",
    "why 'I don't know yet' beats a guess almost every time",
    "the trick to staying composed when a teammate puts you on the spot",
    "what to do when an exec asks a question that exposes a gap",
    "how you respond when someone reframes the problem mid-meeting",
    "the way to push back on a question you don't want to answer yet",
  ],
  giving_feedback: [
    "why are most 1:1s a waste of time",
    "the feedback you've been meaning to give for two weeks",
    "what makes a hard piece of feedback land vs sting",
    "the difference between 'kind' feedback and 'easy' feedback",
    "what good upward feedback to your own boss sounds like",
    "why 'I want to give you some feedback' is the wrong opener",
    "the truest thing about feedback most managers get wrong",
    "what your best report is hungry to hear from you",
    "what to do when feedback you gave didn't take",
    "the feedback you'd give yourself if you were managing you",
  ],
  negotiation: [
    "what's actually negotiable when your team asks for a raise",
    "the difference between negotiating with a peer and a report",
    "why managing up is more negotiation than people admit",
    "what to do when your team wants something you can't give them",
    "how you hold a 'no' without losing the relationship",
    "what changes when you negotiate with someone who reports to you",
    "the move that turns a deadlock with a peer team into progress",
    "why managers who never say no end up with teams that don't trust them",
    "what fair really sounds like in a comp conversation",
    "how to push back on your boss without it costing you",
  ],
  presenting: [
    "what makes a team all-hands feel real vs scripted",
    "the difference between presenting to your team and presenting to your boss",
    "why most managers under-prepare for their own team meetings",
    "what good presenters do when half the room is on Slack",
    "the move that gets a quiet team to actually engage",
    "what to do when your update lands flat",
    "why opening a meeting with the headline beats opening with context",
    "what changes when you present to a room you manage vs a room of peers",
    "the worst manager-presenting habit you've broken",
    "what makes a status update sound like leadership vs a recital",
  ],
  persuasion: [
    "what gets your team to actually adopt a change, not just nod at it",
    "the difference between getting buy-in and getting compliance",
    "why repeating the same logic louder rarely persuades",
    "what changes a teammate from skeptical to on-board",
    "why your most persuasive moment is usually one-on-one, not in the room",
    "what your team needs to hear to follow you into something hard",
    "the move that gets a peer team to actually help you",
    "what good managers do when logic isn't moving people",
    "the difference between persuading down, sideways, and up",
    "how you sell a decision you're only 70% sure about",
  ],
  storytelling: [
    "the story you tell new joiners about the team",
    "the story your team tells about how decisions actually get made here",
    "the difference between a story and a status update",
    "what good leaders do with stories that bad ones miss",
    "the engagement story you'd tell at a peer-manager dinner",
    "the moment in your team's history you keep coming back to",
    "what to leave out of a story to keep it sharp",
    "the story you wish you could tell about a tough call",
    "the smallest story that's shaped how your team works",
    "what your team would say is the story of the last six months",
  ],
  asking_questions: [
    "the question you ask in a 1:1 when you sense something's off",
    "what makes a great 1:1 question vs a checkbox one",
    "the question your team's been waiting for someone to ask",
    "what good listeners do that bad managers skip",
    "the question that opens up a quiet teammate",
    "why the second question is usually better than the first",
    "what 'how can I help?' actually means, and what it should mean",
    "the question that gets you a real answer instead of a polished one",
    "what to ask a report who keeps saying 'fine' in 1:1s",
    "the question you ask your own manager when you want the real read",
  ],
};

// C-themes: light scenario — kind-of-situation any team lead hits regularly
const C_themes = {
  explaining: [
    "explain to a teammate why a deadline is moving",
    "explain to your team why a project they care about is paused",
    "explain to a new hire how decisions actually get made here",
    "explain to a peer why your team owns this and theirs doesn't",
    "explain to your boss what your team's been doing all week",
    "explain to a report what 'good' looks like on their next project",
    "explain to your team why you said yes to something hard",
    "explain to a new joiner what the team's bar actually is",
    "explain to a teammate why you keep asking the same question",
    "explain to your team why a goal changed",
  ],
  handling_objections: [
    "respond when a teammate says the plan won't work",
    "respond when your best report says they're burnt out",
    "answer when someone on the team says 'we've tried that'",
    "respond when a peer manager pushes back on your priority",
    "answer when a report says the feedback you gave isn't fair",
    "respond when your team says they don't have enough context",
    "answer when someone says 'this isn't what I signed up for'",
    "respond when your boss disagrees with your call in front of the team",
    "answer when a report says their workload is too much",
    "respond when a teammate says you're micromanaging",
  ],
  confidence: [
    "tell your team you're making a call without knowing for sure it's right",
    "speak up in a room where everyone outranks you",
    "deliver hard news to your team without softening it into nothing",
    "say 'I was wrong' to your team without losing their trust",
    "hold your position when your boss keeps pushing back",
    "open a meeting when nobody's ready and you have to start",
    "ask your boss for a stretch role you're not sure you're ready for",
    "say no to a peer's request without an apology in the sentence",
    "speak first when the room's gone quiet after a hard question",
    "deliver a decision your team won't like, and stand behind it",
  ],
  thinking_on_the_spot: [
    "answer a question in a team meeting you weren't ready for",
    "respond when your boss reframes the problem you came to discuss",
    "handle it when someone asks you for a decision mid-hallway",
    "react when a report asks you a question that exposes a gap",
    "respond when your skip-level asks for an opinion you haven't formed",
    "answer when your team asks 'what's the plan' before you have one",
    "handle it when a teammate puts you on the spot in front of others",
    "respond when an exec asks you something outside your scope",
    "answer when someone asks 'what would you do?' and means it",
    "handle a question that exposes you don't fully understand the work yet",
  ],
  giving_feedback: [
    "tell someone who reports to you that their work isn't good enough yet",
    "tell a teammate they're talking too much in meetings",
    "give feedback to a report who's working hard but missing the point",
    "tell a peer their slide isn't telling the story",
    "tell your boss something they don't want to hear",
    "tell a high-performer something they're getting wrong",
    "give feedback to someone who outranks you",
    "tell a quiet teammate you need more from them in meetings",
    "tell a report you're worried about the trajectory",
    "give feedback that's been sitting in your head for a month",
  ],
  negotiation: [
    "respond when a report asks for a raise you don't have budget for",
    "negotiate the deadline back when your boss pulls it in",
    "push back when a peer team wants your team's time without asking",
    "respond when your boss adds a project without removing one",
    "negotiate scope when stakeholders keep adding to it",
    "ask your boss for more headcount and have it land",
    "push back on a commitment your team can't actually deliver",
    "negotiate a role change for someone on your team",
    "say no to a request from a peer without burning the bridge",
    "respond when your team asks for something you have to escalate",
  ],
  presenting: [
    "open a team meeting when the room hasn't read the pre-read",
    "deliver a roadmap update when the room is half-distracted",
    "present a decision your team will push back on",
    "handle a meeting where two reports disagree with each other",
    "present to your skip-level when you've only had ten minutes to prep",
    "deliver a hard update without losing the room",
    "present a recommendation you only half-believe in",
    "handle it when a slide gets challenged mid-flow",
    "wrap a meeting when you've run out of time but not topics",
    "open an all-hands when the news is mixed",
  ],
  persuasion: [
    "convince a report to take a role they're not sure about",
    "convince your boss to back a call she's lukewarm on",
    "convince a peer team to deprioritize their thing for yours",
    "convince a teammate to lead a project they don't want to lead",
    "convince your team that a change is worth the disruption",
    "convince a skeptical report that the new direction is the right one",
    "convince your boss to give your team more room",
    "convince a peer manager to share resources",
    "convince a quiet teammate to speak up more",
    "convince your team to commit to a goal that feels too ambitious",
  ],
  storytelling: [
    "tell the story of a hire that worked out better than you expected",
    "tell the story of a decision you almost got wrong",
    "tell the story of a teammate who turned a project around",
    "tell the story of the first time you had to fire someone",
    "tell the story of a meeting that went sideways and what you did",
    "tell the story of a goal your team hit when nobody thought they would",
    "tell the story of a manager who shaped how you lead",
    "tell the story of a decision you reversed",
    "tell the story of a 1:1 that changed how you thought about a report",
    "tell the story of a team you built that worked",
  ],
  asking_questions: [
    "ask a report a question that gets at why they're disengaged",
    "ask your boss a question that gets you a real answer instead of a polished one",
    "ask a quiet teammate a question that opens them up",
    "ask a peer manager a question that exposes the real bottleneck",
    "ask your team a question that gets honest feedback on you",
    "ask a report what they actually want from this role",
    "ask a new joiner a question that helps them more than the onboarding doc",
    "ask your skip-level a question that earns the next ten minutes",
    "ask a struggling report a question that opens the conversation",
    "ask a high performer a question they haven't been asked in a while",
  ],
};

// =============================================================================
// MECHANIC SHAPES — keep the consulting builder structure, swap consulting
// flavor for leadership flavor in the B/C variants.
// =============================================================================

const S = {};

// ---- Clarity ----------------------------------------------------------------

S["Answer the Confusion"] = (t, g, arc) => {
  if (arc === "A") return [
    `Where do people usually get confused about ${t}?`,
    `What's the part of ${t} most people misunderstand?`,
    `Name the one thing about ${t} that trips smart people up.`,
    `If you had to clear up one confusion about ${t}, what would it be?`,
    `What's the mistake people make when they think about ${t}?`,
  ];
  if (arc === "B") return [
    `What's the confusion you'd clear up first about ${t}?`,
    `What's the misconception about ${t} you keep correcting on your team?`,
    `Where does your team usually get lost on ${t}? Clear it up.`,
    `What's the part of ${t} that new managers keep getting wrong?`,
    `Name the confusion behind ${t} and answer it in two sentences.`,
  ];
  return [
    `Someone on your team is confused about it — ${t}. Clear it up.`,
    `Clear up the confusion: ${t}.`,
    `${t} — and the listener still doesn't get it. Try again.`,
    `Try to ${t} when the person across from you is half-lost.`,
    `${t} — clear up the confusion in one pass.`,
  ];
};

S["Explain Like I'm 12"] = (t, g, arc) => {
  if (arc === "A") return [
    `Explain ${t} the way you'd explain it to a 12-year-old.`,
    `Take ${t} and strip it down for a smart kid.`,
    `If a 12-year-old asked you about ${t}, what would you say?`,
    `Explain ${t} without sounding like you read a book about it.`,
    `${t} — say it the way you'd say it to a kid.`,
  ];
  if (arc === "B") return [
    `Explain ${t} the way you'd explain it to a new hire on day one.`,
    `${t} — explain it to a smart 12-year-old, no jargon allowed.`,
    `Take ${t} and explain it without using a single management buzzword.`,
    `If you couldn't use any manager-speak, how would you explain ${t}?`,
    `Explain ${t} so a teammate's partner could follow it.`,
  ];
  return [
    `${t} — strip out the jargon as you go.`,
    `${t} — and the listener is a 12-year-old.`,
    `${t}, no manager-speak allowed.`,
    `${t} like the person across from you has never been in a 1:1.`,
    `${t} for a listener who's smart but new to all of this.`,
  ];
};

S["Headline First"] = (t, g, arc) => {
  if (arc === "A") return [
    `Lead with your bottom line on this: ${t}.`,
    `Yes or no, in your first sentence — and then explain. ${t}.`,
    `${t} — what's your headline?`,
    `Start with the answer to this, then back into it: ${t}.`,
    `${t} — top line first, then your reasoning.`,
  ];
  if (arc === "B") return [
    `${t} — what's the one-line headline?`,
    `${t} — say the answer in the first 7 words.`,
    `Lead with the answer, then earn it: ${t}.`,
    `${t} — what's the one line you'd send your boss?`,
    `${t} — give the punchline before the reasoning.`,
  ];
  return [
    `${t} — and lead with your bottom line.`,
    `${t}, headline first.`,
    `${t} — your first sentence has to be the answer.`,
    `${t} — open with the conclusion, then back it up.`,
    `${t} — top line in the first breath.`,
  ];
};

S["Make It Real"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — make it concrete. Give an example.`,
    `${t} — and use a real example, not a hypothetical.`,
    `Make ${t} tangible. Something you can point at.`,
    `${t} — name a specific case, not a category.`,
    `${t} — pick one real example and build from it.`,
  ];
  if (arc === "B") return [
    `Take ${t} from abstract to concrete in one example.`,
    `${t} — ground it in something your team could touch.`,
    `${t} — what's the example you'd use in a 1:1?`,
    `${t} — bring it down to a number, a person, or a moment.`,
    `${t} — pick one real moment that makes the point.`,
  ];
  return [
    `${t} — use one concrete example to anchor it.`,
    `${t} — make it real with one specific case.`,
    `${t} — name the thing, don't describe the category.`,
    `${t} — and keep it grounded in something specific.`,
    `${t} — pick the most concrete version you can.`,
  ];
};

S["No Jargon Allowed"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — no jargon. Plain English only.`,
    `${t} — and you can't use any insider words.`,
    `${t} — strip the jargon as you go.`,
    `${t} — say it the way you'd say it at a dinner party.`,
    `${t} — no shorthand, no acronyms.`,
  ];
  if (arc === "B") return [
    `${t} — and you can't say 'leverage,' 'align,' or 'bandwidth.'`,
    `${t} — no management words allowed.`,
    `${t} — say it without 'cadence,' 'roadmap,' or 'priorities.'`,
    `${t} — strip out every manager-speak noun.`,
    `${t} — no OKRs, no KPIs, no synergies — just the idea.`,
  ];
  return [
    `${t} — in plain words a teammate's partner would follow.`,
    `${t} — no jargon, no acronyms, no shorthand.`,
    `${t} — say it the way you'd say it to your sibling.`,
    `${t} — and lose every word that needs translation.`,
    `${t} — no manager vocab. Just the idea.`,
  ];
};

S["One Point Only"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — make exactly one point and stop.`,
    `${t} — one point only. Resist the second one.`,
    `${t} — pick the strongest point and stay there.`,
    `${t} — single thread, no branching.`,
    `${t} — one idea, fully developed.`,
  ];
  if (arc === "B") return [
    `${t} — pick one point and hold it.`,
    `${t} — one point only, no 'and another thing.'`,
    `${t} — the single most important thing, nothing else.`,
    `${t} — strip it to the one point that matters.`,
    `${t} — one beat, one idea, then stop.`,
  ];
  return [
    `${t} — and make only one point.`,
    `${t} — one point. Resist the urge to add more.`,
    `${t} — single point, fully landed.`,
    `${t} — one point, then close.`,
    `${t} — one thread only.`,
  ];
};

S["Prove It"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and back every claim with evidence.`,
    `${t} — prove it. Give the reason behind each statement.`,
    `${t} — no claim without proof.`,
    `${t} — make a claim, then ground it.`,
    `${t} — every assertion needs a 'because.'`,
  ];
  if (arc === "B") return [
    `${t} — and prove each point as you go.`,
    `${t} — show the working, not just the answer.`,
    `${t} — make the claim, then earn it.`,
    `${t} — every point gets a piece of evidence.`,
    `${t} — and ground each claim in something specific.`,
  ];
  return [
    `${t} — and prove each claim.`,
    `${t} — every claim with a 'because.'`,
    `${t} — claim, then proof, every time.`,
    `${t} — and back what you say with what you've seen.`,
    `${t} — no unsupported assertions.`,
  ];
};

S["The Analogy Bridge"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and reach for an analogy.`,
    `${t} — use an analogy from outside work to make it land.`,
    `${t} — bridge to something familiar.`,
    `${t} — what's this most like?`,
    `${t} — pick an analogy and run with it.`,
  ];
  if (arc === "B") return [
    `${t} — and lean on an analogy your team already knows.`,
    `${t} — bridge it to something outside the office.`,
    `${t} — borrow an analogy from sports, cooking, or driving.`,
    `${t} — find the everyday version of the idea.`,
    `${t} — translate it into something a non-manager would picture.`,
  ];
  return [
    `${t} — and use an analogy to make the point.`,
    `${t} — bridge the idea with one comparison.`,
    `${t} — find an analogy that lands in one breath.`,
    `${t} — borrow from outside work for the analogy.`,
    `${t} — pick one analogy, then ride it.`,
  ];
};

S["The Word Budget"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — in 40 words or fewer.`,
    `${t} — you've got 30 seconds of words. Use them well.`,
    `${t} — tight budget. Every word earns its place.`,
    `${t} — short answer only.`,
    `${t} — no padding. Just the idea.`,
  ];
  if (arc === "B") return [
    `${t} — in fewer words than feels comfortable.`,
    `${t} — and you've used your budget after 40 words.`,
    `${t} — keep it under what a busy teammate would tolerate.`,
    `${t} — and trim until it almost feels rude.`,
    `${t} — short. Then shorter.`,
  ];
  return [
    `${t} — and keep it under 40 words.`,
    `${t} — tight budget; no filler.`,
    `${t} — strip it to the essentials.`,
    `${t} — and use half the words you want to use.`,
    `${t} — no warm-up, no wind-down.`,
  ];
};

// ---- Conciseness ------------------------------------------------------------

S["Cut by Half"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — answer fully, then cut your answer in half.`,
    `${t} — say it long, then say it again, half the length.`,
    `${t} — ramble first, then trim 50%.`,
    `${t} — go wide, then cut it down to the core.`,
    `${t} — answer naturally, then halve it.`,
  ];
  if (arc === "B") return [
    `${t} — give the full version, then the tight version.`,
    `${t} — and after you finish, deliver the half-length cut.`,
    `${t} — first the long answer, then the one you'd give in the hallway.`,
    `${t} — sprawl first, then prune.`,
    `${t} — long take, then the cut-by-half take.`,
  ];
  return [
    `${t} — then cut your answer in half.`,
    `${t} — full version, then half-length version.`,
    `${t} — answer, then deliver the trim.`,
    `${t} — and follow it with the 50% version.`,
    `${t} — say it twice: long, then half.`,
  ];
};

S["Kill the Filler"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — no um, no like, no uh.`,
    `${t} — and every filler word costs you.`,
    `${t} — kill the throat-clearing.`,
    `${t} — no filler. Pause instead.`,
    `${t} — clean speech only.`,
  ];
  if (arc === "B") return [
    `${t} — and watch for the manager filler: 'kind of,' 'sort of,' 'I would say.'`,
    `${t} — no hedges, no fillers, no 'so basically.'`,
    `${t} — and lose the 'you know' and the 'right?'`,
    `${t} — every filler is a tax on how your team hears you.`,
    `${t} — clean it up: no 'um,' no 'right,' no 'just.'`,
  ];
  return [
    `${t} — and kill every filler as you go.`,
    `${t} — no 'um,' 'like,' or 'you know.'`,
    `${t} — clean delivery, no verbal litter.`,
    `${t} — pause where you'd normally say 'um.'`,
    `${t} — strip the filler out.`,
  ];
};

S["No Hedging"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — no hedging. State it.`,
    `${t} — and you're not allowed to soften.`,
    `${t} — direct claims only.`,
    `${t} — no 'I think,' no 'probably,' no 'kind of.'`,
    `${t} — say what you mean, full stop.`,
  ];
  if (arc === "B") return [
    `${t} — and drop the manager hedges.`,
    `${t} — no 'it depends.' Take a position.`,
    `${t} — lose the 'maybe' and 'arguably.'`,
    `${t} — and no 'I would suggest.' Just suggest.`,
    `${t} — direct, unhedged, on the record.`,
  ];
  return [
    `${t} — no hedging.`,
    `${t} — and no softeners.`,
    `${t} — direct. No 'sort of.'`,
    `${t} — stake the claim, don't dance around it.`,
    `${t} — and don't hide behind 'probably.'`,
  ];
};

S["No Throat Clearing"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and start with the point, not the windup.`,
    `${t} — no 'so,' 'okay,' or 'I think the way to look at this is.'`,
    `${t} — no warm-up. First word is the point.`,
    `${t} — skip the throat-clearing. Open on the answer.`,
    `${t} — and cut the intro.`,
  ];
  if (arc === "B") return [
    `${t} — no 'great question,' no 'so to your point.'`,
    `${t} — no preamble. Open with the substance.`,
    `${t} — and no 'I'll start by saying.'`,
    `${t} — lose the manager ramp-up.`,
    `${t} — first sentence is the answer, not the setup.`,
  ];
  return [
    `${t} — and no throat-clearing.`,
    `${t} — no preamble. Land it.`,
    `${t} — open on the point.`,
    `${t} — no warm-up sentence.`,
    `${t} — start with substance, not setup.`,
  ];
};

S["One Idea Per Response"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — one idea only. No bundling.`,
    `${t} — pick the strongest idea and stop.`,
    `${t} — one idea, fully said.`,
    `${t} — and resist adding a second idea.`,
    `${t} — just one. Then close.`,
  ];
  if (arc === "B") return [
    `${t} — and stop after the first complete idea.`,
    `${t} — one idea per answer.`,
    `${t} — no 'and another thing.'`,
    `${t} — single idea. Land it. Stop.`,
    `${t} — one idea — the best one — only.`,
  ];
  return [
    `${t} — one idea, then stop.`,
    `${t} — and only one idea.`,
    `${t} — single idea, no rider.`,
    `${t} — one thought per answer.`,
    `${t} — one, and only one.`,
  ];
};

S["Subject Verb Object"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and use only short subject-verb-object sentences.`,
    `${t} — every sentence has a subject, a verb, an object. Nothing extra.`,
    `${t} — no clauses, no qualifiers. Short sentences only.`,
    `${t} — SVO sentences only. No clauses.`,
    `${t} — simple sentences. One thought each.`,
  ];
  if (arc === "B") return [
    `${t} — and keep every sentence short and direct.`,
    `${t} — short sentences. No 'which,' 'although,' or 'however.'`,
    `${t} — strip every sentence to its bones.`,
    `${t} — no compound sentences.`,
    `${t} — every sentence stands alone.`,
  ];
  return [
    `${t} — short sentences only.`,
    `${t} — and every sentence is subject-verb-object.`,
    `${t} — no clauses, no qualifiers.`,
    `${t} — clean, short sentences.`,
    `${t} — keep every sentence under 10 words.`,
  ];
};

S["The 30 Second Rule"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and you have 30 seconds. Stop at 30.`,
    `${t} — 30 seconds, no more.`,
    `${t} — half a minute. Make it count.`,
    `${t} — and the clock runs out at 30.`,
    `${t} — 30-second answer, then silence.`,
  ];
  if (arc === "B") return [
    `${t} — 30 seconds is the whole budget.`,
    `${t} — and you only get 30 seconds.`,
    `${t} — half a minute to land it.`,
    `${t} — 30 seconds — the time you'd get in the hallway.`,
    `${t} — and your boss has 30 seconds for this.`,
  ];
  return [
    `${t} — and you've got 30 seconds.`,
    `${t} — 30-second answer.`,
    `${t} — stop at 30 seconds.`,
    `${t} — 30 seconds. Then close.`,
    `${t} — half a minute on the clock.`,
  ];
};

S["The Hard Stop"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and stop mid-thought when it's enough.`,
    `${t} — practice the hard stop. End where it ends.`,
    `${t} — say the thing, then stop. No tail.`,
    `${t} — land it and stop, even if it feels early.`,
    `${t} — hard stop the moment the point is made.`,
  ];
  if (arc === "B") return [
    `${t} — and stop the second you've made the point.`,
    `${t} — and resist the 'and one more thing.'`,
    `${t} — hard stop. No wind-down.`,
    `${t} — stop before you want to.`,
    `${t} — end on the point. No 'so anyway.'`,
  ];
  return [
    `${t} — and stop the moment you've made the point.`,
    `${t} — hard stop, no trailing.`,
    `${t} — end where the point ends.`,
    `${t} — stop on the period.`,
    `${t} — no tail, no wrap-up.`,
  ];
};

S["The Single Sentence"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — in one sentence.`,
    `${t} — single sentence only.`,
    `${t} — one sentence. No semicolons.`,
    `${t} — say the whole thing in one breath.`,
    `${t} — one sentence, end of answer.`,
  ];
  if (arc === "B") return [
    `${t} — in the single sentence you'd put in a Slack DM to your boss.`,
    `${t} — one sentence — the headline version.`,
    `${t} — single sentence, no clauses.`,
    `${t} — and compress it to one line.`,
    `${t} — one sentence, no 'and then.'`,
  ];
  return [
    `${t} — and answer in a single sentence.`,
    `${t} — one sentence only.`,
    `${t} — keep it to one sentence.`,
    `${t} — one sentence, full stop.`,
    `${t} — single line, no more.`,
  ];
};

// ---- Pacing -----------------------------------------------------------------

S["Beat the Buzzer"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — 20 seconds on the clock. Go.`,
    `${t} — buzzer at 20. Land it before then.`,
    `${t} — short clock. Don't go over.`,
    `${t} — 20 seconds, then it's over.`,
    `${t} — beat the buzzer.`,
  ];
  if (arc === "B") return [
    `${t} — and your boss's next meeting starts in 20 seconds.`,
    `${t} — 20 seconds — elevator ride length.`,
    `${t} — and the 1:1 ends in 20 seconds.`,
    `${t} — hallway answer. 20 seconds.`,
    `${t} — 20 seconds, that's all the room has for you.`,
  ];
  return [
    `${t} — and finish before the buzzer at 20.`,
    `${t} — 20 seconds, hard limit.`,
    `${t} — clock starts now: 20 seconds.`,
    `${t} — and you've got 20 seconds.`,
    `${t} — 20 seconds. Make it land.`,
  ];
};

S["Metronome"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — steady pace, no accelerating.`,
    `${t} — and hold your tempo from the first word to the last.`,
    `${t} — even pace. No speeding up when nervous.`,
    `${t} — metronome — same beat the whole way.`,
    `${t} — and don't let the pace drift.`,
  ];
  if (arc === "B") return [
    `${t} — keep an even tempo, no rushing the close.`,
    `${t} — and resist the speed-up at the end.`,
    `${t} — steady cadence. No racing.`,
    `${t} — hold a calm tempo, the kind your team feels.`,
    `${t} — same speed start to finish.`,
  ];
  return [
    `${t} — steady tempo throughout.`,
    `${t} — and hold pace the whole way.`,
    `${t} — even rhythm, beginning to end.`,
    `${t} — and don't speed up when you get close to done.`,
    `${t} — metronome pace.`,
  ];
};

S["Punctuation Breathing"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and breathe at every period.`,
    `${t} — full stop, full breath.`,
    `${t} — pause where the punctuation would land.`,
    `${t} — and let the punctuation pace you.`,
    `${t} — breathe at the comma, breathe at the period.`,
  ];
  if (arc === "B") return [
    `${t} — and use punctuation to slow your delivery.`,
    `${t} — breathe at every period. No run-ons.`,
    `${t} — let the punctuation give you room.`,
    `${t} — pause for breath where the period sits.`,
    `${t} — and breathe like the punctuation tells you to.`,
  ];
  return [
    `${t} — and breathe through the punctuation.`,
    `${t} — pause at every period.`,
    `${t} — breath at the comma. Breath at the period.`,
    `${t} — let punctuation pace your breath.`,
    `${t} — and breathe where you'd write a period.`,
  ];
};

S["Silence Over Filler"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and choose silence over 'um.'`,
    `${t} — every filler becomes a pause instead.`,
    `${t} — silence beats 'uh.' Always.`,
    `${t} — pause where you'd fill.`,
    `${t} — let the silence sit.`,
  ];
  if (arc === "B") return [
    `${t} — and trade every filler for a beat of silence.`,
    `${t} — silence is what calm managers use instead of 'um.'`,
    `${t} — pause instead of 'kind of.'`,
    `${t} — and embrace the silence senior leaders use.`,
    `${t} — silence over throat-clearing.`,
  ];
  return [
    `${t} — and let silence do the work of your fillers.`,
    `${t} — pause where you'd say 'um.'`,
    `${t} — choose silence every time you'd choose filler.`,
    `${t} — silence beats every filler word.`,
    `${t} — and don't fear the quiet.`,
  ];
};

S["Slow Cooker"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and slow down. Take your time.`,
    `${t} — half your normal pace.`,
    `${t} — slow it way down.`,
    `${t} — slow cooker speed.`,
    `${t} — and slow the delivery deliberately.`,
  ];
  if (arc === "B") return [
    `${t} — slow it down to the pace a calm manager uses.`,
    `${t} — and let yourself talk slower than feels natural.`,
    `${t} — half-speed. Deliberate.`,
    `${t} — slow the cadence; let weight build.`,
    `${t} — and resist the urge to speed up when the room goes quiet.`,
  ];
  return [
    `${t} — and slow your pace by half.`,
    `${t} — slow delivery. Weighted.`,
    `${t} — at slow-cooker pace.`,
    `${t} — slow your speed deliberately.`,
    `${t} — and stretch the pace.`,
  ];
};

S["Strategic Pause"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and pause before the key point.`,
    `${t} — strategic pause before the punchline.`,
    `${t} — pause where the listener should think.`,
    `${t} — give a beat before the line that matters.`,
    `${t} — and pause before you land the headline.`,
  ];
  if (arc === "B") return [
    `${t} — and pause before the line you most want your team to remember.`,
    `${t} — a strategic pause before the decision.`,
    `${t} — pause where a calm leader would pause.`,
    `${t} — and use a beat to mark the key claim.`,
    `${t} — pause for emphasis before you land it.`,
  ];
  return [
    `${t} — and pause before the key sentence.`,
    `${t} — strategic pause before the most important line.`,
    `${t} — pause before the punchline.`,
    `${t} — and give a beat before the answer.`,
    `${t} — pause where it matters.`,
  ];
};

S["Tempo Shift"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and shift tempo at least once.`,
    `${t} — slow on the key point, faster on the setup.`,
    `${t} — change your pace to mark what matters.`,
    `${t} — and let tempo signal what's important.`,
    `${t} — fast on the context, slow on the conclusion.`,
  ];
  if (arc === "B") return [
    `${t} — and shift tempo when you hit the decision.`,
    `${t} — change pace on the line that matters most.`,
    `${t} — and use a tempo shift to mark the headline.`,
    `${t} — fast through the setup, slow on the call.`,
    `${t} — and break tempo before the key claim.`,
  ];
  return [
    `${t} — and shift tempo to mark the key point.`,
    `${t} — slow down where it counts.`,
    `${t} — change pace once, deliberately.`,
    `${t} — and use a tempo shift to underline the call.`,
    `${t} — break pace on the most important sentence.`,
  ];
};

S["The Stretch"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and stretch your answer one beat longer than feels comfortable.`,
    `${t} — and don't rush to fill the space at the end.`,
    `${t} — stretch the last beat. Let it sit.`,
    `${t} — and pause one extra second after you land.`,
    `${t} — stretch the silence at the close.`,
  ];
  if (arc === "B") return [
    `${t} — and let the close stretch a beat longer than you want.`,
    `${t} — stretch the pause after the decision.`,
    `${t} — and hold the silence after the headline.`,
    `${t} — stretch the moment after the punchline.`,
    `${t} — and let the room sit with your answer.`,
  ];
  return [
    `${t} — and stretch the final beat.`,
    `${t} — let the close hang.`,
    `${t} — stretch the silence at the end.`,
    `${t} — and don't fill the space after you land.`,
    `${t} — pause one extra beat at the close.`,
  ];
};

S["Two-Beat Landing"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and land it with a two-beat pause at the end.`,
    `${t} — two-beat landing. Don't rush off the line.`,
    `${t} — finish, then count to two.`,
    `${t} — and let the close breathe for two beats.`,
    `${t} — land it. Pause two. Then stop.`,
  ];
  if (arc === "B") return [
    `${t} — and end with the two-beat pause calm leaders use.`,
    `${t} — two-beat landing after the call.`,
    `${t} — and finish with a beat of silence — then a second.`,
    `${t} — land the headline, then pause two.`,
    `${t} — two beats after the close. No exceptions.`,
  ];
  return [
    `${t} — and use a two-beat pause to land.`,
    `${t} — two beats of silence after the close.`,
    `${t} — and let it land with two beats of pause.`,
    `${t} — land. Pause. Pause. Stop.`,
    `${t} — and finish with a two-beat hold.`,
  ];
};

// ---- Structure --------------------------------------------------------------

S["Bottom Line First"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — bottom line first.`,
    `${t} — your first sentence is the conclusion.`,
    `${t} — open with the punchline.`,
    `${t} — lead with the bottom line, then the support.`,
    `${t} — top-down only.`,
  ];
  if (arc === "B") return [
    `${t} — and lead with the decision, then the why.`,
    `${t} — top-down. Bottom line in the first sentence.`,
    `${t} — and open the way a calm leader would open.`,
    `${t} — punchline first, story second.`,
    `${t} — bottom line, then the case for it.`,
  ];
  return [
    `${t} — and open with the bottom line.`,
    `${t} — bottom line first, support second.`,
    `${t} — open with your conclusion.`,
    `${t} — and lead with the answer.`,
    `${t} — top-down structure.`,
  ];
};

S["Compare and Contrast"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and structure it as a compare-and-contrast.`,
    `${t} — pick two things and compare them.`,
    `${t} — and frame it as 'this not that.'`,
    `${t} — use a contrast to make the point.`,
    `${t} — and lean on what it isn't to say what it is.`,
  ];
  if (arc === "B") return [
    `${t} — and use a 'before vs after' frame.`,
    `${t} — contrast the two options the team is weighing.`,
    `${t} — and frame as 'this not that.'`,
    `${t} — pick a clean comparison and run it.`,
    `${t} — compare two paths and show which wins.`,
  ];
  return [
    `${t} — and structure as compare-and-contrast.`,
    `${t} — use a contrast to land the point.`,
    `${t} — 'this not that' framing.`,
    `${t} — and lean on a comparison.`,
    `${t} — frame the answer with a clean contrast.`,
  ];
};

S["Monroe's Motivated Sequence"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and structure it: attention, need, solution, payoff, ask.`,
    `${t} — hook them, name the need, solve it, paint the payoff, make the ask.`,
    `${t} — open with the hook, close with the ask.`,
    `${t} — and walk through hook → need → fix → upside → call.`,
    `${t} — hook, gap, fix, payoff, ask. In order.`,
  ];
  if (arc === "B") return [
    `${t} — and walk hook → need → solution → payoff → ask.`,
    `${t} — structure: grab attention, show the gap, solve it, paint the win, name the ask.`,
    `${t} — Monroe-shape it: hook, problem, fix, future, ask.`,
    `${t} — and end with the specific ask of your team.`,
    `${t} — five beats: attention, need, satisfaction, visualization, action.`,
  ];
  return [
    `${t} — and end with a clear ask.`,
    `${t} — hook, gap, fix, payoff, ask.`,
    `${t} — and run the five-beat motivated structure.`,
    `${t} — open with the hook, close with the call.`,
    `${t} — attention → need → solution → vision → action.`,
  ];
};

S["Question Then Answer"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and frame it as a question then your answer.`,
    `${t} — ask the question you're about to answer, then answer it.`,
    `${t} — pose the question first, then resolve it.`,
    `${t} — and open with the question, close with the answer.`,
    `${t} — question, then answer. Clean structure.`,
  ];
  if (arc === "B") return [
    `${t} — and open with the question your team is really asking.`,
    `${t} — pose the question on the table, then resolve it.`,
    `${t} — and frame it as 'the real question is X. Here's the answer.'`,
    `${t} — name the question, then take the position.`,
    `${t} — and resolve the question you opened with.`,
  ];
  return [
    `${t} — and use a question-then-answer structure.`,
    `${t} — ask the question, then answer it.`,
    `${t} — pose, then resolve.`,
    `${t} — question first, answer second.`,
    `${t} — and let the question set up the answer.`,
  ];
};

S["Signpost First"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and signpost where you're going first.`,
    `${t} — open by telling them what you're about to say.`,
    `${t} — signpost the structure, then deliver it.`,
    `${t} — and frame the path before you walk it.`,
    `${t} — name what's coming, then say it.`,
  ];
  if (arc === "B") return [
    `${t} — and start with 'here are the three things' before the three things.`,
    `${t} — signpost the route, then walk it.`,
    `${t} — and tell your team what's coming.`,
    `${t} — open with the roadmap.`,
    `${t} — signpost first; surprise nobody.`,
  ];
  return [
    `${t} — and signpost the structure up front.`,
    `${t} — name the path, then walk it.`,
    `${t} — open with what's coming, then deliver.`,
    `${t} — and tell them the shape of your answer first.`,
    `${t} — signpost, then say it.`,
  ];
};

S["The 3 Point Rule"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and structure it in three points.`,
    `${t} — exactly three. No more, no fewer.`,
    `${t} — three reasons, three steps, or three takeaways.`,
    `${t} — three points. Land each one.`,
    `${t} — and make it three.`,
  ];
  if (arc === "B") return [
    `${t} — and force yourself to three points.`,
    `${t} — three is the number your team will remember. Use it.`,
    `${t} — and make three points, no more.`,
    `${t} — three clean points.`,
    `${t} — three. The first the strongest.`,
  ];
  return [
    `${t} — and structure in three points.`,
    `${t} — three points, no more.`,
    `${t} — three beats: clean, clean, clean.`,
    `${t} — and use three points.`,
    `${t} — three, in order of importance.`,
  ];
};

S["The Problem Solution Frame"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and use a problem-then-solution frame.`,
    `${t} — name the problem, then propose the solution.`,
    `${t} — problem first, solution second.`,
    `${t} — and frame as 'here's the issue; here's what we do.'`,
    `${t} — pose the problem, then resolve it.`,
  ];
  if (arc === "B") return [
    `${t} — and walk problem → solution, no detours.`,
    `${t} — frame the gap, then the fix.`,
    `${t} — and use the problem-solution shape on every claim.`,
    `${t} — name the pain, then the answer.`,
    `${t} — problem framed, solution delivered.`,
  ];
  return [
    `${t} — and use problem-then-solution.`,
    `${t} — problem first, fix second.`,
    `${t} — frame the issue, then the answer.`,
    `${t} — and structure it: problem, solution.`,
    `${t} — name the gap, propose the move.`,
  ];
};

S["The Story Arc"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and shape it like a story: setup, turn, payoff.`,
    `${t} — beginning, middle, end. No skipping middles.`,
    `${t} — give it an arc, not a list.`,
    `${t} — and use a story shape: situation, complication, resolution.`,
    `${t} — story arc, not bullet list.`,
  ];
  if (arc === "B") return [
    `${t} — and give it the arc: where we were, what happened, what's next.`,
    `${t} — situation, complication, resolution.`,
    `${t} — and frame it like a story your team would retell.`,
    `${t} — setup, turn, payoff.`,
    `${t} — and shape the answer as an arc.`,
  ];
  return [
    `${t} — and shape it as a story arc.`,
    `${t} — setup, turn, payoff.`,
    `${t} — give it a beginning, middle, end.`,
    `${t} — and frame it as a story.`,
    `${t} — arc the answer.`,
  ];
};

S["Two Then One"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — two supports, then the headline. In that order.`,
    `${t} — and structure: two reasons first, then the conclusion.`,
    `${t} — two before one. Make the case, then close it.`,
    `${t} — and build with two beats, land with one.`,
    `${t} — two supports, then the punchline.`,
  ];
  if (arc === "B") return [
    `${t} — give two reasons first, then the call.`,
    `${t} — two supports, then the decision.`,
    `${t} — and stack two reasons before the headline.`,
    `${t} — two-then-one shape.`,
    `${t} — two reasons, then the close.`,
  ];
  return [
    `${t} — two supports, then the headline.`,
    `${t} — and use two-then-one structure.`,
    `${t} — two reasons, then the answer.`,
    `${t} — two beats up, one beat to close.`,
    `${t} — two then one.`,
  ];
};

// ---- Thinking Quality -------------------------------------------------------

S["Disconfirm Yourself"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and name what would make you wrong.`,
    `${t} — what would change your mind?`,
    `${t} — disconfirm yourself. What's the evidence against you?`,
    `${t} — and tell me what you'd need to see to walk it back.`,
    `${t} — what would make you abandon this position?`,
  ];
  if (arc === "B") return [
    `${t} — and call out what would make this call wrong.`,
    `${t} — name the signal that would change your view.`,
    `${t} — and disconfirm yourself before your team does.`,
    `${t} — what would your sharpest report need to see to talk you out of it?`,
    `${t} — and name the conditions under which you'd reverse.`,
  ];
  return [
    `${t} — and say what would make you wrong.`,
    `${t} — disconfirm yourself as you go.`,
    `${t} — name what would change your mind.`,
    `${t} — and stress-test your own position.`,
    `${t} — what evidence would flip it?`,
  ];
};

S["Draw the Line"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and draw the line between what's true and what's just true-sounding.`,
    `${t} — where does the claim hold and where does it break?`,
    `${t} — draw a clear line: in vs out.`,
    `${t} — and name the boundary of your claim.`,
    `${t} — where's the line between right and overreach?`,
  ];
  if (arc === "B") return [
    `${t} — and draw the line on where the call applies and where it doesn't.`,
    `${t} — name the boundary your team keeps crossing.`,
    `${t} — draw the line between what you saw and what you're inferring.`,
    `${t} — and mark where the claim stops being safe.`,
    `${t} — line between true here, untrue elsewhere.`,
  ];
  return [
    `${t} — and draw the line clearly.`,
    `${t} — say what's in and what's out.`,
    `${t} — mark the edge of the claim.`,
    `${t} — and name the boundary.`,
    `${t} — draw a clean line.`,
  ];
};

S["First Principles"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and reason from first principles, not pattern matching.`,
    `${t} — what's true regardless of how others have done it?`,
    `${t} — first principles only. No 'best practice.'`,
    `${t} — and start from what must be true.`,
    `${t} — strip it to first principles.`,
  ];
  if (arc === "B") return [
    `${t} — and reason from the ground up, not from the playbook.`,
    `${t} — and ignore best practice. Build from the floor.`,
    `${t} — what's structurally true here, regardless of how every other team does it?`,
    `${t} — and rebuild the logic from first principles.`,
    `${t} — and don't lean on the standard answer. Reason it out.`,
  ];
  return [
    `${t} — and work from first principles.`,
    `${t} — first principles only.`,
    `${t} — strip to fundamentals.`,
    `${t} — and reason from the ground.`,
    `${t} — first principles, not pattern-matching.`,
  ];
};

S["Name the Assumption"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and name the assumption you're making.`,
    `${t} — what are you taking for granted?`,
    `${t} — call out the load-bearing assumption.`,
    `${t} — and surface the assumption underneath the claim.`,
    `${t} — name what has to be true for this to be true.`,
  ];
  if (arc === "B") return [
    `${t} — and name the assumption your team is bringing.`,
    `${t} — what's the assumption the plan rests on?`,
    `${t} — surface the assumption you're least sure about.`,
    `${t} — and name the unspoken assumption in the room.`,
    `${t} — call out the assumption hidden in the brief.`,
  ];
  return [
    `${t} — and name the assumption out loud.`,
    `${t} — surface the assumption.`,
    `${t} — and call out what you're taking on faith.`,
    `${t} — name the load-bearing assumption.`,
    `${t} — and make the assumption visible.`,
  ];
};

S["Order of Magnitude"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and give the order-of-magnitude answer, not a precise one.`,
    `${t} — is it a 10, a 100, a 1,000? Don't fake precision.`,
    `${t} — order of magnitude only.`,
    `${t} — and round hard. Give the shape, not the digit.`,
    `${t} — rough order, no false precision.`,
  ];
  if (arc === "B") return [
    `${t} — and use order-of-magnitude framing instead of fake decimal places.`,
    `${t} — order of magnitude. Don't perform precision you don't have.`,
    `${t} — and give the answer in days, weeks, or quarters — not exact dates.`,
    `${t} — rough size only. Don't dress it up.`,
    `${t} — and skip the false decimals.`,
  ];
  return [
    `${t} — and answer at order-of-magnitude precision.`,
    `${t} — rough scale, not specifics.`,
    `${t} — round hard. No fake decimals.`,
    `${t} — and answer in tens or hundreds, not single digits.`,
    `${t} — order of magnitude only.`,
  ];
};

S["The Claim and Proof"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and pair every claim with the proof.`,
    `${t} — claim, then proof. Every time.`,
    `${t} — and back each claim immediately.`,
    `${t} — and never let a claim stand alone.`,
    `${t} — claim → evidence → next claim.`,
  ];
  if (arc === "B") return [
    `${t} — and structure as claim-and-proof on every beat.`,
    `${t} — every claim earns its place. Back it.`,
    `${t} — claim, then the evidence that holds it up.`,
    `${t} — and refuse the unsupported assertion.`,
    `${t} — every claim with proof, in the same breath.`,
  ];
  return [
    `${t} — and use claim-and-proof structure.`,
    `${t} — every claim with its proof.`,
    `${t} — claim, then evidence.`,
    `${t} — and pair the assertion with the support.`,
    `${t} — claim-then-proof, every time.`,
  ];
};

S["The Perspective Shift"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and shift perspective at least once.`,
    `${t} — answer from the other side's view.`,
    `${t} — and reframe from a different vantage.`,
    `${t} — flip the lens halfway through.`,
    `${t} — and try the opposite perspective.`,
  ];
  if (arc === "B") return [
    `${t} — and answer from your report's seat, not yours.`,
    `${t} — shift to your boss's view.`,
    `${t} — and reframe it from the new joiner's perspective.`,
    `${t} — answer from the seat across the table.`,
    `${t} — shift perspective to the person affected most.`,
  ];
  return [
    `${t} — and shift perspective midway.`,
    `${t} — answer from the other side.`,
    `${t} — and flip vantage points.`,
    `${t} — reframe from across the table.`,
    `${t} — shift perspective once.`,
  ];
};

S["The So What Test"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and apply the 'so what' test to every claim.`,
    `${t} — for each point, answer 'so what?'`,
    `${t} — and don't say anything that doesn't pass 'so what.'`,
    `${t} — so what? — and answer it.`,
    `${t} — every claim earns its 'so what.'`,
  ];
  if (arc === "B") return [
    `${t} — and follow every claim with its 'so what.'`,
    `${t} — so what, for each point.`,
    `${t} — strip anything that fails 'so what.'`,
    `${t} — and pass every line through the so-what test.`,
    `${t} — so what — for your team, not for you.`,
  ];
  return [
    `${t} — and answer 'so what?' on every point.`,
    `${t} — so-what test on every claim.`,
    `${t} — every point passes 'so what.'`,
    `${t} — and apply 'so what' to each line.`,
    `${t} — so what? Answer it.`,
  ];
};

S["The Steel Man"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and steel-man the other side first.`,
    `${t} — make the strongest case against your view, then defend yours.`,
    `${t} — steel-man the opposite.`,
    `${t} — and build the strongest version of the counterargument.`,
    `${t} — steel-man first, then answer it.`,
  ];
  if (arc === "B") return [
    `${t} — steel-man your team's pushback before you answer it.`,
    `${t} — and build the strongest version of the objection.`,
    `${t} — steel-man the report who disagrees with you.`,
    `${t} — and argue the other side better than they'd argue it.`,
    `${t} — steel-man the case for doing nothing.`,
  ];
  return [
    `${t} — and steel-man the other side.`,
    `${t} — steel-man first, then respond.`,
    `${t} — and build the opposing case fairly.`,
    `${t} — steel-man before you answer.`,
    `${t} — strongest counterargument first, then your view.`,
  ];
};

// ---- Tone -------------------------------------------------------------------

S["Authority Voice"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and use authority voice. Drop the questioning lilt.`,
    `${t} — voice down at the end. No upspeak.`,
    `${t} — speak like you've decided.`,
    `${t} — and land each sentence with weight.`,
    `${t} — authority voice. Statements, not questions.`,
  ];
  if (arc === "B") return [
    `${t} — and use the voice a calm leader uses when the room is watching.`,
    `${t} — authority voice — no upspeak, no qualifier lilt.`,
    `${t} — and land each line like you mean it.`,
    `${t} — voice carries the decision, not the deck.`,
    `${t} — and speak like the person who owns the call.`,
  ];
  return [
    `${t} — and hold authority in the voice.`,
    `${t} — voice down at the end of each line.`,
    `${t} — no upspeak. Statements only.`,
    `${t} — and use authority voice the whole way.`,
    `${t} — every line lands. No questioning lift.`,
  ];
};

S["Conviction Floor"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and find the conviction floor. Drop any line below it.`,
    `${t} — only say what you'd defend tomorrow.`,
    `${t} — and don't speak what you don't believe.`,
    `${t} — every line clears the conviction floor.`,
    `${t} — and refuse to say anything you're not sure of.`,
  ];
  if (arc === "B") return [
    `${t} — and only say what you'd put your name on.`,
    `${t} — strip any line you wouldn't defend in front of your team.`,
    `${t} — every claim above the conviction floor.`,
    `${t} — and refuse to say the soft middle.`,
    `${t} — and don't bring filler conviction into a real answer.`,
  ];
  return [
    `${t} — and only say what clears your conviction floor.`,
    `${t} — every line, you'd defend.`,
    `${t} — and don't say what you don't fully believe.`,
    `${t} — conviction floor — nothing below it.`,
    `${t} — and refuse the soft middle.`,
  ];
};

S["Curiosity Lift"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and let curiosity lift your tone.`,
    `${t} — sound interested, not bored.`,
    `${t} — and bring curiosity to the answer.`,
    `${t} — talk about it like you actually want to know more.`,
    `${t} — curiosity in the voice. Not theater.`,
  ];
  if (arc === "B") return [
    `${t} — and bring the curiosity that made you want this role in the first place.`,
    `${t} — let real curiosity, not manager polish, lift the answer.`,
    `${t} — and sound like the work actually grabs you.`,
    `${t} — curiosity lift when you talk about your team.`,
    `${t} — and bring back the interest that hooked you when you were new.`,
  ];
  return [
    `${t} — and let curiosity lift your tone.`,
    `${t} — sound genuinely interested.`,
    `${t} — curiosity in the voice.`,
    `${t} — and bring real interest, not polish.`,
    `${t} — let the curiosity show.`,
  ];
};

S["Downward Landing"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and land each sentence downward. No upspeak.`,
    `${t} — voice down at every period.`,
    `${t} — and land. Don't lift.`,
    `${t} — downward landing on every line.`,
    `${t} — and bring the pitch down on the close.`,
  ];
  if (arc === "B") return [
    `${t} — and land downward on every key claim.`,
    `${t} — no upward lilt at the end of a decision.`,
    `${t} — and let the voice come down on the close.`,
    `${t} — downward landings, the way calm leaders land them.`,
    `${t} — and finish low, not high.`,
  ];
  return [
    `${t} — and end each sentence downward.`,
    `${t} — voice down at the end.`,
    `${t} — no upspeak. Land downward.`,
    `${t} — and let the pitch fall on the close.`,
    `${t} — downward landings only.`,
  ];
};

S["Pivot Tone"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and pivot tone halfway through.`,
    `${t} — shift from intellectual to warm, or warm to firm, once.`,
    `${t} — and change your tone deliberately mid-answer.`,
    `${t} — pivot tone where the content shifts.`,
    `${t} — and let tone change as the message changes.`,
  ];
  if (arc === "B") return [
    `${t} — and pivot tone when you move from context to the call.`,
    `${t} — shift tone deliberately mid-answer.`,
    `${t} — and pivot tone at the hinge.`,
    `${t} — tone changes when the message changes.`,
    `${t} — and let your tone signal what's coming.`,
  ];
  return [
    `${t} — and pivot tone once, deliberately.`,
    `${t} — shift tone at the turn.`,
    `${t} — and let tone change with the content.`,
    `${t} — pivot tone where you pivot meaning.`,
    `${t} — and use a tone pivot to mark the turn.`,
  ];
};

S["Read the Room"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and read the room as you go.`,
    `${t} — adjust mid-answer based on what you sense.`,
    `${t} — and read the room before pressing on.`,
    `${t} — match the energy before you steer it.`,
    `${t} — and pause to check the room.`,
  ];
  if (arc === "B") return [
    `${t} — and read the room before you push your case.`,
    `${t} — match the room's energy, then change it.`,
    `${t} — and read the room like you would in a 1:1.`,
    `${t} — adjust based on what your team's giving you.`,
    `${t} — and read the room before the next sentence.`,
  ];
  return [
    `${t} — and read the room first.`,
    `${t} — match before you steer.`,
    `${t} — and adjust to what the room's giving you.`,
    `${t} — read the room, then continue.`,
    `${t} — and let the room shape your next sentence.`,
  ];
};

S["The Monotone Breaker"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and break the monotone at least twice.`,
    `${t} — vary pitch deliberately as you go.`,
    `${t} — and break out of the flat delivery.`,
    `${t} — monotone-breaker on. Use the full range.`,
    `${t} — and don't let your voice flatten.`,
  ];
  if (arc === "B") return [
    `${t} — and break monotone on the key claim.`,
    `${t} — vary pitch where the content matters most.`,
    `${t} — and use range to mark what's important.`,
    `${t} — monotone-breaker on the decision.`,
    `${t} — and let your voice rise where the meaning rises.`,
  ];
  return [
    `${t} — and break monotone deliberately.`,
    `${t} — vary pitch as you go.`,
    `${t} — use the full vocal range.`,
    `${t} — and don't go flat.`,
    `${t} — monotone-breaker the whole way.`,
  ];
};

S["Volume Dial"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and use the volume dial. Quiet to land, louder to move.`,
    `${t} — vary volume deliberately.`,
    `${t} — and drop volume on the most important line.`,
    `${t} — volume dial — use it.`,
    `${t} — and let volume mark the meaning.`,
  ];
  if (arc === "B") return [
    `${t} — and drop volume on the line that matters most.`,
    `${t} — turn the volume down on the call.`,
    `${t} — and bring volume down where calm leaders bring it down.`,
    `${t} — volume dial — quieter on the key beat.`,
    `${t} — and use volume to mark the turn.`,
  ];
  return [
    `${t} — and vary volume deliberately.`,
    `${t} — quiet on the key line, louder on the setup.`,
    `${t} — use the volume dial to mark meaning.`,
    `${t} — and drop volume to land the point.`,
    `${t} — volume dial on, monotone off.`,
  ];
};

S["Warmth Switch"] = (t, g, arc) => {
  if (arc === "A") return [
    `${t} — and warm the tone partway through.`,
    `${t} — start analytical, end human.`,
    `${t} — and switch warmth on at the turn.`,
    `${t} — warm the tone where it should land emotionally.`,
    `${t} — and shift from cold to warm once.`,
  ];
  if (arc === "B") return [
    `${t} — and warm the tone when you reach the human part.`,
    `${t} — switch from manager tone to human tone once.`,
    `${t} — and warm up where your team would.`,
    `${t} — warmth switch on at the call.`,
    `${t} — and pivot warmer when the topic becomes personal.`,
  ];
  return [
    `${t} — and warm the tone at the turn.`,
    `${t} — switch warmth on once.`,
    `${t} — and let the tone soften where it should.`,
    `${t} — warmth switch where the meaning warms.`,
    `${t} — and pivot to warm at the right moment.`,
  ];
};

// =============================================================================
// PROMPT BUILD
// =============================================================================

const difficultyForArchetype = (arc, i) => {
  // ~50/40/10 intro/core/stretch.
  if (arc === "A") return "intro";
  if (arc === "B") return i % 5 === 0 ? "intro" : "core";
  return i % 3 === 0 ? "stretch" : "core";
};

const used = new Set();

let totalAdded = 0;
const counts = { intro: 0, core: 0, stretch: 0 };
const samplesByArc = { A: [], B: [], C: [] };

function buildThree(exerciseName, goal, indexHint) {
  if (!S[exerciseName]) throw new Error(`No shape for ${exerciseName}`);
  const triples = [];
  for (const arc of ["A", "B", "C"]) {
    const themePool = (arc === "A" ? A_themes : arc === "B" ? B_themes : C_themes)[goal];
    if (!themePool || themePool.length === 0) throw new Error(`No themes for ${arc}/${goal}`);
    let chosen = null;
    for (let off = 0; off < themePool.length && !chosen; off++) {
      const theme = themePool[(indexHint + off) % themePool.length];
      const candidates = S[exerciseName](theme, goal, arc);
      try {
        const picked = uniquePick(candidates, used);
        chosen = picked;
      } catch (e) { /* try next theme */ }
    }
    if (!chosen) throw new Error(`Could not generate ${arc}/${goal}/${exerciseName}`);
    triples.push({ archetype: arc, text: chosen });
  }
  return triples;
}

const order = catalog.exercises.map(e => e.name);
let exerciseIdx = 0;
for (const ex of catalog.exercises) {
  exerciseIdx++;
  let goalIdx = 0;
  for (const goal of GOALS) {
    goalIdx++;
    const indexHint = (exerciseIdx * 7 + goalIdx * 3) % 10;
    let triples;
    try { triples = buildThree(ex.name, goal, indexHint); }
    catch (e) {
      console.error(`FAIL ${ex.name} / ${goal}:`, e.message);
      throw e;
    }
    for (let i = 0; i < 3; i++) {
      const { archetype, text } = triples[i];
      const difficulty = difficultyForArchetype(archetype, exerciseIdx + goalIdx);
      counts[difficulty]++;
      const prompt = {
        text,
        difficulty,
        tags: ["leadership", goal],
      };
      ex.prompts.push(prompt);
      totalAdded++;
      if (samplesByArc[archetype].length < 2) samplesByArc[archetype].push(`[${ex.name} / ${goal}] ${text}`);
    }
  }
}

fs.writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + "\n", "utf-8");

console.log(`Added ${totalAdded} prompts.`);
console.log(`Difficulty: intro=${counts.intro}, core=${counts.core}, stretch=${counts.stretch}`);
console.log("Samples A:", samplesByArc.A);
console.log("Samples B:", samplesByArc.B);
console.log("Samples C:", samplesByArc.C);
