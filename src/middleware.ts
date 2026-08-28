import { type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

const GUEST_COOKIE = "cognify_guest_id";
const GUEST_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function middleware(req: NextRequest) {
  // Refresh Supabase auth session (safe no-op if creds missing)
  const response = await updateSupabaseSession(req);

  // Keep guest cookie for unauthenticated users — our users table keys on
  // this cookie for pre-auth data, and guest promotion links the row to
  // auth.users via users.auth_user_id at sign-in time.
  if (!req.cookies.get(GUEST_COOKIE)) {
    const id = crypto.randomUUID();
    response.cookies.set(GUEST_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: GUEST_COOKIE_MAX_AGE,
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Grading plan 1b — every route under /api resolves its own identity
    // (currentUser() reads the cookies directly and Route Handlers can
    // persist a refreshed session themselves; cron / internal routes use
    // secret headers), so none of them should wait on the auth refresh: a
    // stalled refresh here is what froze a rep mid-flight on 2026-08-28.
    // Page loads and server actions still pass through the (bounded)
    // refresh, so tokens keep rotating.
    "/((?!_next/static|_next/image|favicon.ico|logo/|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
