import { WorkoutSession } from "@/components/product/WorkoutSession";
import { planTodaysWorkout } from "@/lib/ai/workout-prompts";
import { currentUser } from "@/lib/session/current-user";
import { getUserProfile } from "@/lib/db/queries/user";
import {
  getStreakDays,
  getYesterdayDailyAverage,
} from "@/lib/db/queries/progress";

export const dynamic = "force-dynamic";

export default async function WorkoutPage() {
  // Goal-weighted workout planning: feeds user.improvementGoals into
  // rep-type selection so drills bias toward what the user is training
  // (see GOAL_TO_REP_TYPES in src/lib/ai/rep-types.ts).
  // Yesterday's avg composite feeds the end-of-workout "(+4 from yesterday)" delta.
  const user = await currentUser();
  const profile = user ? await getUserProfile(user.id) : null;
  const [streakDays, yesterday] = user
    ? await Promise.all([
        getStreakDays(user.id),
        getYesterdayDailyAverage(user.id),
      ])
    : [null, null];

  const plan = planTodaysWorkout({
    goals: profile?.improvementGoals ?? [],
    count: 4,
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <WorkoutSession
        plan={plan}
        streakDays={streakDays}
        yesterdayComposite={yesterday?.composite ?? null}
      />
    </div>
  );
}
