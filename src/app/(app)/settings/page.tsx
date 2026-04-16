import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import { SettingsClient } from "./SettingsClient";

export const metadata: Metadata = {
  title: "Settings",
  description: "Update your profile, personas, and improvement goals.",
};

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/");

  const profile = await getUserProfile(user.id);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Profile
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ink-900">
          Settings
        </h1>
        <p className="mt-3 text-base text-ink-600">
          Update your profile and the signals that personalize your workouts.
          Each section saves independently.
        </p>
      </header>

      {profile && !profile.vertical && (
        <div className="mt-8 rounded-2xl border border-brand-purple/30 bg-brand-purple/5 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            Setup incomplete
          </p>
          <p className="mt-1 text-sm font-bold text-ink-900">
            You skipped the 4-step onboarding.
          </p>
          <p className="mt-1 text-sm text-ink-600">
            Finish it to personalize your workouts — 2 minutes, you can update
            anything later.
          </p>
          <Link
            href="/onboarding/vertical"
            className="brand-gradient mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white"
          >
            Finish onboarding
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}

      <SettingsClient
        initialVertical={profile?.vertical ?? null}
        initialPersonas={profile?.personas ?? []}
        initialGoals={profile?.improvementGoals ?? []}
      />

      {!profile && (
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          The database is unavailable, so changes won&rsquo;t persist in this
          session. Set <code className="font-mono text-xs">DATABASE_URL</code>{" "}
          in <code className="font-mono text-xs">.env.local</code> to enable
          persistence.
        </div>
      )}
    </div>
  );
}
