"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Standard Chromium `beforeinstallprompt` event shape. Exported as the
 * narrow type we need — the browser also fires it with additional
 * properties we don't care about.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type Props = {
  /** Minimum completed reps before we surface the prompt. Default 3 —
   *  users earn the ask rather than being pestered on day one. */
  minReps?: number;
  /** Days to suppress the prompt after a user dismisses. Default 14. */
  dismissCooldownDays?: number;
};

const REP_COUNT_KEY = "cognify_completed_reps_v1";
const DISMISS_KEY = "cognify_install_dismissed_at_v1";

/**
 * WS-8: PWA install prompt. Listens for the Chromium
 * `beforeinstallprompt` event, stashes it, and surfaces a subtle
 * bottom-of-screen CTA once the user has completed enough reps to
 * have a reason to install (default 3). Dismissal writes a timestamp
 * to localStorage that suppresses the ask for 14 days.
 *
 * iOS Safari doesn't support `beforeinstallprompt` — for iOS we fall
 * back to a brief "Add to Home Screen via Share" instruction when the
 * same gate trips and we detect iOS without a deferred prompt.
 *
 * This component renders nothing until the gate fires. It's safe to
 * mount once in the app layout.
 */
export function InstallPrompt({
  minReps = 3,
  dismissCooldownDays = 14,
}: Props) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [visible, setVisible] = useState(false);
  const [iosFallback, setIosFallback] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function checkGate() {
      const completed = readRepCount();
      if (completed < minReps) return false;
      const dismissedAt = readDismissedAt();
      if (dismissedAt) {
        const days = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
        if (days < dismissCooldownDays) return false;
      }
      // Already installed? Chromium exposes window.matchMedia for this.
      try {
        if (window.matchMedia("(display-mode: standalone)").matches) {
          return false;
        }
      } catch {
        // noop — feature detection failure is fine
      }
      return true;
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      const evt = e as BeforeInstallPromptEvent;
      setDeferred(evt);
      if (checkGate()) setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    // iOS fallback: beforeinstallprompt never fires. Detect iOS Safari
    // that isn't already in standalone mode and show a manual
    // "Add to Home Screen" nudge if the rep gate is passed.
    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    const isStandalone = window.navigator.standalone === true;
    if (isIOS && !isStandalone && checkGate()) {
      setIosFallback(true);
      setVisible(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, [minReps, dismissCooldownDays]);

  async function handleInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
      // Clear deferred prompt — it's single-use
      setDeferred(null);
    } else {
      // Treat decline same as dismiss
      handleDismiss();
    }
  }

  function handleDismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // noop
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="complementary"
      aria-label="Install Cognify to your home screen"
      className={cn(
        "fixed inset-x-4 bottom-20 z-40 md:bottom-6 md:left-auto md:right-6 md:max-w-sm",
        "surface-card flex items-start gap-3 p-4",
        "animate-in fade-in slide-in-from-bottom-3 duration-300 motion-reduce:animate-none",
      )}
    >
      <div
        className="brand-gradient grid size-10 shrink-0 place-items-center rounded-xl shadow-sm"
        aria-hidden="true"
      >
        <Download className="size-5 text-white" strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand-purple dark:text-brand-lavender">
          Install Cognify
        </p>
        <p className="mt-0.5 text-sm font-semibold text-ink-900 dark:text-white">
          1-tap start from your home screen.
        </p>
        {iosFallback ? (
          <p className="mt-1 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
            Tap the <strong>Share</strong> button in Safari, then{" "}
            <strong>Add to Home Screen</strong>.
          </p>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
            No app store. No account setup. Opens straight into your daily
            workout.
          </p>
        )}
        {!iosFallback && (
          <button
            type="button"
            onClick={handleInstall}
            disabled={!deferred}
            className="brand-gradient mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
          >
            <Download className="size-3.5" strokeWidth={2.5} />
            Install
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss install prompt"
        className="ml-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 dark:text-ink-500 dark:hover:bg-ink-800 dark:hover:text-ink-200"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Helper: call this from wherever a rep is marked complete (e.g.
 * WorkoutSession.handleNext, RepSurface onComplete) to bump the rep
 * counter the install-prompt gate reads.
 */
export function bumpCompletedRepCount(): void {
  if (typeof window === "undefined") return;
  try {
    const current = readRepCount();
    window.localStorage.setItem(REP_COUNT_KEY, String(current + 1));
  } catch {
    // noop — localStorage unavailable is non-fatal
  }
}

function readRepCount(): number {
  try {
    const raw = window.localStorage.getItem(REP_COUNT_KEY);
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function readDismissedAt(): number | null {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
