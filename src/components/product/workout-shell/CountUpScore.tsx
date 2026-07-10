"use client";

// Shared score count-up (§5.7 celebration). Extracted from
// DayCompleteSummary so the Improvement Review + Skill Lab Session
// Complete reveals share one implementation.

import { useEffect } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";

/** Final score count-up. Mirrors the CompositeScore idiom: motion value +
 *  rounded transform, instant when the user prefers reduced motion.
 *  `delay` lets reveal sequences start the count after earlier beats. */
export default function CountUpScore({
  value,
  delay = 0,
}: {
  value: number;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const motionValue = useMotionValue(reduced ? value : 0);
  const rounded = useTransform(motionValue, (v) => Math.round(v));

  useEffect(() => {
    if (reduced) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, {
      delay,
      duration: 0.9,
      ease: [0.32, 0.72, 0, 1],
    });
    return controls.stop;
  }, [value, motionValue, reduced, delay]);

  return <motion.span>{rounded}</motion.span>;
}
