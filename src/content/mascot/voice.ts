// Phase 13 — mascot voice file. Single source of truth for every
// user-facing string from the muscle-group Workout flow.
//
// Voice rules (locked from the design brief + Max's 10 approved samples
// at plans/muscle-group-pivot-design-brief.md appendix):
//   - ≤12 words per bubble.
//   - Specific, not vague. "Tighten your first 5 words" beats "Work
//     on your opening."
//   - Dry-witted, never saccharine. No exclamation marks except for
//     the rare genuine surprise.
//   - No "Good try", "Almost", "Don't worry", "Great job".
//   - First name (`{firstName}`) sparingly — about 1-in-5 lines.
//   - Dim names capitalized: Clarity / Structure / Conciseness /
//     Thinking Quality / Pacing / Tone.
//
// Every bucket has ≥4 variants. High-frequency buckets (walkingComments
// and scoreReactions) have ≥8 so the variation pool doesn't repeat
// within a session. Picker (pick.ts) handles per-(user, date, bucket)
// seeded selection.

import type {
  DeltaBand,
  ErrorReason,
  RepFeelBucket,
  ScoreBandKey,
  TimeOfDay,
} from "./types";

// ─── 1. idleGreeting — fired on first mount per day ─────────────────────

export const idleGreeting: Record<TimeOfDay, string[]> = {
  morning: [
    "Morning. Headband's on. Let's go.",
    "Morning. The work compounds. Show up.",
    "First rep of the day. Eyes open.",
    "Morning, {firstName}. Fresh tape, clean mind.",
    "Stretch. Pick a prompt. Speak.",
  ],
  afternoon: [
    "Afternoon shift. Let's tighten things up.",
    "Mid-day rep. Sharpest minute of your hour.",
    "Pick one. Start clean.",
    "Eight minutes from now you'll be glad you did this.",
  ],
  evening: [
    "Evening session. Slow your tempo, keep your edge.",
    "End-of-day rep. Earn the close.",
    "One last rep, one last point. Land it.",
    "Quiet hour. Use it.",
  ],
  "late-night": [
    "Up late. Keep it short, keep it clean.",
    "Brain's tired — go slower, not louder.",
    "Quick one. We'll do better tomorrow.",
    "Compound the days you don't feel like it.",
  ],
};

// ─── 2. walkingComments — between stations, post-rep ────────────────────

export const walkingComments: Record<RepFeelBucket, string[]> = {
  neutral: [
    "Walking it off.",
    "Next station's a different shape.",
    "Resetting between reps.",
    "On to the next.",
    "Reframe. Breathe. Speak.",
    "Pause. Then go.",
    "Find the rhythm again.",
    "Different drill, same focus.",
  ],
  "strong-rep": [
    "That landed. Walking it off.",
    "Clean. Don't get cocky.",
    "Felt it. Carry the tempo over.",
    "Locked in. Next one's harder.",
    "Strong. Don't ease up.",
    "Compounding works. Keep going.",
    "That's the rep. Reset.",
    "Confidence earned. Don't burn it.",
  ],
  "weak-rep": [
    "Reset. Next station's a different shape.",
    "Rough one. File and move.",
    "That happens. Lower the pace next rep.",
    "Shake it off. The data still counts.",
    "Don't carry it. Different drill now.",
    "Weak rep, real signal. Use it.",
    "Wider stance. Slower start.",
    "Drop the autopilot. Reset.",
  ],
};

// ─── 3. atStationIntro — keyed by exercise slug ─────────────────────────
//
// Lines fire as the mascot arrives at a station. Each exercise has
// 3-5 short, specific lines. Unknown slugs fall back to GENERIC.

export const atStationIntroGeneric: string[] = [
  "Read the rule. Then start.",
  "Pick a prompt. Speak the rule.",
  "Constraint first. Content second.",
  "The rule's the muscle. Hit it.",
];

