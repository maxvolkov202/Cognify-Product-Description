import Link from "next/link";
import { Home, Compass } from "lucide-react";
import { GradientButton } from "@/components/shared/GradientButton";

const SUGGESTIONS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/workout", label: "Today's workout" },
  { href: "/build-a-rep", label: "Build a Rep" },
  { href: "/progress", label: "Progress" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/settings", label: "Settings" },
] as const;

export default function AppNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="brand-gradient-text text-[120px] font-extrabold leading-none tracking-[-0.05em] tabular-nums md:text-[160px]">
        404
      </div>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900 md:text-4xl">
        That page isn&rsquo;t part of the gym.
      </h1>
      <p className="mt-3 max-w-md text-base text-ink-600">
        The page you&rsquo;re looking for doesn&rsquo;t exist inside the training
        surface. Here&rsquo;s where you probably want to go.
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <GradientButton href="/dashboard" size="lg">
          <Home className="mr-2 size-4" />
          Back to dashboard
        </GradientButton>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-3 text-sm font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50"
        >
          <Compass className="size-4" />
          Marketing site
        </Link>
      </div>

      <div className="mt-12 w-full">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Training rooms
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-brand-lavender hover:text-ink-900"
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
