import {
  pgSchema,
  text,
  timestamp,
  integer,
  real,
  jsonb,
  boolean,
  uuid,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// All v2 tables live in the `cognify_v2` Postgres schema so they don't
// collide with Bob's v1 tables in `public` on the same Supabase project.
export const cognifyV2Schema = pgSchema("cognify_v2");

export const modeEnum = cognifyV2Schema.enum("mode", [
  "daily_workout",
  "skill_lab",
  "scenario_training",
  "baseline",
]);

// v2.0.0 rubric (WS-1 apply 2026-04-24). The enum carries BOTH the
// current dimension names AND the legacy names (relevance/confidence/
// pacing/tone) so historical reps with those dimensions remain valid
// reads. New writes only use the v2.0.0 names. See
// docs/proposals/rubric-v2.0.0.md and src/lib/scoring/dimension-aliases.ts.
// Postgres enum values cannot be removed with existing rows referencing
// them — this append-only strategy keeps rep history intact.
export const dimensionEnum = cognifyV2Schema.enum("dimension", [
  // Current (v2.0.0) dimensions
  "clarity",
  "structure",
  "conciseness",
  "thinking_quality",
  "delivery",
  "adaptability",
  "structural_adherence",
  // Legacy (v2-beta.*) dimensions — retained for historical reads only
  "relevance",
  "confidence",
  "pacing",
  "tone",
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

export const users = cognifyV2Schema.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Links our user row to Supabase's auth.users.id. Nullable because guests
  // don't have an auth.users row yet — set at sign-in time. Unique because
  // each Supabase auth user maps to exactly one cognify user (guest promotion
  // flow updates the existing guest row rather than creating a duplicate).
  authUserId: uuid("auth_user_id").unique(),
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
   *  Referenced by dashboard + /progress to show how far they've come. Not a
   *  foreign key (FK would require rep.id to be stable pre-insert) — stored
   *  as uuid and joined on read. */
  baselineRepId: uuid("baseline_rep_id"),
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
    frameworkSnapshot: jsonb("framework_snapshot"),
    durationMs: integer("duration_ms").notNull(),
    audioUrl: text("audio_url"),
    transcript: jsonb("transcript"),
    topic: text("topic"),
    compositeScore: real("composite_score"),
    modelVersion: text("model_version"),
    rubricVersion: text("rubric_version"),
    // pending → processing → completed | failed. Default "completed" preserves
    // backward compatibility while the sync scoring path still exists. When
    // Phase 4 (async Edge Function scoring) lands, new reps insert as "pending".
    status: text("status").notNull().default("completed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reps_session_idx").on(t.sessionId),
    index("reps_user_created_idx").on(t.userId, t.createdAt),
    index("reps_status_idx").on(t.status),
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
    signals: jsonb("signals"),
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
    transcriptStartMs: integer("transcript_start_ms").notNull(),
    transcriptEndMs: integer("transcript_end_ms").notNull(),
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
    repIds: jsonb("rep_ids").notNull(),
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
    // Event-shaped payload. For workout_complete: { composite, repsCount,
    // topDimension, score }. For streak_milestone: { days }. For new_high:
    // { dimension, score }. For challenge_win: { opponentName, score }.
    payload: jsonb("payload").notNull(),
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
    ranking: jsonb("ranking").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rankings_validation_idx").on(t.validationId)],
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
}));