export const atStationIntro: Record<string, string[]> = {
  "explain-like-im-12": [
    "Explain Like I'm 12 — no insider words.",
    "Plain language only. No domain glow-up.",
    "Twelve-year-old listener. Talk to them.",
  ],
  "headline-first": [
    "Headline First — bury the lede and we're done.",
    "Sentence one carries the point. Or it doesn't.",
    "Lead with the punch. Build the case after.",
  ],
  "the-analogy-bridge": [
    "Analogy Bridge — find the everyday hook.",
    "Pick one tangible thing. Hang the idea on it.",
    "If your aunt gets it, you've got it.",
  ],
  "no-jargon-allowed": [
    "No Jargon Allowed — translate, don't parrot.",
    "Catch yourself. Reword in real time.",
    "Domain words off-limits. Speak around them.",
  ],
  "make-it-real": [
    "Make It Real — concrete after every claim.",
    "Abstract is a flag. Plant a specific.",
    "Name the thing. Then move on.",
  ],
  "one-point-only": [
    "One Point Only — pick one. Serve it.",
    "Three ideas is two too many. Choose.",
    "One thesis. Everything bows to it.",
  ],
  "answer-the-confusion": [
    "Answer the Confusion — name the question first.",
    "What would a confused listener ask? Answer that.",
    "Two seconds: model their question. Then resolve.",
  ],
  "prove-it": [
    "Prove It — claim and evidence in one breath.",
    "Every assertion buys itself with proof.",
    "Don't ship a claim alone. Cite as you go.",
  ],
  "the-word-budget": [
    "Word Budget — 30 words. Make them load-bearing.",
    "Thirty words. Cut the rest before you speak.",
    "Budget's tight. Every word earns a slot.",
  ],
  "the-3-point-rule": [
    "3 Point Rule — exactly three. No more, no less.",
    "Three points. Choose hard. Defend each.",
    "Three legs hold the stool. Don't add a fourth.",
  ],
  "bottom-line-first": [
    "Bottom Line First — conclusion in sentence one.",
    "Lead with the verdict. Justify after.",
    "Open with the answer. Earn it backwards.",
  ],
  "kill-the-filler": [
    "Kill the Filler — every um restarts the rep.",
    "Silence over filler. The pause is the rep.",
    "Fillers off. Breath in, words out, repeat.",
  ],
  "the-30-second-rule": [
    "30-Second Rule — start the timer. Make the point.",
    "Thirty seconds. Land the point inside it.",
    "Half a minute. Whole idea.",
  ],
  "no-hedging": [
    "No Hedging — commit or cut.",
    "No 'kinda', 'maybe', 'sort of'. Take the stance.",
    "Hedges leak conviction. Drop them.",
  ],
  "the-single-sentence": [
    "Single Sentence — one period only.",
    "One sentence. One thought. One ending.",
    "Whole answer, one sentence. Cut from there.",
  ],
  "the-claim-and-proof": [
    "Claim and Proof — pair them in one breath.",
    "Don't ship a claim naked. Carry the evidence.",
    "Assertion plus reason. Same sentence.",
  ],
  "the-steel-man": [
    "Steel Man — argue the strongest opposing view.",
    "Best version of the other side. Then your own.",
    "Take the smartest objection seriously first.",
  ],
  "the-so-what-test": [
    "So-What Test — every point earns its stakes.",
    "After each beat, answer 'so what'.",
    "If it doesn't change a decision, cut it.",
  ],
  "strategic-pause": [
    "Strategic Pause — silence between beats.",
    "Beat. Pause. Beat. Trust the gap.",
    "One pause per claim. Let it land.",
  ],
  "silence-over-filler": [
    "Silence Over Filler — uncomfortable is the point.",
    "Replace every um with a beat of nothing.",
    "Silence first. Words after.",
  ],
  "beat-the-buzzer": [
    "Beat the Buzzer — 45-second window.",
    "Forty-five seconds. Use them all.",
    "Land inside the window. Not before, not after.",
  ],
  "the-monotone-breaker": [
    "Monotone Breaker — every sentence shifts pitch.",
    "Variance is the signal. Move the voice.",
    "Don't drone. Step the pitch up or down.",
  ],
  "downward-landing": [
    "Downward Landing — fall, don't rise.",
    "End every statement on the floor of your voice.",
    "Statements land. Questions rise. Pick one.",
  ],
  "authority-voice": [
    "Authority Voice — drop pitch on every claim.",
    "Floor under the voice. Not the ceiling.",
    "Conviction lives low. Stay there.",
  ],
};

