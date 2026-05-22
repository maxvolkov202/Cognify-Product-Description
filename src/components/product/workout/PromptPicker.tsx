"use client";

// PromptPicker — v3 single-panel UX.
//
// Shows 5 prompt cards + an unlimited Cycle button. Drops the previous
// 3-tab (Shuffle/All/Surprise) shape: Max's 2026-05-22 redesign asked
// for fewer choices and easier cycling instead of a 20-prompt list.
//
// Mounted inside RepControls when sessionPhase === 'prompt-selecting'.
// 15s idle → auto-pick top candidate. Swipe-left also cycles.

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import {
  fetchPromptCandidates,
  logPromptSelection,
  type PromptCandidate,
} from "@/server/actions/prompt-selection";
import {
  initialPickerState,
  pickerReducer,
} from "@/lib/workout/prompt-picker-state";
import { cn } from "@/lib/utils/cn";
import PromptCard from "./PromptCard";
import RuleReminder from "./RuleReminder";

const CANDIDATES_PER_CYCLE = 5;

export type PromptPickerProps = {
  exerciseId: string;
  exerciseName: string;
  rule: string;
  why?: string | null;
  workoutSessionId: string | null;
  /** Phase HB-3 — when true, fetchPromptCandidates filters to prompts
   *  whose tags overlap with the user's vertical. Default false →
   *  general prompts. */
  personalize?: boolean;
  /** Called with the selected promptId. Phase 7 advances RepControls
   *  from 'prompt-selecting' → 'recording' on this callback. */
  onSelect: (params: {
    promptId: string;
    promptText: string;
    mode: "shuffle" | "list" | "surprise" | "auto_idle";
  }) => void;
  onSkip?: () => void;
  /** Phase HB-4 — Cancel workout. Returns the user to landing while
   *  preserving the muscle_group_day so they can resume later. */
  onCancelWorkout?: () => void;
};

export default function PromptPicker({
  exerciseId,
  exerciseName,
  rule,
  why,
  workoutSessionId,
  personalize = false,
  onSelect,
  onSkip,
  onCancelWorkout,
}: PromptPickerProps) {
  const [state, dispatch] = useReducer(pickerReducer, undefined, initialPickerState);
  const [isLoading, setIsLoading] = useState(true);
  const [isCycling, setIsCycling] = useState(false);
  const cardStackRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Bootstrap: fetch the first cycle of candidates.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchPromptCandidates({ exerciseId, personalize }).then((res) => {
      if (cancelled) return;
      dispatch({
        type: "INIT",
        candidates: res.candidates.slice(0, CANDIDATES_PER_CYCLE),
        surprise: res.surprise,
      });
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [exerciseId, personalize]);

  const handleCycle = useCallback(() => {
    if (isCycling) return;
    setIsCycling(true);
    fetchPromptCandidates({ exerciseId, personalize }).then((res) => {
      dispatch({
        type: "RESHUFFLE",
        candidates: res.candidates.slice(0, CANDIDATES_PER_CYCLE),
        surprise: res.surprise,
      });
      setIsCycling(false);
    });
  }, [exerciseId, personalize, isCycling]);

  // Phase HB-4 — disabled the 15s idle auto-pick. Max's 2026-05-22
  // report: the auto-advance was firing while users were still reading
  // prompts, making it feel like the picker wasn't waiting for them.
  // The picker now stays open indefinitely until the user explicitly
  // taps a prompt, cycles, or cancels.

  const persistAndAdvance = useCallback(
    async (params: {
      promptId: string;
      promptText: string;
      mode: "shuffle" | "list" | "surprise" | "auto_idle";
    }) => {
      dispatch({ type: "SELECT", promptId: params.promptId });
      const msToSelect = Date.now() - state.startedAt;
      if (workoutSessionId) {
        await logPromptSelection({
          workoutSessionId,
          exerciseId,
          promptId: params.promptId,
          mode: params.mode,
          reshuffles: state.reshuffles,
          msToSelect,
        });
      }
      onSelect({
        promptId: params.promptId,
        promptText: params.promptText,
        mode: params.mode,
      });
    },
    [
      onSelect,
      exerciseId,
      workoutSessionId,
      state.reshuffles,
      state.startedAt,
    ],
  );

  // Swipe-left on the card stack → cycle (unlimited).
  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    if (!start) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = Math.abs(t.clientY - start.y);
    touchStartRef.current = null;
    if (dx < -60 && dy < 30) {
      try {
        navigator.vibrate?.(10);
      } catch {
        // ignore
      }
      handleCycle();
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <RuleReminder exerciseName={exerciseName} rule={rule} why={why} />

      {isLoading ? (
        <LoadingSkeleton />
      ) : state.shuffleCandidates.length === 0 ? (
        <EmptyMessage>No prompts available for this exercise.</EmptyMessage>
      ) : (
        <div
          ref={cardStackRef}
          className="flex flex-col gap-2"
          style={{ touchAction: "pan-y" }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {state.shuffleCandidates.map((c) => (
            <PromptCard
              key={c.id}
              prompt={c}
              onPick={() =>
                persistAndAdvance({
                  promptId: c.id,
                  promptText: c.text,
                  mode: "shuffle",
                })
              }
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={handleCycle}
          disabled={isLoading || isCycling}
          className={cn(
            "flex-1 min-h-[44px] rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold",
            "border-purple-200 bg-white text-purple-700",
            "hover:bg-purple-50 hover:border-purple-300",
            "disabled:opacity-50 disabled:cursor-wait",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
            "transition-colors",
          )}
        >
          {isCycling ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCcw className="w-4 h-4" />
          )}
          {isCycling ? "Cycling…" : "Cycle prompts"}
        </button>
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="px-4 min-h-[44px] text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Skip
          </button>
        )}
      </div>

      {/* Phase HB-4 — Cancel workout. Returns the user to landing
          (idle phase) while preserving the muscle_group_day in the DB.
          When they come back, the picker reopens at the same station. */}
      {onCancelWorkout && (
        <div className="text-center mt-2">
          <button
            type="button"
            onClick={onCancelWorkout}
            className="text-xs text-slate-400 hover:text-slate-600 underline-offset-2 hover:underline"
          >
            ← Cancel workout
          </button>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-[160px] text-slate-400 gap-2">
      <Loader2 className="w-4 h-4 animate-spin" />
      Loading prompts…
    </div>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm text-slate-500 text-center py-6">{children}</div>
  );
}

// Type-side compatibility: EmptyMessage signature unchanged.
// The dark theme is fully replaced; cards + chrome render on light bg.
