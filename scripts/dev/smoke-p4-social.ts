/**
 * Dev-only smoke for UI Overhaul Phase 4 (Social) — exercises the REAL
 * `getActivityFeedForUser` code path against the database to prove:
 *   4.2 — actor name shows the registered name, or the email local part when
 *         a user never set a name (never "Someone" when a name/email exists).
 *   4.3 — "strongest" is each actor's real top Core Skill (varies per actor),
 *         not a hardcoded "delivery".
 *
 * Fully hermetic: seeds its own @cognify.test users (p4-smoke-*), runs the
 * query, asserts, and deletes everything it created (FK cascades clean the
 * friendships / activity_events / communication_profile rows).
 *
 * Run: npx tsx --env-file=.env.local scripts/dev/smoke-p4-social.ts
 */
import postgres from "postgres";
import { getActivityFeedForUser } from "@/lib/db/queries/activity";

const SCHEMA = "cognify_v2";
const ME = "p4-smoke-me@cognify.test";
const ALICE = "p4-smoke-alice@cognify.test"; // has a name; strongest = clarity
const BOB = "p4-smoke-bob@cognify.test"; // NO name (email fallback); strongest = tone

const sql = postgres(process.env.DATABASE_URL!, { max: 4, prepare: false });

let failures = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.log(`  ✗ ${label} ${detail}`);
  }
}

// A coreSkills map whose `top` dimension is the clear highest score.
function coreSkills(top: string) {
  const dims = [
    "clarity",
    "structure",
    "conciseness",
    "thinking_quality",
    "delivery",
    "tone",
  ];
  const now = new Date().toISOString();
  const map: Record<string, { score: number; sampleCount: number; updatedAt: string }> = {};
  for (const d of dims) {
    map[d] = { score: d === top ? 88 : 55, sampleCount: 4, updatedAt: now };
  }
  return map;
}

async function upsertUser(email: string, name: string | null): Promise<string> {
  const rows = await sql`
    INSERT INTO ${sql(SCHEMA)}.users (email, name, onboarded_at)
    VALUES (${email}, ${name}, NOW())
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
    RETURNING id::text
  `;
  const row = rows[0];
  if (!row) throw new Error(`failed to upsert user ${email}`);
  return row.id as string;
}

async function main() {
  console.log("── Seeding Phase 4 social smoke data ──");
  const meId = await upsertUser(ME, "Me Smoke");
  const aliceId = await upsertUser(ALICE, "Alice Rivera");
  const bobId = await upsertUser(BOB, null);

  // Accepted friendships: me <-> alice, me <-> bob (side-agnostic query).
  await sql`DELETE FROM ${sql(SCHEMA)}.friendships
            WHERE requester_id IN (${meId}, ${aliceId}, ${bobId})
               OR recipient_id IN (${meId}, ${aliceId}, ${bobId})`;
  await sql`INSERT INTO ${sql(SCHEMA)}.friendships (requester_id, recipient_id, status, responded_at)
            VALUES (${aliceId}, ${meId}, 'accepted', NOW()),
                   (${bobId}, ${meId}, 'accepted', NOW())`;

  // Communication profiles with distinct strongest skills.
  for (const [uid, top] of [
    [aliceId, "clarity"],
    [bobId, "tone"],
  ] as const) {
    await sql`
      INSERT INTO ${sql(SCHEMA)}.communication_profile (user_id, overall_score, core_skills, total_reps)
      VALUES (${uid}, 72, ${sql.json(coreSkills(top))}, 4)
      ON CONFLICT (user_id) DO UPDATE SET core_skills = EXCLUDED.core_skills`;
  }

  // A workout_complete event per friend (this is the row that carries the
  // "strongest" line). payload.topDimension intentionally set to a WRONG,
  // identical value to prove 4.3 no longer reads it.
  await sql`DELETE FROM ${sql(SCHEMA)}.activity_events WHERE user_id IN (${aliceId}, ${bobId})`;
  for (const uid of [aliceId, bobId]) {
    await sql`
      INSERT INTO ${sql(SCHEMA)}.activity_events (user_id, type, payload)
      VALUES (${uid}, 'workout_complete',
              ${sql.json({ type: "workout_complete", composite: 80, repsCount: 1, topDimension: "delivery" })})`;
  }

  console.log("── Running getActivityFeedForUser (real code path) ──");
  const feed = await getActivityFeedForUser(meId, { limit: 30 });
  const alice = feed.find((r) => r.userId === aliceId);
  const bob = feed.find((r) => r.userId === bobId);

  console.log("  feed rows:", feed.map((r) => ({ name: r.userName, top: r.topCoreSkill })));

  check("Alice event present", !!alice, JSON.stringify(alice));
  check("Bob event present", !!bob, JSON.stringify(bob));
  // 4.2 — real name / email fallback, never "Someone" here.
  check("4.2 Alice shows registered name", alice?.userName === "Alice Rivera", `got "${alice?.userName}"`);
  check("4.2 Bob (no name) falls back to email local part", bob?.userName === "p4-smoke-bob", `got "${bob?.userName}"`);
  check("4.2 Bob is not 'Someone'", (bob?.userName ?? "").toLowerCase() !== "someone");
  // 4.3 — real, per-actor, VARYING top Core Skill (not the payload's "delivery").
  check("4.3 Alice strongest = clarity (from profile)", alice?.topCoreSkill === "clarity", `got "${alice?.topCoreSkill}"`);
  check("4.3 Bob strongest = tone (from profile)", bob?.topCoreSkill === "tone", `got "${bob?.topCoreSkill}"`);
  check("4.3 strongest VARIES across actors", alice?.topCoreSkill !== bob?.topCoreSkill);
  check("4.3 ignores payload.topDimension ('delivery')", alice?.topCoreSkill !== "delivery" && bob?.topCoreSkill !== "delivery");
}

main()
  .catch((e) => {
    failures++;
    console.error("SMOKE ERROR:", e);
  })
  .finally(async () => {
    // Cleanup: deleting the seeded users cascades to friendships,
    // activity_events, and communication_profile.
    await sql`DELETE FROM ${sql(SCHEMA)}.users
              WHERE email IN (${ME}, ${ALICE}, ${BOB})`;
    await sql.end();
    console.log(failures === 0 ? "\n✅ P4 social smoke PASSED" : `\n❌ P4 social smoke FAILED (${failures})`);
    process.exit(failures === 0 ? 0 : 1);
  });
