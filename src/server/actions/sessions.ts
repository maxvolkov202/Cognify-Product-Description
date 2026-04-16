"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { practiceSessions } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";
import type { ModeId } from "@/types/domain";

type CreateSessionResult = { sessionId: string; persisted: boolean };
type FinalizeSessionResult = { persisted: boolean };

export async function createSession(
  mode: ModeId,
): Promise<CreateSessionResult> {
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";
  const fallback: CreateSessionResult = {
    sessionId: randomUUID(),
    persisted: false,
  };

  return safeDb<CreateSessionResult>(async () => {
    const [session] = await db
      .insert(practiceSessions)
      .values({
        userId,
        mode,
        startedAt: new Date(),
      })
      .returning({ id: practiceSessions.id });
    return { sessionId: session!.id, persisted: true };
  }, fallback);
}

export async function finalizeSession(
  sessionId: string,
  compositeScore: number,
): Promise<FinalizeSessionResult> {
  const fallback: FinalizeSessionResult = { persisted: false };
  return safeDb<FinalizeSessionResult>(async () => {
    await db
      .update(practiceSessions)
      .set({ endedAt: new Date(), compositeScore })
      .where(eq(practiceSessions.id, sessionId));
    return { persisted: true };
  }, fallback);
}
