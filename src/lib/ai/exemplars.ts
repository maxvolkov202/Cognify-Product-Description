import type { SkillDimension, BandId } from "@/types/domain";
import type { PressureArchetypeId } from "@/lib/ai/pressure-archetypes";

/**
 * Exemplar response bank — concrete model speech samples per dimension
 * and (optionally) pressure archetype. Surfaced via the "See example"
 * link on NextRepFocusCard so the user has a sound model in their ear
 * before the next rep, not just a rule.
 *
 * Authoring rules:
 *   - Lines are SPOKEN. They should sound like a person talking, not
 *     prose. Short. Land each sentence.
 *   - Every exemplar names a concrete scenario in `topic` so the user
 *     reads it as "here's how someone hits this in a real moment", not
 *     a generic abstract.
 *   - `tip` is one sentence on what to listen for — what makes this
 *     example actually train the dimension. Avoid "make sure to…" —
 *     use observable signals ("notice the pause after each beat").
 *   - Pressure exemplars include the mechanism in the lines (objection,
 *     pivot, recovery) so users hear the move, not just the structure.
 *
 * Selection priority (see `pickExemplar`):
 *   1. Exact (dimension, archetypeId) match
 *   2. Exact dimension match (no archetype)
 *   3. null (UI shows fallback "no exemplar yet" copy)
 */

export type Exemplar = {
  dimension: SkillDimension;
  archetypeId?: PressureArchetypeId;
  /** Ch.16c — score band this exemplar exemplifies. Drives the
   *  /skill-lab/[dim]/exemplars page's tab grouping (5 tabs from
   *  below_standard → exceptional, with poor intentionally empty per
   *  the master plan rationale: no value in modeling failure). Optional
   *  for back-compat with the original 13 hand-authored exemplars,
   *  which stay general-purpose and surface in the "general" footer. */
  band?: BandId;
  topic: string;
  /** Spoken lines, one per beat. Render with line breaks; user can scan
   *  vertically and "hear" the rhythm. */
  lines: string[];
  tip: string;
};

/** Curated bank. Each dimension has at least one general exemplar; some
 *  dimensions have archetype-tagged variants for the pressure surface. */
