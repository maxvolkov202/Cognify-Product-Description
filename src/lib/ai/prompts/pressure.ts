import type { PressureArchetypeId } from "@/lib/ai/pressure-archetypes";
import type { PressurePrompt, PressureSetting } from "./types";

/**
 * Cognify Pressure Prompt Bank — WS-3
 *
 * Each archetype has 8+ prompts spanning common high-stakes professional
 * situations (sales, interviews, exec briefs, peer feedback, presentations,
 * team conflict, negotiation). Prompts are self-contained strings that
 * bake in the pressure mechanism — the user reads one prompt and knows
 * exactly what's coming.
 *
 * The bank stores `PressurePrompt` objects with stable `id` and a
 * `setting` tag (work / public / personal). The archetype IS the primary
 * variation axis; setting is secondary — used by the picker to avoid all
 * five prompts on a slate being workplace scenarios when the user has
 * "personal" verticals.
 *
 * Authoring rules (from pressure-system.md §6):
 *   - Concrete: name the setting, audience, stakes. No abstract "talk about X".
 *   - Realistic: use lines a real person would actually say.
 *   - Archetype-clean: the mechanism is visible in the prompt, not assumed.
 *   - Time-honest: time compression prompts name the budget explicitly.
 *   - Audience-explicit: switches name both audiences by role.
 *
 * These prompts are general (not vertical-gated) — the Build a Rep flow
 * is where the user's specific context lands. Workout pressure prompts
 * aim at professional situations everyone encounters.
 */

export const PRESSURE_PROMPTS: Record<
  PressureArchetypeId,
  readonly PressurePrompt[]
