"use client";

import { Check, X } from "lucide-react";
import { motion } from "motion/react";
import type { FeedbackBullet } from "@/types/domain";
import { cn } from "@/lib/utils/cn";
import { useAudioControl } from "./AudioControlContext";

type Variant = "positive" | "negative";

/** Phase 2 rich bullet shape — grounded bullets carry quote + timestamp.
 *  When `quote` is null, the bullet renders without quote-mark styling
 *  and without the timestamp affordance, so users implicitly trust
 *  grounded ones more (anti-hallucination contract). */
type RichBullet = Pick<
  FeedbackBullet,
  "text" | "quote" | "transcriptStart" | "transcriptEnd"
>;

type Props = {
  variant: Variant;
  title: string;
  /** Rich Phase 2 bullets — preferred. */
  bullets?: RichBullet[];
  /** Phase 1 fallback when no AI-generated bullets are available — plain
   *  strings derived client-side from callout titles. */
  fallbackBullets?: string[];
  /** Link copy on the right (e.g. "See examples", "See breakdown"). When
   *  `onLinkClick` is omitted, the link is hidden. */
  linkLabel?: string;
  onLinkClick?: () => void;
};

export function OutcomeCard({
  variant,
  title,
  bullets,
  fallbackBullets,
  linkLabel,
  onLinkClick,
}: Props) {
  const { seekToMs } = useAudioControl();
  const isPositive = variant === "positive";
  const Icon = isPositive ? Check : X;
  const iconWrap = isPositive
    ? "bg-success/15 text-success"
    : "bg-danger/15 text-danger";
  const dotColor = isPositive ? "bg-success" : "bg-danger";
  const linkColor = isPositive ? "text-success" : "text-brand-purple";

  // Prefer rich bullets when supplied (and non-empty); fall back to plain
  // strings derived client-side. Empty rich array renders nothing — junk
  // reps may legitimately have zero positive bullets.
  const usingRich = bullets !== undefined;
  const richList = bullets ?? [];
  const fallbackList = fallbackBullets ?? [];

  if (usingRich && richList.length === 0) return null;
  if (!usingRich && fallbackList.length === 0) return null;

  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-3">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.1 }}
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full",
            iconWrap,
          )}
        >
          <Icon className="size-4" strokeWidth={3} aria-hidden="true" />
        </motion.span>
        <h3 className="flex-1 text-[15px] font-extrabold text-ink-900">
          {title}
        </h3>
        {onLinkClick && linkLabel && (
          <button
            type="button"
            onClick={onLinkClick}
            className={cn(
              "text-xs font-semibold transition-colors hover:opacity-80",
              linkColor,
            )}
          >
            {linkLabel}
          </button>
        )}
      </div>
      <ul className="mt-3 space-y-3">
        {usingRich
          ? richList.map((b, i) => (
              <li key={i} className="flex gap-2.5">
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    dotColor,
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-relaxed text-ink-700">
                    {b.text}
                  </p>
                  {b.quote && (
                    <blockquote
                      className="mt-1.5 rounded-lg bg-ink-50 px-3 py-1.5 text-[12px] italic leading-relaxed text-ink-600"
                      onClick={() => {
                        if (b.transcriptStart != null) seekToMs(b.transcriptStart);
                      }}
                      role={b.transcriptStart != null ? "button" : undefined}
                      style={{
                        cursor: b.transcriptStart != null ? "pointer" : "default",
                      }}
                    >
                      &ldquo;{b.quote}&rdquo;
                    </blockquote>
                  )}
                </div>
              </li>
            ))
          : fallbackList.map((b, i) => (
              <li
                key={i}
                className="flex gap-2.5 text-[13px] leading-relaxed text-ink-700"
              >
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    dotColor,
                  )}
                  aria-hidden="true"
                />
                <span>{b}</span>
              </li>
            ))}
      </ul>
    </div>
  );
}
