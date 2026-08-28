/**
 * Grading plan 1b — `AbortSignal.timeout` with a fallback for browsers
 * that predate it (Safari/iOS < 16, Chrome < 103). Client-safe; no env.
 */
export function timeoutSignal(ms: number): AbortSignal {
  const AS = AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal };
  if (typeof AS.timeout === "function") return AS.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException("signal timed out", "TimeoutError")), ms);
  return controller.signal;
}

/** True for the abort raised by `timeoutSignal` (both implementations). */
export function isTimeoutAbort(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "TimeoutError" || err.name === "AbortError")
  );
}
