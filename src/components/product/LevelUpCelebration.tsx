"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X } from "lucide-react";
import { bandForLevel } from "@/lib/progression/levels";
import { cn } from "@/lib/utils/cn";

type Props = {
  /** When set, the celebration is visible. Pass null to hide. */
  levelUp: { previousLevel: number; newLevel: number } | null;
  onDismiss: () => void;
};

const AUTO_DISMISS_MS = 4500;

/**
 * DNA Ch.7 — full-screen takeover when the user crosses a level
 * threshold. Auto-dismisses after ~4.5s (or on user click). Renders the
 * level transition + the new band name + a subtle sparkle motion.
 *
 * Should be mounted at the layout level so any rep submission can
 * trigger it; caller passes the AwardXpResult.leveledUp signal.
 */
export function LevelUpCelebration({ levelUp, onDismiss }: Props) {
  useEffect(() => {
    if (!levelUp) return;
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [levelUp, onDismiss]);

  const newBand = levelUp ? bandForLevel(levelUp.newLevel) : null;
  const previousBand = levelUp ? bandForLevel(levelUp.previousLevel) : null;
  const bandPromoted = !!(
    levelUp &&
    newBand &&
    previousBand &&
    newBand.id !== previousBand.id
  );

  return (
    <AnimatePresence>
      {levelUp && newBand && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 grid place-items-center bg-ink-900/70 backdrop-blur-sm"
          onClick={onDismiss}
          role="alertdialog"
          aria-label={`Level up — now level ${levelUp.newLevel}`}
        >
          <motion.div
            initial={{ scale: 0.85, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 22,
            }}
            className={cn(
              "relative w-[min(92vw,440px)] rounded-3xl bg-white p-8 text-center shadow-2xl",
              "border-4 border-transparent",
            )}
            style={{
              backgroundImage:
                "linear-gradient(white, white), linear-gradient(110deg, #6aa3ff, #b39bff, #b072ff, #e77cf0)",
              backgroundOrigin: "border-box",
              backgroundClip: "padding-box, border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="absolute right-3 top-3 grid size-7 place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            >
              <X className="size-4" strokeWidth={2.5} aria-hidden="true" />
            </button>

            <motion.div
              initial={{ scale: 0.4, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: "spring",
                stiffness: 280,
                damping: 14,
                delay: 0.1,
              }}
              className="brand-gradient mx-auto grid size-16 place-items-center rounded-2xl text-white"
            >
              <Sparkles className="size-8" strokeWidth={2.5} aria-hidden="true" />
            </motion.div>

            <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-purple">
              Level up
            </p>
            <p className="mt-2 text-4xl font-extrabold tabular-nums text-ink-900">
              L{levelUp.previousLevel}
              <span className="mx-3 text-ink-400">→</span>
              L{levelUp.newLevel}
            </p>
            {bandPromoted && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.35 }}
                className="brand-gradient-text mt-3 text-lg font-extrabold tracking-tight"
              >
                {newBand.label}
              </motion.p>
            )}
            {!bandPromoted && (
              <p className="mt-3 text-sm font-semibold text-ink-500">
                {newBand.label}
              </p>
            )}

            <p className="mt-5 text-[13px] leading-relaxed text-ink-600">
              {levelUp.newLevel >= 100
                ? "Cognify ceiling reached. The work continues — but the level stops climbing."
                : "The next level got harder. So did you."}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
