"use client";

// Reduced-motion fallback for the Mascot. Renders the character at the
// correct station X for the current state but skips all motion-variant
// driven movement — only an opacity cross-fade on state transitions.
//
// Required for Lighthouse a11y + WCAG: prefers-reduced-motion is a
// hard requirement, not a polish item. The Mascot wrapper hot-swaps
// to this implementation when the media query matches.

import { AnimatePresence, motion } from "motion/react";
import { useId } from "react";
import type { MascotState } from "@/lib/animations/mascot-state";
import { MASCOT_ARIA_LABELS, MASCOT_TIMINGS } from "@/lib/animations/mascot-state";
import type { MuscleGroupId } from "@/types/domain";
import { stationXForIndex } from "./variants";
import MascotCharacter from "./MascotCharacter";

export type MascotFallbackProps = {
  state: MascotState;
  targetStationIndex: number;
  totalStations?: number;
  dim?: MuscleGroupId | null;
  onTap?: () => void;
};

export default function MascotFallback({
  state,
  targetStationIndex,
  totalStations = 4,
  dim,
  onTap,
}: MascotFallbackProps) {
  const liveRegionId = useId();
  const x = stationXForIndex(targetStationIndex, totalStations);
  const label = MASCOT_ARIA_LABELS[state];

  return (
    <div
      data-mascot-mode="reduced-motion"
      className="relative inline-flex items-center justify-center"
    >
      {/* ARIA live region — same contract as the animated wrapper. */}
      <div
        id={liveRegionId}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {label}
      </div>

      {/* Outer translation is instant; only the swap fades. */}
      <div
        style={{
          transform: `translateX(${x}px)`,
          transition: "transform 0s",
        }}
        onClick={onTap}
        onKeyDown={(e) => {
          if (onTap && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onTap();
          }
        }}
        role={onTap ? "button" : undefined}
        tabIndex={onTap ? 0 : undefined}
        aria-label={onTap ? "Tap mascot" : undefined}
        className="select-none"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={state}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: MASCOT_TIMINGS.reduced_motion_crossfade_ms / 1000,
            }}
          >
            <MascotCharacter
              dim={dim}
              width={120}
              height={160}
              className="block"
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
