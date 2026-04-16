import Link from "next/link";
import { Logo } from "@/components/shared/Logo";

/**
 * Minimal shell for the 3-step onboarding flow. No main nav — onboarding
 * should feel focused, not part of the broader app surface. Users can exit
 * to the marketing home at any time (their selections so far persist).
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200/60 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-6">
          <Logo />
          <Link
            href="/"
            className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 hover:text-ink-900"
          >
            Exit
          </Link>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
