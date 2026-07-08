import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isSkillLabAppsEnabled } from "@/lib/flags";
import {
  APPLICATION_LABELS,
  isApplicationId,
} from "@/types/application-skills";
import { SKILL_DIMENSIONS } from "@/types/domain";
import AppSessionClient from "@/components/product/skill-lab-v2/AppSessionClient";

export const dynamic = "force-dynamic";

/**
 * PRD v3 Phase 4 — Skill Lab application session (PRD §6).
 *
 * /skill-lab/storytelling etc. The [slug] segment is shared with the
 * exemplars sub-route (/skill-lab/clarity/exemplars), so this page
 * dispatches: an ApplicationId runs the Lab session; a Core Skill
 * dimension redirects to its Focus Drill home (old bookmarks keep
 * working after D9 moved drills out of Skill Lab); anything else 404s.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const label = isApplicationId(slug) ? APPLICATION_LABELS[slug] : "Session";
  return {
    title: `${label} · Skill Lab · Cognify`,
    description: `Train ${label} with focused reps, coaching, and retries.`,
  };
}

export default async function SkillLabApplicationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isApplicationId(slug)) {
    if ((SKILL_DIMENSIONS as readonly string[]).includes(slug)) {
      redirect(`/drills?focus=${slug}`);
    }
    notFound();
  }
  if (!isSkillLabAppsEnabled()) redirect("/skill-lab");

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-gradient-to-b from-ink-50/40 via-white to-ink-50/30 dark:from-ink-900 dark:via-ink-900 dark:to-ink-900">
      <AppSessionClient applicationId={slug} />
    </div>
  );
}
