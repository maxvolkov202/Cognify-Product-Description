"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  /** Initial duration estimate (ms) until <audio> loadedmetadata refines it. */
  durationMs: number;
  /** Forwarded to the underlying <audio> so parent (FeedbackPanel) can
   *  expose seek control via context. */
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
};

/** Custom audio scrubber. Native <audio> handles loading; we own the UI:
 *  gradient play/pause + range scrubber + tabular time. Keyboard: space
 *  toggles play, arrow keys seek ±5s. */
export function RepAudioScrubber({ src, durationMs, audioRef }: Props) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationMs / 1000);
  const localRef = useRef<HTMLAudioElement | null>(null);

  // Pipe localRef -> the parent-supplied ref so seekToMs() works.
  useEffect(() => {
    audioRef.current = localRef.current;
    return () => {
      audioRef.current = null;
    };
  }, [audioRef]);

  const togglePlay = () => {
    const a = localRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch(() => {});
    } else {
      a.pause();
    }
  };

  const handleSeek = (sec: number) => {
    const a = localRef.current;
    if (!a) return;
    const clamped = Math.max(0, Math.min(duration, sec));
    a.currentTime = clamped;
    setCurrentTime(clamped);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.code === "Space") {
      e.preventDefault();
      togglePlay();
    } else if (e.code === "ArrowLeft") {
      e.preventDefault();
      handleSeek(currentTime - 5);
    } else if (e.code === "ArrowRight") {
      e.preventDefault();
      handleSeek(currentTime + 5);
    }
  };

  const cur = formatTime(currentTime);
  const tot = formatTime(duration);

  return (
    <div
      className="surface-card flex items-center gap-4 p-4"
      onKeyDown={handleKey}
    >
      <audio
        ref={localRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => {
          if (localRef.current && Number.isFinite(localRef.current.duration)) {
            setDuration(localRef.current.duration);
          }
        }}
        onTimeUpdate={() => {
          if (localRef.current) setCurrentTime(localRef.current.currentTime);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />

      <button
        type="button"
        onClick={togglePlay}
        className="brand-gradient grid size-11 shrink-0 place-items-center rounded-full text-white shadow-[0_8px_20px_-8px_rgba(151,136,255,0.6)] transition-transform active:scale-95"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <Pause className="size-5" strokeWidth={2.5} />
        ) : (
          <Play className="size-5 translate-x-0.5" strokeWidth={2.5} />
        )}
      </button>

      <input
        type="range"
        min={0}
        max={duration}
        step={0.1}
        value={currentTime}
        onChange={(e) => handleSeek(Number(e.target.value))}
        className="flex-1 accent-brand-purple"
        aria-label="Seek"
      />

      <p className="shrink-0 text-xs tabular-nums text-ink-500">
        {cur} / {tot}
      </p>
    </div>
  );
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
