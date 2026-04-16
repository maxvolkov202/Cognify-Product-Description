"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Swords, ArrowRight } from "lucide-react";
import { RepSurface } from "./RepSurface";
import { submitChallengeRepAction } from "@/server/actions/friends";

type Props = {
  challengeId: string;
  prompt: string;
  opponentName: string;
};

/**
 * Client-side recorder for a friend challenge. Wraps RepSurface and,
 * on rep complete, links the persisted rep to the challenge via
 * submitChallengeRepAction. Transitions the server-side state and
 * navigates to the appropriate next view (waiting or results).
 */
export function ChallengeRunner({ challengeId, prompt, opponentName }: Props) {
  const [phase, setPhase] = useState<"intro" | "recording" | "submitting">(
    "intro",
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  if (phase === "intro") {
    return (
      <div className="mt-6 surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-8">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            Ready to record?
          </p>
          <h2 className="mt-2 text-2xl font-extrabold text-ink-900">
            Your turn to answer — head-to-head vs. {opponentName}.
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-ink-700">
            <li>· You and {opponentName} both record to the exact same prompt.</li>
            <li>· Same rubric, same six dimensions, transparent scoring.</li>
            <li>· Winner declared once both sides are in.</li>
          </ul>
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPhase("recording")}
              className="brand-gradient inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-sm"
            >
              <Swords className="size-4" />
              Record my rep
              <ArrowRight className="size-4" />
            </button>
            <p className="text-xs text-ink-500">No retries — this one counts.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <RepSurface
        prompt={prompt}
        mode="scenario_training"
        topic="Head-to-head challenge"
        maxDurationMs={90_000}
        onComplete={({ repId }) => {
          setPhase("submitting");
          setError(null);
          startTransition(async () => {
            const result = await submitChallengeRepAction({
              challengeId,
              repId,
            });
            if (!result.ok) {
              setError("Couldn't link your rep to the challenge — refresh to retry.");
              setPhase("recording");
              return;
            }
            router.refresh();
          });
        }}
      />
      {phase === "submitting" && (
        <p className="text-center text-sm text-ink-500">
          Locking in your rep…
        </p>
      )}
      {error && (
        <p className="text-center text-sm text-danger">{error}</p>
      )}
    </div>
  );
}
