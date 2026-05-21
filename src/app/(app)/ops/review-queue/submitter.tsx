"use client";

import { useState } from "react";
import { Loader2, Star } from "lucide-react";

const VERDICTS = [
  { value: "confirmed_accurate", label: "Confirmed accurate" },
  { value: "should_be_lower", label: "Should be lower" },
  { value: "should_be_higher", label: "Should be higher" },
  { value: "skipped", label: "Skip — needs more context" },
] as const;

type Verdict = (typeof VERDICTS)[number]["value"];

export function ReviewSubmitter({
  repId,
  composite,
}: {
  repId: string;
  composite: number;
}) {
  const [verdict, setVerdict] = useState<Verdict>("confirmed_accurate");
  const [correctedComposite, setCorrectedComposite] = useState<string>(
    String(composite),
  );
  const [notes, setNotes] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [promoteStatus, setPromoteStatus] = useState<
    "idle" | "promoting" | "ok" | "error"
  >("idle");
  const [promoteError, setPromoteError] = useState<string | null>(null);

  const showCorrectedComposite =
    verdict === "should_be_lower" || verdict === "should_be_higher";

  async function handleSubmit() {
    setStatus("submitting");
    setError(null);
    const body: {
      verdict: Verdict;
      correctedComposite?: number;
      notes?: string;
    } = { verdict };
    if (showCorrectedComposite) {
      const n = Number.parseInt(correctedComposite, 10);
      if (Number.isFinite(n) && n >= 0 && n <= 100) {
        body.correctedComposite = n;
      }
    }
    if (notes.trim().length > 0) {
      body.notes = notes.trim();
    }
    try {
      const res = await fetch(`/api/ops/review-queue/${repId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(errBody.message ?? errBody.error ?? `HTTP ${res.status}`);
      }
      setStatus("ok");
      window.location.reload();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Submit failed");
    }
  }

  async function handlePromote() {
    if (
      !window.confirm(
        `Promote rep ${repId.slice(0, 8)}… into the few-shot exemplar bank? It will participate in Stage 2 retrieval immediately.`,
      )
    ) {
      return;
    }
    setPromoteStatus("promoting");
    setPromoteError(null);
    try {
      const res = await fetch(`/api/ops/exemplar-bank`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repId,
          notes: notes.trim() || null,
          band: verdict === "confirmed_accurate" ? "confirmed" : "promoted",
        }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(errBody.message ?? errBody.error ?? `HTTP ${res.status}`);
      }
      setPromoteStatus("ok");
      setTimeout(() => setPromoteStatus("idle"), 1500);
    } catch (err) {
      setPromoteStatus("error");
      setPromoteError(err instanceof Error ? err.message : "Promotion failed");
    }
  }

  return (
    <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
      <select
        value={verdict}
        onChange={(e) => setVerdict(e.target.value as Verdict)}
        disabled={status === "submitting"}
        className="rounded-md border border-ink-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-ink-700"
      >
        {VERDICTS.map((v) => (
          <option key={v.value} value={v.value}>
            {v.label}
          </option>
        ))}
      </select>
      {showCorrectedComposite && (
        <input
          type="number"
          min={0}
          max={100}
          value={correctedComposite}
          onChange={(e) => setCorrectedComposite(e.target.value)}
          placeholder="Corrected composite (0-100)"
          className="w-32 rounded-md border border-ink-200 bg-white px-3 py-1.5 text-[13px] tabular-nums text-ink-700"
        />
      )}
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        className="rounded-md border border-ink-200 bg-white px-3 py-1.5 text-[13px] text-ink-700"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={status === "submitting"}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-purple px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-brand-purple/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "submitting" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Submitting…
            </>
          ) : (
            "Submit verdict"
          )}
        </button>
        <button
          type="button"
          onClick={handlePromote}
          disabled={promoteStatus === "promoting"}
          title="Embed this rep's transcript and add it to the few-shot exemplar bank (Stage 2 retrieval)."
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-brand-purple/40 bg-brand-purple/10 px-3 py-1.5 text-[12px] font-semibold text-brand-purple hover:bg-brand-purple/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {promoteStatus === "promoting" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Star className="size-3.5" />
          )}
          {promoteStatus === "ok" ? "Promoted" : "Promote to bank"}
        </button>
      </div>
      {error && (
        <p className="text-[11px] text-danger md:col-span-3">{error}</p>
      )}
      {promoteError && (
        <p className="text-[11px] text-danger md:col-span-3">
          Promotion: {promoteError}
        </p>
      )}
    </div>
  );
}
