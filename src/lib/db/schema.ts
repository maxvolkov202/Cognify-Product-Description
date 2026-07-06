import {
  pgSchema,
  text,
  timestamp,
  integer,
  real,
  jsonb,
  boolean,
  uuid,
  date,
  index,
  uniqueIndex,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type {
  ActivityPayload,
  NotificationPayload,
} from "@/types/db-payloads";

// All v2 tables live in the `cognify_v2` Postgres schema so they don't
// collide with Bob's v1 tables in `public` on the same Supabase project.
export const cognifyV2Schema = pgSchema("cognify_v2");

export const modeEnum = cognifyV2Schema.enum("mode", [
  "daily_workout",
  "skill_lab",
  "scenario_training",
  "baseline",
  // PRD v3 Phase 5 (migration 0033) — Build a Rep v2 event preparation.
  "build_a_rep",
]);

// v3.0.0 rubric (DNA reconciliation 2026-05-01). The enum is append-only
// because Postgres cannot remove an enum value with existing rows
// referencing it. Current canonical names: clarity, structure, conciseness,
// thinking_quality, delivery, tone. Adaptability + relevance + confidence +
// pacing remain in the enum for historical reads only — they get aliased
// to current names by src/lib/scoring/dimension-aliases.ts.
// New writes ONLY use the current v3 names.
export const dimensionEnum = cognifyV2Schema.enum("dimension", [
  // Current (v3.0.0) dimensions
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "tone",
  "structural_adherence",
  // Legacy (v2.0.0) dimension — retained for historical reads only
  "adaptability",
  // Legacy (v2-beta.*) dimensions — retained for historical reads only
  "relevance",
  "confidence",
  "pacing",
]);

export const calloutToneEnum = cognifyV2Schema.enum("callout_tone", [
  "positive",
  "neutral",
  "warn",
  "critical",
]);

export const verticalEnum = cognifyV2Schema.enum("vertical", [
  "sales",
  "consulting",
  "finance",
  "healthcare",
  "law",
  "education",
  "leadership",
  "other",
]);

// Session-type enum for the WS-6 Focus/Combined/Flow picker — persisted
// on practice_sessions so per-type analytics + streak splits are possible.
export const sessionTypeEnum = cognifyV2Schema.enum("session_type", [
  "focus",
  "combined",
  "flow",
]);

// Pressure archetype enum for WS-3 reps that are pressure reps. Stored
// on reps.pressure_archetype_id so pressure analytics no longer have to
// parse "Pressure · X" from the topic text hack.
export const pressureArchetypeEnum = cognifyV2Schema.enum(
  "pressure_archetype",
  [
    "pushback",
    "time_compression",
    "audience_switch",
    "clarifying_interrupt",
    "stakes_raise",
  ],
);

// Bug-report triage status. open → in_progress → fixed/wontfix/duplicate.
// Operators (users.is_operator) own status transitions.
export const bugStatusEnum = cognifyV2Schema.enum("bug_status", [
  "open",
  "in_progress",
  "fixed",
  "wontfix",
  "duplicate",
]);

export const users = cognifyV2Schema.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Links our user row to Supabase's auth.users.id. Nullable because guests
  // don't have an auth.users row yet — set at sign-in time. Unique because
  // each Supabase auth user maps to exactly one cognify user (guest promotion
  // flow updates the existing guest row rather than creating a duplicate).
  authUserId: uuid("auth_user_id").unique(),
  // DB-side this is `citext` (migration 0027) so comparisons are
  // case-insensitive. drizzle doesn't have first-class citext support;
  // we keep the column as text in TS — the case-insensitivity is
  // enforced by the column type itself.
  email: text("email").unique(),
  name: text("name"),
  image: text("image"),
  isGuest: boolean("is_guest").notNull().default(false),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Onboarding — team-spec v2 replan. Required for all authenticated-or-guest
  // users before they can access the gym. Updatable later from /settings.
  vertical: verticalEnum("vertical"),
  personas: jsonb("personas").$type<string[]>().default([]),
  improvementGoals: jsonb("improvement_goals").$type<string[]>().default([]),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  tutorialSeenAt: timestamp("tutorial_seen_at", { withTimezone: true }),
  isOperator: boolean("is_operator").notNull().default(false),
  /** The user's baseline rep — their first-ever 60-second self-introduction.
   *  Referenced by dashboard + /progress to show how far they've come.
   *  FK with ON DELETE SET NULL added in migration 0026; dashboard
   *  handles a null baseline cleanly. */
  baselineRepId: uuid("baseline_rep_id").references((): AnyPgColumn => reps.id, {
    onDelete: "set null",
  }),
  // WS-7 habit system — streak freezes earned + spent. Earned after
  // every completed 7-day streak; consumed when a day is missed. Cap at
  // 3 freezes stored.
  streakFreezes: integer("streak_freezes").notNull().default(0),
  // DNA Ch.7 — Levels 1-100 + XP. Backfilled on deploy via
  // scripts/backfill-progression.mjs.
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  lifetimeReps: integer("lifetime_reps").notNull().default(0),
  /** Anti-grinding: at most one level-up per UTC day. XP still accrues
   *  for tomorrow when capped. */
  lastLevelUpAt: timestamp("last_level_up_at", { withTimezone: true }),
  // WS-3 cross-session archetype rotation: excludes the previous
  // session's archetype from the next session's selection so users
  // don't see the same archetype back-to-back.
  lastPressureArchetypeId: pressureArchetypeEnum("last_pressure_archetype_id"),
  // WS-6 tomorrow's-focus bias: the weakest dim from the user's most
  // recent session. Cached here so planTodaysWorkout doesn't have to
  // re-scan progressSnapshots on every workout-page load.
  lastSessionWeakestDimension: dimensionEnum("last_session_weakest_dimension"),
  // WS-8 PWA install prompt gate — cross-device rep count (was
  // previously client-localStorage only).
  completedRepsCount: integer("completed_reps_count").notNull().default(0),
  // Phase 10 — IANA timezone string ('America/New_York', 'UTC'…). The
  // muscle-group rollover cron closes each day at user-local midnight.
  // Best-effort inferred client-side on first launch; defaults to UTC.
  tz: text("tz").notNull().default("UTC"),
  // Phase C — custom weekly training schedule. 7-bit bitmask: bit 0 = Mon,
  // bit 6 = Sun. Default 31 (binary 0011111) = Mon..Fri ("5 days a week"
  // trainer recommendation). Users opt down to any subset via onboarding
  // or /settings. The daily assignment, streak math, and weakness-day
  // logic all read from this. See src/lib/onboarding/committed-days.ts.
  committedDays: integer("committed_days").notNull().default(31),
  // PRD v3 Phase 3 (PRD §8.2) — career-stage context for prompt/coaching
  // personalization. Never affects scoring. student | early_career |
  // individual_contributor | manager | senior_leader | executive.
  communicationStage: text("communication_stage"),
  // Voice is biometric PII under GDPR/CCPA. The audio-retention cron
  // sweeps reps older than this many days, deletes the blob, and nulls
  // reps.audio_url + reps.transcript. NULL = user opted out (keep
  // forever). Default 90 — long enough to revisit recent reps, short
  // enough to limit storage-leak blast radius.
  audioRetentionDays: integer("audio_retention_days").default(90),
  // PRD v3 Phase 6.8 (migration 0034) — committed-day reminder emails.
  reminderEmailsEnabled: boolean("reminder_emails_enabled")
    .notNull()
    .default(true),
  /** Dedupe: at most one reminder per user-local day (YYYY-MM-DD). */
  lastReminderSentAt: date("last_reminder_sent_at"),
});

