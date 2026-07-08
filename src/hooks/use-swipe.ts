"use client";

// Phase 12 — pointer-events swipe primitive. No external dep.
//
// Usage:
//   const handlers = useSwipe({
//     onSwipeLeft: () => doX(),
//     onSwipeRight: () => doY(),
//     threshold: 60,
//   });
//   return <div {...handlers}>…</div>;
//
// iOS back-swipe edge zone: avoid attaching handlers to elements
// whose left edge sits within ~24px of the viewport edge. We pass
// `touchAction: "pan-y"` so vertical scroll keeps working.

import { useRef } from "react";

type Direction = "left" | "right" | "up" | "down";

export type UseSwipeOptions = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  /** Minimum movement (px) along the dominant axis. Default 60. */
  threshold?: number;
  /** Max perpendicular drift relative to threshold. Default 30. */
  maxPerpendicular?: number;
};

export function useSwipe(options: UseSwipeOptions) {
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const threshold = options.threshold ?? 60;
  const maxPerp = options.maxPerpendicular ?? 30;

  function onPointerDown(e: React.PointerEvent<HTMLElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  }
  function onPointerUp(e: React.PointerEvent<HTMLElement>) {
    const start = startRef.current;
    startRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    let dir: Direction | null = null;
    if (absX > absY && absX >= threshold && absY <= maxPerp) {
      dir = dx > 0 ? "right" : "left";
    } else if (absY > absX && absY >= threshold && absX <= maxPerp) {
      dir = dy > 0 ? "down" : "up";
    }

    if (!dir) return;
    if (dir === "left") options.onSwipeLeft?.();
    if (dir === "right") options.onSwipeRight?.();
    if (dir === "up") options.onSwipeUp?.();
    if (dir === "down") options.onSwipeDown?.();
  }
  function onPointerCancel() {
    startRef.current = null;
  }

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    style: { touchAction: "pan-y" as const },
  };
}
