"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ClipboardEvent,
} from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Bug, ImagePlus, Loader2, X } from "lucide-react";

const MAX_FILES = 4;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DESCRIPTION = 2000;
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

type Props = { onClose: () => void };

type LocalFile = {
  id: string;
  file: File;
  preview: string;
};

export function ReportBugModal({ onClose }: Props) {
  const pathname = usePathname();
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URLs to avoid leaks.
  useEffect(() => {
    return () => {
      for (const f of files) URL.revokeObjectURL(f.preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, submitting]);

  function addFiles(incoming: File[]) {
    setError(null);
    const validated: LocalFile[] = [];
    for (const file of incoming) {
      if (!ALLOWED_MIME.has(file.type)) {
        setError(`Skipped ${file.name}: only PNG / JPG / GIF / WebP supported.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`Skipped ${file.name}: max 5MB per image.`);
        continue;
      }
      validated.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        preview: URL.createObjectURL(file),
      });
    }
    setFiles((prev) => {
      const next = [...prev, ...validated];
      if (next.length > MAX_FILES) {
        setError(`Max ${MAX_FILES} images per report.`);
        return next.slice(0, MAX_FILES);
      }
      return next;
    });
  }

  function handlePicked(e: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    addFiles(selected);
    e.target.value = "";
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const dropped = Array.from(e.dataTransfer.files);
    addFiles(dropped);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData.items;
    if (!items) return;
    const pasted: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) pasted.push(f);
      }
    }
    if (pasted.length > 0) {
      e.preventDefault();
      addFiles(pasted);
    }
  }

  function removeFile(id: string) {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((f) => f.id !== id);
    });
  }

  async function handleSubmit() {
    if (!description.trim()) {
      setError("Please describe the bug.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("description", description.trim());
      if (pathname) fd.set("route", pathname);
      if (typeof navigator !== "undefined") {
        fd.set("userAgent", navigator.userAgent);
      }
      files.forEach((f, i) => fd.append(`image_${i}`, f.file, f.file.name));

      const res = await fetch("/api/bug-reports", {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error ?? `Submit failed (${res.status})`);
      }
      setSuccessId(json?.id ?? "ok");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[110] flex items-end justify-center bg-ink-900/40 p-3 backdrop-blur-sm md:items-center md:p-6"
        onClick={() => !submitting && onClose()}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-bug-title"
          initial={{ y: 24, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 12, opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          onPaste={handlePaste}
          className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-[0_24px_80px_-30px_rgba(20,20,40,0.45)]"
        >
          <div className="relative overflow-hidden">
            <div className="brand-gradient absolute inset-0" aria-hidden="true" />
            <div className="relative flex items-start justify-between gap-3 p-5 text-white md:p-6">
              <div className="flex items-start gap-3">
                <div className="grid size-9 place-items-center rounded-xl bg-white/15">
                  <Bug className="size-4 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-white/80">
                    Report a bug
                  </p>
                  <h2
                    id="report-bug-title"
                    className="mt-0.5 text-xl font-extrabold tracking-tight md:text-2xl"
                  >
                    Tell us what broke.
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !submitting && onClose()}
                className="grid size-8 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 disabled:opacity-50"
                disabled={submitting}
                aria-label="Close"
              >
                <X className="size-4" strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {successId ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-emerald-100">
                <Bug className="size-5 text-emerald-700" strokeWidth={2.5} />
              </div>
              <h3 className="text-lg font-extrabold text-ink-900">
                Thanks — we got it.
              </h3>
              <p className="max-w-sm text-sm text-ink-600">
                Your report is in the queue. We&rsquo;ll fix it.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="brand-gradient mt-2 inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-bold text-white"
              >
                Back to the gym
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-5 md:p-6">
              <label className="block">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-ink-500">
                  What happened?
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
                  rows={5}
                  placeholder="Steps to reproduce, what you expected, what you saw."
                  className="mt-1.5 w-full resize-none rounded-2xl border border-ink-200 bg-white p-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-brand-purple/20"
                />
                <p className="mt-1 text-right text-[10px] tabular-nums text-ink-400">
                  {description.length} / {MAX_DESCRIPTION}
                </p>
              </label>

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="mt-3 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/50 p-4 transition-colors hover:border-brand-purple/40"
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">
                  Screenshots (optional)
                </p>
                <p className="mt-1 text-[11px] text-ink-500">
                  Drag &amp; drop, paste from clipboard
                  <span className="font-mono"> (⌘V / Ctrl+V)</span>, or pick files. Up to {MAX_FILES} images, 5MB each.
                </p>

                {files.length > 0 && (
                  <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {files.map((f) => (
                      <li
                        key={f.id}
                        className="group relative aspect-square overflow-hidden rounded-xl border border-ink-200 bg-white"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.preview}
                          alt={f.file.name}
                          className="size-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeFile(f.id)}
                          className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-ink-900/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label={`Remove ${f.file.name}`}
                        >
                          <X className="size-3" strokeWidth={2.5} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50"
                  disabled={files.length >= MAX_FILES}
                >
                  <ImagePlus className="size-3.5" strokeWidth={2.5} />
                  Add screenshot
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  multiple
                  hidden
                  onChange={handlePicked}
                />
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
                We&rsquo;ll see: the page you were on (
                <span className="font-mono text-ink-700">{pathname ?? "—"}</span>
                ) and your browser. Nothing else from your session.
              </p>

              {error && (
                <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] font-semibold text-rose-700">
                  {error}
                </p>
              )}
            </div>
          )}

          {!successId && (
            <div className="flex items-center justify-end gap-2 border-t border-ink-200 p-4">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-semibold text-ink-700 hover:border-ink-300 hover:bg-ink-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || description.trim().length === 0}
                className="brand-gradient inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
                )}
                {submitting ? "Sending…" : "Send report"}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
