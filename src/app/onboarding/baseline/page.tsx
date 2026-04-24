import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Anchor } from "lucide-react";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import { BaselineRep } from "@/components/product/BaselineRep";
import {
  VERTICALS,
  PERSONAS,
  IMPROVEMENT_GOALS,
} from "@/lib/onboarding/constants";

export const metadata: Metadata = {
  title: "Your baseline rep · Cognify",
};

export default async function BaselinePage() {
  const user = await currentUser();
  if (!user) redirect("/signin");
  const profile = await getUserProfile(user.id);
  // Already have a baseline — don't re-run.
  if (profile?.baselineRepId) redirect("/tutorial");

  const verticalLabel =
    VERTICALS.find((v) => v.id === profile?.vertical)?.label ?? null;
  const personaLabels = (profile?.personas ?? [])
    .map((id) => PERSONAS.find((p) => p.id === id)?.label)
    .filter((v): v is string => Boolean(v));
  const goalLabels = (profile?.improvementGoals ?? [])
    .map((id) => IMPROVEMENT_GOALS.find((g) => g.id === id)?.label)
    .filter((v): v is string => Boolean(v));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          Step 4 of 4 · Your baseline
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900 md:text-4xl">
          One rep to start. This is the anchor.
        </h1>
        <p className="mt-3 max-w-xl text-base text-ink-600 md:text-lg">
          60 seconds. Tell us about yourself. Your baseline sets the anchor —
          every future rep gets measured against it, and you&rsquo;ll see your
          improvement curve build from this moment forward.
        </p>
      </div>

      {(verticalLabel || personaLabels.length > 0 || goalLabels.length > 0) && (
        <div className="surface-card mb-6 overflow-hidden">
          <div className="brand-gradient h-1" aria-hidden="true" />
          <div className="flex items-start gap-4 p-5">
            <div className="brand-gradient grid size-10 shrink-0 place-items-center rounded-xl shadow-sm">
              <Anchor
                className="size-5 text-white"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </div>
            <div className="flex-1 text-sm text-ink-700">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                Based on what you told us
              </p>
              <p className="mt-1 leading-relaxed">
                {verticalLabel ? (
                  <>
                    You&rsquo;re in <strong>{verticalLabel}</strong>
                    {personaLabels.length > 0 && (
                      <>
                        , talking to{" "}
                        <strong>{joinWithAnd(personaLabels)}</strong>
                      </>
                    )}
                    .
                  </>
                ) : (
                  "We'll use your baseline to shape every workout."
                )}{" "}
                {goalLabels.length > 0 && (
                  <>
                    We&rsquo;ll weight your workouts toward{" "}
                    <strong>{joinWithAnd(goalLabels.slice(0, 3))}</strong>.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <BaselineRep />
    </div>
  );
}

function joinWithAnd(items: readonly string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
