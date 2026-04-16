"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  AlertTriangle,
  AlertCircle,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Quote,
  Sparkles,
  TrendingUp,
  Target,
} from "lucide-react";
import type { Callout, RepScore, SkillDimension } from "@/types/domain";
import { WhyThisMattersPopover } from "./WhyThisMattersPopover";
import { FeedbackRatingTile } from "./FeedbackRatingTile";
import { CalloutCorrectionRow } from "./CalloutCorrectionRow";
import {
  DIMENSION_LABELS,
  SKILL_DIMENSION_GROUPS,
  SKILL_DIMENSIONS,
} from "@/types/domain";
import { groupComposite } from "@/lib/scoring/rubric";
import { cn } from "@/lib/utils/cn";

export type PreviousRepSummary = {
  composite: number;
  dimensions: { dimension: SkillDimension; score: number }[];
  topWeakness: Callout | null;
  transcript: string;
  promptText: string;
};

type Props = {
  score: RepScore;
  audioUrl?: string;
  durationMs: number;
  transcript?: string;
  words?: { word: string; startMs: number; endMs: number }[];
  previousRepSummary?: PreviousRepSummary | null;
  previousDimensionScores?: Partial<Record<SkillDimension, number>>;
  /** Persisted rep id — enables the rating tile (feedback learning loop).
   *  Null when the rep failed to persist (e.g. unauthenticated user). */
  repId?: string | null;
  /** Persisted callout ids, same order as score.callouts. Enables the
   *  per-callout correction row. Empty array when the rep wasn't saved
   *  (guest without DB, or DB unavailable). */
  calloutIds?: string[];
};

type ProgressionResult = {
  improvements: {
    dimension: SkillDimension;
    delta: number;
    observation: string;
    quoteNow: string | null;
  }[];
  stillNeedsWork: {
    dimension: SkillDimension;
    score: number;
    observation: string;
    nextAction: string;
  }[];
  narrative: string;
};

// Dimensions we actually rank (the 6 real rubric dims). `structural_adherence`
// is not part of the weakness ranking — it's a separate signal.
const RANKABLE_DIMENSIONS = [
  "clarity",
  "structure",
  "relevance",
  "confidence",
  "pacing",
  "tone",
] as const;

