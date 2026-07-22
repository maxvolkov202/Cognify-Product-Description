"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Flame, Sparkles, Mic, Zap } from "lucide-react";
import { DIMENSION_LABELS } from "@/types/domain";
import type { SkillDimension } from "@/types/domain";

function timeOfDayGreeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Nightly Cognify";
}

type Props = {
  firstName: string;
  streakDays: number;
  freezesAvailable: number;
  activeToday: boolean;
  avgRecent: number | null;
  baselineComposite: number | null;
  focusDim: SkillDimension | null;
  focusDimScore: number | null;
  /** PRD v3 Phase 7.4 — Overall Communication Score (profile EMA, null
   *  until ≥3 core skills measured) + stage-benchmark footnote. Renders
   *  a fourth vital sign when present (FF_RANK_SYSTEM server-gated). */
  communicationScore?: number | null;
  communicationScoreNote?: string | null;
};

/**
 * Dashboard hero card. Brand-gradient wash, animated mascot, three vital
 * signs (streak / last 5 avg / today's focus), and the primary "Start
 * workout" CTA. The live numbers come from server-fetched data — this
 * component is the client island purely for the mascot pulse + hover.
 */
export function DashboardHero({
  firstName,
  streakDays,
  freezesAvailable,
  activeToday,
  avgRecent,
  baselineComposite,
  focusDim,
  focusDimScore,
  communicationScore = null,
  communicationScoreNote = null,
}: Props) {
  // Compute greeting on the client after mount to avoid SSR/CSR mismatch
  // when the server's TZ != the user's. Server renders the neutral
  // "Welcome back" eyebrow, client upgrades it to time-of-day.
  const [greeting, setGreeting] = useState<string>("Welcome back");
  useEffect(() => {
    setGreeting(timeOfDayGreeting());
  }, []);

  const delta =
    avgRecent !== null && baselineComposite !== null
      ? Math.round(avgRecent - baselineComposite)
      : null;
  const deltaTone =
    delta === null
      ? null
      : delta > 0
        ? "up"
        : delta < 0
          ? "down"
          : "flat";

  return (
    <section className="relative overflow-hidden rounded-3xl border border-ink-200 bg-gradient-to-br from-white via-brand-lavender/5 to-brand-magenta/5 p-6 shadow-[0_18px_60px_-30px_rgba(176,114,255,0.5)] dark:border-ink-700 dark:from-ink-900 dark:via-ink-800 dark:to-ink-900 md:p-8">
      {/* Ambient brand halos */}
      <div
        className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full opacity-50 blur-3xl"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle, rgba(176,114,255,0.3), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-20 size-72 rounded-full opacity-40 blur-3xl"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle, rgba(106,163,255,0.25), transparent 70%)",
        }}
      />

      <div className="relative grid gap-6 md:grid-cols-[1.2fr_1.4fr] md:items-center">
        {/* Left: greeting + mascot */}
        <div>
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <motion.div
                className="brand-gradient size-9 rounded-2xl"
                animate={{ opacity: [0.85, 1, 0.85], scale: [1, 1.04, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
              <div
                className="brand-gradient pointer-events-none absolute inset-0 rounded-2xl opacity-30 blur-[6px]"
                aria-hidden="true"
              />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-purple dark:text-brand-lavender">
              {greeting}
            </p>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink-900 dark:text-white md:text-4xl">
            Hey {firstName}.
            <br />
            <span className="brand-gradient-text">Time to train.</span>
          </h1>
          <p className="mt-3 text-sm text-ink-600 dark:text-ink-300 md:text-base">
            {avgRecent !== null
              ? "Your reps are warm. Keep the streak alive."
              : "Pick up where you left off."}
          </p>
        </div>

        {/* Right: vital signs. With the optional Communication Score tile
            there are 4 tiles — lay them out as a symmetric 2×2 block so the
            4th never drops to a lonely second row. Without it, 3 tiles sit
            in a single row. */}
        <div
          className={`grid gap-2 md:gap-3 ${
            communicationScore != null ? "grid-cols-2" : "grid-cols-3"
          }`}
        >
          <VitalSign
            label="Streak"
            href="/progress"
            accent="amber"
            valueNode={
              <span className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tabular-nums text-ink-900 dark:text-white md:text-4xl">
                  {streakDays}
                </span>
                <span className="text-xs font-semibold text-ink-500 dark:text-ink-400">d</span>
              </span>
            }
            iconNode={
              <Flame
                className={
                  streakDays > 0
                    ? "size-4 text-amber-500"
                    : "size-4 text-ink-400"
                }
                strokeWidth={2.5}
              />
            }
            footnote={
              streakDays === 0
                ? "Start it today"
                : freezesAvailable > 0
                  ? `${freezesAvailable} freeze${freezesAvailable === 1 ? "" : "s"} banked`
                  : activeToday
                    ? "Trained today ✓"
                    : "Train today to keep it"
            }
          />

          <VitalSign
            label="Last 5 reps average"
            href="/progress"
            accent="purple"
            valueNode={
              <span className="brand-gradient-text text-3xl font-extrabold tabular-nums md:text-4xl">
                {avgRecent ?? "—"}
              </span>
            }
            iconNode={<Sparkles className="size-4 text-brand-purple" strokeWidth={2.5} />}
            footnote={
              deltaTone === null
                ? "No baseline yet"
                : deltaTone === "up"
                  ? `+${delta} ${Math.abs(delta!) === 1 ? "point" : "points"} from your baseline`
                  : deltaTone === "down"
                    ? `${delta} ${Math.abs(delta!) === 1 ? "point" : "points"} from your baseline`
                    : "Even with your baseline"
            }
            footnoteTone={
              deltaTone === "up"
                ? "good"
                : deltaTone === "down"
                  ? "bad"
                  : "neutral"
            }
          />

          {communicationScore != null && (
            <VitalSign
              label="Communication Score"
              href="/progress"
              accent="purple"
              valueNode={
                <span className="brand-gradient-text text-3xl font-extrabold tabular-nums md:text-4xl">
                  {Math.round(communicationScore)}
                </span>
              }
              iconNode={
                <Sparkles className="size-4 text-brand-purple" strokeWidth={2.5} />
              }
              footnote={communicationScoreNote ?? "Your all-time communication average"}
            />
          )}

          <VitalSign
            label="Today's focus"
            // ?focus= keeps this deep-linking into the dimension drill —
            // /application-lab redirects to /drills under FF_SKILL_LAB_APPS (D9).
            href={focusDim ? `/application-lab?focus=${focusDim}` : "/application-lab"}
            accent="brand"
            valueNode={
              <span className="truncate text-base font-extrabold leading-tight text-ink-900 dark:text-white sm:text-lg md:text-xl">
                {focusDim ? DIMENSION_LABELS[focusDim] : "Pick one"}
              </span>
            }
            iconNode={<Zap className="size-4 text-brand-magenta" strokeWidth={2.5} />}
            footnote={
              focusDim && focusDimScore !== null
                ? `Currently ${focusDimScore} — train it`
                : focusDim
                  ? "Untrained — train it"
                  : "Pick a skill to drill"
            }
          />
        </div>
      </div>

      {/* Bottom: primary CTA + secondary link */}
      <div className="relative mt-6 flex flex-wrap items-center gap-3 border-t border-ink-200/60 pt-5 dark:border-ink-700/60">
        <Link
          href="/workout"
          className="brand-gradient animate-sheen inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-white shadow-[0_12px_32px_-10px_rgba(151,136,255,0.6)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <Mic className="size-4" strokeWidth={2.5} />
          Start today&rsquo;s workout
          <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            3 exercises · ~6 min
          </span>
        </Link>
        <Link
          href="/build-a-rep"
          className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-4 py-2.5 text-xs font-bold text-ink-700 transition hover:border-brand-purple/40 hover:bg-brand-lavender/5 hover:text-ink-900 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100 dark:hover:border-brand-purple/50 dark:hover:bg-ink-700 dark:hover:text-white"
        >
          Build a single rep <ArrowRight className="size-3.5" strokeWidth={2.5} />
        </Link>
      </div>
    </section>
  );
}

function VitalSign({
  label,
  valueNode,
  iconNode,
  footnote,
  footnoteTone = "neutral",
  href,
  accent,
}: {
  label: string;
  valueNode: React.ReactNode;
  iconNode: React.ReactNode;
  footnote: string;
  footnoteTone?: "good" | "bad" | "neutral";
  href: string;
  accent: "amber" | "purple" | "brand";
}) {
  const accentBg =
    accent === "amber"
      ? "bg-amber-50/60 group-hover:bg-amber-50 dark:bg-amber-500/10 dark:group-hover:bg-amber-500/15"
      : accent === "purple"
        ? "bg-brand-purple/5 group-hover:bg-brand-purple/10 dark:bg-brand-purple/10 dark:group-hover:bg-brand-purple/20"
        : "bg-gradient-to-br from-brand-blue/5 via-brand-lavender/5 to-brand-magenta/10 group-hover:from-brand-blue/10 group-hover:to-brand-magenta/20 dark:from-brand-blue/10 dark:via-brand-lavender/10 dark:to-brand-magenta/15";
  const tone =
    footnoteTone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : footnoteTone === "bad"
        ? "text-rose-600 dark:text-rose-400"
        : "text-ink-500 dark:text-ink-400";
  return (
    <Link
      href={href as never}
      className={`group flex flex-col gap-1.5 rounded-2xl border border-ink-200/80 p-3 transition hover:-translate-y-0.5 hover:border-ink-300 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.1)] dark:border-ink-700/80 dark:hover:border-ink-600 md:p-4 ${accentBg}`}
    >
      <div className="flex min-w-0 items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-ink-500 dark:text-ink-400 sm:text-[10px] sm:tracking-[0.14em]">
        {iconNode}
        {label}
      </div>
      <div className="flex-1">{valueNode}</div>
      <p className={`text-[11px] font-medium ${tone}`}>{footnote}</p>
    </Link>
  );
}

