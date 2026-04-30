import type { Metadata } from "next";
import { BuildARepFlow } from "@/components/product/BuildARepFlow";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import { pickVerticalPromptObjects } from "@/lib/ai/prompts/verticals";
import { getSeenPromptIds } from "@/lib/db/queries/prompt-history";
import { VERTICALS, type VerticalId } from "@/lib/onboarding/constants";

export const metadata: Metadata = {
  title: "Build a Rep",
  description:
    "Describe a real situation you're about to face. Get a thinking structure. Practice it before the moment.",
};

export const dynamic = "force-dynamic";

export default async function BuildARepPage() {
  // Resolve user + vertical. Guests and users who skipped onboarding
  // fall through to the "other" vertical with general prompts.
  const user = await currentUser();
  const profile = user ? await getUserProfile(user.id) : null;
  const vertical: VerticalId = profile?.vertical ?? "other";
  const verticalLabel =
    VERTICALS.find((v) => v.id === vertical)?.label ?? "General";
  const seenIds = user ? await getSeenPromptIds(user.id) : [];
  const excludeSet = new Set(seenIds);
  const initialPicked = pickVerticalPromptObjects(vertical, 5, {
    excludeIds: excludeSet,
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
