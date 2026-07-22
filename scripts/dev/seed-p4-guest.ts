/**
 * Dev-only: seed a GUEST user (by cookie id) with a rep + friends + varied
 * activity so the Phase 4 social surfaces can be rendered end-to-end in the
 * running app WITHOUT a Supabase sign-in (dodges the auth rate limit).
 *
 *   - 1 session + rep so the dashboard clears its "no reps" empty state and
 *     mounts the Friends activity card (4.1).
 *   - 12 workout_complete events across 3 friends (one nameless → email
 *     fallback; distinct strongest Core Skills) so /friends shows real names
 *     (4.2), varied strongest skill (4.3), and a working "Show more" (4.4:
 *     12 > the 10 initial cap).
 *
 * Run: npx tsx --env-file=.env.local scripts/dev/seed-p4-guest.ts <guestId>
 * Cleanup: append `--clean` to remove the seeded friends (leaves the guest).
 */
import postgres from "postgres";

const SCHEMA = "cognify_v2";
const guestIdArg = process.argv[2];
const clean = process.argv.includes("--clean");
if (!guestIdArg) {
  console.error("usage: seed-p4-guest.ts <guestId> [--clean]");
  process.exit(1);
}
// Re-bind as a `string`-typed const so the narrowing survives into the async
// `main()` closure (module-level CFA narrowing doesn't flow into nested fns).
const guestId: string = guestIdArg;

const FRIENDS = [
  { email: "p4-guest-alice@cognify.test", name: "Alice Rivera", top: "clarity" },
  { email: "p4-guest-ben@cognify.test", name: null, top: "tone" }, // nameless → email fallback
  { email: "p4-guest-cara@cognify.test", name: "Cara Lopez", top: "delivery" }, // renders "Pacing"
];

const sql = postgres(process.env.DATABASE_URL!, { max: 4, prepare: false });

function coreSkills(top: string) {
  const dims = ["clarity", "structure", "conciseness", "thinking_quality", "delivery", "tone"];
  const now = new Date().toISOString();
  const m: Record<string, { score: number; sampleCount: number; updatedAt: string }> = {};
  for (const d of dims) m[d] = { score: d === top ? 90 : 50, sampleCount: 5, updatedAt: now };
  return m;
}

async function main() {
  const emails = FRIENDS.map((f) => f.email);

  if (clean) {
    await sql`DELETE FROM ${sql(SCHEMA)}.users WHERE email IN ${sql(emails)}`;
    console.log("cleaned seeded friends");
    return;
  }

  // Ensure the guest row exists (middleware creates it on first request, but
  // seed defensively so the script is order-independent).
  await sql`INSERT INTO ${sql(SCHEMA)}.users (id, is_guest, name)
            VALUES (${guestId}, true, 'Guest')
            ON CONFLICT (id) DO NOTHING`;

  // One session + rep so hasAnyReps is true on the dashboard.
  const [sess] = await sql`
    INSERT INTO ${sql(SCHEMA)}.practice_sessions (user_id, mode, composite_score)
    VALUES (${guestId}, 'daily_workout', 80)
    RETURNING id::text`;
  if (!sess) throw new Error("failed to insert practice_session");
  await sql`
    INSERT INTO ${sql(SCHEMA)}.reps (session_id, user_id, prompt_text, duration_ms, composite_score, topic)
    VALUES (${sess.id}, ${guestId}, 'Warm up: introduce yourself in 60 seconds.', 60000, 80, 'intro')`;

  for (const f of FRIENDS) {
    const [u] = await sql`
      INSERT INTO ${sql(SCHEMA)}.users (email, name, onboarded_at)
      VALUES (${f.email}, ${f.name}, NOW())
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id::text`;
    if (!u) throw new Error(`failed to upsert friend ${f.email}`);
    const fid = u.id as string;

    await sql`DELETE FROM ${sql(SCHEMA)}.friendships
              WHERE (requester_id = ${fid} AND recipient_id = ${guestId})
                 OR (requester_id = ${guestId} AND recipient_id = ${fid})`;
    await sql`INSERT INTO ${sql(SCHEMA)}.friendships (requester_id, recipient_id, status, responded_at)
              VALUES (${fid}, ${guestId}, 'accepted', NOW())`;

    await sql`
      INSERT INTO ${sql(SCHEMA)}.communication_profile (user_id, overall_score, core_skills, total_reps)
      VALUES (${fid}, 74, ${sql.json(coreSkills(f.top))}, 5)
      ON CONFLICT (user_id) DO UPDATE SET core_skills = EXCLUDED.core_skills`;

    // 4 workout_complete events each (3 friends × 4 = 12 > 10 initial cap).
    await sql`DELETE FROM ${sql(SCHEMA)}.activity_events WHERE user_id = ${fid}`;
    for (let i = 0; i < 4; i++) {
      await sql`
        INSERT INTO ${sql(SCHEMA)}.activity_events (user_id, type, payload)
        VALUES (${fid}, 'workout_complete',
                ${sql.json({ type: "workout_complete", composite: 78 + i, repsCount: 1, topDimension: "delivery" })})`;
    }
  }
  console.log(`seeded guest ${guestId} with a rep + ${FRIENDS.length} friends × 4 events`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
