import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isSkillLabAppsEnabled } from "@/lib/flags";
import { currentUser } from "@/lib/session/current-user";
import { getCurrentSkillScores } from "@/lib/db/queries/progress";
import { SkillLabClient } from "@/components/product/SkillLabClient";
import {
  SKILL_DIMENSIONS,
  type SkillDimension,
} from "@/types/domain";
import {
  ALL_SUB_SKILLS,
  SUB_SKILL_TO_DIMENSION,
  type SubSkillId,
} from "@/types/sub-skills";

export const metadata: Metadata = {
  title: "Focus Drills · Cognify",
  description:
    "Drill one Core Skill in isolation with unlimited focused reps.",
};

export const dynamic = "force-dynamic";

/**
 * Focus Drills (PRD v3 D9 — 2026-07-06).
 *
 * The dimension-drill mode that used to BE Skill Lab, relocated here as
 * a Daily Workout extra when the lab became the PRD's application
 * trainer. Entry points: workout-completion "keep going" CTA and the
 * dashboard's weakest-link deep-links (which still target /application-lab
 * ?focus= — that page redirects here under the flag).
 *
 * Flag OFF: /application-lab still hosts this mode; bounce back rather than
 * exposing a duplicate surface.
 */
export default async function DrillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialFocus = parseFocusParam(params.focus);
  const initialSubSkill = parseSubSkillParam(params.subSkill, initialFocus);

  if (!isSkillLabAppsEnabled()) {
    redirect(
      initialFocus
        ? `/application-lab?focus=${initialFocus}${initialSubSkill ? `&subSkill=${initialSubSkill}` : ""}`
        : "/application-lab",
    );
  }

  const user = await currentUser();
  const scores = user ? await getCurrentSkillScores(user.id) : null;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-gradient-to-b from-ink-50/40 via-white to-ink-50/30 dark:from-ink-900 dark:via-ink-900 dark:to-ink-900">
      <div className="mx-auto w-full max-w-5xl px-6 py-10 md:py-14">
        <SkillLabClient
          currentScores={scores ?? {}}
          {...(initialFocus ? { initialFocus } : {})}
          {...(initialSubSkill ? { initialSubSkill } : {})}
        />
      </div>
    </div>
  );
}

function parseFocusParam(
  value: string | string[] | undefined,
): SkillDimension | undefined {
  if (typeof value !== "string") return undefined;
  return (SKILL_DIMENSIONS as readonly string[]).includes(value)
    ? (value as SkillDimension)
    : undefined;
}

function parseSubSkillParam(
  value: string | string[] | undefined,
  forDim: SkillDimension | undefined,
): SubSkillId | undefined {
  if (typeof value !== "string") return undefined;
  if (!(ALL_SUB_SKILLS as readonly string[]).includes(value)) return undefined;
  const subSkill = value as SubSkillId;
  if (forDim && SUB_SKILL_TO_DIMENSION[subSkill] !== forDim) return undefined;
  return subSkill;
}
