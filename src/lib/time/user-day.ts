/**
 * Phase C (post-CTO-review) — TZ-aware day-of-week + day-string helpers.
 *
 * The committed-days bitmask, the streak walker, and the rest-day banner
 * all need to know "what day is it for THIS user". Server-local `.getDay()`
 * is wrong (server is UTC on Vercel); raw `.toISOString().slice(0,10)` is
 * also wrong (UTC date, not user-local date). Both cause off-by-one bugs
 * near midnight in user-local time.
 *
 * Source of truth: `users.tz` (IANA name, populated by
 * src/components/product/TimezoneDetector.tsx on first authenticated app
 * visit). Defaults to "UTC" before detection lands — that fallback is
 * intentional so behavior matches the pre-fix system for un-detected
 * users (zero behavior change on UTC servers / UTC users).
 */

/** Mon=0, Tue=1, ..., Sun=6 — the bitmask layout for `users.committed_days`. */
export type DayBitMonStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** "en-CA" formats as YYYY-MM-DD natively — used here so the helpers
 *  return ISO date strings without manual zero-padding. */
const ISO_DATE_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();
const WEEKDAY_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function getIsoFormatter(tz: string): Intl.DateTimeFormat {
  let f = ISO_DATE_FORMATTER_CACHE.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    ISO_DATE_FORMATTER_CACHE.set(tz, f);
  }
  return f;
}

function getWeekdayFormatter(tz: string): Intl.DateTimeFormat {
  let f = WEEKDAY_FORMATTER_CACHE.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" });
    WEEKDAY_FORMATTER_CACHE.set(tz, f);
  }
  return f;
}

const WEEKDAY_TO_BIT: Record<string, DayBitMonStart> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

/** Day-of-week (Mon=0..Sun=6) for the given instant in the user's TZ.
 *  Falls back to UTC weekday when `tz` is "UTC" / unset. */
export function dayBitMonStart(date: Date, tz: string): DayBitMonStart {
  const formatter = getWeekdayFormatter(tz || "UTC");
  const weekday = formatter.format(date);
  return WEEKDAY_TO_BIT[weekday] ?? 0;
}

/** YYYY-MM-DD in the user's TZ. Stable for use as a localStorage key
 *  and for SQL bucket grouping. */
export function ymdInTz(date: Date, tz: string): string {
  const formatter = getIsoFormatter(tz || "UTC");
  // en-CA's short format is YYYY-MM-DD — no further parsing needed.
  return formatter.format(date);
}

/** "Today" as YYYY-MM-DD in the user's TZ. */
export function todayYmdInTz(tz: string): string {
  return ymdInTz(new Date(), tz);
}

/** Construct a Date representing midnight at the start of the given
 *  YYYY-MM-DD in the user's TZ. Used by the streak walker to step
 *  backwards day-by-day in user-local time without DST surprises. */
export function ymdToUtcMidnight(ymd: string): Date {
  // We don't need exact local midnight — we only need a stable instant
  // we can compare day-by-day with stepBackOneDay. UTC midnight of the
  // same date works because we always re-extract the YMD via ymdInTz.
  return new Date(`${ymd}T00:00:00Z`);
}

/** Step the given YYYY-MM-DD back by N days, in the user's TZ. */
export function shiftYmd(ymd: string, days: number, tz: string): string {
  const base = ymdToUtcMidnight(ymd);
  // Add a generous noon offset so DST transitions don't drift us back/
  // forward by a calendar day when ymdInTz re-extracts.
  const shifted = new Date(base.getTime() + days * 86_400_000 + 12 * 3_600_000);
  return ymdInTz(shifted, tz);
}
