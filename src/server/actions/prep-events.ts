"use server";

// PRD v3 Phase 5 — Build a Rep v2 event-preparation lifecycle (PRD §7).
//
// The user describes the event; Cognify generates the Preparation Plan
// (Critical Moments) immediately — context uploads are optional and can
// arrive later ("Regenerate with context"). Every mutation is scoped to
// the authenticated owner; generation failures fall back to strong
// generic plans so the flow never dead-ends.

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  callouts,
  criticalMoments,
  dimensionScores,
  practiceSessions,
  prepContextUploads,
  prepEvents,
  readinessReviews,
  reps,
} from "@/lib/db/schema";
import { safeDb } from "@/lib/db/safe";
import { currentUser } from "@/lib/session/current-user";
import { log } from "@/lib/log";
import { awardSessionCompletionXp } from "@/lib/progression/xp";
import { isBuildARepV2Enabled } from "@/lib/flags";
import { getBuildARepEntitlement } from "@/lib/entitlements";
import {
  generatePreparationPlan,
  type PreparationPlan,
} from "@/lib/ai/prep/plan-generation";
import {
  generateReadinessReview,
  type ReadinessEvidence,
  type ReadinessReviewContent,
} from "@/lib/ai/prep/readiness-review";
import {
  DIMENSION_LABELS,
  SKILL_DIMENSIONS,
  type SkillDimension,
} from "@/types/domain";
import { buildCommunicationSnapshot } from "@/lib/profile/snapshot";

const DESCRIPTION_MAX = 2000;
const MOMENT_TITLE_MAX = 60;
/** Cached concat of parsed uploads on the event row, for generation. */
const CONTEXT_SUMMARY_CAP = 8000;

export type PrepMoment = {
  id: string;
  title: string;
  objective: string | null;
  recommendedSeconds: number;
  sortOrder: number;
  source: string;
  bestComposite: number | null;
  attempts: number;
};

export type PrepUploadMeta = {
  id: string;
  fileName: string;
  parseStatus: string;
  parsedChars: number | null;
};

export type PrepEventDetail = {
  id: string;
  title: string;
  description: string;
  eventType: string;
  recommendedMode: string;
  recommendedDurationSec: number | null;
  readinessScore: number | null;
  /** Cached concat of parsed uploads (capped server-side). Feeds the
   *  per-rep scoring eventContext (§7.5) on the client. */
  contextSummary: string | null;
  createdAt: string;
  moments: PrepMoment[];
  uploads: PrepUploadMeta[];
  latestReview: {
    mode: string;
    overallScore: number | null;
    coachFeedback: string | null;
    readinessSummary: string | null;
    coreSkills: ReadinessReviewContent["coreSkills"];
    createdAt: string;
  } | null;
};

type Gate =
  | { ok: true; userId: string }
  | { ok: false; reason: "flag_off" | "no_user" | "premium_required" };

async function gate(): Promise<Gate> {
  if (!isBuildARepV2Enabled()) return { ok: false, reason: "flag_off" };
  const user = await currentUser();
  if (!user) return { ok: false, reason: "no_user" };
  const ent = getBuildARepEntitlement(user.id);
  if (!ent.allowed) return { ok: false, reason: ent.reason };
  return { ok: true, userId: user.id };
}

/** PRD §8.4.6 Adaptive Preparation — the generation hint that makes
 *  repeat preparation smarter: the user's weakest Core Skill (from the
 *  Communication Snapshot) plus the event's prior readiness + weakest
 *  practiced moments. Null when there's nothing to say yet. */