// ─── 4. scoreReactions — 5 bands × 2 contexts ───────────────────────────

export const scoreReactions: Record<
  ScoreBandKey,
  { firstOfDay: string[]; lateInDay: string[] }
> = {
  poor: {
    firstOfDay: [
      "Rough opener. Data still counts.",
      "Cold start. Adjust. Try the next one.",
      "Tape's running. That's a baseline, not a verdict.",
      "Slow start. The next rep doesn't care.",
    ],
    lateInDay: [
      "Rough one. Filed under research, not failure.",
      "Off-rep. Walk it off. Reset before the next.",
      "Energy dipped. Slow the next one down.",
      "Tired voice. Recover with a beat of silence.",
    ],
  },
  below: {
    firstOfDay: [
      "Below your line. Tighten the next.",
      "Decent draft. Cut the warm-up sentences.",
      "There's a point in there. Bury it less.",
      "Coming. Pick one idea next rep.",
    ],
    lateInDay: [
      "Below your line. End on the upswing.",
      "Tired but useable. Tighten the close.",
      "Reset. One thought next rep.",
      "Honest take: you've got one tight rep left in you.",
    ],
  },
  ok: {
    firstOfDay: [
      "Solid floor. Now push the ceiling.",
      "Working. Sharpen the first 10 seconds.",
      "On the line. Push past it.",
      "OK rep. Now make me notice the next one.",
    ],
    lateInDay: [
      "Solid. Don't cruise — finish loud.",
      "Holding the line. Climb one more.",
      "OK. One more push.",
      "Floor's still solid. Reach.",
    ],
  },
  strong: {
    firstOfDay: [
      "Strong. Now reproduce it.",
      "That's the line. Walk the next one over it.",
      "Real rep. Don't change a thing.",
      "Tight first answer. Repeatable?",
    ],
    lateInDay: [
      "Strong close. Keep this tempo.",
      "Earned. Don't ease off.",
      "Late-day strong is real. Lock it in.",
      "End on this rep. Earned.",
    ],
  },
  excellent: {
    firstOfDay: [
      "Clean. That's the rep, {firstName}.",
      "Top of the range. Don't get tense.",
      "Sharp opener. Carry it.",
      "Best version of you on tape today. Repeat it.",
    ],
    lateInDay: [
      "Clean close.",
      "Top rep. Bank it.",
      "Excellent. Walk it off proud.",
      "That's the tape we keep.",
    ],
  },
};

// ─── 5. dayCompleteCelebrations — bucketed by delta band ────────────────

export const dayCompleteCelebrations: Record<DeltaBand, string[]> = {
  "first-ever": [
    "First day in. Baseline locked.",
    "First rep through the door. Tape starts here.",
    "Day one's on file. Next rotation, beat it.",
    "Baseline's down. Now you've got a target.",
  ],
  regression: [
    "Down from last time. Tomorrow's a different muscle. Walk it off.",
    "Below last time. Note it. Move on.",
    "Tape's honest — slipped today. Reps still count.",
    "Less than last round. Different day, different reasons.",
  ],
  flat: [
    "Held the line. Compounding doesn't always show.",
    "Flat day. Reps still bank.",
    "Steady — no climb, no drop. Show up tomorrow.",
    "Same number. Different inputs. Bank it.",
  ],
  improvement: [
    "Up a few. Tomorrow's a different muscle. Build on it.",
    "Climbed. Don't celebrate too hard.",
    "Better than last time. Keep tilting up.",
    "Improvement on tape. Reps work.",
  ],
  breakthrough: [
    "Composite {composite} — beat last {dim} by {deltaAbs}. Compounding.",
    "Big climb. Don't talk about it. Repeat it.",
    "Breakthrough rep. Bank the day.",
    "{deltaAbs} jump. Tape doesn't lie.",
  ],
};

