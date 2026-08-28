import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { withTimeout } from "@/lib/util/with-timeout";

/** Grading plan 1b — budget for the auth refresh. On 2026-08-28 a stalled
 *  Supabase Auth call held every request in middleware until Vercel killed
 *  it (504 MIDDLEWARE_INVOCATION_TIMEOUT), freezing a user mid-rep. A
 *  refresh that does not answer in this window is skipped for this
 *  request; the existing cookies still carry a valid session for the
 *  page, and the next request tries again. */
const AUTH_REFRESH_TIMEOUT_MS = parseInt(
  process.env.MIDDLEWARE_AUTH_REFRESH_TIMEOUT_MS ?? "2500",
  10,
);

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
  const outcome = await withTimeout(
    supabase.auth.getUser(),
    AUTH_REFRESH_TIMEOUT_MS,
    () => null,
  );
  if (outcome.kind !== "resolved") {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "middleware.auth_refresh_skipped",
        reason: outcome.kind,
        budgetMs: AUTH_REFRESH_TIMEOUT_MS,
        path: request.nextUrl.pathname,
        ...(outcome.kind === "error"
          ? {
              error:
                outcome.error instanceof Error
                  ? outcome.error.message.slice(0, 200)
                  : String(outcome.error).slice(0, 200),
            }
          : {}),
      }),
    );
  }

  return response;
}
