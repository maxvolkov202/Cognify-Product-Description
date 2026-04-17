"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Supabase client for Client Components. Singleton per-tab. Reads the
 * anon key from NEXT_PUBLIC_* envs (safe to ship to the browser).
 * For realtime subscriptions, auth state listeners, and user-scoped
 * queries that respect RLS.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  if (cached) return cached;
  cached = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return cached;
}

/**
 * Placeholder for future remember-me behavior. Currently a no-op
 * because swapping the Supabase storage adapter mid-flow caused
 * transient [object Event] errors after sign-in. Default Supabase
 * behavior (cookie-based persistent sessions via @supabase/ssr) is
 * already "remember me" — sessions survive browser restarts.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function setRememberMePreference(_rememberMe: boolean): void {
  // no-op — Supabase SSR cookies persist by default
}
