import type { Metadata } from "next";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import { getCurrentSkillScores } from "@/lib/db/queries/progress";
import { SkillLabClient } from "@/components/product/SkillLabClient";

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
 */
export default async function SkillLabPage() {
  const user = await currentUser();
  const profile = user ? await getUserProfile(user.id) : null;
  const scores = user ? await getCurrentSkillScores(user.id) : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 md:py-12">
      <SkillLabClient
        currentScores={scores ?? {}}
        improvementGoals={profile?.improvementGoals ?? []}
      />
    </div>
  );
}
