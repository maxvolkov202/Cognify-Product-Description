"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  X,
  Compass,
  ChevronDown,
  Zap,
  ListChecks,
} from "lucide-react";
import {
  getStakeholdersForVertical,
  type VerticalId,
} from "@/lib/onboarding/constants";
import { cn } from "@/lib/utils/cn";

export type CustomScenarioPayload = {
  scenario: string;
  context: string;
  stakeholder?: string;
  userRole?: string;
  desiredOutcome?: string;
  emotionalStakes?: string;
  timePressure?: string;
  tonePreference?: string;
};

type Props = {
  vertical: VerticalId;
  /** Pre-fill stakeholder if the user picked one on a previous attempt. */
  initialStakeholder?: string;
  onCancel: () => void;
  onSubmit: (payload: CustomScenarioPayload) => void;
};

type Mode = "quick" | "guided";

type FormState = {
  situation: string;
  stakeholderPick: string;
  stakeholderCustom: string;
  userRole: string;
  emotionalStakes: string;
  timePressure: string;
  desiredOutcome: string;
  tonePreference: string;
  constraints: string;
};

const INITIAL_FORM: FormState = {
  situation: "",
  stakeholderPick: "",
  stakeholderCustom: "",
  userRole: "",
  emotionalStakes: "",
  timePressure: "",
  desiredOutcome: "",
  tonePreference: "",
  constraints: "",
};

const TIME_PRESETS: Array<{ id: string; label: string; value: string }> = [
  { id: "under-30", label: "Under 30s", value: "under 30 seconds" },
  { id: "one-two", label: "1-2 min", value: "about one to two minutes" },
  { id: "few-min", label: "A few min", value: "a few minutes of back-and-forth" },
  { id: "long", label: "Long-form", value: "long-form discussion" },
  { id: "unsure", label: "Not sure", value: "time pressure uncertain" },
];

const TONE_PRESETS: Array<{ id: string; label: string; value: string }> = [
  { id: "warm-firm", label: "Warm + firm", value: "warm but firm" },
  { id: "direct", label: "Direct", value: "direct and efficient" },
  { id: "empathetic", label: "Empathetic", value: "empathetic and patient" },
  { id: "persuasive", label: "Persuasive", value: "persuasive but not salesy" },
  { id: "formal", label: "Formal", value: "strictly professional / formal" },
  { id: "casual", label: "Casual", value: "casual and conversational" },
];

/**
 * Full-customization survey for "not seeing what you're looking for" path.
 * Composes a rich scenario string + context from structured fields so Claude
 * gets sharper grounding than free-form "write your own" input.
 *
 * Two modes:
 *   - Quick: single-screen form. Fast for users who know what they want.
 *   - Guided: one-question-at-a-time wizard with soft-required fields. For
 *     users who want to be walked through all the context Cognify can use.
 *
 * Mode toggle is visible at the top. User can flip between modes and keep
 * form state. Both modes produce the same payload shape.
 */
