import { redirect } from "next/navigation";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AppNav } from "@/components/shared/AppNav";
import { InstallPrompt } from "@/components/product/InstallPrompt";
import TimezoneDetector from "@/components/product/TimezoneDetector";
import ServiceWorkerRegister from "@/components/product/ServiceWorkerRegister";
import { SixSkillsBar } from "@/components/product/SixSkillsBar";
import { SkillsFocusProvider } from "@/components/product/SkillsFocusContext";
import { ReportBugButton } from "@/components/product/ReportBugButton";
import { SettingsDirtyProvider } from "@/components/product/SettingsDirtyContext";
import { LeavePromptModal } from "@/components/product/LeavePromptModal";
import { currentUser } from "@/lib/session/current-user";
import { isUserOnboarded, getUserProfile } from "@/lib/db/queries/user";
import { getCurrentSkillScores } from "@/lib/db/queries/progress";

// Nav items. Phase 5: /scenario replaced by /build-a-rep. The /scenario
// route still exists as a redirect to /build-a-rep for backwards compat
// until Phase 6 cleanup deletes it.
// Phase 11 nav reshuffle: Workout is the daily-default; Skill Lab is
// reframed as a focused "Practice" surface for targeted drills,
// framework practice, and custom reps. The URL stays /skill-lab so
// links + bookmarks don't break.
const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/workout", label: "Workout" },
  // D6 — PRD terminology: the mode is "Skill Lab", not "Practice".
  { href: "/skill-lab", label: "Skill Lab" },
  { href: "/build-a-rep", label: "Build a Rep" },
  { href: "/library", label: "Library" },
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

  // Parallelize the three independent lookups instead of awaiting them
  // serially. With React.cache on getUserProfile + getCurrentSkillScores,
  // child pages reuse these results — so layout pays the cost once.
  const [onboardingResult, profile, skillScores] = user
    ? await Promise.all([
        process.env.NODE_ENV === "production"
          ? isUserOnboarded(user.id)
          : Promise.resolve(true),
        getUserProfile(user.id),
        getCurrentSkillScores(user.id),
      ])
    : [true, null, null];

  if (user && !onboardingResult) {
    redirect("/onboarding/vertical");
  }

  const sessionUser =
    user?.kind === "authenticated"
      ? {
          name: user.name,
          email: user.email,
          image: user.image,
          isOperator: profile?.isOperator ?? false,
        }
      : null;

  return (
    <ThemeProvider>
      <SkillsFocusProvider>
        <SettingsDirtyProvider>
          <div className="flex min-h-screen flex-col bg-ink-50/60 dark:bg-ink-950">
            <AppNav navItems={navItems} sessionUser={sessionUser} />
            <main className="flex-1 pb-20">{children}</main>
            <SixSkillsBar scores={skillScores ?? {}} />
            <InstallPrompt />
            <ReportBugButton />
            <LeavePromptModal />
            {user ? <TimezoneDetector /> : null}
            <ServiceWorkerRegister />
          </div>
        </SettingsDirtyProvider>
      </SkillsFocusProvider>
    </ThemeProvider>
  );
}
