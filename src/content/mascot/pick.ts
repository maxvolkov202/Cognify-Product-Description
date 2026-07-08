"use client";

// Phase 13 — voice-line picker. Deterministic given (user, date,
// bucket) so the same line shows up for the same user on the same day
// (consistency feels intentional, not random). Tracks last-shown index
// in localStorage to avoid back-to-back repeats within a session.
//
// Pure-ish: the hash + modulo math is deterministic and SSR-safe; the
// localStorage layer is wrapped in a safeStorage helper so SSR / private
// mode degrade to pure modulo (still deterministic per day, just no
// "skip last-shown" memory).

import {
  errorFallbacks,
  walkingComments,
  scoreReactions,
  dayCompleteCelebrations,
  freezeConsumed,
  partialDay,
  fullDay,
  idleGreeting,
  atStationIntro,
  atStationIntroGeneric,
} from "./voice";
import type { VoiceCtx } from "./types";

const STORAGE_PREFIX = "cognify.voice.shown.";

// ─── Templating ─────────────────────────────────────────────────────────

/** Replace {slot} placeholders in a voice line. Empty slots are left
 *  literal so authors can spot misses ("Hi {firstName}" with no
 *  firstName renders as "Hi {firstName}", which surfaces the bug). */
export function formatVoice(
  template: string,
  slots: VoiceCtx["slots"] | undefined,
  firstName?: string | null,
): string {
  if (!template) return "";
  const ctx: Record<string, string | number> = { ...(slots ?? {}) } as Record<
    string,
    string | number
  >;
  if (firstName) ctx.firstName = firstName;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = ctx[k];
    if (v == null) return `{${k}}`;
    return String(v);
  });
}

// ─── Seeded shuffle ─────────────────────────────────────────────────────

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function seedIndex(
  seedParts: Array<string | undefined | null>,
  length: number,
): number {
  if (length <= 0) return 0;
  const seed = seedParts.filter(Boolean).join("|") || "anon";
  // FNV-1a 32-bit. Pure JS so this module bundles to the browser
  // (createHash from node:crypto isn't available in client code).
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % length;
}

function safeStorageGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeStorageSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore quota / private-mode failures
  }
}

function pickWithMemory(
  bucketKey: string,
  variants: readonly string[],
  ctx: VoiceCtx,
): string {
  if (variants.length === 0) return "";
  if (variants.length === 1) return variants[0]!;

  let idx = seedIndex(
    [ctx.userId, ctx.dateKey ?? todayKey(), bucketKey],
    variants.length,
  );
  const storageKey = `${STORAGE_PREFIX}${bucketKey}`;
  const last = safeStorageGet(storageKey);
  if (last && Number(last) === idx) {
    // Bump by one (mod length) so we don't show the same line twice
    // in a row within a session.
    idx = (idx + 1) % variants.length;
  }
  safeStorageSet(storageKey, String(idx));
  return variants[idx] ?? variants[0]!;
}

// ─── Per-bucket helpers ─────────────────────────────────────────────────

export function pickIdleGreeting(ctx: VoiceCtx): string {
  const tod = ctx.timeOfDay ?? "morning";
  const pool = idleGreeting[tod] ?? idleGreeting.morning;
  const raw = pickWithMemory(`idleGreeting.${tod}`, pool, ctx);
  return formatVoice(raw, ctx.slots, ctx.firstName);
}

export function pickWalkingComment(ctx: VoiceCtx): string {
  const feel = ctx.feel ?? "neutral";
  const pool = walkingComments[feel];
  const raw = pickWithMemory(`walkingComments.${feel}`, pool, ctx);
  return formatVoice(raw, ctx.slots, ctx.firstName);
}

export function pickAtStationIntro(ctx: VoiceCtx): string {
  const slug = ctx.exerciseSlug;
  const pool: readonly string[] =
    (slug ? atStationIntro[slug] : undefined) ?? atStationIntroGeneric;
  const raw = pickWithMemory(
    `atStationIntro.${slug ?? "generic"}`,
    pool,
    ctx,
  );
  return formatVoice(raw, ctx.slots, ctx.firstName);
}

export function pickScoreReaction(ctx: VoiceCtx): string {
  const band = ctx.band ?? "ok";
  const cell = ctx.firstOfDay
    ? scoreReactions[band].firstOfDay
    : scoreReactions[band].lateInDay;
  const raw = pickWithMemory(
    `scoreReactions.${band}.${ctx.firstOfDay ? "first" : "late"}`,
    cell,
    ctx,
  );
  return formatVoice(raw, ctx.slots, ctx.firstName);
}

export function pickDayCompleteCelebration(ctx: VoiceCtx): string {
  const band = ctx.deltaBand ?? "improvement";
  const pool = dayCompleteCelebrations[band];
  const raw = pickWithMemory(
    `dayCompleteCelebrations.${band}`,
    pool,
    ctx,
  );
  return formatVoice(raw, ctx.slots, ctx.firstName);
}

export function pickFreezeConsumed(ctx: VoiceCtx): string {
  const raw = pickWithMemory("freezeConsumed", freezeConsumed, ctx);
  return formatVoice(raw, ctx.slots, ctx.firstName);
}

export function pickPartialDay(ctx: VoiceCtx): string {
  const raw = pickWithMemory("partialDay", partialDay, ctx);
  return formatVoice(raw, ctx.slots, ctx.firstName);
}

export function pickFullDay(ctx: VoiceCtx): string {
  const raw = pickWithMemory("fullDay", fullDay, ctx);
  return formatVoice(raw, ctx.slots, ctx.firstName);
}

export function pickErrorFallback(ctx: VoiceCtx): string {
  const reason = ctx.errorReason ?? "unknown";
  const pool = errorFallbacks[reason] ?? errorFallbacks.unknown;
  const raw = pickWithMemory(`errorFallbacks.${reason}`, pool, ctx);
  return formatVoice(raw, ctx.slots, ctx.firstName);
}

// ─── Generic bucket access for callers that already have a pool ────────

export function pickVoiceLine(
  bucketKey: string,
  variants: readonly string[],
  ctx: VoiceCtx,
): string {
  const raw = pickWithMemory(bucketKey, variants, ctx);
  return formatVoice(raw, ctx.slots, ctx.firstName);
}

/** Resolve the time-of-day bucket from a Date. */
export function timeOfDayFor(d: Date): VoiceCtx["timeOfDay"] {
  const h = d.getHours();
  if (h < 5 || h >= 22) return "late-night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

/** Resolve the delta-band bucket from today vs last composites. */
export function deltaBandFor(
  today: number | null,
  last: number | null,
): VoiceCtx["deltaBand"] {
  if (today == null) return "flat";
  if (last == null) return "first-ever";
  const d = today - last;
  if (d >= 15) return "breakthrough";
  if (d >= 4) return "improvement";
  if (d <= -8) return "regression";
  return "flat";
}

/** Resolve the score band for a composite 0-100. */
export function scoreBandKeyFor(score: number | null): VoiceCtx["band"] {
  if (score == null) return "ok";
  if (score < 35) return "poor";
  if (score < 55) return "below";
  if (score < 75) return "ok";
  if (score < 90) return "strong";
  return "excellent";
}
