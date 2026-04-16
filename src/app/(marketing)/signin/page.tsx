"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function SignInInner() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
  const error = params.get("error");

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"google" | "email" | null>(null);

  const handleGoogle = async () => {
    setSubmitting("google");
    setFormError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(callbackUrl)}`,
      },
    });
    if (oauthError) {
      setFormError(oauthError.message);
      setSubmitting(null);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting("email");
    setFormError(null);
    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(callbackUrl)}`,
        },
      });
      if (signUpError) {
        setFormError(signUpError.message);
        setSubmitting(null);
        return;
      }
      // If email confirmation is required, Supabase sends a magic link and
      // returns no session. If it's disabled, user is signed in immediately.
      router.push(callbackUrl);
      router.refresh();
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setFormError(signInError.message);
        setSubmitting(null);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Link
            href="/"
            className="brand-gradient grid size-16 place-items-center rounded-2xl shadow-[0_12px_40px_-8px_rgba(151,136,255,0.55)]"
          >
            <BrainDumbbell className="size-9 text-[#fdf7e4]" />
          </Link>

          <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink-900">
            {mode === "signup" ? "Create your account" : "Sign in to Cognify"}
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            Train your communication. Track your progress. Get real feedback.
          </p>

          {(error || formError) && (
            <div className="mt-4 w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              {formError ?? error}
            </div>
          )}

          <div className="mt-8 w-full space-y-3">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={submitting !== null}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-ink-200 bg-white px-5 py-3.5 text-sm font-semibold text-ink-900 shadow-sm transition-all hover:border-ink-300 hover:bg-ink-50 disabled:opacity-60"
            >
              <GoogleG className="size-[18px]" />
              {submitting === "google"
                ? "Redirecting to Google…"
                : "Continue with Google"}
            </button>
          </div>

          <div className="mt-6 flex items-center gap-3 text-ink-300 w-full">
            <div className="h-px flex-1 bg-ink-200" />
            <span className="text-xs">or</span>
            <div className="h-px flex-1 bg-ink-200" />
          </div>

          <form onSubmit={handleEmail} className="mt-6 w-full space-y-3 text-left">
            <div>
              <label htmlFor="email" className="text-xs font-semibold text-ink-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-brand-purple focus:outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-xs font-semibold text-ink-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-brand-purple focus:outline-none"
                placeholder={mode === "signup" ? "At least 8 characters" : ""}
              />
            </div>
            <button
              type="submit"
              disabled={submitting !== null}
              className="brand-gradient w-full rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-95 disabled:opacity-60"
            >
              {submitting === "email"
                ? mode === "signup"
                  ? "Creating account…"
                  : "Signing in…"
                : mode === "signup"
                  ? "Create account"
                  : "Sign in with email"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setFormError(null);
            }}
            className="mt-3 text-xs text-ink-500 hover:text-ink-700"
          >
            {mode === "signin"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>

          <Link
            href="/dashboard"
            className="mt-4 w-full rounded-full border border-ink-200 px-5 py-3 text-center text-sm font-semibold text-ink-700 transition-all hover:bg-ink-50"
          >
            Continue as guest
          </Link>

          <p className="mt-8 text-xs text-ink-500">
            By continuing, you agree to Cognify&rsquo;s{" "}
            <Link href="/terms" className="underline-offset-2 hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline-offset-2 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInInner />
    </Suspense>
  );
}

function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC04" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function BrainDumbbell({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M7.2 7.4c-1.1 0-2 1-2 2.2 0 .6.2 1 .6 1.4-.6.4-1 1-1 1.8 0 1.4 1 2.4 2.4 2.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M16.8 7.4c1.1 0 2 1 2 2.2 0 .6-.2 1-.6 1.4.6.4 1 1 1 1.8 0 1.4-1 2.4-2.4 2.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9 6.8c.8-1 1.8-1.4 2.8-1.4s2 .4 2.8 1.4M9 17.2c.8 1 1.8 1.4 2.8 1.4s2-.4 2.8-1.4M11.9 5.4v13.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="9" y="11" width="6" height="2.4" rx="0.4" fill="currentColor" />
      <rect x="8" y="10" width="1" height="4.4" rx="0.3" fill="currentColor" />
      <rect x="15" y="10" width="1" height="4.4" rx="0.3" fill="currentColor" />
    </svg>
  );
}
