import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import { BaselineRep } from "@/components/product/BaselineRep";

export const metadata: Metadata = {
  title: "Your baseline rep · Cognify",
};

export default async function BaselinePage() {
  const user = await currentUser();
  if (!user) redirect("/signin");
  const profile = await getUserProfile(user.id);
  // Already have a baseline — don't re-run.
  if (profile?.baselineRepId) redirect("/tutorial");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          Step 4 of 4 · Your baseline
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900 md:text-4xl">
          One rep to start.
        </h1>
        <p className="mt-3 max-w-xl text-base text-ink-600 md:text-lg">
          60 seconds. Tell us about yourself. This is your baseline — every rep
          after this gets measured against it.
        </p>
      </div>
      <BaselineRep />
    </div>
  );
}