> = {
  // ——— Pushback ——————————————————————————————————————————————
  // User makes a case; an objection arrives at the end of the prompt.
  // The rep must acknowledge + redirect without abandoning the original
  // claim. Scores reward the Acknowledge → Redirect → Land pattern.
  pushback: [
    {
      id: "pushback_001",
      setting: "work",
      text: "Make the case to your manager that you deserve the lead role on the next big project. When you finish, they say: \"You've only been on the team six months — is this really the right moment?\" Respond.",
    },
    {
      id: "pushback_002",
      setting: "work",
      text: "You're pitching a new tool to buy to your ops lead. Your three-line case lands, and then they say: \"We tried something like this last year and no one adopted it.\" Keep your claim alive.",
    },
    {
      id: "pushback_003",
      setting: "work",
      text: "Tell a skeptical colleague why the team should adopt code reviews before merging. At the end they say: \"Reviews just slow us down — good engineers don't need them.\" Respond without caving.",
    },
    {
      id: "pushback_004",
      setting: "work",
      text: "Make the argument to a founder that hiring a PM now is the right call. They push back: \"PMs are overhead. I can run product myself for another year.\" Hold your point.",
    },
    {
      id: "pushback_005",
      setting: "personal",
      text: "You're convincing a friend to quit their comfortable job for a startup. After your pitch, they say: \"That sounds reckless — I have a mortgage.\" Respond.",
    },
    {
      id: "pushback_006",
      setting: "work",
      text: "Argue to your director that the team should stop weekly all-hands. At the end, they say: \"The all-hands is the only thing keeping us aligned.\" Keep going.",
    },
    {
      id: "pushback_007",
      setting: "work",
      text: "Pitch your VP on replacing your agency with an in-house team. They say: \"Every in-house team I've built has been slower and more expensive.\" Respond.",
    },
    {
      id: "pushback_008",
      setting: "work",
      text: "Tell a peer that the new process they designed isn't working for your team. They say: \"Everyone else has adapted — what's different about your team?\" Stay specific.",
    },
    {
      id: "pushback_009",
      setting: "work",
      text: "Argue to your manager that you should drop a project you're already on. After your case they say: \"You're abandoning the team mid-flight.\" Hold your ground.",
    },
    {
      id: "pushback_010",
      setting: "work",
      text: "Make the case to engineering leadership that the team should rewrite a legacy system. They say: \"Every rewrite I've ever approved went 6x over budget.\" Respond.",
    },
    {
      id: "pushback_011",
      setting: "work",
      text: "Tell your CEO why you missed your number this quarter. They say: \"That's the same explanation you gave last quarter.\" Respond without hedging.",
    },
    {
      id: "pushback_012",
      setting: "work",
      text: "Pitch your design lead on killing a feature 80% built. They say: \"Customers asked us for this for a year.\" Respond.",
    },
    {
      id: "pushback_013",
      setting: "work",
      text: "Argue to your hiring manager for a candidate who failed the technical screen. They say: \"Bar exists for a reason.\" Make your case anyway.",
    },
    {
      id: "pushback_014",
      setting: "work",
      text: "Tell your VP you want to step back from a leadership role. They say: \"That's a step backwards — you'll regret it.\" Respond.",
    },
    {
      id: "pushback_015",
      setting: "work",
      text: "Argue to your CFO that the team needs more budget despite the freeze. They say: \"Everyone says they're the exception.\" Hold your point.",
    },
    {
      id: "pushback_016",
      setting: "work",
      text: "Pitch your team on adopting an unfamiliar framework. A senior engineer says: \"This is the JavaScript fatigue cycle all over again.\" Respond.",
    },
    {
      id: "pushback_017",
      setting: "work",
      text: "Make the case to your CTO that the team should ship to production daily. They say: \"That's a great way to lose customer trust.\" Hold the line.",
    },
    {
      id: "pushback_018",
      setting: "work",
      text: "Argue to a partner that the firm should drop a low-margin client. They say: \"They've been with us for ten years.\" Respond.",
    },
    {
      id: "pushback_019",
      setting: "work",
      text: "Tell your boss that the metric they care about is the wrong one. They say: \"That metric is what the board sees.\" Make your case.",
    },
    {
      id: "pushback_020",
      setting: "work",
      text: "Pitch leadership on hiring for potential over experience. They say: \"We've been burned every time we've done that.\" Respond.",
    },
    {
      id: "pushback_021",
      setting: "work",
      text: "Argue to your team that a postmortem isn't worth doing this week. A peer says: \"That's how mistakes repeat.\" Respond.",
    },
    {
      id: "pushback_022",
      setting: "work",
      text: "Make the case to a customer that they should not buy what they came to buy. They say: \"Why are you talking us out of this?\" Hold your point.",
    },
    {
      id: "pushback_023",
      setting: "work",
      text: "Pitch your manager on letting a teammate work in a different timezone. They say: \"Async only works for senior people.\" Respond.",
    },
    {
      id: "pushback_024",
      setting: "work",
      text: "Argue to your skip-level that your manager is the wrong fit. They say: \"That sounds like a you-problem, not a them-problem.\" Respond.",
    },
    {
      id: "pushback_025",
      setting: "work",
      text: "Tell your editor a story isn't ready to publish. They say: \"We have a slot tomorrow.\" Hold the line.",
    },
    {
      id: "pushback_026",
      setting: "work",
      text: "Argue to a co-founder that you should fire a beloved teammate. They say: \"Everyone loves them.\" Respond.",
    },
    {
      id: "pushback_027",
      setting: "work",
      text: "Make the case to leadership that the office should close. A senior partner says: \"That's how culture dies.\" Respond.",
    },
    {
      id: "pushback_028",
      setting: "work",
      text: "Pitch your team on canceling a tradition they love. Someone says: \"This is the only fun part of working here.\" Respond.",
    },
    {
      id: "pushback_029",
      setting: "personal",
      text: "Tell your partner you want to delay buying a house. They say: \"We agreed on the timeline a year ago.\" Respond.",
    },
    {
      id: "pushback_030",
      setting: "personal",
      text: "Argue to a parent that you don't want kids. They say: \"You'll change your mind, everyone does.\" Hold your ground.",
    },
    {
      id: "pushback_031",
      setting: "personal",
      text: "Tell a sibling you can't lend them more money. They say: \"You're the only one who can help me.\" Respond.",
    },
    {
      id: "pushback_032",
      setting: "personal",
      text: "Argue to your spouse that you should move for your career. They say: \"My job is here.\" Respond.",
    },
    {
      id: "pushback_033",
      setting: "personal",
      text: "Tell a friend you're cutting back on going out. They say: \"You're becoming boring.\" Respond.",
    },
    {
      id: "pushback_034",
      setting: "personal",
      text: "Argue to your in-laws that the holiday plan needs to change. They say: \"We've done it this way for 30 years.\" Respond.",
    },
    {
      id: "pushback_035",
      setting: "personal",
      text: "Tell a friend you don't agree with how they're parenting. They say: \"You don't even have kids.\" Hold your point.",
    },
    {
      id: "pushback_036",
      setting: "public",
      text: "On a panel, you argue that AI hype is overdone. Another panelist says: \"You sound like the people who said the internet was a fad.\" Respond.",
    },
    {
      id: "pushback_037",
      setting: "public",
      text: "In an interview, you argue that hustle culture is broken. The host says: \"Easy to say once you've already made it.\" Respond.",
    },
    {
      id: "pushback_038",
      setting: "public",
      text: "On stage, you argue that remote work is the future. An audience member shouts: \"That's killing junior careers.\" Respond.",
    },
    {
      id: "pushback_039",
      setting: "public",
      text: "In a podcast, you argue that more meetings would actually help. The host laughs: \"Nobody on Earth wants more meetings.\" Hold the position.",
    },
    {
      id: "pushback_040",
      setting: "public",
      text: "At a conference Q&A, you defend a controversial product decision. Someone asks: \"How do you sleep at night?\" Respond without defensiveness.",
    },
  ],

  // ——— Time Compression ——————————————————————————————————————
  // The constraint itself is the pressure: 15-20 seconds to say what
  // would normally take a minute. No preamble, no hedging, no rescue-
  // by-rambling. Scores reward verb-first, signal-dense delivery.
  time_compression: [
    {
      id: "time_compression_001",
      setting: "work",
      text: "Your CEO stops you in the hallway: \"Why are we two weeks behind on the launch?\" You have 15 seconds. No preamble.",
    },
    {
      id: "time_compression_002",
      setting: "work",
      text: "In a board meeting, a director asks: \"What's the one thing you'd change about how this team operates?\" 20 seconds. Go.",
    },
    {
      id: "time_compression_003",
      setting: "work",
      text: "Your biggest client emails: \"Give me the top three reasons I should renew.\" You have 20 seconds on a voice note. Start.",
    },
    {
      id: "time_compression_004",
      setting: "work",
      text: "You're in an elevator with the CFO. They ask: \"What's the most important metric your team watches?\" 15 seconds.",
    },
    {
      id: "time_compression_005",
      setting: "public",
      text: "A reporter calls: \"What does your company actually do?\" 20 seconds. No jargon.",
    },
    {
      id: "time_compression_006",
      setting: "public",
      text: "An investor asks at a pitch event: \"Why you?\" You have 15 seconds to answer. Begin.",
    },
    {
      id: "time_compression_007",
      setting: "public",
      text: "A recruiter catches you at a conference: \"Tell me about yourself — what you do, what you want next.\" 20 seconds.",
    },
    {
      id: "time_compression_008",
      setting: "work",
      text: "Your direct report asks: \"What should I focus on this week?\" You have 15 seconds. Be actionable.",
    },
    {
      id: "time_compression_009",
      setting: "public",
      text: "Someone at a networking event asks: \"What are you working on that you're excited about?\" 20 seconds.",
    },
    {
      id: "time_compression_010",
      setting: "work",
      text: "Your VP catches you between meetings: \"Why is morale slipping?\" 15 seconds. Be honest.",
    },
    {
      id: "time_compression_011",
      setting: "work",
      text: "Your engineering lead pings you in chat: \"One sentence — what's the biggest risk to launch?\" 15 seconds.",
    },
    {
      id: "time_compression_012",
      setting: "work",
      text: "A board member walks past your desk: \"What's the one thing keeping you up at night?\" 15 seconds.",
    },
    {
      id: "time_compression_013",
      setting: "work",
      text: "Your manager opens with: \"Why should I keep funding this team?\" 20 seconds. Go.",
    },
    {
      id: "time_compression_014",
      setting: "work",
      text: "A new exec on day one asks: \"What does success look like for your team in six months?\" 20 seconds.",
    },
    {
      id: "time_compression_015",
      setting: "work",
      text: "An auditor asks: \"What's your team's single biggest control gap?\" 15 seconds. No hedging.",
    },
    {
      id: "time_compression_016",
      setting: "work",
      text: "Your CFO walks into stand-up: \"Where would you cut 10% if you had to?\" 20 seconds.",
    },
    {
      id: "time_compression_017",
      setting: "work",
      text: "A new hire asks: \"What's the weirdest part about working here that I should know?\" 15 seconds.",
    },
    {
      id: "time_compression_018",
      setting: "work",
      text: "Your boss in a hallway: \"What did you learn this week?\" 15 seconds.",
    },
    {
      id: "time_compression_019",
      setting: "work",
      text: "Your mentor asks: \"What are you not telling me about this project?\" 20 seconds. Be honest.",
    },
    {
      id: "time_compression_020",
      setting: "work",
      text: "A peer in a kitchen: \"How do you decide what to drop when everything's on fire?\" 20 seconds.",
    },
    {
      id: "time_compression_021",
      setting: "work",
      text: "Your VP between Zoom calls: \"What's one thing your team needs from me right now?\" 15 seconds.",
    },
    {
      id: "time_compression_022",
      setting: "work",
      text: "A skip-level catches you: \"Are we hiring fast enough?\" 15 seconds. Direct answer.",
    },
    {
      id: "time_compression_023",
      setting: "work",
      text: "Your boss texts: \"15 sec voice note — should we promote Alex this cycle?\" Go.",
    },
    {
      id: "time_compression_024",
      setting: "work",
      text: "A reporter on the phone: \"Why did you make that controversial call?\" 20 seconds. Be clear.",
    },
    {
      id: "time_compression_025",
      setting: "public",
      text: "On a podcast: \"What's a strong opinion you hold loosely?\" 20 seconds.",
    },
    {
      id: "time_compression_026",
      setting: "public",
      text: "A panel moderator: \"In one sentence — why does your work matter?\" 15 seconds.",
    },
    {
      id: "time_compression_027",
      setting: "public",
      text: "An audience member asks: \"What's the worst advice you ever got?\" 20 seconds.",
    },
    {
      id: "time_compression_028",
      setting: "public",
      text: "A live interviewer: \"What would you tell your 22-year-old self?\" 15 seconds.",
    },
    {
      id: "time_compression_029",
      setting: "public",
      text: "On a conference Q&A: \"Why is this market hard?\" 20 seconds. No jargon.",
    },
    {
      id: "time_compression_030",
      setting: "public",
      text: "A radio host on a tight clock: \"In 15 seconds, what's the one thing you want listeners to remember?\" Go.",
    },
    {
      id: "time_compression_031",
      setting: "public",
      text: "A panel host: \"In 20 seconds, what's the most surprising thing you've learned this year?\"",
    },
    {
      id: "time_compression_032",
      setting: "public",
      text: "A live audience question: \"What's one thing this industry needs to stop doing?\" 20 seconds.",
    },
    {
      id: "time_compression_033",
      setting: "public",
      text: "A reporter calls: \"What's the simplest thing your service does for someone?\" 15 seconds.",
    },
    {
      id: "time_compression_034",
      setting: "public",
      text: "A fellow speaker after your talk: \"In 20 seconds, what would you change if you gave that again?\"",
    },
    {
      id: "time_compression_035",
      setting: "personal",
      text: "Your partner: \"In 20 seconds — what's the next big thing you want for us?\" Go.",
    },
    {
      id: "time_compression_036",
      setting: "personal",
      text: "A close friend: \"15 seconds — am I being honest with myself about this?\" Be direct.",
    },
    {
      id: "time_compression_037",
      setting: "personal",
      text: "Your parent at dinner: \"What are you actually proud of this year?\" 20 seconds.",
    },
    {
      id: "time_compression_038",
      setting: "personal",
      text: "Your sibling on a walk: \"What's something you're avoiding telling me?\" 20 seconds.",
    },
    {
      id: "time_compression_039",
      setting: "personal",
      text: "A best friend: \"15 seconds — should I take the offer?\" Real answer.",
    },
    {
      id: "time_compression_040",
      setting: "personal",
      text: "A first date: \"What are you actually looking for?\" 20 seconds. No script.",
    },
  ],

  // ——— Audience Switch ———————————————————————————————————————
  // Same substance, two audiences, one rep. Scores reward register
  // shifts (vocabulary, stakes framing) without substance drift.
  // Note the explicit "pivot" line users must verbally include.
  audience_switch: [
    {
      id: "audience_switch_001",
      setting: "work",
      text: "Explain what your team does. First audience: a marketing intern on their first day (20 seconds). Then — pivot — now you're telling the CFO what your team costs vs. returns (15 seconds).",
    },
    {
      id: "audience_switch_002",
      setting: "work",
      text: "Explain why a project failed. First to the junior engineer who worked on it, who needs to learn (20s). Then to the VP who approved it, who needs to decide about the next one (15s).",
    },
    {
      id: "audience_switch_003",
      setting: "work",
      text: "Explain AI to two people. First a designer who's suspicious of it (20s). Then a researcher who's deep in the field and wants to know what's genuinely new to you (15s).",
    },
    {
      id: "audience_switch_004",
      setting: "personal",
      text: "Describe your product. First to your grandparent, who's never heard of it (20s). Then to a potential competitor's engineer at a meetup (15s).",
    },
    {
      id: "audience_switch_005",
      setting: "work",
      text: "Explain the company's new strategy. First to the customer support team who'll field questions about it (20s). Then to the founder, whose instinct is it's not ambitious enough (15s).",
    },
    {
      id: "audience_switch_006",
      setting: "work",
      text: "Explain a technical decision. First to a product manager without a CS background (20s). Then to a senior architect who'll challenge every tradeoff (15s).",
    },
    {
      id: "audience_switch_007",
      setting: "personal",
      text: "Describe a recent win. First to a friend outside your industry at a dinner (20s). Then to a VC on a call who's evaluating whether to invest (15s).",
    },
    {
      id: "audience_switch_008",
      setting: "work",
      text: "Explain how you'd handle a team conflict. First to a new manager looking for a template (20s). Then to your HR partner who's watching for liability (15s).",
    },
    {
      id: "audience_switch_009",
      setting: "work",
      text: "Explain a security breach. First to your engineers who need to fix it tonight (20s). Then to your CEO who needs to brief the board tomorrow (15s).",
    },
    {
      id: "audience_switch_010",
      setting: "work",
      text: "Explain why a launch is delayed. First to a customer waiting on it (20s). Then to your VP who already told the board you'd ship (15s).",
    },
    {
      id: "audience_switch_011",
      setting: "work",
      text: "Explain a performance issue. First to the report whose work is slipping (20s). Then to HR who's documenting the conversation (15s).",
    },
    {
      id: "audience_switch_012",
      setting: "work",
      text: "Explain why you missed a number. First to your team who needs the morale lift (20s). Then to your boss who needs the truth (15s).",
    },
    {
      id: "audience_switch_013",
      setting: "work",
      text: "Explain the company strategy. First to a new sales rep on day one (20s). Then to a senior engineer who's seen three of these (15s).",
    },
    {
      id: "audience_switch_014",
      setting: "work",
      text: "Explain the team's biggest risk. First to your direct reports (20s). Then to the audit committee (15s).",
    },
    {
      id: "audience_switch_015",
      setting: "work",
      text: "Explain a tradeoff between speed and quality. First to your team (20s). Then to a customer asking why (15s).",
    },
    {
      id: "audience_switch_016",
      setting: "work",
      text: "Explain a company restructure. First to a junior who's worried about their job (20s). Then to a peer leader who's seeing it as a power play (15s).",
    },
    {
      id: "audience_switch_017",
      setting: "work",
      text: "Explain the new comp plan. First to a top performer (20s). Then to someone in the bottom quartile (15s).",
    },
    {
      id: "audience_switch_018",
      setting: "work",
      text: "Explain a customer escalation. First to your support team (20s). Then to the CEO who just got pinged about it (15s).",
    },
    {
      id: "audience_switch_019",
      setting: "work",
      text: "Explain why you're killing a beloved feature. First to engineering (20s). Then to the customer success team who'll field complaints (15s).",
    },
    {
      id: "audience_switch_020",
      setting: "work",
      text: "Explain a strategy pivot. First to your team (20s). Then to investors who funded the original plan (15s).",
    },
    {
      id: "audience_switch_021",
      setting: "work",
      text: "Explain why a launch flopped. First to your team in private (20s). Then in a public post-mortem to the company (15s).",
    },
    {
      id: "audience_switch_022",
      setting: "work",
      text: "Explain a hiring philosophy. First to candidates in interviews (20s). Then to the hiring committee debating bar (15s).",
    },
    {
      id: "audience_switch_023",
      setting: "public",
      text: "Explain your career path. First on a college panel for students (20s). Then in a press interview about your industry (15s).",
    },
    {
      id: "audience_switch_024",
      setting: "public",
      text: "Explain your company's mission. First to a journalist looking for a controversy angle (20s). Then to a potential acquirer (15s).",
    },
    {
      id: "audience_switch_025",
      setting: "public",
      text: "Explain a regulatory shift. First to a public audience at a town hall (20s). Then to your regulator on a private call (15s).",
    },
    {
      id: "audience_switch_026",
      setting: "public",
      text: "Explain a scandal at your company. First in a press statement (20s). Then to your largest customer who's nervous (15s).",
    },
    {
      id: "audience_switch_027",
      setting: "public",
      text: "Explain why your product is priced where it is. First on a podcast (20s). Then to a customer asking on the live chat (15s).",
    },
    {
      id: "audience_switch_028",
      setting: "personal",
      text: "Explain a divorce. First to your kids (20s). Then to a sibling who never liked your spouse (15s).",
    },
    {
      id: "audience_switch_029",
      setting: "personal",
      text: "Explain a major life change. First to your parents (20s). Then to your boss who needs to know what it means for work (15s).",
    },
    {
      id: "audience_switch_030",
      setting: "personal",
      text: "Explain a financial mistake. First to your spouse (20s). Then to your accountant who needs to clean it up (15s).",
    },
    {
      id: "audience_switch_031",
      setting: "personal",
      text: "Explain a health diagnosis. First to your kids (20s). Then to your manager who needs to plan around it (15s).",
    },
    {
      id: "audience_switch_032",
      setting: "personal",
      text: "Explain why you're moving cities. First to your aging parents (20s). Then to a friend you grew up with (15s).",
    },
    {
      id: "audience_switch_033",
      setting: "personal",
      text: "Explain a sobriety choice. First to a curious friend at dinner (20s). Then to your sponsor at AA (15s).",
    },
    {
      id: "audience_switch_034",
      setting: "personal",
      text: "Explain a religious practice. First to a five-year-old (20s). Then to a skeptical college roommate (15s).",
    },
    {
      id: "audience_switch_035",
      setting: "personal",
      text: "Explain a long-distance relationship. First to a friend who thinks it's a bad idea (20s). Then to your parent who's worried (15s).",
    },
    {
      id: "audience_switch_036",
      setting: "work",
      text: "Explain technical debt to a non-technical CEO (20s). Then to a senior engineer who wants to tackle it (15s).",
    },
    {
      id: "audience_switch_037",
      setting: "work",
      text: "Explain a price increase to your sales team (20s). Then to your largest customer who got the email (15s).",
    },
    {
      id: "audience_switch_038",
      setting: "work",
      text: "Explain why a project is being canceled to the team that built it (20s). Then to leadership debating what to fund next (15s).",
    },
    {
      id: "audience_switch_039",
      setting: "work",
      text: "Explain your industry's biggest risk to a college student touring (20s). Then to an analyst writing a report (15s).",
    },
    {
      id: "audience_switch_040",
      setting: "work",
      text: "Explain why you turned down a promotion to your boss (20s). Then to your spouse who was excited about it (15s).",
    },
  ],

  // ——— Clarifying Interrupt ——————————————————————————————————
  // Mid-explanation, a specific simulated interrupt lands. The rep
  // must acknowledge, recover, and land the point. Scores reward the
  // recovery — handled well, this builds credibility; handled badly,
  // it breaks it.
  clarifying_interrupt: [
    {
      id: "clarifying_interrupt_001",
      setting: "work",
      text: "Walk me through how you'd handle a coworker who misses deadlines. Around 15 seconds in you'll hear: \"That doesn't address the root issue — try again.\" Keep your structure. Recover.",
    },
    {
      id: "clarifying_interrupt_002",
      setting: "personal",
      text: "Explain how you'd decide between two job offers. About 15 seconds in, the interrupt says: \"You're just listing things — what actually matters to you?\" Respond and keep going.",
    },
    {
      id: "clarifying_interrupt_003",
      setting: "work",
      text: "Teach someone how to give constructive feedback. 15 seconds in: \"That sounds like theory — what do you actually say?\" Land concrete next.",
    },
    {
      id: "clarifying_interrupt_004",
      setting: "work",
      text: "Describe your approach to onboarding a new hire. 15 seconds in: \"I've heard all this before. What's different about your way?\" Respond with specificity.",
    },
    {
      id: "clarifying_interrupt_005",
      setting: "work",
      text: "Explain why your project deserves more budget. 15 seconds in the CFO interrupts: \"I'm not hearing ROI, I'm hearing activity.\" Redirect.",
    },
    {
      id: "clarifying_interrupt_006",
      setting: "work",
      text: "Walk through how you'd improve your team's meetings. 15 seconds in: \"Every team thinks their meetings are the problem. What's the actual waste?\" Stay sharp.",
    },
    {
      id: "clarifying_interrupt_007",
      setting: "work",
      text: "Explain why your hiring bar should stay high. 15 seconds in: \"That's what every team says right before they miss their goals.\" Hold the line.",
    },
    {
      id: "clarifying_interrupt_008",
      setting: "work",
      text: "Describe how you'd recover a stalled deal. 15 seconds in the customer says: \"Honestly, I think you're just trying to save the commission.\" Respond without defensiveness.",
    },
    {
      id: "clarifying_interrupt_009",
      setting: "work",
      text: "Walk through how you'd debug a slow service. 15 seconds in: \"You're describing what a junior would do — what's your actual instinct?\" Respond.",
    },
    {
      id: "clarifying_interrupt_010",
      setting: "work",
      text: "Explain a roadmap. 15 seconds in your CEO interrupts: \"Why is none of this aimed at the thing that's broken right now?\" Land it.",
    },
    {
      id: "clarifying_interrupt_011",
      setting: "work",
      text: "Walk a customer through your product. 15 seconds in: \"This sounds like every other tool in this space.\" Differentiate without hedging.",
    },
    {
      id: "clarifying_interrupt_012",
      setting: "work",
      text: "Describe how you'd handle a layoff conversation. 15 seconds in: \"You're sounding like an HR script — what would you actually say?\" Respond.",
    },
    {
      id: "clarifying_interrupt_013",
      setting: "work",
      text: "Explain a hiring decision. 15 seconds in a peer says: \"That's not a fit reason, that's a feel reason.\" Recover.",
    },
    {
      id: "clarifying_interrupt_014",
      setting: "work",
      text: "Walk through your strategy for next year. 15 seconds in: \"This sounds like last year's deck with the dates changed.\" Respond.",
    },
    {
      id: "clarifying_interrupt_015",
      setting: "work",
      text: "Pitch your team's headcount ask. 15 seconds in finance says: \"Show me the headcount that already isn't producing.\" Stay specific.",
    },
    {
      id: "clarifying_interrupt_016",
      setting: "work",
      text: "Describe your hiring bar. 15 seconds in: \"Then why did you hire X?\" Respond honestly.",
    },
    {
      id: "clarifying_interrupt_017",
      setting: "work",
      text: "Walk through a postmortem. 15 seconds in: \"You keep saying 'we' — what specifically did YOU miss?\" Land it.",
    },
    {
      id: "clarifying_interrupt_018",
      setting: "work",
      text: "Explain a pricing decision. 15 seconds in the CEO interrupts: \"That's the kind of math that gets a company killed.\" Respond.",
    },
    {
      id: "clarifying_interrupt_019",
      setting: "work",
      text: "Pitch a new initiative. 15 seconds in your VP: \"What evidence do you have this works at our scale?\" Respond.",
    },
    {
      id: "clarifying_interrupt_020",
      setting: "work",
      text: "Describe your interview rubric. 15 seconds in: \"That's how you justify any hire you want.\" Hold the line.",
    },
    {
      id: "clarifying_interrupt_021",
      setting: "work",
      text: "Walk a customer through a security incident. 15 seconds in: \"Stop. What data was actually exposed?\" Be direct.",
    },
    {
      id: "clarifying_interrupt_022",
      setting: "work",
      text: "Pitch a strategy shift. 15 seconds in a peer says: \"You're solving for the symptom, not the cause.\" Respond.",
    },
    {
      id: "clarifying_interrupt_023",
      setting: "work",
      text: "Explain why you're keeping a struggling product line. 15 seconds in your board: \"You're emotionally attached.\" Hold your case.",
    },
    {
      id: "clarifying_interrupt_024",
      setting: "work",
      text: "Walk through how you'd ramp a new hire. 15 seconds in: \"That's the same plan you used for the last hire who didn't work out.\" Respond.",
    },
    {
      id: "clarifying_interrupt_025",
      setting: "personal",
      text: "Explain why you're putting off the doctor's appointment. 15 seconds in your partner: \"That sounds like fear talking.\" Respond honestly.",
    },
    {
      id: "clarifying_interrupt_026",
      setting: "personal",
      text: "Describe your retirement plan. 15 seconds in your spouse: \"That assumes nothing goes wrong, ever.\" Respond.",
    },
    {
      id: "clarifying_interrupt_027",
      setting: "personal",
      text: "Walk through a parenting decision. 15 seconds in: \"You're parenting from your own childhood, not theirs.\" Stay open.",
    },
    {
      id: "clarifying_interrupt_028",
      setting: "personal",
      text: "Explain why you want to move. 15 seconds in your partner: \"That sounds like running, not pursuing.\" Respond.",
    },
    {
      id: "clarifying_interrupt_029",
      setting: "personal",
      text: "Talk through a friendship that's struggling. 15 seconds in: \"You keep blaming them — what's your part?\" Respond honestly.",
    },
    {
      id: "clarifying_interrupt_030",
      setting: "personal",
      text: "Explain a budgeting plan. 15 seconds in your spouse: \"That's not budgeting, that's restriction.\" Respond.",
    },
    {
      id: "clarifying_interrupt_031",
      setting: "personal",
      text: "Walk through how you're handling a family conflict. 15 seconds in: \"You're not being honest about what you actually want.\" Respond.",
    },
    {
      id: "clarifying_interrupt_032",
      setting: "personal",
      text: "Describe your career plan to your partner. 15 seconds in: \"That doesn't include any of what we agreed about kids.\" Respond.",
    },
    {
      id: "clarifying_interrupt_033",
      setting: "public",
      text: "On a panel about your work, 15 seconds in a co-panelist says: \"That sounds great in theory.\" Respond with specifics.",
    },
    {
      id: "clarifying_interrupt_034",
      setting: "public",
      text: "On a podcast, 15 seconds into your story the host: \"Wait, that's not how I heard it from someone else.\" Respond.",
    },
    {
      id: "clarifying_interrupt_035",
      setting: "public",
      text: "In a press interview, 15 seconds in the reporter: \"You're using the same talking points your competitor uses.\" Respond.",
    },
    {
      id: "clarifying_interrupt_036",
      setting: "public",
      text: "On stage, 15 seconds into your pitch a heckler: \"This is a solution looking for a problem.\" Hold composure.",
    },
    {
      id: "clarifying_interrupt_037",
      setting: "public",
      text: "In a Q&A about your book, 15 seconds in: \"You're contradicting what you said in chapter three.\" Respond.",
    },
    {
      id: "clarifying_interrupt_038",
      setting: "public",
      text: "On a live interview, 15 seconds in the host: \"What you just said sounds like you're dodging the question.\" Respond directly.",
    },
    {
      id: "clarifying_interrupt_039",
      setting: "public",
      text: "On a panel about industry ethics, 15 seconds in: \"That's the convenient answer — what's the honest one?\" Respond.",
    },
    {
      id: "clarifying_interrupt_040",
      setting: "public",
      text: "In a media appearance, 15 seconds in: \"That's a deflection. The question was about you, not your team.\" Respond.",
    },
  ],

  // ——— Stakes Raise ——————————————————————————————————————————
  // Normal mechanics, high-stakes framing. The test is composure +
  // delivery when the prompt names a real consequence. Scores weight
  // confidence and delivery heavily — did you sound like you believed
  // what you said when it mattered?
  stakes_raise: [
    {
      id: "stakes_raise_001",
      setting: "public",
      text: "This is the interview question that decides the offer: \"Tell me about a time you failed.\" 45 seconds. Start when you're ready.",
    },
    {
      id: "stakes_raise_002",
      setting: "work",
      text: "The board is deciding whether to fund another year. They ask: \"In one minute, tell us why you're the right CEO for what's coming next.\" 60 seconds.",
    },
    {
      id: "stakes_raise_003",
      setting: "work",
      text: "Your largest customer is on the call. They say: \"Give me one reason not to churn.\" 30 seconds. Go.",
    },
    {
      id: "stakes_raise_004",
      setting: "work",
      text: "You're up for a promotion. The VP asks: \"What's the biggest risk you see with you in this role?\" 45 seconds — honest answer, composed delivery.",
    },
    {
      id: "stakes_raise_005",
      setting: "personal",
      text: "You're about to ask your partner to move cities with you for this opportunity. You have 60 seconds to tell them why it's worth it.",
    },
    {
      id: "stakes_raise_006",
      setting: "work",
      text: "The CEO calls you into their office: \"The layoffs list has your team on it. Convince me otherwise.\" 45 seconds.",
    },
    {
      id: "stakes_raise_007",
      setting: "public",
      text: "You're meeting the investor who could take this company to the next stage. They ask: \"What's the thing you're most afraid of?\" 30 seconds — real answer.",
    },
    {
      id: "stakes_raise_008",
      setting: "work",
      text: "Your team of six is in the room. Morale is low after a bad quarter. You have one minute to say what you actually believe about the next one. 60 seconds.",
    },
    {
      id: "stakes_raise_009",
      setting: "work",
      text: "The acquisition meeting starts in 60 seconds. The buyer asks: \"Why is this the right time to sell?\" 45 seconds. Be honest.",
    },
    {
      id: "stakes_raise_010",
      setting: "work",
      text: "Your VC is wavering on the next round. They ask: \"What gives you conviction this works?\" 45 seconds.",
    },
    {
      id: "stakes_raise_011",
      setting: "work",
      text: "You're the senior leader the team trusts most. Layoffs were just announced. You have 60 seconds to address everyone — what do you say first?",
    },
    {
      id: "stakes_raise_012",
      setting: "work",
      text: "The customer is on the call to renew or walk. They ask: \"Why have we paid you this much for so little?\" 45 seconds.",
    },
    {
      id: "stakes_raise_013",
      setting: "work",
      text: "You're in the final round of the executive promotion. The CEO asks: \"What do you think this company is actually missing?\" 60 seconds.",
    },
    {
      id: "stakes_raise_014",
      setting: "work",
      text: "Your largest customer's CFO asks: \"Why aren't your numbers public?\" You have 45 seconds. Don't lose them.",
    },
    {
      id: "stakes_raise_015",
      setting: "work",
      text: "The post-mortem starts now. The room knows you signed off on the bad call. The first question: \"Walk us through what you saw.\" 60 seconds.",
    },
    {
      id: "stakes_raise_016",
      setting: "work",
      text: "You're presenting your 2-year plan to the board today. The chair: \"In one minute — convince me this isn't optimism.\" 60 seconds.",
    },
    {
      id: "stakes_raise_017",
      setting: "work",
      text: "Your direct report is leaving — your second this quarter. The remaining team is watching to see if you can keep them. 60 seconds. Speak.",
    },
    {
      id: "stakes_raise_018",
      setting: "work",
      text: "The investor passes the phone: \"Convince my partner — 30 seconds — that we should still write the check.\" Go.",
    },
    {
      id: "stakes_raise_019",
      setting: "work",
      text: "The board chair: \"In 45 seconds, tell me whether the company should keep the founder.\" The founder is in the room.",
    },
    {
      id: "stakes_raise_020",
      setting: "work",
      text: "You just got the verdict that your favorite project is being killed. The team meeting starts now. 60 seconds — what do you say?",
    },
    {
      id: "stakes_raise_021",
      setting: "work",
      text: "Your replacement starts Monday. The handover meeting is now. 60 seconds to set them up to win — go.",
    },
    {
      id: "stakes_raise_022",
      setting: "work",
      text: "Your most important customer threatens to leave. They say: \"Tell me one thing that isn't in your last email that I need to hear.\" 30 seconds.",
    },
    {
      id: "stakes_raise_023",
      setting: "work",
      text: "The CEO calls you in: \"I'm hearing two very different stories about what your team did. Tell me yours.\" 45 seconds.",
    },
    {
      id: "stakes_raise_024",
      setting: "work",
      text: "You're being terminated. The CEO says: \"Tell me what you wish you'd done differently.\" 60 seconds. Real answer.",
    },
    {
      id: "stakes_raise_025",
      setting: "public",
      text: "It's the live press conference about the incident. The first question: \"What did you know and when?\" 45 seconds. Direct answer.",
    },
    {
      id: "stakes_raise_026",
      setting: "public",
      text: "You're on a national podcast for the first time. Host: \"What's the strongest thing you believe that most people would disagree with?\" 60 seconds.",
    },
    {
      id: "stakes_raise_027",
      setting: "public",
      text: "Final round of the speech competition. The judge: \"In 60 seconds — why does what you do matter to a stranger?\" Go.",
    },
    {
      id: "stakes_raise_028",
      setting: "public",
      text: "A reporter asks at a press conference: \"Did you know about the safety report?\" 30 seconds. The whole company is watching.",
    },
    {
      id: "stakes_raise_029",
      setting: "public",
      text: "You're testifying. The committee chair: \"In 60 seconds — explain to the country why this matters.\" Speak.",
    },
    {
      id: "stakes_raise_030",
      setting: "public",
      text: "You're at a public memorial. The family asks you to speak about the person. 60 seconds. Don't break.",
    },
    {
      id: "stakes_raise_031",
      setting: "public",
      text: "On the speaking circuit's biggest stage. The intro just landed. 60 seconds to set up the talk you've been preparing for years.",
    },
    {
      id: "stakes_raise_032",
      setting: "public",
      text: "The audience is hostile. The moderator: \"Convince this room that your work is honest.\" 60 seconds.",
    },
    {
      id: "stakes_raise_033",
      setting: "personal",
      text: "Your kid asks at the dinner table: \"Why did mom and dad split up?\" 45 seconds. They deserve the truth.",
    },
    {
      id: "stakes_raise_034",
      setting: "personal",
      text: "Your aging parent: \"What do you actually think I should do about the house?\" You have 60 seconds — they're choosing tonight.",
    },
    {
      id: "stakes_raise_035",
      setting: "personal",
      text: "Your partner of ten years: \"Tell me — in 60 seconds — what's been making you so distant for the last six months.\" Real answer.",
    },
    {
      id: "stakes_raise_036",
      setting: "personal",
      text: "Your closest friend is sick. They ask: \"What do you think I should do?\" 45 seconds. Be honest.",
    },
    {
      id: "stakes_raise_037",
      setting: "personal",
      text: "Your spouse: \"Tell me why you came back.\" 60 seconds. The marriage hangs on the answer.",
    },
    {
      id: "stakes_raise_038",
      setting: "personal",
      text: "Your teenager: \"Why should I trust your judgment on this?\" 45 seconds. You have one shot.",
    },
    {
      id: "stakes_raise_039",
      setting: "personal",
      text: "You're at your father's funeral. You weren't going to speak — but the family is looking at you. 60 seconds. Go.",
    },
    {
      id: "stakes_raise_040",
      setting: "personal",
      text: "Your sibling, after years of silence: \"What would it take for you to forgive me?\" 60 seconds. Real answer.",
    },
  ],
} as const;