export const teams = cognifyV2Schema.table("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  billingEmail: text("billing_email"),
});

export const memberships = cognifyV2Schema.table(
  "memberships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.teamId] })],
);

export const frameworks = cognifyV2Schema.table("frameworks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  nodes: jsonb("nodes").notNull(),
  source: text("source").notNull().default("library"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scenarios = cognifyV2Schema.table(
  "scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scenario: text("scenario").notNull(),
    audience: text("audience"),
    keyPoints: jsonb("key_points"),
    outcome: text("outcome"),
    constraints: text("constraints"),
    frameworkId: uuid("framework_id").references(() => frameworks.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("scenarios_user_idx").on(t.userId)],
);

export const practiceSessions = cognifyV2Schema.table(
  "practice_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mode: modeEnum("mode").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    scenarioId: uuid("scenario_id").references(() => scenarios.id, {
      onDelete: "set null",
    }),
    compositeScore: real("composite_score"),
    // WS-6 session type — nullable for historical rows. New rows
    // populate from the session-type picker. Drives per-type
    // analytics + per-type streak splits on /progress.
    sessionType: sessionTypeEnum("session_type"),
    // WS-6 Focus Workout: populated only when sessionType='focus'.
    focusDimension: dimensionEnum("focus_dimension"),
  },
  (t) => [index("sessions_user_started_idx").on(t.userId, t.startedAt)],
);

export const reps = cognifyV2Schema.table(
  "reps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => practiceSessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    promptText: text("prompt_text").notNull(),
    frameworkId: uuid("framework_id").references(() => frameworks.id, {
      onDelete: "set null",
    }),
    // Frozen copy of the rep-type framework the rep was scored against.
    // Loose-typed here to avoid a circular import with the framework lib;
    // read sites narrow with zod.
    frameworkSnapshot: jsonb("framework_snapshot").$type<Record<string, unknown>>(),
    durationMs: integer("duration_ms").notNull(),
    audioUrl: text("audio_url"),
    // Persisted transcript: { text: string; words?: ... }. Words layout
    // varies by provider (Deepgram). Read sites use the text key only.
    transcript: jsonb("transcript").$type<{ text: string; words?: unknown[] }>(),
    topic: text("topic"),
    compositeScore: real("composite_score"),
    modelVersion: text("model_version"),
    rubricVersion: text("rubric_version"),
    // pending → processing → completed | failed. Default "completed" preserves
    // backward compatibility while the sync scoring path still exists. When
    // Phase 4 (async Edge Function scoring) lands, new reps insert as "pending".
    status: text("status").notNull().default("completed"),
    // WS-3 pressure rep tagging — replaces the "Pressure · X" topic
    // prefix hack. Nullable for non-pressure reps + historical rows.
    pressureArchetypeId: pressureArchetypeEnum("pressure_archetype_id"),
    // Muscle-group pivot (migration 0020). Nullable so legacy reps + Skill
    // Lab reps stay untouched; populated when a rep originates inside a
    // workout-day session. Forward thunks to exercises/muscleGroupDays —
    // those tables are declared after reps in this file; same pattern
    // already used for frameworkId.
    exerciseId: uuid("exercise_id").references(() => exercises.id, {
      onDelete: "set null",
    }),
    muscleGroupDayId: uuid("muscle_group_day_id").references(
      () => muscleGroupDays.id,
      { onDelete: "set null" },
    ),
    isGraduationRep: boolean("is_graduation_rep").notNull().default(false),
    scoreFailureFlag: boolean("score_failure_flag").notNull().default(false),
    // PRD v3 Phase 1 (migration 0028) — Universal Training Engine attempt
    // lineage. Every exercise now produces a First Rep and a required Retry;
    // "again" covers optional extra attempts after the Improvement Review.
    // Default 'first' keeps all historical rows valid.
    attemptKind: text("attempt_kind").notNull().default("first"),
    // For retry/again reps: the First Rep this attempt is improving on.
    // SET NULL (not cascade) so a purged first rep doesn't take the retry's
    // history with it.
    parentRepId: uuid("parent_rep_id").references((): AnyPgColumn => reps.id, {
      onDelete: "set null",
    }),
    // The Coach's Focus this rep RECEIVED after scoring:
    // { dimension, subSkill?, text }. Written post-scoring; read by the
    // retry flow + Phase 3 coaching memory.
    coachFocus: jsonb("coach_focus").$type<{
      dimension: string;
      subSkill?: string | null;
      text: string;
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reps_session_idx").on(t.sessionId),
    index("reps_user_created_idx").on(t.userId, t.createdAt),
    index("reps_status_idx").on(t.status),
    index("reps_pressure_archetype_idx").on(t.pressureArchetypeId),
    index("reps_exercise_idx").on(t.exerciseId),
    index("reps_mgd_idx").on(t.muscleGroupDayId),
    index("reps_parent_rep_idx").on(t.parentRepId),
  ],
);

/**
 * PRD v3 Phase 3 — the Communication Profile (PRD §8.3).
 *
 * ONE row per user: Cognify's slowly-evolving estimate of how they
 * communicate. Rep scores are evidence; this is the estimate (count-
 * scaled EMA, src/lib/profile/communication-profile.ts). Written by
 * saveRep on every scored rep; read by the Communication Snapshot,
 * coaching memory, and (Phase 6) the Overall Communication Score UI.
 */
