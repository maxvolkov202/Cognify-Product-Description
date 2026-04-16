"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Swords, ArrowRight, Users } from "lucide-react";
import type { FriendRow } from "@/lib/db/queries/friends";
import { createChallengeAction } from "@/server/actions/friends";
import { cn } from "@/lib/utils/cn";

const PROMPT_SUGGESTIONS = [
  "Pitch a 20% budget increase to your VP of Finance",
  "Explain a two-week product delay to a frustrated enterprise client",
  "Convince your team to adopt a new tool that replaces their current workflow",
  "Present quarterly results that missed target by 8% — frame what's next",
  "Give a 60-second elevator pitch for your product to a stranger at a conference",
  "Deliver tough feedback to a peer whose deliverables have been slipping",
  "Explain a complex technical concept to a non-technical stakeholder",
  "Ask your manager for a promotion using specific evidence",
];

export function ChallengeCreator({ friends }: { friends: FriendRow[] }) {
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (friends.length === 0) {
    return (
      <div className="mt-8 surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-8 text-center">
          <Users className="mx-auto size-8 text-brand-purple" />
          <p className="mt-3 text-base font-bold text-ink-900">
            You don&rsquo;t have any friends on Cognify yet.
          </p>
          <p className="mt-2 text-sm text-ink-600">
            Invite someone from the friends page — as soon as one accepts,
            you can challenge them.
          </p>
        </div>
      </div>
    );
  }

  function submit() {
    if (!opponentId || prompt.trim().length < 5) return;
    setError(null);
    startTransition(async () => {
      const result = await createChallengeAction({
        opponentId: opponentId as string,
        prompt: prompt.trim(),
      });
      if (!result.ok) {
        setError(
          result.error === "not_found"
            ? "That friend isn't available — pick another."
            : result.error === "invalid_input"
              ? "Prompt is too short."
              : "Couldn't create the challenge. Try again.",
        );
        return;
      }
      router.push(`/friends/challenge/${result.data.id}`);
    });
  }

  return (
    <div className="mt-8 space-y-6">
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          1. Pick your opponent
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {friends.map((f) => (
            <button
              key={f.userId}
              type="button"
              onClick={() => setOpponentId(f.userId)}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-white p-3 text-left transition",
                opponentId === f.userId
                  ? "border-brand-purple bg-brand-purple/5 shadow-sm ring-2 ring-brand-purple/20"
                  : "border-ink-200 hover:border-ink-300",
              )}
            >
              <div className="brand-gradient grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white">
                {initials(f.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-900">
                  {f.name ?? f.email ?? "Friend"}
                </p>
                <p className="text-[11px] text-ink-500">
                  {f.composite != null ? `${f.composite} composite` : "No reps yet"}
                  {" · "}
                  {f.totalReps} reps
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          2. Pick a prompt
        </p>
        <div className="mt-3 grid gap-2">
          {PROMPT_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPrompt(s)}
              className={cn(
                "rounded-xl border bg-white px-4 py-3 text-left text-sm transition",
                prompt === s
                  ? "border-brand-purple bg-brand-purple/5 shadow-sm ring-2 ring-brand-purple/20"
                  : "border-ink-200 hover:border-ink-300",
              )}
            >
              {s}
            </button>
          ))}
          <div className="mt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Or write your own
            </p>
            <textarea
              value={
                PROMPT_SUGGESTIONS.includes(prompt) ? "" : prompt
              }
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              placeholder="Describe a specific scenario both of you'll answer…"
              className="mt-1 w-full resize-none rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/15"
            />
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={
            !opponentId || prompt.trim().length < 5 || isPending
          }
          className="brand-gradient inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Swords className="size-4" />
          {isPending ? "Creating…" : "Create challenge"}
          <ArrowRight className="size-4" />
        </button>
        <p className="text-xs text-ink-500">
          You&rsquo;ll record first. Your opponent gets a notification when
          it&rsquo;s their turn.
        </p>
      </div>
    </div>
  );
}

function initials(name: string | null): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
