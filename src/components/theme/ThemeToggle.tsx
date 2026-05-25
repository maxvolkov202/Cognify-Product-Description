"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "./ThemeProvider";
import { cn } from "@/lib/utils/cn";

const OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <section className="mt-10 rounded-3xl border border-ink-200 bg-white p-6 shadow-sm dark:border-ink-700 dark:bg-ink-900">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
        Appearance
      </p>
      <h2 className="mt-2 text-xl font-extrabold tracking-tight text-ink-900 dark:text-white">
        Theme
      </h2>
      <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
        Light keeps every surface bright. Dark uses ink backgrounds with
        light text — easier on the eyes after sundown. System follows your
        OS preference.
      </p>

      <div
        role="radiogroup"
        aria-label="Theme preference"
        className="mt-5 inline-flex rounded-full border border-ink-200 bg-ink-50 p-1 dark:border-ink-700 dark:bg-ink-800"
      >
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = preference === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPreference(opt.value)}
              className={cn(
                "inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
                active
                  ? "bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white"
                  : "text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-white",
              )}
            >
              <Icon className="size-4" strokeWidth={2.5} />
              {opt.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
