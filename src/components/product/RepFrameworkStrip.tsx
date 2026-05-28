"use client";

import { useEffect, useState } from "react";
import { Layers, Eye, EyeOff, Lightbulb, PenLine } from "lucide-react";
import type { RepTypeFramework } from "@/lib/ai/rep-types";
import { cn } from "@/lib/utils/cn";

type Props = {
  framework: RepTypeFramework;
  /** Starts hidden if false (useful when the user wants to practice blind). */
  defaultExpanded?: boolean;
  /** When true, each section gets an inline text input the user can jot
   *  a word or two in to anchor the rep. Notes auto-save to localStorage
   *  keyed by (muscleGroupDayId, exerciseId) so they survive cancel /
   *  navigate-away / refresh. Restored on mount. Cleared when the rep
   *  completes scoring (caller responsibility — see clearRepDraftNotes). */
  allowNotes?: boolean;
  /** Storage key tuple. When provided AND allowNotes=true, notes are
   *  persisted/restored from localStorage at `cognify.rep-notes.<key>`. */
  notesKey?: string;
};

/** localStorage helper — exported so the caller can clear a rep's drafts
 *  after the rep is scored / abandoned, to prevent stale notes leaking
 *  into the next session at the same station. */
export function clearRepDraftNotes(notesKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`cognify.rep-notes.${notesKey}`);
  } catch {
    /* ignore */
  }
}

/**
 * Compact framework cheat-sheet strip shown during Daily Workout reps.
 * Fixed per rep-type, not editable. Shows section chips; tapping a chip
 * reveals its one-sentence hint. User can:
 *   - hide the whole strip to practice blind
 *   - reveal a worked example to see what hitting each section sounds like
 *
 * Not shown in Build-a-Rep — that mode has the full TalkingPointsSidebar.
 */
