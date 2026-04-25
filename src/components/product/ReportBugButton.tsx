"use client";

import { useState } from "react";
import { Bug } from "lucide-react";
import { ReportBugModal } from "./ReportBugModal";

/**
 * Floating "Report a bug" pill mounted in the (app) layout shell. Hidden
 * during recording phases (the rep surface manages a CSS data-attribute on
 * the document root that we read via a media query equivalent — for v1
 * the button is always visible inside (app); recording-phase suppression
 * is a follow-up if it proves distracting).
 */
export function ReportBugButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-3 py-2 text-[11px] font-bold text-white shadow-[0_10px_30px_-10px_rgba(20,20,40,0.6)] transition-all hover:scale-[1.03] hover:bg-ink-800 active:scale-[0.97] md:bottom-6 md:right-6 md:px-4 md:py-2.5 md:text-xs"
        aria-label="Report a bug"
      >
        <Bug className="size-3.5" strokeWidth={2.5} />
        <span className="hidden sm:inline">Report a bug</span>
      </button>
      {open && <ReportBugModal onClose={() => setOpen(false)} />}
    </>
  );
}
