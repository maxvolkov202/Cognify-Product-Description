"use client";

import { useEffect, useMemo, useRef } from "react";
import { Sparkles } from "lucide-react";
import { motion } from "motion/react";
import type { SkillDimension } from "@/types/domain";
import type { SubSkillId } from "@/types/sub-skills";
import { DIMENSION_LABELS } from "@/types/domain";
import { pickHintsForRep } from "@/lib/ai/hints/select";
import { cn } from "@/lib/utils/cn";

const SESSION_STORAGE_KEY = "cognify:hints:seen";

type Props = {
  /** Focus dimension for this rep — drives hint pool. */
  dimension: SkillDimension;
  /** Optional weakness signal: prefer hints from these sub-skills first.
   *  Caller derives from running averages or the user's recent low-scoring
   *  callouts. */
  weakestSubSkills?: readonly SubSkillId[];
  /** Stable seed (e.g. repId) so hints don't reshuffle on rerender. */
  seed?: string;
  /** Number of hints to render. Default 2 per DNA spec. */
  count?: number;
  className?: string;
};

/**
 * Cognify DNA Ch.6 — start-rep delivery hints surface.
 *
 * Shows 2 short, neuroscience-backed cues drawn from the rep's focus
 * dimension's sub-skills. Stratified via session storage so the same
 * hint doesn't appear twice in a single session. Stable seed (repId)
 * prevents shuffling on rerender.
 */
export function RepHintsBar({
  dimension,
  weakestSubSkills,
  seed,
  count = 2,
  className,
}: Props) {
  const seenRef = useRef<Set<string> | null>(null);
  if (seenRef.current === null) {
    seenRef.current = readSeen();
  }

  const hints = useMemo(
    () =>
      pickHintsForRep(
        {
          dimension,
          weakestSubSkills,
          seenHintTexts: seenRef.current ?? new Set(),
          count,
        },
        { seed },
      ),
    [dimension, weakestSubSkills, seed, count],
  );

  // Persist the picked hints to session storage so the next rep in the
  // same session won't repeat them.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = readSeen();
    for (const h of hints) seen.add(h.text);
    try {
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify(Array.from(seen)),
      );
    } catch {
      // sessionStorage unavailable (private mode, quota) — silently skip
    }
  }, [hints]);

  if (hints.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className={cn(
        "rounded-xl border border-brand-purple/20 bg-white/70 p-3.5 backdrop-blur-sm",
        className,
      )}
      aria-label={`Delivery hints for ${DIMENSION_LABELS[dimension]}`}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand-purple">
        <Sparkles className="size-3" strokeWidth={2.5} aria-hidden="true" />
        Apply during this rep
      </p>
      <ul className="mt-2 space-y-1.5">
        {hints.map((h, i) => (
          <li
            key={`${h.text}-${i}`}
            className="flex gap-2 text-[13px] leading-snug text-ink-700"
          >
            <span
              className="brand-gradient mt-1.5 size-1.5 shrink-0 rounded-full"
              aria-hidden="true"
            />
            <span>{h.text}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function readSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((s): s is string => typeof s === "string"));
  } catch {
    return new Set();
  }
}
