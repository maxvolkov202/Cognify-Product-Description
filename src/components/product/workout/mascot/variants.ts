// Framer-Motion variants per mascot state.
//
// Variants are split into per-layer maps so the outer Mascot wrapper can
// drive the same `state` keyword across body/legs/arms/head/face without
// each having to know about the others. The wrapper applies these to the
// matching `<motion.g>` wrappers in MascotCharacter (Phase 4 layers).

import type { Variants } from "motion/react";
import type { MascotState } from "@/lib/animations/mascot-state";
import { MASCOT_TIMINGS } from "@/lib/animations/mascot-state";
import type { ScoreBand } from "@/lib/animations/mascot-state";

/** Outer container variants — drives the body's translateX across
 *  stations and minor idle bobs. */
export const containerVariants: Variants = {
  idle: {
    y: 0,
    transition: {
      y: {
        repeat: Infinity,
        repeatType: "reverse",
        duration: MASCOT_TIMINGS.idle_loop_ms / 1000,
        ease: "easeInOut",
      },
    },
  },
  "walking-to-next-station": {
    y: [-1, 1, -1, 1, 0],
    transition: {
      y: {
        duration: MASCOT_TIMINGS.walk_ms / 1000,
        ease: "linear",
      },
    },
  },
  "at-station-recording": {
    y: 0,
    transition: { duration: MASCOT_TIMINGS.at_station_settle_ms / 1000 },
  },
  "at-station-scoring": {
    y: 0,
    transition: { duration: MASCOT_TIMINGS.at_station_settle_ms / 1000 },
  },
  "celebrating-rep": {
    y: [0, -12, 0, -6, 0],
    transition: {
      duration: MASCOT_TIMINGS.celebrate_rep_ms / 1000,
      ease: "easeOut",
    },
  },
  "celebrating-day": {
    y: [0, -16, 0, -12, 0, -8, 0],
    transition: {
      duration: MASCOT_TIMINGS.celebrate_day_ms / 1000,
      ease: "easeOut",
    },
  },
  stumbling: {
    x: [0, -3, 3, -2, 2, 0],
    y: 0,
    transition: { duration: 0.6, ease: "easeInOut" },
  },
};

/** Legs swing during walk. */
export const leftLegVariants: Variants = {
  idle: { rotate: 0 },
  "walking-to-next-station": {
    rotate: [-12, 12, -12, 12, 0],
    transition: {
      rotate: {
        duration: MASCOT_TIMINGS.walk_ms / 1000,
        ease: "easeInOut",
      },
    },
  },
  "at-station-recording": { rotate: 0 },
  "at-station-scoring": { rotate: 0 },
  "celebrating-rep": { rotate: 0 },
  "celebrating-day": { rotate: [0, -8, 8, 0] },
  stumbling: { rotate: [0, -20, 8, 0] },
};
export const rightLegVariants: Variants = {
  idle: { rotate: 0 },
  "walking-to-next-station": {
    rotate: [12, -12, 12, -12, 0],
    transition: {
      rotate: {
        duration: MASCOT_TIMINGS.walk_ms / 1000,
        ease: "easeInOut",
      },
    },
  },
  "at-station-recording": { rotate: 0 },
  "at-station-scoring": { rotate: 0 },
  "celebrating-rep": { rotate: 0 },
  "celebrating-day": { rotate: [0, 8, -8, 0] },
  stumbling: { rotate: [0, 20, -8, 0] },
};

/** Arms swing during walk + raise during celebration. */
export const leftArmVariants: Variants = {
  idle: { rotate: 0, originX: "46px", originY: "92px" },
  "walking-to-next-station": {
    rotate: [10, -10, 10, -10, 0],
    transition: {
      rotate: {
        duration: MASCOT_TIMINGS.walk_ms / 1000,
        ease: "easeInOut",
      },
    },
  },
  "at-station-recording": { rotate: 0 },
  "at-station-scoring": { rotate: -8 },
  "celebrating-rep": { rotate: -55 },
  "celebrating-day": { rotate: -70 },
  stumbling: { rotate: 20 },
};
export const rightArmVariants: Variants = {
  idle: { rotate: 0, originX: "74px", originY: "92px" },
  "walking-to-next-station": {
    rotate: [-10, 10, -10, 10, 0],
    transition: {
      rotate: {
        duration: MASCOT_TIMINGS.walk_ms / 1000,
        ease: "easeInOut",
      },
    },
  },
  "at-station-recording": { rotate: 0 },
  "at-station-scoring": { rotate: 8 },
  "celebrating-rep": { rotate: 55 },
  "celebrating-day": { rotate: 70 },
  stumbling: { rotate: -20 },
};

/** Head tilts during scoring + celebration. */
export const headVariants: Variants = {
  idle: {
    rotate: [0, -2, 0, 2, 0],
    transition: {
      rotate: {
        repeat: Infinity,
        duration: MASCOT_TIMINGS.idle_loop_ms / 1000,
        ease: "easeInOut",
      },
    },
  },
  "walking-to-next-station": { rotate: 0 },
  "at-station-recording": { rotate: 0 },
  "at-station-scoring": { rotate: [-4, 4, -2, 2, 0] },
  "celebrating-rep": { rotate: 0 },
  "celebrating-day": { rotate: [0, -8, 8, 0] },
  stumbling: { rotate: [0, 12, -8, 0] },
};

/** Mouth/face flickers during celebration. We don't dramatically reshape
 *  the mouth in code (Phase 14 swaps the geometry); we just nudge it. */
export const faceVariants: Variants = {
  idle: { scale: 1 },
  "walking-to-next-station": { scale: 1 },
  "at-station-recording": { scale: 1 },
  "at-station-scoring": { scale: 1 },
  "celebrating-rep": { scale: [1, 1.06, 1] },
  "celebrating-day": { scale: [1, 1.1, 1, 1.06, 1] },
  stumbling: { scale: 1 },
};

/** Score-band intensity multipliers — wrappers in Mascot.tsx apply
 *  these on top of `celebrating-rep` so the same state covers all bands. */
export const SCORE_BAND_INTENSITY: Record<
  ScoreBand,
  { jumpScale: number; armRotate: number }
> = {
  poor: { jumpScale: 0.4, armRotate: -25 },
  ok: { jumpScale: 0.8, armRotate: -45 },
  strong: { jumpScale: 1.0, armRotate: -55 },
  excellent: { jumpScale: 1.4, armRotate: -75 },
};

/** Compute the X translate for a given station index (0..3) in viewBox
 *  units. The stage is conceptually 4 stations spread evenly across a
 *  240-unit visible field (4× the mascot's 60-unit centerline). */
export function stationXForIndex(index: number, totalStations = 4): number {
  // Stations laid out 0..(totalStations-1) → x positions [-90, -30, 30, 90].
  const spacing = 60;
  const offset = ((totalStations - 1) / 2) * spacing;
  return index * spacing - offset;
}

/** Snapshot the wrapper's "current" variant given the requested state.
 *  Used to keep tests / dev tools honest about which variant fires. */
export function pickContainerVariant(state: MascotState): keyof typeof containerVariants {
  return state;
}
