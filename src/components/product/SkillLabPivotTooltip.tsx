"use client";

// Phase 11 — one-time onboarding tooltip explaining the Workout/Practice
// split. Dismissal persists via localStorage so it doesn't re-fire.
//
// Persistence: `cognify:skill-lab-pivot-tooltip-dismissed`. When the
// `user_preferences` table lands (post-launch), the dismiss should
// move to the server so it follows the user across devices.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const STORAGE_KEY = "cognify:skill-lab-pivot-tooltip-dismissed";

export default function SkillLabPivotTooltip() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY);
      if (!dismissed) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable (private mode / SSR) — skip the
      // tooltip entirely rather than nag every session.
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    if (process.env.NODE_ENV !== "production") {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          event: "skill_lab_pivot_tooltip_dismissed",
        }),
      );
    }
  }

  if (!visible) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-sky-500/30 bg-sky-500/10",
        "px-4 py-3 mb-4 relative",
      )}
      role="region"
      aria-label="Practice surface explanation"
    >
      <div className="pr-8">
        <h2 className="text-sm font-semibold text-slate-100">
          Welcome to Practice
        </h2>
        <p className="text-xs text-slate-300 mt-1 leading-snug">
          The daily session moved to Workout. Practice (formerly Skill
          Lab) is still here for targeted drills, framework practice,
          and custom reps — pick a dim and rep at your own pace.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className={cn(
          "absolute top-2 right-2 p-1.5 -m-1.5",
          "min-w-[44px] min-h-[44px] flex items-center justify-center",
          "text-sky-200 hover:text-sky-100",
        )}
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
