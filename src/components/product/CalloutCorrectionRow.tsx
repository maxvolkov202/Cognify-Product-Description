"use client";

import { useState, useTransition } from "react";
import { ThumbsUp, X, Edit3, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  correctCalloutAction,
  type CalloutVerdict,
} from "@/server/actions/feedback-learning";
import { cn } from "@/lib/utils/cn";

type State =
  | { kind: "idle" }
  | { kind: "editing" }
  | { kind: "submitting" }
  | { kind: "done"; verdict: CalloutVerdict }
  | { kind: "error"; message: string };

type Props = {
  calloutId: string;
  originalQuote: string | null;
  originalRewrite: string | null;
};

/**
 * Small row under each callout: Spot on / Off-base / Edit. The verdict
 * feeds `calloutCorrections`, which feeds the user's calibration profile,
 * which feeds the next rep's scoring prompt. Full loop: one rep's wrong
 * call quietly teaches Claude what the user's voice actually does.
 */
export function CalloutCorrectionRow({
  calloutId,
  originalQuote,
  originalRewrite,
}: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [quote, setQuote] = useState(originalQuote ?? "");
  const [rewrite, setRewrite] = useState(originalRewrite ?? "");
  const [isPending, startTransition] = useTransition();

  function submit(
    verdict: CalloutVerdict,
    withEdits: boolean = false,
  ) {
    setState({ kind: "submitting" });
    startTransition(async () => {
      const result = await correctCalloutAction({
        calloutId,
        verdict,
        correctedQuote: withEdits ? quote.trim() || undefined : undefined,
        correctedRewrite: withEdits ? rewrite.trim() || undefined : undefined,
      });
      if (result.ok) {
        setState({ kind: "done", verdict });
      } else {
        setState({ kind: "error", message: "Couldn't save. Try again." });
      }
    });
  }

  if (state.kind === "done") {
    return (
      <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-ink-500">
        <CheckCircle2 className="size-3 text-success" />
        {state.verdict === "agree"
          ? "Logged — spot on."
          : state.verdict === "wrong"
            ? "Logged — Cognify will bias away from this on your next rep."
            : "Logged — less of this on your next rep."}
      </div>
    );
  }

  if (state.kind === "editing") {
    return (
      <div className="mt-3 rounded-xl border border-ink-200 bg-white p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
          Tune this callout
        </p>
        <label className="mt-2 block">
          <span className="text-[10px] font-semibold text-ink-500">
            Quote you actually said
          </span>
          <input
            type="text"
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            maxLength={300}
            placeholder="What you actually said"
            className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/15"
          />
        </label>
        <label className="mt-2 block">
          <span className="text-[10px] font-semibold text-ink-500">
            Your better phrasing (optional)
          </span>
          <input
            type="text"
            value={rewrite}
            onChange={(e) => setRewrite(e.target.value)}
            maxLength={300}
            placeholder="How you'd say it next time"
            className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/15"
          />
        </label>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setState({ kind: "idle" })}
            disabled={isPending}
            className="text-[11px] font-semibold text-ink-500 hover:text-ink-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => submit("not_relevant", true)}
            disabled={isPending}
            className="brand-gradient rounded-full px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
          >
            Save correction
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
        Accurate?
      </span>
      <button
        type="button"
        onClick={() => submit("agree")}
        disabled={state.kind === "submitting"}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-ink-200 px-2 py-0.5 text-[10px] font-semibold text-ink-600 transition",
          "hover:border-success/40 hover:bg-success/5 hover:text-success",
          state.kind === "submitting" && "opacity-50",
        )}
      >
        <ThumbsUp className="size-3" />
        Spot on
      </button>
      <button
        type="button"
        onClick={() => submit("wrong")}
        disabled={state.kind === "submitting"}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-ink-200 px-2 py-0.5 text-[10px] font-semibold text-ink-600 transition",
          "hover:border-danger/40 hover:bg-danger/5 hover:text-danger",
          state.kind === "submitting" && "opacity-50",
        )}
      >
        <X className="size-3" />
        Off-base
      </button>
      <button
        type="button"
        onClick={() => setState({ kind: "editing" })}
        disabled={state.kind === "submitting"}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-ink-200 px-2 py-0.5 text-[10px] font-semibold text-ink-600 transition",
          "hover:border-brand-purple/40 hover:bg-brand-purple/5 hover:text-brand-purple",
        )}
      >
        <Edit3 className="size-3" />
        Edit
      </button>
      {state.kind === "error" && (
        <span className="inline-flex items-center gap-1 text-[10px] text-danger">
          <AlertTriangle className="size-3" />
          {state.message}
        </span>
      )}
    </div>
  );
}
