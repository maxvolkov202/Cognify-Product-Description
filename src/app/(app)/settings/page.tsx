import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import { SettingsClient } from "./SettingsClient";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

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
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
          Profile
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ink-900 dark:text-white">
          Settings
        </h1>
        <p className="mt-3 text-base text-ink-600 dark:text-ink-300">
          Update your profile and the signals that personalize your workouts.
          Each section saves independently.
        </p>
      </header>

      {profile && !profile.vertical && (
        <div className="mt-8 rounded-2xl border border-brand-purple/30 bg-brand-purple/5 p-5 dark:bg-brand-purple/15">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple dark:text-brand-lavender">
            Setup incomplete
          </p>
          <p className="mt-1 text-sm font-bold text-ink-900 dark:text-white">
            Personalize your workouts.
          </p>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
            A 2-minute 4-step setup — tells us your vertical, audience, and
            goals so reps target what actually matters for you.
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
        initialCommittedDays={profile?.committedDays ?? undefined}
        userEmail={user.email}
        userKind={user.kind}
      />

      <ThemeToggle />

      {!profile && (
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
          The database is unavailable, so changes won&rsquo;t persist in this
          session. Set <code className="font-mono text-xs">DATABASE_URL</code>{" "}
          in <code className="font-mono text-xs">.env.local</code> to enable
          persistence.
        </div>
      )}
    </div>
  );
}
