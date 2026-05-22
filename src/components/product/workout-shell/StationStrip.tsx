"use client";

// 4-station horizontal strip. Keyboard nav: Tab enters; ArrowLeft/Right
// moves focus; Enter activates only the current station.

import { useRef } from "react";
import type { ShellStation } from "@/lib/workout/types";
import type { MuscleGroupId } from "@/types/domain";
import StationCard from "./StationCard";

export type StationStripProps = {
  stations: ShellStation[];
  dim: MuscleGroupId;
  onStationFocus?: (index: number) => void;
  onStationActivate?: (index: number) => void;
};

export default function StationStrip({
  stations,
  dim,
  onStationFocus,
  onStationActivate,
}: StationStripProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  function handleKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const buttons = ref.current?.querySelectorAll<HTMLButtonElement>(
      "button",
    );
    if (!buttons || buttons.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    let idx = -1;
    buttons.forEach((b, i) => {
      if (b === active) idx = i;
    });
    if (idx < 0) idx = 0;
    const next =
      e.key === "ArrowLeft"
        ? Math.max(0, idx - 1)
        : Math.min(buttons.length - 1, idx + 1);
    buttons[next]?.focus();
    e.preventDefault();
  }

  return (
    <div
      ref={ref}
      role="list"
      aria-label="Workout stations"
      onKeyDown={handleKey}
      className="grid grid-cols-4 gap-2 w-full max-w-md mx-auto px-2"
    >
      {stations.map((s) => (
        <div role="listitem" key={s.index} className="min-w-0">
          <StationCard
            station={s}
            dim={dim}
            onFocus={onStationFocus}
            onActivate={onStationActivate}
          />
        </div>
      ))}
    </div>
  );
}