export const communicationProfile = cognifyV2Schema.table(
  "communication_profile",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    /** PRD §10.3 Overall Communication Score. Null until ≥3 core skills
     *  have evidence. */
    overallScore: real("overall_score"),
    /** { [dimension]: { score, sampleCount, updatedAt } } — v3 canonical
     *  dims (delivery, not pacing). */
    coreSkills: jsonb("core_skills")
      .$type<Record<string, { score: number; sampleCount: number; updatedAt: string }>>()
      .notNull()
      .default({}),
    /** { [subSkillId]: { score, sampleCount } } — 36 Hidden Skills. */
    hiddenSkills: jsonb("hidden_skills")
      .$type<Record<string, { score: number; sampleCount: number }>>()
      .notNull()
      .default({}),
    /** PRD v3 Phase 4 (PRD §8.3.6 + §8.4.5) — per-application performance
     *  plus nested hidden Application Skill estimates:
     *  { [applicationId]: { score, sampleCount, updatedAt,
     *    skills?: { [skillId]: { score, sampleCount } } } }.
     *  Derived from composites of that application's reps (same EMA rule). */
    applications: jsonb("applications")
      .$type<
        Record<
          string,
          {
            score: number;
            sampleCount: number;
            updatedAt: string;
            skills?: Record<string, { score: number; sampleCount: number }>;
          }
        >
      >()
      .notNull()
      .default({}),
    totalReps: integer("total_reps").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

/**
 * PRD v3 Phase 1 — Coaching History (seed of PRD §8.3.9).
 *
 * One row per Coach's Focus delivered to a user. The retry's evaluation
 * back-fills `implemented_verdict` on the FIRST rep's row, giving Phase 3's
 * coaching memory a queryable ledger of "what was coached, and did the user
 * implement it" without re-parsing feedback jsonb.
 */
export const coachingEvents = cognifyV2Schema.table(
  "coaching_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    repId: uuid("rep_id")
      .notNull()
      .references((): AnyPgColumn => reps.id, { onDelete: "cascade" }),
    dimension: dimensionEnum("dimension").notNull(),
    /** Hidden Skill id from src/types/sub-skills.ts. Nullable — early
     *  focuses may be dimension-level only. Plain text (not an enum) so the
     *  36-skill taxonomy can grow without migrations. */
    subSkill: text("sub_skill"),
    focusText: text("focus_text").notNull(),
    /** 'nailed' | 'partial' | 'missed' — set by the retry's Improvement
     *  Review evaluation. NULL until the retry lands (or forever, if the
     *  user quit before retrying). */
    implementedVerdict: text("implemented_verdict"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("coaching_events_user_created_idx").on(t.userId, t.createdAt),
    index("coaching_events_rep_idx").on(t.repId),
  ],
);

/**
 * PRD v3 Phase 5 — Build a Rep: event preparation (PRD §7, §8.4.6).
 * Migration 0032. One prep_events row per real-world communication event;
 * critical_moments = the editable Preparation Plan; prep_context_uploads =
 * optional docs (raw file in Supabase Storage, parsed text inline);
 * readiness_reviews = PRD §7.9 output per guided session / simulation.
 */
export const prepEvents = cognifyV2Schema.table(
  "prep_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    /** interview | presentation | pitch | toast | demo | meeting | speech | other */
    eventType: text("event_type").notNull().default("other"),
    /** guided | simulation (PRD §7.6 — Cognify recommends, user chooses). */
    recommendedMode: text("recommended_mode").notNull().default("guided"),
    /** Full Simulation recommended duration (PRD §7.8), editable pre-rep. */
    recommendedDurationSec: integer("recommended_duration_sec"),
    /** Distilled summary of all parsed uploads, injected into generation. */
    contextSummary: text("context_summary"),
    /** Latest readiness estimate (PRD §8.3.8) — denormalized from the
     *  newest readiness_reviews row. */
    readinessScore: real("readiness_score"),
    /** active | archived */
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("prep_events_user_idx").on(t.userId, t.status, t.createdAt)],
);

export const criticalMoments = cognifyV2Schema.table(
  "critical_moments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => prepEvents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** What a strong answer/section accomplishes — feeds the moment's
     *  Coach's Insight and scoring context. */
    objective: text("objective"),
    recommendedSeconds: integer("recommended_seconds").notNull().default(90),
    sortOrder: integer("sort_order").notNull().default(0),
    /** generated | user (PRD §7.7 — plan is fully editable). */
    source: text("source").notNull().default("generated"),
    bestComposite: real("best_composite"),
    attempts: integer("attempts").notNull().default(0),
    lastPracticedAt: timestamp("last_practiced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("critical_moments_event_idx").on(t.eventId, t.sortOrder)],
);

export const prepContextUploads = cognifyV2Schema.table(
  "prep_context_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => prepEvents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    storagePath: text("storage_path"),
    /** pending | parsed | failed | unsupported */
    parseStatus: text("parse_status").notNull().default("pending"),
    parsedChars: integer("parsed_chars"),
    /** Capped at PREP_PARSED_TEXT_CAP chars (src/lib/prep/parse.ts). */
    parsedText: text("parsed_text"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("prep_context_uploads_event_idx").on(t.eventId)],
);

export const readinessReviews = cognifyV2Schema.table(
  "readiness_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => prepEvents.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** guided | simulation */
    mode: text("mode").notNull(),
    overallScore: real("overall_score"),
    /** { [dim]: { score, why, well, improve } } (PRD §7.9 expandable). */
    coreSkills: jsonb("core_skills")
      .$type<
        Record<
          string,
          { score: number; why: string; well: string; improve: string }
        >
      >()
      .notNull()
      .default({}),
    /** The single highest-impact focus before the real event. */
    coachFeedback: text("coach_feedback"),
    readinessSummary: text("readiness_summary"),
    repId: uuid("rep_id").references((): AnyPgColumn => reps.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("readiness_reviews_event_idx").on(t.eventId, t.createdAt)],
);

/**
 * Aggregate prompt engagement signals — drives the prompt-evolution loop.
 *
 * Schema is intentionally per-prompt (no user dimension): the analysis
 * question is "is this PROMPT engaging?", not "what prompts has this
 * USER engaged with" (that's userPromptHistory's job). Keeps row count
 * bounded to bank size (~1300 today, growing slowly).
 *
 * Increment semantics:
 *   shown_count           — bumped when a prompt appears in a rendered slate
 *   picked_count          — bumped when a user starts a rep on this prompt
 *   refreshed_past_count  — bumped when this prompt was shown then
 *                           replaced by a Refresh click
 *
 * Pick rate = picked / shown. Refresh rate = refreshed_past / shown.
 * Combine for prompt-quality scoring; a high refresh rate is a stronger
 * negative signal than a low pick rate alone (one user can drive low
 * picks; refresh-past requires active rejection).
 */
export const promptEngagement = cognifyV2Schema.table(
  "prompt_engagement",
  {
    promptId: text("prompt_id").primaryKey(),
    shownCount: integer("shown_count").notNull().default(0),
    pickedCount: integer("picked_count").notNull().default(0),
    refreshedPastCount: integer("refreshed_past_count").notNull().default(0),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastEventAt: timestamp("last_event_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("prompt_engagement_picked_idx").on(t.pickedCount, t.shownCount),
    index("prompt_engagement_refresh_idx").on(t.refreshedPastCount),
  ],
);

/**
 * DNA Ch.9b — league membership. One row per (user, week). Weekly_xp
 * accumulates as the user earns XP that week; tier + league_id determine
 * the cohort they compete with. Promotion/relegation logic lives in
 * src/lib/engagement/leagues.ts; cron settles the week and assigns the
 * next one.
 */
export const leagueMembership = cognifyV2Schema.table(
  "league_membership",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    tier: text("tier").notNull(),
    leagueId: uuid("league_id").notNull(),
    weeklyXp: integer("weekly_xp").notNull().default(0),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    promotedTo: text("promoted_to"),
    relegatedTo: text("relegated_to"),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.weekStart] }),
    index("league_membership_league_idx").on(t.leagueId, t.weeklyXp),
    index("league_membership_week_tier_idx").on(t.weekStart, t.tier),
  ],
);

