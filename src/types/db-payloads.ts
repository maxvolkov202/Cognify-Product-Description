/**
 * Shared JSONB payload shapes — referenced by schema.ts `.$type<>()`
 * annotations AND by the query/action layers that read them. Lives
 * outside src/lib/db so schema.ts can import without circling.
 */

import type { SkillDimension } from "./domain";

// ─── activity_events.payload ──────────────────────────────────────────

export type ActivityEventType =
  | "workout_complete"
  | "new_high"
  | "streak_milestone"
  | "challenge_win"
  | "friend_joined";

export type ActivityPayload =
  | {
      type: "workout_complete";
      composite: number;
      repsCount: number;
      topDimension: SkillDimension | null;
    }
  | { type: "new_high"; dimension: SkillDimension; score: number }
  | { type: "streak_milestone"; days: number }
  | { type: "challenge_win"; opponentName: string; score: number }
  | { type: "friend_joined"; name: string };

// ─── user_notifications.payload ───────────────────────────────────────
// Discriminated by the sibling `kind` column. Index signature kept so
// future fields (added by a UI/server pair) don't require a migration
// to the column type.

export type DayLifecycleKind =
  | "day_missed"
  | "freeze_consumed"
  | "day_partial"
  | "day_complete";

export type DayLifecyclePayload = {
  dimension?: SkillDimension | string;
  completedReps?: number;
  status?: string;
  preservesStreak?: boolean;
};

export type NotificationPayload = DayLifecyclePayload &
  Record<string, unknown>;
