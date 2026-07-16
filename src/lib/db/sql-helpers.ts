import { sql as drizzleSql } from "drizzle-orm";

/**
 * Postgres text-array literal helper — binds each element individually
 * via drizzle's sql.join so the array renders as `ARRAY['a','b']::text[]`
 * instead of being bound as a single composite/record value (which fails
 * with "cannot cast type record to text[]"). Without this every
 * personalized tier query throws and tag cascades silently fall through
 * to general — the dark-Wave-2 bug from 2026-05-23. Shared by
 * prompt-selection and vertical-prompts; any jsonb_exists_any caller
 * must use this, not a plain bound array.
 */
export const textArrayLit = (arr: readonly string[]) =>
  drizzleSql`ARRAY[${drizzleSql.join(
    arr.map((x) => drizzleSql`${x}`),
    drizzleSql`, `,
  )}]::text[]`;