/**
 * DNA Ch.15b — calibration drift history. One row per (cron_run, ref_rep)
 * — see drizzle/migrations/0012_calibration_runs.sql for the rationale.
 * The nightly drift cron writes here; /ops/calibration reads recent rows
 * to surface drift trends + a "last run hit fallback path" warning when
 * Anthropic credits lapse.
 */
export const calibrationRuns = cognifyV2Schema.table(
  "calibration_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ranAt: timestamp("ran_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    runId: uuid("run_id").notNull(),
    refRepId: text("ref_rep_id").notNull(),
    expectedComposite: integer("expected_composite"),
    actualComposite: integer("actual_composite"),
    deltaComposite: integer("delta_composite"),
    // Per-dimension expected/actual/delta. Records of { skill_dim: score }.
    expectedPerDim: jsonb("expected_per_dim").$type<Record<string, number>>(),
    actualPerDim: jsonb("actual_per_dim").$type<Record<string, number>>(),
    deltaPerDim: jsonb("delta_per_dim").$type<Record<string, number>>(),
    rubricVersion: text("rubric_version"),
    modelVersion: text("model_version"),
    status: text("status"),
    /** Ch.C1 — when the alert webhook fired for this run. NULL when
     *  no alert was needed or webhook was unconfigured. Same value
     *  for every row in a run_id group (set on insert from the cron). */
    alertSentAt: timestamp("alert_sent_at", { withTimezone: true }),
  },
  (t) => [
    index("calibration_runs_ran_at_idx").on(t.ranAt),
    index("calibration_runs_run_id_idx").on(t.runId),
    index("calibration_runs_ref_rep_idx").on(t.refRepId, t.ranAt),
  ],
);

/**
 * DNA Ch.9d — daily quests. Three quests per user per UTC day, JSONB
 * payload so quest design can iterate without schema churn. Definitions
 * live in code (src/lib/engagement/quests.ts).
 */
export const dailyQuests = cognifyV2Schema.table(
  "daily_quests",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questDate: date("quest_date").notNull(),
    // Stored shape of a daily quest — the `check` callback from
    // src/lib/engagement/quests.ts is intentionally stripped at insert
    // time because functions don't survive JSON.
    quests: jsonb("quests")
      .$type<{ id: string; title: string; description: string; bonusXp: number }[]>()
      .notNull(),
    completion: jsonb("completion")
      .$type<{ completedIds?: string[] }>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.questDate] }),
    index("daily_quests_user_date_idx").on(t.userId, t.questDate),
  ],
);

/**
 * PRD v3 Phase 6 (§10.10, migration 0034) — Weekly Challenges.
 * Week-keyed (Sunday UTC, same week math as leagues) and counter-based:
 * targets span many reps, so progress is a running count per challenge.
 */
export const weeklyChallenges = cognifyV2Schema.table(
  "weekly_challenges",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    challenges: jsonb("challenges")
      .$type<
        { id: string; title: string; description: string; target: number; bonusXp: number }[]
      >()
      .notNull()
      .default([]),
    /** { [challengeId]: count } */
    progress: jsonb("progress")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    completion: jsonb("completion")
      .$type<{ completedIds?: string[]; xpEarned?: number }>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.weekStart] })],
);

/**
 * PRD v3 Phase 6 (§10.11, migration 0034) — Team Challenges: one shared
 * goal per team per week; progress increments on any member's activity.
 */
export const teamWeeklyChallenges = cognifyV2Schema.table(
  "team_weekly_challenges",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    weekStart: date("week_start").notNull(),
    challenge: jsonb("challenge")
      .$type<{ id: string; title: string; target: number }>()
      .notNull(),
    progress: integer("progress").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.weekStart] })],
);

/**
 * DNA Ch.9c — earnable achievements ("badges"). Definitions live in code
 * (src/lib/engagement/achievements.ts); this table only records per-user
 * unlocks. One row per (user, achievement) — uniqueness enforced.
 */
export const userAchievements = cognifyV2Schema.table(
  "user_achievements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id").notNull(),
    earnedAt: timestamp("earned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("user_achievements_user_id_idx").on(t.userId),
    index("user_achievements_earned_at_idx").on(t.earnedAt),
  ],
);

/**
 * Per-user prompt history. Powers the "don't show me the same prompt
 * twice" filter in the picker. Recorded when a user starts a rep
 * (selected the prompt), not merely when the slate is rendered, so
 * refresh-without-pick doesn't burn the bank.
 */
export const userPromptHistory = cognifyV2Schema.table(
  "user_prompt_history",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    promptId: text("prompt_id").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    seenCount: integer("seen_count").notNull().default(1),
  },
  (t) => [
    // PK leading column (userId) already covers point-lookup by userId.
    // The dedicated user_prompt_history_user_idx was redundant; dropped
    // in migration 0026.
    primaryKey({ columns: [t.userId, t.promptId] }),
  ],
);

export const dimensionScores = cognifyV2Schema.table(
  "dimension_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repId: uuid("rep_id")
      .notNull()
      .references(() => reps.id, { onDelete: "cascade" }),
    dimension: dimensionEnum("dimension").notNull(),
    score: real("score").notNull(),
    // Provider-specific signal payload (TextSignals + optional prosody).
    // Loose-typed at the column; consumers (sub-skill mapper) narrow.
    signals: jsonb("signals").$type<Record<string, unknown>>(),
  },
  (t) => [index("dimension_scores_rep_idx").on(t.repId)],
);

export const callouts = cognifyV2Schema.table(
  "callouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repId: uuid("rep_id")
      .notNull()
      .references(() => reps.id, { onDelete: "cascade" }),
    dimension: dimensionEnum("dimension").notNull(),
    tone: calloutToneEnum("tone").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    quote: text("quote"),
    suggestedRewrite: text("suggested_rewrite"),
    // Nullable to match the Callout domain type: LLMs occasionally
    // omit transcript anchors when they can't ground the callout to
    // a specific moment. Eliminated the dominant validation_failed
    // mock-fallback path (2026-05-21).
    transcriptStartMs: integer("transcript_start_ms"),
    transcriptEndMs: integer("transcript_end_ms"),
  },
  (t) => [index("callouts_rep_idx").on(t.repId)],
);

export const progressSnapshots = cognifyV2Schema.table(
  "progress_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
    dimension: dimensionEnum("dimension").notNull(),
    score: real("score").notNull(),
  },
  (t) => [index("progress_user_dim_idx").on(t.userId, t.dimension, t.takenAt)],
);

