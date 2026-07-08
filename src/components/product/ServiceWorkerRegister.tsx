"use client";

// Phase D — Service worker registration. Mounted from the (app) layout
// so authenticated app pages install the SW the first time they load.
// Marketing pages are intentionally not in scope — keeps the offline
// shell focused on the workout flow and avoids SW-cache surprises on
// the homepage.
//
// Dev short-circuits because next.config disables Serwist when
// NODE_ENV=development. We still guard here so a leftover SW from a
// prior production preview doesn't pollute dev.

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => {
        // Failure is non-fatal — the app still works without offline
        // support. Log so we notice if it's failing for everyone.
        console.warn("[sw] registration failed:", err);
      });
  }, []);

  return null;
}
