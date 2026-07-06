import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Per-route not-found for /skill-lab/[dimension]/exemplars. Without
 * this, Next.js 15's force-dynamic + notFound() combination returns
 * the global 404 UI inside a 200 response. Pinning the not-found UI
 * here lets the route segment own the response shape and the framework
 * sets a proper 404 status.
 */
export default function ExemplarsNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-purple">
        Skill Lab · Exemplars
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900 md:text-4xl">
        That dimension doesn&rsquo;t exist.
      </h1>
      <p className="mt-3 max-w-md text-base text-ink-600">
        Cognify scores six dimensions: Clarity, Structure, Conciseness,
        Thinking Quality, Delivery, and Tone. Pick one to see exemplars.
      </p>
      <Link
        href="/skill-lab"
        className="mt-8 inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2.5} />
        Back to Skill Lab
      </Link>
    </div>
  );
}