export const externalValidations = cognifyV2Schema.table(
  "external_validations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    topic: text("topic").notNull(),
    // Migrated to native uuid[] in migration 0026 (was jsonb).
    repIds: uuid("rep_ids").array().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    isClosed: boolean("is_closed").notNull().default(false),
  },
  (t) => [index("external_validations_user_idx").on(t.userId)],
);

export const friendships = cognifyV2Schema.table(
  "friendships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Requester is the user who sent the friend request; recipient accepted.
    // After acceptance the pair is considered friends in both directions — we
    // only store one row per pair, with the side-agnostic query doing the
    // "either column is me" lookup.
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // pending | accepted | declined
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    index("friendships_requester_idx").on(t.requesterId),
    index("friendships_recipient_idx").on(t.recipientId),
  ],
);

/**
 * Pending crew invitations to people who are not yet Cognify users. Created
 * when a user enters an email in /friends that doesn't resolve to an
 * existing user. On signup, resolveSupabaseUser scans this table by
 * lowercased email and converts each pending row into a friendships row
 * (status='pending') with the new user as recipient.
 *
 * Status: pending → accepted (recipient signed up + friendship created) |
 * cancelled (inviter cancelled before signup).
 */
export const crewInvites = cognifyV2Schema.table(
  "crew_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // DB-side citext (migration 0027) — case-insensitive lookups.
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedUserId: uuid("accepted_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("crew_invites_email_idx").on(t.email),
    index("crew_invites_inviter_idx").on(t.inviterId),
  ],
);

export const friendChallenges = cognifyV2Schema.table(
  "friend_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    challengerId: uuid("challenger_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    opponentId: uuid("opponent_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    status: text("status").notNull().default("pending"), // pending | active | completed
    challengerRepId: uuid("challenger_rep_id").references(() => reps.id, {
      onDelete: "set null",
    }),
    opponentRepId: uuid("opponent_rep_id").references(() => reps.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("challenges_challenger_idx").on(t.challengerId),
    index("challenges_opponent_idx").on(t.opponentId),
  ],
);

export const feedbackRatings = cognifyV2Schema.table(
  "feedback_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    repId: uuid("rep_id")
      .notNull()
      .references(() => reps.id, { onDelete: "cascade" }),
    // nailed_it | kinda_off | wrong
    rating: text("rating").notNull(),
    // Free-text optional note. Kept short (enforced at the action layer).
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("feedback_ratings_user_idx").on(t.userId),
    index("feedback_ratings_rep_idx").on(t.repId),
  ],
);

export const calloutCorrections = cognifyV2Schema.table(
  "callout_corrections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    calloutId: uuid("callout_id")
      .notNull()
      .references(() => callouts.id, { onDelete: "cascade" }),
    // wrong | not_relevant | agree
    verdict: text("verdict").notNull(),
    // Optional user-provided edits when the callout was close-but-wrong.
    correctedQuote: text("corrected_quote"),
    correctedRewrite: text("corrected_rewrite"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("callout_corrections_user_idx").on(t.userId),
    index("callout_corrections_callout_idx").on(t.calloutId),
  ],
);

export const activityEvents = cognifyV2Schema.table(
  "activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Union of event shapes. Kept as text (not enum) so new event types
    // don't require a migration.
    type: text("type").notNull(),
    // Event-shaped discriminated union — see ActivityPayload in
    // src/types/db-payloads.ts.
    payload: jsonb("payload").$type<ActivityPayload>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("activity_user_idx").on(t.userId),
    index("activity_created_idx").on(t.createdAt),
  ],
);

export const externalRankings = cognifyV2Schema.table(
  "external_rankings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    validationId: uuid("validation_id")
      .notNull()
      .references(() => externalValidations.id, { onDelete: "cascade" }),
    // Migrated to native text[] in migration 0026 (was jsonb). Stores
    // rep UUIDs but kept text[] to allow future shape evolution.
    ranking: text("ranking").array().notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rankings_validation_idx").on(t.validationId)],
);

/**
 * WS-7 weekly narratives. One row per user per ISO-week-start. Cache
 * for the Claude-generated coaching paragraph on /progress.
 * generatedAt drives the 24h refresh window in the API route.
 */
export const weeklyReports = cognifyV2Schema.table(
  "weekly_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStartIso: text("week_start_iso").notNull(),
    narrative: jsonb("narrative")
      .$type<{ paragraph: string; hookStat: string; nextFocus: string }>()
      .notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("weekly_reports_user_week_idx").on(t.userId, t.weekStartIso),
  ],
);

/**
 * WS-7 personal bests. Row inserted every time the user sets a new
 * all-time high on a dimension. Server-backed so PB detection works
 * cross-device. Current PB per (userId, dimension) is the row with
 * the highest score (or the latest row if ties).
 */
export const personalBests = cognifyV2Schema.table(
  "personal_bests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dimension: dimensionEnum("dimension").notNull(),
    score: real("score").notNull(),
    repId: uuid("rep_id")
      .notNull()
      .references((): AnyPgColumn => reps.id, { onDelete: "cascade" }),
    achievedAt: timestamp("achieved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("personal_bests_user_dim_idx").on(t.userId, t.dimension),
  ],
);

// User-submitted bug reports. Operators (users.is_operator) triage via
// /admin/bugs. Image URLs are Supabase Storage paths (bug-screenshots
// bucket); resolved to signed URLs on read.
export const bugReports = cognifyV2Schema.table(
  "bug_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull(),
    // Migrated to native text[] in migration 0026 (was jsonb).
    imagePaths: text("image_paths").array().notNull().default([]),
    userAgent: text("user_agent"),
    route: text("route"),
    status: bugStatusEnum("status").notNull().default("open"),
    resolutionNote: text("resolution_note"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("bug_reports_status_created_idx").on(t.status, t.createdAt),
    index("bug_reports_user_idx").on(t.userId),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  sessions: many(practiceSessions),
  reps: many(reps),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  memberships: many(memberships),
}));

export const practiceSessionsRelations = relations(practiceSessions, ({ many, one }) => ({
  reps: many(reps),
  user: one(users, {
    fields: [practiceSessions.userId],
    references: [users.id],
  }),
}));

export const repsRelations = relations(reps, ({ many, one }) => ({
  session: one(practiceSessions, {
    fields: [reps.sessionId],
    references: [practiceSessions.id],
  }),
  dimensionScores: many(dimensionScores),
  callouts: many(callouts),
  exercise: one(exercises, {
    fields: [reps.exerciseId],
    references: [exercises.id],
  }),
  muscleGroupDay: one(muscleGroupDays, {
    fields: [reps.muscleGroupDayId],
    references: [muscleGroupDays.id],
  }),
}));

/**
 * Phase 7 — weekly drift report. One row per (week_start, dimension,
 * sub_skill, verdict). The cron writes a fresh batch every week from
 * the callout_corrections data; rows persist so the ops UI can show
 * trends across weeks.
 *
 * Rates are computed at write time so the ops UI doesn't need to
 * re-aggregate on each page load.
 */
