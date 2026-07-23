"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Layers,
  Eye,
  EyeOff,
  Lightbulb,
  PenLine,
  Shuffle,
  Check,
  X,
  Plus,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { REP_TYPES, type RepTypeFramework } from "@/lib/ai/rep-types";
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
  /** Phase 5 (5.3/5.4) — expose "shuffle" (swap to another suggested
   *  framework) and a pencil editor (rename + edit/add/remove steps, or make
   *  your own). Server-resolved from FF_REP_FRAMEWORK_EDIT. The framework is a
   *  display-only suggestion and is NEVER sent to scoring, so shuffling/editing
   *  it changes nothing about the grade. */
  editEnabled?: boolean;
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

/** All built-in suggested frameworks (one per rep type) — the shuffle pool. */
const ALL_FRAMEWORKS: readonly RepTypeFramework[] = REP_TYPES.map(
  (rt) => rt.framework,
);

/**
 * Compact framework cheat-sheet strip shown during Daily Workout reps.
 * Labeled "Suggested Framework" (Phase 5.2) — it's a shape you can follow, not
 * something you're graded on. Shows section chips; tapping a chip reveals its
 * one-sentence hint. The user can:
 *   - hide the whole strip to practice blind
 *   - reveal a worked example to see what hitting each section sounds like
 *   - (when editEnabled) shuffle to a different suggested framework, or open
 *     the pencil editor to rename it / edit its steps / build their own
 *
 * Shuffle + edits are session-scoped local state and never reach the scorer.
 * Not shown in Build-a-Rep — that mode has the full TalkingPointsSidebar.
 */
