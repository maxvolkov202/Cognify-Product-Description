"use client";

import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, ArrowRight } from "lucide-react";
import { DIMENSION_LABELS } from "@/types/domain";
import type { SkillDimension } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

type Summary = {
  weekStartISO: string;
  weekEndISO: string;
  repCount: number;
  averageComposite: number;
  dimensions: {
    dimension: SkillDimension;
    avg: number | null;
    delta: number | null;
  }[];
  bestArchetype: { name: string; avg: number } | null;
  weakestDimension: SkillDimension | null;
};

type Narrative = {
  paragraph: string;
  hookStat: string;
  nextFocus: string;
};

type CachedPayload = {
  weekStartISO: string;
  summary: Summary;
  narrative: Narrative;
  cachedAt: number;
};

const CACHE_KEY = "cognify_weekly_narrative_v1";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Weekly narrative on /progress — WS-7 Phase 7.2. Fetches a Claude-
 * generated coaching paragraph grounded in the user's last 7 days of
 * rep data. Cached client-side so repeat visits in the same week don't
 * re-hit the API. Refresh button forces a regen.
 *
 * Server-side caching (DB `weekly_reports` table) is a follow-up when
 * we need cross-device consistency or email digests.
 */
export function WeeklyNarrativeCard() {
  const [payload, setPayload] = useState<CachedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchNarrative(force: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/weekly-narrative", {
        // `no-store` when forced, otherwise default (server is already
        // dynamic). Cache-busting at the API layer isn't strictly
        // needed but costs nothing.
        cache: force ? "no-store" : "default",
      });
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      const data = (await res.json()) as {
        summary: Summary;
        narrative: Narrative;
      };
      const next: CachedPayload = {
        ...data,
        weekStartISO: data.summary.weekStartISO,
        cachedAt: Date.now(),
      };
      setPayload(next);
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      } catch {
        // localStorage unavailable — non-fatal.
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Try cache first
    let cached: CachedPayload | null = null;
    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      if (raw) cached = JSON.parse(raw) as CachedPayload;
    } catch {
      cached = null;
    }
    const fresh =
      cached &&
      typeof cached.cachedAt === "number" &&
      Date.now() - cached.cachedAt < CACHE_TTL_MS;

    // Need to fetch if: no cache, stale cache, or cache is for a
    // different ISO week.
    const serverWeekStart = getMondayISO();
    const cachedIsCurrentWeek =
      cached?.weekStartISO === serverWeekStart;

    if (cached && fresh && cachedIsCurrentWeek) {
      setPayload(cached);
      setLoading(false);
    } else {
      void fetchNarrative(false);
    }
  }, []);

  if (loading && !payload) {
    return (
      <div className="surface-card animate-pulse p-5">
        <div className="h-3 w-24 rounded bg-ink-100 dark:bg-ink-800" />
        <div className="mt-3 h-4 w-3/4 rounded bg-ink-100 dark:bg-ink-800" />
        <div className="mt-2 h-4 w-1/2 rounded bg-ink-100 dark:bg-ink-800" />
      </div>
    );
  }
  if (!payload) {
    return (
      <div className="surface-card p-5">
        <p className="text-sm text-ink-500 dark:text-ink-400">
          Weekly recap unavailable.{" "}
          <button
            type="button"
            onClick={() => fetchNarrative(true)}
            className="font-semibold text-brand-purple hover:text-brand-magenta"
          >
            Try again
          </button>
          {error ? ` (${error})` : ""}
        </p>
      </div>
    );
  }

  const { summary, narrative } = payload;

  return (
    <div className="surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="p-6 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-purple">
              This week · {formatRange(summary.weekStartISO, summary.weekEndISO)}
            </p>
            <h2 className="mt-2 text-xl font-extrabold tracking-tight text-ink-900 md:text-2xl dark:text-white">
              <Sparkles
                className="-mt-1 mr-1.5 inline-block size-4 text-brand-purple"
                aria-hidden="true"
              />
              {narrative.hookStat}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => fetchNarrative(true)}
            disabled={loading}
            aria-label="Regenerate weekly narrative"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-500 transition hover:border-ink-300 hover:text-ink-900 disabled:opacity-40 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-400 dark:hover:border-ink-600 dark:hover:text-white"
          >
            <RefreshCw
              className={cn("size-3.5", loading && "animate-spin")}
              aria-hidden="true"
            />
          </button>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-ink-800 dark:text-ink-200">
          {narrative.paragraph}
        </p>

        {summary.repCount > 0 && (
          <div className="mt-5 flex flex-wrap gap-3 border-t border-ink-200/70 pt-4 dark:border-ink-700/70">
            {summary.dimensions
              .filter((d) => d.avg !== null)
              .map((d) => (
                <div
                  key={d.dimension}
                  className="flex items-baseline gap-1.5 rounded-full bg-ink-50 px-3 py-1 text-[11px] dark:bg-ink-800"
                >
                  <span className="font-semibold text-ink-700 dark:text-ink-300">
                    {DIMENSION_LABELS[d.dimension]}
                  </span>
                  <span className="font-mono tabular-nums text-ink-900 dark:text-white">
                    {d.avg}
                  </span>
                  {d.delta !== null && d.delta !== 0 && (
                    <span
                      className={cn(
                        "font-mono text-[10px] tabular-nums",
                        d.delta > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400",
                      )}
                    >
                      {d.delta > 0 ? `+${d.delta}` : d.delta}
                    </span>
                  )}
                </div>
              ))}
          </div>
        )}

        <div className="mt-5 flex items-start gap-2 rounded-xl bg-brand-purple/5 px-4 py-3 dark:bg-brand-purple/10">
          <ArrowRight className="mt-0.5 size-4 shrink-0 text-brand-purple" />
          <p className="text-sm font-semibold text-ink-800 dark:text-ink-200">
            {narrative.nextFocus}
          </p>
        </div>
      </div>
    </div>
  );
}

function getMondayISO(): string {
  const now = new Date();
  const dayOfWeek = (now.getUTCDay() + 6) % 7;
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - dayOfWeek);
  return d.toISOString().slice(0, 10);
}

function formatRange(startISO: string, endISO: string): string {
  try {
    const s = new Date(`${startISO}T00:00:00Z`);
    const e = new Date(`${endISO}T00:00:00Z`);
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(s)} – ${fmt(e)}`;
  } catch {
    return `${startISO} – ${endISO}`;
  }
}
