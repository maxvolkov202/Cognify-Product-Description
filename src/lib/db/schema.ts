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
  primaryKey,
  type AnyPgColumn,
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reps_session_idx").on(t.sessionId),
    index("reps_user_created_idx").on(t.userId, t.createdAt),
    index("reps_status_idx").on(t.status),
    index("reps_pressure_archetype_idx").on(t.pressureArchetypeId),
    index("reps_exercise_idx").on(t.exerciseId),
    index("reps_mgd_idx").on(t.muscleGroupDayId),
  ],
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
    userId: uuid("user_id").notNull(),
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
    expectedPerDim: jsonb("expected_per_dim"),
    actualPerDim: jsonb("actual_per_dim"),
    deltaPerDim: jsonb("delta_per_dim"),
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
    userId: uuid("user_id").notNull(),
    questDate: date("quest_date").notNull(),
    quests: jsonb("quests").notNull(),
    completion: jsonb("completion").notNull().default({}),
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
    /** Optional FK-like reference to the originating rep when promoted
     *  from a real production rep. NULL for hand-crafted seed entries
     *  from reference-reps.json. */
    sourceRepId: uuid("source_rep_id"),
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
  (t) => [index("reference_reps_ref_idx").on(t.refId)],
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
    // scoring time; only /api/score-internal does.
    repId: uuid("rep_id"),
    userId: uuid("user_id"),
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
    correctedPerDim: jsonb("corrected_per_dim"),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("exercises_dim_active_idx").on(t.dimension, t.isActive)],
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
    plannedExerciseIds: jsonb("planned_exercise_ids").notNull(),
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("mgd_user_date_uniq_idx").on(t.userId, t.dayDate),
    index("mgd_user_dim_date_idx").on(t.userId, t.dimension, t.dayDate),
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
