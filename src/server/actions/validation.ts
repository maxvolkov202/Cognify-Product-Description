"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { externalValidations, externalRankings } from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";

function generateToken(): string {
  return randomBytes(18).toString("base64url");
}

export type CreateValidationInput = {
  topic: string;
  repIds: string[];
};

type CreateValidationResult = {
  token: string;
  id: string;
  persisted: boolean;
};

export async function createValidation(
  input: CreateValidationInput,
): Promise<CreateValidationResult> {
  if (input.repIds.length < 2 || input.repIds.length > 10) {
    throw new Error("Validation requires between 2 and 10 reps.");
  }
  const user = await currentUser();
  const userId = user?.id ?? "anonymous";

  const token = generateToken();
  const fallback: CreateValidationResult = {
    token,
    id: randomUUID(),
    persisted: false,
  };

  return safeDb<CreateValidationResult>(async () => {
    const [row] = await db
      .insert(externalValidations)
      .values({
        userId,
        token,
        topic: input.topic,
        repIds: input.repIds,
      })
      .returning({ id: externalValidations.id });
    return { token, id: row!.id, persisted: true };
  }, fallback);
}

export type SubmitRankingInput = {
  token: string;
  ranking: string[];
};

type SubmitRankingResult = { persisted: boolean };

export async function submitRanking(
  input: SubmitRankingInput,
): Promise<SubmitRankingResult> {
  const fallback: SubmitRankingResult = { persisted: false };
  return safeDb<SubmitRankingResult>(async () => {
    const validation = await db.query.externalValidations.findFirst({
      where: eq(externalValidations.token, input.token),
    });
    if (!validation) throw new Error("Validation not found.");
    await db.insert(externalRankings).values({
      validationId: validation.id,
      ranking: input.ranking,
    });
    return { persisted: true };
  }, fallback);
}
