/**
 * PRD v3 Phase 3 — backfill cognify_v2.communication_profile from
 * historical reps.
 *
 * Replays every user's scored reps chronologically through the same
 * applyRepToProfile fold saveRep uses, so a backfilled profile is
 * indistinguishable from one accumulated live. Idempotent: rebuilds
 * each profile from scratch on every run (safe to re-run after more
 * reps land).
 *
 * Skips: mock-fallback reps (model_version = 'mock-fallback-v1'),
 * reps with no dimension scores.
 *
 * Usage:
 *   npx tsx scripts/backfill-communication-profile.ts --dry-run
 *   npx tsx scripts/backfill-communication-profile.ts --apply
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import {
  applyRepToProfile,
  emptyProfile,
  type CommunicationProfileState,
} from "../src/lib/profile/communication-profile";
import { decodeDimensionSignals } from "../src/lib/scoring/signals";
import { aliasLegacyDimension } from "../src/lib/scoring/dimension-aliases";
import { SKILL_DIMENSIONS } from "../src/types/domain";

const CANONICAL = new Set<string>(SKILL_DIMENSIONS);

const DRY_RUN = !process.argv.includes("--apply");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1, prepare: false });

  try {
    const rows = await sql<
      {
        user_id: string;
        rep_id: string;
        created_at: Date;
        composite_score: number | null;
        application: string | null;
        application_skills: string[] | null;
        dimension: string;
        score: number;
        signals: unknown;
      }[]
    >`
      SELECT r.user_id, r.id AS rep_id, r.created_at,
             r.composite_score, e.application, e.application_skills,
             ds.dimension::text AS dimension, ds.score, ds.signals
      FROM cognify_v2.reps r
      LEFT JOIN cognify_v2.exercises e ON e.id = r.exercise_id
      JOIN cognify_v2.dimension_scores ds ON ds.rep_id = r.id
      WHERE COALESCE(r.model_version, '') <> 'mock-fallback-v1'
        AND r.composite_score IS NOT NULL
      ORDER BY r.user_id, r.created_at ASC, r.id
    `;

    // Group rows into (user → ordered reps → evidence).
    type Evidence = {
      at: string;
      dimensions: { dimension: string; score: number }[];
      subSkillScores: Record<string, number>;
      applicationId: string | null;
      applicationSkills: string[] | null;
      composite: number | null;
    };
    const byUser = new Map<string, Map<string, Evidence>>();
    for (const row of rows) {
      let userReps = byUser.get(row.user_id);
      if (!userReps) {
        userReps = new Map();
        byUser.set(row.user_id, userReps);
      }
      let ev = userReps.get(row.rep_id);
      if (!ev) {
        ev = {
          at: row.created_at.toISOString(),
          dimensions: [],
          subSkillScores: {},
          applicationId: row.application ?? null,
          applicationSkills: row.application_skills ?? null,
          composite: row.composite_score,
        };
        userReps.set(row.rep_id, ev);
      }
      // Alias legacy dims (pacing→delivery etc.) to the v3 canon so old
      // reps contribute to the right estimate; canonical dims pass through.
      const canonical = CANONICAL.has(row.dimension)
        ? row.dimension
        : aliasLegacyDimension(row.dimension);
      if (canonical) {
        ev.dimensions.push({ dimension: canonical, score: row.score });
      }
      const decoded = decodeDimensionSignals(row.signals);
      if (decoded.subSkillScores) {
        for (const [id, v] of Object.entries(decoded.subSkillScores)) {
          if (typeof v === "number") ev.subSkillScores[id] = v;
        }
      }
    }

    let usersDone = 0;
    for (const [userId, userReps] of byUser) {
      let profile: CommunicationProfileState = emptyProfile();
      for (const ev of userReps.values()) {
        profile = applyRepToProfile(profile, ev);
      }
      if (DRY_RUN) {
        usersDone++;
        continue;
      }
      await sql`
        INSERT INTO cognify_v2.communication_profile
          (user_id, overall_score, core_skills, hidden_skills, applications, total_reps, updated_at)
        VALUES (
          ${userId},
          ${profile.overallScore},
          ${sql.json(profile.coreSkills)},
          ${sql.json(profile.hiddenSkills)},
          ${sql.json(profile.applications)},
          ${profile.totalReps},
          now()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          overall_score = EXCLUDED.overall_score,
          core_skills   = EXCLUDED.core_skills,
          hidden_skills = EXCLUDED.hidden_skills,
          applications  = EXCLUDED.applications,
          total_reps    = EXCLUDED.total_reps,
          updated_at    = now()
      `;
      usersDone++;
    }

    console.log(
      `[backfill-communication-profile] ${DRY_RUN ? "DRY RUN — " : ""}${usersDone} users, ${rows.length} dim rows replayed.`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[backfill-communication-profile] fatal:", err);
  process.exit(1);
});