export const calloutDriftReports = cognifyV2Schema.table(
  "callout_drift_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weekStart: date("week_start").notNull(),
    dimension: dimensionEnum("dimension").notNull(),
    /** Sub-skill within the dim. NULL when corrections didn't carry a
     *  sub-skill (legacy bullets). */
    subSkill: text("sub_skill"),
    /** wrong | not_relevant | agree — same enum as callout_corrections. */
    verdict: text("verdict").notNull(),
    count: integer("count").notNull(),
    /** Total corrections for this (week, dim, sub_skill) across all
     *  verdicts — denominator for wrong_rate. */
    totalForGroup: integer("total_for_group").notNull(),
    wrongRate: real("wrong_rate").notNull(),
    /** Flagged when wrongRate >= 0.25 AND totalForGroup >= 4 (signal
     *  threshold — 1 of 4 wrong isn't enough to act on). */
    flagged: boolean("flagged").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("callout_drift_week_dim_idx").on(t.weekStart, t.dimension),
    index("callout_drift_flagged_idx").on(t.flagged, t.weekStart),
  ],
);

/**
 * Phase 6 — reference reps for few-shot exemplar retrieval.
 *
 * One row per calibrated rep: known-good transcript + scores + (optionally)
 * canonical feedback. At scoring time, retrieveSimilarReps embeds the
 * NEW rep's transcript, finds the top-K nearest reference reps via
 * pgvector cosine similarity, and injects them into Stage 2's prompt
 * as XML-tagged exemplars.
 *
 * Seed sources:
 *   1. scripts/calibration/reference-reps.json — 48 hand-calibrated reps
 *      with known composite + per-dim scores. These are the primary
 *      seed (operator-curated ground truth).
 *   2. score_corrections promotions — future: when operators confirm
 *      a real rep is accurate, the promotion script copies it here.
 *
 * Not a foreign key to reps.id because reference reps live across
 * users / sessions and we don't want a real rep's deletion to
 * invalidate the reference bank.
 */
export const referenceReps = cognifyV2Schema.table(
  "reference_reps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Optional FK to the originating rep when promoted from a real
     *  production rep. NULL for hand-crafted seed entries from
     *  reference-reps.json. */
    sourceRepId: uuid("source_rep_id").references((): AnyPgColumn => reps.id, {
      onDelete: "set null",
    }),
    /** Stable identifier from the seed file (e.g. "band-strong-clean-pitch")
     *  OR autogenerated UUID slug for promoted reps. Used for upsert
     *  idempotency. */
    refId: text("ref_id").notNull().unique(),
    transcript: text("transcript").notNull(),
    durationMs: integer("duration_ms").notNull(),
    promptText: text("prompt_text").notNull(),
    /** { composite, dimensions: { clarity, structure, ... }, band?, kind? }
     *  — flexible JSONB so seed assertions + promoted reps coexist. */
    knownScores: jsonb("known_scores").notNull(),
    /** Optional canonical feedback: { headline, callouts, didWell, ... }
     *  When present, exemplar render includes a snippet so the model
     *  sees what gold-standard copy looks like. */
    knownFeedback: jsonb("known_feedback"),
    /** Tags for filtering: { kind, domain, framework_id?, archetype?,
     *  band, dim_profile } */
    tags: jsonb("tags").notNull().default({}),
    /** 1536-dim embedding from text-embedding-3-small over the
     *  transcript text. Length-normalized → dot = cosine. */
    // Drizzle doesn't have first-class vector support in pg-core; we
    // store the raw SQL type via a custom column and use raw SQL in
    // retrieve. Use `text` here purely as a placeholder for drizzle's
    // type system — the underlying column IS vector(1536) per the
    // migration.
    promotedAt: timestamp("promoted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    promotedBy: uuid("promoted_by"),
    notes: text("notes"),
  },
  (t) => [
    index("reference_reps_ref_idx").on(t.refId),
    // Reverse lookup: "which ref-rep was promoted from this rep?" Added
    // in 0026 alongside the source_rep_id FK.
    index("reference_reps_source_rep_idx").on(t.sourceRepId),
  ],
);

/**
 * Phase 0 — scoring pipeline telemetry. One row per scoring request, written
 * by /api/score and /api/score-internal regardless of outcome. Drives the
 * /api/score/health/stats dashboard and lets us prove (or disprove) that
 * latency/fallback changes actually moved the needle.
 *
 * failureReason classification:
 *   none                      — happy path, anthropic answered cleanly
 *   timeout                   — anthropic exceeded SCORING_ANTHROPIC_TIMEOUT_MS
 *   rate_limit_429            — anthropic returned 429
 *   validation_failed         — anthropic returned, Zod parse rejected
 *   truncated                 — output hit max_tokens mid-JSON
 *   openai_fallback_used      — anthropic failed, openai answered
 *   mock_fallback_both_failed — anthropic AND openai (or no openai key) failed
 *   network_error             — couldn't reach anthropic at all
 *   unknown                   — caught error didn't match any category
 *
 * Append-only; we never UPDATE these rows. Old rows can be pruned by a
 * weekly cron once retention exceeds 90d if needed.
 */
