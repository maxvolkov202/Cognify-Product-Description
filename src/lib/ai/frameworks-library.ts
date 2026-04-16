import type { Framework } from "@/types/domain";

export type FrameworkTag =
  | "decision"
  | "consulting"
  | "sales"
  | "feedback"
  | "interview"
  | "executive"
  | "argument"
  | "narrative"
  | "status"
  | "reflection"
  | "impromptu";

export type FrameworkDifficulty = "beginner" | "intermediate" | "advanced";

export type LibraryFramework = Framework & {
  tags: FrameworkTag[];
  difficulty: FrameworkDifficulty;
  origin: string;
  whenToUse: string;
};

export const FRAMEWORKS_LIBRARY: LibraryFramework[] = [
  {
    id: "cdi",
    name: "Context → Decision → Impact",
    description: "Explain a technical decision clearly to any audience.",
    source: "library",
    tags: ["decision"],
    difficulty: "intermediate",
    origin: "Engineering decision records (ADRs), Thoughtworks & Heroku.",
    whenToUse:
      "Design reviews, post-mortems, and any moment you need to explain a technical decision to a non-technical audience.",
    nodes: [
      {
        id: "context",
        label: "Context",
        description: "The background the listener needs before the decision makes sense.",
      },
      {
        id: "decision",
        label: "Decision",
        description: "The choice you made, stated plainly and without hedging.",
      },
      {
        id: "impact",
        label: "Impact",
        description: "The consequences and tradeoffs, honestly.",
      },
    ],
  },
  {
    id: "adr",
    name: "Context → Options → Decision → Consequences",
    description: "Architecture Decision Record — for decisions where alternatives matter.",
    source: "library",
    tags: ["decision"],
    difficulty: "advanced",
    origin: "Architecture Decision Records (Michael Nygard, 2011).",
    whenToUse:
      "When you need to explain not only what you chose but what you considered and rejected — design reviews, RFC presentations, post-mortems with forks.",
    nodes: [
      {
        id: "context",
        label: "Context",
        description: "The problem and the constraints operating on it.",
      },
      {
        id: "options",
        label: "Options",
        description: "The alternatives you considered, with one-line tradeoffs each.",
      },
      {
        id: "decision",
        label: "Decision",
        description: "The option you picked.",
      },
      {
        id: "consequences",
        label: "Consequences",
        description: "What you accept and what you give up by choosing it.",
      },
    ],
  },
  {
    id: "scqa",
    name: "Situation → Complication → Question → Answer",
    description: "Consulting-grade framing for executive audiences.",
    source: "library",
    tags: ["consulting", "executive"],
    difficulty: "advanced",
    origin: "Barbara Minto, *The Pyramid Principle* (1987). McKinsey standard.",
    whenToUse:
      "Strategy discussions, recommendations, executive briefings. Use when the listener needs to feel the tension before they hear your answer.",
    nodes: [
      {
        id: "situation",
        label: "Situation",
        description: "Where things stand today — the accepted facts.",
      },
      {
        id: "complication",
        label: "Complication",
        description: "What's changed or what's at risk.",
      },
      {
        id: "question",
        label: "Question",
        description: "The implicit question the audience is now asking.",
      },
      {
        id: "answer",
        label: "Answer",
        description: "Your recommendation.",
      },
    ],
  },
  {
    id: "minto",
    name: "Answer → Reasons → Evidence",
    description: "The Minto Pyramid — lead with the punchline.",
    source: "library",
    tags: ["consulting", "executive"],
    difficulty: "advanced",
    origin: "Barbara Minto — the short-form cousin of SCQA.",
    whenToUse:
      "Executive memos. First 30 seconds of any senior meeting. When the listener needs the answer now and will drill in if they want more.",
    nodes: [
      {
        id: "answer",
        label: "Answer",
        description: "Lead with your conclusion. No preamble.",
      },
      {
        id: "reasons",
        label: "Reasons",
        description: "Three supporting reasons, mutually exclusive.",
      },
      {
        id: "evidence",
        label: "Evidence",
        description: "Data or logic behind each reason.",
      },
    ],
  },
  {
    id: "pspa",
    name: "Problem → Solution → Proof → Ask",
    description: "B2B sales framing. Pain → offer → evidence → next step.",
    source: "library",
    tags: ["sales"],
    difficulty: "intermediate",
    origin: "Modern B2B sales (Challenger Sale, SPIN derivatives).",
    whenToUse:
      "Product pitches, discovery calls, any moment you need the listener to commit to a next step.",
    nodes: [
      {
        id: "problem",
        label: "Problem",
        description: "The pain the buyer is feeling today.",
      },
      {
        id: "solution",
        label: "Solution",
        description: "How your thing addresses it, specifically.",
      },
      {
        id: "proof",
        label: "Proof",
        description: "Evidence it works — a case, a number, a demo.",
      },
      {
        id: "ask",
        label: "Ask",
        description: "The next step you want them to take.",
      },
    ],
  },
  {
    id: "fab",
    name: "Feature → Advantage → Benefit",
    description: "Translate what-it-does into why-they-care.",
    source: "library",
    tags: ["sales"],
    difficulty: "beginner",
    origin: "Classic sales training, Xerox PARC sales programs (1960s).",
    whenToUse:
      "Product demos, feature explanations, when you need to move from mechanics to meaning.",
    nodes: [
      {
        id: "feature",
        label: "Feature",
        description: "What the thing actually is — the mechanic.",
      },
      {
        id: "advantage",
        label: "Advantage",
        description: "What it does better than the alternative.",
      },
      {
        id: "benefit",
        label: "Benefit",
        description: "What it means for the customer's life or work.",
      },
    ],
  },
  {
    id: "aida",
    name: "Attention → Interest → Desire → Action",
    description: "The oldest persuasion framework still in wide use.",
    source: "library",
    tags: ["sales", "narrative"],
    difficulty: "intermediate",
    origin: "Elias St. Elmo Lewis, 1898.",
    whenToUse:
      "Opening talks, cold pitches, marketing copy — any moment you have to earn attention before you have trust.",
    nodes: [
      {
        id: "attention",
        label: "Attention",
        description: "The hook that makes them stop scrolling.",
      },
      {
        id: "interest",
        label: "Interest",
        description: "The reason they should keep listening.",
      },
      {
        id: "desire",
        label: "Desire",
        description: "Why they'd want this to be true for them.",
      },
      {
        id: "action",
        label: "Action",
        description: "The specific thing you're asking them to do next.",
      },
    ],
  },
  {
    id: "bie",
    name: "Behavior → Impact → Expectation",
    description: "Deliver tough feedback clearly and kindly.",
    source: "library",
    tags: ["feedback"],
    difficulty: "intermediate",
    origin: "Center for Creative Leadership, 1990s.",
    whenToUse:
      "Giving tough feedback, performance conversations, calling out something a colleague did that affected the team.",
    nodes: [
      {
        id: "behavior",
        label: "Behavior",
        description: "The specific observed behavior, no interpretation.",
      },
      {
        id: "impact",
        label: "Impact",
        description: "The effect it had on the work, team, or outcome.",
      },
      {
        id: "expectation",
        label: "Expectation",
        description: "What you need to happen going forward.",
      },
    ],
  },
  {
    id: "star",
    name: "Situation → Task → Action → Result",
    description: "The behavioral interview backbone.",
    source: "library",
    tags: ["interview"],
    difficulty: "intermediate",
    origin: "Behavioral interviewing methodology (Amazon, Google, Microsoft).",
    whenToUse:
      "Any 'tell me about a time when' question. Performance reviews. Résumé bullets.",
    nodes: [
      {
        id: "situation",
        label: "Situation",
        description: "The context you were in, one sentence.",
      },
      {
        id: "task",
        label: "Task",
        description: "What you were specifically responsible for.",
      },
      {
        id: "action",
        label: "Action",
        description: "What you personally did — not what the team did.",
      },
      {
        id: "result",
        label: "Result",
        description: "The outcome, with numbers if possible.",
      },
    ],
  },
  {
    id: "ppf",
    name: "Past → Present → Future",
    description: "Classic narrative structure for self-introductions.",
    source: "library",
    tags: ["interview", "narrative"],
    difficulty: "beginner",
    origin: "Long-standing narrative pattern used in introductions and keynote openers.",
    whenToUse:
      "Self-introductions, interview openers ('tell me about yourself'), career framing.",
    nodes: [
      {
        id: "past",
        label: "Past",
        description: "One line of relevant history, not your full biography.",
      },
      {
        id: "present",
        label: "Present",
        description: "What you're doing now that connects to this moment.",
      },
      {
        id: "future",
        label: "Future",
        description: "Where you're heading and why this matters.",
      },
    ],
  },
  {
    id: "bluf",
    name: "Bottom Line → Context → Next Step",
    description: "Ruthless compression for executive briefings.",
    source: "library",
    tags: ["executive", "status"],
    difficulty: "intermediate",
    origin: "US military communication doctrine.",
    whenToUse:
      "Emails to executives, quick meeting updates, any moment you have ≤ 60 seconds.",
    nodes: [
      {
        id: "bottom-line",
        label: "Bottom Line",
        description: "The one sentence they need to hear.",
      },
      {
        id: "context",
        label: "Context",
        description: "The minimum background to make it make sense.",
      },
      {
        id: "next-step",
        label: "Next Step",
        description: "What you need from them.",
      },
    ],
  },
  {
    id: "prep",
    name: "Point → Reason → Example → Point",
    description: "Impromptu speaking scaffold from Toastmasters.",
    source: "library",
    tags: ["impromptu"],
    difficulty: "beginner",
    origin: "Toastmasters International impromptu speaking methodology.",
    whenToUse:
      "Answering an unexpected question. Group discussions. Quick responses with structure but no planning time.",
    nodes: [
      {
        id: "point",
        label: "Point",
        description: "State your point directly. No windup.",
      },
      {
        id: "reason",
        label: "Reason",
        description: "One sentence on why you believe it.",
      },
      {
        id: "example",
        label: "Example",
        description: "A concrete case that proves it.",
      },
      {
        id: "restate",
        label: "Point (restated)",
        description: "Restate your point, tighter than the first time.",
      },
    ],
  },
  {
    id: "cei",
    name: "Claim → Evidence → Implication",
    description: "The backbone of any argument that could be challenged.",
    source: "library",
    tags: ["argument"],
    difficulty: "intermediate",
    origin: "Classical rhetoric (Aristotelian logos), adapted for modern debate.",
    whenToUse:
      "Debates, persuasive presentations, defending a recommendation, any moment your argument may be contested.",
    nodes: [
      {
        id: "claim",
        label: "Claim",
        description: "The assertion you're making.",
      },
      {
        id: "evidence",
        label: "Evidence",
        description: "Data, reasoning, or a specific example that supports it.",
      },
      {
        id: "implication",
        label: "Implication",
        description: "Why it matters to your audience specifically.",
      },
    ],
  },
  {
    id: "wsw",
    name: "What → So What → Now What",
    description: "Reflective practice — turn observation into action.",
    source: "library",
    tags: ["reflection"],
    difficulty: "beginner",
    origin: "Driscoll's reflective practice model, 1994.",
    whenToUse: "Retrospectives, learning debriefs, explaining an experience and its meaning.",
    nodes: [
      {
        id: "what",
        label: "What",
        description: "What happened, objectively. Facts, not feelings.",
      },
      {
        id: "so-what",
        label: "So What",
        description: "What it means, why it matters.",
      },
      {
        id: "now-what",
        label: "Now What",
        description: "What changes as a result. The concrete next action.",
      },
    ],
  },
  {
    id: "ppp",
    name: "Progress → Plans → Problems",
    description: "Standup-style status update.",
    source: "library",
    tags: ["status"],
    difficulty: "beginner",
    origin: "Agile / Scrum daily standups (Ken Schwaber, late 1990s).",
    whenToUse:
      "Status meetings, weekly updates, telling a group where things stand without over-sharing.",
    nodes: [
      {
        id: "progress",
        label: "Progress",
        description: "What got done since the last update.",
      },
      {
        id: "plans",
        label: "Plans",
        description: "What's happening next.",
      },
      {
        id: "problems",
        label: "Problems",
        description: "What's blocked or at risk, and what you need to unblock it.",
      },
    ],
  },
];

export function findFrameworkById(id: string): LibraryFramework | null {
  return FRAMEWORKS_LIBRARY.find((f) => f.id === id) ?? null;
}

export function frameworksByTag(tag: FrameworkTag): LibraryFramework[] {
  return FRAMEWORKS_LIBRARY.filter((f) => f.tags.includes(tag));
}

export function frameworksByDifficulty(
  difficulty: FrameworkDifficulty,
): LibraryFramework[] {
  return FRAMEWORKS_LIBRARY.filter((f) => f.difficulty === difficulty);
}