export function RepFrameworkStrip({
  framework,
  defaultExpanded = true,
  allowNotes = false,
  notesKey,
  editEnabled = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [showExample, setShowExample] = useState(false);
  // Phase 5 (5.3/5.4) — the framework the user is actually looking at. Starts
  // as the suggested one; shuffle/edit replace it with a new object (session
  // only). When editEnabled is false this never changes → identical behavior.
  const [activeFramework, setActiveFramework] =
    useState<RepTypeFramework>(framework);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState<string[]>(() =>
    framework.sections.map(() => ""),
  );
  // Notes panel is opt-in: always starts closed so a fresh rep screen
  // doesn't shove the input at users. If the mount-effect below finds
  // persisted non-empty notes (user has unsaved drafts from a prior
  // session), it re-opens the panel so those drafts are visible.
  const [notesOpen, setNotesOpen] = useState(false);

  // Reference-compare against the prop: shuffle/edit create fresh objects, and
  // "Reset to suggested" restores the exact prop, so this is a clean "has the
  // user changed the suggested framework?" signal.
  const isModified = activeFramework !== framework;

  // Read the persisted notes for THIS station (keyed by notesKey), validated
  // against the suggested framework's section count — the shape they were
  // jotted against. Returns null when absent/corrupt/mismatched.
  const loadPersistedNotes = useCallback((): string[] | null => {
    if (!allowNotes || !notesKey || typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(`cognify.rep-notes.${notesKey}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (
        Array.isArray(parsed) &&
        parsed.every((v) => typeof v === "string") &&
        parsed.length === framework.sections.length
      ) {
        return parsed as string[];
      }
    } catch {
      /* corrupt JSON in storage — ignore */
    }
    return null;
  }, [allowNotes, notesKey, framework.sections.length]);

  // Restore persisted notes on mount when a notesKey is provided.
  useEffect(() => {
    const restored = loadPersistedNotes();
    if (!restored) return;
    setNotes(restored);
    // If the user previously had notes, open the panel so they see them.
    if (restored.some((s) => s.trim().length > 0)) setNotesOpen(true);
  }, [loadPersistedNotes]);

  // Debounced auto-save. Pre-fix every keystroke synchronously
  // JSON.stringified the notes array + hit localStorage (audit IN-4 /
  // prior CTO S-6). 300ms is the sweet spot: long enough to coalesce
  // a typing burst, short enough that a quick close of the screen
  // doesn't lose the draft.
  //
  // Only persisted while viewing the SUGGESTED framework: notes are anchored
  // to that shape, so when the user has shuffled/edited to a different one
  // (isModified) their jotting is session-only and must NOT overwrite the
  // saved drafts for the suggested framework.
  useEffect(() => {
    if (!allowNotes || !notesKey || typeof window === "undefined") return;
    if (isModified) return;
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
  }, [allowNotes, notesKey, notes, isModified]);

  // Switch the displayed framework (shuffle / edit save / reset). Notes are
  // anchored to a shape: reset-to-suggested restores the saved drafts; moving
  // to any other framework starts a blank (session-only) set.
  function applyFramework(next: RepTypeFramework): void {
    setActiveFramework(next);
    setNotes(
      next === framework
        ? (loadPersistedNotes() ?? framework.sections.map(() => ""))
        : next.sections.map(() => ""),
    );
    setActiveIndex(null);
    setShowExample(false);
  }

  function handleShuffle(): void {
    const pool = ALL_FRAMEWORKS.filter((f) => f.name !== activeFramework.name);
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)]!;
    applyFramework(pick);
    setEditing(false);
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-1.5 text-[11px] font-semibold text-ink-600 dark:text-ink-300 hover:border-ink-300 dark:hover:border-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800"
        title="Show framework reminder"
      >
        <Eye className="size-3.5" strokeWidth={2.5} />
        Show {activeFramework.name}
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
          Suggested Framework
        </p>
        <p className="text-xs font-bold text-ink-900 dark:text-white">
          {activeFramework.name}
        </p>
        {isModified && (
          <span className="rounded-full bg-brand-purple/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-purple dark:text-brand-lavender">
            Custom
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {editEnabled && (
            <>
              <button
                type="button"
                onClick={handleShuffle}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-ink-500 dark:text-ink-400 transition hover:bg-ink-50 dark:hover:bg-ink-800"
                title="Swap in a different framework"
              >
                <Shuffle className="size-3" strokeWidth={2.5} />
                Shuffle
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing((v) => !v);
                  setActiveIndex(null);
                  setShowExample(false);
                }}
                aria-expanded={editing}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition",
                  editing
                    ? "bg-brand-purple/10 text-brand-purple dark:text-brand-lavender"
                    : "text-ink-500 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800",
                )}
                title="Edit or build your own"
              >
                <PenLine className="size-3" strokeWidth={2.5} />
                Edit
              </button>
            </>
          )}
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
              setEditing(false);
            }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-ink-500 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800"
            title="Hide framework"
          >
            <EyeOff className="size-3" strokeWidth={2.5} />
            Hide
          </button>
        </div>
      </div>

      {editing ? (
        <FrameworkEditor
          framework={activeFramework}
          canReset={isModified}
          onSave={(next) => {
            applyFramework(next);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          onReset={() => {
            applyFramework(framework);
            setEditing(false);
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 px-4 py-2.5">
            {activeFramework.sections.map((s, i) => {
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

          {activeIndex !== null && activeFramework.sections[activeIndex]?.hint && (
            <div className="border-t border-ink-100 dark:border-ink-700 bg-brand-purple/5 dark:bg-brand-purple/10 px-4 py-2.5 text-xs leading-relaxed text-ink-800 dark:text-ink-100">
              <span className="font-semibold text-brand-purple dark:text-brand-lavender">
                {activeFramework.sections[activeIndex]!.label}:
              </span>{" "}
              {activeFramework.sections[activeIndex]!.hint}
            </div>
          )}
        </>
      )}

      {allowNotes && notesOpen && !editing && (
        <div className="border-t border-ink-100 dark:border-ink-700 bg-ink-50/50 dark:bg-ink-800/50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
            Jot a few words per section · optional · anchors your rep
          </p>
          <div className="mt-2 grid gap-2">
            {activeFramework.sections.map((s, i) => (
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
                    maxLength={120}
                    className="w-full rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2.5 py-1 text-xs text-ink-900 dark:text-white placeholder:text-ink-400 dark:placeholder:text-ink-500 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {showExample && !editing && (
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
              {activeFramework.exampleScenario}
            </p>
          </div>
          <ol className="mt-2 space-y-2">
            {activeFramework.sections.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="brand-gradient mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                    {s.label}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-ink-800 dark:text-ink-100">
                    {s.example || "—"}
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

/**
 * Phase 5 (5.4) — inline editor for the suggested framework. Rename it, edit
 * each step's label, add or remove steps, or build one from scratch. Draft
 * state is local; Save lifts it back to the strip. Original hints/examples are
 * preserved per-index where they still exist so the "See example" view keeps
 * working after light edits. Never sent to scoring.
 */
function FrameworkEditor({
  framework,
  canReset,
  onSave,
  onCancel,
  onReset,
}: {
  framework: RepTypeFramework;
  canReset: boolean;
  onSave: (next: RepTypeFramework) => void;
  onCancel: () => void;
  onReset: () => void;
}) {
  const [name, setName] = useState(framework.name);
  // Hold full section objects (not just labels) so each step keeps its own
  // hint/example through add/remove/reorder — no re-deriving metadata from a
  // shifting index.
  const [sections, setSections] = useState<
    { label: string; hint: string; example: string }[]
  >(() =>
    framework.sections.map((s) => ({
      label: s.label,
      hint: s.hint,
      example: s.example,
    })),
  );

  const trimmedName = name.trim();
  const nonEmpty = sections.filter((s) => s.label.trim().length > 0);
  const canSave = trimmedName.length > 0 && nonEmpty.length > 0;

  function save(): void {
    onSave({
      name: trimmedName,
      exampleScenario: framework.exampleScenario,
      sections: sections
        .filter((s) => s.label.trim().length > 0)
        .map((s) => ({
          label: s.label.trim(),
          hint: s.hint,
          example: s.example,
        })),
    });
  }

  return (
    <div className="border-t border-ink-100 dark:border-ink-700 bg-ink-50/40 dark:bg-ink-800/40 px-4 py-3">
      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
          Framework name
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name your framework"
          maxLength={60}
          className="mt-1 w-full rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2.5 py-1 text-xs font-semibold text-ink-900 dark:text-white placeholder:text-ink-400 dark:placeholder:text-ink-500 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
        />
      </label>

      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
        Steps
      </p>
      <div className="mt-1.5 grid gap-1.5">
        {sections.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="brand-gradient grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white">
              {i + 1}
            </span>
            <input
              type="text"
              value={s.label}
              onChange={(e) =>
                setSections((prev) => {
                  const next = [...prev];
                  next[i] = { ...next[i]!, label: e.target.value };
                  return next;
                })
              }
              placeholder={`Step ${i + 1}`}
              maxLength={60}
              className="flex-1 rounded-md border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2.5 py-1 text-xs text-ink-900 dark:text-white placeholder:text-ink-400 dark:placeholder:text-ink-500 focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple"
            />
            <button
              type="button"
              onClick={() =>
                setSections((prev) => prev.filter((_, j) => j !== i))
              }
              disabled={sections.length <= 1}
              title="Remove step"
              className="grid size-6 shrink-0 place-items-center rounded-md text-ink-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
            >
              <Trash2 className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
              <span className="sr-only">Remove step {i + 1}</span>
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          setSections((prev) => [...prev, { label: "", hint: "", example: "" }])
        }
        disabled={sections.length >= 8}
        className="mt-2 inline-flex items-center gap-1 rounded-full border border-dashed border-ink-300 dark:border-ink-600 px-2.5 py-1 text-[10px] font-semibold text-ink-500 dark:text-ink-400 transition hover:border-brand-purple hover:text-brand-purple disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-brand-lavender"
      >
        <Plus className="size-3" strokeWidth={2.5} />
        Add step
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="brand-gradient inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="size-3.5" strokeWidth={2.5} />
          Save framework
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-1.5 text-[11px] font-semibold text-ink-600 dark:text-ink-300 transition hover:border-ink-300 dark:hover:border-ink-600"
        >
          <X className="size-3.5" strokeWidth={2.5} />
          Cancel
        </button>
        {canReset && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-ink-500 dark:text-ink-400 transition hover:text-brand-purple dark:hover:text-brand-lavender"
          >
            <RotateCcw className="size-3.5" strokeWidth={2.5} />
            Reset to suggested
          </button>
        )}
      </div>
    </div>
  );
}
