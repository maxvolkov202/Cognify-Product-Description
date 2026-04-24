"use client";

import { useState } from "react";
import { Printer, FileDown, Loader2 } from "lucide-react";

/**
 * Two-action export row: Print-preview (browser native) + Download PDF
 * (server-side @react-pdf/renderer). The print path works offline with
 * no server round-trip; the PDF path gives a durable artifact suitable
 * for enterprise reporting / audit.
 */
export function PrintButton() {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/report/pdf");
      if (!res.ok) throw new Error(`PDF download failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cognify-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[report] PDF download failed:", err);
      alert("Couldn't generate the PDF. Try again, or use Print → Save as PDF.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 hover:border-ink-300 hover:text-ink-900"
      >
        <Printer className="size-3.5" strokeWidth={2.5} />
        Print preview
      </button>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="brand-gradient inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        {downloading ? (
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
        ) : (
          <FileDown className="size-3.5" strokeWidth={2.5} />
        )}
        {downloading ? "Building PDF…" : "Download PDF"}
      </button>
    </div>
  );
}
