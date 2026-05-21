"use client";

import { useState } from "react";
import { Loader2, Trash2, Save } from "lucide-react";

type Status = "idle" | "saving" | "ok" | "error";

export function ExemplarRowControls({
  refId,
  initialNotes,
}: {
  refId: string;
  initialNotes: string | null;
}) {
  const [notes, setNotes] = useState<string>(initialNotes ?? "");
  const [notesStatus, setNotesStatus] = useState<Status>("idle");
  const [demoteStatus, setDemoteStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function saveNotes() {
    setNotesStatus("saving");
    setError(null);
    try {
      const trimmed = notes.trim();
      const res = await fetch(`/api/ops/exemplar-bank/${refId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: trimmed.length > 0 ? trimmed : null }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
      }
      setNotesStatus("ok");
      setTimeout(() => setNotesStatus("idle"), 1200);
    } catch (err) {
      setNotesStatus("error");
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function demote() {
    if (
      !window.confirm(
        `Demote "${refId}"? This removes it from the few-shot exemplar bank. You can re-promote later from the source rep.`,
      )
    ) {
      return;
    }
    setDemoteStatus("saving");
    setError(null);
    try {
      const res = await fetch(`/api/ops/exemplar-bank/${refId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
      }
      setDemoteStatus("ok");
      window.location.reload();
    } catch (err) {
      setDemoteStatus("error");
      setError(err instanceof Error ? err.message : "Demote failed");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Operator notes (optional) — why this is a useful exemplar…"
          rows={2}
          className="w-full resize-y rounded-md border border-ink-200 bg-white px-2 py-1 text-[12px] text-ink-700"
        />
        <button
          type="button"
          onClick={saveNotes}
          disabled={notesStatus === "saving"}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-brand-purple/30 bg-brand-purple/10 px-2.5 py-1.5 text-[11px] font-semibold text-brand-purple hover:bg-brand-purple/15 disabled:opacity-60"
          title="Save notes"
        >
          {notesStatus === "saving" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Save className="size-3" />
          )}
          {notesStatus === "ok" ? "Saved" : "Save"}
        </button>
      </div>
      <button
        type="button"
        onClick={demote}
        disabled={demoteStatus === "saving"}
        className="inline-flex w-fit items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
      >
        {demoteStatus === "saving" ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Trash2 className="size-3" />
        )}
        Demote
      </button>
      {error && <p className="text-[10px] text-danger">{error.slice(0, 80)}</p>}
    </div>
  );
}

export function PromoteByRepIdForm() {
  const [repId, setRepId] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [band, setBand] = useState<string>("promoted");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function promote() {
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch(`/api/ops/exemplar-bank`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repId: repId.trim(),
          notes: notes.trim() || null,
          band: band.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
      }
      setStatus("ok");
      window.location.reload();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Promotion failed");
    }
  }

  return (
    <div className="surface-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
        Promote a rep
      </p>
      <p className="mt-1 text-[12px] text-ink-600">
        Paste a rep UUID to embed its transcript and add it to the few-shot
        exemplar bank. Stage 2 scoring will retrieve it when a future rep
        is shape-similar.
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-[2fr_1fr_2fr_auto]">
        <input
          type="text"
          value={repId}
          onChange={(e) => setRepId(e.target.value)}
          placeholder="Rep UUID (e.g. 9d1f…-…-…)"
          className="rounded-md border border-ink-200 bg-white px-3 py-1.5 font-mono text-[12px] text-ink-700"
        />
        <input
          type="text"
          value={band}
          onChange={(e) => setBand(e.target.value)}
          placeholder="Band tag"
          className="rounded-md border border-ink-200 bg-white px-3 py-1.5 text-[12px] text-ink-700"
        />
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="rounded-md border border-ink-200 bg-white px-3 py-1.5 text-[12px] text-ink-700"
        />
        <button
          type="button"
          onClick={promote}
          disabled={status === "saving" || repId.trim().length < 10}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-brand-purple px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-purple/90 disabled:opacity-60"
        >
          {status === "saving" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            "Promote"
          )}
        </button>
      </div>
      {error && <p className="mt-2 text-[11px] text-danger">{error}</p>}
    </div>
  );
}
