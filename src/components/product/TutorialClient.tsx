"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Dumbbell,
  Compass,
  Sparkles,
  BarChart3,
  Play,
  Pause,
  CheckCircle2,
} from "lucide-react";
import { markTutorialSeenAction } from "@/server/actions/tutorial";
import { cn } from "@/lib/utils/cn";

type Screen = {
  eyebrow: string;
  title: string;
  body: string[];
  visual: React.ReactNode;
};

const SAMPLE_TRANSCRIPT = `Trust is the foundation of every relationship — and three specific behaviors build it.

First, consistency — showing up the same way whether it's easy or hard.

Second, honesty about what you don't know, not just what you do.

Third, following through — every kept commitment is a deposit; every broken one is a withdrawal.

Consistency, honesty, follow-through. That's how trust gets built — in that order.`;

const SCREENS: Screen[] = [
  {
    eyebrow: "01 · The three modes",
    title: "Three ways to train. One gym.",
    body: [
      "Daily Workout — 4 short reps in about 10 minutes. Habit engine.",
      "Build a Rep — describe a real conversation you're preparing for, get a thinking structure tailored to it, then practice.",
      "Challenge a friend — same prompt, head-to-head scoring.",
    ],
    visual: <ModeGrid />,
  },
  {
    eyebrow: "02 · How scoring works",
    title: "Six dimensions. Real research behind every score.",
    body: [
      "Every rep is scored on clarity, structure, conciseness (what you say) plus thinking quality, delivery, adaptability (how you say it).",
      "Every callout quotes you directly and suggests a better phrasing you can actually use next rep.",
      "Click \"Why this matters\" on any callout to see the research behind the dimension — no black-box scoring.",
    ],
    visual: <ScoringVisual />,
  },
  {
    eyebrow: "03 · What a good rep sounds like",
    title: "Hear one before you record one.",
    body: [
      "This is a 30-second reference rep of the \"Main → 3 Points → Close\" framework — a hook, three supporting points, and a close.",
      "Focus on the shape, not the delivery. Your reps will sound like you, not like this.",
    ],
    visual: <SamplePlayer />,
  },
  {
    eyebrow: "04 · Your first rep",
    title: "Ready. Let's go.",
    body: [
      "You'll see a prompt, a 3-second countdown, then you talk. 20–60 seconds, depending on the rep type.",
      "You can retry immediately — the feedback surfaces what to focus on next.",
      "Each rep builds off the last: Cognify biases the next prompt toward the weakness you just hit.",
    ],
    visual: <FirstRepCTA />,
  },
];

