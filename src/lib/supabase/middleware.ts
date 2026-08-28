import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { withTimeout } from "@/lib/util/with-timeout";

/** Grading plan 1b — budget for the auth refresh. On 2026-08-28 a stalled
 *  Supabase Auth call held every request in middleware until Vercel killed
 *  it (504 MIDDLEWARE_INVOCATION_TIMEOUT), freezing a user mid-rep. A
 *  refresh that does not answer in this window is skipped for this
 *  request; the existing cookies still carry a valid session for the
 *  page, and the next request tries again. */
const AUTH_REFRESH_TIMEOUT_MS = (() => {
  const n = parseInt(process.env.MIDDLEWARE_AUTH_REFRESH_TIMEOUT_MS ?? "", 10);
  // Guard the trailing-newline / empty-value env gotcha: NaN or <= 0 would
  // make setTimeout fire immediately and silently disable every refresh.
  return Number.isFinite(n) && n > 0 ? n : 2500;
})();

/**
 * Refresh the Supabase auth session on every request. Without this call
 * the JWT won't rotate and sessions eventually expire mid-use.
 * Pattern from https://supabase.com/docs/guides/auth/server-side/nextjs.
 */
export async function updateSupabaseSession(
  request: NextRequest,
): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  // If Supabase isn't configured (dev without creds), skip silently.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      // 1b — abort the underlying Auth request at the budget, not just the
      // await. An orphaned refresh that completes server-side after we
      // stopped waiting rotates the refresh token without the browser ever
      // receiving the new cookies, and the next request then trips
      // refresh-token reuse detection (forced logout). Cancelling the
      // fetch keeps the rotation from happening at all in the common
      // (never-reached / never-answered) case.
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: AbortSignal.timeout(AUTH_REFRESH_TIMEOUT_MS),
          }),
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touching getUser() triggers the auth cookie refresh if needed.
  // Don't do anything else between createServerClient and getUser() —
  // that's the window where session tokens are refreshed.
  // Bounded (1b): a stalled Auth call must not hold the request. On
  // timeout/error we return the pass-through response; setAll may have
  // already replaced `response` with the refreshed-cookie version, and
  // that is fine either way.
  // Outer belt over the fetch-level abort: a small grace so the client's
  // own abort error surfaces as `{ error }` first.
  const outcome = await withTimeout(
    supabase.auth.getUser(),
    AUTH_REFRESH_TIMEOUT_MS + 500,
    () => null,
  );
  // supabase-js reports network / refresh failures as a RESOLVED
  // `{ data, error }` (AuthRetryableFetchError etc.), not a rejection —
  // inspect both shapes so a failing Auth backend is visible in logs.
  const resolvedError =
    outcome.kind === "resolved" ? (outcome.value?.error ?? null) : null;
  const skipped = outcome.kind !== "resolved" || resolvedError != null;
  if (skipped) {
    const err =
      outcome.kind === "error" ? outcome.error : (resolvedError as unknown);
    // Expected when the session cookie is simply absent (guest); only
    // network / server failures are worth a log line.
    const msg = err instanceof Error ? err.message : String(err ?? "");
    const isMissingSession = /session missing|Auth session missing/i.test(msg);
    if (!isMissingSession) {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "middleware.auth_refresh_skipped",
          reason: outcome.kind === "resolved" ? "auth_error" : outcome.kind,
          budgetMs: AUTH_REFRESH_TIMEOUT_MS,
          path: request.nextUrl.pathname,
          error: msg.slice(0, 200),
        }),
      );
    }
  }

  return response;
}
