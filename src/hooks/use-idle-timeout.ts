"use client";

// Generic idle-timeout hook.
//
// Fires `onIdle` when no qualifying interaction event has occurred for
// `timeoutMs`. Watches keydown / pointer / touch / scroll on
// `document`. Each interaction resets the timer.
//
// Used by Phase 6's PromptPicker to auto-pick after 15s. Generic enough
// for future "are you still there?" prompts or pause-resume idle
// detection.

import { useEffect, useRef } from "react";

type Options = {
  /** Milliseconds until onIdle fires after the last interaction. */
  timeoutMs: number;
  /** Called when the timeout fires. */
  onIdle: () => void;
  /** Optional gate — when false, the hook stops watching + cancels its
   *  timer. Defaults to true. */
  enabled?: boolean;
};

const INTERACTION_EVENTS = [
  "keydown",
  "pointerdown",
  "touchstart",
  "wheel",
  "scroll",
] as const;

export function useIdleTimeout({ timeoutMs, onIdle, enabled = true }: Options) {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    function reset() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => onIdleRef.current(), timeoutMs);
    }

    function handle() {
      reset();
    }

    reset();
    for (const ev of INTERACTION_EVENTS) {
      document.addEventListener(ev, handle, { passive: true });
    }
    return () => {
      if (timer) clearTimeout(timer);
      for (const ev of INTERACTION_EVENTS) {
        document.removeEventListener(ev, handle);
      }
    };
  }, [timeoutMs, enabled]);
}