export function TutorialClient() {
  const [index, setIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [marked, setMarked] = useState(false);
  const router = useRouter();

  const screen = SCREENS[index]!;
  const isFirst = index === 0;
  const isLast = index === SCREENS.length - 1;

  function handleNext() {
    if (isLast) {
      finishAndGoToWorkout();
      return;
    }
    setIndex((i) => i + 1);
  }

  function finishAndGoToWorkout() {
    if (marked) {
      router.push("/workout");
      return;
    }
    startTransition(async () => {
      await markTutorialSeenAction();
      setMarked(true);
      router.push("/workout");
    });
  }

  function handleSkip() {
    startTransition(async () => {
      await markTutorialSeenAction();
      router.push("/dashboard");
    });
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-4xl flex-col px-4 py-10 md:px-6">
      <div className="flex items-center justify-between">
        <div
          className="flex gap-1.5"
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={SCREENS.length}
          aria-label={`Screen ${index + 1} of ${SCREENS.length}`}
        >
          {SCREENS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 w-10 rounded-full transition",
                i <= index ? "brand-gradient" : "bg-ink-200",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={handleSkip}
          disabled={isPending}
          className="text-xs font-semibold text-ink-500 hover:text-ink-900 disabled:opacity-50"
        >
          Skip tutorial
        </button>
      </div>

      <div className="mt-10 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          {screen.eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900 md:text-4xl">
          {screen.title}
        </h1>
        <div className="mt-4 space-y-3 text-base text-ink-600 md:text-lg">
          {screen.body.map((p, i) => (
            <p key={i} className="leading-relaxed">
              {p}
            </p>
          ))}
        </div>

        <div className="mt-8">{screen.visual}</div>
      </div>

      <div className="mt-12 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={isFirst}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={isPending}
          className="brand-gradient inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLast
            ? isPending
              ? "Starting…"
              : "Start my first workout"
            : "Next"}
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

// ——— Visuals ——————————————————————————————————————————

function ModeGrid() {
  const modes = [
    {
      icon: Dumbbell,
      title: "Daily Workout",
      line: "10 min · 4 reps · habit engine",
    },
    {
      icon: Compass,
      title: "Build a Rep",
      line: "Scenario in → structure out · practice it",
    },
    {
      icon: Sparkles,
      title: "Challenge",
      line: "Same prompt · head-to-head",
    },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {modes.map((m) => (
        <div
          key={m.title}
          className="surface-card overflow-hidden"
        >
          <div className="brand-gradient h-1" aria-hidden="true" />
          <div className="p-5">
            <div className="brand-gradient grid size-9 place-items-center rounded-xl shadow-sm">
              <m.icon className="size-5 text-white" strokeWidth={2.5} />
            </div>
            <p className="mt-3 text-base font-extrabold text-ink-900">
              {m.title}
            </p>
            <p className="mt-1 text-xs text-ink-600">{m.line}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ScoringVisual() {
  const dims = [
    { label: "Clarity", group: "Content", pct: 88 },
    { label: "Structure", group: "Content", pct: 82 },
    { label: "Conciseness", group: "Content", pct: 74 },
    { label: "Thinking", group: "Delivery", pct: 80 },
    { label: "Delivery", group: "Delivery", pct: 71 },
    { label: "Adaptability", group: "Delivery", pct: 85 },
  ];
  return (
    <div className="surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="grid gap-6 p-6 md:grid-cols-2">
        {(["Content", "Delivery"] as const).map((group) => (
          <div key={group}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
              {group}
            </p>
            <ul className="mt-3 space-y-2.5">
              {dims
                .filter((d) => d.group === group)
                .map((d) => (
                  <li key={d.label}>
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-semibold text-ink-700">
                        {d.label}
                      </span>
                      <span className="font-bold tabular-nums text-ink-900">
                        {d.pct}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-ink-100">
                      <div
                        className="brand-gradient h-1.5 rounded-full"
                        style={{ width: `${d.pct}%` }}
                      />
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-ink-100 bg-ink-50/60 px-6 py-3 text-[11px] text-ink-600">
        <BarChart3 className="mr-1.5 inline size-3 text-brand-purple" />
        These are the six dimensions you&rsquo;ll see on every rep.
      </div>
    </div>
  );
}

function SamplePlayer() {
  const [playing, setPlaying] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);

  function toggle() {
    if (!audioRef) return;
    if (playing) {
      audioRef.pause();
    } else {
      void audioRef.play().catch(() => setPlaying(false));
    }
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="flex items-start gap-4 p-6">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause sample" : "Play sample"}
          className="brand-gradient grid size-14 shrink-0 place-items-center rounded-full text-white shadow-md transition hover:brightness-110"
        >
          {playing ? (
            <Pause className="size-6" strokeWidth={2.5} />
          ) : (
            <Play className="size-6 translate-x-0.5" strokeWidth={2.5} />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            Sample rep · Structure framework
          </p>
          <p className="mt-0.5 text-sm font-bold text-ink-900">
            Why trust is the foundation of every relationship
          </p>
          <audio
            ref={setAudioRef}
            src="/fixtures/sample-rep.wav"
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            className="sr-only"
          >
            <track kind="captions" />
          </audio>
        </div>
      </div>
      <details className="border-t border-ink-100 px-6 py-3 text-sm text-ink-600">
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-ink-500 hover:text-ink-800">
          Show transcript
        </summary>
        <pre className="mt-3 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink-700">
          {SAMPLE_TRANSCRIPT}
        </pre>
      </details>
    </div>
  );
}

function FirstRepCTA() {
  return (
    <div className="surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="p-6">
        <ul className="space-y-3">
          {[
            "Prompt appears · 3-second ready countdown",
            "You talk · visible timer, no notes",
            "Feedback with quotes, better phrasing, and a timestamped transcript",
            "Next rep targets your weakest dimension from this one",
          ].map((line) => (
            <li
              key={line}
              className="flex items-start gap-3 text-sm text-ink-700"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-purple" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
