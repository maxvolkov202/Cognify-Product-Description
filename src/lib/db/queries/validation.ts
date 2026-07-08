import { count, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  externalValidations,
  externalRankings,
  reps,
} from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";

export type ValidationSummary = {
  id: string;
  token: string;
  topic: string;
  createdAt: Date;
  closedAt: Date | null;
  repIds: string[];
  rankingCount: number;
  reps: Array<{ id: string; compositeScore: number; createdAt: Date; durationMs: number }>;
};

export async function getValidationByToken(
  token: string,
): Promise<ValidationSummary | null> {
  return safeDb(async () => {
    const validation = await db.query.externalValidations.findFirst({
      where: eq(externalValidations.token, token),
    });
    if (!validation) return null;

    const repIds = (validation.repIds as string[]) ?? [];
    const rows = repIds.length
      ? await db
          .select({
            id: reps.id,
            compositeScore: reps.compositeScore,
            createdAt: reps.createdAt,
            durationMs: reps.durationMs,
          })
          .from(reps)
          .where(inArray(reps.id, repIds))
      : [];

    const rankings = await db
      .select({ id: externalRankings.id })
      .from(externalRankings)
      .where(eq(externalRankings.validationId, validation.id));

    return {
      id: validation.id,
      token: validation.token,
      topic: validation.topic,
      createdAt: validation.createdAt,
      closedAt: validation.closedAt,
      repIds,
      rankingCount: rankings.length,
      reps: rows.map((r) => ({
        id: r.id,
        compositeScore: r.compositeScore ?? 0,
        createdAt: r.createdAt,
        durationMs: r.durationMs,
      })),
    };
  }, null);
}

export async function getUserValidations(
  userId: string,
): Promise<ValidationSummary[]> {
  return safeDb(async () => {
    const rows = await db
      .select({
        id: externalValidations.id,
        token: externalValidations.token,
        topic: externalValidations.topic,
        createdAt: externalValidations.createdAt,
        closedAt: externalValidations.closedAt,
        repIds: externalValidations.repIds,
      })
      .from(externalValidations)
      .where(eq(externalValidations.userId, userId))
      .orderBy(desc(externalValidations.createdAt));

    if (rows.length === 0) return [];

    // Single GROUP BY instead of per-row rankings count (audit PR-8).
    const validationIds = rows.map((r) => r.id);
    const rankingCountRows = await db
      .select({
        validationId: externalRankings.validationId,
        c: count(),
      })
      .from(externalRankings)
      .where(inArray(externalRankings.validationId, validationIds))
      .groupBy(externalRankings.validationId);
    const rankingCountByValidation = new Map<string, number>(
      rankingCountRows.map((r) => [r.validationId, Number(r.c)]),
    );

    return rows.map((row) => ({
      id: row.id,
      token: row.token,
      topic: row.topic,
      createdAt: row.createdAt,
      closedAt: row.closedAt,
      repIds: (row.repIds as string[]) ?? [],
      rankingCount: rankingCountByValidation.get(row.id) ?? 0,
      reps: [],
    }));
  }, []);
}

export type RankingAggregation = {
  repId: string;
  averageRank: number;
  firstPlace: number;
  totalVoters: number;
};

export async function getValidationAggregation(
  validationId: string,
  repIds: string[],
): Promise<RankingAggregation[]> {
  return safeDb(async () => {
    const rows = await db
      .select({ ranking: externalRankings.ranking })
      .from(externalRankings)
      .where(eq(externalRankings.validationId, validationId));

    const totals: Record<string, { sum: number; firstPlace: number }> = {};
    for (const id of repIds) totals[id] = { sum: 0, firstPlace: 0 };

    for (const row of rows) {
      const ranking = (row.ranking as string[]) ?? [];
      for (let i = 0; i < ranking.length; i++) {
        const id = ranking[i];
        if (!id || !totals[id]) continue;
        totals[id].sum += i + 1;
        if (i === 0) totals[id].firstPlace += 1;
      }
    }

    const total = rows.length || 1;
    return repIds.map((id) => ({
      repId: id,
      averageRank: totals[id] ? totals[id].sum / total : 0,
      firstPlace: totals[id]?.firstPlace ?? 0,
      totalVoters: rows.length,
    }));
  }, repIds.map((id) => ({ repId: id, averageRank: 0, firstPlace: 0, totalVoters: 0 })));
}
