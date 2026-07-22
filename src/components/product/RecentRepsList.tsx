"use client";

import { useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import type { RelistenRep } from "@/lib/db/queries/progress";

type Props = {
  reps: RelistenRep[];
};

/**
 * Progress "Recent reps" list with relisten playback. Each rep row shows its
 * prompt, timestamp/length, and composite score; reps that have stored audio
 * get a play button so the user can hear how they did. Only one clip plays at
 * a time — a single <audio> element whose src is swapped to the active rep.
 */
export function RecentRepsList({ reps }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  function toggle(rep: RelistenRep) {
    const a = audioRef.current;
    if (!a || !rep.audioUrl) return;
    if (playingId === rep.id) {
      a.pause();
      setPlayingId(null);
      return;
    }
    // Swap source to the tapped rep and restart from the top.
    a.src = rep.audioUrl;
    a.currentTime = 0;
    void a.play().catch(() => setPlayingId(null));
    setPlayingId(rep.id);
  }

  return (
    <>
      <ul className="mt-4 divide-y divide-ink-100 dark:divide-ink-700">
        {reps.map((rep) => {
          const isPlaying = playingId === rep.id;
          const hasAudio = !!rep.audioUrl;
          return (
            <li
              key={rep.id}
              className="flex items-center gap-3 py-3 text-sm"
            >
              {hasAudio ? (
                <button
                  type="button"
                  onClick={() => toggle(rep)}
                  aria-label={isPlaying ? "Pause rep" : "Play rep"}
                  aria-pressed={isPlaying}
                  className={`grid size-9 shrink-0 place-items-center rounded-full shadow-sm transition hover:brightness-110 ${
                    isPlaying
                      ? "brand-gradient text-white"
                      : "bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900"
                  }`}
                >
                  {isPlaying ? (
                    <Pause className="size-4" strokeWidth={2.5} />
                  ) : (
                    <Play className="size-4 translate-x-0.5" strokeWidth={2.5} />
                  )}
                </button>
              ) : (
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-ink-200 text-ink-300 dark:border-ink-700 dark:text-ink-600"
                  aria-hidden="true"
                  title="No audio saved for this rep"
                >
                  <Play className="size-4 translate-x-0.5" strokeWidth={2} />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 break-words font-medium text-ink-800 dark:text-ink-100">
                  {rep.promptText}
                </p>
                <p className="mt-0.5 break-words text-[11px] text-ink-400 dark:text-ink-500">
                  {new Date(rep.createdAt).toLocaleString()} ·{" "}
                  {(rep.durationMs / 1000).toFixed(0)}s
                </p>
              </div>

              <div className="shrink-0 text-right">
                <span className="brand-gradient-text text-lg font-extrabold tabular-nums">
                  {Math.round(rep.compositeScore)}
                </span>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                  score
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {/* One shared player — src is swapped to whichever rep is playing. */}
      <audio
        ref={audioRef}
        preload="none"
        onEnded={() => setPlayingId(null)}
        className="sr-only"
      >
        <track kind="captions" />
      </audio>
    </>
  );
}
