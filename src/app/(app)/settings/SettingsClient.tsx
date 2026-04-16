"use client";

import { useState, useTransition } from "react";
import { Check, Save, KeyRound, Download, Trash2, AlertTriangle, Mail } from "lucide-react";
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
import {
  sendPasswordResetEmail,
  exportUserData,
  deleteAccount,
  changeEmail,
} from "@/server/actions/account";

type Props = {
  initialVertical: VerticalId | null;
  initialPersonas: PersonaId[];
  initialGoals: ImprovementGoalId[];
  userEmail: string | null;
  userKind: "authenticated" | "guest";
};

type SavedSection = "vertical" | "personas" | "goals" | null;

export function SettingsClient({
  initialVertical,
  initialPersonas,
  initialGoals,
  userEmail,
  userKind,
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

      {userKind === "authenticated" && (
        <AccountSection userEmail={userEmail} />
      )}
    </div>
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
        <div className="h-1 bg-ink-200" aria-hidden="true" />
        <div className="p-6">
          <h2 className="text-lg font-bold text-ink-900">Account &amp; data</h2>
          <p className="mt-1 text-xs text-ink-500">
            Signed in as{" "}
            <span className="font-semibold text-ink-700">{userEmail}</span>
          </p>

          <div className="mt-5 space-y-3">
            <form
              onSubmit={handleChangeEmail}
              className="rounded-xl border border-ink-200 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm font-semibold text-ink-900">
                    Change email
                  </p>
                  <p className="text-xs text-ink-500">
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
                    className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-purple focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={emailPending || !emailDraft}
                    className="inline-flex items-center gap-2 rounded-full border border-ink-200 px-4 py-2 text-xs font-semibold text-ink-700 hover:border-ink-300 disabled:opacity-60"
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
                      ? "mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                      : "mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700"
                  }
                >
                  {emailMessage}
                </p>
              )}
            </form>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 p-4">
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  Reset password
                </p>
                <p className="text-xs text-ink-500">
                  We&apos;ll email you a link to set a new one.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resetPending}
                className="inline-flex items-center gap-2 rounded-full border border-ink-200 px-4 py-2 text-xs font-semibold text-ink-700 hover:border-ink-300 disabled:opacity-60"
              >
                <KeyRound className="size-3.5" />
                {resetPending ? "Sending…" : "Send reset email"}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 p-4">
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  Export your data
                </p>
                <p className="text-xs text-ink-500">
                  Every rep, score, callout, and session you&apos;ve recorded —
                  downloaded as JSON.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExport}
                disabled={exportPending}
                className="inline-flex items-center gap-2 rounded-full border border-ink-200 px-4 py-2 text-xs font-semibold text-ink-700 hover:border-ink-300 disabled:opacity-60"
              >
                <Download className="size-3.5" />
                {exportPending ? "Preparing…" : "Download JSON"}
              </button>
            </div>

            {resetMessage && (
              <div
                className={
                  resetError
                    ? "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
                    : "rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700"
                }
              >
                {resetMessage}
              </div>
            )}

            <div className="rounded-xl border-2 border-red-200 bg-red-50/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-red-900">
                    Delete account
                  </p>
                  <p className="text-xs text-red-700/80">
                    Permanently removes your reps, scores, and sign-in. Can&apos;t
                    be undone.
                  </p>
                </div>
                {!deleteOpen && (
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                  >
                    <Trash2 className="size-3.5" />
                    Delete my account
                  </button>
                )}
              </div>

              {deleteOpen && (
                <div className="mt-4 border-t border-red-200/80 pt-4">
                  <p className="flex items-start gap-2 text-xs text-red-900">
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
                    className="mt-3 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-red-400 focus:outline-none"
                  />
                  {deleteError && (
                    <p className="mt-2 text-xs text-red-700">{deleteError}</p>
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
                      className="inline-flex items-center rounded-full border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 hover:border-ink-300"
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

function SaveIndicator({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-semibold text-green-700">
      <Check className="size-3" strokeWidth={3} />
      Saved
    </div>
  );
}
