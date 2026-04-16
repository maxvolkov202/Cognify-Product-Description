import { redirect } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import { UserMenu } from "@/components/shared/UserMenu";
import { LoginDialog } from "@/components/shared/LoginDialog";
import { currentUser } from "@/lib/session/current-user";
import { isUserOnboarded, getUserProfile } from "@/lib/db/queries/user";

// Nav items. Phase 5: /scenario replaced by /build-a-rep. The /scenario
// route still exists as a redirect to /build-a-rep for backwards compat
// until Phase 6 cleanup deletes it.
const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/workout", label: "Workout" },
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

  return (
    <div className="flex min-h-screen flex-col bg-ink-50/60">
      <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Logo href="/dashboard" />
            <nav aria-label="App" className="hidden items-center gap-6 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium text-ink-600 transition-colors hover:text-ink-900"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          {sessionUser ? (
            <UserMenu
              name={sessionUser.name}
              email={sessionUser.email}
              image={sessionUser.image}
              isOperator={sessionUser.isOperator}
            />
          ) : (
            <LoginDialog
              trigger={
                <button
                  type="button"
                  className="rounded-full border border-ink-200 bg-white px-4 py-1.5 text-sm font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50"
                >
                  Sign in to save progress
                </button>
              }
            />
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
