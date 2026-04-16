import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { hasDatabase, safeDb } from "@/lib/db/safe";

export const GUEST_COOKIE = "cognify_guest_id";

export type ResolvedUser = {
  id: string;
  kind: "authenticated" | "guest";
  name: string | null;
  email: string | null;
  image: string | null;
};

export async function currentUser(): Promise<ResolvedUser | null> {
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
    // Auth unavailable — fall through to guest.
  }

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
