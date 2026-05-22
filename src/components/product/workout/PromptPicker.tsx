"use client";

// PromptPicker — Phase 6's between-stations UX.
//
// Three tabs: Shuffle (default), All prompts, Surprise me. Pinned rule
// reminder above. 15s idle → auto-pick top Shuffle candidate. One free
// reshuffle per visit; swipe-left on touch.
//
// Mounted inside RepControls when sessionPhase === 'prompt-selecting'.

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  useTransition,
} from "react";
import { Loader2, Shuffle, ListChecks, Wand2 } from "lucide-react";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";
import {
  fetchPromptCandidates,
  listAllPrompts,
  logPromptSelection,
  type PromptCandidate,
} from "@/server/actions/prompt-selection";
import {
  initialPickerState,
  pickerReducer,
  type PickerTab,
} from "@/lib/workout/prompt-picker-state";
import { cn } from "@/lib/utils/cn";
import PromptCard from "./PromptCard";
import RuleReminder from "./RuleReminder";

const IDLE_TIMEOUT_MS = 15_000;

export type PromptPickerProps = {
  exerciseId: string;
  exerciseName: string;
  rule: string;
  why?: string | null;
  workoutSessionId: string | null;
  /** Called with the selected promptId. Phase 7 advances RepControls
   *  from 'prompt-selecting' → 'recording' on this callback. */
  onSelect: (params: {
    promptId: string;
    promptText: string;
    mode: "shuffle" | "list" | "surprise" | "auto_idle";
  }) => void;
  onSkip?: () => void;
};

const TABS: { id: PickerTab; label: string; Icon: typeof Shuffle }[] = [
  { id: "shuffle", label: "Shuffle", Icon: Shuffle },
  { id: "list", label: "All prompts", Icon: ListChecks },
  { id: "surprise", label: "Surprise me", Icon: Wand2 },
];

