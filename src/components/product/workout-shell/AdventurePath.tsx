"use client";

// Winding adventure-path layout — 4 stations zig-zag down the page,
// connected by curved SVG paths. Style reference: Duolingo lesson tree.
//
// Layout per row (mobile-first, single column scrollable):
//   row 0: station 0 on LEFT,   label on RIGHT
//   row 1: label on LEFT,        station 1 on RIGHT
//   row 2: station 2 on LEFT,   label on RIGHT
//   row 3: label on LEFT,        station 3 on RIGHT
//
// Path segments connect station 0→1→2→3 with curved bezier segments.
// Done segments render solid in the dim's accent color; the next-up
// segment renders solid with a slight glow; future segments render
// dashed gray.

import { useMemo } from "react";
import AdventureStation, { DIM_ACCENT, type StationStatus } from "./AdventureStation";
import type { ShellStation } from "@/lib/workout/types";
import type { MuscleGroupId } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

export type AdventurePathProps = {
  stations: ShellStation[];
  currentStationIndex: number;
  dim: MuscleGroupId | null;
  onActivateCurrent?: () => void;
};

const STEP_LABELS = [
  { title: "Step 1: Introduction", hint: "Warm up the brain." },
  { title: "Step 2: Key Concept", hint: "Hit the core lift." },
  { title: "Step 3: Applied Scenario", hint: "Make it real." },
  { title: "Step 4: Practice Drill", hint: "Lock it in." },
] as const;

const STATION_SIZE = 132;
const ROW_HEIGHT = 180;

export default function AdventurePath({
  stations,
  currentStationIndex,
  dim,
  onActivateCurrent,
}: AdventurePathProps) {
  const accent = dim ? DIM_ACCENT[dim] : DIM_ACCENT.clarity;

  // Pad to 4 slots so the layout is stable pre-Start (when stations is []).
  const slots = useMemo(() => {
    const out: (ShellStation | null)[] = [null, null, null, null];
    stations.forEach((s, i) => {
      if (i < 4) out[i] = s;
    });
    return out;
  }, [stations]);

  function statusFor(index: number): StationStatus {
    const s = slots[index];
    if (s?.status === "complete") return "done";
    if (index === currentStationIndex) return "active";
    if (index < currentStationIndex) return "done";
    return "locked";
  }

  // Status of the SEGMENT between station N and N+1.
  function segmentColor(fromIndex: number): string {
    const fromStatus = statusFor(fromIndex);
    const toStatus = statusFor(fromIndex + 1);
    if (fromStatus === "done" || toStatus === "active") return accent.path;
    return "#d1d5db"; // locked
  }

  function segmentDashed(fromIndex: number): boolean {
    return statusFor(fromIndex) === "locked" || statusFor(fromIndex + 1) === "locked";
  }

  return (
    <div className="relative w-full mx-auto" style={{ maxWidth: 480 }}>
      {/* Connecting paths — single SVG layered behind the stations. */}
      <svg
        className="absolute inset-0 w-full pointer-events-none"
        style={{ height: ROW_HEIGHT * 3 + STATION_SIZE }}
        viewBox={`0 0 100 ${(ROW_HEIGHT * 3 + STATION_SIZE) / 4.8}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {/* Three curve segments connecting the 4 stations.
            Station 0 center ≈ (20, 14), station 1 ≈ (80, 52),
            station 2 ≈ (20, 90), station 3 ≈ (80, 128). */}
        {[0, 1, 2].map((i) => {
          const fromOnLeft = i % 2 === 0; // station i position
          const toOnLeft = (i + 1) % 2 === 0; // station i+1 position
          const fromX = fromOnLeft ? 20 : 80;
          const toX = toOnLeft ? 20 : 80;
          const fromY = 14 + i * 38;
          const toY = fromY + 38;
          const cx1 = fromOnLeft ? 50 : 50;
          const cy1 = fromY + 4;
          const cx2 = toOnLeft ? 50 : 50;
          const cy2 = toY - 4;
          return (
            <path
              key={i}
              d={`M ${fromX} ${fromY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${toX} ${toY}`}
              fill="none"
              stroke={segmentColor(i)}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeDasharray={segmentDashed(i) ? "1.6 2.4" : undefined}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      {/* 4 rows, each with station + label on alternating sides. */}
      <div className="relative flex flex-col">
        {slots.map((_, i) => {
          const onLeft = i % 2 === 0;
          const label = STEP_LABELS[i] ?? { title: `Step ${i + 1}`, hint: "" };
          const status = statusFor(i);
          return (
            <div
              key={i}
              className={cn(
                "relative grid grid-cols-2 items-center gap-3",
                onLeft ? "" : "",
              )}
              style={{ minHeight: ROW_HEIGHT }}
            >
              {onLeft ? (
                <>
                  <div className="justify-self-start pl-2">
                    <AdventureStation
                      index={i}
                      status={status}
                      dim={dim}
                      size={STATION_SIZE}
                      {...(status === "active" && onActivateCurrent
                        ? { onActivate: onActivateCurrent }
                        : {})}
                    />
                  </div>
                  <StepLabel
                    label={label}
                    status={status}
                    align="left"
                  />
                </>
              ) : (
                <>
                  <StepLabel
                    label={label}
                    status={status}
                    align="right"
                  />
                  <div className="justify-self-end pr-2">
                    <AdventureStation
                      index={i}
                      status={status}
                      dim={dim}
                      size={STATION_SIZE}
                      {...(status === "active" && onActivateCurrent
                        ? { onActivate: onActivateCurrent }
                        : {})}
                    />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepLabel({
  label,
  status,
  align,
}: {
  label: { title: string; hint: string };
  status: StationStatus;
  align: "left" | "right";
}) {
  const statusText =
    status === "done"
      ? "(Done)"
      : status === "active"
        ? "(Active)"
        : "(Locked)";

  return (
    <div
      className={cn(
        "text-slate-700",
        align === "left" ? "text-left pl-1" : "text-right pr-1",
      )}
    >
      <div className="text-base sm:text-lg font-semibold leading-tight">
        {label.title}
      </div>
      <div
        className={cn(
          "text-xs font-medium mt-0.5",
          status === "active"
            ? "text-purple-600"
            : status === "done"
              ? "text-emerald-600"
              : "text-slate-400",
        )}
      >
        {statusText}
      </div>
    </div>
  );
}
