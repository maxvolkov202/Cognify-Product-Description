"use server";

// Phase 10 — server actions for the day-lifecycle notifications.
//
// fetchPendingDayNotification → newest unread notification of one of
//   the day-lifecycle kinds, or null. The shell mounts MissedDayModal
//   if non-null.
// markNotificationRead → flips read_at so the modal doesn't fire again.

import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { userNotifications } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";
import type {
  DayLifecycleKind,
  NotificationPayload,
} from "@/types/db-payloads";

const DAY_LIFECYCLE_KINDS: DayLifecycleKind[] = [
  "day_missed",
  "freeze_consumed",
  "day_partial",
  "day_complete",
];

export type PendingDayNotification = {
  id: string;
  kind: DayLifecycleKind;
  payload: NotificationPayload;
  createdAt: string;
};

export async function fetchPendingDayNotification(): Promise<PendingDayNotification | null> {
  const user = await currentUser();
  if (!user?.id) return null;

  return safeDb<PendingDayNotification | null>(async () => {
    const [row] = await db
      .select({
        id: userNotifications.id,
        kind: userNotifications.kind,
        payload: userNotifications.payload,
        createdAt: userNotifications.createdAt,
      })
      .from(userNotifications)
      .where(
        and(
          eq(userNotifications.userId, user.id),
          isNull(userNotifications.readAt),
          inArray(userNotifications.kind, DAY_LIFECYCLE_KINDS),
        ),
      )
      .orderBy(desc(userNotifications.createdAt))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      kind: row.kind as DayLifecycleKind,
      payload: row.payload ?? {},
      createdAt: row.createdAt.toISOString(),
    };
  }, null);
}

export async function markNotificationRead(input: {
  id: string;
}): Promise<{ ok: boolean }> {
  const user = await currentUser();
  if (!user?.id) return { ok: false };
  return safeDb<{ ok: boolean }>(async () => {
    await db
      .update(userNotifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(userNotifications.id, input.id),
          eq(userNotifications.userId, user.id),
        ),
      );
    return { ok: true };
  }, { ok: false });
}