/**
 * Stratified sampling helper for pressure prompts. Round-robins across
 * present settings (work / public / personal) before doubling up so the
 * picker doesn't dump 5 workplace prompts on a user with a personal-life
 * vertical.
 */
function pickStratifiedBySetting(
  bank: readonly PressurePrompt[],
  count: number,
  rand: () => number = Math.random,
): PressurePrompt[] {
  if (bank.length === 0 || count <= 0) return [];

  const buckets: Record<PressureSetting, PressurePrompt[]> = {
    work: [],
    public: [],
    personal: [],
  };
  for (const p of bank) buckets[p.setting].push(p);

  const shuffle = (arr: PressurePrompt[]): PressurePrompt[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  };
  const ordered: Record<PressureSetting, PressurePrompt[]> = {
    work: shuffle(buckets.work),
    public: shuffle(buckets.public),
    personal: shuffle(buckets.personal),
  };

  const presentSettings = (
    Object.keys(ordered) as PressureSetting[]
  ).filter((s) => ordered[s].length > 0);
  // Shuffle the order in which we visit settings each call.
  const settingOrder = [...presentSettings];
  for (let i = settingOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [settingOrder[i], settingOrder[j]] = [settingOrder[j]!, settingOrder[i]!];
  }

  const picked: PressurePrompt[] = [];
  while (picked.length < count) {
    let advanced = false;
    for (const s of settingOrder) {
      if (picked.length >= count) break;
      const next = ordered[s].shift();
      if (next) {
        picked.push(next);
        advanced = true;
      }
    }
    if (!advanced) break;
  }
  return picked;
}