export function RepFrameworkStrip({
  framework,
  defaultExpanded = true,
  allowNotes = false,
  notesKey,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [showExample, setShowExample] = useState(false);
  const [notes, setNotes] = useState<string[]>(() =>
    framework.sections.map(() => ""),
  );
  // Notes panel is opt-in: always starts closed so a fresh rep screen
  // doesn't shove the input at users. If the mount-effect below finds
  // persisted non-empty notes (user has unsaved drafts from a prior
  // session), it re-opens the panel so those drafts are visible.
  const [notesOpen, setNotesOpen] = useState(false);

  // Restore persisted notes on mount when a notesKey is provided.
  useEffect(() => {
    if (!allowNotes || !notesKey || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(`cognify.rep-notes.${notesKey}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (
        Array.isArray(parsed) &&
        parsed.every((v) => typeof v === "string") &&
        parsed.length === framework.sections.length
      ) {
        setNotes(parsed as string[]);
        // If the user previously had notes, open the panel so they see
        // them right away.
        if ((parsed as string[]).some((s) => s.trim().length > 0)) {
          setNotesOpen(true);
        }
      }
    } catch {
      /* corrupt JSON in storage — ignore */
    }
    // intentionally only on mount + when key/framework structure changes
  }, [allowNotes, notesKey, framework.sections.length]);

  // Debounced auto-save. Pre-fix every keystroke synchronously
  // JSON.stringified the notes array + hit localStorage (audit IN-4 /
  // prior CTO S-6). 300ms is the sweet spot: long enough to coalesce
  // a typing burst, short enough that a quick close of the screen
  // doesn't lose the draft.
  useEffect(() => {
    if (!allowNotes || !notesKey || typeof window === "undefined") return;
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(
          `cognify.rep-notes.${notesKey}`,
          JSON.stringify(notes),
        );
      } catch {
        /* quota or disabled storage — ignore */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [allowNotes, notesKey, notes]);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-1.5 text-[11px] font-semibold text-ink-600 dark:text-ink-300 hover:border-ink-300 dark:hover:border-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800"
        title="Show framework reminder"
      >
        <Eye className="size-3.5" strokeWidth={2.5} />
        Show {framework.name}
      </button>
    );
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-ink-100 dark:border-ink-700 px-4 py-2.5">
        <div className="brand-gradient grid size-6 shrink-0 place-items-center rounded-md">
          <Layers className="size-3 text-white" strokeWidth={2.5} />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
          Framework
        </p>
        <p className="text-xs font-bold text-ink-900 dark:text-white">{framework.name}</p>
        <div className="ml-auto flex items-center gap-1">
          {allowNotes && (
            <button
              type="button"
              onClick={() => setNotesOpen((v) => !v)}
              aria-expanded={notesOpen}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition",
                notesOpen
                  ? "bg-brand-purple/10 text-brand-purple dark:text-brand-lavender"
                  : "text-ink-500 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800",
              )}
              title="Jot a word per section"
            >
              <PenLine className="size-3" strokeWidth={2.5} />
              {notesOpen ? "Hide notes" : "Jot notes"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowExample((v) => !v)}
            aria-expanded={showExample}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition",
              showExample
                ? "bg-brand-purple/10 text-brand-purple dark:text-brand-lavender"
                : "text-ink-500 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800",
            )}
            title="See an example"
          >
            <Lightbulb className="size-3" strokeWidth={2.5} />
            {showExample ? "Hide example" : "See example"}
          </button>
          <button
            type="button"
            onClick={() => {
              setExpanded(false);
              setActiveIndex(null);
              setShowExample(false);
              setNotesOpen(false);
            }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-ink-500 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800"
            title="Hide framework"
          >
            <EyeOff className="size-3" strokeWidth={2.5} />
            Hide
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 py-2.5">
        {framework.sections.map((s, i) => {
          const isActive = activeIndex === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(isActive ? null : i)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                isActive
                  ? "border-brand-purple bg-brand-purple text-white"
                  : "border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-700 dark:text-ink-200 hover:border-brand-purple/50 hover:bg-brand-purple/5",
              )}
              aria-expanded={isActive}
            >
              <span className="mr-1 font-bold opacity-70">{i + 1}.</span>
              {s.label}
            </button>
          );
        })}
      </div>

      {activeIndex !== null && (
        <div className="border-t border-ink-100 dark:border-ink-700 bg-brand-purple/5 dark:bg-brand-purple/10 px-4 py-2.5 text-xs leading-relaxed text-ink-800 dark:text-ink-100">
          <span className="font-semibold text-brand-purple dark:text-brand-lavender">
            {framework.sections[activeIndex]!.label}:
          </span>{" "}
          {framework.sections[activeIndex]!.hint}
        </div>
      )}

      {allowNotes && notesOpen && (
        <div className="border-t border-ink-100 dark:border-ink-700 bg-ink-50/50 dark:bg-ink-800/50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
            Jot a word or two per section · optional · anchors your rep
          </p>
          <div className="mt-2 grid gap-2">
            {framework.sections.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ink-200 dark:bg-ink-700 text-[10px] font-bold text-ink-700 dark:text-ink-200">
                  {i + 1}
                </span>
                <label className="flex-1">
                  <span className="sr-only">{s.label}</span>
                  <input
                    type="text"
                    value={notes[i] ?? ""}
                    onChange={(e) =>
                      setNotes((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                    placeholder={s.label}
                    maxLength={60}
                    className="w-full rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2.5 py-1 text-xs text-ink-900 dark:text-white placeholder:text-ink-400 dark:placeholder:text-ink-500 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {showExample && (
        <div className="border-t border-ink-100 dark:border-ink-700 bg-ink-50/60 dark:bg-ink-800/60 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Lightbulb
              className="size-3 text-brand-purple dark:text-brand-lavender"
              strokeWidth={2.5}
              aria-hidden="true"
            />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-purple dark:text-brand-lavender">
              Worked example
            </p>
            <p className="ml-2 truncate text-[11px] italic text-ink-500 dark:text-ink-400">
              {framework.exampleScenario}
            </p>
          </div>
          <ol className="mt-2 space-y-2">
            {framework.sections.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="brand-gradient mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                    {s.label}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-ink-800 dark:text-ink-100">
                    {s.example}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[10px] italic text-ink-400 dark:text-ink-500">
            Your rep is about your own prompt — this is just what hitting the shape sounds like.
          </p>
        </div>
      )}
    </div>
  );
}