export const EXEMPLARS: readonly Exemplar[] = [
  // ——— Clarity ————————————————————————————————————————————————
  {
    dimension: "clarity",
    topic: "Explain how habits form to a beginner",
    lines: [
      "A habit is a behavior your brain has stopped thinking about.",
      "It started as a choice — every step deliberate.",
      "Repeat it enough, and your brain stops asking why and starts running it on autopilot.",
      "That's why small habits compound: they cost no willpower once they're locked in.",
    ],
    tip: "Notice each sentence does ONE thing — defines, contrasts, generalizes, lands. No padding between them.",
  },
  {
    dimension: "clarity",
    topic: "Explain a security breach to a non-technical CEO",
    lines: [
      "Here's what happened: an attacker got into our staging database for about four hours.",
      "What they accessed: customer email addresses and hashed passwords. No payment data, no plain-text passwords.",
      "What we did: rotated all credentials, forced a global reset, and started a forensic review.",
      "What's next: we tell affected customers tonight, before it leaks elsewhere.",
    ],
    tip: "Notice the four labeled beats — happened, accessed, did, next. The CEO can repeat it back without notes.",
  },

  // ——— Structure ——————————————————————————————————————————————
  {
    dimension: "structure",
    topic: "Argue why trust is the foundation of every relationship",
    lines: [
      "Trust is built on three things, in this order: consistency, honesty, follow-through.",
      "First, consistency. You show up the same way whether it's easy or hard.",
      "Second, honesty about what you don't know — not just what you do.",
      "Third, follow-through. Every kept commitment is a deposit; every broken one is a withdrawal.",
      "Consistency, honesty, follow-through. That's how trust gets built — in that order.",
    ],
    tip: "Listen for the hook restating verbatim at the end. Same words. That's what makes the structure stick.",
  },
  {
    dimension: "structure",
    topic: "Recommend a hire to leadership",
    lines: [
      "I'm recommending we hire Sam, and there are three reasons it's the right call.",
      "First, the technical bar: they cleared our hardest interview in two passes.",
      "Second, the team fit: every panelist independently flagged the same strength — calm under pressure.",
      "Third, the trajectory: they've been promoted twice in three years, both unprompted.",
      "Technical bar, team fit, trajectory. That's the case for Sam.",
    ],
    tip: "Watch how the sign-posts (\"first / second / third\") are followed by ONE sentence each, not three. The constraint is what makes structure feel sharp.",
  },

  // ——— Conciseness ——————————————————————————————————————————————
  {
    dimension: "conciseness",
    archetypeId: "time_compression",
    topic: "CEO asks why the launch is two weeks behind, 15 seconds",
    lines: [
      "Database migration ran 4x slower than benchmarks predicted.",
      "We caught it last Wednesday and rolled to a chunked migration.",
      "New ETA is two weeks out. Demo prep starts Monday.",
    ],
    tip: "No \"so basically,\" no \"the thing is.\" Each sentence is verb-first. Stop when the answer is done — silence is fine.",
  },
  {
    dimension: "conciseness",
    topic: "Pitch your product in 20 seconds",
    lines: [
      "We help mid-market sales teams close deals 30% faster by surfacing the next best action in their CRM.",
      "It plugs into Salesforce in under an hour and pays back in under three weeks on average.",
      "Customers replace two existing tools when they adopt us — that's where the ROI lives.",
    ],
    tip: "Each sentence is doing the work of three: what / how / why. No \"as a sales platform\" — get to the verb.",
  },

  // ——— Thinking Quality ————————————————————————————————————————
  {
    dimension: "thinking_quality",
    topic: "Should you take the promotion or the lateral?",
    lines: [
      "I'd take the lateral — and here's the reasoning, not just the gut.",
      "The promotion gets you a title bump and the same skill stack you already have.",
      "The lateral pulls you into a new domain where the next promotion has more leverage.",
      "Two years from now, the lateral version of you is more interesting to the market.",
      "So: short-term ego, long-term option value. Lateral.",
    ],
    tip: "The frame \"reasoning, not just the gut\" signals the structure. Each sentence is a beat in a real argument.",
  },
  {
    dimension: "thinking_quality",
    archetypeId: "clarifying_interrupt",
    topic: "Mid-pitch interrupt: \"That sounds like every other tool\"",
    lines: [
      "Fair — that's the right thing to push on.",
      "Here's where we're actually different: we're the only one that learns from the user's CRM data, not just generic playbooks.",
      "What that means in practice: in week one we surface deals you didn't know were stuck. Nobody else does that.",
      "Want me to show you with one of your real accounts?",
    ],
    tip: "Listen to the move: acknowledge → reframe → ground in specifics → ask. No defensiveness in the open.",
  },

  // ——— Delivery ————————————————————————————————————————————————
  {
    dimension: "delivery",
    topic: "Share a lesson you learned",
    lines: [
      "[Slow.] A few years ago I thought working harder was the only way to fix things.",
      "And I learned the hard way — [pause] — that working harder was often the thing making it worse. [pause]",
      "[Normal tempo.] I doubled my hours on a project that needed fewer meetings, not more effort.",
      "[Slow again.] Now, when I'm tired and pushing harder — that's the moment I stop. And subtract.",
    ],
    tip: "Read it aloud at a metronome. Notice how the bracketed cues map to actual rhythm changes — that's the dimension being trained.",
  },
  {
    dimension: "delivery",
    archetypeId: "stakes_raise",
    topic: "Board asks why you're the right CEO for what's next, 60 sec",
    lines: [
      "[Slow open.] I've spent five years getting this team to where it can ship without me in every meeting.",
      "What's next is harder. We're not optimizing — we're crossing into a market that's never seen us. [pause]",
      "I know I'm right for this for two reasons.",
      "First, I've done the unsexy work. The boring distribution wins this round, not the big bet. I've earned the trust to make those calls. [pause]",
      "Second, I've changed before. The CEO this team needed in year one isn't the one it needs in year five — and I've made that shift in front of you. [pause]",
      "[Slow close.] You're not betting on a static person. You're betting on a track record of evolving. That's the bet I think you should make.",
    ],
    tip: "Watch the cadence — open slow, accelerate through the case, slow again at the close. Every pause earns the listener's full attention for what comes next.",
  },

  // ——— Tone ————————————————————————————————————————————
  {
    dimension: "tone",
    archetypeId: "audience_switch",
    topic: "Explain AI to a designer, then to a researcher",
    lines: [
      "[To the designer:] AI isn't magic. It's pattern-matching on a huge pile of text. Useful in narrow ways — overhyped for the rest. Treat it like a junior collaborator: fast at drafts, bad at judgment.",
      "[Pivot:] Now to the researcher.",
      "[To the researcher:] The surprise here isn't intelligence — it's that a statistical predictor this big starts looking like reasoning. Whether it actually IS reasoning is the open question, and the empirical work to settle it is just beginning.",
    ],
    tip: "Same idea, two registers. Designer gets the metaphor; researcher gets the open question. Notice the explicit \"pivot\" line — it signals the switch out loud.",
  },
  {
    dimension: "tone",
    archetypeId: "pushback",
    topic: "Make the case for code reviews. Pushback: \"They just slow us down\"",
    lines: [
      "[Acknowledge.] You're right that reviews add latency. That's real, and we should keep an eye on it.",
      "[Redirect.] What I'd add is the latency we're saving on the back end. Every bug we catch in review is a bug that doesn't ship — and the cost of a shipped bug is 10x the time the review took.",
      "[Land.] So we're not slowing down. We're moving the slowdown earlier, where it's cheaper. That's the trade we want.",
    ],
    tip: "Every move named: acknowledge → redirect → land. The user can hear the move BEING made, not described.",
  },
  {
    dimension: "tone",
    topic: "Convince someone to start exercising regularly",
    lines: [
      "Look — I'm not going to sell you on the idea of exercise. You already know it's good.",
      "What I'll sell you on is the smallest version that actually works: 15 minutes, three times a week. That's it.",
      "Two weeks in, you'll feel it. Three months in, you'll wonder how you lived without it.",
      "Don't go for hard. Go for repeatable. The body changes after the fact.",
    ],
    tip: "The opening reframes the resistance — they don't have to argue against \"exercise is good.\" That's adaptive: meeting where they are.",
  },

  // ════════════════════════════════════════════════════════════════════
  // Ch.16c — Per-band exemplars (48 entries: 6 dims × 4 bands × 2 each).
  // Skip poor (0-40) per master plan: "intentionally skip the 0-40 'poor'
  // band exemplars — no value in modeling failure." So the user-visible
  // tabs render below_standard / competent / strong / excellent (with
  // exceptional folded into excellent — same shape, more polish).
  // ════════════════════════════════════════════════════════════════════

  // ─── Clarity ────────────────────────────────────────────────────────
  {
    dimension: "clarity",
    band: "below_standard",
    topic: "Explain why you missed the deadline",
    lines: [
      "So, basically, there were a few things that came up — like, the migration thing, and also the QA stuff.",
      "It kind of all happened at once, and we ended up not getting to the part we were supposed to ship.",
      "I think we can probably get there next week, but it depends on a few things.",
    ],
    tip: "What's missing: the WHAT. \"Things came up\" forces the listener to guess. Below-standard clarity is workable but every sentence asks the listener to fill blanks.",
  },
  {
    dimension: "clarity",
    band: "below_standard",
    topic: "Recommend a vendor to a peer",
    lines: [
      "I'd say go with them — they're solid for what we needed.",
      "Their support was decent and the integration thing wasn't too bad, although there were a few things.",
      "Pricing is reasonable I think, depending on the tier or whatever.",
    ],
    tip: "\"Solid,\" \"decent,\" \"a few things,\" \"or whatever\" — abstract nouns and shrugs where concrete claims should live. The recommendation lands soft because nothing is anchored.",
  },
  {
    dimension: "clarity",
    band: "competent",
    topic: "Explain why you missed the deadline",
    lines: [
      "We missed Friday because the migration ran twice as long as the benchmark predicted.",
      "We caught it Wednesday and switched to a chunked approach, but by then we'd already lost two days.",
      "New ETA is the following Friday — still on the original quarter.",
    ],
    tip: "Concrete: \"migration,\" \"chunked approach,\" \"Wednesday.\" The point lands the first time. Could be tighter (the second sentence does two jobs) but the listener can repeat it.",
  },
  {
    dimension: "clarity",
    band: "competent",
    topic: "Recommend a vendor to a peer",
    lines: [
      "Use them. Three things you'll like: their support team replies in under four hours, their API docs are honest about edge cases, and the migration tool ran without our touching it.",
      "One thing to watch: the pricing scales with seat count, not usage, so plan around team size.",
    ],
    tip: "Three concrete reasons + one concrete caveat. Listener walks away with a usable picture. Not every word is doing maximum work, but nothing is fuzzy.",
  },
  {
    dimension: "clarity",
    band: "strong",
    topic: "Explain why you missed the deadline",
    lines: [
      "We missed Friday by four days. The migration ran 4x slower than benchmarks predicted.",
      "Caught it Wednesday. Rolled to a chunked migration. New ETA: next Friday — still in-quarter.",
    ],
    tip: "Two short paragraphs, every word load-bearing. Specific numbers (4x, four days), no hedges, no preamble. Strong clarity is when you remove half the words and meaning gets sharper.",
  },
  {
    dimension: "clarity",
    band: "strong",
    topic: "Recommend a vendor to a peer",
    lines: [
      "Use them. Support replies in under four hours. API docs name the edge cases. Migration tool ran unsupervised.",
      "Caveat: pricing is per-seat. Plan around team size, not usage.",
    ],
    tip: "Telegraphic verb-first sentences. The vendor's strengths are claims, not adjectives — \"replies in under four hours\" beats \"great support.\"",
  },
  {
    dimension: "clarity",
    band: "excellent",
    topic: "Explain why you missed the deadline",
    lines: [
      "Missed by four days. Migration ran 4x slow.",
      "Caught Wednesday. Rolled chunked. Next Friday. Still in-quarter.",
    ],
    tip: "Excellent clarity is intentional sparseness. Every dropped word would have been padding. Use this only when context is high — but when it is, this is the sound of conviction.",
  },
  {
    dimension: "clarity",
    band: "excellent",
    topic: "Recommend a vendor to a peer",
    lines: [
      "Use them. Sub-four-hour support. Honest docs. Hands-off migration.",
      "Per-seat pricing — size around the team.",
    ],
    tip: "Each phrase is doing maximum semantic work. The listener gets a vendor they can act on in under 15 seconds. Stops short of cryptic — every line is still a complete picture.",
  },

  // ─── Structure ──────────────────────────────────────────────────────
  {
    dimension: "structure",
    band: "below_standard",
    topic: "Make the case for the four-day work week",
    lines: [
      "There are a lot of reasons to consider it — productivity, retention, signaling.",
      "I mean, we've seen some studies, and a few companies have tried it.",
      "It depends on the team, but I think it's worth thinking about. It could work for us, or maybe not for every team.",
    ],
    tip: "No scaffolding — the listener can't tell where the argument is going. Reasons are listed but never developed. The shape is opaque.",
  },
  {
    dimension: "structure",
    band: "below_standard",
    topic: "Pitch a feature to engineering leadership",
    lines: [
      "We've been thinking about this analytics dashboard for a while.",
      "Users have been asking, and there's a competitive angle, and we have some data to support it.",
      "I think we should build it — there are a few approaches we could take, and we'd want to think about scoping.",
    ],
    tip: "Three reasons mentioned, none developed; no opening claim, no close. The pitch ends mid-thought. Below-standard structure feels like notes read aloud.",
  },
  {
    dimension: "structure",
    band: "competent",
    topic: "Make the case for the four-day work week",
    lines: [
      "I'd argue we should pilot a four-day work week for one quarter.",
      "First, productivity studies show output rises 5-15% when teams compress focus time.",
      "Second, retention — engineers cite hours as a top-three reason for leaving.",
      "Third, signaling — it positions us as a future-of-work company in hiring.",
      "So: pilot one quarter, measure those three, decide from data.",
    ],
    tip: "Clear opening claim, three numbered points, close. The arc is intact. The points could each be sharper but the listener can reconstruct the whole argument.",
  },
  {
    dimension: "structure",
    band: "competent",
    topic: "Pitch a feature to engineering leadership",
    lines: [
      "We should ship the analytics dashboard this quarter — here's why.",
      "Customer demand: the top three accounts have all asked for it in the last 60 days.",
      "Competitive: two of our four direct competitors shipped similar this year.",
      "Effort: backend reuses the events pipeline; the frontend is two engineer-weeks.",
      "Bottom line: high-leverage, low-cost, customer-pulled. Worth the slot.",
    ],
    tip: "Opening claim + three labeled supports + restated close. Structure is visible without being clunky. The labels (\"Customer demand,\" \"Competitive,\" \"Effort\") let the listener track each point separately.",
  },
  {
    dimension: "structure",
    band: "strong",
    topic: "Make the case for the four-day work week",
    lines: [
      "Pilot a four-day week for one quarter. Three reasons, one risk.",
      "Productivity: studies show output rises 5-15% when focus time compresses.",
      "Retention: hours are a top-three exit reason — we lose people we don't have to.",
      "Hiring: positions us as a future-of-work company in a market where that signal matters.",
      "Risk: customer-facing teams can't compress without coverage. Solve with on-call rotations.",
      "Pilot the quarter. Measure the three. Risk-adjust before scaling.",
    ],
    tip: "Compact opening that pre-announces the structure (\"three reasons, one risk\"). Each section is one sentence. Close mirrors the open. Strong structure makes the shape audible from the first line.",
  },
  {
    dimension: "structure",
    band: "strong",
    topic: "Pitch a feature to engineering leadership",
    lines: [
      "Ship analytics this quarter. Customer pull, competitive parity, low effort.",
      "Customer pull: top three accounts asked in 60 days.",
      "Competitive parity: two of four competitors shipped this year.",
      "Low effort: pipeline reuse, two engineer-weeks of frontend.",
      "High-leverage, low-cost, customer-pulled. Take the slot.",
    ],
    tip: "Opening sentence pre-announces the three pillars. Body fulfills them in order. Close echoes the open without verbatim repetition. The whole pitch fits in 20 seconds.",
  },
  {
    dimension: "structure",
    band: "excellent",
    topic: "Make the case for the four-day work week",
    lines: [
      "Pilot four-day week, one quarter. Three reasons, one risk.",
      "Output up 5-15%. Retention pressure relieved. Hiring signal sharpened.",
      "Risk: customer-facing teams. Cover with rotations.",
      "Pilot. Measure. Decide.",
    ],
    tip: "Excellent structure is when the scaffolding becomes invisible because every sentence IS a beat. The three-word close (\"Pilot. Measure. Decide.\") is the shape made physical.",
  },
  {
    dimension: "structure",
    band: "excellent",
    topic: "Pitch a feature to engineering leadership",
    lines: [
      "Ship analytics this quarter. Three signals, one ask.",
      "Top three accounts asked. Two of four competitors shipped. Two engineer-weeks of work.",
      "Take the slot.",
    ],
    tip: "Three-line pitch. Opening pre-announces shape; body delivers it in cadence; close is one verb-phrase. At excellent structure, structure stops being a thing the listener notices and becomes the thing that lets them remember.",
  },

  // ─── Conciseness ────────────────────────────────────────────────────
  {
    dimension: "conciseness",
    band: "below_standard",
    topic: "Why you're qualified for the role, in 30 seconds",
    lines: [
      "So, um, I think I'm a good fit for this role for, like, a few reasons.",
      "I've been doing similar work for a while now — kind of in a different industry, but the skills, you know, do transfer over.",
      "I'm a fast learner, I work well with teams, and I'm pretty self-directed when I need to be.",
      "I guess the main thing is I'm just really excited about the opportunity and I think I'd contribute meaningfully.",
    ],
    tip: "Hedge-stacked, filler-heavy, generalities. Below-standard conciseness reads as anxious — the speaker is filling space, not advancing the case.",
  },
  {
    dimension: "conciseness",
    band: "below_standard",
    topic: "Status update on the migration",
    lines: [
      "The migration is, you know, kind of going well I'd say, generally speaking.",
      "We had a few hiccups earlier this week — nothing major really, just some performance things — but we worked through them.",
      "Currently we're sort of on track, and I think we should be in good shape by next week, hopefully.",
    ],
    tip: "Every sentence advertises uncertainty (\"kind of,\" \"sort of,\" \"hopefully\") that the listener has to subtract. Real signal: \"on track this week, on plan for next.\" Everything else is air.",
  },
  {
    dimension: "conciseness",
    band: "competent",
    topic: "Why you're qualified for the role, in 30 seconds",
    lines: [
      "Three reasons I'd be a strong fit.",
      "Ten years of related work — different industry, but the skill stack maps cleanly.",
      "I've shipped twice in the last 18 months in environments like this one.",
      "And I'm self-directed in ways teams tell me they value.",
    ],
    tip: "Each sentence advances the case. Competent conciseness drops most filler but still has \"strong fit\" / \"ways teams tell me they value\" room to tighten.",
  },
  {
    dimension: "conciseness",
    band: "competent",
    topic: "Status update on the migration",
    lines: [
      "Migration is on track. Two performance issues this week, both resolved.",
      "Demo prep starts Monday; full cutover is locked for next Friday.",
    ],
    tip: "Two sentences, four pieces of information. Competent — every word earns its place but the cadence is still slightly hedged (\"is on track\" vs. \"on track\").",
  },
  {
    dimension: "conciseness",
    band: "strong",
    topic: "Why you're qualified for the role, in 30 seconds",
    lines: [
      "Three reasons.",
      "Ten years in the skill stack — different industry, same muscles.",
      "Two ships in the last 18 months in environments like this.",
      "Self-direction my last three managers all called out.",
    ],
    tip: "Each line is one beat. No verb-first redundancy (\"I've shipped\" → \"two ships\"). Strong conciseness reads as confident because the speaker isn't padding.",
  },
  {
    dimension: "conciseness",
    band: "strong",
    topic: "Status update on the migration",
    lines: [
      "Migration on track. Two perf issues this week — both fixed.",
      "Demo prep Monday. Cutover next Friday.",
    ],
    tip: "Telegraphic. Verb implied. Strong conciseness uses periods where conjunctions used to be — every full stop is a deliberate punctuation move.",
  },
  {
    dimension: "conciseness",
    band: "excellent",
    topic: "Why you're qualified for the role, in 30 seconds",
    lines: [
      "Three reasons.",
      "Ten years in the stack.",
      "Two ships in 18 months.",
      "Three managers cite self-direction.",
    ],
    tip: "Excellent conciseness is when removing one more word would break the meaning. Each line is content-only — no transitions, no setup.",
  },
  {
    dimension: "conciseness",
    band: "excellent",
    topic: "Status update on the migration",
    lines: [
      "On track. Two perf fixes. Demo Monday. Cutover Friday.",
    ],
    tip: "One sentence, four pieces of information. Maximum signal density. Use only when the audience already has full context — \"on track\" is meaningful only because they know what \"it\" is.",
  },

  // ─── Thinking Quality ───────────────────────────────────────────────
  {
    dimension: "thinking_quality",
    band: "below_standard",
    topic: "Argue for adopting a four-day work week",
    lines: [
      "I think four-day work weeks are good.",
      "They're better for everyone — productivity goes up and people are happier.",
      "More companies should be doing it. It just makes sense.",
    ],
    tip: "Three claims, zero support. \"It just makes sense\" is the giveaway — the speaker is asserting, not arguing. Below-standard thinking is conviction without scaffolding.",
  },
  {
    dimension: "thinking_quality",
    band: "below_standard",
    topic: "Why we should sunset the legacy product line",
    lines: [
      "We should kill the legacy line. It's not making money.",
      "Customers don't really use it anymore, and supporting it is a drag on the team.",
      "Honestly, it's just time. We've outgrown it.",
    ],
    tip: "Claims feel right but no number, no comparison, no second-order analysis. \"We've outgrown it\" is a feeling, not a finding.",
  },
  {
    dimension: "thinking_quality",
    band: "competent",
    topic: "Argue for adopting a four-day work week",
    lines: [
      "I'd argue we should pilot a four-day week.",
      "The case: productivity studies show output rises 5-15% when focus time compresses. Microsoft Japan saw 40% improvement in their pilot.",
      "Counterpoint: customer-facing teams can't just compress. They need rotation coverage.",
      "Net: pilot it for engineering and design first. Measure. Then decide on the customer-facing teams.",
    ],
    tip: "Claim + numeric support + counterargument acknowledged + scoped recommendation. Competent thinking. The numbers aren't sourced (\"studies show\") but they're at least quantitative, and the counterpoint is actually engaged.",
  },
  {
    dimension: "thinking_quality",
    band: "competent",
    topic: "Why we should sunset the legacy product line",
    lines: [
      "Legacy line should sunset. Three reasons.",
      "Revenue: 4% of total ARR last quarter, declining 12% year-over-year.",
      "Cost: two engineers full-time on maintenance — that's $400k loaded.",
      "Strategic: every dollar we save here funds the new platform's growth.",
      "Counter: 200 customers depend on it. Plan a 12-month sunset with migration support. Don't surprise them.",
    ],
    tip: "Each claim ships with a number. Counter-argument named and answered with a concrete plan. Competent: the reasoning chain is whole.",
  },
  {
    dimension: "thinking_quality",
    band: "strong",
    topic: "Argue for adopting a four-day work week",
    lines: [
      "Pilot the four-day week for engineering this quarter.",
      "The mechanism that matters: focus time compression. Microsoft Japan ran the pilot, output rose 40%, but the variance was concentrated in deep-work roles. That's our population.",
      "The counterargument I'd take seriously: it's status-quo-bias to assume current 5-day output is the ceiling. Equally biased to assume 4-day is. Pilot is how we resolve.",
      "Second-order: if it works for engineering, the design teams want to follow. We need a rotation plan for support BEFORE the pilot, not after.",
      "So: ship the pilot, lock the support plan first.",
    ],
    tip: "Each claim has a mechanism, not just an outcome. Counterargument is steel-manned. The thinker is operating one level above the surface case — anticipating the second-order question. Strong thinking.",
  },
  {
    dimension: "thinking_quality",
    band: "strong",
    topic: "Why we should sunset the legacy product line",
    lines: [
      "Sunset the legacy line. The economics no longer work, but the timing matters more.",
      "Revenue is 4% of ARR, declining 12% YoY — that trajectory hits negative-margin in five quarters even without growth investment.",
      "The two-engineer maintenance cost ($400k loaded) is the visible bill. The hidden bill is the platform we're not building because those engineers aren't on it.",
      "The counter is real: 200 customers, real revenue today. The risk isn't sunsetting — it's sunsetting badly. 12-month timeline, migration credit, named contact per account.",
      "Decision: sunset, but invest in the off-ramp before announcing. The damage from a botched migration is bigger than any of the savings.",
    ],
    tip: "Strong thinking distinguishes the visible bill from the hidden bill (engineer opportunity cost). Names the second-order risk (botched migration > savings). The reasoning operates at the level of mechanism, not just metric.",
  },
  {
    dimension: "thinking_quality",
    band: "excellent",
    topic: "Argue for adopting a four-day work week",
    lines: [
      "Pilot four-day for engineering. Lock the support rotation first.",
      "The claim is mechanism: focus time compression, replicated where deep work concentrates. Microsoft Japan got 40%; concentrated in roles like ours.",
      "The honest counter: the pilot will look successful even if it isn't, because measurement bias rewards motivated experiments. So: pre-commit to the kill criteria — what would make us reverse — before we start.",
      "If we won't define failure, we shouldn't run the test.",
    ],
    tip: "Excellent thinking adds the meta-question: \"how would we know if we're wrong?\" The pre-commitment to kill criteria is a level deeper than \"pilot and measure\" — it's a falsifiability check.",
  },
  {
    dimension: "thinking_quality",
    band: "excellent",
    topic: "Why we should sunset the legacy product line",
    lines: [
      "Sunset is right. The interesting question is whether we'd reach the same answer if revenue were flat instead of declining.",
      "If yes, the economics aren't really driving — strategic focus is. We should say so.",
      "If no, we're tolerating a 4% drag for accounting comfort. Worse: we're letting the market sunset us instead of choosing our exit.",
      "Sunset on our terms. 12-month migration. Name the strategic reason internally — it's the one that survives a revenue rebound.",
    ],
    tip: "The thinker reframes the decision before answering it. \"Would the answer change if the input changed?\" exposes which variable is actually load-bearing. Excellent: the analysis interrogates the question itself.",
  },

  // ─── Delivery ───────────────────────────────────────────────────────
  {
    dimension: "delivery",
    band: "below_standard",
    topic: "Open a presentation to your team",
    lines: [
      "[Fast.] Hey everyone, um, so today I want to talk about — let me just pull this up — okay, today I want to talk about the Q3 numbers and what we're doing about them, um, and then we'll go through some of the action items and kind of what's next.",
    ],
    tip: "Front-loaded with filler, no pacing variation, the whole opening is one breath. Below-standard delivery is when the listener notices the rate before the content.",
  },
  {
    dimension: "delivery",
    band: "below_standard",
    topic: "Recap the rep at the close of a workout",
    lines: [
      "[Rushing.] Yeah so that was — that was the rep, I think it went pretty well, you know, there were some moments where I kind of lost my place but overall I think we got the main points across and we'll just keep going.",
    ],
    tip: "No pause structure. No breath. Pacing climbs through the whole sentence as the speaker tries to land before they trip. The listener absorbs maybe 30% of the words.",
  },
  {
    dimension: "delivery",
    band: "competent",
    topic: "Open a presentation to your team",
    lines: [
      "Hey team. Today: Q3 numbers and what we're doing about them.",
      "Three sections — context, the gap, the plan. [pause] Then questions.",
    ],
    tip: "Steady pace, one short pause to land the structure, no filler. Competent delivery — the listener's brain is free to track content because the rhythm isn't fighting them.",
  },
  {
    dimension: "delivery",
    band: "competent",
    topic: "Recap the rep at the close of a workout",
    lines: [
      "That was a clean rep. [pause] Got the open down, lost the middle for a beat, recovered the close.",
      "Next rep, we're focused on holding the middle.",
    ],
    tip: "Two pauses, both intentional. Pace is steady. The post-pause sentences get hearing time because the silence flagged them as important.",
  },
  {
    dimension: "delivery",
    band: "strong",
    topic: "Open a presentation to your team",
    lines: [
      "Hey team. [pause]",
      "Q3 numbers. [pause] What we're doing.",
      "Three sections. [pause] Context. The gap. The plan.",
    ],
    tip: "Pauses are doing structural work — they're the audible chapter breaks. Pace stays in the 140-150 wpm band even with the silences. Strong delivery is when the silences are a tool.",
  },
  {
    dimension: "delivery",
    band: "strong",
    topic: "Recap the rep at the close of a workout",
    lines: [
      "Clean rep. [pause]",
      "Strong open. [pause] Lost a beat in the middle. Recovered the close.",
      "[pause] Middle is the work for next rep.",
    ],
    tip: "Three short paragraphs of speech, each set off by a pause. The pace is steady, but the SHAPE is the dimension being trained. Strong delivery has the cadence of a metronome with intentional rests.",
  },
  {
    dimension: "delivery",
    band: "excellent",
    topic: "Open a presentation to your team",
    lines: [
      "Hey team. [full second pause]",
      "Three things today. Context. The gap. The plan. [full second pause]",
      "Let's start.",
    ],
    tip: "Excellent delivery uses silence the way poets use line breaks. The full-second pauses force the listener to lean in, then the content lands clean. Pace never wavers.",
  },
  {
    dimension: "delivery",
    band: "excellent",
    topic: "Recap the rep at the close of a workout",
    lines: [
      "Clean. [pause]",
      "[Slower:] Open held. Middle slipped. Close landed.",
      "[Pause.] Middle. [pause] Next rep.",
    ],
    tip: "Tempo modulation as content. The slowing on the diagnostic line forces the listener to absorb each beat. The closing is two words — and the pause between them lands the whole rep's worth of focus on \"middle.\"",
  },

  // ─── Tone ───────────────────────────────────────────────────────────
  {
    dimension: "tone",
    band: "below_standard",
    topic: "Confirm a decision in a leadership meeting",
    lines: [
      "[Upspeak throughout.] So I think we should ship it next week? And I'm pretty confident the customer impact will be limited? And we have a rollback plan if anything goes sideways?",
    ],
    tip: "Every statement rises at the end like a question. Below-standard tone — the speaker is making decisions but the voice is asking for permission. Listeners hear hesitation regardless of the content's quality.",
  },
  {
    dimension: "tone",
    band: "below_standard",
    topic: "Encourage a teammate after a tough rep",
    lines: [
      "[Monotone, flat volume throughout.] Yeah, that wasn't great. But, you know, you'll get it next time. Don't worry about it.",
    ],
    tip: "Volume locked, pitch flat, no warmth color. The words are encouraging but the voice is sending the opposite signal. Below-standard tone undercuts even well-meaning content.",
  },
  {
    dimension: "tone",
    band: "competent",
    topic: "Confirm a decision in a leadership meeting",
    lines: [
      "We're shipping it next week. [Pitch drops on \"week.\"]",
      "Customer impact is limited. We have a rollback plan if anything goes sideways.",
    ],
    tip: "Statements close with downward pitch — the audible difference from the below-standard version. Volume is steady and clear. Competent tone matches the content's certainty.",
  },
  {
    dimension: "tone",
    band: "competent",
    topic: "Encourage a teammate after a tough rep",
    lines: [
      "[Warmer, slightly louder than baseline:] That was a hard rep. The pressure was real.",
      "[Steady:] You stayed in it. Next one is yours.",
    ],
    tip: "Some warmth on the open, return to steady on the close. Competent tone is when the voice color is doing some of the emotional work — not just the words.",
  },
  {
    dimension: "tone",
    band: "strong",
    topic: "Confirm a decision in a leadership meeting",
    lines: [
      "[Lower, steady:] We're shipping next week.",
      "[Slight pitch lift on \"limited\":] Customer impact is limited — we've stress-tested.",
      "[Drop firmly on \"sideways\":] Rollback if anything goes sideways.",
    ],
    tip: "Three sentences, three different pitch contours, all closing downward. Each one signals a different beat: decision, evidence, contingency. Strong tone uses pitch as punctuation.",
  },
  {
    dimension: "tone",
    band: "strong",
    topic: "Encourage a teammate after a tough rep",
    lines: [
      "[Warm, lower volume — like leaning closer:] That was a hard rep. The pressure was real, and you felt it.",
      "[Slight lift, more energy:] What I saw though — you stayed in it. You didn't bail.",
      "[Steady, conviction:] Next one is yours.",
    ],
    tip: "Three distinct emotional registers: empathy → recognition → conviction. The voice is doing the work of three different supporting moves. Strong tone is dynamic AND landing on conviction.",
  },
  {
    dimension: "tone",
    band: "excellent",
    topic: "Confirm a decision in a leadership meeting",
    lines: [
      "[Low, slow, dropped pitch on \"shipping\":] We're shipping next week. [pause]",
      "[Steady, factual:] Customer impact is limited.",
      "[Drop sharply on \"sideways\" — no rise:] Rollback ready if anything goes sideways.",
    ],
    tip: "Excellent tone makes the listener feel the certainty before they parse the words. Every sentence closes with a pitch drop sharp enough to function as a period — no doubt left in the audio.",
  },
  {
    dimension: "tone",
    band: "excellent",
    topic: "Encourage a teammate after a tough rep",
    lines: [
      "[Quiet, close, warm:] That was hard. [full pause]",
      "[Slight lift, steady volume:] You stayed in it.",
      "[Drop, conviction:] Next one is yours.",
    ],
    tip: "Three lines, each a different vocal color, each landing without commentary. The pause after \"hard\" lets the empathy land before the redirect. Excellent tone is the voice doing what the words can only describe.",
  },
];

