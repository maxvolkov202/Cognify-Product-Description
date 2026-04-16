"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { GradientButton } from "@/components/shared/GradientButton";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[cognify] route error", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="brand-gradient grid size-16 place-items-center rounded-2xl shadow-[0_16px_48px_-12px_rgba(151,136,255,0.65)]">
        <AlertTriangle className="size-8 text-white" aria-hidden="true" />
      </div>
      <h1 className="mt-8 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
        Something tripped.
      </h1>
      <p className="mt-3 max-w-md text-base leading-relaxed text-ink-600">
        Cognify hit an error on this page. The rest of the gym is still running —
        nothing you did broke it. Try again, or head back to the dashboard.
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
          className="inline-flex items-center justify-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-3 text-sm font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50"
        >
          <Home className="size-4" />
          Back to dashboard
        </Link>
      </div>

      {process.env.NODE_ENV === "development" && (
        <details className="mt-10 w-full max-w-2xl text-left">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-ink-400">
            Dev stack trace
          </summary>
          <pre className="mt-3 max-h-96 overflow-auto rounded-lg border border-ink-200 bg-ink-50 p-4 text-[11px] text-ink-700">
            {error.message}
            {"\n\n"}
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  );
}
