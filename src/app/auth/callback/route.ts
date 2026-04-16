import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * OAuth + email confirmation callback.
 *
 * Supabase redirects back here with a `code` (OAuth) or a tokenized link
 * (email confirm/magic). We exchange it for a session (which sets the
 * auth cookies), then redirect to `next` (default: /dashboard).
 *
 * Guest promotion happens lazily on the next call to currentUser() —
 * it reads the guest cookie, finds the now-authenticated Supabase user,
 * and links them together in cognify_v2.users.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    const msg = url.searchParams.get("error_description") ?? errorParam;
    return NextResponse.redirect(
      new URL(`/signin?error=${encodeURIComponent(msg)}`, request.url),
    );
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(
          `/signin?error=${encodeURIComponent(error.message)}`,
          request.url,
        ),
      );
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