/**
 * Pick the best exemplar for a (dimension, archetypeId) pair.
 *
 * Selection: archetype-specific match wins; falls back to dimension-only;
 * returns null when neither exists. UI surfaces a "no exemplar yet"
 * fallback copy when null.
 */
export function pickExemplar(opts: {
  dimension: SkillDimension;
  archetypeId?: PressureArchetypeId | null;
}): Exemplar | null {
  const { dimension, archetypeId } = opts;
  if (archetypeId) {
    const exact = EXEMPLARS.find(
      (e) => e.dimension === dimension && e.archetypeId === archetypeId,
    );
    if (exact) return exact;
  }
  const dimMatch = EXEMPLARS.find(
    (e) => e.dimension === dimension && e.archetypeId === undefined && e.band === undefined,
  );
  return dimMatch ?? null;
}

/**
 * Ch.16c — return all exemplars for one dimension grouped by band.
 * Used by /skill-lab/[dim]/exemplars to render 5-band tabs. The
 * "general" bucket holds the original untagged exemplars (no `band`
 * field) so the page surfaces them as a footer for cross-band
 * inspiration.
 */
export type ExemplarsByBand = {
  /** band → exemplars (sorted by topic for stable ordering). Bands
   *  with no exemplars get an empty array — the UI tab still renders
   *  with an "exemplars coming soon" empty state for that band. */
  byBand: Partial<Record<BandId, Exemplar[]>>;
  /** Untagged (general-purpose) exemplars from the original 13 +
   *  archetype-tagged ones for this dim. Surfaced as a "general"
   *  footer/tab. */
  general: Exemplar[];
};

export function getExemplarsByBand(
  dimension: SkillDimension,
): ExemplarsByBand {
  const dimEntries = EXEMPLARS.filter((e) => e.dimension === dimension);
  const byBand: Partial<Record<BandId, Exemplar[]>> = {};
  const general: Exemplar[] = [];
  for (const e of dimEntries) {
    if (e.band) {
      const arr = byBand[e.band] ?? [];
      arr.push(e);
      byBand[e.band] = arr;
    } else {
      general.push(e);
    }
  }
  // Stable sort by topic within each bucket.
  for (const k of Object.keys(byBand) as BandId[]) {
    byBand[k]!.sort((a, b) => a.topic.localeCompare(b.topic));
  }
  general.sort((a, b) => a.topic.localeCompare(b.topic));
  return { byBand, general };
}
