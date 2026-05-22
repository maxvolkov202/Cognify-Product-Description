"use client";

// Phase 11 — promo strip at the top of /skill-lab linking back to
// /workout when today's muscle-group day is unfinished. Hides itself
// once today's day reaches `complete`.

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { fetchTodayPromoState } from "@/server/actions/skill-lab-promo";

type PromoState =
  | { kind: "loading" }
  | { kind: "hidden" }
  | {
      kind: "show";
      dimensionLabel: string;
      repsRemaining: number;
    };

export default function SkillLabDailyPromo() {
  const [state, setState] = useState<PromoState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchTodayPromoState().then((res) => {
      if (cancelled) return;
      setState(res);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind !== "show") return null;

  return (
    <Link
      href="/workout"
      onClick={() => {
        if (process.env.NODE_ENV !== "production") {
          console.log(
            JSON.stringify({
              ts: new Date().toISOString(),
              event: "skill_lab_daily_promo_clicked",
            }),
          );
        }
      }}
      className={cn(
        "block rounded-xl border border-pink-500/30 bg-pink-500/10",
        "px-4 py-3 mb-4 hover:bg-pink-500/15 transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400",
      )}
    >
      <div className="flex items-center gap-3">
        <Sparkles className="w-4 h-4 text-pink-300 shrink-0" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-100">
            Today&apos;s {state.dimensionLabel} day is waiting
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {state.repsRemaining} rep{state.repsRemaining === 1 ? "" : "s"}{" "}
            left. ~{Math.max(2, state.repsRemaining * 2)} minutes.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-pink-200">
          Start workout
          <ArrowRight className="w-3.5 h-3.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
