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
  // WS-7 habit system — streak freezes earned + spent. Earned after
  // every completed 7-day streak; consumed when a day is missed. Cap at
  // 3 freezes stored.
  streakFreezes: integer("streak_freezes").notNull().default(0),
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
    // WS-3 pressure rep tagging — replaces the "Pressure · X" topic
    // prefix hack. Nullable for non-pressure reps + historical rows.
    pressureArchetypeId: pressureArchetypeEnum("pressure_archetype_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reps_session_idx").on(t.sessionId),
    index("reps_user_created_idx").on(t.userId, t.createdAt),
    index("reps_status_idx").on(t.status),
    index("reps_pressure_archetype_idx").on(t.pressureArchetypeId),
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
    primaryKey({ columns: [t.userId, t.promptId] }),
    index("user_prompt_history_user_idx").on(t.userId),
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
    narrative: jsonb("narrative").notNull(),
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
    repId: uuid("rep_id").notNull(),
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
    imagePaths: jsonb("image_paths").$type<string[]>().notNull().default([]),
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
}));
