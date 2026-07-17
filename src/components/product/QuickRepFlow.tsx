"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, ChevronDown } from "lucide-react";
import { RepSurface } from "./RepSurface";
import type { RepScore, Callout } from "@/types/domain";

type Phase =
  | { kind: "intro" }
  | { kind: "recording" }
  | {
      kind: "done";
      score: RepScore;
      repId: string;
      transcript: string;
    };

export function QuickRepFlow({ prompt }: { prompt: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  // Transcript open by default — Product Sweep #1 flagged /try as "scores
  // but no transcript" when the panel was collapsed behind a subtle tap.
  // Callouts + transcript are the product's core value prop; show them
  // by default and let users collapse if they want the score-only view.
  const [transcriptOpen, setTranscriptOpen] = useState(true);

  if (phase.kind === "intro") {
    return (
      <div className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-7">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            The prompt
          </p>
          <p className="mt-1 text-xl font-bold text-ink-900 md:text-2xl">
            &ldquo;{prompt}&rdquo;
          </p>
          <ul className="mt-4 space-y-2 text-sm text-ink-700">
            <li>
              · 20 seconds to answer. Talk as if you&rsquo;re in the meeting.
            </li>
            <li>
              · Scored across six dimensions: clarity, structure, relevance,
              confidence, pacing, tone.
            </li>
            <li>
              · Get one specific thing you nailed and one you can tighten —
              both with quotes from your transcript.
            </li>
            <li>· No signup. No email. Mic only.</li>
          </ul>
          <button
            type="button"
            onClick={() => setPhase({ kind: "recording" })}
            className="brand-gradient mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-sm"
          >
            Start recording
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  if (phase.kind === "recording") {
    return (
      <RepSurface
        prompt={prompt}
        mode="scenario_training"
        topic="Quick Rep"
        maxDurationMs={20_000}
        onComplete={({ score, repId, transcript }) => {
          setPhase({ kind: "done", score, repId, transcript });
        }}
      />
    );
  }

  // phase === "done"
  const { score, transcript } = phase;
  const sortedDims = [...score.dimensions].sort((a, b) => b.score - a.score);
  const topDim = sortedDims[0];
  const bottomDim = sortedDims[sortedDims.length - 1];

  // v4 (grading v3) scores ship callouts: [] — the coaching lives on
  // coachFocus / strongerVersion / per-skill feedback. Synthesize the
  // two cards from those so the guest funnel never shows bare numbers;
  // legacy scores keep their real callouts.
  const legacyPositive =
    score.callouts.find((c) => c.tone === "positive") ?? score.callouts[0];
  const legacyImprovement =
    score.callouts.find(
      (c) => c.tone === "warn" || c.tone === "critical",
    ) ?? score.callouts[score.callouts.length - 1];
  const positiveCallout: Callout | undefined =
    legacyPositive ??
    (topDim?.feedback
      ? {
          dimension: topDim.dimension,
          tone: "positive",
          title: `Strongest: ${topDim.dimension.replace(/_/g, " ")}`,
          body: topDim.feedback,
          quote: null,
          suggestedRewrite: null,
          transcriptStart: null,
          transcriptEnd: null,
        }
      : undefined);
  const improvementCallout: Callout | undefined =
    legacyImprovement ??
    (score.coachFocus
      ? {
          dimension: score.coachFocus.dimension,
          tone: "warn",
          title: score.coachFocus.behavior ?? score.coachFocus.text,
          body:
            score.coachFocus.why ??
            score.coachFocus.action ??
            score.coachFocus.text,
          quote: score.strongerVersion?.quote ?? null,
          suggestedRewrite: score.strongerVersion?.rewrite ?? null,
          transcriptStart: null,
          transcriptEnd: null,
        }
      : undefined);

  const hasTranscript = transcript && transcript.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* ——— Score summary ——— */}
      <div className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-8 text-center">
          <Sparkles
            className="mx-auto size-8 text-brand-purple"
            aria-hidden="true"
          />
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">
            That&rsquo;s one rep.
          </h2>
          <p className="mt-2 text-sm text-ink-600">
            Your composite across all six dimensions.
          </p>
          <p className="brand-gradient-text mt-6 text-7xl font-extrabold tabular-nums">
            {score.composite}
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Quick Rep composite
          </p>

          <div className="mt-6 grid gap-2 rounded-xl bg-ink-50/60 p-4 text-left text-sm md:grid-cols-6">
            {score.dimensions.map((d) => {
              const isTop = topDim && d.dimension === topDim.dimension;
              const isBottom =
                bottomDim && d.dimension === bottomDim.dimension;
              return (
                <div
                  key={d.dimension}
                  className={
                    isTop
                      ? "rounded-lg border border-emerald-200 bg-emerald-50/60 p-2"
                      : isBottom
                        ? "rounded-lg border border-amber-200 bg-amber-50/60 p-2"
                        : "p-2"
                  }
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    {d.dimension}
                  </p>
                  <p className="mt-0.5 font-bold tabular-nums text-ink-900">
                    {d.score}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-ink-500">
            <span className="inline-block size-2 rounded-full bg-emerald-400 align-middle" />{" "}
            strongest · <span className="inline-block size-2 rounded-full bg-amber-400 align-middle" />{" "}
            watch this
          </p>
        </div>
      </div>

      {/* ——— Callouts ——— */}
      {(positiveCallout || improvementCallout) && (
        <div className="grid gap-4 md:grid-cols-2">
          {positiveCallout && (
            <CalloutCard tone="positive" callout={positiveCallout} />
          )}
          {improvementCallout && (
            <CalloutCard tone="improvement" callout={improvementCallout} />
          )}
        </div>
      )}

      {/* ——— Transcript (collapsed by default) ——— */}
      {hasTranscript && (
        <div className="surface-card overflow-hidden">
          <button
            type="button"
            onClick={() => setTranscriptOpen((v) => !v)}
            className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-ink-50/40"
            aria-expanded={transcriptOpen}
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
                Your transcript
              </p>
              <p className="mt-0.5 text-sm text-ink-600">
                {transcriptOpen ? "Tap to collapse" : "Tap to see what you said"}
              </p>
            </div>
            <ChevronDown
              className={`size-4 text-ink-500 transition-transform ${transcriptOpen ? "rotate-180" : ""}`}
            />
          </button>
          {transcriptOpen && (
            <div className="border-t border-ink-200/70 p-5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
                {transcript}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ——— Signup CTA ——— */}
      <div className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-7">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            A workout is four of these
          </p>
          <h3 className="mt-1 text-xl font-extrabold text-ink-900">
            Sign up free to keep training.
          </h3>
          <ul className="mt-3 space-y-1.5 text-sm text-ink-600">
            <li>· Daily Workout — 3 exercises, ~6 minutes</li>
            <li>· Your reps saved, compared, trended over time</li>
            <li>· Head-to-head challenges with friends</li>
            <li>· A baseline and monthly report card</li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/signin"
              className="brand-gradient inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-sm"
            >
              Sign up free
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-700 hover:border-ink-300"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function CalloutCard({
  tone,
  callout,
}: {
  tone: "positive" | "improvement";
  callout: Callout;
}) {
  const isPositive = tone === "positive";
  return (
    <div
      className={`surface-card overflow-hidden ${
        isPositive
          ? "border-emerald-200"
          : "border-amber-200"
      }`}
    >
      <div
        className={
          isPositive
            ? "h-1 bg-emerald-400"
            : "h-1 bg-amber-400"
        }
        aria-hidden="true"
      />
      <div className="p-5">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              isPositive
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {isPositive ? "What you nailed" : "Tighten next time"}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            {callout.dimension}
          </span>
        </div>
        <h4 className="mt-3 text-base font-bold text-ink-900">
          {callout.title}
        </h4>
        <p className="mt-1 text-sm leading-relaxed text-ink-700">
          {callout.body}
        </p>
        {callout.quote && (
          <blockquote
            className={`mt-3 rounded-lg border-l-2 p-3 text-sm italic ${
              isPositive
                ? "border-emerald-300 bg-emerald-50/50 text-ink-800"
                : "border-amber-300 bg-amber-50/50 text-ink-800"
            }`}
          >
            &ldquo;{callout.quote}&rdquo;
          </blockquote>
        )}
        {!isPositive && callout.suggestedRewrite && (
          <div className="mt-3 rounded-lg bg-ink-50/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Try instead
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-800">
              {callout.suggestedRewrite}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
