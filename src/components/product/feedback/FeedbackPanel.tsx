"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowUpRight, Share2 } from "lucide-react";
import { motion } from "motion/react";
import type { Callout, RepScore, SkillDimension } from "@/types/domain";
import { FeedbackRatingTile } from "../FeedbackRatingTile";
import { AudioControlProvider } from "./AudioControlContext";
import { RepProgressStrip } from "./RepProgressStrip";
import { LastRepFocusBanner } from "./LastRepFocusBanner";
import { ScoreHero } from "./ScoreHero";
import { CoachFocusCard } from "./CoachFocusCard";
import { DimensionGrid } from "./DimensionGrid";
import {
  deriveCoachFocus,
  deriveRetryFocus,
  type TopWeakness,
} from "@/lib/ai/coach-focus";
import { RepAudioScrubber } from "./RepAudioScrubber";
import { ExemplarModal } from "./ExemplarModal";
import type { DimensionGridHandle } from "./DimensionGrid";
import { pickExemplar } from "@/lib/ai/exemplars";
import { isPressureArchetypeId } from "@/lib/ai/pressure-archetypes";

export type PreviousRepSummary = {
  composite: number;
  dimensions: { dimension: SkillDimension; score: number }[];
  /** Shared shape from deriveTopWeakness — v4 reps build it from the
   *  Coach's Focus (callouts are empty by contract); a full legacy
   *  Callout is structurally assignable. */
  topWeakness: TopWeakness | null;
  transcript: string;
  promptText: string;
  /** Phase 2: verbatim previous-rep headline. Plumbed into the next rep's
   *  scoring call (`modeContext.previousRepFocus.headline`) so the AI can
   *  write continuation copy. Optional — legacy reps and the very first
   *  rep of a session won't have it. */
  headline?: string;
  /** Phase 2: when the previous rep was a pressure rep, this is the
   *  archetype id. */
  pressureArchetypeId?: string | null;
  /** Phase 3: AI-authored 3-8 word continuation tail. Becomes the tail of
   *  the NEXT rep's LastRepFocusBanner ("Last rep focus: structure — {tail}").
   *  Falls back to static copy.ts lookup when absent. */
  nextRepHint?: string;
};

type Props = {
  score: RepScore;
  audioUrl?: string;
  durationMs: number;
  /** Kept for forward compat — per-dimension quotes live inside expanded
   *  DimensionCards. */
  transcript?: string;
  /** Kept for forward compat with word-level grounding. */
  words?: { word: string; startMs: number; endMs: number }[];
  previousRepSummary?: PreviousRepSummary | null;
  previousDimensionScores?: Partial<Record<SkillDimension, number>>;
  repId?: string | null;
  calloutIds?: string[];
  pressureContext?: {
    archetypeName: string;
    archetypeTagline: string;
  } | null;
  /** 1-based. */
  repIndex?: number;
  totalReps?: number;
  /** Pre-formatted, uppercase. Empty string omits the separator chip. */
  modeLabel?: string;
  /** Pulled from the rep before this one. Renders the LastRepFocusBanner
   *  when present. `customHint` overrides the static copy.ts tail when the
   *  previous rep's AI scoring emitted a `nextRepHint`. */
  lastRepFocus?: { dimension: SkillDimension; customHint?: string } | null;
  /** When provided, RepProgressStrip shows "Save and exit". */
  onSaveExit?: () => void;
  /** Per-rep mode signals so the dimension grid can apply mode-aware
   *  emphasis (focus mode pins focusDimension top-left, pressure mode
   *  reorders by stressedDimensions). */
  modeSignals?: {
    sessionType: "focus" | "combined" | "flow";
    focusDimension?: SkillDimension;
    pressureArchetypeId?: string;
  };
};

const STAGGER_SEC = 0.06;

/**
 * The rep feedback surface — PRD §4.5 (grading v3 clean break):
 * Communication Score → ONE Coach's Focus → expandable Core Skill
 * Breakdown. The legacy did-well / didn't-land / next-rep-focus layout
 * was retired in Phase 3 (§4.5.3: those sections "do not exist").
 */
