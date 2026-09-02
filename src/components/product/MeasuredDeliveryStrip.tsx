"use client";

/**
 * Prosody v2 Phase 4 (P4) — the "Measured delivery" strip inside the grading
 * skeleton. Renders at transcript-ready with the inline measurements the
 * scorer itself uses (pace, fillers, pauses) and fills in pitch variety when
 * the upload-time prosody warm resolves. Display-only; the flag is
 * server-resolved and rides /api/rep-metrics, so with FF_LIVE_REP_METRICS
 * off this component renders nothing at all.
 */
import { useEffect, useMemo, useState } from "react";
import { extractInlineProsody } from "@/lib/audio/prosody-inline";
import { buildLiveDeliveryMetrics, describePitchVariety } from "@/lib/audio/live-metrics";
import { AudioLines } from "lucide-react";

const POLL_INTERVAL_MS = 1500;
const POLL_BUDGET_MS = 25_000;

type Props = {
  words: { word: string; startMs: number; endMs: number }[];
  durationMs: number;
  /** Storage path once the upload settles; null until then. */
  audioPath: string | null;
};

type MetricsResponse = {
  enabled: boolean;
  ready?: boolean;
  pitchStdSemitones?: number | null;
  monotoneRatio?: number | null;
  monotoneWindowed?: boolean | null;
};

export function MeasuredDeliveryStrip({ words, durationMs, audioPath }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pitch, setPitch] = useState<string | null>(null);
  const [pitchSettled, setPitchSettled] = useState(false);

  const inline = useMemo(
    () => (words.length > 0 ? extractInlineProsody({ words, durationMs }) : null),
    [words, durationMs],
  );
  const metrics = useMemo(() => (inline ? buildLiveDeliveryMetrics(inline) : null), [inline]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const started = Date.now();
    const poll = async () => {
      try {
        const qs = audioPath ? `?path=${encodeURIComponent(audioPath)}` : "";
        const res = await fetch(`/api/rep-metrics${qs}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as MetricsResponse;
        if (cancelled) return;
        setEnabled(data.enabled);
        if (!data.enabled) return;
        if (data.ready) {
          setPitch(
            describePitchVariety(
              data.pitchStdSemitones,
              data.monotoneRatio,
              data.monotoneWindowed,
            ),
          );
          setPitchSettled(true);
          return;
        }
      } catch {
        // Transient — keep the inline chips; retry within budget.
      }
      if (cancelled || Date.now() - started > POLL_BUDGET_MS) {
        if (!cancelled) setPitchSettled(true); // stop advertising "measuring"
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [audioPath]);

  if (enabled === false || enabled === null || !metrics) return null;

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
      <span className="whitespace-nowrap">
        {pitch ?? (pitchSettled ? null : "Listening for pitch variety…")}
      </span>
    </div>
  );
}
