#!/usr/bin/env node
/**
 * Cognify DNA Ch.7 — backfill progression (level + xp + lifetime_reps)
 * for existing users. Run once after migration 0008 lands in prod.
 *
 * For each user, replay the XP formula over their reps in chronological
 * order. Streak multiplier uses the streak as-of-each-rep, computed by
 * stepping through dates. Anti-grinding cap (one level-up per UTC day)
 * is honored — running this on a user with 200 reps in 30 days will not
 * grant 200 level-ups.
 *
 * Idempotent — running twice produces the same final state. Updates
 * are wrapped in a per-user transaction so a partial failure mid-user
 * leaves THAT user as before-backfill (rather than a partial state).
 *
 * Usage:
 *   node scripts/backfill-progression.mjs                   # all users
 *   node scripts/backfill-progression.mjs --user <userId>   # single user
 *   node scripts/backfill-progression.mjs --dry-run         # log, don't write
 */

import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");
const USER_FILTER = parseArg("--user");
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

function parseArg(name) {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  return process.argv[i + 1] ?? null;
}

// ——— XP math (mirrors src/lib/progression/xp.ts + levels.ts) ————
const BASE_XP = 10;
const LEVEL_EXPONENT = 1.6;
const LEVEL_MULTIPLIER = 50;
const MAX_LEVEL = 100;

function xpForLevel(level) {
  if (level <= 1) return 0;
  if (level > MAX_LEVEL) level = MAX_LEVEL;
  return Math.floor(LEVEL_MULTIPLIER * Math.pow(level, LEVEL_EXPONENT));
}
function levelFromXp(xp) {
  if (xp <= 0) return 1;
  let lvl = 1;
  while (lvl < MAX_LEVEL && xpForLevel(lvl + 1) <= xp) lvl += 1;
  return lvl;
}
function bandMultiplier(c) {
  if (c < 40) return 1.0;
  if (c < 60) return 1.2;
  if (c < 75) return 1.5;
  if (c < 85) return 2.0;
  if (c < 95) return 3.0;
  return 4.0;
}
function streakMultiplier(d) {
  if (d >= 365) return 2.0;
  if (d >= 90) return 1.8;
  if (d >= 30) return 1.6;
  if (d >= 14) return 1.4;
  if (d >= 7) return 1.25;
  if (d >= 3) return 1.1;
  return 1.0;
}
function ymd(d) {
  return new Date(d).toISOString().slice(0, 10);
}

const sql = postgres(DATABASE_URL, { max: 1, prepare: false });

async function main() {
  const users = USER_FILTER
    ? await sql`SELECT id FROM cognify_v2.users WHERE id = ${USER_FILTER}`
    : await sql`SELECT id FROM cognify_v2.users WHERE id IS NOT NULL`;

  console.log(
    `\nBackfilling progression for ${users.length} user(s)${DRY_RUN ? " (dry run)" : ""}...\n`,
  );

  let processed = 0;
  let totalLevelUps = 0;

  for (const u of users) {
    const userId = u.id;
    const reps = await sql`
      SELECT created_at, composite_score
      FROM cognify_v2.reps
      WHERE user_id = ${userId}
        AND composite_score IS NOT NULL
      ORDER BY created_at ASC
    `;

    if (reps.length === 0) {
      processed += 1;
      continue;
    }

    let xp = 0;
    let level = 1;
    let lastLevelUpDay = null;
    let lastRepDay = null;
    let streak = 0;
    let lastLevelUpAt = null;

    for (const rep of reps) {
      const day = ymd(rep.created_at);

      // Streak step — strict same-day or next-day continuation.
      if (lastRepDay === null) {
        streak = 1;
      } else {
        const last = new Date(lastRepDay).getTime();
        const cur = new Date(day).getTime();
        const dayMs = 86_400_000;
        if (day === lastRepDay) {
          // multiple reps same day — streak unchanged
        } else if (cur - last === dayMs) {
          streak += 1;
        } else {
          streak = 1;
        }
      }
      lastRepDay = day;

      const composite = Number(rep.composite_score);
      const grant = Math.round(
        BASE_XP * bandMultiplier(composite) * streakMultiplier(streak),
      );
      xp += grant;
      const computedLevel = levelFromXp(xp);

      // Anti-grinding cap (one level-up per UTC day).
      if (computedLevel > level && lastLevelUpDay !== day) {
        level = Math.min(MAX_LEVEL, computedLevel);
        lastLevelUpDay = day;
        lastLevelUpAt = rep.created_at;
        totalLevelUps += 1;
      }
    }

    if (DRY_RUN) {
      console.log(
        `  user=${userId.slice(0, 8)} reps=${reps.length} → xp=${xp} level=${level}`,
      );
    } else {
      await sql`
        UPDATE cognify_v2.users
        SET xp = ${xp},
            level = ${level},
            lifetime_reps = ${reps.length},
            last_level_up_at = ${lastLevelUpAt}
        WHERE id = ${userId}
      `;
    }
    processed += 1;
  }

  console.log(
    `\nDone. Processed ${processed} user(s). Total level-ups: ${totalLevelUps}.${DRY_RUN ? " (dry run — no writes)" : ""}\n`,
  );
  await sql.end();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
