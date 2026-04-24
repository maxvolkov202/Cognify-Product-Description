"use client";

import { Printer } from "lucide-react";

/**
 * Triggers the browser's native print dialog. Combined with the
 * `@media print` rules in globals.css, this produces a clean PDF when
 * the user selects "Save as PDF" in the print destination picker.
 *
 * Kept client-only because `window.print()` has no server analog.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="brand-gradient inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white shadow-sm"
    >
      <Printer className="size-3.5" strokeWidth={2.5} />
      Print / Save as PDF
    </button>
  );
}
