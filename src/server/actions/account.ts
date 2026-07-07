"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  users,
  reps,
  dimensionScores,
  callouts as calloutsTable,
  practiceSessions,
  progressSnapshots,
  activityEvents,
  scenarios,
  externalValidations,
} from "@/lib/db/schema";
import { currentUser } from "@/lib/session/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { safeDb } from "@/lib/db/safe";

export type AccountActionResult = {
  ok: boolean;
  message: string;
};

/**
 * Trigger a Supabase Auth password-reset email. Only works for
 * authenticated users with an email on file (not guests). Returns a
 * non-revealing message so we don't leak account existence.
 */
/**
 * Request an email change via Supabase Auth. Supabase sends a confirmation
 * link to both the OLD and NEW address by default (double-confirm). The
 * actual email swap happens only after both links are clicked.
 *
 * We don't update our cognify_v2.users.email row here — the auth callback
 * at /auth/callback picks up the new auth.users.email on next currentUser()
 * resolve and reconciles via the existing auth_user_id linkage.
 */
export async function changeEmail(
  newEmail: string,
): Promise<AccountActionResult> {
  const user = await currentUser();
  if (!user || user.kind !== "authenticated") {
    return {
      ok: false,
      message: "Email changes only work for signed-in accounts.",
    };
  }
  const trimmed = newEmail.trim().toLowerCase();
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, message: "That doesn't look like a valid email." };
  }
  if (user.email?.toLowerCase() === trimmed) {
    return { ok: false, message: "That's already your email." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ email: trimmed });
  if (error) {
    return { ok: false, message: `Couldn't change email: ${error.message}` };
  }
  return {
    ok: true,
    message: `Check ${trimmed} and ${user.email} for confirmation links. Email change takes effect once both are clicked.`,
  };
}

export async function sendPasswordResetEmail(): Promise<AccountActionResult> {
  const user = await currentUser();
  if (!user || user.kind !== "authenticated" || !user.email) {
    return {
      ok: false,
      message:
        "Password reset only works for signed-in accounts with an email.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://cognifygym.com"}/auth/callback?next=/settings`;
  const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo,
  });
  if (error) {
    return { ok: false, message: `Couldn't send reset email: ${error.message}` };
  }
  return {
    ok: true,
    message: `Sent a reset link to ${user.email}. Check your inbox.`,
  };
}

/**
 * Build a JSON export of everything the user has created: profile,
 * reps, scores, callouts, scenarios, validations. Returned as a
 * serialized string the client can download as a blob.
 */
type ExportResult =
  | { ok: true; data: string; filename: string }
  | { ok: false; message: string };

export async function exportUserData(): Promise<ExportResult> {
  const user = await currentUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const fallback: ExportResult = {
    ok: false,
    message: "Database unavailable.",
  };

  return safeDb<ExportResult>(async () => {
    const [profile] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    const userReps = await db
      .select()
      .from(reps)
      .where(eq(reps.userId, user.id));
    const repIds = userReps.map((r) => r.id);

    const [userSessions, userCallouts, userProgressSnapshots] = await Promise.all([
      db
        .select()
        .from(practiceSessions)
        .where(eq(practiceSessions.userId, user.id)),
      Promise.all(
        repIds.map((id) =>
          db.select().from(calloutsTable).where(eq(calloutsTable.repId, id)),
        ),
      ).then((arr) => arr.flat()),
      db
        .select()
        .from(progressSnapshots)
        .where(eq(progressSnapshots.userId, user.id)),
    ]);

    const allDimensionScores = await Promise.all(
      repIds.map((id) =>
        db.select().from(dimensionScores).where(eq(dimensionScores.repId, id)),
      ),
    ).then((arr) => arr.flat());

    const [userScenarios, userValidations, userActivity] = await Promise.all([
      db.select().from(scenarios).where(eq(scenarios.userId, user.id)),
      db
        .select()
        .from(externalValidations)
        .where(eq(externalValidations.userId, user.id)),
      db
        .select()
        .from(activityEvents)
        .where(eq(activityEvents.userId, user.id)),
    ]);

    const exportedAt = new Date().toISOString();
    const payload = {
      exportedAt,
      note: "This is a personal data export from Cognify. Your reps, scores, and feedback history.",
      profile: {
        id: profile?.id,
        email: profile?.email,
        name: profile?.name,
        vertical: profile?.vertical,
        personas: profile?.personas,
        improvementGoals: profile?.improvementGoals,
        onboardedAt: profile?.onboardedAt,
        createdAt: profile?.createdAt,
      },
      counts: {
        reps: userReps.length,
        sessions: userSessions.length,
        dimensionScores: allDimensionScores.length,
        callouts: userCallouts.length,
        scenarios: userScenarios.length,
        validations: userValidations.length,
        progressSnapshots: userProgressSnapshots.length,
        activityEvents: userActivity.length,
      },
      reps: userReps,
      sessions: userSessions,
      dimensionScores: allDimensionScores,
      callouts: userCallouts,
      progressSnapshots: userProgressSnapshots,
      scenarios: userScenarios,
      validations: userValidations,
      activityEvents: userActivity,
    };

    const date = exportedAt.slice(0, 10);
    return {
      ok: true as const,
      data: JSON.stringify(payload, null, 2),
      filename: `cognify-export-${date}.json`,
    };
  }, fallback);
}

/**
 * Delete the user's account. Requires the user to type their email as
 * confirmation so we don't delete on a stray click. Cascade-delete on our
 * schema's FKs handles the practice data; we also remove the auth.users
 * row so sign-in no longer works.
 */
export async function deleteAccount(
  confirmationEmail: string,
): Promise<AccountActionResult> {
  const user = await currentUser();
  if (!user || user.kind !== "authenticated" || !user.email) {
    return {
      ok: false,
      message: "Can't delete — sign in first.",
    };
  }

  if (
    confirmationEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()
  ) {
    return {
      ok: false,
      message: "Email didn't match. Type your exact email to confirm.",
    };
  }

  const fallback: AccountActionResult = {
    ok: false,
    message: "Delete failed — try again or contact support.",
  };

  return safeDb<AccountActionResult>(async () => {
    // Phase 16 pre-prod fix: capture the auth-user id BEFORE deleting the
    // row. The old lookup paged listUsers() (first 50 only) and matched
    // by email — past ~50 signups the auth record survived deletion and
    // the "deleted" email could still sign back in.
    const [row] = await db
      .select({ authUserId: users.authUserId })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    // Remove our user row — cascade removes reps, sessions, scores, etc.
    // per the ON DELETE CASCADE FKs in schema.ts.
    await db.delete(users).where(eq(users.id, user.id));

    // Remove the Supabase auth user so the email can't sign in again.
    const admin = supabaseAdmin();
    if (row?.authUserId) {
      await admin.auth.admin.deleteUser(row.authUserId);
    } else {
      // Legacy rows without auth_user_id: best-effort email match, but
      // page through ALL users instead of trusting page one.
      let page = 1;
      for (;;) {
        const { data } = await admin.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        const authUser = data.users.find(
          (u) => u.email?.toLowerCase() === user.email!.toLowerCase(),
        );
        if (authUser) {
          await admin.auth.admin.deleteUser(authUser.id);
          break;
        }
        if (data.users.length < 200) break;
        page += 1;
      }
    }

    // Sign out the current session
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();

    return { ok: true, message: "Account deleted." };
  }, fallback);
}