export function FeedbackPanel({
  score,
  audioUrl,
  durationMs,
  repId,
  calloutIds = [],
  pressureContext,
  repIndex,
  totalReps,
  modeLabel = "",
  lastRepFocus,
  onSaveExit,
  modeSignals,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<DimensionGridHandle>(null);
  const [exemplarOpen, setExemplarOpen] = useState(false);

  // One memoized derivation — the exemplar picker below and the Coach's
  // Focus card both read it (the legacy chain walks bullet/callout
  // arrays, so re-deriving on every audio-scrubber render adds up).
  const focus = useMemo(() => deriveCoachFocus(score), [score]);

  // Compute the matching exemplar once per render, from the same focus
  // the Coach's Focus card shows. Archetype-specific variants win when
  // this is a pressure rep.
  const exemplar = useMemo(() => {
    const primaryDim = focus?.dimension ?? null;
    if (!primaryDim) return null;
    const rawArchetype = modeSignals?.pressureArchetypeId;
    const archetypeId =
      rawArchetype && isPressureArchetypeId(rawArchetype)
        ? rawArchetype
        : null;
    return pickExemplar({
      dimension: primaryDim,
      archetypeId,
    });
  }, [focus, modeSignals]);

  const formattedDuration = useMemo(() => {
    const total = Math.floor(durationMs / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [durationMs]);

  const headline = useMemo(
    () => score.headline ?? fallbackHeadline(score.composite),
    [score.headline, score.composite],
  );

  // §4.6 Stronger Version — same shared derivation the retry surfaces
  // use (v4 first-class field, legacy callout-rewrite fallback).
  const strongerVersion = useMemo(
    () => deriveRetryFocus(score)?.strongerVersion ?? null,
    [score],
  );

  // Resolve callout → DB id by reference equality (parallel arrays).
  const getCalloutId = useMemo(() => {
    return (callout: Callout): string | null => {
      const idx = score.callouts.indexOf(callout);
      if (idx < 0) return null;
      return calloutIds[idx] ?? null;
    };
  }, [score.callouts, calloutIds]);

  const seekToMs = (ms: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, ms / 1000);
    a.play().catch(() => {});
  };

  const expandDimension = (
    dim: SkillDimension | "structural_adherence",
  ) => {
    if (dim === "structural_adherence") return;
    gridRef.current?.open(dim);
    heroRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const showProgressStrip =
    typeof repIndex === "number" && typeof totalReps === "number";

  return (
    <AudioControlProvider value={{ seekToMs, expandDimension, getCalloutId }}>
      <div className="space-y-5">
        {pressureContext && (
          <Section delay={0}>
            <div
              role="status"
              className="overflow-hidden rounded-2xl border border-amber-300 dark:border-amber-500/40 bg-gradient-to-br from-amber-50 via-amber-50/70 to-amber-100/40 dark:from-amber-500/10 dark:via-amber-500/5 dark:to-amber-500/10 px-5 py-4"
            >
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-amber-800 dark:text-amber-300">
                You just trained · {pressureContext.archetypeName}
              </p>
              <p className="mt-1 text-sm font-semibold text-amber-950 dark:text-amber-100">
                {pressureContext.archetypeTagline} Scoring weighted this rep
                toward the dimensions the archetype stresses.
              </p>
            </div>
          </Section>
        )}

        {showProgressStrip && (
          <Section delay={0}>
            <RepProgressStrip
              repIndex={repIndex}
              totalReps={totalReps}
              modeLabel={modeLabel}
              onSaveExit={onSaveExit}
            />
          </Section>
        )}

        {lastRepFocus && (
          <Section delay={1}>
            <LastRepFocusBanner
              dimension={lastRepFocus.dimension}
              customHeadline={lastRepFocus.customHint}
            />
          </Section>
        )}

        <Section delay={2}>
          <div ref={heroRef}>
            <ScoreHero
              composite={score.composite}
              headline={headline}
              dimensions={score.dimensions}
              callouts={score.callouts}
              durationLabel={formattedDuration}
              primaryFocusDimension={score.primaryFocusDimension}
              modeSignals={modeSignals}
              hideBreakdown
            />
          </div>
        </Section>

        {focus && (
          <Section delay={3}>
            <CoachFocusCard
              focus={focus}
              strongerVersion={strongerVersion}
              onSeeExample={
                exemplar ? () => setExemplarOpen(true) : undefined
              }
            />
          </Section>
        )}
        <Section delay={4}>
          <div className="surface-card relative overflow-hidden">
            <div className="p-5 md:p-6">
              <DimensionGrid
                ref={gridRef}
                dimensions={score.dimensions}
                callouts={score.callouts}
                primaryFocusDimension={score.primaryFocusDimension}
                modeSignals={modeSignals}
              />
            </div>
          </div>
        </Section>

        <ExemplarModal
          open={exemplarOpen}
          exemplar={exemplar}
          onClose={() => setExemplarOpen(false)}
        />

        {audioUrl && (
          <Section delay={6}>
            <RepAudioScrubber
              src={audioUrl}
              durationMs={durationMs}
              audioRef={audioRef}
            />
          </Section>
        )}

        {/* ——— Calibration & flywheel (demoted) ———————————————— */}
        <Section delay={7}>
          <div className="space-y-3 border-t border-ink-200 dark:border-ink-700 pt-5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-400 dark:text-ink-500">
              Help us improve
            </p>
            <FeedbackRatingTile repId={repId ?? null} />
            {repId && (
              <div className="rounded-2xl border border-brand-purple/20 bg-brand-purple/5 p-5">
                <div className="flex items-start gap-3">
                  <div className="brand-gradient grid size-10 shrink-0 place-items-center rounded-xl shadow-sm">
                    <Share2
                      className="size-5 text-white"
                      strokeWidth={2.5}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-purple dark:text-brand-lavender">
                      Want human feedback?
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink-900 dark:text-white">
                      Send this rep to 3 friends for a blind ranking.
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
                      No scores, no names. They rank your attempts on which
                      landed best. Pure human signal — the proof the algorithm
                      can&rsquo;t fake.
                    </p>
                    <Link
                      href="/validate/new"
                      className="brand-gradient mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:shadow-md"
                    >
                      Set up blind ranking
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Section>
      </div>
    </AudioControlProvider>
  );
}

/** Per-section staggered entrance. `delay` is the section index (0-based);
 *  the actual delay = index * STAGGER_SEC. */
function Section({
  delay,
  children,
}: {
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: delay * STAGGER_SEC,
        duration: 0.4,
        ease: [0.32, 0.72, 0, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

/** Deterministic fallback when score.headline is missing (legacy reps). */
function fallbackHeadline(composite: number): string {
  if (composite < 50) return "That rep didn't land — see the breakdown below.";
  if (composite < 75)
    return "Solid bones. The breakdown below names what to tighten.";
  if (composite < 90) return "Strong rep. Sharpen one moment and this is a 90.";
  return "Nothing to fix here. Stretch yourself with a harder prompt.";
}