export const scoringTelemetry = cognifyV2Schema.table(
  "scoring_telemetry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable — /api/score (sync user-facing path) doesn't know repId at
    // scoring time; only /api/score-internal does. ON DELETE SET NULL so
    // analytics history survives a user purge.
    repId: uuid("rep_id").references((): AnyPgColumn => reps.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Which endpoint wrote this row.
    source: text("source").notNull(), // 'api_score' | 'api_score_internal'
    // Final model that actually returned content. On fallback this is
    // 'openai-fallback:<model>'. On full failure this is 'mock-fallback-v1'.
    modelUsed: text("model_used").notNull(),
    // Prompt-size budget telemetry — the lever we're optimizing.
    promptSizeBytes: integer("prompt_size_bytes"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cacheReadTokens: integer("cache_read_tokens"),
    cacheCreationTokens: integer("cache_creation_tokens"),
    // Timing breakdown — what's actually expensive.
    modelDurationMs: integer("model_duration_ms"),
    validationDurationMs: integer("validation_duration_ms"),
    totalServerDurationMs: integer("total_server_duration_ms"),
    // Future phases populate these (kept nullable so the schema is stable):
    //   Phase 4: ragDurationMs (knowledge retrieval timing)
    //   Phase 5: stage1DurationMs / stage2DurationMs (two-stage scoring)
    ragDurationMs: integer("rag_duration_ms"),
    failureReason: text("failure_reason").notNull(), // see classification above
    // Server-only error detail for debugging. Never user-facing. Trimmed
    // to 500 chars at write time so a verbose Anthropic error doesn't bloat
    // the table.
    errorDetail: text("error_detail"),
    compositeScore: integer("composite_score"),
    // Phase 8 — muscle-group context. Nullable so legacy Skill Lab + scenario
    // telemetry rows continue to write unchanged. When set, ops dashboards
    // can slice scoring drift per exercise / per muscle-group day.
    exerciseId: uuid("exercise_id"),
    muscleGroupDayId: uuid("muscle_group_day_id"),
    isGraduationRep: boolean("is_graduation_rep").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("scoring_telemetry_created_idx").on(t.createdAt),
    index("scoring_telemetry_failure_idx").on(t.failureReason, t.createdAt),
    index("scoring_telemetry_model_idx").on(t.modelUsed),
    index("scoring_telemetry_exercise_idx").on(t.exerciseId, t.createdAt),
    index("scoring_telemetry_mgd_idx").on(t.muscleGroupDayId, t.createdAt),
    // Per-rep drilldown — added in 0026 as a partial index since rep_id
    // is often NULL on the sync /api/score path.
    index("scoring_telemetry_rep_idx").on(t.repId),
  ],
);

/**
 * DNA Ch.C2 — operator review verdicts on flagged reps.
 *
 * One row per operator review of a rep that flagged for human review
 * (today: composite >= 95). The /ops/review-queue page filters reps
 * by composite score and EXCLUDES rows that already exist here, so
 * submitting a verdict removes the rep from the queue. Operator
 * corrections feed Ch.C3's reference-bank promotion script.
 */
export const scoreCorrections = cognifyV2Schema.table(
  "score_corrections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repId: uuid("rep_id")
      .notNull()
      .references(() => reps.id, { onDelete: "cascade" }),
    reviewerUserId: uuid("reviewer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** confirmed_accurate | should_be_lower | should_be_higher | skipped */
    verdict: text("verdict").notNull(),
    correctedComposite: integer("corrected_composite"),
    correctedPerDim: jsonb("corrected_per_dim").$type<Record<string, number>>(),
    notes: text("notes"),
  },
  (t) => [
    index("score_corrections_rep_idx").on(t.repId),
    index("score_corrections_reviewed_at_idx").on(t.reviewedAt),
  ],
);

/**
 * Migration 0020 — muscle-group adventure-path pivot.
 *
 * Five tables backing the daily-muscle-group product:
 *   - exercises             named drills per dimension (catalog)
 *   - exercisePrompts       prompt bank per exercise (~20 prompts)
 *   - muscleGroupDays       one row per (user, calendar day)
 *   - workoutSessions       live runtime traversal of a muscle-group day
 *   - exerciseEngagement    (exercise, user) aggregates feeding rotation
 *
 * Phase 1 is migration-only; no app code reads these yet. See
 * plans/muscle-group-pivot-progress.md for the full plan.
 *
 * Forward-thunk FKs (`.references(() => exercises.id, …)`) are used so
 * the new tables can be declared after `reps` without a file reshuffle —
 * same pattern already used for `reps.frameworkId → frameworks`. The
 * `muscleGroupDays.previousDayId` self-ref uses the `AnyPgColumn` cast
 * to break Drizzle's circular type inference.
 */
export const exercises = cognifyV2Schema.table(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    dimension: dimensionEnum("dimension").notNull(),
    description: text("description").notNull(),
    instructions: text("instructions"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    // PRD v3 Phase 2.2 (migration 0029) — Exercise Framework fields
    // (PRD §9.2). All nullable so pre-enrichment rows stay valid; the
    // engine falls back to rule/why when a field is absent.
    /** The single communication objective this framework trains. */
    objective: text("objective"),
    /** Hidden Skill ids (src/types/sub-skills.ts) this exercise targets.
     *  Drives Hidden-Skill-aware selection (Phase 2.3). */
    hiddenSkills: jsonb("hidden_skills").$type<string[]>(),
    /** What the evaluator should key on — absorbed from the code-side
     *  EXERCISE_RUBRIC_HINTS so the lens lives with the framework. */
    scoringLens: text("scoring_lens"),
    /** What the required Retry should target when the rule was broken. */
    retryObjective: text("retry_objective"),
    /** Rules for AI prompt generation from this framework (Phase 8). */
    promptRules: text("prompt_rules"),
    /** ADR-001 response window in seconds, e.g. {"minSec":60,"maxSec":90}. */
    responseWindow: jsonb("response_window").$type<{
      minSec: number;
      maxSec: number;
    }>(),
    /** ADR-001 constraint types this framework may apply
     *  (time | structure | tone | complexity | none). */
    constraintTypes: jsonb("constraint_types").$type<string[]>(),
    // PRD v3 Phase 4 (migration 0031) — Skill Lab applications. NULL for
    // Daily Workout core-skill exercises; set to an ApplicationId
    // (src/types/application-skills.ts) for application exercises, whose
    // `dimension` column holds the PRIMARY Core Skill. Daily-workout
    // catalog queries filter `application IS NULL`.
    application: text("application"),
    /** Hidden Application Skill ids this exercise targets (per-app
     *  taxonomy in APPLICATION_SKILLS). NULL for core-skill exercises. */
    applicationSkills: jsonb("application_skills").$type<string[]>(),
    // Phase 11.D2/D3 (migration 0035) — Lab Engine V1 pack fields. All
    // nullable; the engine falls back to rule/why + the generic lens.
    /** Exercise-specific Coach's Insight for the pre-rep Insight screen. */
    coachInsight: text("coach_insight"),
    /** Core Skill dimensions trained beyond the primary `dimension`. */
    secondaryCoreSkills: jsonb("secondary_core_skills").$type<string[]>(),
    /** Typical failure patterns — injected into the scoring context so
     *  feedback names the failure it actually saw. */
    commonFailureModes: jsonb("common_failure_modes").$type<string[]>(),
    /** One-line evaluator emphasis for this exercise. */
    scoringEmphasis: text("scoring_emphasis"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("exercises_dim_active_idx").on(t.dimension, t.isActive),
    index("exercises_application_idx").on(t.application, t.isActive),
  ],
);

export const exercisePrompts = cognifyV2Schema.table(
  "exercise_prompts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    promptText: text("prompt_text").notNull(),
    promptId: text("prompt_id").notNull().unique(),
    difficulty: integer("difficulty").notNull().default(2),
    tags: jsonb("tags").notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("exercise_prompts_exercise_active_idx").on(t.exerciseId, t.isActive),
    // Composite index added in 0026 — ops scans filter on dim/active/difficulty.
    index("exercise_prompts_dim_active_diff_idx").on(
      t.exerciseId,
      t.isActive,
      t.difficulty,
    ),
  ],
);

export const muscleGroupDays = cognifyV2Schema.table(
  "muscle_group_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dayDate: date("day_date").notNull(),
    dimension: dimensionEnum("dimension").notNull(),
    // Migrated to native uuid[] in migration 0026 (was jsonb).
    plannedExerciseIds: uuid("planned_exercise_ids").array().notNull(),
    completedReps: integer("completed_reps").notNull().default(0),
    /** planned | in_progress | complete | abandoned | frozen_skip */
    status: text("status").notNull().default("planned"),
    compositeAtClose: real("composite_at_close"),
    previousDayId: uuid("previous_day_id").references(
      (): AnyPgColumn => muscleGroupDays.id,
      { onDelete: "set null" },
    ),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Phase 10 — lifecycle close-out columns.
    graduatedAt: timestamp("graduated_at", { withTimezone: true }),
    closedOutAt: timestamp("closed_out_at", { withTimezone: true }),
    /** When the day was closed as frozen_skip, the freeze-grant date. */
    freezeAppliedDate: date("freeze_applied_date"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Matches migration 0020 which created this as UNIQUE. The uniqueness is
    // load-bearing: it's what prevents the read-then-insert race in
    // startMuscleGroupDay (workout-day.ts) from double-creating a day row.
    uniqueIndex("mgd_user_date_uniq_idx").on(t.userId, t.dayDate),
    index("mgd_user_dim_date_idx").on(t.userId, t.dimension, t.dayDate),
  ],
);

/**
 * Phase 10 — user-facing notifications surfaced by the missed-day
 * modal, the freeze-consumed toast, etc. Generic shape so future
 * push-notification work doesn't need a new table.
 */
export const userNotifications = cognifyV2Schema.table(
  "user_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** freeze_consumed | day_missed | day_complete | day_partial */
    kind: text("kind").notNull(),
    // Per-kind payload — DayLifecyclePayload + open index sig for future
    // fields. See NotificationPayload in src/types/db-payloads.ts.
    payload: jsonb("payload").$type<NotificationPayload>().notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("user_notifications_user_idx").on(
      t.userId,
      t.readAt,
      t.createdAt,
    ),
  ],
);

