import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { currentUser } from "@/lib/session/current-user";
import { getFriendsForUser } from "@/lib/db/queries/friends";
import { ChallengeCreator } from "@/components/product/ChallengeCreator";

export const dynamic = "force-dynamic";

export default async function NewChallengePage() {
  const me = await currentUser();
  if (!me) redirect("/signin");

  const friends = await getFriendsForUser(me.id);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link
        href="/friends"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="size-4" />
        Back to friends
      </Link>

      <div className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          Head-to-head challenge
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink-900 md:text-4xl">
          Pick a friend, pick a prompt.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink-600">
          Both of you record the same prompt. Scores go head-to-head on the
          same rubric. First to record locks the prompt — opponent gets
          notified when it&rsquo;s their turn.
        </p>
      </div>

      <ChallengeCreator friends={friends} />
    </div>
  );
}
