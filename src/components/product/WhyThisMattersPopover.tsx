"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, X, CheckCircle2, AlertTriangle } from "lucide-react";
import type { SkillDimension } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

type Excerpt = {
  dimension: SkillDimension;
  title: string;
  definition: string;
  /** Ch.18 — chosen-because paragraph from the skill MD's "Why we chose
   *  this" section. When present, rendered at the top of the popover
   *  before the definition so users see the rubric philosophy first. */
  chosenBecause?: string;
  highSignal: string[];
  lowSignal: string[];
  sources: string[];
};

// Cache fetched excerpts for the lifetime of the session — the MD files
// change only on deploy and there's no per-user data.
const cache = new Map<SkillDimension, Excerpt>();

/**
 * "Why this matters" link + popover. Visible grounding for a scoring
 * callout — shows the definition, the high/low signals, and the real
 * experts behind the rubric. Pulls from /api/knowledge/[dim] which
 * parses the skill's knowledge MD.
 */
export function WhyThisMattersPopover({
  dimension,
  className,
}: {
  dimension: SkillDimension;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [excerpt, setExcerpt] = useState<Excerpt | null>(
    cache.get(dimension) ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || excerpt || loading) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/knowledge/${dimension}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as Excerpt;
      })
      .then((data) => {
        if (cancelled) return;
        cache.set(dimension, data);
        setExcerpt(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Load failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, dimension, excerpt, loading]);

  // Close on Esc or click outside.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(t) &&
        triggerRef.current &&
        !triggerRef.current.contains(t)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-ink-500 hover:bg-ink-100 hover:text-ink-800"
      >
        <BookOpen className="size-3" aria-hidden="true" />
        Why this matters
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={`Why ${dimension} matters`}
          className="absolute left-0 z-50 mt-2 w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-ink-200 bg-white p-4 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-purple">
                Scoring grounded in research
              </p>
              <h4 className="mt-0.5 text-base font-extrabold text-ink-900">
                {excerpt?.title ?? capitalize(dimension)}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 text-ink-400 hover:text-ink-700"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          {loading && (
            <p className="mt-3 text-xs text-ink-500">Loading excerpt…</p>
          )}
          {error && (
            <p className="mt-3 text-xs text-danger">
              Couldn&rsquo;t load the knowledge excerpt. ({error})
            </p>
          )}

          {excerpt && (
            <div className="mt-3 space-y-3 text-sm">
              {excerpt.chosenBecause && (
                <div className="rounded-xl border border-brand-purple/20 bg-brand-purple/5 p-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-purple">
                    Why we chose this
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-700">
                    {excerpt.chosenBecause}
                  </p>
                </div>
              )}
              <p className="text-ink-700">{excerpt.definition}</p>

              {excerpt.highSignal.length > 0 && (
                <Bullets
                  title="What great sounds like"
                  items={excerpt.highSignal}
                  icon={<CheckCircle2 className="size-3 text-success" />}
                />
              )}
              {excerpt.lowSignal.length > 0 && (
                <Bullets
                  title="What low sounds like"
                  items={excerpt.lowSignal}
                  icon={<AlertTriangle className="size-3 text-danger" />}
                />
              )}

              {excerpt.sources.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    Sources
                  </p>
                  <ul className="mt-1 space-y-0.5 text-[11px] leading-snug text-ink-600">
                    {excerpt.sources.map((s) => (
                      <li key={s}>— {s}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="pt-1 text-[10px] text-ink-400">
                Full research and citations:{" "}
                <a
                  href="/about/references"
                  className="underline hover:text-ink-700"
                >
                  /about/references
                </a>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Bullets({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
        {title}
      </p>
      <ul className="mt-1 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[13px] text-ink-700">
            <span className="mt-0.5 shrink-0">{icon}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
