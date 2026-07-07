export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// ── Phase 15 (P-1) — "the fallback is the lie" countermeasure ───────────
//
// safeDb's graceful degradation is right for READS (a missing streak
// number beats a 500), but on WRITE paths it manufactured synthetic
// success: F-4 shipped because every failed rep insert quietly became a
// random-UUID "rep" and the flagship loop kept "working" with zero
// persistence. Labeled writes make that class LOUD without giving up
// degradation in production:
//
//   safeDb(op, fallback, { write: "rep_persist" })
//
//   • log.error-shaped structured line (grep: event=db.write_failed)
//   • in-memory failure counter per label, surfaced via /api/health
//     (a DB-side ledger can't record "the DB is down" — that's why
//     this lives in process memory)
//   • outside production: THROW instead of returning the fallback —
//     F-3/F-4 would have been un-shippable, not silent
//
// Reads keep the original contract untouched.

export type SafeDbOptions = {
  /** Mark this operation as a WRITE whose silent failure means data
   *  loss. The label names the write family in logs + health counters. */
  write?: string;
};

const writeFailureCounts = new Map<string, number>();
let lastWriteFailure: { label: string; at: string; message: string } | null =
  null;

/** Snapshot for /api/health — counters since process start. */
export function getDbWriteFailureStats(): {
  counts: Record<string, number>;
  total: number;
  last: { label: string; at: string; message: string } | null;
} {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const [label, n] of writeFailureCounts) {
    counts[label] = n;
    total += n;
  }
  return { counts, total, last: lastWriteFailure };
}

export async function safeDb<T>(
  operation: () => Promise<T>,
  fallback: T,
  options?: SafeDbOptions,
): Promise<T> {
  if (!hasDatabase()) return fallback;
  try {
    return await operation();
  } catch (error) {
    if (options?.write) {
      const label = options.write;
      writeFailureCounts.set(label, (writeFailureCounts.get(label) ?? 0) + 1);
      const message = error instanceof Error ? error.message : String(error);
      lastWriteFailure = {
        label,
        at: new Date().toISOString(),
        message: message.slice(0, 300),
      };
      console.error(
        JSON.stringify({
          level: "error",
          event: "db.write_failed",
          label,
          count: writeFailureCounts.get(label),
          message: message.slice(0, 300),
          ts: lastWriteFailure.at,
        }),
      );
      if (process.env.NODE_ENV !== "production") {
        // Dev/preview/test: a lost write is a bug, not a degradation.
        throw error;
      }
      return fallback;
    }
    console.error("[db] operation failed — returning fallback", error);
    return fallback;
  }
}

export function hasAnthropic(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function hasDeepgram(): boolean {
  return Boolean(process.env.DEEPGRAM_API_KEY);
}

export function hasAudioStorage(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