async function buildPrepProfileHint(
  userId: string,
  eventId: string | null,
): Promise<string | null> {
  const parts: string[] = [];
  const snapshot = await buildCommunicationSnapshot(userId);
  if (snapshot?.weakestCoreSkill) {
    parts.push(
      `The user's weakest Core Skill is ${
        DIMENSION_LABELS[snapshot.weakestCoreSkill.dimension] ??
        snapshot.weakestCoreSkill.dimension
      } (${Math.round(snapshot.weakestCoreSkill.score)}) — moments that exercise it deserve extra practice time.`,
    );
  }
  if (eventId) {
    const [lastReview] = await db
      .select({
        overallScore: readinessReviews.overallScore,
        coachFeedback: readinessReviews.coachFeedback,
      })
      .from(readinessReviews)
      .where(eq(readinessReviews.eventId, eventId))
      .orderBy(desc(readinessReviews.createdAt))
      .limit(1);
    if (lastReview) {
      parts.push(
        `PREVIOUS SESSION on this event: readiness ${
          lastReview.overallScore != null
            ? Math.round(lastReview.overallScore)
            : "n/a"
        }; prior coach feedback: "${lastReview.coachFeedback ?? ""}". Build on it — don't restart from scratch.`,
      );
    }
    const weakMoments = await db
      .select({
        title: criticalMoments.title,
        bestComposite: criticalMoments.bestComposite,
      })
      .from(criticalMoments)
      .where(eq(criticalMoments.eventId, eventId))
      .orderBy(asc(criticalMoments.bestComposite))
      .limit(2);
    const weak = weakMoments.filter(
      (m) => m.bestComposite != null && m.bestComposite < 70,
    );
    if (weak.length > 0) {
      parts.push(
        `Weakest practiced moments so far: ${weak
          .map((m) => `"${m.title}" (best ${Math.round(m.bestComposite!)})`)
          .join(", ")}.`,
      );
    }
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

/** Combined parsed context for an event (capped), for generation calls. */
async function gatherContextText(eventId: string): Promise<string | null> {
  const rows = await db
    .select({
      fileName: prepContextUploads.fileName,
      parsedText: prepContextUploads.parsedText,
    })
    .from(prepContextUploads)
    .where(
      and(
        eq(prepContextUploads.eventId, eventId),
        eq(prepContextUploads.parseStatus, "parsed"),
      ),
    )
    .orderBy(asc(prepContextUploads.createdAt));
  const parts = rows
    .filter((r) => r.parsedText)
    .map((r) => `=== ${r.fileName} ===\n${r.parsedText}`);
  return parts.length > 0 ? parts.join("\n\n") : null;
}

async function applyPlanMoments(
  userId: string,
  eventId: string,
  plan: PreparationPlan,
  { keepUserMoments }: { keepUserMoments: boolean },
): Promise<void> {
  if (keepUserMoments) {
    await db
      .delete(criticalMoments)
      .where(
        and(
          eq(criticalMoments.eventId, eventId),
          eq(criticalMoments.source, "generated"),
        ),
      );
  } else {
    await db.delete(criticalMoments).where(eq(criticalMoments.eventId, eventId));
  }
  await db.insert(criticalMoments).values(
    plan.moments.map((m, i) => ({
      eventId,
      userId,
      title: m.title,
      objective: m.objective,
      recommendedSeconds: m.recommendedSeconds,
      sortOrder: i,
      source: "generated" as const,
    })),
  );
  if (keepUserMoments) {
    // Push user-authored moments after the regenerated plan.
    const userMoments = await db
      .select({ id: criticalMoments.id })
      .from(criticalMoments)
      .where(
        and(
          eq(criticalMoments.eventId, eventId),
          eq(criticalMoments.source, "user"),
        ),
      )
      .orderBy(asc(criticalMoments.sortOrder));
    for (let i = 0; i < userMoments.length; i++) {
      await db
        .update(criticalMoments)
        .set({ sortOrder: plan.moments.length + i })
        .where(eq(criticalMoments.id, userMoments[i]!.id));
    }
  }
}

// ── Event lifecycle ─────────────────────────────────────────────────────

export async function createPrepEvent(input: {
  description: string;
}): Promise<{ ok: true; eventId: string } | { ok: false; reason: string }> {
  const g = await gate();
  if (!g.ok) return { ok: false, reason: g.reason };
  const description = input.description.trim().slice(0, DESCRIPTION_MAX);
  if (description.length < 3) return { ok: false, reason: "invalid_input" };

  return safeDb(
    async () => {
      const profileHint = await buildPrepProfileHint(g.userId, null);
      const { plan, source } = await generatePreparationPlan({
        description,
        profileHint,
      });
      const [event] = await db
        .insert(prepEvents)
        .values({
          userId: g.userId,
          title: plan.title,
          description,
          eventType: plan.eventType,
          recommendedMode: plan.recommendedMode,
          recommendedDurationSec: plan.recommendedDurationSec,
        })
        .returning({ id: prepEvents.id });
      if (!event) return { ok: false as const, reason: "db_error" };
      await applyPlanMoments(g.userId, event.id, plan, {
        keepUserMoments: false,
      });
      log.info({
        event: "prep.event_created",
        userId: g.userId,
        eventId: event.id,
        eventType: plan.eventType,
        planSource: source,
        moments: plan.moments.length,
      });
      return { ok: true as const, eventId: event.id };
    },
    { ok: false as const, reason: "db_error" },
  );
}

export async function regeneratePreparationPlan(input: {
  eventId: string;
}): Promise<{ ok: boolean }> {
  const g = await gate();
  if (!g.ok) return { ok: false };
  return safeDb(
    async () => {
      const [event] = await db
        .select()
        .from(prepEvents)
        .where(
          and(eq(prepEvents.id, input.eventId), eq(prepEvents.userId, g.userId)),
        )
        .limit(1);
      if (!event) return { ok: false };
      const contextText = await gatherContextText(event.id);
      const profileHint = await buildPrepProfileHint(g.userId, event.id);
      const { plan, source } = await generatePreparationPlan({
        description: event.description,
        contextText,
        profileHint,
      });
      await applyPlanMoments(g.userId, event.id, plan, {
        keepUserMoments: true,
      });
      await db
        .update(prepEvents)
        .set({
          title: plan.title,
          eventType: plan.eventType,
          recommendedMode: plan.recommendedMode,
          recommendedDurationSec: plan.recommendedDurationSec,
          contextSummary: contextText?.slice(0, CONTEXT_SUMMARY_CAP) ?? null,
          updatedAt: new Date(),
        })
        .where(eq(prepEvents.id, event.id));
      log.info({
        event: "prep.plan_regenerated",
        userId: g.userId,
        eventId: event.id,
        planSource: source,
        withContext: contextText != null,
      });
      return { ok: true };
    },
    { ok: false },
  );
}

export async function listPrepEvents(): Promise<
  {
    id: string;
    title: string;
    eventType: string;
    readinessScore: number | null;
    momentCount: number;
    createdAt: string;
  }[]
> {
  const g = await gate();
  if (!g.ok) return [];
  return safeDb(async () => {
    const rows = await db
      .select({
        id: prepEvents.id,
        title: prepEvents.title,
        eventType: prepEvents.eventType,
        readinessScore: prepEvents.readinessScore,
        createdAt: prepEvents.createdAt,
        momentCount: sql<number>`(
          SELECT count(*)::int FROM cognify_v2.critical_moments cm
          WHERE cm.event_id = ${prepEvents.id}
        )`,
      })
      .from(prepEvents)
      .where(
        and(eq(prepEvents.userId, g.userId), eq(prepEvents.status, "active")),
      )
      .orderBy(desc(prepEvents.createdAt))
      .limit(20);
    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }));
  }, []);
}

