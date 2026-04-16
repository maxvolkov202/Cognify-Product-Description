"use client";

import { useState, useTransition } from "react";
import { Check, Save } from "lucide-react";
import {
  VERTICALS,
  PERSONAS,
  IMPROVEMENT_GOALS,
  type VerticalId,
  type PersonaId,
  type ImprovementGoalId,
} from "@/lib/onboarding/constants";
import {
  setVerticalAction,
  setPersonasAction,
  setImprovementGoalsAction,
} from "@/server/actions/onboarding";

type Props = {
  initialVertical: VerticalId | null;
  initialPersonas: PersonaId[];
  initialGoals: ImprovementGoalId[];
};

type SavedSection = "vertical" | "personas" | "goals" | null;

export function SettingsClient({
  initialVertical,
  initialPersonas,
  initialGoals,
}: Props) {
  const [vertical, setVertical] = useState<VerticalId | null>(initialVertical);
  const [personas, setPersonas] = useState<Set<PersonaId>>(
    new Set(initialPersonas),
  );
  const [goals, setGoals] = useState<Set<ImprovementGoalId>>(
    new Set(initialGoals),
  );
  const [savedSection, setSavedSection] = useState<SavedSection>(null);
  const [isPending, startTransition] = useTransition();

  function toggleInSet<T>(
    setter: React.Dispatch<React.SetStateAction<Set<T>>>,
    id: T,
  ) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function flashSaved(section: SavedSection) {
    setSavedSection(section);
    setTimeout(() => setSavedSection(null), 2200);
  }

  function saveVertical() {
    if (!vertical) return;
    startTransition(async () => {
      await setVerticalAction(vertical);
      flashSaved("vertical");
    });
  }

  function savePersonas() {
    startTransition(async () => {
      await setPersonasAction(Array.from(personas));
      flashSaved("personas");
    });
  }

  function saveGoals() {
    startTransition(async () => {
      await setImprovementGoalsAction(Array.from(goals));
      flashSaved("goals");
    });
  }

  return (
    <div className="mt-10 space-y-8">
      {/* ——— Vertical ——————————————————————————————— */}
      <section className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-ink-900">Your vertical</h2>
              <p className="mt-1 text-xs text-ink-500">
                The field closest to your day-to-day work. Drives prompts and
                tone across the entire product.
              </p>
            </div>
            <SaveIndicator show={savedSection === "vertical"} />
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {VERTICALS.map((v) => {
              const active = vertical === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVertical(v.id)}
                  aria-pressed={active}
                  className={`text-left rounded-xl border p-3 transition ${
                    active
                      ? "border-ink-900 bg-white ring-2 ring-ink-900/10"
                      : "border-ink-200 bg-white hover:border-ink-300"
                  }`}
                >
                  <div className="text-sm font-bold text-ink-900">
                    {v.label}
                  </div>
                  <div className="mt-0.5 text-[11px] text-ink-500">
                    {v.description}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-5">
            <button
              type="button"
              onClick={saveVertical}
              disabled={
                !vertical || isPending || vertical === initialVertical
              }
              className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save className="size-3.5" />
              Save vertical
            </button>
          </div>
        </div>
      </section>

      {/* ——— Personas ——————————————————————————————— */}
      <section className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-ink-900">
                Who you talk to
              </h2>
              <p className="mt-1 text-xs text-ink-500">
                Your typical audience. Tunes AI tone and the scoring
                register. Optional.
              </p>
            </div>
            <SaveIndicator show={savedSection === "personas"} />
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {PERSONAS.map((p) => {
              const active = personas.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleInSet(setPersonas, p.id)}
                  aria-pressed={active}
                  className={`relative text-left rounded-xl border p-3 pr-10 transition ${
                    active
                      ? "border-ink-900 bg-white ring-2 ring-ink-900/10"
                      : "border-ink-200 bg-white hover:border-ink-300"
                  }`}
                >
                  {active && (
                    <div className="brand-gradient absolute right-2 top-2 grid size-4 place-items-center rounded-full">
                      <Check
                        className="size-2.5 text-white"
                        strokeWidth={3}
                        aria-hidden="true"
                      />
                    </div>
                  )}
                  <div className="text-sm font-bold text-ink-900">
                    {p.label}
                  </div>
                  <div className="mt-0.5 text-[11px] text-ink-500">
                    {p.description}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-5">
            <button
              type="button"
              onClick={savePersonas}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save className="size-3.5" />
              Save personas
            </button>
          </div>
        </div>
      </section>

      {/* ——— Goals ——————————————————————————————— */}
      <section className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-ink-900">
                What you want to improve
              </h2>
              <p className="mt-1 text-xs text-ink-500">
                Drives which rep types get prioritized in your workouts.
              </p>
            </div>
            <SaveIndicator show={savedSection === "goals"} />
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {IMPROVEMENT_GOALS.map((g) => {
              const active = goals.has(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleInSet(setGoals, g.id)}
                  aria-pressed={active}
                  className={`relative text-left rounded-xl border p-3 pr-10 transition ${
                    active
                      ? "border-ink-900 bg-white ring-2 ring-ink-900/10"
                      : "border-ink-200 bg-white hover:border-ink-300"
                  }`}
                >
                  {active && (
                    <div className="brand-gradient absolute right-2 top-2 grid size-4 place-items-center rounded-full">
                      <Check
                        className="size-2.5 text-white"
                        strokeWidth={3}
                        aria-hidden="true"
                      />
                    </div>
                  )}
                  <div className="text-sm font-bold text-ink-900">
                    {g.label}
                  </div>
                  <div className="mt-0.5 text-[11px] text-ink-500">
                    {g.description}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-5">
            <button
              type="button"
              onClick={saveGoals}
              disabled={isPending || goals.size === 0}
              className="inline-flex items-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save className="size-3.5" />
              Save goals
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SaveIndicator({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-semibold text-green-700">
      <Check className="size-3" strokeWidth={3} />
      Saved
    </div>
  );
}
