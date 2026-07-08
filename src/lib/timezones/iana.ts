// Lightweight IANA timezone validator.
//
// Used by PATCH /api/me/tz to gate writes into users.tz. We do not
// store a hard allow-list — IANA adds zones over time and the OS's
// own ICU data is the source of truth via Intl.DateTimeFormat.

const TZ_PATTERN = /^[A-Za-z][A-Za-z0-9_+\-/]{0,63}$/;

/** Returns true when `tz` looks like a plausible IANA identifier and
 *  the runtime accepts it via Intl.DateTimeFormat. */
export function isValidIana(tz: string): boolean {
  if (typeof tz !== "string") return false;
  if (!TZ_PATTERN.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
