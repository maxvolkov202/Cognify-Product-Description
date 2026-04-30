"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  RefreshCw,
  ArrowRight,
  Sparkles,
  X,
  Compass,
  ChevronDown,
  ChevronUp,
  Target,
  Flame,
  Mic,
} from "lucide-react";
import { pickVerticalPromptObjects } from "@/lib/ai/prompts/verticals";
import { RepSurface } from "./RepSurface";
import { TalkingPointsSidebar } from "./TalkingPointsSidebar";
import { PressureRepIndicator } from "./PressureRepIndicator";
import { ModeBadge, ModeSeam } from "./ModeBadge";
import {
  CustomScenarioBuilder,
  type CustomScenarioPayload,
} from "./CustomScenarioBuilder";
import type { VerticalId, PersonaId } from "@/lib/onboarding/constants";
import type { TalkingPoints } from "@/lib/ai/talking-points";
import type { RepScore, Callout } from "@/types/domain";
import {
  PRESSURE_ARCHETYPES,
  getPressureArchetype,
  type PressureArchetypeId,
} from "@/lib/ai/pressure-archetypes";

type Props = {
  vertical: VerticalId;
  verticalLabel: string;
  initialPrompts: string[];
  /** Stable prompt ids parallel to initialPrompts (lockstep). When the
   *  user picks a curated prompt, the parent records the id via
   *  /api/prompt-history. Custom prompts (the "write your own" path)
   *  have no id and are never recorded. */
  initialPromptIds?: string[];
  personas: readonly PersonaId[];
};

type ScenarioSource =
  | { kind: "picker"; scenario: string }
  | { kind: "custom"; payload: CustomScenarioPayload };

type IntakeMode = "picker" | "custom";

/**
 * Build a Rep — consolidated progressive-disclosure flow.
 *
 * The scenario intake and the rep performance live on the SAME scrollable
 * surface. The intake block collapses to a one-line summary once structure
 * is generated; the rep + talking-points sidebar appear below it without
 * a full unmount/remount.
 *
 * Two intake modes:
 *   - picker: 5 vertical prompts, "Write your own" text path, context textarea
 *   - custom: structured survey (situation, stakeholder, your role, desired
 *     outcome, constraints) via CustomScenarioBuilder — reached by clicking
 *     "Not seeing what you're looking for?" in picker mode
 */
