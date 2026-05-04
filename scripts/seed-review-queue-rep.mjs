// One-shot seeder: insert a synthetic rep with composite >= 95 + per-dim
// scores so /ops/review-queue has at least one row to demonstrate the
// flow. Operator-only seed; safe to delete the row afterwards via SQL.
//
// Usage:
//   npx vercel env pull .env.prod-temp --environment=production --yes
//   node scripts/seed-review-queue-rep.mjs
//   rm .env.prod-temp

import { config } from "dotenv";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

config({ path: ".env.prod-temp" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set in .env.prod-temp");
  process.exit(1);
}

const c = postgres(url, { max: 1, prepare: false });

try {
  // Pick the first operator user — the seeded rep will be theirs so the
  // /ops/review-queue page shows a recognizable owner.
  const operators = await c`
    SELECT id, email FROM cognify_v2.users
    WHERE is_operator = true
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (operators.length === 0) {
    console.error("No operator users found. Set is_operator=true on a user first.");
    process.exit(1);
  }
  const op = operators[0];
  console.log("Seeding for operator:", op.email);

  // Need a valid session_id. Reuse the operator's most recent session,
  // or create a synthetic one if none exists.
  let sessions = await c`
    SELECT id FROM cognify_v2.practice_sessions
    WHERE user_id = ${op.id}
    ORDER BY started_at DESC NULLS LAST
    LIMIT 1
  `;
  let sessionId;
  if (sessions.length === 0) {
    sessionId = randomUUID();
    await c`
      INSERT INTO cognify_v2.practice_sessions (id, user_id, mode, started_at)
      VALUES (${sessionId}, ${op.id}, 'baseline', now())
    `;
    console.log("Created synthetic session:", sessionId);
  } else {
    sessionId = sessions[0].id;
    console.log("Reusing session:", sessionId);
  }

  // Insert the rep with composite=96 (just above the 95 review threshold).
  const repId = randomUUID();
  await c`
    INSERT INTO cognify_v2.reps (
      id, session_id, user_id, prompt_text, duration_ms,
      transcript, topic, composite_score, model_version, rubric_version, status,
      created_at
    ) VALUES (
      ${repId}, ${sessionId}, ${op.id},
      'Pitch your AI productivity tool to a busy investor in 30 seconds.',
      28000,
      ${JSON.stringify({ transcript: "We're building Cognify — a daily speaking gym that drills the six core communication skills. Twelve thousand users in beta saw a measurable lift in clarity, structure, and conciseness within four weeks. We charge per seat, no usage tiers, and our customer LTV at six months is already 8x acquisition cost. We're raising five million to expand the prosody worker and ship the team-coaching tier." })},
      'AI productivity pitch',
      96,
      'claude-haiku-4-5-20251001',
      'v3.2.0',
      'completed',
      now()
    )
  `;

  // Per-dim scores in dimension_scores so the queue page shows the
  // breakdown.
  const dimEntries = [
    ["clarity", 96],
    ["structure", 95],
    ["conciseness", 97],
    ["thinking_quality", 95],
    ["delivery", 96],
    ["tone", 96],
  ];
  for (const [dim, score] of dimEntries) {
    await c`
      INSERT INTO cognify_v2.dimension_scores (rep_id, dimension, score, signals)
      VALUES (${repId}, ${dim}, ${score}, ${JSON.stringify([
        "Tight cause-effect chain landed.",
        "Numbers carried the credibility.",
      ])})
    `;
  }

  console.log("\nSeeded rep:", repId);
  console.log("Composite: 96 (above 95 review threshold)");
  console.log("View at /ops/review-queue");
} finally {
  await c.end();
}
