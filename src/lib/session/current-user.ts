import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
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

  // 2. Fall back to NextAuth (still active during Phase 2 transition)
  try {
    const session = await auth();
    if (session?.user?.id) {
      return {
        id: session.user.id,
        kind: "authenticated",
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        image: session.user.image ?? null,
      };
    }
  } catch {
    // NextAuth unavailable — fall through
  }

  // 3. Guest cookie fallback
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
        await db
          .update(users)
          .set({
            authUserId: authUser.id,
            email,
            name: name ?? guest.name,
            image: image ?? guest.image,
            isGuest: false,
            emailVerified: new Date(),
          })
          .where(eq(users.id, guestId));
        store.delete(GUEST_COOKIE);
        return {
          id: guestId,
          kind: "authenticated",
          name: name ?? guest.name,
          email,
          image: image ?? guest.image,
        };
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
