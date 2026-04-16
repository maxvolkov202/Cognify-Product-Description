"use client";

import { useState } from "react";
import { Layers, Eye, EyeOff, Lightbulb } from "lucide-react";
import type { RepTypeFramework } from "@/lib/ai/rep-types";
import { cn } from "@/lib/utils/cn";

type Props = {
  framework: RepTypeFramework;
  /** Starts hidden if false (useful when the user wants to practice blind). */
  defaultExpanded?: boolean;
};

/**
 * Compact framework cheat-sheet strip shown during Daily Workout reps.
 * Fixed per rep-type, not editable. Shows section chips; tapping a chip
 * reveals its one-sentence hint. User can:
 *   - hide the whole strip to practice blind
 *   - reveal a worked example to see what hitting each section sounds like
 *
 * Not shown in Build-a-Rep — that mode has the full TalkingPointsSidebar.
 */
export function RepFrameworkStrip({ framework, defaultExpanded = true }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [showExample, setShowExample] = useState(false);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-600 hover:border-ink-300 hover:bg-ink-50"
        title="Show framework reminder"
      >
        <Eye className="size-3.5" strokeWidth={2.5} />
        Show {framework.name}
      </button>
    );
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-2.5">
        <div className="brand-gradient grid size-6 shrink-0 place-items-center rounded-md">
          <Layers className="size-3 text-white" strokeWidth={2.5} />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          Framework
        </p>
        <p className="text-xs font-bold text-ink-900">{framework.name}</p>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowExample((v) => !v)}
            aria-expanded={showExample}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition",
              showExample
                ? "bg-brand-purple/10 text-brand-purple"
                : "text-ink-500 hover:bg-ink-50",
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
            }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-ink-500 hover:bg-ink-50"
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
                  : "border-ink-200 bg-white text-ink-700 hover:border-brand-purple/50 hover:bg-brand-purple/5",
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
        <div className="border-t border-ink-100 bg-brand-purple/5 px-4 py-2.5 text-xs leading-relaxed text-ink-800">
          <span className="font-semibold text-brand-purple">
            {framework.sections[activeIndex]!.label}:
          </span>{" "}
          {framework.sections[activeIndex]!.hint}
        </div>
      )}

      {showExample && (
        <div className="border-t border-ink-100 bg-ink-50/60 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Lightbulb
              className="size-3 text-brand-purple"
              strokeWidth={2.5}
              aria-hidden="true"
            />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-purple">
              Worked example
            </p>
            <p className="ml-2 truncate text-[11px] italic text-ink-500">
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
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    {s.label}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-ink-800">
                    {s.example}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[10px] italic text-ink-400">
            Your rep is about your own prompt — this is just what hitting the shape sounds like.
          </p>
        </div>
      )}
    </div>
  );
}