export async function getPrepEvent(
  eventId: string,
): Promise<PrepEventDetail | null> {
  const g = await gate();
  if (!g.ok) return null;
  return safeDb(async () => {
    const [event] = await db
      .select()
      .from(prepEvents)
      .where(and(eq(prepEvents.id, eventId), eq(prepEvents.userId, g.userId)))
      .limit(1);
    if (!event) return null;
    const moments = await db
      .select()
      .from(criticalMoments)
      .where(eq(criticalMoments.eventId, eventId))
      .orderBy(asc(criticalMoments.sortOrder), asc(criticalMoments.createdAt));
    const uploads = await db
      .select({
        id: prepContextUploads.id,
        fileName: prepContextUploads.fileName,
        parseStatus: prepContextUploads.parseStatus,
        parsedChars: prepContextUploads.parsedChars,
      })
      .from(prepContextUploads)
      .where(eq(prepContextUploads.eventId, eventId))
      .orderBy(asc(prepContextUploads.createdAt));
    const [review] = await db
      .select()
      .from(readinessReviews)
      .where(eq(readinessReviews.eventId, eventId))
      .orderBy(desc(readinessReviews.createdAt))
      .limit(1);
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      eventType: event.eventType,
      recommendedMode: event.recommendedMode,
      recommendedDurationSec: event.recommendedDurationSec,
      readinessScore: event.readinessScore,
      contextSummary: event.contextSummary,
      createdAt: event.createdAt.toISOString(),
      moments: moments.map((m) => ({
        id: m.id,
        title: m.title,
        objective: m.objective,
        recommendedSeconds: m.recommendedSeconds,
        sortOrder: m.sortOrder,
        source: m.source,
        bestComposite: m.bestComposite,
        attempts: m.attempts,
      })),
      uploads,
      latestReview: review
        ? {
            mode: review.mode,
            overallScore: review.overallScore,
            coachFeedback: review.coachFeedback,
            readinessSummary: review.readinessSummary,
            coreSkills:
              review.coreSkills as ReadinessReviewContent["coreSkills"],
            createdAt: review.createdAt.toISOString(),
          }
        : null,
    };
  }, null);
}

