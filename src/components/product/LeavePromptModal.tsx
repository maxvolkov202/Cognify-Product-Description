"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Save, Trash2, X } from "lucide-react";
import { useSettingsDirty } from "./SettingsDirtyContext";

/**
 * Cognify-themed "save your preferences before you leave?" modal. Mounted
 * once at the layout level; opens automatically whenever the dirty
 * context has a pending navigation request.
 */
export function LeavePromptModal() {
  const ctx = useSettingsDirty();

  useEffect(() => {
    if (!ctx?.pending) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [ctx?.pending]);

  if (!ctx) return null;

  return (
    <AnimatePresence>
      {ctx.pending && (
        <motion.div
          key="leave-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[120] flex items-end justify-center bg-ink-900/50 p-3 backdrop-blur-sm md:items-center md:p-6"
          onClick={() => ctx.resolvePending("stay")}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="leave-title"
            initial={{ y: 24, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 12, opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-[0_24px_80px_-30px_rgba(20,20,40,0.5)] dark:border-ink-700 dark:bg-ink-900"
          >
            <div className="relative overflow-hidden">
              <div className="brand-gradient absolute inset-0" aria-hidden="true" />
              <div className="relative flex items-start justify-between gap-3 p-5 text-white">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-white/80">
                    Unsaved changes
                  </p>
                  <h2
                    id="leave-title"
                    className="mt-1 text-xl font-extrabold tracking-tight"
                  >
                    Save your preferences before you leave?
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => ctx.resolvePending("stay")}
                  className="grid size-8 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
                  aria-label="Stay on this page"
                >
                  <X className="size-4" strokeWidth={2.5} />
                </button>
              </div>
            </div>

            <div className="p-5 md:p-6">
              <p className="text-sm text-ink-600 dark:text-ink-300">
                You changed some settings but haven&rsquo;t saved them yet.
                Save now and continue, or discard and walk away.
              </p>

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => ctx.resolvePending("stay")}
                  className="rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:border-ink-600 dark:hover:bg-ink-800"
                >
                  Stay here
                </button>
                <button
                  type="button"
                  onClick={() => ctx.resolvePending("discard")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25"
                >
                  <Trash2 className="size-3.5" strokeWidth={2.5} />
                  Discard &amp; continue
                </button>
                <button
                  type="button"
                  onClick={() => ctx.resolvePending("save")}
                  className="brand-gradient inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2 text-sm font-bold text-white shadow-sm"
                >
                  <Save className="size-3.5" strokeWidth={2.5} />
                  Save &amp; continue
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
