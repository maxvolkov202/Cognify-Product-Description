"use server";

import { currentUser } from "@/lib/session/current-user";
import {
  getCalendarHistory,
  type CalendarHistory,
} from "@/lib/db/queries/calendar-history";

/**
 * Server action invoked by the History Calendar modal on first open.
 * Returns null for unauthenticated users — modal handles the empty state.
 */
export async function loadCalendarHistory(): Promise<CalendarHistory | null> {
  const user = await currentUser();
  if (!user) return null;
  return getCalendarHistory(user.id);
}