export const workoutSessions = cognifyV2Schema.table(
  "workout_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    muscleGroupDayId: uuid("muscle_group_day_id")
      .notNull()
      .references(() => muscleGroupDays.id, { onDelete: "cascade" }),
    practiceSessionId: uuid("practice_session_id")
      .notNull()
      .references(() => practiceSessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currentStationIndex: integer("current_station_index").notNull().default(0),
    state: text("state").notNull().default("idle"),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    resumedAt: timestamp("resumed_at", { withTimezone: true }),
    graduationRepId: uuid("graduation_rep_id").references(() => reps.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("workout_sessions_mgd_idx").on(t.muscleGroupDayId),
    index("workout_sessions_user_idx").on(t.userId),
  ],
);

export const exerciseEngagement = cognifyV2Schema.table(
  "exercise_engagement",
  {
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    shownCount: integer("shown_count").notNull().default(0),
    completedCount: integer("completed_count").notNull().default(0),
    avgComposite: real("avg_composite"),
    recentComposite: real("recent_composite"),
    lastTrainedAt: timestamp("last_trained_at", { withTimezone: true }),
    lastEventAt: timestamp("last_event_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.exerciseId, t.userId] }),
    index("exercise_engagement_user_idx").on(t.userId),
  ],
);

export const exercisesRelations = relations(exercises, ({ many }) => ({
  prompts: many(exercisePrompts),
  reps: many(reps),
  engagement: many(exerciseEngagement),
}));

export const exercisePromptsRelations = relations(
  exercisePrompts,
  ({ one }) => ({
    exercise: one(exercises, {
      fields: [exercisePrompts.exerciseId],
      references: [exercises.id],
    }),
  }),
);

export const muscleGroupDaysRelations = relations(
  muscleGroupDays,
  ({ one, many }) => ({
    user: one(users, {
      fields: [muscleGroupDays.userId],
      references: [users.id],
    }),
    previousDay: one(muscleGroupDays, {
      fields: [muscleGroupDays.previousDayId],
      references: [muscleGroupDays.id],
      relationName: "muscle_group_day_chain",
    }),
    workoutSessions: many(workoutSessions),
    reps: many(reps),
  }),
);

export const workoutSessionsRelations = relations(
  workoutSessions,
  ({ one }) => ({
    muscleGroupDay: one(muscleGroupDays, {
      fields: [workoutSessions.muscleGroupDayId],
      references: [muscleGroupDays.id],
    }),
    practiceSession: one(practiceSessions, {
      fields: [workoutSessions.practiceSessionId],
      references: [practiceSessions.id],
    }),
    user: one(users, {
      fields: [workoutSessions.userId],
      references: [users.id],
    }),
    graduationRep: one(reps, {
      fields: [workoutSessions.graduationRepId],
      references: [reps.id],
    }),
  }),
);

export const exerciseEngagementRelations = relations(
  exerciseEngagement,
  ({ one }) => ({
    exercise: one(exercises, {
      fields: [exerciseEngagement.exerciseId],
      references: [exercises.id],
    }),
    user: one(users, {
      fields: [exerciseEngagement.userId],
      references: [users.id],
    }),
  }),
);

/**
 * Migration 0021 — prompt selection telemetry (Phase 6).
 *
 * One row per "user picked a prompt for a workout rep" event. Powers
 * ops mix-dashboards and the auto_idle > 20% alert.
 *
 * Mode lifecycle:
 *   shuffle    — picked from the 3 Shuffle candidates
 *   list       — picked from the All prompts tab
 *   surprise   — picked from Surprise Me's auto-suggestion
 *   auto_idle  — 15s idle timeout → auto-picked top Shuffle candidate
 */
export const promptSelectionEvents = cognifyV2Schema.table(
  "prompt_selection_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workoutSessionId: uuid("workout_session_id")
      .notNull()
      .references(() => workoutSessions.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    promptId: uuid("prompt_id").references(() => exercisePrompts.id, {
      onDelete: "set null",
    }),
    /** shuffle | list | surprise | auto_idle (CHECK constraint enforces). */
    mode: text("mode").notNull(),
    reshuffles: integer("reshuffles").notNull().default(0),
    msToSelect: integer("ms_to_select").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("prompt_selection_events_user_created_idx").on(
      t.userId,
      t.createdAt,
    ),
    index("prompt_selection_events_exercise_idx").on(
      t.exerciseId,
      t.createdAt,
    ),
    index("prompt_selection_events_mode_idx").on(t.mode, t.createdAt),
  ],
);

export const promptSelectionEventsRelations = relations(
  promptSelectionEvents,
  ({ one }) => ({
    user: one(users, {
      fields: [promptSelectionEvents.userId],
      references: [users.id],
    }),
    workoutSession: one(workoutSessions, {
      fields: [promptSelectionEvents.workoutSessionId],
      references: [workoutSessions.id],
    }),
    exercise: one(exercises, {
      fields: [promptSelectionEvents.exerciseId],
      references: [exercises.id],
    }),
    prompt: one(exercisePrompts, {
      fields: [promptSelectionEvents.promptId],
      references: [exercisePrompts.id],
    }),
  }),
);