export function CustomScenarioBuilder({
  vertical,
  initialStakeholder,
  onCancel,
  onSubmit,
}: Props) {
  const stakeholderOptions = useMemo(
    () => getStakeholdersForVertical(vertical),
    [vertical],
  );

  const [mode, setMode] = useState<Mode>("quick");
  const [form, setForm] = useState<FormState>(() => ({
    ...INITIAL_FORM,
    stakeholderPick:
      initialStakeholder && stakeholderOptions.includes(initialStakeholder)
        ? initialStakeholder
        : "",
    stakeholderCustom:
      initialStakeholder && !stakeholderOptions.includes(initialStakeholder)
        ? initialStakeholder
        : "",
  }));

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const stakeholder =
    form.stakeholderPick === "__custom__"
      ? form.stakeholderCustom.trim()
      : form.stakeholderPick;

  const canSubmit =
    form.situation.trim().length > 0 &&
    form.desiredOutcome.trim().length > 0;

  const buildPayload = (): CustomScenarioPayload => {
    const scenarioBits = [
      form.situation.trim(),
      stakeholder ? `Speaking to: ${stakeholder}.` : null,
    ]
      .filter(Boolean)
      .join(" ");
    const contextBits = [
      form.userRole.trim() ? `Your role: ${form.userRole.trim()}.` : null,
      form.desiredOutcome.trim()
        ? `Desired outcome: ${form.desiredOutcome.trim()}.`
        : null,
      form.emotionalStakes.trim()
        ? `Emotional stakes: ${form.emotionalStakes.trim()}.`
        : null,
      form.timePressure.trim()
        ? `Time pressure: ${form.timePressure.trim()}.`
        : null,
      form.tonePreference.trim()
        ? `Tone: ${form.tonePreference.trim()}.`
        : null,
      form.constraints.trim()
        ? `Constraints: ${form.constraints.trim()}.`
        : null,
    ]
      .filter(Boolean)
      .join(" ");
    return {
      scenario: scenarioBits,
      context: contextBits,
      stakeholder: stakeholder || undefined,
      userRole: form.userRole.trim() || undefined,
      desiredOutcome: form.desiredOutcome.trim() || undefined,
      emotionalStakes: form.emotionalStakes.trim() || undefined,
      timePressure: form.timePressure.trim() || undefined,
      tonePreference: form.tonePreference.trim() || undefined,
    };
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(buildPayload());
  };

  return (
    <div className="surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="p-6">
        <div className="flex items-start gap-3">
          <div className="brand-gradient grid size-10 shrink-0 place-items-center rounded-xl shadow-sm">
            <Compass
              className="size-5 text-white"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-purple">
              Build a custom rep
            </p>
            <h3 className="mt-1 text-xl font-extrabold text-ink-900">
              Tell us what you&rsquo;re actually preparing for.
            </h3>
            <p className="mt-1 text-sm text-ink-600">
              The more specific you are, the sharper the structure.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-ink-400 hover:text-ink-700"
            aria-label="Cancel custom rep"
          >
            <X className="size-5" />
          </button>
        </div>

        <div
          className="mt-5 inline-flex rounded-full border border-ink-200 bg-ink-50 p-0.5"
          role="tablist"
          aria-label="Input mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "quick"}
            onClick={() => setMode("quick")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
              mode === "quick"
                ? "bg-white text-ink-900 shadow-sm"
                : "text-ink-500 hover:text-ink-700",
            )}
          >
            <Zap className="size-3" /> Quick
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "guided"}
            onClick={() => setMode("guided")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
              mode === "guided"
                ? "bg-white text-ink-900 shadow-sm"
                : "text-ink-500 hover:text-ink-700",
            )}
          >
            <ListChecks className="size-3" /> Guided survey
          </button>
        </div>

        {mode === "quick" ? (
          <QuickForm
            form={form}
            stakeholderOptions={stakeholderOptions}
            onUpdate={update}
            canSubmit={canSubmit}
            onSubmit={handleSubmit}
            onCancel={onCancel}
          />
        ) : (
          <GuidedWizard
            form={form}
            stakeholderOptions={stakeholderOptions}
            onUpdate={update}
            canSubmit={canSubmit}
            onSubmit={handleSubmit}
            onCancel={onCancel}
          />
        )}
      </div>
    </div>
  );
}

// ——— Quick form ——————————————————————————————————————————————

type SharedProps = {
  form: FormState;
  stakeholderOptions: readonly string[];
  onUpdate: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  canSubmit: boolean;
  onSubmit: () => void;
  onCancel: () => void;
};

function QuickForm({
  form,
  stakeholderOptions,
  onUpdate,
  canSubmit,
  onSubmit,
  onCancel,
}: SharedProps) {
  return (
    <>
      <div className="mt-6 space-y-5">
        <Field
          label="Situation"
          required
          hint="What are you preparing for? Be specific."
        >
          <textarea
            value={form.situation}
            onChange={(e) => onUpdate("situation", e.target.value)}
            rows={3}
            placeholder="I'm going into a negotiation with a car dealer about a repair problem…"
            className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/15"
          />
        </Field>

        <StakeholderPicker
          pick={form.stakeholderPick}
          custom={form.stakeholderCustom}
          options={stakeholderOptions}
          onPick={(v) => onUpdate("stakeholderPick", v)}
          onCustom={(v) => {
            onUpdate("stakeholderCustom", v);
            if (v.trim().length > 0) onUpdate("stakeholderPick", "__custom__");
          }}
        />

        <Field
          label="Your role"
          hint="Who are you in this conversation? Helps calibrate register."
        >
          <input
            type="text"
            value={form.userRole}
            onChange={(e) => onUpdate("userRole", e.target.value)}
            placeholder="Account executive · Attorney · Founder · Parent · Best man…"
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/15"
          />
        </Field>

        <Field
          label="Desired outcome"
          required
          hint="What does success look like? What do you want them to do or believe?"
        >
          <textarea
            value={form.desiredOutcome}
            onChange={(e) => onUpdate("desiredOutcome", e.target.value)}
            rows={2}
            placeholder="They agree to cover the repair cost. Or: they understand why the pricing change is in their interest…"
            className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/15"
          />
        </Field>

        <Field
          label="Constraints or concerns"
          hint="Anything the structure should watch out for — sensitivities, politics, deal-breakers."
        >
          <textarea
            value={form.constraints}
            onChange={(e) => onUpdate("constraints", e.target.value)}
            rows={2}
            placeholder="They're defensive about their team's work. Can't come off as accusatory. Budget is tight…"
            className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/15"
          />
        </Field>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="brand-gradient inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Build my structure
          <ArrowRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-semibold text-ink-500 hover:text-ink-900"
        >
          Cancel
        </button>
        {!canSubmit && (
          <p className="ml-auto text-xs text-ink-500">
            Situation and desired outcome are required.
          </p>
        )}
      </div>
    </>
  );
}

