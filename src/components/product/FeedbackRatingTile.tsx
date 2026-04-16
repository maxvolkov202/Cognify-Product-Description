"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, AlertTriangle, ThumbsUp, Target, X } from "lucide-react";
import {
  rateFeedbackAction,
  type RatingValue,
} from "@/server/actions/feedback-learning";
import { cn } from "@/lib/utils/cn";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ok"; value: RatingValue }
  | { kind: "error" };

const RATINGS: Array<{
  value: RatingValue;
  label: string;
  icon: React.ReactNode;
  tone: string;
  description: string;
}> = [
  {
    value: "nailed_it",
    label: "Nailed it",
    icon: <ThumbsUp className="size-4" />,
    tone: "text-success hover:bg-success/5 hover:border-success/40",
    description: "The feedback matched your own read of the rep.",
  },
  {
    value: "kinda_off",
    label: "Kinda off",
    icon: <Target className="size-4" />,
    tone: "text-brand-purple hover:bg-brand-purple/5 hover:border-brand-purple/40",
    description: "Some of it landed, some of it didn't.",
  },
  {
    value: "wrong",
    label: "Wrong",
    icon: <X className="size-4" />,
    tone: "text-danger hover:bg-danger/5 hover:border-danger/40",
    description: "The feedback missed the real issues.",
  },
];

/**
 * "Was this feedback accurate?" tile shown at the bottom of FeedbackPanel.
 * The rating + optional note feeds the per-user calibration profile — next
 * time this user gets scored, Claude sees their prior verdicts and adjusts.
 */
export function FeedbackRatingTile({ repId }: { repId: string | null }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [expanded, setExpanded] = useState<RatingValue | null>(null);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!repId) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-5 py-4 text-xs text-ink-500">
        Rate this feedback after sign-in to personalize future scoring.
      </div>
    );
  }

  function submit(rating: RatingValue, withNote: string = "") {
    setStatus({ kind: "submitting" });
    startTransition(async () => {
      const result = await rateFeedbackAction({
        repId: repId as string,
        rating,
        note: withNote || undefined,
      });
      if (result.ok) {
        setStatus({ kind: "ok", value: rating });
        setExpanded(null);
        setNote("");
      } else {
        setStatus({ kind: "error" });
      }
    });
  }

  if (status.kind === "ok") {
    const chosen = RATINGS.find((r) => r.value === status.value)!;
    return (
      <div className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="flex items-center gap-3 p-4">
          <CheckCircle2 className="size-5 text-success" />
          <div className="flex-1">
            <p className="text-sm font-bold text-ink-900">
              Thanks — logged as &ldquo;{chosen.label}&rdquo;.
            </p>
            <p className="text-xs text-ink-600">
              Your next rep&rsquo;s scoring will take this into account.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStatus({ kind: "idle" })}
            className="text-xs font-semibold text-ink-500 hover:text-ink-900"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="brand-gradient grid size-8 shrink-0 place-items-center rounded-lg text-white">
            <Target className="size-4" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
              Help the AI get sharper
            </p>
            <p className="mt-0.5 text-sm font-bold text-ink-900">
              Was this feedback accurate?
            </p>
            <p className="mt-0.5 text-xs text-ink-600">
              Your ratings calibrate future scoring to how you actually sound.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {RATINGS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => {
                if (expanded === r.value) {
                  submit(r.value);
                } else {
                  setExpanded(r.value);
                }
              }}
              disabled={isPending}
              className={cn(
                "flex items-start gap-2 rounded-xl border border-ink-200 bg-white p-3 text-left text-sm transition disabled:opacity-50",
                r.tone,
                expanded === r.value && "border-brand-purple ring-2 ring-brand-purple/20",
              )}
            >
              <span className="shrink-0 pt-0.5">{r.icon}</span>
              <span className="min-w-0">
                <span className="block font-semibold text-ink-900">
                  {r.label}
                </span>
                <span className="block text-[11px] text-ink-500">
                  {r.description}
                </span>
              </span>
            </button>
          ))}
        </div>

        {expanded && (
          <div className="mt-3 rounded-xl border border-ink-200 bg-ink-50/60 p-3">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Optional note (what was off?)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder={
                expanded === "wrong"
                  ? "e.g. The 'rushed pacing' call was wrong — I was deliberately slow there."
                  : expanded === "kinda_off"
                    ? "e.g. Structure was right, but the clarity call felt nitpicky."
                    : "e.g. Nailed the structure call — that's exactly what I wanted to fix."
              }
              className="mt-1.5 w-full resize-none rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs text-ink-800 focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/15"
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setExpanded(null);
                  setNote("");
                }}
                className="text-[11px] font-semibold text-ink-500 hover:text-ink-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submit(expanded, note)}
                disabled={isPending}
                className="brand-gradient rounded-full px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
              >
                {isPending ? "Saving…" : "Save rating"}
              </button>
            </div>
          </div>
        )}

        {status.kind === "error" && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
            <AlertTriangle className="size-3.5" />
            Couldn&rsquo;t save the rating. Try again?
          </div>
        )}
      </div>
    </div>
  );
}
