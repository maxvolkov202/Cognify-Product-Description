"use server";

// Phase 11 — server fetcher for SkillLabDailyPromo. Returns the promo
// state based on today's muscle_group_day status.

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { muscleGroupDays } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";
import {
  MUSCLE_GROUP_IDS,
  MUSCLE_GROUP_LABELS,
  type MuscleGroupId,
} from "@/types/domain";

export type PromoState =
  | { kind: "loading" }
  | { kind: "hidden" }
  | {
      kind: "show";
      dimensionLabel: string;
      repsRemaining: number;
    };

function isMuscleGroupId(s: string): s is MuscleGroupId {
  return (MUSCLE_GROUP_IDS as readonly string[]).includes(s);
}

export async function fetchTodayPromoState(): Promise<PromoState> {
  const user = await currentUser();
  if (!user?.id) return { kind: "hidden" };

  return safeDb<PromoState>(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [day] = await db
      .select({
        dimension: muscleGroupDays.dimension,
        completedReps: muscleGroupDays.completedReps,
        status: muscleGroupDays.status,
      })
      .from(muscleGroupDays)
      .where(
        and(
          eq(muscleGroupDays.userId, user.id),
          eq(muscleGroupDays.dayDate, today),
        ),
      )
      .limit(1);

    if (!day) {
      // No active day — promo still useful since user can start one.
      return {
        kind: "show",
        dimensionLabel: "Workout",
        repsRemaining: 4,
      };
    }

    if (day.status === "complete" || day.status === "complete_graduated") {
      return { kind: "hidden" };
    }

    const dimLabel = isMuscleGroupId(day.dimension as string)
      ? MUSCLE_GROUP_LABELS[day.dimension as MuscleGroupId]
      : "Workout";

    return {
      kind: "show",
      dimensionLabel: dimLabel,
      repsRemaining: Math.max(0, 4 - (day.completedReps ?? 0)),
    };
  }, { kind: "hidden" });
}
