// Part B — fresh grading-quality reps authored for the 2026-07-20 holistic
// verification pass. NOT the calibration bank (the pipeline is tuned against
// that). Each rep has an explicit expected profile written BEFORE scoring.
// Axes covered: quality tiers, response types, length, and dimension-
// independence failure modes.
//
// durationMs is chosen to imply a natural ~140 wpm for the transcript length
// unless the rep is deliberately testing pacing (none here send `words`, so
// delivery/tone are graded text-conservative — the audio axis is covered by
// calibrate-audio-tone.mjs with the prosody worker).

export const REPS = [
  // ---------- TIER: off-prompt / junk ----------
  {
    id: "junk-offprompt",
    kind: "junk",
    promptText: "In 30 seconds, explain how you'd prioritize competing deadlines this week.",
    transcript:
      "Uh yeah so I don't really know, um, I had a sandwich earlier and it was pretty good, turkey I think, and then my phone was buzzing. Deadlines, right, yeah those exist. Anyway I like Fridays. Is this thing recording? Okay cool.",
    durationMs: 17000,
    expected: {
      composite: [8, 30],
      weakest: ["thinking_quality", "structure", "clarity"],
      note: "Off-prompt filler, answers nothing. Should score genuinely LOW (not floored ~40). Every dimension weak; thinking_quality and relevance floor.",
    },
  },
  // ---------- TIER: poor / rambling ----------
  {
    id: "poor-rambling-update",
    kind: "poor",
    promptText: "Give a 30-second update on the status of your current project.",
    transcript:
      "So the project, um, it's going, you know, there's a lot of moving parts and we've been kind of touching base with different people and circling back, and there was a thing with the vendor, I don't remember exactly, but we're on it, and the timeline is sort of what it is, we'll see, and I think if everyone does their part it should be fine probably, there's some risk but also not really, hard to say, we're basically where we need to be I guess, more or less, TBD on a few items.",
    durationMs: 33000,
    expected: {
      composite: [28, 45],
      weakest: ["conciseness", "structure", "thinking_quality"],
      note: "Rambling, hedge-filled, no concrete status/date/blocker. Conciseness + structure + thinking all weak; clarity mediocre (words are simple but content is fog).",
    },
  },
  // ---------- TIER: competent ----------
  {
    id: "competent-project-update",
    kind: "competent",
    promptText: "Give a 30-second update on the status of your current project.",
    transcript:
      "We're on track for the March 15th launch. Two of the three workstreams are done: the data migration finished last week and QA signed off yesterday. The one open item is the payments integration, which is about a week behind because the vendor's sandbox was down. My plan is to have it closed by Friday, and if the vendor slips again I'll cut over to the backup provider so the launch date holds. I'll flag it in tomorrow's standup either way.",
    durationMs: 34000,
    expected: {
      composite: [58, 72],
      weakest: ["tone", "delivery"],
      note: "Concrete, structured, has a plan + contingency. Solid competent-to-strong. Content dims (clarity/structure/thinking/conciseness) high; tone/delivery graded conservative from text so likely the relative floor.",
    },
  },
  // ---------- TIER: strong ----------
  {
    id: "strong-behavioral-interview",
    kind: "strong",
    promptText: "Tell me about a time you disagreed with your manager. (behavioral interview)",
    transcript:
      "Last year my manager wanted to ship our onboarding redesign in one big release. I disagreed because our analytics showed new users dropped off at three distinct steps, and a single release would make it impossible to tell which change actually moved the needle. So I proposed we split it into three sequential experiments. I brought a one-page plan with the hypothesis and success metric for each. She pushed back on the timeline, so we compromised: I sequenced the two highest-risk steps as separate releases and bundled the rest. The first experiment lifted activation eleven percent, and because it was isolated we knew exactly why. The lesson I took was that disagreeing works best when you bring a testable alternative, not just an objection.",
    durationMs: 52000,
    expected: {
      composite: [66, 80],
      weakest: ["tone", "delivery"],
      note: "Clean STAR-ish structure, specific numbers, reflective close. Genuinely strong. Content dims should be high (75-88). This is an UPPER-TIER rep — watch for the known under-rating (may cluster ~70-77).",
    },
  },
  // ---------- TIER: genuinely excellent ----------
  {
    id: "excellent-investor-pitch",
    kind: "excellent",
    promptText: "Give your 90-second investor pitch.",
    transcript:
      "Every year, mid-size manufacturers lose about forty billion dollars to unplanned equipment downtime. The reason is simple: the sensors that could predict a failure already exist on the factory floor, but the data sits in twelve incompatible systems that don't talk to each other. We built Loom. Loom is a single layer that ingests every sensor stream, normalizes it, and flags the specific machine that is about to fail, with the part number and a window. In our first eight pilots, we cut unplanned downtime by thirty-one percent, which for a mid-size plant is roughly two million dollars a year. We charge forty thousand a year per plant, so the customer makes their money back in the first month. There are eleven thousand plants that fit our profile in North America alone. We've signed three of the eight pilots to annual contracts, we're growing revenue nineteen percent month over month, and we're raising four million to build the sales team that turns the other pilots, and the pipeline behind them, into contracts. The wedge is downtime today. The platform is the system of record for the whole factory tomorrow.",
    durationMs: 92000,
    expected: {
      composite: [82, 94],
      weakest: ["tone", "delivery"],
      note: "Textbook pitch: problem sized, mechanism, proof w/ numbers, unit economics, market, ask, vision. This is ELITE content. Expect the KNOWN under-rating — measure how far below 85 it lands.",
    },
  },
  // ---------- RESPONSE TYPE: objection handling ----------
  {
    id: "strong-objection-handling",
    kind: "strong",
    promptText: "A customer says your product is too expensive. Respond.",
    transcript:
      "I hear you, and price is exactly the right thing to press on. Let me reframe what you're actually buying. Today your team spends about ten hours a week reconciling these reports by hand. At your blended rate that's roughly sixty thousand dollars a year, and it's the kind of work that burns out your best analysts. Our license is eighteen thousand. So the question isn't whether eighteen thousand is a lot in the abstract, it's whether you'd trade eighteen to get back sixty and keep your team on higher-value work. If the ten-hour number is wrong for your team, tell me and we'll rerun it together on your real numbers. I'd rather you buy this because the math is right than because I talked you into it.",
    durationMs: 48000,
    expected: {
      composite: [66, 80],
      weakest: ["tone", "delivery"],
      note: "Acknowledges, reframes to value, quantifies, invites verification, low-pressure close. Strong persuasion. Upper-tier content — watch under-rating.",
    },
  },
  // ---------- RESPONSE TYPE: wedding toast / story ----------
  {
    id: "competent-wedding-toast",
    kind: "competent",
    promptText: "Give a short wedding toast for a close friend.",
    transcript:
      "When I met Dan in college, he was the guy who'd drive four hours to help you move a couch and then refuse gas money. That's just who he is. So when he told me about Priya, and I watched him plan an entire weekend around a bakery she mentioned once, I wasn't surprised. That's the same guy. Priya, you married someone who shows up. Dan, you married someone who finally makes you sit still long enough to be taken care of for once. To the two of you: may you keep driving the four hours for each other. Raise your glasses.",
    durationMs: 38000,
    expected: {
      composite: [58, 74],
      weakest: ["thinking_quality"],
      note: "Warm, specific, well-shaped for the genre. Thinking_quality (analytical depth) is the wrong lens for a toast so likely relatively lower; clarity/structure/tone should be high. Tests genre-appropriate grading.",
    },
  },
  // ---------- RESPONSE TYPE: teaching explainer ----------
  {
    id: "strong-teaching-explainer",
    kind: "strong",
    promptText: "Explain how compound interest works to someone who has never heard of it.",
    transcript:
      "Imagine you put a hundred dollars in an account that pays ten percent a year. After the first year you have a hundred and ten. Here's the key part: in the second year you don't earn ten percent on your original hundred, you earn it on the whole hundred and ten, so you get eleven dollars, not ten. Your money starts earning money, and then that money earns money too. It's a snowball. Early on it barely moves and it feels pointless. But because each year builds on a bigger pile, the growth gets faster and faster. That's why the single most important thing about compound interest is time. Starting ten years earlier matters more than starting with twice as much.",
    durationMs: 46000,
    expected: {
      composite: [66, 80],
      weakest: ["tone", "delivery"],
      note: "Concrete example, names the key mechanism, ends with the actionable takeaway. Strong teaching. Upper-tier — watch under-rating.",
    },
  },
  // ---------- RESPONSE TYPE: deliver bad news ----------
  {
    id: "competent-deliver-bad-news",
    kind: "competent",
    promptText: "Tell your team the project they've worked on for six months is being cancelled.",
    transcript:
      "I want to be straight with you because you've earned that. Leadership decided this morning to cancel Atlas. The market shifted and the company is consolidating spend, and Atlas didn't make the cut. This is not a reflection of your work, which was genuinely some of the best I've seen. Here's what happens next: no one on this team is losing their job. Over the next two weeks I'll work with each of you individually to find the right next project, and I'll make sure the skills you built here are visible to the people making those decisions. I know this is a gut punch. Take the afternoon. We'll regroup tomorrow and I'll answer every question I can.",
    durationMs: 47000,
    expected: {
      composite: [62, 78],
      weakest: ["conciseness"],
      note: "Direct, humane, gives next steps, protects the team. Genre-strong. Tone should be relatively HIGH here (empathy handled well) — tests that tone isn't always the floor. Conciseness maybe slightly lower.",
    },
  },
  // ---------- RESPONSE TYPE: persuasive ask ----------
  {
    id: "competent-persuasive-ask",
    kind: "competent",
    promptText: "Ask your manager for a raise.",
    transcript:
      "Thanks for making time. I want to talk about my compensation. Over the last year I took over the billing migration when Sam left, which wasn't in my original scope, and it shipped on time with zero downtime. I also started running the on-call rotation, which cut our average incident response from two hours to forty minutes. I've looked at the market range for the work I'm now doing and I'm sitting near the bottom of it. I'm asking to move to a hundred and thirty, which puts me at the midpoint. I love working here and I'm not shopping around. I'd just like the comp to match the scope. What would it take to get there?",
    durationMs: 44000,
    expected: {
      composite: [62, 77],
      weakest: ["tone", "delivery"],
      note: "Evidence-led, specific number, non-threatening close with an ask. Strong. Upper-mid content.",
    },
  },

  // ---------- INDEPENDENCE: clear-but-shallow ----------
  {
    id: "indep-clear-but-shallow",
    kind: "independence",
    promptText: "What's your view on remote work for our company?",
    transcript:
      "I think remote work is good. It gives people flexibility and flexibility is important. People can work from home, which is convenient. Some people like the office and some people like home. I think we should let people choose. Choice is good. Overall I'm in favor of remote work because it makes people happy and happy people do better work.",
    durationMs: 26000,
    expected: {
      composite: [38, 55],
      dimGoal: "clarity HIGH (>=65), thinking_quality LOW (<=50)",
      weakest: ["thinking_quality"],
      note: "Every sentence is crystal clear but there is zero actual reasoning, evidence, or nuance. TESTS INDEPENDENCE: clarity should stay high while thinking_quality craters. Gap clarity-minus-thinking should be >=15.",
    },
  },
  // ---------- INDEPENDENCE: organized-but-empty ----------
  {
    id: "indep-organized-but-empty",
    kind: "independence",
    promptText: "Walk me through your recommendation on the vendor decision.",
    transcript:
      "I'll structure this in three parts. First, the background. Second, my analysis. And third, my recommendation. So first, the background: there is a decision to make about a vendor. Second, the analysis: there are several factors to weigh and they all matter in different ways. And third, my recommendation: I think we should go with the option that makes the most sense once we've considered everything. So to summarize, in three parts: background, analysis, and recommendation. That's my thinking.",
    durationMs: 33000,
    expected: {
      composite: [33, 52],
      dimGoal: "structure HIGH (>=62), thinking_quality LOW (<=48)",
      weakest: ["thinking_quality", "conciseness"],
      note: "Perfect signposting scaffold with NO content inside it. TESTS INDEPENDENCE: structure should stay decent while thinking_quality craters. structure-minus-thinking gap >=15.",
    },
  },
  // ---------- INDEPENDENCE: deep-but-disorganized ----------
  {
    id: "indep-deep-but-disorganized",
    kind: "independence",
    promptText: "Should we build the feature in-house or buy it?",
    transcript:
      "Okay so buying gets us there in a month but then we're locked into their roadmap and honestly their API rate limits would kill us at scale, well, would they, at ten thousand requests maybe not but at a hundred thousand definitely, and building is six months but wait the real cost isn't the six months it's that we'd own the maintenance forever and we don't have the on-call depth, though we could hire, but hiring takes three months anyway so it's really nine, and the switching cost later if we buy and outgrow it, that's the thing nobody prices in, oh and compliance, their SOC2 covers us which building doesn't, that actually might be the deciding factor now that I say it out loud, the compliance timeline.",
    durationMs: 58000,
    expected: {
      composite: [40, 58],
      dimGoal: "thinking_quality HIGH (>=62), structure LOW (<=50)",
      weakest: ["structure", "conciseness"],
      note: "Genuinely sharp reasoning (rate limits at scale, hidden maintenance cost, compliance as decider) but delivered as a disorganized stream. TESTS INDEPENDENCE: thinking_quality should stay high while structure drops. thinking-minus-structure gap >=12.",
    },
  },
  // ---------- INDEPENDENCE: concise-but-vague ----------
  {
    id: "indep-concise-but-vague",
    kind: "independence",
    promptText: "How did the quarter go for your team?",
    transcript:
      "Strong quarter. We hit our goals, the team executed well, and we're set up nicely for next quarter.",
    durationMs: 8000,
    expected: {
      composite: [30, 50],
      dimGoal: "conciseness HIGH (>=65), thinking_quality LOW (<=52)",
      weakest: ["thinking_quality"],
      note: "Extremely tight but says nothing verifiable — no metric, no specifics. TESTS INDEPENDENCE: conciseness high, thinking/substance low. Also a length edge case (one-liner ~8s).",
    },
  },
  // ---------- INDEPENDENCE: padded-but-clear ----------
  {
    id: "indep-padded-but-clear",
    kind: "independence",
    promptText: "What's the one thing you'd change about our onboarding?",
    transcript:
      "So the one thing, if I had to pick just one single thing, the number one thing that I would personally change about the onboarding experience that we currently offer to our new users when they first arrive, would be, and I've thought about this quite a bit, the very first screen. What I would do, specifically, in terms of the actual change itself, is I would take that first screen and I would make it shorter. That's the change. A shorter first screen. Because right now it is, in my opinion, simply too long.",
    durationMs: 40000,
    expected: {
      composite: [40, 58],
      dimGoal: "clarity decent (>=58), conciseness LOW (<=45)",
      weakest: ["conciseness"],
      note: "One simple clear point buried in massive padding. TESTS INDEPENDENCE: clarity stays okay, conciseness craters. clarity-minus-conciseness gap >=15.",
    },
  },
  // ---------- INDEPENDENCE: jargon-tangled ----------
  {
    id: "indep-jargon-tangled",
    kind: "independence",
    promptText: "Explain what your team shipped this sprint to a non-technical stakeholder.",
    transcript:
      "We refactored the ingestion DAG to decouple the ETL from the downstream materialized views, so now the idempotent upserts hydrate the read replicas without blocking the write path. We also sunset the legacy webhook fan-out in favor of an event-sourced CQRS pattern with an at-least-once delivery guarantee, which lets us backfill the denormalized projections asynchronously. Net-net, we've reduced p99 tail latency on the hot path and the whole thing is now horizontally shardable.",
    durationMs: 39000,
    expected: {
      composite: [30, 50],
      dimGoal: "clarity LOW (<=45) for a non-technical audience; thinking may be okay",
      weakest: ["clarity"],
      note: "Dense correct engineering but the PROMPT asked for a non-technical explanation, so clarity for the stated audience fails. TESTS: clarity should crater on audience mismatch even though the content is competent.",
    },
  },
  // ---------- INDEPENDENCE: too-brief-but-deep ----------
  {
    id: "indep-brief-but-deep",
    kind: "independence",
    promptText: "Why did the A/B test result surprise you?",
    transcript:
      "Because the winning variant had the worse click-through. The lift came entirely from a downstream cohort effect: the slower variant self-selected for higher-intent users, so the metric moved for a reason that won't replicate if we ship it to everyone.",
    durationMs: 15000,
    expected: {
      composite: [55, 72],
      dimGoal: "thinking_quality HIGH (>=65), conciseness HIGH; maybe structure slightly lower",
      weakest: ["delivery", "tone"],
      note: "Very short but genuinely insightful (selection effect / non-replicable lift). TESTS: brevity should NOT floor the score when substance is high; thinking_quality high.",
    },
  },
  // ---------- EDGE CASE: long comma-spliced run-on (>400 char natural quote) ----------
  {
    id: "edge-runon-longquote",
    kind: "edge",
    promptText: "Describe how you handled a difficult customer situation.",
    transcript:
      "So there was this customer, and they were really upset, and they called in and they were yelling about their invoice being wrong, and I tried to calm them down but they kept going, and I said okay let me look at your account, and I pulled it up, and it turned out we had double-charged them for the annual plan because the migration script ran twice, and I felt terrible, and I told them right away that it was our fault, and I refunded the duplicate immediately while they were still on the phone, and then I stayed on to explain what happened, and I gave them a month free for the hassle, and by the end they actually thanked me, and they're still a customer two years later, and honestly it taught me that owning the mistake fast is the whole game, people forgive the error but not the runaround, and I've handled every escalation that way since then, just find it, own it, fix it while they're watching.",
    durationMs: 62000,
    expected: {
      composite: [48, 66],
      weakest: ["structure", "conciseness"],
      note: "EDGE: one giant comma-spliced run-on (~880 chars). PRIMARY TEST: must NOT mock-fallback (the strongerVersion.quote cap bug — verbatim quote could exceed old 400 cap). Confirm modelVersion != mock-fallback-v1 and a real strongerVersion. Content is actually decent (own-it-fast), so mid score; structure/conciseness low.",
    },
  },
];
