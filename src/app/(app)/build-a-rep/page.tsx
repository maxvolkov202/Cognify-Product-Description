import type { Metadata } from "next";
import { BuildARepFlow } from "@/components/product/BuildARepFlow";
import PrepHome from "@/components/product/build-a-rep-v2/PrepHome";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import { pickVerticalPrompts } from "@/server/actions/vertical-prompts";
import { getSeenPromptIds } from "@/lib/db/queries/prompt-history";
import { VERTICALS, type VerticalId } from "@/lib/onboarding/constants";
import { isBuildARepV2Enabled } from "@/lib/flags";
import { listPrepEvents } from "@/server/actions/prep-events";

export const metadata: Metadata = {
  title: "Build a Rep",
  description:
    "Describe the real communication event in front of you. Get a preparation plan. Practice until you're ready.",
};

export const dynamic = "force-dynamic";

export default async function BuildARepPage() {
  // PRD v3 Phase 5 — event preparation (PRD §7) under FF_BUILD_A_REP_V2.
  if (isBuildARepV2Enabled()) {
    const events = await listPrepEvents();
    return (
      <div className="relative min-h-[calc(100vh-4rem)] bg-gradient-to-b from-ink-50/40 via-white to-ink-50/30 dark:from-ink-900 dark:via-ink-900 dark:to-ink-900">
        <div className="mx-auto w-full max-w-4xl px-6 py-10 md:py-14">
          <PrepHome initialEvents={events} />
        </div>
      </div>
    );
  }

  // Legacy scenario flow — byte-identical when the flag is off.
  const user = await currentUser();
  const profile = user ? await getUserProfile(user.id) : null;
  const vertical: VerticalId = profile?.vertical ?? "other";
  const verticalLabel =
    VERTICALS.find((v) => v.id === vertical)?.label ?? "General";
  const seenIds = user ? await getSeenPromptIds(user.id) : [];
  const initialPicked = await pickVerticalPrompts({
    vertical,
    count: 5,
    excludePromptIds: seenIds,
  });
  const personas = profile?.personas ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <BuildARepFlow
        vertical={vertical}
        verticalLabel={verticalLabel}
        initialPrompts={initialPicked.map((p) => p.text)}
        initialPromptIds={initialPicked.map((p) => p.id)}
        personas={personas}
      />
    </div>
  );
}
