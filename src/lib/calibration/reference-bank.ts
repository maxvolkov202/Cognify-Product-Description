import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { supabaseAdmin, hasSupabase } from "@/lib/supabase/admin";

const REFERENCE_REPS_PATH = resolve(
  process.cwd(),
  "scripts",
  "calibration",
  "reference-reps.json",
);

const AUDIO_BUCKET = "rep-audio";
const AUDIO_PREFIX = "reference-reps";
const SIGNED_URL_TTL_SECONDS = 3600;

export type ReferenceRep = {
  id: string;
  kind: "band" | "independence";
  promptText: string;
  transcript: string;
  durationMs: number;
  audioUrl?: string;
  expected?: {
    composite: number;
    band: string;
    dimensions: Record<string, number>;
    subSkills?: Record<string, number>;
    untestableDimensions?: string[];
  };
  assertions?: Array<{
    kind: "minScore" | "maxScore";
    dimension: string;
    min?: number;
    max?: number;
    rationale?: string;
  }>;
};

export type ReferenceBank = {
  rubricVersion: string;
  notes?: string;
  reps: ReferenceRep[];
};

/** Synchronous loader — reference-reps.json is shipped in the repo and
 *  small enough (~50KB) that a synchronous read on cold paths is fine. */
export function loadReferenceBank(): ReferenceBank {
  const raw = readFileSync(REFERENCE_REPS_PATH, "utf8");
  return JSON.parse(raw) as ReferenceBank;
}

/** Deterministic storage key for a reference-rep audio object. Operators
 *  upload to this key; the page checks existence by listing the prefix. */
export function referenceRepStorageKey(repId: string, extension: string): string {
  const safeExt = extension.replace(/^\./, "").toLowerCase();
  return `${AUDIO_PREFIX}/${repId}.${safeExt}`;
}

export type ReferenceRepAudioStatus = {
  /** Storage path (without bucket). null when no audio uploaded. */
  path: string | null;
  /** Short-lived signed URL for playback. null when no audio. */
  signedUrl: string | null;
  /** When the object was last uploaded. */
  updatedAt: Date | null;
  /** Bytes on disk; useful for sanity-checking truncated uploads. */
  sizeBytes: number | null;
};

/** Map of repId → audio status. Reps without audio get an empty status
 *  object; callers can check `path !== null` to test existence. */
export async function listReferenceRepAudio(): Promise<
  Map<string, ReferenceRepAudioStatus>
> {
  const out = new Map<string, ReferenceRepAudioStatus>();
  if (!hasSupabase()) return out;

  const admin = supabaseAdmin();
  const { data, error } = await admin.storage
    .from(AUDIO_BUCKET)
    .list(AUDIO_PREFIX, { limit: 1000 });
  if (error) {
    console.warn(
      `[reference-bank] storage list failed: ${error.message}; treating as empty`,
    );
    return out;
  }

  for (const obj of data ?? []) {
    if (!obj.name) continue;
    const dot = obj.name.lastIndexOf(".");
    const id = dot === -1 ? obj.name : obj.name.slice(0, dot);
    const path = `${AUDIO_PREFIX}/${obj.name}`;
    const { data: signed } = await admin.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    out.set(id, {
      path,
      signedUrl: signed?.signedUrl ?? null,
      updatedAt: obj.updated_at ? new Date(obj.updated_at) : null,
      sizeBytes:
        typeof obj.metadata?.size === "number" ? obj.metadata.size : null,
    });
  }
  return out;
}

/** Single-rep audio status. Used by the upload endpoint to return the
 *  freshly-uploaded URL + by check-reference-audio.mjs. */
export async function getReferenceRepAudioStatus(
  repId: string,
): Promise<ReferenceRepAudioStatus> {
  const empty: ReferenceRepAudioStatus = {
    path: null,
    signedUrl: null,
    updatedAt: null,
    sizeBytes: null,
  };
  if (!hasSupabase()) return empty;
  const admin = supabaseAdmin();
  const { data, error } = await admin.storage
    .from(AUDIO_BUCKET)
    .list(AUDIO_PREFIX, { limit: 1000, search: repId });
  if (error || !data) return empty;
  const match = data.find((obj) => {
    const dot = obj.name?.lastIndexOf(".") ?? -1;
    const id = dot === -1 ? obj.name : obj.name?.slice(0, dot);
    return id === repId;
  });
  if (!match?.name) return empty;
  const path = `${AUDIO_PREFIX}/${match.name}`;
  const { data: signed } = await admin.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return {
    path,
    signedUrl: signed?.signedUrl ?? null,
    updatedAt: match.updated_at ? new Date(match.updated_at) : null,
    sizeBytes:
      typeof match.metadata?.size === "number" ? match.metadata.size : null,
  };
}

/** Upsert audio for a reference rep. Used by the operator endpoint.
 *  Returns the persisted path + a fresh signed URL. */
export async function uploadReferenceRepAudio(args: {
  repId: string;
  audio: Buffer;
  mimeType: string;
}): Promise<ReferenceRepAudioStatus> {
  if (!hasSupabase()) {
    throw new Error("Supabase not configured — cannot persist audio.");
  }
  const ext = mimeToExtension(args.mimeType);
  const key = referenceRepStorageKey(args.repId, ext);
  const admin = supabaseAdmin();
  const { error: uploadErr } = await admin.storage
    .from(AUDIO_BUCKET)
    .upload(key, args.audio, {
      contentType: args.mimeType,
      upsert: true,
    });
  if (uploadErr) {
    throw new Error(`Audio upload failed: ${uploadErr.message}`);
  }
  const { data: signed, error: signErr } = await admin.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(key, SIGNED_URL_TTL_SECONDS);
  if (signErr) {
    throw new Error(`Signed URL generation failed: ${signErr.message}`);
  }
  return {
    path: key,
    signedUrl: signed?.signedUrl ?? null,
    updatedAt: new Date(),
    sizeBytes: args.audio.byteLength,
  };
}

function mimeToExtension(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("m4a") || m.includes("mp4")) return "m4a";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("flac")) return "flac";
  return "webm";
}
