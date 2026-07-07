/**
 * Phase C — custom weekly training schedule.
 *
 * Bitmask helpers for `users.committed_days`. Bit 0 = Monday, bit 6 = Sunday.
 * Trainer-voice defaults: 5 days a week (Mon..Fri). Min 2, max 7.
 *
 * Used by:
 *   - onboarding "When do you want to train?" step
 *   - /settings editable section
 *   - streak math (only committed days count as misses)
 *   - weakness-day scheduler (last committed day of the cycle = weakness)
 *   - daily assignment (today's day creation is gated on today being a
 *     committed day; off-days show a "rest day, see you tomorrow" card)
 */

import { dayBitMonStart } from "@/lib/time/user-day";

export const DAYS_OF_WEEK = [
  { id: "mon", label: "Mon", short: "M", bit: 0 },
  { id: "tue", label: "Tue", short: "T", bit: 1 },
  { id: "wed", label: "Wed", short: "W", bit: 2 },
  { id: "thu", label: "Thu", short: "T", bit: 3 },
  { id: "fri", label: "Fri", short: "F", bit: 4 },
  { id: "sat", label: "Sat", short: "S", bit: 5 },
  { id: "sun", label: "Sun", short: "S", bit: 6 },
] as const;

export type DayId = (typeof DAYS_OF_WEEK)[number]["id"];
export type DayBit = (typeof DAYS_OF_WEEK)[number]["bit"];

/** Default schedule: Mon..Fri (bits 0..4 set). Trainer recommendation. */
export const DEFAULT_COMMITTED_DAYS = 0b0011111; // = 31

/** Minimum number of committed days we allow. PRD treats a 2-day schedule
 *  ("Tuesday and Thursday") as first-class; the trainer still RECOMMENDS
 *  3+ in onboarding copy, but 2 is valid. */
export const MIN_COMMITTED_DAYS = 2;

/** Convert a JS Date.getDay() value (0=Sun..6=Sat) to our bit (0=Mon..6=Sun).
 *  Legacy helper — prefer dayBitMonStart() from @/lib/time/user-day, which
 *  resolves the weekday in the user's TZ instead of server-local. */
export function jsDayToBit(jsDay: number): DayBit {
  // JS: Sun=0, Mon=1, Tue=2, ..., Sat=6
  // Ours: Mon=0, Tue=1, ..., Sun=6
  return ((jsDay + 6) % 7) as DayBit;
}

/** Is the given day-of-week bit set in this committed_days mask? */
export function isDayCommitted(mask: number, dayBit: DayBit): boolean {
  return (mask & (1 << dayBit)) !== 0;
}

/** Is the given Date a committed training day for this user?
 *  Pass `tz` (IANA name from users.tz) to evaluate in user-local time.
 *  When omitted, falls back to server-local (UTC on Vercel) — keep the
 *  fallback for backwards compat but ALL new callers should pass tz. */
export function isDateCommitted(
  mask: number,
  date: Date,
  tz?: string,
): boolean {
  const bit = tz
    ? (dayBitMonStart(date, tz) as DayBit)
    : jsDayToBit(date.getDay());
  return isDayCommitted(mask, bit);
}

/** Return the set of day IDs in this mask. */
export function maskToDayIds(mask: number): DayId[] {
  return DAYS_OF_WEEK.filter((d) => isDayCommitted(mask, d.bit)).map(
    (d) => d.id,
  );
}

/** Build a mask from a set of day IDs. */
export function dayIdsToMask(ids: readonly DayId[]): number {
  let mask = 0;
  for (const id of ids) {
    const day = DAYS_OF_WEEK.find((d) => d.id === id);
    if (day) mask |= 1 << day.bit;
  }
  return mask;
}

/** Count how many days are committed in this mask. */
export function committedDayCount(mask: number): number {
  let n = 0;
  for (const d of DAYS_OF_WEEK) {
    if (isDayCommitted(mask, d.bit)) n++;
  }
  return n;
}

/** Validate a proposed mask. Throws if invalid. */
export function assertValidMask(mask: number): void {
  if (!Number.isInteger(mask) || mask < 0 || mask > 127) {
    throw new Error(`Invalid committed_days mask: ${mask} (must be 0-127)`);
  }
  if (committedDayCount(mask) < MIN_COMMITTED_DAYS) {
    throw new Error(
      `Committed_days mask must have at least ${MIN_COMMITTED_DAYS} days set; got ${committedDayCount(mask)}.`,
    );
  }
}

/**
 * Cycle position helpers — used by the weakness-day scheduler. A "cycle"
 * is the user's committed days in a given calendar week. Cycle position
 * counts from 1 starting at the user's first committed day of the week.
 * Cycle length = total committed days in their week.
 *
 * Example: committed Mon/Wed/Fri (mask = 0b0010101). Cycle length = 3.
 *   - Mon = position 1, Wed = 2, Fri = 3.
 *   - Tue/Thu/Sat/Sun = position null (rest days).
 */
export function cyclePositionForDate(
  mask: number,
  date: Date,
  tz?: string,
): { position: number | null; cycleLength: number } {
  const cycleLength = committedDayCount(mask);
  const todayBit = tz
    ? (dayBitMonStart(date, tz) as DayBit)
    : jsDayToBit(date.getDay());
  if (!isDayCommitted(mask, todayBit)) {
    return { position: null, cycleLength };
  }
  let position = 0;
  for (const d of DAYS_OF_WEEK) {
    if (isDayCommitted(mask, d.bit)) {
      position++;
      if (d.bit === todayBit) return { position, cycleLength };
    }
  }
  return { position: null, cycleLength };
}

/** Is today the final committed day of the user's week? Used by the
 *  weakness-day scheduler to swap the normal selector for the worst-skill
 *  picker. Pass `tz` to evaluate in user-local time. */
export function isFinalCycleDay(
  mask: number,
  date: Date,
  tz?: string,
): boolean {
  const { position, cycleLength } = cyclePositionForDate(mask, date, tz);
  // Cycle-length guard (CTO review 2026-05-24): with a 1-day mask, the
  // sole committed day is ALWAYS the "final" cycle day — every workout
  // would become a weakness day. Valid masks have ≥ MIN_COMMITTED_DAYS
  // (2) days, but legacy/hand-edited rows shouldn't silently degrade.
  if (cycleLength < 2) return false;
  return position !== null && position === cycleLength;
}

/** Human-readable summary: "Mon, Wed, Fri" or "Every day" etc. */
export function maskToHumanSummary(mask: number): string {
  const count = committedDayCount(mask);
  if (count === 7) return "Every day";
  if (count === 5 && mask === DEFAULT_COMMITTED_DAYS) return "Weekdays";
  const ids = maskToDayIds(mask);
  return ids
    .map((id) => DAYS_OF_WEEK.find((d) => d.id === id)?.label ?? id)
    .join(", ");
}
