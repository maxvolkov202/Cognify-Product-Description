"use client";

/**
 * Prosody v2 Phase 4 (P4) — the "Measured delivery" strip inside the grading
 * skeleton. Renders at transcript-ready with the same measurements the scorer
 * uses (pace, fillers via the scored lexicon, long pauses) and fills in pitch
 * variety when the upload-time prosody warm resolves. Display-only; the flag
 * is server-resolved and rides /api/rep-metrics — with FF_LIVE_REP_METRICS
 * off the first response says so and this renders nothing at all.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { extractInlineProsody } from "@/lib/audio/prosody-inline";
import { buildLiveDeliveryMetrics, describePitchVariety } from "@/lib/audio/live-metrics";
import { timeoutSignal } from "@/lib/util/timeout-signal";
import { AudioLines } from "lucide-react";

const POLL_BASE_MS = 1500;
const POLL_MAX_MS = 5000;
const POLL_BUDGET_MS = 25_000;
const FETCH_TIMEOUT_MS = 3000;

type Props = {
  words: { word: string; startMs: number; endMs: number }[];
  durationMs: number;
  /** Storage path once the upload settles; null until then. */
  audioPath: string | null;
};

type MetricsResponse = {
  enabled: boolean;
  state?: "unavailable" | "pending" | "failed" | "ready";
  pitchStdSemitones?: number | null;
  monotoneRatio?: number | null;
  monotoneWindowed?: boolean | null;
};

export function MeasuredDeliveryStrip({ words, durationMs, audioPath }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pitch, setPitch] = useState<string | null>(null);
  const [pitchSettled, setPitchSettled] = useState(false);
  // Budget anchored at MOUNT (one strip per rep) — restarting the effect when
  // audioPath lands must not grant a fresh window.
  const mountedAtRef = useRef(Date.now());

  const inline = useMemo(
    () => (words.length > 0 ? extractInlineProsody({ words, durationMs }) : null),
    [words, durationMs],
  );
  const metrics = useMemo(
    () => (inline ? buildLiveDeliveryMetrics(inline, { words, durationMs }) : null),
    [inline, words, durationMs],
  );

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    const poll = async () => {
      try {
        const qs = audioPath ? `?path=${encodeURIComponent(audioPath)}` : "";
        // Bounded like every pre-score fetch in RepSurface: a stalled request
        // must throw into the retry path, never wedge the loop.
        const res = await fetch(`/api/rep-metrics${qs}`, { signal: timeoutSignal(FETCH_TIMEOUT_MS) });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as MetricsResponse;
        if (cancelled) return;
        setEnabled(data.enabled);
        if (!data.enabled) return;
        if (data.state === "ready") {
          setPitch(
            describePitchVariety(data.pitchStdSemitones, data.monotoneRatio, data.monotoneWindowed),
          );
          setPitchSettled(true);
          return;
        }
        if (data.state === "failed" || data.state === "unavailable") {
          setPitchSettled(true);
          return;
        }
      } catch {
        // Transient (timeout, blip) — retry within budget.
      }
      if (cancelled) return;
      if (Date.now() - mountedAtRef.current > POLL_BUDGET_MS) {
        setPitchSettled(true);
        return;
      }
      attempt += 1;
      timer = setTimeout(poll, Math.min(POLL_MAX_MS, POLL_BASE_MS * 1.3 ** attempt));
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [audioPath]);

  if (enabled !== true || !metrics) return null;

  const chips = [metrics.paceLabel, metrics.fillerLabel, metrics.pauseLabel].filter(
    (c): c is string => c != null,
  );
  return (
    <div
      data-testid="measured-delivery"
      className="surface-card flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-xs text-ink-600 dark:text-ink-300"
    >
      <span className="inline-flex items-center gap-1.5 font-semibold text-ink-700 dark:text-ink-200">
        <AudioLines className="size-3.5 text-brand-purple" />
        Measured from your recording
      </span>
      {chips.map((c) => (
        <span key={c} className="whitespace-nowrap">
          {c}
        </span>
      ))}
      {(pitch ?? !pitchSettled) && (
        <span className="whitespace-nowrap">{pitch ?? "Listening for pitch variety…"}</span>
      )}
    </div>
  );
}
