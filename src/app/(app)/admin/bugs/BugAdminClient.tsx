"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ArrowLeft,
  Bug,
  CheckCircle2,
  Clock,
  Trash2,
  ExternalLink,
} from "lucide-react";

type BugRow = {
  id: string;
  userId: string | null;
  description: string;
  imageUrls: string[];
  userAgent: string | null;
  route: string | null;
  status: "open" | "in_progress" | "fixed" | "wontfix" | "duplicate";
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  reporter: { id: string; email: string | null; name: string | null } | null;
};

type Filter = "open" | "in_progress" | "fixed" | "wontfix" | "duplicate" | "all";

const TABS: { id: Filter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In progress" },
  { id: "fixed", label: "Fixed" },
  { id: "wontfix", label: "Wontfix" },
  { id: "duplicate", label: "Duplicate" },
  { id: "all", label: "All" },
];

const STATUS_COLOR: Record<BugRow["status"], string> = {
  open: "bg-amber-100 text-amber-700 border-amber-200",
  in_progress: "bg-brand-blue/10 text-brand-blue border-brand-blue/30",
  fixed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  wontfix: "bg-ink-100 text-ink-600 border-ink-200",
  duplicate: "bg-ink-100 text-ink-600 border-ink-200",
};

export function BugAdminClient({
  initialFilter,
  reports,
}: {
  initialFilter: Filter;
  reports: BugRow[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [pending, startTransition] = useTransition();

  function setStatus(id: string, status: BugRow["status"]) {
    startTransition(async () => {
      await fetch(`/api/bug-reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    });
  }

  function deleteReport(id: string) {
    if (!confirm("Delete this report and its screenshots permanently?")) return;
    startTransition(async () => {
      await fetch(`/api/bug-reports/${id}`, { method: "DELETE" });
      router.refresh();
    });
  }

  function changeFilter(next: Filter) {
    setFilter(next);
    const url = next === "open" ? "/admin/bugs" : `/admin/bugs?status=${next}`;
    router.push(url);
  }

  const filtered =
    filter === "all" ? reports : reports.filter((r) => r.status === filter);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <Link
        href="/dashboard"
        className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="size-3" strokeWidth={2.5} />
        Dashboard
      </Link>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-brand-purple">
            Operator
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-extrabold tracking-tight text-ink-900 md:text-4xl">
            <Bug className="size-6 text-brand-purple" strokeWidth={2.5} />
            Bug reports
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            User-submitted reports. Newest first.
          </p>
        </div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
          {reports.length} total
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-ink-200 pb-2">
        {TABS.map((t) => {
          const count = reports.filter((r) =>
            t.id === "all" ? true : r.status === t.id,
          ).length;
          const active = filter === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => changeFilter(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                active
                  ? "bg-ink-900 text-white"
                  : "border border-ink-200 bg-white text-ink-600 hover:border-ink-300"
              }`}
            >
              {t.label}
              <span
                className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  active ? "bg-white/20 text-white" : "bg-ink-100 text-ink-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-ink-200 bg-white p-12 text-center">
          <p className="text-sm text-ink-500">No reports under this filter.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {filtered.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-ink-200 bg-white p-4 md:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_COLOR[r.status]}`}
                    >
                      {r.status.replace("_", " ")}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-ink-400">
                      <Clock className="size-3" strokeWidth={2.5} />
                      {timeAgo(r.createdAt)}
                    </span>
                    {r.reporter ? (
                      <span className="text-[11px] font-semibold text-ink-700">
                        {r.reporter.name ?? r.reporter.email ?? "—"}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-ink-400">
                        Anonymous
                      </span>
                    )}
                    {r.route && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 font-mono text-[10px] text-ink-600">
                        {r.route}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink-800">
                    {r.description}
                  </p>
                  {r.imageUrls.length > 0 && (
                    <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {r.imageUrls.map((url, i) => (
                        <li key={url}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block aspect-video overflow-hidden rounded-lg border border-ink-200 bg-ink-50"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`Screenshot ${i + 1}`}
                              className="size-full object-cover transition-transform group-hover:scale-105"
                            />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.userAgent && (
                    <p className="mt-2 truncate font-mono text-[10px] text-ink-400">
                      {r.userAgent}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-1">
                  {r.status !== "fixed" && (
                    <button
                      type="button"
                      onClick={() => setStatus(r.id, "fixed")}
                      disabled={pending}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <CheckCircle2 className="size-3" strokeWidth={2.5} />
                      Fixed
                    </button>
                  )}
                  {r.status === "open" && (
                    <button
                      type="button"
                      onClick={() => setStatus(r.id, "in_progress")}
                      disabled={pending}
                      className="inline-flex items-center gap-1 rounded-full border border-brand-blue/30 bg-brand-blue/10 px-3 py-1 text-[11px] font-bold text-brand-blue hover:bg-brand-blue/15 disabled:opacity-50"
                    >
                      <Clock className="size-3" strokeWidth={2.5} />
                      Working
                    </button>
                  )}
                  {r.status !== "wontfix" && r.status !== "duplicate" && (
                    <button
                      type="button"
                      onClick={() => setStatus(r.id, "duplicate")}
                      disabled={pending}
                      className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-3 py-1 text-[11px] font-semibold text-ink-600 hover:border-ink-300 disabled:opacity-50"
                    >
                      <ExternalLink className="size-3" strokeWidth={2.5} />
                      Duplicate
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteReport(r.id)}
                    disabled={pending}
                    className="mt-1 inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  >
                    <Trash2 className="size-3" strokeWidth={2.5} />
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}
