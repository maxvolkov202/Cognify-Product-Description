"use client";

import type { SkillDimension } from "@/types/domain";
import { DIMENSION_LABELS } from "@/types/domain";
import { LAST_REP_FOCUS_COPY } from "./copy";

type Props = {
  dimension: SkillDimension;
  /** Optional — overrides the static lookup table from copy.ts. Used by
   *  Phase 2+ when continuation copy is AI-generated per rep. */
  customHeadline?: string;
};

export function LastRepFocusBanner({ dimension, customHeadline }: Props) {
  const tail = customHeadline ?? LAST_REP_FOCUS_COPY[dimension];
  return (
    <p className="text-sm text-ink-500">
      Last rep focus:{" "}
      <span className="font-semibold text-brand-purple">
        {DIMENSION_LABELS[dimension].toLowerCase()}
      </span>{" "}
      — {tail}
    </p>
  );
}