export function BuildARepFlow({
  vertical,
  verticalLabel,
  initialPrompts,
  initialPromptIds,
  personas,
}: Props) {
  // Intake state
  const [intakeMode, setIntakeMode] = useState<IntakeMode>("picker");
  const [prompts, setPrompts] = useState<string[]>(initialPrompts);
  const [promptIds, setPromptIds] = useState<string[]>(initialPromptIds ?? []);
  const [selectedPromptIdx, setSelectedPromptIdx] = useState<number | null>(null);
  const [customPromptMode, setCustomPromptMode] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [contextInput, setContextInput] = useState("");

  // Cross-session prompt history. Fetched on mount; picker refresh
  // excludes seen ids. Recording happens at rep-start (talking-points
  // generation) since that's when the user is genuinely committing —
  // mere prompt selection without "Continue" should not burn the bank.
  const [seenPromptIds, setSeenPromptIds] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const seenIdsLoadedRef = useRef(false);
  useEffect(() => {
    if (seenIdsLoadedRef.current) return;
    seenIdsLoadedRef.current = true;
    fetch("/api/prompt-history", { method: "GET" })
      .then((r) => (r.ok ? r.json() : { ids: [] }))
      .then((json: { ids?: string[] }) => {
        if (Array.isArray(json.ids)) setSeenPromptIds(new Set(json.ids));
      })
      .catch(() => {});
  }, []);

  // Telemetry: fire 'shown' when the slate first renders + on every
  // refresh. See WorkoutPromptSelect for the same pattern.
  const lastShownIdsRef = useRef<string>("");
  useEffect(() => {
    if (promptIds.length === 0) return;
    const key = promptIds.join("|");
    if (lastShownIdsRef.current === key) return;
    lastShownIdsRef.current = key;
    void fetch("/api/prompt-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "shown", promptIds }),
    }).catch(() => {});
  }, [promptIds]);

  // Generation + rep state
  const [activeSource, setActiveSource] = useState<ScenarioSource | null>(null);
  const [talkingPoints, setTalkingPoints] = useState<TalkingPoints | null>(null);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intakeCollapsed, setIntakeCollapsed] = useState(false);

  // Retry focus for Build-a-Rep (same as Daily Workout)
  const [retryFocus, setRetryFocus] = useState<Callout | null>(null);
  const [repRetryNonce, setRepRetryNonce] = useState(0);

  // Preview gate (Product Sweep #5) — after talking points are generated,
  // show the user a preview phase with Regenerate/Edit/Start buttons
  // before the mic surface appears. Prevents users from recording
  // without reviewing the structure they're about to speak against.
  const [repStarted, setRepStarted] = useState(false);

  // Optional pressure archetype selection (Phase 5). When set, the rep is
  // scored with that archetype's weight profile and the pressure indicator
  // is shown above the rep surface. Users can freely add/remove before
  // starting; locked once the rep starts to keep scoring consistent.
  const [pressureArchetypeId, setPressureArchetypeId] =
    useState<PressureArchetypeId | null>(null);
  const pressureArchetype = pressureArchetypeId
    ? getPressureArchetype(pressureArchetypeId)
    : null;

  const effectivePickerPrompt = customPromptMode
    ? customPrompt.trim()
    : selectedPromptIdx !== null
      ? (prompts[selectedPromptIdx] ?? "")
      : "";

  const canGeneratePicker = effectivePickerPrompt.length > 0;

  // ——— Handlers ——————————————————————————————————————

  function handleRefresh() {
    const refreshed = pickVerticalPromptObjects(vertical, 5, {
      excludeIds: seenPromptIds,
    });
    // Telemetry: refreshed_past on the prompts we're dropping.
    if (promptIds.length > 0) {
      void fetch("/api/prompt-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "refreshed_past",
          promptIds,
        }),
      }).catch(() => {});
    }
    setPrompts(refreshed.map((p) => p.text));
    setPromptIds(refreshed.map((p) => p.id));
    setSelectedPromptIdx(null);
  }

  /**
   * Record the just-picked prompt's id with the prompt-history service
   * + locally so subsequent refresh excludes it. Fire-and-forget; failure
   * is non-fatal. Called at rep-start (after talking-points generation
   * succeeds), not at selection time.
   */
  function recordCuratedPick(idx: number) {
    const id = promptIds[idx];
    if (!id) return; // Custom prompt or missing id — nothing to record.
    setSeenPromptIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    void fetch("/api/prompt-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptId: id }),
    }).catch(() => {});
  }

  function handleSelectPrompt(idx: number) {
    setCustomPromptMode(false);
    setCustomPrompt("");
    setSelectedPromptIdx(idx);
  }

  async function requestTalkingPoints(
    payload: Record<string, unknown>,
  ): Promise<TalkingPoints | null> {
    const res = await fetch("/api/talking-points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, vertical, personas }),
    });
    if (!res.ok) return null;
    return (await res.json()) as TalkingPoints;
  }

  async function handleGenerateFromPicker() {
    if (!canGeneratePicker) return;
    const scenario = effectivePickerPrompt;
    setError(null);
    setGenerating(true);
    setActiveSource({ kind: "picker", scenario });

    const result = await requestTalkingPoints({
      scenario,
      context: contextInput.trim() || undefined,
    });
    if (result) {
      setTalkingPoints(result);
      setIntakeCollapsed(true);
      // Record the curated pick now — talking points generated, the
      // user is committed. Custom prompts (selectedPromptIdx === null)
      // get nothing to record, which is correct.
      if (selectedPromptIdx !== null && !customPromptMode) {
        recordCuratedPick(selectedPromptIdx);
      }
    } else {
      setError(
        "Couldn't build the structure — try again, or check that the API key is set.",
      );
      setActiveSource(null);
    }
    setGenerating(false);
  }

  async function handleGenerateFromCustom(payload: CustomScenarioPayload) {
    setError(null);
    setGenerating(true);
    setActiveSource({ kind: "custom", payload });

    const result = await requestTalkingPoints({
      scenario: payload.scenario,
      context: payload.context || undefined,
      stakeholder: payload.stakeholder,
      userRole: payload.userRole,
      desiredOutcome: payload.desiredOutcome,
      emotionalStakes: payload.emotionalStakes,
      timePressure: payload.timePressure,
      tonePreference: payload.tonePreference,
    });
    if (result) {
      setTalkingPoints(result);
      setIntakeCollapsed(true);
    } else {
      setError(
        "Couldn't build the structure — try again, or check that the API key is set.",
      );
      setActiveSource(null);
    }
    setGenerating(false);
  }

  async function handleRegenerate() {
    if (!activeSource) return;
    setRegenerating(true);
    const result = await requestTalkingPoints(
      activeSource.kind === "picker"
        ? {
            scenario: activeSource.scenario,
            context: contextInput.trim() || undefined,
          }
        : {
            scenario: activeSource.payload.scenario,
            context: activeSource.payload.context || undefined,
            stakeholder: activeSource.payload.stakeholder,
            userRole: activeSource.payload.userRole,
            desiredOutcome: activeSource.payload.desiredOutcome,
            emotionalStakes: activeSource.payload.emotionalStakes,
            timePressure: activeSource.payload.timePressure,
            tonePreference: activeSource.payload.tonePreference,
          },
    );
    if (result) setTalkingPoints(result);
    setRegenerating(false);
  }

  function handleNewScenario() {
    setIntakeMode("picker");
    setIntakeCollapsed(false);
    setTalkingPoints(null);
    setActiveSource(null);
    setSelectedPromptIdx(null);
    setCustomPrompt("");
    setCustomPromptMode(false);
    setContextInput("");
    setError(null);
    setRetryFocus(null);
    setRepRetryNonce(0);
    setRepStarted(false);
    setPressureArchetypeId(null);
  }

  function handleRepComplete({ score }: { score: RepScore }) {
    const focus =
      score.callouts.find(
        (c) => c.tone === "warn" || c.tone === "critical",
      ) ??
      score.callouts[0] ??
      null;
    setRetryFocus(focus);
  }

  function handleRepRetry() {
    setRepRetryNonce((n) => n + 1);
  }

  // ——— Derived summary line for collapsed intake ——————————
  const summaryText =
    activeSource?.kind === "picker"
      ? activeSource.scenario
      : activeSource?.kind === "custom"
        ? activeSource.payload.scenario
        : "";
  const stakeholderText =
    activeSource?.kind === "custom"
      ? activeSource.payload.stakeholder
      : undefined;
  const activeRepPrompt = summaryText;

  // ——— Render ——————————————————————————————————————————

  const sessionPhase: "setup" | "rep" | "review" = !talkingPoints
    ? "setup"
    : !repStarted
      ? "setup"
      : retryFocus
        ? "review"
        : "rep";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* ——— Session progress bar ————————————————————— */}
      <SessionProgress phase={sessionPhase} />

      {/* ——— Header ————————————————————————————— */}
      <div>
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          <Mic className="size-3" strokeWidth={2.5} />
          Training session · {verticalLabel}
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          {sessionPhase === "review"
            ? "Nice rep. Here's what moved."
            : talkingPoints
              ? "Hold the structure. Perform the rep."
              : "What are we working on today?"}
        </h1>
        {!talkingPoints && (
          <p className="mt-3 text-base leading-relaxed text-ink-600">
            Tell us the scenario — pick one of the prompts below or describe
            your own. We&rsquo;ll build a thinking scaffold you can speak
            against. Not a script — a structure to hold.
          </p>
        )}
      </div>

      {/* ——— Intake block ——————————————————————————— */}
      {intakeCollapsed && activeSource && talkingPoints ? (
        <ScenarioSummaryBar
          summaryText={summaryText}
          stakeholder={stakeholderText}
          onExpand={() => setIntakeCollapsed(false)}
          onNewScenario={handleNewScenario}
        />
      ) : (
        <div className="space-y-4">
          {/* Default: launchpad. Survey hides behind "Advanced setup". */}
          {!talkingPoints && intakeMode === "picker" && (
            <LaunchpadIntake
              verticalLabel={verticalLabel}
              prompts={prompts}
              customPrompt={customPrompt}
              onRefresh={handleRefresh}
              onPickStarter={(idx) => {
                handleSelectPrompt(idx);
                setCustomPrompt("");
              }}
              onCustomPromptChange={(s) => {
                setCustomPrompt(s);
                if (s.length > 0) {
                  setCustomPromptMode(true);
                  setSelectedPromptIdx(null);
                } else {
                  setCustomPromptMode(false);
                }
              }}
              selectedStarter={
                customPromptMode ? null : selectedPromptIdx
              }
              canGenerate={canGeneratePicker}
              generating={generating}
              onGenerate={handleGenerateFromPicker}
              onAdvanced={() => setIntakeMode("custom")}
            />
          )}

          {!talkingPoints && intakeMode === "custom" && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setIntakeMode("picker")}
                className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-900"
              >
                ← Back to launchpad
              </button>
              <CustomScenarioBuilder
                vertical={vertical}
                initialStakeholder={
                  activeSource?.kind === "custom"
                    ? activeSource.payload.stakeholder
                    : undefined
                }
                onCancel={() => setIntakeMode("picker")}
                onSubmit={handleGenerateFromCustom}
              />
            </div>
          )}

          {generating && (
            <div className="relative overflow-hidden rounded-2xl border border-brand-purple/20 bg-gradient-to-br from-brand-blue/5 via-brand-lavender/5 to-brand-magenta/5 p-4">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="brand-gradient grid size-9 place-items-center rounded-xl"
                >
                  <Sparkles className="size-4 text-white" aria-hidden="true" />
                </motion.div>
                <div>
                  <p className="text-sm font-bold text-ink-900">
                    Coach is prepping your structure…
                  </p>
                  <p className="text-xs text-ink-500">
                    Building a scaffold tailored to your scenario.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      )}

      {/* ——— Preview phase (before rep starts) ———————————— */}
      {talkingPoints && activeSource && !repStarted && (
        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-3xl border border-transparent bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900 p-6 text-white shadow-[0_24px_60px_-24px_rgba(20,20,40,0.5)] md:p-8">
            {/* Ambient brand halo in corners */}
            <div
              className="pointer-events-none absolute -left-20 -top-20 size-64 rounded-full blur-3xl"
              aria-hidden="true"
              style={{ background: "radial-gradient(circle, rgba(106,163,255,0.35), transparent 70%)" }}
            />
            <div
              className="pointer-events-none absolute -bottom-24 -right-16 size-64 rounded-full blur-3xl"
              aria-hidden="true"
              style={{ background: "radial-gradient(circle, rgba(231,124,240,0.3), transparent 70%)" }}
            />

            <div className="relative">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <motion.div
                    className="brand-gradient size-8 rounded-xl"
                    animate={{ opacity: [0.75, 1, 0.75] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <div className="brand-gradient absolute inset-0 rounded-xl opacity-40 blur-md" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Coach&rsquo;s prep
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-lavender">
                    Session ready
                  </p>
                </div>
              </div>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
                Here&rsquo;s your setup.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">
                A scaffold — not a script. Tweak any line, regenerate the shape,
                or dial up pressure. Hit start when you&rsquo;re ready to speak.
              </p>
              <PressurePicker
                selectedId={pressureArchetypeId}
                onChange={setPressureArchetypeId}
              />

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setRepStarted(true)}
                  className="brand-gradient inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_-8px_rgba(151,136,255,0.6)] transition-transform hover:scale-[1.02]"
                >
                  <Mic className="size-4" strokeWidth={2.5} />
                  Start your rep
                </button>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`size-3.5 ${regenerating ? "animate-spin" : ""}`}
                  />
                  {regenerating ? "Regenerating…" : "Regenerate"}
                </button>
                <button
                  type="button"
                  onClick={handleNewScenario}
                  className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-900"
                >
                  <X className="size-3.5" />
                  New scenario
                </button>
              </div>
            </div>
          </div>

          <TalkingPointsSidebar
            talkingPoints={talkingPoints}
            onEdit={setTalkingPoints}
            onRegenerate={handleRegenerate}
            regenerating={regenerating}
            context={
              activeSource.kind === "picker"
                ? contextInput || undefined
                : activeSource.payload.context || undefined
            }
          />
        </div>
      )}

      {/* ——— Rep + sidebar ————————————————————————— */}
      {talkingPoints && activeSource && repStarted && (
        <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <ModeBadge mode="build_a_rep" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  Real-moment rep
                </span>
              </div>
              <ModeSeam mode="build_a_rep" />
            </div>
            {pressureArchetype && (
              <PressureRepIndicator archetype={pressureArchetype} />
            )}
            <RepSurface
              key={`${activeRepPrompt}-${repRetryNonce}-${pressureArchetypeId ?? "noop"}`}
              prompt={activeRepPrompt}
              mode="scenario_training"
              topic={activeRepPrompt}
              maxDurationMs={
                90_000 +
                (pressureArchetype?.durationDeltaSec ?? 0) * 1000
              }
              retryFocus={retryFocus}
              pressureArchetypeId={pressureArchetypeId}
              pressureContext={
                pressureArchetype
                  ? {
                      archetypeName: pressureArchetype.name,
                      archetypeTagline: pressureArchetype.tagline,
                    }
                  : null
              }
              onComplete={handleRepComplete}
              onRetry={handleRepRetry}
              onNext={handleNewScenario}
              nextLabel="New scenario"
            />
          </div>
          <div className="lg:sticky lg:top-24 lg:self-start">
            <TalkingPointsSidebar
              talkingPoints={talkingPoints}
              onEdit={setTalkingPoints}
              onRegenerate={handleRegenerate}
              regenerating={regenerating}
              context={
                activeSource.kind === "picker"
                  ? contextInput || undefined
                  : activeSource.payload.context || undefined
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ——— Summary bar shown when intake is collapsed ——————————
function ScenarioSummaryBar({
  summaryText,
  stakeholder,
  onExpand,
  onNewScenario,
}: {
  summaryText: string;
  stakeholder?: string;
  onExpand: () => void;
  onNewScenario: () => void;
}) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <div className="brand-gradient grid size-9 shrink-0 place-items-center rounded-lg">
          <Target
            className="size-4 text-white"
            strokeWidth={2.5}
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            Your scenario
          </p>
          <p className="truncate text-sm font-bold text-ink-900">
            {summaryText}
          </p>
          {stakeholder && (
            <p className="truncate text-xs text-ink-500">
              Speaking to: {stakeholder}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onExpand}
          className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-700 hover:border-ink-300"
        >
          <ChevronDown className="size-3.5" />
          Edit scenario
        </button>
        <button
          type="button"
          onClick={onNewScenario}
          className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-700 hover:border-ink-300"
        >
          New scenario
        </button>
      </div>
    </div>
  );
}

// ——— Launchpad intake ————————————————————————————————
// One conversational input + a row of starter sessions. The full custom
// builder lives behind "Advanced setup". Goal: zero or one keystroke
// before a session can start. Removes the "fill out a survey" feel.
function LaunchpadIntake({
  verticalLabel,
  prompts,
  customPrompt,
  selectedStarter,
  onRefresh,
  onPickStarter,
  onCustomPromptChange,
  canGenerate,
  generating,
  onGenerate,
  onAdvanced,
}: {
  verticalLabel: string;
  prompts: string[];
  customPrompt: string;
  selectedStarter: number | null;
  onRefresh: () => void;
  onPickStarter: (idx: number) => void;
  onCustomPromptChange: (s: string) => void;
  canGenerate: boolean;
  generating: boolean;
  onGenerate: () => void;
  onAdvanced: () => void;
}) {
  // Rotate the placeholder through real-feel scenarios so the input never
  // sits empty. Uses the vertical's prompts when nothing is typed yet.
  const placeholderIdx = useRotatingIndex(prompts.length, 2400);
  const placeholder =
    prompts[placeholderIdx] ??
    "What are you about to handle? Type or pick a starter below.";

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canGenerate && !generating) {
      e.preventDefault();
      onGenerate();
    }
  };

  return (
    <div className="space-y-5">
      {/* Coach launchpad card */}
      <div className="relative overflow-hidden rounded-3xl border border-ink-200 bg-gradient-to-br from-white via-brand-lavender/5 to-brand-magenta/5 p-6 shadow-[0_12px_40px_-20px_rgba(176,114,255,0.35)] md:p-8">
        <div
          className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full opacity-50 blur-3xl"
          aria-hidden="true"
          style={{ background: "radial-gradient(circle, rgba(176,114,255,0.25), transparent 70%)" }}
        />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <motion.div
                className="brand-gradient size-9 rounded-2xl"
                animate={{ opacity: [0.8, 1, 0.8], scale: [1, 1.04, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="brand-gradient absolute inset-0 rounded-2xl opacity-40 blur-md" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-purple">
                Coach · {verticalLabel}
              </p>
              <p className="text-sm font-semibold text-ink-700">
                What are we working on today?
              </p>
            </div>
          </div>

          {/* The single input — Enter to launch */}
          <div className="mt-5">
            <div
              className={`group flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 transition ${
                customPrompt
                  ? "border-brand-purple/40 shadow-[0_8px_24px_-12px_rgba(176,114,255,0.4)]"
                  : "border-ink-200 hover:border-ink-300"
              }`}
            >
              <Compass className="size-4 shrink-0 text-ink-400" strokeWidth={2.5} />
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => onCustomPromptChange(e.target.value)}
                onKeyDown={handleKey}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-[15px] font-medium text-ink-900 placeholder:text-ink-400 focus:outline-none"
                aria-label="Describe your scenario"
              />
              <motion.button
                type="button"
                onClick={onGenerate}
                disabled={!canGenerate || generating}
                whileTap={{ scale: 0.95 }}
                className="brand-gradient grid size-8 shrink-0 place-items-center rounded-xl text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Start session"
              >
                <ArrowRight className="size-4" strokeWidth={2.5} />
              </motion.button>
            </div>
            <p className="mt-2 px-1 text-[11px] text-ink-500">
              Type one line — &ldquo;defending Q3 roadmap to a skeptical CFO&rdquo; — and hit enter.
            </p>
          </div>
        </div>
      </div>

      {/* Starter sessions — one tap to pick a pre-baked scenario */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            Or pick a starter session
          </p>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold text-ink-500 hover:text-ink-900"
          >
            <RefreshCw className="size-3" />
            Shuffle
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {prompts.map((prompt, i) => {
            const active = selectedStarter === i;
            return (
              <motion.button
                key={`${i}-${prompt.slice(0, 20)}`}
                type="button"
                onClick={() => onPickStarter(i)}
                aria-pressed={active}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className={`group flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                  active
                    ? "brand-gradient border-transparent text-white shadow-[0_10px_30px_-10px_rgba(176,114,255,0.5)]"
                    : "border-ink-200 bg-white hover:border-brand-purple/40 hover:bg-brand-lavender/5"
                }`}
              >
                <div
                  className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-xl transition ${
                    active
                      ? "bg-white/25"
                      : "bg-gradient-to-br from-brand-blue/10 to-brand-magenta/10 group-hover:from-brand-blue/20 group-hover:to-brand-magenta/20"
                  }`}
                >
                  <Mic
                    className={`size-3.5 ${active ? "text-white" : "text-brand-purple"}`}
                    strokeWidth={2.5}
                  />
                </div>
                <p
                  className={`text-[14px] leading-snug ${
                    active ? "font-semibold text-white" : "text-ink-800"
                  }`}
                >
                  {prompt}
                </p>
              </motion.button>
            );
          })}
        </div>

        {selectedStarter !== null && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex justify-center"
          >
            <button
              type="button"
              onClick={onGenerate}
              disabled={!canGenerate || generating}
              className="brand-gradient inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-[0_10px_30px_-8px_rgba(151,136,255,0.5)] transition-transform hover:scale-[1.02] disabled:opacity-40"
            >
              <Mic className="size-4" strokeWidth={2.5} />
              Start this session
            </button>
          </motion.div>
        )}
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onAdvanced}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-900"
        >
          <Compass className="size-3" strokeWidth={2.5} />
          Advanced setup &mdash; full survey, stakeholder, constraints
          <ArrowRight className="size-3" />
        </button>
      </div>
    </div>
  );
}

// Rotates an integer index in [0, length) on a given interval. Used to
// cycle the launchpad placeholder through real scenarios.
function useRotatingIndex(length: number, intervalMs: number): number {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % length), intervalMs);
    return () => clearInterval(t);
  }, [length, intervalMs]);
  return idx;
}

// ——— Pressure picker (Phase 5) ——————————————————————————
//
// Shown in the preview card as an optional layer. User can apply one of
// the five pressure archetypes before starting a Build-a-Rep scenario —
// rep is then scored with that archetype's weight profile (server-side
// in /api/score). "None" is the default; picking an archetype shows a
// one-line tagline so the user knows what to expect.
// Difficulty dial — replaces the old chip row. Reads as an intensity ramp
// from Warmup to Gauntlet with a color gradient. "None" sits to the left as
// the default; picking any level reveals the archetype's tagline.
function PressurePicker({
  selectedId,
  onChange,
}: {
  selectedId: PressureArchetypeId | null;
  onChange: (id: PressureArchetypeId | null) => void;
}) {
  const archetypes = Object.values(PRESSURE_ARCHETYPES);
  // Ordered list: None + each archetype as a rung on the ramp.
  const rungs: Array<{
    id: PressureArchetypeId | null;
    label: string;
    dotClass: string;
  }> = [
    { id: null, label: "Warmup", dotClass: "bg-ink-300" },
    { id: archetypes[0]?.id ?? null, label: "Real", dotClass: "bg-amber-300" },
    { id: archetypes[1]?.id ?? null, label: "Heat", dotClass: "bg-amber-500" },
    { id: archetypes[2]?.id ?? null, label: "Pressure", dotClass: "bg-orange-500" },
    { id: archetypes[3]?.id ?? null, label: "Gauntlet", dotClass: "bg-rose-600" },
  ];
  // Extra archetypes beyond 4 collapse into the last rung label if needed.
  const extras = archetypes.slice(4);

  const activeIdx = rungs.findIndex((r) => r.id === selectedId);
  const activeRung = activeIdx >= 0 ? rungs[activeIdx] : rungs[0];

  return (
    <div className="mt-6 rounded-xl border border-ink-200 bg-gradient-to-br from-amber-50/40 to-rose-50/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Flame className="size-4 text-amber-600" strokeWidth={2.5} />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-700">
            Difficulty
          </p>
        </div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-600">
          {activeRung?.label ?? "Warmup"}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {rungs.map((rung, i) => {
          const active = rung.id === selectedId;
          const passed = activeIdx > i;
          return (
            <motion.button
              key={rung.label}
              type="button"
              onClick={() => onChange(rung.id)}
              aria-pressed={active}
              whileTap={{ scale: 0.96 }}
              className={`group relative flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2 transition ${
                active
                  ? "border-ink-900 bg-white shadow-sm ring-2 ring-ink-900/10"
                  : passed
                    ? "border-ink-200 bg-white"
                    : "border-ink-200 bg-white/70 hover:border-ink-300 hover:bg-white"
              }`}
            >
              <span
                className={`size-2 rounded-full ${rung.dotClass} ${
                  active ? "ring-2 ring-offset-1 ring-ink-900/20" : ""
                }`}
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-700">
                {rung.label}
              </span>
            </motion.button>
          );
        })}
      </div>
      {extras.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {extras.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onChange(a.id)}
              aria-pressed={selectedId === a.id}
              className={
                selectedId === a.id
                  ? "rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-bold text-white"
                  : "rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-ink-600 hover:border-ink-300"
              }
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {selectedId && (
          <motion.p
            key={selectedId}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"
          >
            {getPressureArchetype(selectedId).tagline}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ——— Session progress bar ————————————————————————————————
// Three-segment bar across the top of the flow. The active segment pulses
// subtly; passed segments fill solid. Replaces any "step 1 of 3" counter
// with a continuous sense of forward motion.
function SessionProgress({ phase }: { phase: "setup" | "rep" | "review" }) {
  const order: Array<"setup" | "rep" | "review"> = ["setup", "rep", "review"];
  const labels: Record<"setup" | "rep" | "review", string> = {
    setup: "Setup",
    rep: "Rep",
    review: "Review",
  };
  const activeIdx = order.indexOf(phase);
  return (
    <div className="flex items-center gap-3">
      {order.map((key, i) => {
        const passed = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={key} className="flex flex-1 items-center gap-2">
            <span
              className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
                active
                  ? "text-ink-900"
                  : passed
                    ? "text-brand-purple"
                    : "text-ink-400"
              }`}
            >
              {labels[key]}
            </span>
            <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-ink-100">
              <motion.div
                initial={false}
                animate={{
                  width: passed ? "100%" : active ? "60%" : "0%",
                }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={`h-full rounded-full ${
                  passed || active ? "brand-gradient" : "bg-ink-200"
                }`}
              />
              {active && (
                <motion.div
                  className="absolute inset-y-0 left-0 h-full w-8 rounded-full bg-white/40"
                  animate={{ x: ["-8px", "100%"] }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Unused re-export to keep ChevronUp tree-shakable if we need it later.
export const _iconHint = { ChevronUp };
