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
 * Set the session-storage preference BEFORE sign-in. When
 * rememberMe=false, Supabase persists the session in sessionStorage so
 * it's cleared when the browser tab closes. When true (default),
 * sessions persist across browser restarts via localStorage.
 *
 * Must be called before createSupabaseBrowserClient() creates the
 * singleton — i.e., in the same click handler that triggers sign-in.
 */
export function setRememberMePreference(rememberMe: boolean): void {
  if (typeof window === "undefined") return;
  // Reset cached client so the next call builds with the new storage.
  cached = null;
  // Supabase reads a prefix-prefixed key from storage (sb-<ref>-auth-token).
  // We swap the storage backend by seeding one client with the right adapter.
  const storage: Storage = rememberMe
    ? window.localStorage
    : window.sessionStorage;
  cached = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: {
          getItem: (key) => storage.getItem(key),
          setItem: (key, value) => storage.setItem(key, value),
          removeItem: (key) => storage.removeItem(key),
        },
      },
    },
  );
}
