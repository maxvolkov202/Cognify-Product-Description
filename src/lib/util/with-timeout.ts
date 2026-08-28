/**
 * Grading plan 1b — bound an await with a wall-clock budget.
 *
 * Resolves with `fallback()` when `promise` has not settled within
 * `timeoutMs` (or when it rejects), and reports which happened so the
 * caller can log it. Never throws. The original promise is not cancelled;
 * it is simply no longer awaited.
 */
export type TimeoutOutcome<T> =
  | { kind: "resolved"; value: T }
  | { kind: "timeout"; value: T }
  | { kind: "error"; value: T; error: unknown };

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: () => T,
): Promise<TimeoutOutcome<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<TimeoutOutcome<T>>((resolve) => {
    timer = setTimeout(
      () => resolve({ kind: "timeout", value: fallback() }),
      timeoutMs,
    );
  });
  const wrapped: Promise<TimeoutOutcome<T>> = promise.then(
    (value) => ({ kind: "resolved", value }),
    (error: unknown) => ({ kind: "error", value: fallback(), error }),
  );
  try {
    return await Promise.race([wrapped, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
