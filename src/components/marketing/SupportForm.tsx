"use client";

import { useState } from "react";
import { Send, CheckCircle2, AlertTriangle } from "lucide-react";

const TOPICS = [
  { value: "getting_started", label: "Getting started" },
  { value: "scoring", label: "Scoring & feedback" },
  { value: "billing", label: "Billing" },
  { value: "bug", label: "Bug report" },
  { value: "feature", label: "Feature request" },
  { value: "other", label: "Other" },
] as const;

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ok"; delivered: boolean }
  | { kind: "error"; message: string };

export function SupportForm() {
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [topic, setTopic] = useState<(typeof TOPICS)[number]["value"]>("other");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "submitting") return;
    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fromEmail: fromEmail.trim(),
          fromName: fromName.trim() || undefined,
          topic,
          message: message.trim(),
          website: website.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        delivered?: boolean;
      };
      if (!res.ok) {
        setStatus({
          kind: "error",
          message: data.message ?? "Couldn't send. Try again in a minute.",
        });
        return;
      }
      setStatus({ kind: "ok", delivered: data.delivered !== false });
      setMessage("");
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error.",
      });
    }
  }

  if (status.kind === "ok") {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
          <div>
            <p className="text-base font-bold text-ink-900">
              {status.delivered
                ? "Message received. We'll reply to the email you gave."
                : "Message logged. Email isn't configured yet in this environment, but your note was captured."}
            </p>
            <p className="mt-1 text-sm text-ink-600">
              Typical turnaround is within one business day.
            </p>
            <button
              type="button"
              onClick={() => setStatus({ kind: "idle" })}
              className="mt-4 text-sm font-semibold text-brand-purple hover:underline"
            >
              Send another →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="surface-card overflow-hidden">
      <div className="brand-gradient h-1" aria-hidden="true" />
      <div className="space-y-5 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Your email" required>
            <input
              type="email"
              required
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@company.com"
              className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/15"
            />
          </Field>
          <Field label="Your name">
            <input
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              autoComplete="name"
              placeholder="Optional"
              className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/15"
            />
          </Field>
        </div>

        <Field label="Topic">
          <select
            value={topic}
            onChange={(e) =>
              setTopic(e.target.value as typeof topic)
            }
            className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/15"
          >
            {TOPICS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Your message" required>
          <textarea
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's going on? If it's a bug, what did you try and what did you see?"
            className="w-full resize-y rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/15"
          />
          <p className="mt-1 text-[11px] text-ink-500">
            {message.length}/5000
          </p>
        </Field>

        {/* Honeypot — hidden from real users, bots fill it. */}
        <div className="hidden" aria-hidden="true">
          <label>
            Website (leave blank)
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>

        {status.kind === "error" && (
          <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>{status.message}</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={status.kind === "submitting"}
            className="brand-gradient inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="size-4" />
            {status.kind === "submitting" ? "Sending…" : "Send message"}
          </button>
          <p className="text-xs text-ink-500">
            We don&rsquo;t share your email. Ever.
          </p>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-700">
        {label}
        {required && (
          <span className="ml-2 text-[10px] font-semibold text-brand-purple">
            Required
          </span>
        )}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