export async function archivePrepEvent(input: {
  eventId: string;
}): Promise<{ ok: boolean }> {
  const g = await gate();
  if (!g.ok) return { ok: false };
  return safeDb<{ ok: boolean }>(async () => {
    await db
      .update(prepEvents)
      .set({ status: "archived", updatedAt: new Date() })
      .where(
        and(eq(prepEvents.id, input.eventId), eq(prepEvents.userId, g.userId)),
      );
    return { ok: true };
  }, { ok: false });
}

// ── Preparation Plan editing (PRD §7.7 — fully user-controlled) ─────────

export async function addCriticalMoment(input: {
  eventId: string;
  title: string;
}): Promise<{ ok: boolean; momentId?: string }> {
  const g = await gate();
  if (!g.ok) return { ok: false };
  const title = input.title.trim().slice(0, MOMENT_TITLE_MAX);
  if (title.length === 0) return { ok: false };
  return safeDb<{ ok: boolean; momentId?: string }>(async () => {
    const [event] = await db
      .select({ id: prepEvents.id })
      .from(prepEvents)
      .where(
        and(eq(prepEvents.id, input.eventId), eq(prepEvents.userId, g.userId)),
      )
      .limit(1);
    if (!event) return { ok: false };
    const [orderRow] = await db
      .select({
        maxOrder: sql<number>`COALESCE(MAX(${criticalMoments.sortOrder}), -1)`,
      })
      .from(criticalMoments)
      .where(eq(criticalMoments.eventId, input.eventId));
    const maxOrder = orderRow?.maxOrder ?? -1;
    const [row] = await db
      .insert(criticalMoments)
      .values({
        eventId: input.eventId,
        userId: g.userId,
        title,
        recommendedSeconds: 90,
        sortOrder: maxOrder + 1,
        source: "user",
      })
      .returning({ id: criticalMoments.id });
    return { ok: true, momentId: row?.id };
  }, { ok: false });
}

export async function updateCriticalMoment(input: {
  momentId: string;
  title?: string;
  recommendedSeconds?: number;
}): Promise<{ ok: boolean }> {
  const g = await gate();
  if (!g.ok) return { ok: false };
  const set: Record<string, unknown> = {};
  if (input.title != null) {
    const t = input.title.trim().slice(0, MOMENT_TITLE_MAX);
    if (t.length === 0) return { ok: false };
    set.title = t;
  }
  if (input.recommendedSeconds != null) {
    if (
      !Number.isInteger(input.recommendedSeconds) ||
      input.recommendedSeconds < 15 ||
      input.recommendedSeconds > 1800
    ) {
      return { ok: false };
    }
    set.recommendedSeconds = input.recommendedSeconds;
  }
  if (Object.keys(set).length === 0) return { ok: true };
  return safeDb<{ ok: boolean }>(async () => {
    await db
      .update(criticalMoments)
      .set(set)
      .where(
        and(
          eq(criticalMoments.id, input.momentId),
          eq(criticalMoments.userId, g.userId),
        ),
      );
    return { ok: true };
  }, { ok: false });
}

export async function removeCriticalMoment(input: {
  momentId: string;
}): Promise<{ ok: boolean }> {
  const g = await gate();
  if (!g.ok) return { ok: false };
  return safeDb<{ ok: boolean }>(async () => {
    await db
      .delete(criticalMoments)
      .where(
        and(
          eq(criticalMoments.id, input.momentId),
          eq(criticalMoments.userId, g.userId),
        ),
      );
    return { ok: true };
  }, { ok: false });
}

