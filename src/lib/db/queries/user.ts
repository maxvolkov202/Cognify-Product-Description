import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import type {
  VerticalId,
  PersonaId,
  ImprovementGoalId,
} from "@/lib/onboarding/constants";

export type UserProfile = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  isGuest: boolean;
  vertical: VerticalId | null;
  personas: PersonaId[];
  improvementGoals: ImprovementGoalId[];
  onboardedAt: Date | null;
  tutorialSeenAt: Date | null;
  isOperator: boolean;
  baselineRepId: string | null;
  createdAt: Date | null;
  /** DNA Ch.7 progression. Defaults to level 1, xp 0, lifetimeReps 0
   *  for new users. */
  level: number;
  xp: number;
  lifetimeReps: number;
  /** Phase C — committed training days bitmask. Mon=bit 0, Sun=bit 6.
   *  Default 31 (Mon-Fri). */
  committedDays: number;
  /** IANA timezone (e.g. "America/Los_Angeles"). Defaults to "UTC" until
   *  TimezoneDetector posts the browser-inferred TZ on first authenticated
   *  app visit. CTO review B-4 — surfaced here so the dashboard can pass
   *  it to isDateCommitted + todayYmdInTz. */
  tz: string;
};

// Request-scoped: called by layout, dashboard, workout, settings, and
// several server actions per render. cache() dedupes within a request.
export const getUserProfile = cache(async (
  userId: string,
): Promise<UserProfile | null> => {
  return safeDb(async () => {
    const row = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      image: row.image,
      isGuest: row.isGuest,
      vertical: (row.vertical ?? null) as VerticalId | null,
      personas: (row.personas ?? []) as PersonaId[],
      improvementGoals: (row.improvementGoals ?? []) as ImprovementGoalId[],
      onboardedAt: row.onboardedAt ?? null,
      tutorialSeenAt: row.tutorialSeenAt ?? null,
      isOperator: row.isOperator ?? false,
      baselineRepId: row.baselineRepId ?? null,
      createdAt: row.createdAt ?? null,
      level: row.level ?? 1,
      xp: row.xp ?? 0,
      lifetimeReps: row.lifetimeReps ?? 0,
      committedDays: row.committedDays ?? 31,
      tz: row.tz ?? "UTC",
    };
  }, null);
});

export async function setUserVertical(
  userId: string,
  vertical: VerticalId,
): Promise<boolean> {
  return safeDb(async () => {
    await db.update(users).set({ vertical }).where(eq(users.id, userId));
    return true;
  }, false);
}

export async function setUserPersonas(
  userId: string,
  personas: PersonaId[],
): Promise<boolean> {
  return safeDb(async () => {
    await db.update(users).set({ personas }).where(eq(users.id, userId));
    return true;
  }, false);
}

export async function setUserImprovementGoals(
  userId: string,
  improvementGoals: ImprovementGoalId[],
): Promise<boolean> {
  return safeDb(async () => {
    await db
      .update(users)
      .set({ improvementGoals })
      .where(eq(users.id, userId));
    return true;
  }, false);
}

export async function markUserOnboarded(userId: string): Promise<boolean> {
  return safeDb(async () => {
    await db
      .update(users)
      .set({ onboardedAt: new Date() })
      .where(eq(users.id, userId));
    return true;
  }, false);
}

export async function markTutorialSeen(userId: string): Promise<boolean> {
  return safeDb(async () => {
    await db
      .update(users)
      .set({ tutorialSeenAt: new Date() })
      .where(eq(users.id, userId));
    return true;
  }, false);
}

export async function hasSeenTutorial(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId);
  if (!profile) return true;
  return profile.tutorialSeenAt !== null;
}

export async function setBaselineRep(
  userId: string,
  repId: string,
): Promise<boolean> {
  return safeDb(async () => {
    await db
      .update(users)
      .set({ baselineRepId: repId })
      .where(eq(users.id, userId));
    return true;
  }, false);
}

export async function hasBaselineRep(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId);
  if (!profile) return true;
  return profile.baselineRepId !== null;
}

/**
 * True when the user has completed onboarding. Used by the (app) layout
 * gate to redirect unonboarded users to /onboarding/vertical.
 *
 * Degrades gracefully when the database is unavailable: returns true so
 * the gym works without persistence. Onboarding becomes optional in that
 * mode — the user can still use the product, their selections just aren't
 * saved until DATABASE_URL is set.
 */
export async function isUserOnboarded(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId);
  if (!profile) return true;
  return profile.onboardedAt !== null;
}
