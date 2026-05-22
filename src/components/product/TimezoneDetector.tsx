"use client";

// Detects the browser's IANA timezone and posts it to PATCH /api/me/tz.
// Runs once per session (sessionStorage gate). Silent on failure — TZ
// capture is best-effort and the cron defaults to UTC on missing data.
//
// Mounted from src/app/(app)/layout.tsx. Only renders for authenticated
// or guest users (the layout already gates the (app) tree on session).

import { useEffect } from "react";

const SESSION_KEY = "cognify.tz.synced";

export default function TimezoneDetector() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.sessionStorage.getItem(SESSION_KEY) === "1") return;
    } catch {
      // sessionStorage blocked (Safari private, etc.) — still try once.
    }

    let tz: string;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!tz) return;

    const controller = new AbortController();
    fetch("/api/me/tz", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tz }),
      signal: controller.signal,
      credentials: "same-origin",
    })
      .then((res) => {
        if (res.ok) {
          try {
            window.sessionStorage.setItem(SESSION_KEY, "1");
          } catch {}
        }
      })
      .catch(() => {
        // Network/abort — try again next session.
      });

    return () => controller.abort();
  }, []);

  return null;
}
