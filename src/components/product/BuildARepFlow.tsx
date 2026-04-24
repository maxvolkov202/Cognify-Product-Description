"use client";

import { useState } from "react";
import {
  RefreshCw,
  ArrowRight,
  PenLine,
  Sparkles,
  X,
  Compass,
  ChevronDown,
  ChevronUp,
  Target,
  Flame,
} from "lucide-react";
import { pickVerticalPrompts } from "@/lib/ai/prompts/verticals";
import { RepSurface } from "./RepSurface";
import { TalkingPointsSidebar } from "./TalkingPointsSidebar";
import { PressureRepIndicator } from "./PressureRepIndicator";
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
  personas,
}: Props) {
  // Intake state
  const [intakeMode, setIntakeMode] = useState<IntakeMode>("picker");
  const [prompts, setPrompts] = useState<string[]>(initialPrompts);
  const [selectedPromptIdx, setSelectedPromptIdx] = useState<number | null>(null);
  const [customPromptMode, setCustomPromptMode] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [contextInput, setContextInput] = useState("");

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
    setPrompts(pickVerticalPrompts(vertical, 5));
    setSelectedPromptIdx(null);
  }

  function handleSelectPrompt(idx: number) {
    setCustomPromptMode(false);
    setCustomPrompt("");
    setSelectedPromptIdx(idx);
  }

  function handleOpenCustom() {
    setCustomPromptMode(true);
    setSelectedPromptIdx(null);
  }

  function handleCancelCustom() {
    setCustomPromptMode(false);
    setCustomPrompt("");
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* ——— Header ————————————————————————————— */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
          Build a Rep · {verticalLabel}
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ink-900 md:text-5xl">
          {talkingPoints
            ? "Hold the structure. Perform the rep."
            : "What do you need to handle?"}
        </h1>
        {!talkingPoints && (
          <p className="mt-3 text-base leading-relaxed text-ink-600">
            Pick a scenario, write your own, or answer a short survey for full
            customization. We&rsquo;ll generate a thinking structure you can
            speak against. Not a script — a scaffold.
          </p>
        )}
      </div>

      {/* ——— Intake block (always present; collapses to summary) ——— */}
      {intakeCollapsed && activeSource && talkingPoints ? (
        <ScenarioSummaryBar
          summaryText={summaryText}
          stakeholder={stakeholderText}
          onExpand={() => setIntakeCollapsed(false)}
          onNewScenario={handleNewScenario}
        />
      ) : (
        <div className="space-y-4">
          {/* ——— Intake mode switcher ——————————————— */}
          {!talkingPoints && (
            <div className="flex gap-2">
              <IntakeModeChip
                active={intakeMode === "picker"}
                onClick={() => setIntakeMode("picker")}
              >
                Quick picker
              </IntakeModeChip>
              <IntakeModeChip
                active={intakeMode === "custom"}
                onClick={() => setIntakeMode("custom")}
              >
                Custom rep (survey)
              </IntakeModeChip>
            </div>
          )}

          {/* ——— Picker mode ——————————————————————— */}
          {intakeMode === "picker" && (
            <PickerIntake
              vertical={vertical}
              prompts={prompts}
              selectedPromptIdx={selectedPromptIdx}
              customPromptMode={customPromptMode}
              customPrompt={customPrompt}
              contextInput={contextInput}
              onRefresh={handleRefresh}
              onSelectPrompt={handleSelectPrompt}
              onOpenCustom={handleOpenCustom}
              onCancelCustom={handleCancelCustom}
              onCustomPromptChange={setCustomPrompt}
              onContextChange={setContextInput}
              onSwitchToCustomBuilder={() => setIntakeMode("custom")}
              canGenerate={canGeneratePicker}
              generating={generating}
              onGenerate={handleGenerateFromPicker}
            />
          )}

          {/* ——— Custom (survey) mode —————————————— */}
          {intakeMode === "custom" && (
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
          )}

          {generating && (
            <div className="surface-card flex items-center gap-3 p-4">
              <div className="brand-gradient grid size-8 place-items-center rounded-lg">
                <Sparkles
                  className="size-4 animate-pulse text-white"
                  aria-hidden="true"
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-ink-900">
                  Building your structure…
                </p>
                <p className="text-xs text-ink-500">
                  Composing a tailored scaffold for your scenario. Usually 1–2 seconds.
                </p>
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

      {/* ——— Preview phase (before rep starts) ————————————
           Product Sweep #5: give the user a clear pre-rep review of the
           generated structure with Regenerate / Edit / Start buttons
           before the mic surface takes over. */}
      {talkingPoints && activeSource && !repStarted && (
        <div className="space-y-5">
          <div className="surface-card overflow-hidden">
            <div className="brand-gradient h-1" aria-hidden="true" />
            <div className="p-6 md:p-7">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
                Your structure · preview
              </p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink-900 md:text-3xl">
                Review before you speak.
              </h2>
              <p className="mt-2 text-sm text-ink-600">
                Read through the structure below. Tweak any bullet that
                doesn&rsquo;t match how you&rsquo;d actually say it, regenerate
                if the whole shape is off, or hit Start when you&rsquo;re ready
                to hold this in mind during your rep.
              </p>
              <PressurePicker
                selectedId={pressureArchetypeId}
                onChange={setPressureArchetypeId}
              />

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setRepStarted(true)}
                  className="brand-gradient inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-sm"
                >
                  <ArrowRight className="size-4" />
                  {pressureArchetype ? "Start pressure rep" : "Start rep"}
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

function IntakeModeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "brand-gradient rounded-full px-4 py-1.5 text-xs font-bold text-white"
          : "rounded-full border border-ink-200 bg-white px-4 py-1.5 text-xs font-semibold text-ink-700 hover:border-ink-300"
      }
    >
      {children}
    </button>
  );
}

// ——— Picker intake (extracted for clarity) ————————————————
function PickerIntake({
  vertical: _vertical /* eslint-disable-line @typescript-eslint/no-unused-vars */,
  prompts,
  selectedPromptIdx,
  customPromptMode,
  customPrompt,
  contextInput,
  onRefresh,
  onSelectPrompt,
  onOpenCustom,
  onCancelCustom,
  onCustomPromptChange,
  onContextChange,
  onSwitchToCustomBuilder,
  canGenerate,
  generating,
  onGenerate,
}: {
  vertical: VerticalId;
  prompts: string[];
  selectedPromptIdx: number | null;
  customPromptMode: boolean;
  customPrompt: string;
  contextInput: string;
  onRefresh: () => void;
  onSelectPrompt: (idx: number) => void;
  onOpenCustom: () => void;
  onCancelCustom: () => void;
  onCustomPromptChange: (s: string) => void;
  onContextChange: (s: string) => void;
  onSwitchToCustomBuilder: () => void;
  canGenerate: boolean;
  generating: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            Scenarios for your vertical
          </p>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50"
          >
            <RefreshCw className="size-3" />
            Refresh
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {prompts.map((prompt, i) => {
            const active = selectedPromptIdx === i && !customPromptMode;
            return (
              <button
                key={`${i}-${prompt.slice(0, 20)}`}
                type="button"
                onClick={() => onSelectPrompt(i)}
                aria-pressed={active}
                className={`w-full text-left rounded-xl border p-4 transition ${
                  active
                    ? "border-ink-900 bg-white shadow-sm ring-2 ring-ink-900/10"
                    : "border-ink-200 bg-white hover:border-ink-300"
                }`}
              >
                <p className="text-sm text-ink-800 md:text-base">{prompt}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Write your own + escape hatch to custom builder */}
      <div className="space-y-2">
        {!customPromptMode ? (
          <button
            type="button"
            onClick={onOpenCustom}
            className="w-full rounded-xl border border-dashed border-ink-300 bg-ink-50/50 p-4 text-left transition hover:border-ink-400 hover:bg-white"
          >
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
              <PenLine className="size-3" /> Write your own
            </div>
            <p className="mt-1 text-sm text-ink-500">
              Describe a specific situation you need to handle
            </p>
          </button>
        ) : (
          <div className="rounded-xl border border-ink-900 bg-white p-4 ring-2 ring-ink-900/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                <PenLine className="size-3" /> Your own scenario
              </div>
              <button
                type="button"
                onClick={onCancelCustom}
                className="text-ink-400 hover:text-ink-600"
                aria-label="Cancel custom prompt"
              >
                <X className="size-4" />
              </button>
            </div>
            <textarea
              value={customPrompt}
              onChange={(e) => onCustomPromptChange(e.target.value)}
              placeholder="E.g., I'm about to explain our new pricing to a skeptical VP of Operations."
              className="mt-3 w-full resize-none rounded-lg border border-ink-200 bg-white p-3 text-sm text-ink-800 focus:border-ink-400 focus:outline-none focus:ring-1 focus:ring-ink-900/10"
              rows={3}
              autoFocus
            />
          </div>
        )}

        {/* Escape hatch — the "Not seeing what you're looking for?" button */}
        <button
          type="button"
          onClick={onSwitchToCustomBuilder}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-brand-purple/5 px-4 py-3 text-sm font-semibold text-brand-purple hover:bg-brand-purple/10"
        >
          <Compass className="size-4" strokeWidth={2.5} />
          Not seeing what you&rsquo;re looking for? Build a fully custom rep →
        </button>
      </div>

      {/* Context */}
      <div>
        <label className="block">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
            Context (optional)
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            Key points you want to hit, who you&rsquo;re speaking to, what you
            want to land. The more specific, the better the structure.
          </p>
          <textarea
            value={contextInput}
            onChange={(e) => onContextChange(e.target.value)}
            placeholder="E.g., Audience: skeptical CFO. Key points: ROI in 4 months, kills two legacy tools, no migration risk. Avoid: jargon."
            className="mt-3 w-full resize-none rounded-xl border border-ink-200 bg-white p-3 text-sm text-ink-800 focus:border-ink-400 focus:outline-none focus:ring-1 focus:ring-ink-900/10"
            rows={3}
          />
        </label>
      </div>

      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || generating}
          className="brand-gradient inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {generating ? "Building…" : "Build my structure"}{" "}
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

// ——— Pressure picker (Phase 5) ——————————————————————————
//
// Shown in the preview card as an optional layer. User can apply one of
// the five pressure archetypes before starting a Build-a-Rep scenario —
// rep is then scored with that archetype's weight profile (server-side
// in /api/score). "None" is the default; picking an archetype shows a
// one-line tagline so the user knows what to expect.
function PressurePicker({
  selectedId,
  onChange,
}: {
  selectedId: PressureArchetypeId | null;
  onChange: (id: PressureArchetypeId | null) => void;
}) {
  const archetypes = Object.values(PRESSURE_ARCHETYPES);
  return (
    <div className="mt-6 rounded-xl border border-ink-200 bg-ink-50/60 p-4">
      <div className="flex items-center gap-2">
        <Flame className="size-4 text-amber-600" strokeWidth={2.5} />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-700">
          Add pressure (optional)
        </p>
      </div>
      <p className="mt-1 text-xs text-ink-500">
        Crank the difficulty. Picks a stress mechanism — the scoring
        weights shift to reward how well you held up under it.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <PressureChip
          active={selectedId === null}
          onClick={() => onChange(null)}
          label="None"
        />
        {archetypes.map((a) => (
          <PressureChip
            key={a.id}
            active={selectedId === a.id}
            onClick={() => onChange(a.id)}
            label={a.name}
          />
        ))}
      </div>
      {selectedId && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          {getPressureArchetype(selectedId).tagline}
        </p>
      )}
    </div>
  );
}

function PressureChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm"
          : "rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-ink-300"
      }
    >
      {label}
    </button>
  );
}

// Unused re-export to keep ChevronUp tree-shakable if we need it later.
export const _iconHint = { ChevronUp };
