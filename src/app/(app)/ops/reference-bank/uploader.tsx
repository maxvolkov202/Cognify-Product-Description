"use client";

import { useState, useRef } from "react";
import { Upload, Loader2 } from "lucide-react";

export function ReferenceRepUploader({
  repId,
  hasAudio,
}: {
  repId: string;
  hasAudio: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "uploading" | "ok" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setStatus("uploading");
    setError(null);
    const fd = new FormData();
    fd.append("audio", file);
    try {
      const res = await fetch(`/api/ops/reference-rep/${repId}/audio`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
      }
      setStatus("ok");
      // Soft refresh — let the operator see the upload landed.
      window.location.reload();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === "uploading"}
        className="inline-flex items-center gap-1.5 rounded-md border border-brand-purple/30 bg-brand-purple/10 px-2.5 py-1 text-[11px] font-semibold text-brand-purple hover:bg-brand-purple/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "uploading" ? (
          <>
            <Loader2 className="size-3 animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <Upload className="size-3" />
            {hasAudio ? "Replace" : "Upload"}
          </>
        )}
      </button>
      {error && (
        <p className="text-[10px] text-danger" title={error}>
          {error.slice(0, 40)}
        </p>
      )}
    </div>
  );
}