export async function reorderCriticalMoments(input: {
  eventId: string;
  orderedIds: string[];
}): Promise<{ ok: boolean }> {
  const g = await gate();
  if (!g.ok) return { ok: false };
  if (input.orderedIds.length === 0 || input.orderedIds.length > 40) {
    return { ok: false };
  }
  return safeDb<{ ok: boolean }>(async () => {
    for (let i = 0; i < input.orderedIds.length; i++) {
      await db
        .update(criticalMoments)
        .set({ sortOrder: i })
        .where(
          and(
            eq(criticalMoments.id, input.orderedIds[i]!),
            eq(criticalMoments.eventId, input.eventId),
            eq(criticalMoments.userId, g.userId),
          ),
        );
    }
    return { ok: true };
  }, { ok: false });
}

// ── Practice bookkeeping + Readiness Review ─────────────────────────────

export async function startPrepSession(input: {
  eventId: string;
}): Promise<{ ok: boolean; sessionId?: string }> {
  const g = await gate();
  if (!g.ok) return { ok: false };
  return safeDb<{ ok: boolean; sessionId?: string }>(async () => {
    const [event] = await db
      .select({ id: prepEvents.id })
      .from(prepEvents)
      .where(
        and(eq(prepEvents.id, input.eventId), eq(prepEvents.userId, g.userId)),
      )
      .limit(1);
    if (!event) return { ok: false };
    const [session] = await db
      .insert(practiceSessions)
      .values({
        userId: g.userId,
        mode: "build_a_rep",
        sessionType: "focus",
        startedAt: new Date(),
      })
      .returning({ id: practiceSessions.id });
    return { ok: true, sessionId: session?.id };
  }, { ok: false });
}

export async function recordMomentPractice(input: {
  momentId: string;
  composite: number | null;
}): Promise<{ ok: boolean }> {
  const g = await gate();
  if (!g.ok) return { ok: false };
  return safeDb<{ ok: boolean }>(async () => {
    const [moment] = await db
      .select({
        id: criticalMoments.id,
        best: criticalMoments.bestComposite,
        attempts: criticalMoments.attempts,
      })
      .from(criticalMoments)
      .where(
        and(
          eq(criticalMoments.id, input.momentId),
          eq(criticalMoments.userId, g.userId),
        ),
      )
      .limit(1);
    if (!moment) return { ok: false };
    const best =
      input.composite != null && Number.isFinite(input.composite)
        ? Math.max(moment.best ?? 0, input.composite)
        : moment.best;
    await db
      .update(criticalMoments)
      .set({
        attempts: moment.attempts + 1,
        bestComposite: best,
        lastPracticedAt: new Date(),
      })
      .where(eq(criticalMoments.id, input.momentId));
    return { ok: true };
  }, { ok: false });
}

const VALID_DIMS = new Set<string>(SKILL_DIMENSIONS);

type ServerReadinessEvidence = {
  dimensionAverages: Partial<Record<SkillDimension, number>>;
  callouts: { dimension: string; title: string; body: string }[];
  transcriptExcerpt: string | null;
  /** Scored reps the evidence was derived from (telemetry). */
  repCount: number;
};

/** L1 (PRD §7.9) — server-derived readiness evidence.
 *
 * The client used to accumulate dimension averages / callouts /
 * transcript in useRef accumulators and POST them to finishPrepSession —
 * forgeable, and wiped by a mid-session refresh, which broke §7.9's
 * "across the entire preparation experience". Recompute the evidence
 * from persisted reps instead. Reps link to the prep event only through
 * the practice session ensureSession/startPrepSession created (mode
 * build_a_rep), so we scope to that session id (and, for simulations,
 * the backing long rep): ownership + mode are enforced in SQL, and the
 * numbers come from rows the scoring pipeline itself wrote
 * (dimension_scores, callouts, reps.transcript).
 *
 * Returns null when no scored rep is found so the caller can fall back
 * to the client payload (degraded path — kept working on purpose).
 */
