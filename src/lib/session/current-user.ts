import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { crewInvites, friendships, users } from "@/lib/db/schema";
import { hasDatabase, safeDb } from "@/lib/db/safe";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/admin";

export const GUEST_COOKIE = "cognify_guest_id";

export type ResolvedUser = {
  id: string;
  kind: "authenticated" | "guest";
  name: string | null;
  email: string | null;
  image: string | null;
};

export async function currentUser(): Promise<ResolvedUser | null> {
  // 1. Try Supabase Auth first (primary auth going forward)
  if (hasSupabase()) {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (authUser && hasDatabase()) {
        const resolved = await resolveSupabaseUser(authUser);
        if (resolved) return resolved;
      }
    } catch {
      // Supabase unavailable — fall through
    }
  }

  // 2. Guest cookie fallback
  const store = await cookies();
  const existing = store.get(GUEST_COOKIE)?.value;
  if (!existing) return null;

  await ensureGuestUser(existing);

  return {
    id: existing,
    kind: "guest",
    name: "Guest",
    email: null,
    image: null,
  };
}

/**
 * Reconcile a Supabase-authenticated user with our `users` table. Handles
 * three cases:
 * 1. Already linked (auth_user_id matches) — just return the row.
 * 2. Guest promotion — cookie points to a guest row; link it and clear
 *    isGuest, preserving all history (reps, progress, scores, etc.).
 * 3. Fresh sign-in (no guest cookie, no email match) — create a new row.
 *
 * Also handles email match: if a row already exists with the same email
 * but no auth_user_id yet, link them together.
 */
async function resolveSupabaseUser(authUser: {
  id: string;
  email?: string | null;
  user_metadata?: { name?: string; full_name?: string; avatar_url?: string; picture?: string };
}): Promise<ResolvedUser | null> {
  try {
    // 1. Already linked?
    const linked = await db.query.users.findFirst({
      where: eq(users.authUserId, authUser.id),
    });
    if (linked) {
      return {
        id: linked.id,
        kind: "authenticated",
        name: linked.name,
        email: linked.email,
        image: linked.image,
      };
    }

    const name =
      authUser.user_metadata?.full_name ??
      authUser.user_metadata?.name ??
      null;
    const image =
      authUser.user_metadata?.avatar_url ??
      authUser.user_metadata?.picture ??
      null;
    const email = authUser.email ?? null;

    // 2. Guest promotion path
    const store = await cookies();
    const guestId = store.get(GUEST_COOKIE)?.value;
    if (guestId) {
      const guest = await db.query.users.findFirst({
        where: eq(users.id, guestId),
      });
      if (guest?.isGuest) {
        const [promoted] = await db
          .update(users)
          .set({
            authUserId: authUser.id,
            email,
            name: name ?? guest.name,
            image: image ?? guest.image,
            isGuest: false,
            emailVerified: new Date(),
          })
          .where(eq(users.id, guestId))
          .returning({ id: users.id });
        store.delete(GUEST_COOKIE);
        if (promoted) {
          if (email) await convertPendingCrewInvites(guestId, email);
          return {
            id: guestId,
            kind: "authenticated",
            name: name ?? guest.name,
            email,
            image: image ?? guest.image,
          };
        }
      }
    }

    // 3. Email match (e.g., NextAuth-era user signing in with Supabase now)
    if (email) {
      const byEmail = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
      if (byEmail) {
        await db
          .update(users)
          .set({ authUserId: authUser.id, name: name ?? byEmail.name, image: image ?? byEmail.image })
          .where(eq(users.id, byEmail.id));
        await convertPendingCrewInvites(byEmail.id, email);
        return {
          id: byEmail.id,
          kind: "authenticated",
          name: name ?? byEmail.name,
          email: byEmail.email,
          image: image ?? byEmail.image,
        };
      }
    }

    // 4. Fresh insert
    const [created] = await db
      .insert(users)
      .values({
        authUserId: authUser.id,
        email,
        name,
        image,
        isGuest: false,
        emailVerified: new Date(),
      })
      .returning();
    if (!created) return null;
    if (email) await convertPendingCrewInvites(created.id, email);
    return {
      id: created.id,
      kind: "authenticated",
      name: created.name,
      email: created.email,
      image: created.image,
    };
  } catch (error) {
    console.error("[auth] resolveSupabaseUser failed:", error);
    return null;
  }
}

export async function currentUserIdOrGuest(): Promise<string> {
  const user = await currentUser();
  if (user) return user.id;
  return "guest-session-without-cookie";
}

async function ensureGuestUser(guestId: string): Promise<void> {
  if (!hasDatabase()) return;
  await safeDb(async () => {
    await db
      .insert(users)
      .values({ id: guestId, isGuest: true, name: "Guest" })
      .onConflictDoNothing({ target: users.id });
    return null;
  }, null);
}

export function newGuestId(): string {
  return randomUUID();
}

/**
 * Convert any pending crew_invites for `email` into pending friendships
 * with `userId` as recipient. Called from resolveSupabaseUser after a
 * fresh signup so the new user lands with their friend requests waiting.
 * Inlined here (rather than living in server/actions/friends.ts) to avoid
 * forcing this module to import a "use server"-tagged file.
 */
async function convertPendingCrewInvites(
  userId: string,
  email: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  await safeDb(async () => {
    const pending = await db.query.crewInvites.findMany({
      where: and(
        eq(crewInvites.email, normalized),
        eq(crewInvites.status, "pending"),
      ),
    });
    for (const invite of pending) {
      const dupe = await db.query.friendships.findFirst({
        where: or(
          and(
            eq(friendships.requesterId, invite.inviterId),
            eq(friendships.recipientId, userId),
          ),
          and(
            eq(friendships.requesterId, userId),
            eq(friendships.recipientId, invite.inviterId),
          ),
        ),
      });
      if (!dupe) {
        await db.insert(friendships).values({
          requesterId: invite.inviterId,
          recipientId: userId,
          status: "pending",
        });
      }
      await db
        .update(crewInvites)
        .set({
          status: "accepted",
          acceptedAt: new Date(),
          acceptedUserId: userId,
        })
        .where(eq(crewInvites.id, invite.id));
    }
    return null;
  }, null);
}
