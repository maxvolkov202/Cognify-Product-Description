"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Save, KeyRound, Download, Trash2, AlertTriangle, Mail, Bell, Sparkles, RotateCcw } from "lucide-react";
import {
  VERTICALS,
  personasForVertical,
  goalsForVertical,
  getVertical,
  type VerticalId,
  type PersonaId,
  type ImprovementGoalId,
} from "@/lib/onboarding/constants";
import {
  DAYS_OF_WEEK,
  DEFAULT_COMMITTED_DAYS,
  MIN_COMMITTED_DAYS,
  committedDayCount,
  isDayCommitted,
  maskToHumanSummary,
  type DayBit,
} from "@/lib/onboarding/committed-days";
import {
  setUserPreferencesAction,
  setAudioRetentionAction,
} from "@/server/actions/onboarding";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  sendPasswordResetEmail,
  exportUserData,
  deleteAccount,
  changeEmail,
} from "@/server/actions/account";
import { useSettingsDirty } from "@/components/product/SettingsDirtyContext";

type Props = {
  initialVertical: VerticalId | null;
  initialPersonas: PersonaId[];
  initialGoals: ImprovementGoalId[];
  initialCommittedDays?: number;
  initialAudioRetentionDays?: number | null;
  userEmail: string | null;
  userKind: "authenticated" | "guest";
};

type SavedSection = "all" | null;