// ——— Guided wizard ——————————————————————————————————————————

type Step = {
  id: keyof FormState | "stakeholder" | "summary";
  title: string;
  subtitle: string;
  required?: boolean;
};

const STEPS: readonly Step[] = [
  {
    id: "situation",
    title: "What are you preparing for?",
    subtitle: "One sentence is fine. More detail sharpens the structure.",
    required: true,
  },
  {
    id: "stakeholder",
    title: "Who are you speaking to?",
    subtitle: "Pick the closest match or type your own.",
  },
  {
    id: "userRole",
    title: "Who are you in this conversation?",
    subtitle: "Your role changes the register. Short answer is fine.",
  },
  {
    id: "desiredOutcome",
    title: "What does success look like?",
    subtitle: "What do you want them to do, believe, or agree to?",
    required: true,
  },
  {
    id: "emotionalStakes",
    title: "Are there emotional or relational stakes?",
    subtitle: "How you handle the relationship matters. Skip if not.",
  },
  {
    id: "timePressure",
    title: "How much time will you have?",
    subtitle: "Pick a window. Drives pacing and structure size.",
  },
  {
    id: "tonePreference",
    title: "What tone should you strike?",
    subtitle: "Cognify will calibrate the structure's voice.",
  },
  {
    id: "constraints",
    title: "Anything to watch out for?",
    subtitle: "Sensitivities, politics, hard limits. Optional.",
  },
  {
    id: "summary",
    title: "Ready to build.",
    subtitle: "Review what Cognify will use, then build your structure.",
  },
] as const;

