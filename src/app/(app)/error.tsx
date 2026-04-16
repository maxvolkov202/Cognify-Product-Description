"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, LayoutDashboard } from "lucide-react";
import { GradientButton } from "@/components/shared/GradientButton";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[cognify/app] route error", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="brand-gradient grid size-14 place-items-center rounded-2xl">
        <AlertTriangle className="size-7 text-white" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink-900 md:text-4xl">
        This rep hit an error.
      </h1>
      <p className="mt-3 max-w-md text-base text-ink-600">
        Cognify couldn&rsquo;t finish loading this page. Your streak and recent reps
        are safe — try again, or head back to the dashboard.
      </p>
      {error.digest && (
        <p className="mt-4 rounded-full border border-ink-200 bg-ink-50 px-3 py-1 text-[11px] font-mono text-ink-500">
          Error ID · {error.digest}
        </p>
      )}
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <GradientButton onClick={reset} size="lg">
          <RotateCcw className="mr-2 size-4" />
          Try again
        </GradientButton>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-3 text-sm font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50"
        >
          <LayoutDashboard className="size-4" />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