export default function PromptPicker({
  exerciseId,
  exerciseName,
  rule,
  why,
  workoutSessionId,
  onSelect,
  onSkip,
}: PromptPickerProps) {
  const [state, dispatch] = useReducer(pickerReducer, undefined, initialPickerState);
  const [isLoading, setIsLoading] = useState(true);
  const [, startTransition] = useTransition();
  const [allPrompts, setAllPrompts] = useState<PromptCandidate[]>([]);
  const [difficultyFilter, setDifficultyFilter] = useState<number | null>(null);
  const cardStackRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Bootstrap: fetch initial Shuffle candidates.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchPromptCandidates({ exerciseId }).then((res) => {
      if (cancelled) return;
      dispatch({
        type: "INIT",
        candidates: res.candidates.slice(0, 3),
        surprise: res.surprise,
      });
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  // Lazy-load the All-prompts list when the list tab is opened first
  // (or when the difficulty filter changes).
  useEffect(() => {
    if (state.tab !== "list") return;
    let cancelled = false;
    startTransition(() => {
      listAllPrompts({
        exerciseId,
        ...(difficultyFilter ? { difficulty: difficultyFilter } : {}),
      }).then((res) => {
        if (cancelled) return;
        setAllPrompts(res.prompts);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [exerciseId, state.tab, difficultyFilter]);

  // Idle auto-pick: 15s without interaction → auto_idle event +
  // pick the top Shuffle candidate.
  useIdleTimeout({
    timeoutMs: IDLE_TIMEOUT_MS,
    enabled: !state.selectedPromptId && !isLoading,
    onIdle: () => {
      const top = state.shuffleCandidates[0];
      if (!top) return;
      void persistAndAdvance({
        promptId: top.id,
        promptText: top.text,
        mode: "auto_idle",
      });
    },
  });

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

  function handleReshuffle() {
    setIsLoading(true);
    fetchPromptCandidates({ exerciseId }).then((res) => {
      dispatch({
        type: "RESHUFFLE",
        candidates: res.candidates.slice(0, 3),
        surprise: res.surprise,
      });
      setIsLoading(false);
    });
  }

  // Swipe-left on the card stack → reshuffle (one free).
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
    if (dx < -60 && dy < 30 && !state.reshuffleUsed) {
      try {
        navigator.vibrate?.(10);
      } catch {
        // ignore
      }
      handleReshuffle();
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <RuleReminder exerciseName={exerciseName} rule={rule} why={why} />

      <div
        role="tablist"
        aria-label="Prompt picker tabs"
        className="grid grid-cols-3 gap-1 bg-slate-900/60 rounded-xl p-1 border border-slate-800"
      >
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={state.tab === id}
            tabIndex={state.tab === id ? 0 : -1}
            onClick={() => dispatch({ type: "SET_TAB", tab: id })}
            className={cn(
              "min-h-[40px] rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950",
              state.tab === id
                ? "bg-pink-500/20 text-pink-100"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {state.tab === "shuffle" && (
        <ShuffleTab
          loading={isLoading}
          candidates={state.shuffleCandidates}
          reshuffleUsed={state.reshuffleUsed}
          onReshuffle={handleReshuffle}
          onPick={(c) =>
            persistAndAdvance({
              promptId: c.id,
              promptText: c.text,
              mode: "shuffle",
            })
          }
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          stackRef={cardStackRef}
        />
      )}

      {state.tab === "list" && (
        <ListTab
          allPrompts={allPrompts}
          difficultyFilter={difficultyFilter}
          onFilter={setDifficultyFilter}
          onPick={(c) =>
            persistAndAdvance({
              promptId: c.id,
              promptText: c.text,
              mode: "list",
            })
          }
        />
      )}

      {state.tab === "surprise" && (
        <SurpriseTab
          loading={isLoading}
          surprise={state.surprise}
          onPick={(c) =>
            persistAndAdvance({
              promptId: c.id,
              promptText: c.text,
              mode: "surprise",
            })
          }
        />
      )}

      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-slate-500 hover:text-slate-300 self-center mt-1"
        >
          Skip this station
        </button>
      )}
    </div>
  );
}

// ─── Sub-tabs ────────────────────────────────────────────────────────────

function ShuffleTab({
  loading,
  candidates,
  reshuffleUsed,
  onReshuffle,
  onPick,
  onTouchStart,
  onTouchEnd,
  stackRef,
}: {
  loading: boolean;
  candidates: PromptCandidate[];
  reshuffleUsed: boolean;
  onReshuffle: () => void;
  onPick: (c: PromptCandidate) => void;
  onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: (e: React.TouchEvent<HTMLDivElement>) => void;
  stackRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (loading) return <LoadingSkeleton />;
  if (candidates.length === 0) {
    return <EmptyMessage>No prompts available — try another tab.</EmptyMessage>;
  }
  return (
    <div className="flex flex-col gap-3">
      <div
        ref={stackRef}
        className="flex flex-col gap-2"
        style={{ touchAction: "pan-y" }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {candidates.map((c) => (
          <PromptCard key={c.id} prompt={c} onPick={() => onPick(c)} />
        ))}
      </div>
      <button
        type="button"
        onClick={onReshuffle}
        disabled={reshuffleUsed}
        className={cn(
          "min-h-[40px] text-sm rounded-lg border transition-colors",
          reshuffleUsed
            ? "border-slate-800 text-slate-600 cursor-not-allowed"
            : "border-slate-700 text-slate-200 hover:bg-slate-800",
        )}
      >
        {reshuffleUsed ? "Locked in — pick one" : "Shuffle again"}
      </button>
    </div>
  );
}

function ListTab({
  allPrompts,
  difficultyFilter,
  onFilter,
  onPick,
}: {
  allPrompts: PromptCandidate[];
  difficultyFilter: number | null;
  onFilter: (d: number | null) => void;
  onPick: (c: PromptCandidate) => void;
}) {
  const FILTERS: Array<{ value: number | null; label: string }> = [
    { value: null, label: "All" },
    { value: 1, label: "Intro" },
    { value: 2, label: "Core" },
    { value: 3, label: "Stretch" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={String(f.value)}
            onClick={() => onFilter(f.value)}
            className={cn(
              "px-3 py-1 rounded-full text-xs border min-h-[32px] shrink-0",
              difficultyFilter === f.value
                ? "border-pink-400 bg-pink-500/10 text-pink-100"
                : "border-slate-700 text-slate-300 hover:bg-slate-800",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      {allPrompts.length === 0 ? (
        <EmptyMessage>
          No prompts at that difficulty yet — try medium.
        </EmptyMessage>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-[44vh] overflow-y-auto pr-1">
          {allPrompts.map((p) => (
            <PromptCard key={p.id} prompt={p} compact onPick={() => onPick(p)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SurpriseTab({
  loading,
  surprise,
  onPick,
}: {
  loading: boolean;
  surprise: PromptCandidate | null;
  onPick: (c: PromptCandidate) => void;
}) {
  if (loading) return <LoadingSkeleton />;
  if (!surprise) return <EmptyMessage>No surprise available.</EmptyMessage>;
  return (
    <div className="flex flex-col gap-3">
      <PromptCard prompt={surprise} onPick={() => onPick(surprise)} />
      <button
        type="button"
        onClick={() => onPick(surprise)}
        className={cn(
          "min-h-[48px] text-base font-semibold rounded-xl",
          "bg-pink-500 hover:bg-pink-400 text-white",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300",
        )}
      >
        Start rep
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-[160px] text-slate-500 gap-2">
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
