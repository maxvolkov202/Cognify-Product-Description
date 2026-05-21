"use client";

import { useState } from "react";
import { Loader2, Play, Copy } from "lucide-react";

type Status = "idle" | "running" | "ok" | "error";

type ScoreResult = {
  composite: number;
  modelVersion: string;
  headline: string;
  dimensions: { dimension: string; score: number }[];
  callouts?: { dimension: string; title: string; body: string }[];
  clientLatencyMs: number;
};

/** Operator-only inline replay button.
 *
 *  POSTs the reference rep's transcript through /api/score and renders
 *  the result in-page so the operator can verify scoring quality
 *  without recording a fresh rep in the browser. Uses the same /api/score
 *  endpoint the product uses — including all current FF gates + provider
 *  routing — so the result reflects real scoring behavior. */
export function ReplayRepButton({
  rep,
}: {
  rep: {
    id: string;
    promptText: string;
    transcript: string;
    durationMs: number;
  };
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setStatus("running");
    setError(null);
    setResult(null);
    const t0 = Date.now();
    try {
      const res = await fetch(`/api/score`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcript: rep.transcript,
          promptText: rep.promptText,
          durationMs: rep.durationMs,
        }),
      });
      const clientLatencyMs = Date.now() - t0;
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
      }
      const score = (await res.json()) as ScoreResult;
      setResult({ ...score, clientLatencyMs });
      setStatus("ok");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Score failed");
    }
  }

  async function copyJson() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    } catch {
      // No-op — clipboard unsupported in this context.
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={run}
        disabled={status === "running"}
        className="inline-flex items-center gap-1.5 rounded-md border border-brand-purple/30 bg-brand-purple/10 px-2.5 py-1 text-[11px] font-semibold text-brand-purple hover:bg-brand-purple/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "running" ? (
          <>
            <Loader2 className="size-3 animate-spin" />
            Scoring…
          </>
        ) : (
          <>
            <Play className="size-3" />
            {status === "ok" ? "Re-score" : "Score this rep"}
          </>
        )}
      </button>
      {error && (
        <p className="text-[10px] text-danger" title={error}>
          {error.slice(0, 80)}
        </p>
      )}
      {result && (
        <div className="mt-1 rounded-md border border-brand-purple/20 bg-brand-purple/5 p-2 text-[10px]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-brand-purple">
              Result · {result.clientLatencyMs}ms
            </span>
            <button
              type="button"
              onClick={copyJson}
              className="inline-flex items-center gap-0.5 text-[9px] text-ink-500 hover:text-ink-700"
              title="Copy full JSON to clipboard"
            >
              <Copy className="size-2.5" />
              copy
            </button>
          </div>
          <p className="mt-1 text-base font-extrabold tabular-nums text-ink-900">
            {result.composite}
          </p>
          <p className="mt-0.5 italic text-ink-700">
            &ldquo;{result.headline}&rdquo;
          </p>
          <p className="mt-1 font-mono text-[9px] text-ink-500">
            {result.dimensions
              .map((d) => `${d.dimension.slice(0, 4)}=${d.score}`)
              .join(" ")}
          </p>
          <p className="mt-1 font-mono text-[9px] text-ink-400">
            {result.modelVersion}
          </p>
        </div>
      )}
    </div>
  );
}
