import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/shared/Logo";
import { QuickRepFlow } from "@/components/product/QuickRepFlow";
import { pickWorkoutPrompts } from "@/lib/ai/prompts/workout";

export const metadata: Metadata = {
  title: "Try Cognify · 60 seconds, no signup",
  description:
    "Run one speaking rep. Get instant feedback across six dimensions. No signup required.",
};

export const dynamic = "force-dynamic";

export default function TryPage() {
  // Single random prompt from be_concise's 15-item bank. 20-second budget.
  const [prompt] = pickWorkoutPrompts("be_concise", 1);

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
      <main className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
        <div className="mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
            Quick Rep · 20 seconds · no signup
          </p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
            Try one rep.
          </h1>
          <p className="mt-3 max-w-xl text-base text-ink-600 md:text-lg">
            One prompt, 20 seconds, scored across six dimensions. You&rsquo;ll
            see what a Cognify rep actually looks like before you commit.
          </p>
        </div>
        <QuickRepFlow prompt={prompt ?? "Explain why consistency beats intensity in 20 seconds"} />
      </main>
    </div>
  );
}
