import type { Metadata } from "next";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import { getCurrentSkillScores } from "@/lib/db/queries/progress";
import { SkillLabClient } from "@/components/product/SkillLabClient";
import SkillLabDailyPromo from "@/components/product/SkillLabDailyPromo";
import SkillLabPivotTooltip from "@/components/product/SkillLabPivotTooltip";
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
  title: "Skill Lab · Cognify",
  description:
    "Drill one communication skill in isolation. Pick a dimension and run unlimited reps focused on that muscle.",
};

export const dynamic = "force-dynamic";

/**
 * Skill Lab (Direction.md Mode 2).
 *
 * "User chooses one skill, runs repeated reps focused on improving that
 * one dimension." Distinct from Daily Workout (which covers multiple
 * dims in a fixed ~10 min session) — Skill Lab is "I need to get
 * better at this one thing" and has no session cap.
 *
 * Flow: dim picker → record a rep → full FeedbackPanel → "Run another"
 * or "Switch skill". Each rep uses the goal-weighted rep type pool
 * filtered to the chosen dim.
 *
 * Ch.12 — supports `?focus=<dim>&subSkill=<id>` deep-links from the
 * dashboard's WeakestLinkCard / SubSkillBreakdownCard. When `focus` is
 * a valid dimension, the client opens directly into the rep-count step
 * for that dim (skipping the lobby + picker). When `subSkill` is also
 * present and belongs to the focused dim, it's surfaced in the step's
 * subtitle copy. Slate-bias on subSkill is a follow-up.
 */
export default async function SkillLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await currentUser();
  const profile = user ? await getUserProfile(user.id) : null;
  const scores = user ? await getCurrentSkillScores(user.id) : null;

  const params = await searchParams;
  const initialFocus = parseFocusParam(params.focus);
  const initialSubSkill = parseSubSkillParam(params.subSkill, initialFocus);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-gradient-to-b from-ink-50/40 via-white to-ink-50/30">
      <div className="mx-auto w-full max-w-5xl px-6 py-10 md:py-14">
        {/* Phase 11 — daily-workout promo + pivot tooltip. Both
            self-gate (promo hides post-completion; tooltip persists
            dismissal in localStorage). */}
        <SkillLabPivotTooltip />
        <SkillLabDailyPromo />
        <SkillLabClient
          currentScores={scores ?? {}}
          improvementGoals={profile?.improvementGoals ?? []}
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
  // Drop sub-skill if it doesn't belong to the focused dim — caller
  // probably built a malformed link or the dim was renamed since.
  if (forDim && SUB_SKILL_TO_DIMENSION[subSkill] !== forDim) return undefined;
  return subSkill;
}
