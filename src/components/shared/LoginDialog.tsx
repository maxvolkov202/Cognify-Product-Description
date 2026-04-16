"use client";

import { Suspense, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  trigger?: React.ReactNode;
  triggerClassName?: string;
};

function DialogInner({ trigger, triggerClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const params = useSearchParams();
  const next = params.get("next");

  useEffect(() => {
    if (params.get("login") === "1") setOpen(true);
  }, [params]);

  const handleGoogle = async () => {
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const callbackUrl = next ?? "/dashboard";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(callbackUrl)}`,
      },
    });
    if (error) setSubmitting(false);
  };

  const triggerEl = trigger ?? (
    <button
      type="button"
      className={cn(
        "text-sm font-medium text-ink-700 transition-colors hover:text-ink-900",
        triggerClassName,
      )}
    >
      Log in
    </button>
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{triggerEl}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-950/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-ink-200 bg-white p-8 shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <Dialog.Close asChild>
            <button
              type="button"
              className="absolute right-4 top-4 rounded-full p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </Dialog.Close>

          <div className="flex flex-col items-center text-center">
            <div className="brand-gradient grid size-14 place-items-center rounded-2xl shadow-[0_12px_40px_-8px_rgba(151,136,255,0.55)]">
              <BrainDumbbell className="size-8 text-[#fdf7e4]" />
            </div>
            <Dialog.Title className="mt-5 text-2xl font-extrabold tracking-tight text-ink-900">
              Welcome to Cognify
            </Dialog.Title>
            <Dialog.Description className="mt-2 max-w-xs text-sm leading-relaxed text-ink-600">
              Sign in to train, track progress, and run reps.
            </Dialog.Description>

            <div className="mt-8 w-full space-y-3">
              <button
                type="button"
                onClick={handleGoogle}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-3 rounded-full border border-ink-200 bg-white px-5 py-3.5 text-sm font-semibold text-ink-900 transition-all hover:border-ink-300 hover:bg-ink-50 disabled:opacity-60"
              >
                <GoogleG className="size-[18px]" />
                {submitting ? "Redirecting to Google…" : "Continue with Google"}
              </button>
            </div>

            <p className="mt-6 text-xs leading-relaxed text-ink-500">
              By continuing, you agree to Cognify&rsquo;s{" "}
              <a href="/terms" className="underline-offset-2 hover:underline">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" className="underline-offset-2 hover:underline">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function LoginDialog(props: Props) {
  return (
    <Suspense fallback={null}>
      <DialogInner {...props} />
    </Suspense>
  );
}

function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC04"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function BrainDumbbell({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M7.2 7.4c-1.1 0-2 1-2 2.2 0 .6.2 1 .6 1.4-.6.4-1 1-1 1.8 0 1.4 1 2.4 2.4 2.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M16.8 7.4c1.1 0 2 1 2 2.2 0 .6-.2 1-.6 1.4.6.4 1 1 1 1.8 0 1.4-1 2.4-2.4 2.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M9 6.8c.8-1 1.8-1.4 2.8-1.4s2 .4 2.8 1.4M9 17.2c.8 1 1.8 1.4 2.8 1.4s2-.4 2.8-1.4M11.9 5.4v13.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <rect x="9" y="11" width="6" height="2.4" rx="0.4" fill="currentColor" />
      <rect x="8" y="10" width="1" height="4.4" rx="0.3" fill="currentColor" />
      <rect x="15" y="10" width="1" height="4.4" rx="0.3" fill="currentColor" />
    </svg>
  );
}