function GuidedWizard({
  form,
  stakeholderOptions,
  onUpdate,
  canSubmit,
  onSubmit,
  onCancel,
}: SharedProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex]!;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  const isCurrentStepSatisfied = (() => {
    if (!step.required) return true;
    if (step.id === "situation") return form.situation.trim().length > 0;
    if (step.id === "desiredOutcome")
      return form.desiredOutcome.trim().length > 0;
    return true;
  })();

  return (
    <div className="mt-6">
      <div className="mb-4">
        <div
          className="flex gap-1"
          role="progressbar"
          aria-valuenow={stepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}
        >
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition",
                i <= stepIndex ? "bg-brand-purple" : "bg-ink-200",
              )}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          Step {stepIndex + 1} of {STEPS.length}
        </p>
      </div>

      <div className="min-h-[240px]">
        <h4 className="text-lg font-extrabold text-ink-900 md:text-xl">
          {step.title}
          {step.required && (
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-brand-purple">
              Required
            </span>
          )}
        </h4>
        <p className="mt-1 text-sm text-ink-600">{step.subtitle}</p>

        <div className="mt-4">
          <GuidedStepBody
            step={step}
            form={form}
            stakeholderOptions={stakeholderOptions}
            onUpdate={onUpdate}
          />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={isFirst ? onCancel : () => setStepIndex((i) => i - 1)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft className="size-4" />
          {isFirst ? "Cancel" : "Back"}
        </button>

        <div className="flex items-center gap-3">
          {!isLast && !step.required && (
            <button
              type="button"
              onClick={() => setStepIndex((i) => i + 1)}
              className="text-sm font-semibold text-ink-500 hover:text-ink-900"
            >
              Skip
            </button>
          )}
          {isLast ? (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="brand-gradient inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              Build my structure
              <ArrowRight className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStepIndex((i) => i + 1)}
              disabled={!isCurrentStepSatisfied}
              className="brand-gradient inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function GuidedStepBody({
  step,
  form,
  stakeholderOptions,
  onUpdate,
}: {
  step: Step;
  form: FormState;
  stakeholderOptions: readonly string[];
  onUpdate: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  if (step.id === "situation") {
    return (
      <textarea
        value={form.situation}
        onChange={(e) => onUpdate("situation", e.target.value)}
        rows={4}
        autoFocus
        placeholder="I'm going into a 1:1 with a direct report who missed their targets again…"
        className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/15"
      />
    );
  }

  if (step.id === "stakeholder") {
    return (
      <StakeholderPicker
        pick={form.stakeholderPick}
        custom={form.stakeholderCustom}
        options={stakeholderOptions}
        onPick={(v) => onUpdate("stakeholderPick", v)}
        onCustom={(v) => {
          onUpdate("stakeholderCustom", v);
          if (v.trim().length > 0) onUpdate("stakeholderPick", "__custom__");
        }}
        bare
      />
    );
  }

  if (step.id === "userRole") {
    return (
      <input
        type="text"
        value={form.userRole}
        onChange={(e) => onUpdate("userRole", e.target.value)}
        autoFocus
        placeholder="Manager · Sales rep · Attorney · Parent…"
        className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/15"
      />
    );
  }

  if (step.id === "desiredOutcome") {
    return (
      <textarea
        value={form.desiredOutcome}
        onChange={(e) => onUpdate("desiredOutcome", e.target.value)}
        rows={3}
        autoFocus
        placeholder="They commit to a plan for next quarter. Or: they understand why this isn't working…"
        className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/15"
      />
    );
  }

  if (step.id === "emotionalStakes") {
    return (
      <textarea
        value={form.emotionalStakes}
        onChange={(e) => onUpdate("emotionalStakes", e.target.value)}
        rows={3}
        placeholder="We work together every day. The relationship matters more than this one decision…"
        className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/15"
      />
    );
  }

  if (step.id === "timePressure") {
    return (
      <PresetPicker
        presets={TIME_PRESETS}
        value={form.timePressure}
        onPick={(v) => onUpdate("timePressure", v)}
      />
    );
  }

  if (step.id === "tonePreference") {
    return (
      <PresetPicker
        presets={TONE_PRESETS}
        value={form.tonePreference}
        onPick={(v) => onUpdate("tonePreference", v)}
      />
    );
  }

  if (step.id === "constraints") {
    return (
      <textarea
        value={form.constraints}
        onChange={(e) => onUpdate("constraints", e.target.value)}
        rows={3}
        placeholder="They're defensive about last quarter. Can't come off as blaming. Budget is locked…"
        className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/15"
      />
    );
  }

  if (step.id === "summary") {
    return <SummaryPanel form={form} />;
  }

  return null;
}

function SummaryPanel({ form }: { form: FormState }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Situation", value: form.situation.trim() },
    {
      label: "Stakeholder",
      value:
        form.stakeholderPick === "__custom__"
          ? form.stakeholderCustom.trim()
          : form.stakeholderPick,
    },
    { label: "Your role", value: form.userRole.trim() },
    { label: "Desired outcome", value: form.desiredOutcome.trim() },
    { label: "Emotional stakes", value: form.emotionalStakes.trim() },
    { label: "Time pressure", value: form.timePressure.trim() },
    { label: "Tone", value: form.tonePreference.trim() },
    { label: "Constraints", value: form.constraints.trim() },
  ];
  return (
    <div className="space-y-2 rounded-xl border border-ink-200 bg-ink-50 p-4">
      {rows.map((r) => (
        <div key={r.label} className="flex gap-3 text-sm">
          <p className="w-40 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
            {r.label}
          </p>
          <p className="flex-1 text-ink-800">
            {r.value || <span className="text-ink-400">—</span>}
          </p>
        </div>
      ))}
    </div>
  );
}

// ——— Shared pieces ——————————————————————————————————————————

function StakeholderPicker({
  pick,
  custom,
  options,
  onPick,
  onCustom,
  bare,
}: {
  pick: string;
  custom: string;
  options: readonly string[];
  onPick: (v: string) => void;
  onCustom: (v: string) => void;
  bare?: boolean;
}) {
  const content = (
    <div className="grid gap-2 md:grid-cols-2">
      <div className="relative">
        <select
          value={pick}
          onChange={(e) => onPick(e.target.value)}
          className="w-full appearance-none rounded-xl border border-ink-200 bg-white px-3 py-2.5 pr-8 text-sm text-ink-800 focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/15"
        >
          <option value="">Select a stakeholder…</option>
          {options.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="__custom__">Someone else (type below)</option>
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
          aria-hidden="true"
        />
      </div>
      <input
        type="text"
        value={custom}
        onChange={(e) => onCustom(e.target.value)}
        placeholder="Or type a specific role…"
        className={cn(
          "w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-ink-800 focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/15",
          pick === "__custom__" ? "border-brand-purple/50" : "border-ink-200",
        )}
      />
    </div>
  );
  if (bare) return content;
  return (
    <Field
      label="Who are you speaking to?"
      hint="Pick the closest match or write your own."
    >
      {content}
    </Field>
  );
}

function PresetPicker({
  presets,
  value,
  onPick,
}: {
  presets: Array<{ id: string; label: string; value: string }>;
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((p) => {
        const active = value === p.value;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(active ? "" : p.value)}
            aria-pressed={active}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              active
                ? "border-brand-purple bg-brand-purple/10 text-brand-purple"
                : "border-ink-200 bg-white text-ink-700 hover:border-ink-300",
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-700">
          {label}
        </p>
        {required && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-purple">
            Required
          </span>
        )}
      </div>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}
