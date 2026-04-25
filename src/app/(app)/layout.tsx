import { redirect } from "next/navigation";
import { AppNav } from "@/components/shared/AppNav";
import { InstallPrompt } from "@/components/product/InstallPrompt";
import { SixSkillsBar } from "@/components/product/SixSkillsBar";
import { SkillsFocusProvider } from "@/components/product/SkillsFocusContext";
import { currentUser } from "@/lib/session/current-user";
import { isUserOnboarded, getUserProfile } from "@/lib/db/queries/user";
import { getCurrentSkillScores } from "@/lib/db/queries/progress";

// Nav items. Phase 5: /scenario replaced by /build-a-rep. The /scenario
// route still exists as a redirect to /build-a-rep for backwards compat
// until Phase 6 cleanup deletes it.
const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/workout", label: "Daily Workout" },
  { href: "/skill-lab", label: "Skill Lab" },
  { href: "/build-a-rep", label: "Build a Rep" },
  { href: "/progress", label: "Progress" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/friends", label: "Friends" },
  { href: "/settings", label: "Settings" },
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Onboarding gate — authenticated or guest users who haven't completed the
  // 3-step flow are redirected to /onboarding/vertical. When the DB is
  // unavailable, isUserOnboarded returns true so onboarding becomes optional
  // and the gym still works in degraded mode (no personalization, but usable).
  const user = await currentUser();
  if (user) {
    const onboarded = await isUserOnboarded(user.id);
    if (!onboarded) {
      redirect("/onboarding/vertical");
    }
  }

  const profile = user ? await getUserProfile(user.id) : null;
  const sessionUser =
    user?.kind === "authenticated"
      ? {
          name: user.name,
          email: user.email,
          image: user.image,
          isOperator: profile?.isOperator ?? false,
        }
      : null;

  const skillScores = user ? await getCurrentSkillScores(user.id) : null;

  return (
    <SkillsFocusProvider>
      <div className="flex min-h-screen flex-col bg-ink-50/60">
        <AppNav navItems={navItems} sessionUser={sessionUser} />
        <main className="flex-1 pb-20">{children}</main>
        <SixSkillsBar scores={skillScores ?? {}} />
        <InstallPrompt />
      </div>
    </SkillsFocusProvider>
  );
}
