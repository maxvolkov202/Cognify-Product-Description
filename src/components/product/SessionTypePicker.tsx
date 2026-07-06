"use client";

import { Flame, Target, Zap } from "lucide-react";
import type { SessionType } from "@/lib/ai/workout-prompts";
import type { SkillDimension } from "@/types/domain";
import { SKILL_DIMENSIONS, DIMENSION_LABELS } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

type Props = {
  value: SessionType;
  focusDimension: SkillDimension | null;
  onChange: (next: {
    sessionType: SessionType;
    focusDimension: SkillDimension | null;
  }) => void;
};

/**
 * Daily Workout session type picker (WS-6).
 *
 * Renders three chips — Focus, Combined, Flow — with descriptive
 * tooltips so first-time users understand the tradeoffs. When Focus is
 * selected, reveals a dimension sub-picker (6 chips, one per dimension).
 *
 * Value + focusDimension are controlled; the parent regenerates the
 * workout plan whenever this changes so the intro stats + drill list
 * below update in sync.
 */
export function SessionTypePicker({
  value,
  focusDimension,
  onChange,
}: Props) {
  function pick(nextType: SessionType) {
    if (nextType === "focus") {
      // Preserve previous focus dim if any, otherwise default to clarity
      onChange({
        sessionType: "focus",
        focusDimension: focusDimension ?? "clarity",
      });
    } else {
      onChange({ sessionType: nextType, focusDimension: null });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Session type
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label="Workout session type"
        className="grid gap-2 md:grid-cols-3"
      >
        <SessionTypeChip
          type="focus"
          label="Focus"
          description="Drill one dimension deeply"
          icon={<Target className="size-4" aria-hidden="true" />}
          active={value === "focus"}
          onClick={() => pick("focus")}
        />
        <SessionTypeChip
          type="combined"
          label="Combined"
          description="Mixed reps, goal-weighted"
          icon={<Flame className="size-4" aria-hidden="true" />}
          active={value === "combined"}
          onClick={() => pick("combined")}
        />
        <SessionTypeChip
          type="flow"
          label="Flow"
          description="5 reps, pressure ramps, compressed feedback"
          icon={<Zap className="size-4" aria-hidden="true" />}
          active={value === "flow"}
          onClick={() => pick("flow")}
        />
      </div>

      {value === "focus" && (
        <div className="rounded-xl border border-ink-200 bg-ink-50/40 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
            Which muscle are you training today?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SKILL_DIMENSIONS.map((dim) => {
              const active = focusDimension === dim;
              return (
                <button
                  key={dim}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() =>
                    onChange({ sessionType: "focus", focusDimension: dim })
                  }
                  className={cn(
                    "min-h-[44px] rounded-full border px-4 py-1.5 text-xs font-semibold transition",
                    active
                      ? "border-brand-purple bg-brand-purple text-white shadow-sm"
                      : "border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-white",
                  )}
                >
                  {DIMENSION_LABELS[dim]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionTypeChip({
  type,
  label,
  description,
  icon,
  active,
  onClick,
}: {
  type: SessionType;
  label: string;
  description: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      data-session-type={type}
      className={cn(
        "group flex items-start gap-3 rounded-xl border p-4 text-left transition",
        active
          ? "border-brand-purple bg-white shadow-[var(--shadow-glow)] ring-2 ring-brand-lavender/40"
          : "border-ink-200 bg-white hover:border-ink-300 hover:shadow-sm",
      )}
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg",
          active
            ? "brand-gradient text-white"
            : "bg-ink-100 text-ink-600 group-hover:bg-ink-200",
        )}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span
          className={cn(
            "block text-sm font-bold",
            active ? "text-ink-900" : "text-ink-800",
          )}
        >
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-ink-500">
          {description}
        </span>
      </span>
    </button>
  );
}
