import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/shared/Logo";
import { GradientButton } from "@/components/shared/GradientButton";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user || user.kind !== "authenticated") {
    redirect("/signin");
  }
  const profile = await getUserProfile(user.id);
  if (!profile?.isOperator) {
    redirect("/dashboard");
  }
  return (
    <div className="flex min-h-screen flex-col bg-ink-50/40">
      <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Logo href="/admin/teams" />
            <span className="rounded-full border border-brand-purple/30 bg-brand-purple/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-purple">
              Admin
            </span>
          </div>
          <nav aria-label="Admin" className="hidden items-center gap-6 md:flex">
            <Link
              href="/admin/teams"
              className="text-sm font-medium text-ink-600 transition-colors hover:text-ink-900"
            >
              Teams
            </Link>
          </nav>
          <GradientButton href="/dashboard" size="sm" variant="outline">
            Exit admin
          </GradientButton>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