/** O(1) id → prompt lookup, built once at module load. */
const PRESSURE_PROMPT_INDEX: ReadonlyMap<string, PressurePrompt> = (() => {
  const map = new Map<string, PressurePrompt>();
  for (const bank of Object.values(PRESSURE_PROMPTS)) {
    for (const p of bank) map.set(p.id, p);
  }
  return map;
})();

/** Look up a single pressure prompt object by id. */
export function getPressurePromptById(id: string): PressurePrompt | undefined {
  return PRESSURE_PROMPT_INDEX.get(id);
}

/** Setting of a pressure prompt id, for picker stratification. */
export function getPressurePromptSetting(
  id: string,
): PressureSetting | undefined {
  return PRESSURE_PROMPT_INDEX.get(id)?.setting;
}

/**
 * Pick a random prompt from a pressure archetype's bank.
 *
 * Accepts an optional `rand` function for deterministic testing.
 */
export function pickPressurePrompt(
  archetypeId: PressureArchetypeId,
  opts: { rand?: () => number } = {},
): string {
  const { rand = Math.random } = opts;
  const bank = PRESSURE_PROMPTS[archetypeId];
  const idx = Math.floor(rand() * bank.length);
  return bank[idx]?.text ?? bank[0]!.text;
}

/**
 * Pick N prompt objects from an archetype's bank, stratified across
 * `setting` so a single slate always shows variety across work / public /
 * personal when the bank has multiple settings. Object form preserves
 * stable ids for the per-user history filter.
 *
 * `excludeIds` filters out prompts the user has already seen across
 * sessions. Falls back to the seen pool when filtering empties the bank.
 */