// ─── 6. Streak / freeze / partial / full day ────────────────────────────

export const freezeConsumed: string[] = [
  "Used a freeze. Streak's safe. Today's {dim}.",
  "Freeze burned, streak alive. Don't waste tomorrow.",
  "Saved by a freeze. {dim}'s up — start it.",
  "Freeze on the counter. Get back to it.",
];

export const streakSavedJustInTime: string[] = [
  "Last rep before midnight. Saved it.",
  "Closed the day with seconds to spare. Don't make a habit.",
  "Just in time. Tomorrow, start earlier.",
  "Cutting it fine. Worked anyway.",
];

export const partialDay: string[] = [
  "Showed up. Streak still alive. Try to close all 4 next time.",
  "{repsDone} of 4. Reps banked. Day's still partial.",
  "Showed up. The 4-rep day is the prize, not the floor.",
  "Partial credit. Use the leftover guilt tomorrow.",
];

export const fullDay: string[] = [
  "{dim} day complete. Composite {composite}.",
  "4 of 4. Day's on tape.",
  "Locked the day. Bank it.",
  "Full day, full credit. Walk it off.",
];

// ─── 7. retroNarratives — Phase 9 retrospective highlight templates ─────

export const retroNarratives = {
  bestDimToday: "Best dim today: {dim} at {score}.",
  biggestJump: "Biggest jump: +{deltaAbs} in {dim}.",
  biggestDrop: "Watch: {dim} dropped {deltaAbs}.",
  firstEver: "First {dim} day — baseline set.",
  noDelta: "Steady. Same shape as last time.",
};

// ─── 8. errorFallbacks — keyed by reason code ───────────────────────────

export const errorFallbacks: Record<ErrorReason, string[]> = {
  no_transcript: [
    "Couldn't hear it cleanly. Counting the rep, no score.",
    "Audio came up quiet. We logged the rep — retry if you want a real score.",
  ],
  too_short: [
    "Too short to score. Try one full thought before the cut.",
    "Under our floor. Let the next one breathe.",
  ],
  scoring_failed: [
    "Scoring hiccup. Counting it as a rep. Don't lose momentum.",
    "Score didn't land. Tape's saved. Retry or push on.",
  ],
  timeout: [
    "Scoring took too long. Saved your rep. Try again or move on.",
    "Network slow. Rep's on the books — score pending.",
  ],
  unknown: [
    "Something glitched. Rep saved. Keep going.",
    "Edge case. Caught it. Don't break the rhythm.",
  ],
};

// ─── 9. A11y labels ─────────────────────────────────────────────────────

export const a11yLabels = {
  mascotIdle: "Brain mascot, waiting at start.",
  mascotWalking: (n: number) => `Brain mascot, walking to station ${n}.`,
  mascotAtStation: (n: number) => `Brain mascot, at station ${n}.`,
  mascotCelebrating: "Brain mascot, celebrating.",
  mascotDayComplete: "Brain mascot, day complete.",
  mascotStumbling: "Brain mascot, stumbled — reset.",
  stationLocked: (n: number, name: string) =>
    `Station ${n} of 4: ${name}, locked. Unlocks after station ${n - 1}.`,
  stationCurrent: (n: number, name: string) =>
    `Station ${n} of 4: ${name}, current.`,
  stationComplete: (n: number, name: string, score: number | null) =>
    `Station ${n} of 4: ${name}, complete${score != null ? `, scored ${score}` : ""}.`,
  scoreRevealed: (score: number, bandLabel: string) =>
    `New score: ${score}. ${bandLabel}.`,
} as const;