export function FeedbackPanel({
  score,
  audioUrl,
  durationMs,
  transcript,
  words,
  previousRepSummary,
  repId,
  calloutIds = [],
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const [progression, setProgression] = useState<ProgressionResult | null>(null);
  const [progressionLoading, setProgressionLoading] = useState(false);
  const [progressionError, setProgressionError] = useState<string | null>(null);

  // Kick off a progression analysis call when we have a previous rep.
  // Uses its own AbortController so unmount cancels the in-flight request
  // instead of setting state on a dead component.
  useEffect(() => {
    if (!previousRepSummary || !transcript) {
      setProgression(null);
      return;
    }
    const abort = new AbortController();
    setProgressionLoading(true);
    setProgressionError(null);

    const dimensionsPayload = SKILL_DIMENSIONS.map((d) => ({
      dimension: d,
      score:
        score.dimensions.find((x) => x.dimension === d)?.score ?? 0,
    }));
    const topWeakness =
      score.callouts.find(
        (c) => c.tone === "warn" || c.tone === "critical",
      ) ?? null;

    fetch("/api/progression", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abort.signal,
      body: JSON.stringify({
        previous: {
          composite: previousRepSummary.composite,
          dimensions: previousRepSummary.dimensions,
          topWeakness: previousRepSummary.topWeakness
            ? {
                dimension: previousRepSummary.topWeakness.dimension,
                title: previousRepSummary.topWeakness.title,
                body: previousRepSummary.topWeakness.body,
                quote: previousRepSummary.topWeakness.quote,
                suggestedRewrite:
                  previousRepSummary.topWeakness.suggestedRewrite,
              }
            : null,
          transcript: previousRepSummary.transcript,
        },
        current: {
          composite: score.composite,
          dimensions: dimensionsPayload,
          topWeakness: topWeakness
            ? {
                dimension: topWeakness.dimension,
                title: topWeakness.title,
                body: topWeakness.body,
                quote: topWeakness.quote,
                suggestedRewrite: topWeakness.suggestedRewrite,
              }
            : null,
          transcript,
        },
        promptText: previousRepSummary.promptText,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`progression API ${res.status}`);
        return (await res.json()) as ProgressionResult;
      })
      .then((data) => {
        setProgression(data);
        setProgressionLoading(false);
      })
      .catch((err) => {
        if (abort.signal.aborted) return;
        setProgressionError(err.message ?? "Could not load comparison.");
        setProgressionLoading(false);
      });

    return () => abort.abort();
  }, [previousRepSummary, score, transcript]);

  const formattedDuration = useMemo(() => {
    const total = Math.floor(durationMs / 1000);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, [durationMs]);

  const dimensionMap = useMemo(() => {
    const m: Partial<Record<SkillDimension, number>> = {};
    for (const d of score.dimensions) m[d.dimension] = d.score;
    return m;
  }, [score.dimensions]);

  const contentScore = groupComposite(dimensionMap, "content");
  const deliveryScore = groupComposite(dimensionMap, "delivery");

  // Ranked weaknesses — the 2 lowest-scoring real dimensions, ordered ascending.
  const rankedWeaknesses = useMemo(() => {
    return [...RANKABLE_DIMENSIONS]
      .map((d) => ({ dim: d, score: dimensionMap[d] ?? 0 }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 2);
  }, [dimensionMap]);

  // Resolve each rendered callout back to its persisted DB id so the
  // correction row can key its mutations correctly.
  const idForCallout = useMemo(() => {
    return (callout: Callout): string | null => {
      const idx = score.callouts.indexOf(callout);
      if (idx < 0) return null;
      return calloutIds[idx] ?? null;
    };
  }, [score.callouts, calloutIds]);

  // Partition callouts. We only surface 1 positive + 2 improvements — any
  // extras from a misbehaving response get dropped silently.
  const positiveCallout = useMemo(
    () =>
      score.callouts.find(
        (c) => c.tone === "positive" || c.tone === "neutral",
      ) ?? null,
    [score.callouts],
  );
  const improvementCallouts = useMemo(
    () =>
      score.callouts
        .filter((c) => c.tone === "warn" || c.tone === "critical")
        .slice(0, 2),
    [score.callouts],
  );

  const handleSeek = (ms: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, ms / 1000);
    audio.play().catch(() => {});
  };

  return (
    <div className="space-y-6">
      {/* ——— Composite + group bars ——————————————————————————— */}
      <div className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="grid gap-8 p-8 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center justify-center">
            <div className="brand-gradient-text text-6xl font-extrabold tabular-nums md:text-7xl">
              {score.composite}
            </div>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              Out of 100
            </p>
            <p className="mt-3 text-xs text-ink-500">{formattedDuration}</p>
          </div>

          <div className="space-y-5">
            {/* Ranked weakness headline — replaces old "Next Rep Focus" card */}
            {rankedWeaknesses.length >= 2 && (
              <div className="rounded-xl border border-brand-purple/20 bg-brand-purple/5 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-purple">
                  Focus next rep
                </p>
                <p className="mt-1 text-sm font-bold text-ink-900">
                  <span className="text-brand-purple">1.</span>{" "}
                  {DIMENSION_LABELS[rankedWeaknesses[0]!.dim]}{" "}
                  <span className="font-medium text-ink-500">
                    · {Math.round(rankedWeaknesses[0]!.score)}
                  </span>
                  <span className="mx-2 text-ink-300">·</span>
                  <span className="text-brand-purple">2.</span>{" "}
                  {DIMENSION_LABELS[rankedWeaknesses[1]!.dim]}{" "}
                  <span className="font-medium text-ink-500">
                    · {Math.round(rankedWeaknesses[1]!.score)}
                  </span>
                </p>
              </div>
            )}

            <DimensionGroup
              groupLabel="Content"
              groupScore={contentScore}
              dimensions={SKILL_DIMENSION_GROUPS.content}
              scores={dimensionMap}
            />
            <DimensionGroup
              groupLabel="Delivery"
              groupScore={deliveryScore}
              dimensions={SKILL_DIMENSION_GROUPS.delivery}
              scores={dimensionMap}
            />

            {score.structuralAdherence !== undefined && (
              <div className="border-t border-ink-200/60 pt-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
                    Framework adherence
                  </p>
                  <p className="text-xs font-bold text-ink-900 tabular-nums">
                    {Math.round(score.structuralAdherence)}
                  </p>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="brand-gradient h-full rounded-full"
                    style={{ width: `${score.structuralAdherence}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ——— Since your last rep (rep-to-rep comparison) ——————————— */}
      {previousRepSummary && (
        <SinceLastRepCard
          loading={progressionLoading}
          error={progressionError}
          result={progression}
        />
      )}

      {/* ——— What you did well (ONE positive callout w/ quote) ——— */}
      {positiveCallout && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            <Check className="size-3 text-success" strokeWidth={3} />
            What you did well
          </h3>
          <CoachingCallout
            callout={positiveCallout}
            onSeek={handleSeek}
            calloutId={idForCallout(positiveCallout)}
          />
        </section>
      )}

      {/* ——— Two things to fix next rep ——————————————————————— */}
      {improvementCallouts.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            <AlertTriangle className="size-3 text-brand-purple" strokeWidth={3} />
            Two things to fix next rep
          </h3>
          {improvementCallouts.map((callout, i) => (
            <CoachingCallout
              key={`i-${i}`}
              callout={callout}
              onSeek={handleSeek}
              index={i + 1}
              calloutId={idForCallout(callout)}
            />
          ))}
        </section>
      )}

      {/* ——— Transcript with highlighted callout ranges ————————— */}
      {transcript && transcript.trim().length > 0 && (
        <section className="surface-card overflow-hidden">
          <button
            type="button"
            onClick={() => setTranscriptOpen((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              Transcript
            </span>
            {transcriptOpen ? (
              <ChevronUp className="size-4 text-ink-500" />
            ) : (
              <ChevronDown className="size-4 text-ink-500" />
            )}
          </button>
          {transcriptOpen && (
            <div className="border-t border-ink-100 px-5 py-4">
              <TranscriptView
                transcript={transcript}
                words={words ?? []}
                callouts={score.callouts}
                onSeek={handleSeek}
              />
            </div>
          )}
        </section>
      )}

      {/* ——— Audio player ————————————————————————————————— */}
      {audioUrl && (
        <div className="surface-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Your rep
          </p>
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            className="mt-2 w-full"
            preload="metadata"
          />
        </div>
      )}

      {/* ——— Feedback rating (calibration loop) ————————————————— */}
      <FeedbackRatingTile repId={repId ?? null} />
    </div>
  );
}

// ——— Callout card with quote + suggested rewrite ——————————————
function CoachingCallout({
  callout,
  onSeek,
  index,
  calloutId,
}: {
  callout: Callout;
  onSeek: (ms: number) => void;
  index?: number;
  calloutId?: string | null;
}) {
  const tone = callout.tone;
  const isPositive = tone === "positive" || tone === "neutral";
  const borderClass = isPositive
    ? "border-success/30 bg-success/5"
    : tone === "critical"
      ? "border-danger/30 bg-danger/5"
      : "border-brand-purple/25 bg-brand-purple/5";
  const accentText = isPositive
    ? "text-success"
    : tone === "critical"
      ? "text-danger"
      : "text-brand-purple";
  const Icon = isPositive ? Check : tone === "critical" ? AlertCircle : AlertTriangle;

  const timestamp = formatTimestamp(callout.transcriptStart);

  return (
    <div className={cn("rounded-2xl border px-5 py-4", borderClass)}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full bg-white",
            accentText,
          )}
        >
          <Icon className="size-3.5" strokeWidth={3} aria-hidden="true" />
        </span>
        <span className="text-sm font-bold text-ink-900">
          {typeof index === "number" ? `${index}. ` : ""}
          {callout.title}
        </span>
        <button
          type="button"
          onClick={() => onSeek(callout.transcriptStart)}
          className="ml-auto rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-ink-600 hover:bg-white"
        >
          {timestamp}
        </button>
      </div>

      {callout.quote && (
        <blockquote className="mt-3 flex gap-2 rounded-xl bg-white/80 px-3 py-2 text-sm italic leading-relaxed text-ink-700">
          <Quote
            className="size-3.5 shrink-0 translate-y-1 text-ink-400"
            aria-hidden="true"
          />
          <span>&ldquo;{callout.quote}&rdquo;</span>
        </blockquote>
      )}

      <p className="mt-3 text-sm leading-relaxed text-ink-600">
        <span className={cn("font-semibold", accentText)}>
          {isPositive ? "Why it worked:" : "Why it's an issue:"}
        </span>{" "}
        {callout.body}
      </p>

      {!isPositive && callout.suggestedRewrite && (
        <div className="mt-3 rounded-xl border border-ink-200 bg-white px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand-purple">
            <Sparkles className="size-3" strokeWidth={2.5} aria-hidden="true" />
            Try instead
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-800">
            &ldquo;{callout.suggestedRewrite}&rdquo;
          </p>
        </div>
      )}

      {callout.dimension !== "structural_adherence" && (
        <div className="mt-3 flex items-center justify-between gap-2">
          {calloutId ? (
            <CalloutCorrectionRow
              calloutId={calloutId}
              originalQuote={callout.quote}
              originalRewrite={callout.suggestedRewrite}
            />
          ) : (
            <span />
          )}
          <WhyThisMattersPopover dimension={callout.dimension} />
        </div>
      )}
    </div>
  );
}

// ——— Transcript with inline highlighted callout ranges ————————
function TranscriptView({
  transcript,
  words,
  callouts,
  onSeek,
}: {
  transcript: string;
  words: { word: string; startMs: number; endMs: number }[];
  callouts: Callout[];
  onSeek: (ms: number) => void;
}) {
  // If we have word-level timings, render per-word with highlights for words
  // whose startMs falls inside any callout range. If not, fall back to plain
  // paragraph display with a note.
  if (words.length === 0) {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
        {transcript}
      </p>
    );
  }

  return (
    <p className="text-sm leading-relaxed text-ink-700">
      {words.map((w, i) => {
        const hit = callouts.find(
          (c) =>
            w.startMs >= c.transcriptStart &&
            w.startMs <= c.transcriptEnd,
        );
        if (!hit) {
          return (
            <span key={i}>
              {w.word}
              {" "}
            </span>
          );
        }
        const toneBg =
          hit.tone === "positive" || hit.tone === "neutral"
            ? "bg-success/20 hover:bg-success/30"
            : hit.tone === "critical"
              ? "bg-danger/20 hover:bg-danger/30"
              : "bg-brand-purple/20 hover:bg-brand-purple/30";
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSeek(hit.transcriptStart)}
            className={cn(
              "rounded px-0.5 transition-colors",
              toneBg,
            )}
            title={hit.title}
          >
            {w.word}{" "}
          </button>
        );
      })}
    </p>
  );
}

// ——— Small helpers ——————————————————————————————————————
function DimensionGroup({
  groupLabel,
  groupScore,
  dimensions,
  scores,
}: {
  groupLabel: string;
  groupScore: number;
  dimensions: readonly SkillDimension[];
  scores: Partial<Record<SkillDimension, number>>;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          {groupLabel}
        </p>
        <p className="text-xs font-bold text-ink-700 tabular-nums">
          {groupScore}
        </p>
      </div>
      <div className="mt-2.5 space-y-2">
        {dimensions.map((dim) => {
          const sc = scores[dim] ?? 0;
          return (
            <DimBar key={dim} label={DIMENSION_LABELS[dim]} score={sc} />
          );
        })}
      </div>
    </div>
  );
}

function DimBar({ label, score }: { label: string; score: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-ink-700">{label}</span>
        <span className="text-xs font-bold text-ink-900 tabular-nums">
          {Math.round(score)}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div
          className="brand-gradient h-full rounded-full transition-[width]"
          style={{ width: `${score}%` }}
          role="progressbar"
          aria-valuenow={Math.round(score)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        />
      </div>
    </div>
  );
}

function formatTimestamp(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function SinceLastRepCard({
  loading,
  error,
  result,
}: {
  loading: boolean;
  error: string | null;
  result: ProgressionResult | null;
}) {
  return (
    <section className="surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="p-5">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          <TrendingUp className="size-3 text-brand-purple" strokeWidth={3} />
          Since your last rep
        </h3>

        {loading && (
          <div className="mt-3 space-y-2">
            <div className="h-3 w-3/4 animate-pulse rounded bg-ink-100" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-ink-100" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-ink-100" />
            <p className="mt-2 text-xs text-ink-400">
              Comparing reps…
            </p>
          </div>
        )}

        {error && !loading && (
          <p className="mt-3 text-xs text-ink-500">
            Couldn&rsquo;t load the comparison ({error}). Your feedback below is unaffected.
          </p>
        )}

        {result && !loading && (
          <div className="mt-3 space-y-4">
            <p className="text-sm leading-relaxed text-ink-800">
              {result.narrative}
            </p>

            {result.improvements.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-success">
                  What you did better
                </p>
                <ul className="mt-2 space-y-2">
                  {result.improvements.map((imp, i) => (
                    <li
                      key={`imp-${i}`}
                      className="rounded-xl border border-success/25 bg-success/5 px-4 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <ArrowUpRight
                          className="size-4 text-success"
                          strokeWidth={2.5}
                          aria-hidden="true"
                        />
                        <span className="text-sm font-bold text-ink-900">
                          {DIMENSION_LABELS[imp.dimension]}
                        </span>
                        <span className="ml-auto rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
                          {imp.delta >= 0 ? "+" : ""}
                          {imp.delta}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-700">
                        {imp.observation}
                      </p>
                      {imp.quoteNow && (
                        <blockquote className="mt-2 rounded-lg bg-white/80 px-3 py-1.5 text-xs italic text-ink-600">
                          &ldquo;{imp.quoteNow}&rdquo;
                        </blockquote>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.stillNeedsWork.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-purple">
                  Where you still need to grow
                </p>
                <ul className="mt-2 space-y-2">
                  {result.stillNeedsWork.map((gap, i) => (
                    <li
                      key={`gap-${i}`}
                      className="rounded-xl border border-brand-purple/25 bg-brand-purple/5 px-4 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <Target
                          className="size-4 text-brand-purple"
                          strokeWidth={2.5}
                          aria-hidden="true"
                        />
                        <span className="text-sm font-bold text-ink-900">
                          {DIMENSION_LABELS[gap.dimension]}
                        </span>
                        <span className="ml-auto rounded-full bg-brand-purple/15 px-2 py-0.5 text-[10px] font-bold text-brand-purple">
                          {Math.round(gap.score)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-700">
                        {gap.observation}
                      </p>
                      <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-ink-800">
                        <Sparkles
                          className="size-3 shrink-0 translate-y-0.5 text-brand-purple"
                          strokeWidth={2.5}
                          aria-hidden="true"
                        />
                        <span>
                          <span className="font-semibold text-brand-purple">
                            Next:{" "}
                          </span>
                          {gap.nextAction}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