export function SettingsClient({
  initialVertical,
  initialPersonas,
  initialGoals,
  initialCommittedDays,
  initialAudioRetentionDays,
  userEmail,
  userKind,
}: Props) {
  // Phase C — committed training days (bitmask Mon..Sun). Saved through
  // the dedicated /api/me/committed-days endpoint so it's independent of
  // the existing setUserPreferencesAction save batch.
  const [committedDays, setCommittedDays] = useState<number>(
    initialCommittedDays ?? DEFAULT_COMMITTED_DAYS,
  );
  const [persistedCommittedDays, setPersistedCommittedDays] = useState<number>(
    initialCommittedDays ?? DEFAULT_COMMITTED_DAYS,
  );
  const [committedDaysSaving, setCommittedDaysSaving] = useState(false);
  const [committedDaysError, setCommittedDaysError] = useState<string | null>(
    null,
  );

  async function saveCommittedDays(next: number) {
    setCommittedDays(next);
    setCommittedDaysError(null);
    // Validate before sending.
    if (committedDayCount(next) < MIN_COMMITTED_DAYS) {
      setCommittedDaysError(
        `Pick at least ${MIN_COMMITTED_DAYS} days — consistency matters.`,
      );
      return;
    }
    setCommittedDaysSaving(true);
    try {
      const res = await fetch("/api/me/committed-days", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ committedDays: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setCommittedDaysError(body?.message ?? "Couldn't save — try again.");
        return;
      }
      setPersistedCommittedDays(next);
    } catch {
      setCommittedDaysError("Couldn't reach the server.");
    } finally {
      setCommittedDaysSaving(false);
    }
  }
  const [vertical, setVertical] = useState<VerticalId | null>(initialVertical);
  const [personas, setPersonas] = useState<Set<PersonaId>>(
    new Set(initialPersonas),
  );
  const [goals, setGoals] = useState<Set<ImprovementGoalId>>(
    new Set(initialGoals),
  );
  const [persistedVertical, setPersistedVertical] = useState<VerticalId | null>(
    initialVertical,
  );
  const [persistedPersonas, setPersistedPersonas] = useState<PersonaId[]>([
    ...initialPersonas,
  ]);
  const [persistedGoals, setPersistedGoals] = useState<ImprovementGoalId[]>([
    ...initialGoals,
  ]);
  const [savedSection, setSavedSection] = useState<SavedSection>(null);
  const [isPending, startTransition] = useTransition();
  const [retuning, setRetuning] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const prevVerticalRef = useRef<VerticalId | null>(initialVertical);
  const dirtyCtx = useSettingsDirty();

  const isDirty = useMemo(() => {
    if (vertical !== persistedVertical) return true;
    if (!setsEqual(personas, new Set(persistedPersonas))) return true;
    if (!setsEqual(goals, new Set(persistedGoals))) return true;
    return false;
  }, [
    vertical,
    persistedVertical,
    personas,
    persistedPersonas,
    goals,
    persistedGoals,
  ]);

  // When vertical changes, prune persona selections that aren't offered by the
  // new vertical and flash a "retuning" affordance so the swap reads as
  // intentional rather than glitchy.
  useEffect(() => {
    if (prevVerticalRef.current === vertical) return;
    prevVerticalRef.current = vertical;
    const allowed = new Set(personasForVertical(vertical).map((p) => p.id));
    setPersonas((prev) => {
      const next = new Set<PersonaId>();
      prev.forEach((id) => {
        if (allowed.has(id)) next.add(id);
      });
      return next.size === prev.size && [...prev].every((id) => next.has(id))
        ? prev
        : next;
    });
    setRetuning(true);
    const t = setTimeout(() => setRetuning(false), 1400);
    return () => clearTimeout(t);
  }, [vertical]);

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

  const contextualPersonas = personasForVertical(vertical);
  const contextualGoals = goalsForVertical(vertical);
  const verticalLabel = vertical ? getVertical(vertical).label : null;

  /** Atomic save — pushes the current draft to the server and updates the
   *  "persisted" snapshot on success. Returns boolean so the leave-prompt
   *  modal can know whether to proceed with navigation. */
  async function saveAll(): Promise<boolean> {
    setSaveError(null);
    if (goals.size === 0) {
      setSaveError("Pick at least one goal before saving.");
      return false;
    }
    const res = await setUserPreferencesAction({
      vertical: vertical ?? null,
      personas: Array.from(personas),
      goals: Array.from(goals),
    });
    if (!res.ok) {
      setSaveError(
        res.error === "need_at_least_one"
          ? "Pick at least one goal."
          : res.error === "no_user"
            ? "You're signed out. Refresh and try again."
            : "Save failed. Try again.",
      );
      return false;
    }
    setPersistedVertical(vertical);
    setPersistedPersonas(Array.from(personas));
    setPersistedGoals(Array.from(goals));
    flashSaved("all");
    return true;
  }

  function discardChanges() {
    setVertical(persistedVertical);
    setPersonas(new Set(persistedPersonas));
    setGoals(new Set(persistedGoals));
    setSaveError(null);
  }

  function handleSaveClick() {
    startTransition(async () => {
      await saveAll();
    });
  }

  // Wire the dirty state + save/discard handlers into the global context
  // so the leave-prompt modal can resolve navigation cleanly.
  useEffect(() => {
    dirtyCtx?.setDirty(isDirty);
  }, [dirtyCtx, isDirty]);

  useEffect(() => {
    if (!dirtyCtx) return;
    dirtyCtx.setSaveHandler(saveAll);
    dirtyCtx.setDiscardHandler(discardChanges);
    return () => {
      dirtyCtx.setSaveHandler(null);
      dirtyCtx.setDiscardHandler(null);
      dirtyCtx.setDirty(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyCtx, vertical, personas, goals, persistedVertical, persistedPersonas, persistedGoals]);

  return (
    <div className="mt-10 space-y-8">
      {userKind === "authenticated" && (
        <AccountSection userEmail={userEmail} />
      )}

      {/* ——— Vertical ——————————————————————————————— */}
      <section className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-ink-900 dark:text-white">Your vertical</h2>
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                The field closest to your day-to-day work. Drives prompts and
                tone across the entire product.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {VERTICALS.map((v) => {
              const active = vertical === v.id;
              return (
                <motion.button
                  key={v.id}
                  type="button"
                  onClick={() => setVertical(v.id)}
                  aria-pressed={active}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                  className={`group relative flex min-w-[160px] flex-1 items-start gap-2.5 overflow-hidden rounded-2xl border px-3.5 py-2.5 text-left transition-colors sm:flex-none sm:max-w-[280px] ${
                    active
                      ? "brand-gradient border-transparent text-white shadow-sm"
                      : "border-ink-200 bg-white hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900 dark:hover:border-ink-600"
                  }`}
                >
                  <div
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full transition ${
                      active
                        ? "bg-white/25"
                        : "border border-ink-200 bg-white group-hover:border-ink-400 dark:border-ink-700 dark:bg-ink-900 dark:group-hover:border-ink-500"
                    }`}
                  >
                    {active && (
                      <motion.div
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 18 }}
                      >
                        <Check className="size-3 text-white" strokeWidth={3} />
                      </motion.div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-bold leading-tight ${
                        active ? "text-white" : "text-ink-900 dark:text-white"
                      }`}
                    >
                      {v.label}
                    </div>
                    <div
                      className={`mt-0.5 text-[11px] leading-snug ${
                        active ? "text-white/80" : "text-ink-500 dark:text-ink-400"
                      }`}
                    >
                      {v.description}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ——— Training schedule (Phase C) ——————————————— */}
      <section className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-ink-900 dark:text-white">
                Training schedule
              </h2>
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                Pick which days you commit to training. Streaks only count
                missed committed days — rest days are guilt-free.
              </p>
            </div>
            <div className="text-right text-[11px] font-semibold text-ink-500 dark:text-ink-400">
              {committedDaysSaving
                ? "Saving…"
                : committedDays !== persistedCommittedDays
                  ? "Unsaved"
                  : "Saved"}
            </div>
          </div>
          <div className="mt-5 grid grid-cols-7 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
            {DAYS_OF_WEEK.map((d) => {
              const active = isDayCommitted(committedDays, d.bit as DayBit);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    const next = committedDays ^ (1 << d.bit);
                    void saveCommittedDays(next);
                  }}
                  aria-pressed={active}
                  className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-2 text-sm font-bold transition-colors sm:min-w-[64px] sm:px-3 ${
                    active
                      ? "brand-gradient border-transparent text-white shadow-sm"
                      : "border-ink-200 bg-white text-ink-700 hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
                  }`}
                >
                  {d.label}
                  {active && (
                    <Check className="size-3 text-white" strokeWidth={3} />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 text-xs text-ink-600 dark:text-ink-300">
            <span className="font-extrabold tabular-nums text-ink-900 dark:text-white">
              {committedDayCount(committedDays)}
            </span>{" "}
            {committedDayCount(committedDays) === 1 ? "day" : "days"} ·{" "}
            {maskToHumanSummary(committedDays)}
          </div>
          {committedDaysError && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              {committedDaysError}
            </p>
          )}
        </div>
      </section>

      {/* ——— Personas ——————————————————————————————— */}
      <section className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-ink-900 dark:text-white">
                Who you talk to
              </h2>
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                Your typical audience. Tunes AI tone and the scoring register.
                Adapts to your vertical.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <AnimatePresence>
                {retuning && (
                  <motion.div
                    key="retune"
                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -2 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-1.5 rounded-full bg-ink-900 px-2.5 py-1 text-[10px] font-semibold text-white"
                  >
                    <Sparkles className="size-3 animate-pulse" strokeWidth={2.5} />
                    Retuning your trainer…
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <motion.div
            layout
            transition={{ layout: { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] } }}
            className="mt-5 flex flex-wrap gap-2"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {contextualPersonas.map((p) => {
                const active = personas.has(p.id);
                return (
                  <motion.button
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -4 }}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                    type="button"
                    onClick={() => toggleInSet(setPersonas, p.id)}
                    aria-pressed={active}
                    className={`group relative flex min-w-[160px] flex-1 items-start gap-2.5 overflow-hidden rounded-2xl border px-3.5 py-2.5 text-left transition-colors sm:flex-none sm:max-w-[280px] ${
                      active
                        ? "brand-gradient border-transparent text-white shadow-sm"
                        : "border-ink-200 bg-white hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900 dark:hover:border-ink-600"
                    }`}
                  >
                    <div
                      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full transition ${
                        active
                          ? "bg-white/25"
                          : "border border-ink-200 bg-white group-hover:border-ink-400 dark:border-ink-700 dark:bg-ink-900 dark:group-hover:border-ink-500"
                      }`}
                    >
                      {active && (
                        <motion.div
                          initial={{ scale: 0, rotate: -90 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 18 }}
                        >
                          <Check className="size-3 text-white" strokeWidth={3} />
                        </motion.div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-bold leading-tight ${
                          active ? "text-white" : "text-ink-900 dark:text-white"
                        }`}
                      >
                        {p.label}
                      </div>
                      <div
                        className={`mt-0.5 text-[11px] leading-snug ${
                          active ? "text-white/80" : "text-ink-500 dark:text-ink-400"
                        }`}
                      >
                        {p.description}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      {/* ——— Goals ——————————————————————————————— */}
      <section className="surface-card overflow-hidden">
        <div className="brand-gradient h-1" aria-hidden="true" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-ink-900 dark:text-white">
                What you want to improve
              </h2>
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                Drives which rep types get prioritized in your workouts.
              </p>
            </div>
          </div>
          <motion.div
            layout
            transition={{ layout: { duration: 0.3, ease: [0.2, 0.8, 0.2, 1] } }}
            className="mt-5 flex flex-wrap gap-2"
          >
            {contextualGoals.map(({ goal: g, featured }) => {
              const active = goals.has(g.id);
              return (
                <motion.button
                  key={g.id}
                  layout
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                  type="button"
                  onClick={() => toggleInSet(setGoals, g.id)}
                  aria-pressed={active}
                  className={`group relative flex min-w-[180px] flex-1 items-start gap-2.5 overflow-hidden rounded-2xl border px-3.5 py-2.5 text-left transition-colors sm:flex-none sm:max-w-[300px] ${
                    active
                      ? "brand-gradient border-transparent text-white shadow-sm"
                      : featured
                        ? "border-brand-purple/40 bg-gradient-to-br from-brand-blue/5 to-brand-magenta/5 hover:border-brand-purple/60 dark:from-brand-blue/15 dark:to-brand-magenta/15"
                        : "border-ink-200 bg-white hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900 dark:hover:border-ink-600"
                  }`}
                >
                  <div
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full transition ${
                      active
                        ? "bg-white/25"
                        : "border border-ink-200 bg-white group-hover:border-ink-400 dark:border-ink-700 dark:bg-ink-900 dark:group-hover:border-ink-500"
                    }`}
                  >
                    {active && (
                      <motion.div
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 18 }}
                      >
                        <Check className="size-3 text-white" strokeWidth={3} />
                      </motion.div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`text-sm font-bold leading-tight ${
                          active ? "text-white" : "text-ink-900 dark:text-white"
                        }`}
                      >
                        {g.label}
                      </div>
                      {featured && verticalLabel && !active && (
                        <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-purple dark:bg-ink-900/60 dark:text-brand-lavender">
                          ★
                        </span>
                      )}
                    </div>
                    <div
                      className={`mt-0.5 text-[11px] leading-snug ${
                        active ? "text-white/80" : "text-ink-500 dark:text-ink-400"
                      }`}
                    >
                      {g.description}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ——— Appearance ——————————————————————————— */}
      <ThemeToggle />

      {/* ——— Privacy ————————————————————————————— */}
      {userKind === "authenticated" && (
        <PrivacySection
          initialDays={initialAudioRetentionDays ?? 90}
        />
      )}

      {/* ——— Notifications ——————————————————————— */}
      <NotificationsSection />

      {/* ——— Sticky save bar ——————————————————————— */}
      <AnimatePresence>
        {(isDirty || savedSection === "all") && (
          <motion.div
            key="save-bar"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-3xl flex-col gap-2 rounded-2xl border border-brand-purple/30 bg-white p-3 shadow-[0_18px_60px_-20px_rgba(176,114,255,0.55)] md:bottom-6 md:flex-row md:items-center md:justify-between md:p-4 dark:bg-ink-900"
          >
            <div className="flex items-center gap-2">
              <span
                className={`grid size-7 place-items-center rounded-full ${
                  savedSection === "all"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                    : "brand-gradient text-white"
                }`}
              >
                {savedSection === "all" ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : (
                  <Save className="size-3.5" strokeWidth={2.5} />
                )}
              </span>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                  {savedSection === "all" ? "Saved" : "Unsaved changes"}
                </p>
                <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">
                  {savedSection === "all"
                    ? "Your preferences are up to date."
                    : "Save before leaving the page."}
                </p>
                {saveError && (
                  <p className="mt-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                    {saveError}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={discardChanges}
                disabled={isPending || !isDirty}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:border-ink-600 dark:hover:bg-ink-800"
              >
                <RotateCcw className="size-3" strokeWidth={2.5} />
                Discard
              </button>
              <button
                type="button"
                onClick={handleSaveClick}
                disabled={isPending || !isDirty}
                className="brand-gradient inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Save className="size-3.5" strokeWidth={2.5} />
                Save preferences
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function PrivacySection({ initialDays }: { initialDays: number | null }) {
  const [days, setDays] = useState<number | null>(initialDays);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function onChange(next: number | null) {
    setDays(next);
    setError(null);
    setSaving(true);
    try {
      const res = await setAudioRetentionAction(next);
      if (!res.ok) {
        setError("Couldn't save. Try again.");
        return;
      }
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  const justSaved = savedAt && Date.now() - savedAt < 4000;

  return (
    <section className="surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-ink-900 dark:text-white">
              Privacy
            </h2>
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
              Voice recordings are biometric data. Choose how long we keep
              your rep audio before it&rsquo;s auto-deleted from our storage.
            </p>
          </div>
        </div>
        <div className="mt-5">
          <label
            htmlFor="audio-retention-select"
            className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400"
          >
            Audio retention
          </label>
          <select
            id="audio-retention-select"
            value={days === null ? "forever" : String(days)}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === "forever" ? null : Number(v));
            }}
            disabled={saving}
            className="mt-2 w-full max-w-xs rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-900 disabled:opacity-50 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
          >
            <option value="30">30 days</option>
            <option value="90">90 days</option>
            <option value="180">180 days</option>
            <option value="forever">Keep forever</option>
          </select>
          <p className="mt-2 text-[11px] text-ink-500 dark:text-ink-400">
            Transcripts are deleted alongside the audio. Composite scores and
            framework analyses are kept indefinitely.
          </p>
          {error && (
            <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
          {justSaved && !error && (
            <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Saved.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function NotificationsSection() {
  return (
    <section className="surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-ink-900 dark:text-white">
              Notifications
            </h2>
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
              Nudges that help the habit land. All off by default; turn on
              only what you&rsquo;ll actually use.
            </p>
          </div>
        </div>
        <ul className="mt-5 space-y-3">
          <NotificationToggle
            title="Daily rep reminder"
            body="One push per day at the time you train — coming soon."
            comingSoon
          />
          <NotificationToggle
            title="Weekly recap"
            body="Sunday evening summary of the week's reps + top weakness — coming soon."
            comingSoon
          />
          <NotificationToggle
            title="Streak-freeze applied"
            body="Alerts you when a missed day was covered by a banked freeze — coming soon."
            comingSoon
          />
        </ul>
        <p className="mt-4 text-[11px] text-ink-500 dark:text-ink-400">
          Push notifications need browser permission and run through a
          service worker that hasn&rsquo;t been installed yet. Toggles light
          up once that lands.
        </p>
      </div>
    </section>
  );
}

function NotificationToggle({
  title,
  body,
  comingSoon,
}: {
  title: string;
  body: string;
  comingSoon?: boolean;
}) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-700 dark:bg-ink-900">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink-100 dark:bg-ink-800">
        <Bell className="size-4 text-ink-500 dark:text-ink-400" strokeWidth={2.25} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-ink-900 dark:text-white">{title}</p>
          {comingSoon && (
            <span className="rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-400">
              Coming soon
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{body}</p>
      </div>
      <button
        type="button"
        disabled
        aria-pressed={false}
        aria-label={`${title} — coming soon`}
        className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-ink-200 opacity-60 transition-colors disabled:cursor-not-allowed dark:bg-ink-700"
      >
        <span className="inline-block size-5 translate-x-0.5 rounded-full bg-white shadow dark:bg-ink-300" />
      </button>
    </li>
  );
}

function AccountSection({ userEmail }: { userEmail: string | null }) {
  const [emailDraft, setEmailDraft] = useState("");
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState(false);
  const [emailPending, startEmailTransition] = useTransition();
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState(false);
  const [resetPending, startResetTransition] = useTransition();
  const [exportPending, startExportTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailMessage(null);
    startEmailTransition(async () => {
      const res = await changeEmail(emailDraft);
      setEmailError(!res.ok);
      setEmailMessage(res.message);
      if (res.ok) setEmailDraft("");
    });
  }

  function handleResetPassword() {
    setResetMessage(null);
    startResetTransition(async () => {
      const res = await sendPasswordResetEmail();
      setResetError(!res.ok);
      setResetMessage(res.message);
    });
  }

  function handleExport() {
    startExportTransition(async () => {
      const res = await exportUserData();
      if (!res.ok) {
        setResetMessage(res.message);
        setResetError(true);
        return;
      }
      const blob = new Blob([res.data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  function handleDelete() {
    setDeleteError(null);
    startDeleteTransition(async () => {
      const res = await deleteAccount(deleteConfirm);
      if (!res.ok) {
        setDeleteError(res.message);
        return;
      }
      // Redirect to landing on success
      window.location.href = "/";
    });
  }

  return (
    <>
      <section className="surface-card overflow-hidden">
        <div className="h-1 bg-ink-200 dark:bg-ink-700" aria-hidden="true" />
        <div className="p-6">
          <h2 className="text-lg font-bold text-ink-900 dark:text-white">Account &amp; data</h2>
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
            Signed in as{" "}
            <span className="font-semibold text-ink-700 dark:text-ink-200">{userEmail}</span>
          </p>

          <div className="mt-5 space-y-3">
            <form
              onSubmit={handleChangeEmail}
              className="rounded-xl border border-ink-200 p-4 dark:border-ink-700"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-semibold text-ink-900 dark:text-white">
                    Change email
                  </p>
                  <p className="text-xs text-ink-500 dark:text-ink-400">
                    We&rsquo;ll email confirmation links to both the old and new
                    address. Both must be clicked for the change to take effect.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="new@email.com"
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-purple focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={emailPending || !emailDraft}
                    className="inline-flex items-center gap-2 rounded-full border border-ink-200 px-4 py-2 text-xs font-semibold text-ink-700 hover:border-ink-300 disabled:opacity-60 dark:border-ink-700 dark:text-ink-200 dark:hover:border-ink-600"
                  >
                    <Mail className="size-3.5" />
                    {emailPending ? "Sending…" : "Update"}
                  </button>
                </div>
              </div>
              {emailMessage && (
                <p
                  className={
                    emailError
                      ? "mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300"
                      : "mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-green-500/40 dark:bg-green-500/15 dark:text-green-300"
                  }
                >
                  {emailMessage}
                </p>
              )}
            </form>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 p-4 dark:border-ink-700">
              <div>
                <p className="text-sm font-semibold text-ink-900 dark:text-white">
                  Reset password
                </p>
                <p className="text-xs text-ink-500 dark:text-ink-400">
                  We&apos;ll email you a link to set a new one.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetPending}
                className="inline-flex items-center gap-2 rounded-full border border-ink-200 px-4 py-2 text-xs font-semibold text-ink-700 hover:border-ink-300 disabled:opacity-60 dark:border-ink-700 dark:text-ink-200 dark:hover:border-ink-600"
              >
                <KeyRound className="size-3.5" />
                {resetPending ? "Sending…" : "Send reset email"}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 p-4 dark:border-ink-700">
              <div>
                <p className="text-sm font-semibold text-ink-900 dark:text-white">
                  Export your data
                </p>
                <p className="text-xs text-ink-500 dark:text-ink-400">
                  Every rep, score, callout, and session you&apos;ve recorded —
                  downloaded as JSON.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExport}
                disabled={exportPending}
                className="inline-flex items-center gap-2 rounded-full border border-ink-200 px-4 py-2 text-xs font-semibold text-ink-700 hover:border-ink-300 disabled:opacity-60 dark:border-ink-700 dark:text-ink-200 dark:hover:border-ink-600"
              >
                <Download className="size-3.5" />
                {exportPending ? "Preparing…" : "Download JSON"}
              </button>
            </div>

            {resetMessage && (
              <div
                className={
                  resetError
                    ? "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300"
                    : "rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-green-500/40 dark:bg-green-500/15 dark:text-green-300"
                }
              >
                {resetMessage}
              </div>
            )}

            <div className="rounded-xl border-2 border-red-200 bg-red-50/40 p-4 dark:border-red-500/40 dark:bg-red-500/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                    Delete account
                  </p>
                  <p className="text-xs text-red-700/80 dark:text-red-300/90">
                    Permanently removes your reps, scores, and sign-in. Can&apos;t
                    be undone.
                  </p>
                </div>
                {!deleteOpen && (
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-500/40 dark:bg-ink-900 dark:text-red-300 dark:hover:bg-red-500/20"
                  >
                    <Trash2 className="size-3.5" />
                    Delete my account
                  </button>
                )}
              </div>

              {deleteOpen && (
                <div className="mt-4 border-t border-red-200/80 pt-4 dark:border-red-500/40">
                  <p className="flex items-start gap-2 text-xs text-red-900 dark:text-red-200">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>
                      Type your email{" "}
                      <span className="font-mono font-semibold">
                        {userEmail}
                      </span>{" "}
                      to confirm. This is irreversible.
                    </span>
                  </p>
                  <input
                    type="email"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="your@email.com"
                    className="mt-3 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-red-400 focus:outline-none dark:border-red-500/40 dark:bg-ink-900 dark:text-white"
                  />
                  {deleteError && (
                    <p className="mt-2 text-xs text-red-700 dark:text-red-300">{deleteError}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deletePending || !deleteConfirm}
                      className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                    >
                      <Trash2 className="size-3.5" />
                      {deletePending ? "Deleting…" : "Yes, delete permanently"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteOpen(false);
                        setDeleteConfirm("");
                        setDeleteError(null);
                      }}
                      className="inline-flex items-center rounded-full border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:border-ink-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