export function pickPressurePromptObjects(
  archetypeId: PressureArchetypeId,
  count: number,
  opts: { rand?: () => number; excludeIds?: ReadonlySet<string> } = {},
): PressurePrompt[] {
  const { rand = Math.random, excludeIds } = opts;
  const bank = PRESSURE_PROMPTS[archetypeId];

  if (!excludeIds || excludeIds.size === 0) {
    return pickStratifiedBySetting(bank, count, rand);
  }

  const unseen = bank.filter((p) => !excludeIds.has(p.id));
  const pool = unseen.length > 0 ? unseen : bank;
  const picks = pickStratifiedBySetting(pool, count, rand);

  if (picks.length < count && pool === unseen && unseen.length < bank.length) {
    const seen = bank.filter((p) => excludeIds.has(p.id));
    const extras = pickStratifiedBySetting(seen, count - picks.length, rand);
    return [...picks, ...extras];
  }
  return picks;
}

/** Text-returning picker — thin wrapper for callers that don't need ids. */
export function pickPressurePrompts(
  archetypeId: PressureArchetypeId,
  count: number,
  opts: { rand?: () => number; excludeIds?: ReadonlySet<string> } = {},
): string[] {
  return pickPressurePromptObjects(archetypeId, count, opts).map((p) => p.text);
}