async function deriveReadinessEvidence(input: {
  userId: string;
  mode: "guided" | "simulation";
  sessionId: string | null | undefined;
  repId: string | null | undefined;
}): Promise<ServerReadinessEvidence | null> {
  const scopeWhere = (scope: "rep" | "session") =>
    and(
      eq(reps.userId, input.userId),
      eq(practiceSessions.userId, input.userId),
      eq(practiceSessions.mode, "build_a_rep"),
      scope === "rep"
        ? eq(reps.id, input.repId!)
        : eq(reps.sessionId, input.sessionId!),
    );

  // A simulation review is backed by ONE long rep; a guided review by
  // every rep recorded in the event's practice session. Try the tighter
  // scope first, then widen to the session before giving up.
  const scopes: ("rep" | "session")[] = [];
  if (input.mode === "simulation" && input.repId) scopes.push("rep");
  if (input.sessionId) scopes.push("session");

  for (const scope of scopes) {
    const scoreRows = await db
      .select({
        repId: dimensionScores.repId,
        dimension: dimensionScores.dimension,
        score: dimensionScores.score,
      })
      .from(dimensionScores)
      .innerJoin(reps, eq(dimensionScores.repId, reps.id))
      .innerJoin(practiceSessions, eq(reps.sessionId, practiceSessions.id))
      .where(scopeWhere(scope));

    // Same aggregation the client's accumulator performed: per-dimension
    // mean over the session's scored reps, canonical v3 dims only
    // (structural_adherence + legacy dims are skipped, matching the
    // client-side SKILL_DIMENSIONS filter).
    const acc = new Map<SkillDimension, { total: number; n: number }>();
    const scoredRepIds = new Set<string>();
    for (const row of scoreRows) {
      if (!VALID_DIMS.has(row.dimension)) continue;
      scoredRepIds.add(row.repId);
      const dim = row.dimension as SkillDimension;
      const cur = acc.get(dim) ?? { total: 0, n: 0 };
      cur.total += Math.min(100, Math.max(0, row.score));
      cur.n += 1;
      acc.set(dim, cur);
    }
    if (acc.size === 0) continue;
    const dimensionAverages: Partial<Record<SkillDimension, number>> = {};
    for (const [dim, { total, n }] of acc) dimensionAverages[dim] = total / n;

    const calloutRows = await db
      .select({
        dimension: callouts.dimension,
        title: callouts.title,
        body: callouts.body,
      })
      .from(callouts)
      .innerJoin(reps, eq(callouts.repId, reps.id))
      .innerJoin(practiceSessions, eq(reps.sessionId, practiceSessions.id))
      .where(
        and(scopeWhere(scope), inArray(callouts.tone, ["warn", "critical"])),
      )
      .orderBy(desc(reps.createdAt))
      .limit(8);

    // Simulation: ground the review in the sim rep's own transcript
    // (guided reviews never carried one — parity with the old client).
    let transcriptExcerpt: string | null = null;
    if (scope === "rep") {
      const [simRep] = await db
        .select({ transcript: reps.transcript })
        .from(reps)
        .where(and(eq(reps.id, input.repId!), eq(reps.userId, input.userId)))
        .limit(1);
      transcriptExcerpt = simRep?.transcript?.text?.slice(0, 8000) ?? null;
    }

    return {
      dimensionAverages,
      callouts: calloutRows,
      transcriptExcerpt,
      repCount: scoredRepIds.size,
    };
  }
  return null;
}

export type FinishPrepInput = {
  eventId: string;
  mode: "guided" | "simulation";
  sessionId?: string | null;
  /** Simulation only — the long rep backing the review. */
  repId?: string | null;
  /** Per-dimension averages the client accumulated across the session's
   *  scored reps. L1 — used ONLY as a degraded fallback: whenever ≥1
   *  scored rep exists server-side, the evidence is recomputed from
   *  persisted reps (deriveReadinessEvidence) and this is ignored. */
  dimensionAverages: Partial<Record<string, number>>;
  /** L1 — fallback-only, same as dimensionAverages. */
  transcriptExcerpt?: string | null;
  /** L1 — fallback-only, same as dimensionAverages. */
  callouts?: { dimension: string; title: string; body: string }[];
};

export async function finishPrepSession(
  input: FinishPrepInput,
): Promise<
  | { ok: true; review: ReadinessReviewContent }
  | { ok: false }
