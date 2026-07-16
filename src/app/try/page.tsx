import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, sql as drizzleSql } from "drizzle-orm";
import { Logo } from "@/components/shared/Logo";
import { QuickRepFlow } from "@/components/product/QuickRepFlow";
import { db } from "@/lib/db/client";
import { exercisePrompts, exercises } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";

export const metadata: Metadata = {
  title: "Try Cognify · 60 seconds, no signup",
  description:
    "Run one speaking rep. Get instant feedback across six dimensions. No signup required.",
};

export const dynamic = "force-dynamic";

/** No-DB fallback so the marketing page never breaks. */
const FALLBACK_PROMPT =
  "Explain why consistency beats intensity in 20 seconds";

export default async function TryPage() {
  // Phase 2B.3 (D23): single random intro-difficulty conciseness prompt
  // from the DB catalog (the hardcoded banks are retired). 20s budget.
  const prompt = await safeDb<string>(async () => {
    const [row] = await db
      .select({ text: exercisePrompts.promptText })
      .from(exercisePrompts)
      .innerJoin(exercises, eq(exercises.id, exercisePrompts.exerciseId))
      .where(
        and(
          eq(exercises.dimension, "conciseness"),
          eq(exercisePrompts.isActive, true),
          eq(exercisePrompts.difficulty, 1),
          drizzleSql`jsonb_exists(${exercisePrompts.tags}, 'general')`,
        ),
      )
      .orderBy(drizzleSql`random()`)
      .limit(1);
    return row?.text ?? FALLBACK_PROMPT;
  }, FALLBACK_PROMPT);

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
        <QuickRepFlow prompt={prompt} />
      </main>
    </div>
  );
}
