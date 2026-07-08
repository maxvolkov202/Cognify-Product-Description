/**
 * Phase E (#12) — pre-rep skill scenarios.
 *
 * For each of the 6 training dimensions, 10 short real-life scenarios
 * where that skill matters. Shown to the user the first time they
 * encounter a workout for that dimension. Anchors *why* the rep
 * matters before they practice it.
 *
 * Generic — usable across all 8 verticals. We tag scenarios with
 * vertical-flavored vocabulary sparingly so the bank reads as universal
 * but not bland. ("Crisis call at 9 pm" reads sales-ish; "Patient asks
 * about lab results" reads clinical; that's fine — the user lives in
 * a vertical and identifies with the closest scenario.)
 *
 * Surface: SkillScenariosCard component mounts on the workout start
 * card the first time the user lands on a dim. Once dismissed, it
 * collapses to a "Why this skill?" link the user can re-open.
 *
 * Tracking: localStorage `cognify.scenarios-seen.<dim>` = "1" once shown.
 */

import type { MuscleGroupId } from "@/types/domain";

export type SkillScenario = {
  /** Punchy 1-line scene-setter. */
  title: string;
  /** 1-2 sentence "what's at stake" body. */
  body: string;
};

export const SKILL_SCENARIOS: Record<MuscleGroupId, SkillScenario[]> = {
  clarity: [
    {
      title: "30-second elevator pitch",
      body: "Someone asks what you do, and you only have one floor to answer.",
    },
    {
      title: "Explaining a decision to your boss",
      body: "They want to know why you did it, not what you did. The reason has to land in one sentence.",
    },
    {
      title: "Telling a kid what your job is",
      body: "No jargon. No qualifiers. Just the thing — in words a 10-year-old already knows.",
    },
    {
      title: "Hallway question from someone senior",
      body: "They stopped you to ask something specific. The right answer is plain English, no hedging.",
    },
    {
      title: "Status update on a stuck project",
      body: "Three people just asked you why the timeline slipped. The honest one-line answer is what they need.",
    },
    {
      title: "Defining the problem before solving it",
      body: "Your team's been going in circles. If you can name what's actually wrong, the meeting ends in 5 minutes.",
    },
    {
      title: "Onboarding the new hire",
      body: "They're getting a firehose of context. Clear explanations now save them weeks of confusion later.",
    },
    {
      title: "Telling a friend about your week",
      body: "They want the gist, not the play-by-play. The good story leads with the point.",
    },
    {
      title: "Explaining a charge on someone's bill",
      body: "They're frustrated and confused. Clarity is how you turn that into understanding.",
    },
    {
      title: "Pitching an idea you've thought about for months",
      body: "You know it cold. The challenge is saying it in 60 seconds without losing the magic.",
    },
  ],

  structure: [
    {
      title: "Update to leadership with three slides",
      body: "You have one breath per slide. Each one needs to do its own job, in order.",
    },
    {
      title: "Phone call to a parent or partner",
      body: "You're delivering news with a beginning, a middle, and a recommendation. Skipping the middle leaves them anxious.",
    },
    {
      title: "Recap of a meeting in Slack",
      body: "What happened, what we decided, what's next. Three beats. People who didn't attend should still get it.",
    },
    {
      title: "Defending a choice to a skeptic",
      body: "Lead with the conclusion. Then the strongest reason. Then the counter you considered.",
    },
    {
      title: "Walking through a process",
      body: "Step one before step two before step three. Skipping order makes the listener feel lost.",
    },
    {
      title: "Telling a story at dinner",
      body: "The good ones have a setup, a turn, and a payoff. The forgettable ones are just events strung together.",
    },
    {
      title: "Asking for help",
      body: "Context, ask, why. Three pieces. Missing any one makes the request feel either vague or pushy.",
    },
    {
      title: "Giving a tour of something complex",
      body: "Big picture first, then zoom in. Going the other direction is how you lose people in the first 30 seconds.",
    },
    {
      title: "Pitching a problem before the solution",
      body: "Frame the pain first. Then the fix. Solutions without context sound like answers to questions no one asked.",
    },
    {
      title: "Closing a presentation",
      body: "Recap, takeaway, next step. The end is where most people forget to land — and what the audience remembers.",
    },
  ],

  conciseness: [
    {
      title: "Asked for a quick yes-or-no",
      body: "Anything beyond yes-and-here's-why erodes trust. Brevity is the answer.",
    },
    {
      title: "Last 30 seconds of a meeting",
      body: "Someone needs the action item, not the recap. Cut every word that isn't pulling weight.",
    },
    {
      title: "Voicemail you don't want to leave",
      body: "Inbox depth is a feature for the listener. Three lines or it gets skipped.",
    },
    {
      title: "Texting your boss something urgent",
      body: "They'll read it on their phone in 2 seconds. Tight or it gets misread.",
    },
    {
      title: "Headline for a doc no one will read",
      body: "Most of them won't open it. The first 10 words are the message.",
    },
    {
      title: "Stand-up update with the rest of the team waiting",
      body: "What you did. What you're doing. What's blocking. Anything else steals their time.",
    },
    {
      title: "Explaining why you're late",
      body: "No one wants the story. The reason in one breath, then move on.",
    },
    {
      title: "Pitching in a noisy room",
      body: "You're going to get interrupted. Make sure the first sentence is the whole thing.",
    },
    {
      title: "Editing your own email before sending",
      body: "Every line that isn't earning its place should come out. Most emails get tighter after a 30% cut.",
    },
    {
      title: "Boiling down a 90-minute meeting",
      body: "Someone asks how it went. The honest answer is two sentences — find them.",
    },
  ],

  thinking_quality: [
    {
      title: "Asked something you've never thought about",
      body: "No prep, no notes. The quality of your real-time reasoning is on display.",
    },
    {
      title: "Defending a claim against a skeptic",
      body: "They want evidence, not opinion. The thinking that backs your position has to be sound and visible.",
    },
    {
      title: "Walking through how you'd solve a problem",
      body: "The interviewer doesn't care about the answer — they care about how you got there.",
    },
    {
      title: "Steel-manning someone you disagree with",
      body: "Making their best case before responding is the difference between a debate and a real argument.",
    },
    {
      title: "Spotting the hidden assumption",
      body: "Every plan has one. Naming it before someone else does saves the meeting from going sideways.",
    },
    {
      title: "Connecting two things no one else has",
      body: "The insight nobody saw is what gets remembered. It comes from thinking, not knowing.",
    },
    {
      title: "Being asked 'what would change your mind?'",
      body: "If you can't answer, you weren't reasoning — you were rehearsing. A real answer earns trust.",
    },
    {
      title: "Justifying a number off the top of your head",
      body: "Someone asks how big the market is. You don't know — but you can think out loud and arrive at a defensible range.",
    },
    {
      title: "Disagreeing with a senior person",
      body: "The reasoning has to be airtight. Vibes get dismissed; logic gets a hearing.",
    },
    {
      title: "Catching a mistake before it ships",
      body: "Something feels off. Articulating WHY, in real time, is what stops a costly call.",
    },
  ],

  pacing: [
    {
      title: "Holding a room with your answer",
      body: "Rushing kills authority. The pause before the key sentence makes people lean in.",
    },
    {
      title: "Telling a hard truth",
      body: "Speed makes it feel rehearsed; pauses make it feel real. The space around the words matters.",
    },
    {
      title: "Closing a deal or making an ask",
      body: "After you say the number, say nothing. Whoever speaks first usually loses.",
    },
    {
      title: "Speaking when you're nervous",
      body: "Nerves push speed. Pacing pulls it back. Same content, very different impact.",
    },
    {
      title: "Letting silence do work",
      body: "Not every answer needs filler. Sometimes a beat says more than three more sentences would.",
    },
    {
      title: "Recovering from a stumble",
      body: "Talking faster digs you deeper. A pause + reset reads as confidence, not cover.",
    },
    {
      title: "Holding attention in a long meeting",
      body: "The voice that varies its pace gets listened to. The one that doesn't fades into the background.",
    },
    {
      title: "Landing a punchline",
      body: "A beat before, a beat after. Comedians know this. So do good presenters.",
    },
    {
      title: "Giving someone news they don't want",
      body: "Rushing past it makes it worse. Pacing communicates that you took it seriously too.",
    },
    {
      title: "Owning the room when stakes are high",
      body: "Slow down, speak intentionally, and you sound like the person in charge — even when you don't feel like it.",
    },
  ],

  tone: [
    {
      title: "Pushing back without being a jerk",
      body: "Same words, different tone — and you either build the relationship or burn it.",
    },
    {
      title: "Delivering feedback that's hard to hear",
      body: "Warmth makes the criticism land instead of bouncing. Tone is half the message.",
    },
    {
      title: "Handling a frustrated customer",
      body: "Their tone is hot. Yours has to be steady. The contrast does most of the work.",
    },
    {
      title: "Asking for a raise",
      body: "Apologetic kills your case. Confident-but-warm makes it harder to say no.",
    },
    {
      title: "Calming someone down",
      body: "Match their energy and you escalate. Drop yours one notch and they follow.",
    },
    {
      title: "Reading the room mid-sentence",
      body: "Sometimes the joke isn't landing. Switching tone halfway through is a skill — and it's noticed.",
    },
    {
      title: "Talking to someone going through something hard",
      body: "Words matter less than tone. Soft, slow, present — that's what they actually need.",
    },
    {
      title: "Sounding sure when you're not",
      body: "Authority is a tone, not a certainty. The audience picks up the wobble before the words.",
    },
    {
      title: "Switching from intellectual to emotional",
      body: "The first half is analysis; the second half is the truth. Same person, different register.",
    },
    {
      title: "Closing a conversation warmly",
      body: "Goodbyes set the next interaction. Cold goodbye, cold next meeting. Warm goodbye, easy reopen.",
    },
  ],
};

/** Get the localStorage key that tracks whether a dim's scenarios have
 *  been shown to this user. Used by SkillScenariosCard. */
export function scenariosSeenKey(dim: MuscleGroupId): string {
  return `cognify.scenarios-seen.${dim}`;
}
