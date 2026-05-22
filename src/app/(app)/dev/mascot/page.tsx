"use client";

// /dev/mascot — Phase 4 debug surface for the workout mascot.
//
// Renders the Mascot component with all of its prop axes exposed as
// controls. Lets Max (or any engineer) flip through every state, every
// score band, every dim color, and every station index without needing
// a running workout. Also doubles as Phase 14's iteration page — when
// Max polishes the SVG layers, this page renders the result in every
// state combination.

import { useEffect, useRef, useState } from "react";
import Mascot from "@/components/product/workout/Mascot";
import {
  MASCOT_STATES,
  type MascotState,
} from "@/lib/animations/mascot-state";
import { MUSCLE_GROUP_IDS, MUSCLE_GROUP_LABELS, type MuscleGroupId } from "@/types/domain";

const SCORE_PRESETS: Array<{ label: string; value: number; band: string }> = [
  { label: "poor (35)", value: 35, band: "poor" },
  { label: "ok (62)", value: 62, band: "ok" },
  { label: "strong (82)", value: 82, band: "strong" },
  { label: "excellent (94)", value: 94, band: "excellent" },
];

type TransitionLog = {
  ts: number;
  from: MascotState | null;
  to: MascotState;
};

export default function DevMascotPage() {
  const [state, setState] = useState<MascotState>("idle");
  const [stationIndex, setStationIndex] = useState(0);
  const [lastScore, setLastScore] = useState<number | null>(82);
  const [dim, setDim] = useState<MuscleGroupId | null>("clarity");
  const [viewportPx, setViewportPx] = useState<number>(1024);
  const [transitions, setTransitions] = useState<TransitionLog[]>([]);
  const [walkTimer, setWalkTimer] = useState<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [taps, setTaps] = useState(0);
  const logRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll the transition log on new entries.
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [transitions]);

  function handleTransition(event: {
    from: MascotState | null;
    to: MascotState;
    at: number;
  }) {
    setTransitions((prev) =>
      [...prev, { ts: event.at, from: event.from, to: event.to }].slice(-30),
    );
  }

  // "Walk through 4 stations" demo — useful for verifying the walk loop.
  function runWalkSequence() {
    if (walkTimer) clearTimeout(walkTimer);
    setState("walking-to-next-station");
    setStationIndex(0);
    const steps: Array<() => void> = [
      () => {
        setStationIndex(1);
      },
      () => {
        setState("at-station-recording");
      },
      () => {
        setState("at-station-scoring");
      },
      () => {
        setState("celebrating-rep");
      },
      () => {
        setState("walking-to-next-station");
        setStationIndex(2);
      },
      () => {
        setState("walking-to-next-station");
        setStationIndex(3);
      },
      () => {
        setState("celebrating-day");
      },
      () => {
        setState("idle");
        setStationIndex(0);
      },
    ];
    const delays = [1700, 600, 1200, 1400, 1700, 1700, 2200, 800];
    let t = 0;
    steps.forEach((fn, i) => {
      t += delays[i]!;
      const id = setTimeout(fn, t);
      // Capture only the last; useful only for cancellation.
      if (i === steps.length - 1) setWalkTimer(id);
    });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <h1 className="text-2xl font-semibold mb-1">/dev/mascot</h1>
      <p className="text-slate-400 mb-6 text-sm">
        Phase 4 debug surface. Toggle state, score band, station, dim,
        and viewport size. Tap the mascot to fire its onTap. Reduced-motion
        is detected automatically — toggle your OS setting to verify the
        fallback render.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
        {/* Stage */}
        <div className="bg-slate-900 rounded-xl p-6 flex flex-col items-center justify-center">
          <div
            className="bg-slate-800/50 rounded-lg flex items-end justify-center pb-4 transition-all"
            style={{
              width: `${Math.min(viewportPx, 1100)}px`,
              maxWidth: "100%",
              minHeight: 320,
            }}
          >
            <div className="relative flex items-end h-full pt-4 pb-6">
              <Mascot
                state={state}
                targetStationIndex={stationIndex}
                lastScore={lastScore}
                dim={dim}
                onStateTransition={handleTransition}
                onTap={() => setTaps((t) => t + 1)}
                size={200}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2 w-full max-w-xl">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`rounded-lg p-3 text-center text-xs border transition-colors ${
                  i === stationIndex
                    ? "border-pink-400 bg-pink-500/10"
                    : "border-slate-700 bg-slate-800/40"
                }`}
              >
                Station {i + 1}
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500 mt-4">
            taps: <span className="text-pink-300">{taps}</span> • state:{" "}
            <span className="text-pink-300">{state}</span> • station:{" "}
            <span className="text-pink-300">{stationIndex}</span> • dim:{" "}
            <span className="text-pink-300">{dim ?? "(none)"}</span> • score:{" "}
            <span className="text-pink-300">
              {lastScore != null ? lastScore : "—"}
            </span>
          </p>
        </div>

        {/* Controls */}
        <div className="space-y-4 text-sm">
          <Section label="state">
            <div className="grid grid-cols-2 gap-1">
              {MASCOT_STATES.map((s) => (
                <button
                  key={s}
                  className={`text-left px-3 py-1.5 rounded text-xs border transition-colors ${
                    s === state
                      ? "border-pink-400 bg-pink-500/20 text-pink-100"
                      : "border-slate-700 bg-slate-800 hover:bg-slate-700"
                  }`}
                  onClick={() => setState(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </Section>

          <Section label="target station">
            <div className="grid grid-cols-4 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <button
                  key={i}
                  className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                    i === stationIndex
                      ? "border-pink-400 bg-pink-500/20"
                      : "border-slate-700 bg-slate-800 hover:bg-slate-700"
                  }`}
                  onClick={() => setStationIndex(i)}
                >
                  {i}
                </button>
              ))}
            </div>
          </Section>

          <Section label="score band (for celebrating-rep)">
            <div className="grid grid-cols-2 gap-1">
              {SCORE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  className={`px-3 py-1.5 rounded text-xs border ${
                    lastScore === p.value
                      ? "border-pink-400 bg-pink-500/20"
                      : "border-slate-700 bg-slate-800 hover:bg-slate-700"
                  }`}
                  onClick={() => setLastScore(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Section>

          <Section label="dim (headband color)">
            <div className="grid grid-cols-2 gap-1">
              {MUSCLE_GROUP_IDS.map((d) => (
                <button
                  key={d}
                  className={`px-3 py-1.5 rounded text-xs border ${
                    d === dim
                      ? "border-pink-400 bg-pink-500/20"
                      : "border-slate-700 bg-slate-800 hover:bg-slate-700"
                  }`}
                  onClick={() => setDim(d)}
                >
                  {MUSCLE_GROUP_LABELS[d]}
                </button>
              ))}
              <button
                className={`col-span-2 px-3 py-1.5 rounded text-xs border ${
                  dim === null
                    ? "border-pink-400 bg-pink-500/20"
                    : "border-slate-700 bg-slate-800 hover:bg-slate-700"
                }`}
                onClick={() => setDim(null)}
              >
                (no dim — grey band)
              </button>
            </div>
          </Section>

          <Section label="viewport sim">
            <div className="grid grid-cols-3 gap-1">
              {[320, 768, 1100].map((w) => (
                <button
                  key={w}
                  className={`px-3 py-1.5 rounded text-xs border ${
                    w === viewportPx
                      ? "border-pink-400 bg-pink-500/20"
                      : "border-slate-700 bg-slate-800 hover:bg-slate-700"
                  }`}
                  onClick={() => setViewportPx(w)}
                >
                  {w}px
                </button>
              ))}
            </div>
          </Section>

          <Section label="sequences">
            <button
              className="w-full px-3 py-2 rounded bg-pink-500/30 border border-pink-400 hover:bg-pink-500/50 text-sm"
              onClick={runWalkSequence}
            >
              ▶ Walk through 4 stations + celebrate
            </button>
          </Section>

          <Section label="transition log (last 30)">
            <div
              ref={logRef}
              className="bg-slate-950 border border-slate-800 rounded p-2 h-32 overflow-y-auto font-mono text-[10px] text-slate-400"
            >
              {transitions.length === 0 && <div>(no transitions yet)</div>}
              {transitions.map((t, i) => (
                <div key={i}>
                  +{(t.ts - (transitions[0]?.ts ?? t.ts))}ms{" "}
                  <span className="text-slate-500">
                    {t.from ?? "(init)"}
                  </span>{" "}
                  → <span className="text-pink-300">{t.to}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}
