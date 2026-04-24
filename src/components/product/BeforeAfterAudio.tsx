"use client";

import { useRef, useState } from "react";
import { Play, Pause, ArrowLeftRight } from "lucide-react";
import type { BeforeAfterRep } from "@/lib/db/queries/progress";

type Props = {
  oldest: BeforeAfterRep;
  newest: BeforeAfterRep;
};

/**
 * Before/After audio — two stacked audio cards with composite scores
 * and timestamps. Gives the user a visceral sense of their own change:
 * the delta is literally audible.
 *
 * UX contract: only one clip plays at a time. Hitting Play on one
 * pauses the other and resets its position. This is intentional — an
 * A/B listen comparison means the user toggles between clips, not
 * mashes them into a duet.
 */
export function BeforeAfterAudio({ oldest, newest }: Props) {
  const oldestRef = useRef<HTMLAudioElement | null>(null);
  const newestRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<"oldest" | "newest" | null>(null);

  const compositeDelta = Math.round(newest.compositeScore - oldest.compositeScore);

  function togglePlay(which: "oldest" | "newest") {
    const ref = which === "oldest" ? oldestRef : newestRef;
    const other = which === "oldest" ? newestRef : oldestRef;
    if (!ref.current) return;

    if (playing === which) {
      ref.current.pause();
      setPlaying(null);
      return;
    }
    if (other.current) {
      other.current.pause();
      other.current.currentTime = 0;
    }
    ref.current.currentTime = 0;
    void ref.current.play().catch(() => setPlaying(null));
    setPlaying(which);
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="p-6 md:p-8">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          <ArrowLeftRight className="size-3.5" strokeWidth={2.5} />
          Before · After
        </div>
        <h2 className="mt-2 text-xl font-extrabold text-ink-900 md:text-2xl">
          Hear the delta.
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          Your first audio-bearing rep on the left. Your most recent on the
          right. Same lens, different you.
        </p>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Clip
            label="Before"
            rep={oldest}
            playing={playing === "oldest"}
            onTogglePlay={() => togglePlay("oldest")}
            audioRef={oldestRef}
            onEnded={() => setPlaying(null)}
            accent="ink"
          />
          <Clip
            label="After"
            rep={newest}
            playing={playing === "newest"}
            onTogglePlay={() => togglePlay("newest")}
            audioRef={newestRef}
            onEnded={() => setPlaying(null)}
            accent="brand"
          />
        </div>

        <div className="mt-5 flex items-baseline justify-between gap-3 rounded-xl border border-ink-100 bg-ink-50/60 px-4 py-3 text-sm">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              Composite change
            </p>
            <p
              className={`mt-1 text-2xl font-extrabold tabular-nums ${
                compositeDelta > 0
                  ? "text-emerald-700"
                  : compositeDelta < 0
                    ? "text-amber-700"
                    : "text-ink-900"
              }`}
            >
              {compositeDelta >= 0 ? "+" : ""}
              {compositeDelta}
            </p>
          </div>
          <div className="text-right text-xs text-ink-500">
            {elapsedBetween(oldest.createdAt, newest.createdAt)} of training
            between these two reps.
          </div>
        </div>
      </div>
    </div>
  );
}

function Clip({
  label,
  rep,
  playing,
  onTogglePlay,
  audioRef,
  onEnded,
  accent,
}: {
  label: string;
  rep: BeforeAfterRep;
  playing: boolean;
  onTogglePlay: () => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  onEnded: () => void;
  accent: "ink" | "brand";
}) {
  const ring =
    accent === "brand" ? "ring-brand-purple/30" : "ring-ink-200";
  const btn =
    accent === "brand"
      ? "brand-gradient text-white"
      : "bg-ink-900 text-white";
  return (
    <div className={`rounded-2xl border border-ink-200 bg-white p-4 ring-1 ${ring}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-ink-500">
          {label}
        </p>
        <p className="text-[10px] text-ink-400">
          {new Date(rep.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold text-ink-900">
        {rep.promptText}
      </p>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? "Pause clip" : "Play clip"}
          className={`grid size-12 shrink-0 place-items-center rounded-full shadow-sm transition hover:brightness-110 ${btn}`}
        >
          {playing ? (
            <Pause className="size-5" strokeWidth={2.5} />
          ) : (
            <Play className="size-5 translate-x-0.5" strokeWidth={2.5} />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="brand-gradient-text text-2xl font-extrabold tabular-nums">
            {Math.round(rep.compositeScore)}
          </p>
          <p className="text-[11px] text-ink-500">
            {(rep.durationMs / 1000).toFixed(0)}s rep · composite
          </p>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={rep.audioUrl}
        preload="metadata"
        onEnded={onEnded}
        className="sr-only"
      >
        <track kind="captions" />
      </audio>
    </div>
  );
}

function elapsedBetween(a: Date, b: Date): string {
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  if (days < 1) return "Less than a day";
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30)} months`;
}
