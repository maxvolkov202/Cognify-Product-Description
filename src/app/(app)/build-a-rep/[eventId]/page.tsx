import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isBuildARepV2Enabled } from "@/lib/flags";
import { getPrepEvent } from "@/server/actions/prep-events";
import PrepEventClient from "@/components/product/build-a-rep-v2/PrepEventClient";

export const dynamic = "force-dynamic";

/**
 * PRD v3 Phase 5 — one prep event's Preparation Plan + practice surface
 * (PRD §7). Owner-scoped: getPrepEvent returns null for anyone else's
 * event, which 404s rather than leaking existence.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  void (await params);
  return { title: "Preparation Plan · Build a Rep · Cognify" };
}

export default async function PrepEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  if (!isBuildARepV2Enabled()) redirect("/build-a-rep");
  const { eventId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) notFound();
  const event = await getPrepEvent(eventId);
  if (!event) notFound();

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-gradient-to-b from-ink-50/40 via-white to-ink-50/30 dark:from-ink-900 dark:via-ink-900 dark:to-ink-900">
      <div className="mx-auto w-full max-w-4xl px-6 py-8 md:py-12">
        <PrepEventClient initialEvent={event} />
      </div>
    </div>
  );
}
