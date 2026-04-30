"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X } from "lucide-react";
import { DIMENSION_LABELS } from "@/types/domain";
import type { Exemplar } from "@/lib/ai/exemplars";

type Props = {
  open: boolean;
  exemplar: Exemplar | null;
  onClose: () => void;
};

/**
 * "See example" modal surfaced from NextRepFocusCard. Shows a curated
 * spoken model — concrete topic, line-by-line beats the user can scan,
 * one tip on what makes the example actually train the dimension.
 *
 * Renders nothing when `exemplar === null` (we've not curated one for
 * this dimension/archetype combo yet) — caller suppresses the link in
 * that case so the user doesn't open an empty modal.
 *
 * Keyboard: Escape closes. Click on the backdrop closes. The card
 * itself swallows clicks so the user can select text without dismissing.
 */
export function ExemplarModal({ open, exemplar, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && exemplar && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Example response"
        >
          <div
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.div
            className="relative w-full max-w-xl"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 380,
              damping: 28,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="rounded-2xl p-[1.5px]"
              style={{
                backgroundImage:
                  "linear-gradient(110deg, var(--color-brand-blue), var(--color-brand-lavender), var(--color-brand-purple), var(--color-brand-magenta))",
              }}
            >
              <div className="rounded-[14px] bg-white p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="brand-gradient grid size-9 shrink-0 place-items-center rounded-xl shadow-[var(--shadow-glow)]">
                      <Sparkles
                        className="size-4 text-white"
                        strokeWidth={2.5}
                        aria-hidden="true"
                      />
                    </span>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand-purple">
                        Example —{" "}
                        {DIMENSION_LABELS[exemplar.dimension].toUpperCase()}
                      </p>
                      <h3 className="mt-0.5 text-[15px] font-extrabold text-ink-900">
                        {exemplar.topic}
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                    aria-label="Close"
                  >
                    <X className="size-4" strokeWidth={2.5} />
                  </button>
                </div>
                <ol className="mt-4 space-y-2">
                  {exemplar.lines.map((line, i) => (
                    <li
                      key={i}
                      className="flex gap-3 rounded-xl border border-ink-100 bg-ink-50 px-3 py-2.5"
                    >
                      <span className="mt-0.5 text-[11px] font-bold tabular-nums text-brand-purple">
                        {i + 1}
                      </span>
                      <p className="text-[13px] leading-relaxed text-ink-800">
                        {line}
                      </p>
                    </li>
                  ))}
                </ol>
                <div className="mt-4 rounded-xl border border-brand-purple/20 bg-brand-purple/5 px-3 py-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-brand-purple">
                    What to listen for
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-700">
                    {exemplar.tip}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