> {
  const g = await gate();
  if (!g.ok) return { ok: false };
  return safeDb<{ ok: true; review: ReadinessReviewContent } | { ok: false }>(
    async () => {
      const [event] = await db
        .select()
        .from(prepEvents)
        .where(
          and(eq(prepEvents.id, input.eventId), eq(prepEvents.userId, g.userId)),
        )
        .limit(1);
      if (!event) return { ok: false };

      // L1 (§7.9) — readiness evidence must be server-derived. Recompute
      // it from the persisted reps of this event's practice session (or
      // the simulation's backing rep); the client payload is used ONLY
      // when no scored rep is found (degraded path). The deterministic
      // weighted readiness score (computeReadinessScore) is unchanged —
      // only its inputs are swapped.
      const serverEvidence = await deriveReadinessEvidence({
        userId: g.userId,
        mode: input.mode,
        sessionId: input.sessionId,
        repId: input.repId,
      });

      const rawAverages: Partial<Record<string, number>> = serverEvidence
        ? serverEvidence.dimensionAverages
        : input.dimensionAverages;
      const dimensionAverages: Partial<Record<SkillDimension, number>> = {};
      for (const [dim, v] of Object.entries(rawAverages)) {
        if (!VALID_DIMS.has(dim) || v == null || !Number.isFinite(v)) continue;
        dimensionAverages[dim as SkillDimension] = Math.min(
          100,
          Math.max(0, v),
        );
      }

      const evidenceCallouts = serverEvidence
        ? serverEvidence.callouts
        : (input.callouts?.slice(0, 8) ?? []);
      const evidenceTranscript = serverEvidence
        ? serverEvidence.transcriptExcerpt
        : (input.transcriptExcerpt?.slice(0, 8000) ?? null);

      const moments = await db
        .select({
          title: criticalMoments.title,
          attempts: criticalMoments.attempts,
          bestComposite: criticalMoments.bestComposite,
        })
        .from(criticalMoments)
        .where(eq(criticalMoments.eventId, input.eventId))
        .orderBy(asc(criticalMoments.sortOrder));

      // §8.4.6 — feed the previous review so the coach can speak to
      // trajectory ("up from 62 last session") instead of starting over.
      const [previousReview] = await db
        .select({
          overallScore: readinessReviews.overallScore,
          coachFeedback: readinessReviews.coachFeedback,
        })
        .from(readinessReviews)
        .where(eq(readinessReviews.eventId, event.id))
        .orderBy(desc(readinessReviews.createdAt))
        .limit(1);

      const evidence: ReadinessEvidence = {
        event: {
          title: event.title,
          eventType: event.eventType,
          description: event.description,
          contextSummary: event.contextSummary,
        },
        previous: previousReview
          ? {
              overallScore: previousReview.overallScore,
              coachFeedback: previousReview.coachFeedback,
            }
          : null,
        mode: input.mode,
        dimensionAverages,
        moments:
          input.mode === "guided"
            ? moments.filter((m) => m.attempts > 0)
            : undefined,
        transcriptExcerpt: evidenceTranscript,
        callouts: evidenceCallouts,
      };
      const { review, source } = await generateReadinessReview(evidence);

      await db.insert(readinessReviews).values({
        eventId: event.id,
        userId: g.userId,
        mode: input.mode,
        overallScore: review.overallScore,
        coreSkills: review.coreSkills as Record<
          string,
          { score: number; why: string; well: string; improve: string }
        >,
        coachFeedback: review.coachFeedback,
        readinessSummary: review.readinessSummary,
        repId: input.repId ?? null,
      });
      // Phase 15 R-2 (§10.5.3) — the FIRST Readiness Review for an event
      // is a completion signal; re-finishing the same event isn't.
      const firstReview = event.readinessScore == null;
      await db
        .update(prepEvents)
        .set({
          readinessScore: review.overallScore,
          updatedAt: new Date(),
        })
        .where(eq(prepEvents.id, event.id));
      if (firstReview) {
        await awardSessionCompletionXp(g.userId, "build_a_rep");
      }
      if (input.sessionId) {
        await db
          .update(practiceSessions)
          .set({
            endedAt: new Date(),
            ...(review.overallScore != null
              ? { compositeScore: review.overallScore }
              : {}),
          })
          .where(
            and(
              eq(practiceSessions.id, input.sessionId),
              eq(practiceSessions.userId, g.userId),
            ),
          );
      }
      log.info({
        event: "prep.readiness_review",
        userId: g.userId,
        eventId: event.id,
        mode: input.mode,
        overallScore: review.overallScore,
        reviewSource: source,
        // L1 — "server" = evidence recomputed from persisted reps;
        // "client_fallback" = no scored rep found, degraded path.
        evidenceSource: serverEvidence ? "server" : "client_fallback",
        evidenceReps: serverEvidence?.repCount ?? 0,
      });
      return { ok: true, review };
    },
    { ok: false },
  );
}
