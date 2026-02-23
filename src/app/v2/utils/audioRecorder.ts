/**
 * Robust Audio Recorder — standalone functions wrapping the MediaRecorder API.
 *
 * Key guarantees:
 * - `startAudioRecording` throws if mic access fails or MediaRecorder can't start
 * - `handle.stop()` returns a Promise that resolves ONLY after the blob is assembled
 * - All stream tracks are cleaned up on stop
 * - Debug logs in dev mode for every state transition and chunk
 */

// ─── MIME type detection ────────────────────────────────────────────────────

export function getSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";

  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "audio/mpeg",
  ];

  for (const type of types) {
    try {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log("[AudioRecorder] Using MIME:", type);
        return type;
      }
    } catch {
      continue;
    }
  }
  return "";
}

// ─── Environment support check ──────────────────────────────────────────────

export function checkRecordingSupport(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices !== "undefined" &&
      typeof navigator.mediaDevices.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined"
    );
  } catch {
    return false;
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RecordingResult {
  blob: Blob;
  durationMs: number;
  mimeType: string;
  chunkCount: number;
  chunkSizes: number[];
}

export interface RecordingHandle {
  /** Stop recording. Resolves ONLY after the final blob is created. */
  stop: () => Promise<RecordingResult>;
  /** Pause the MediaRecorder. */
  pause: () => void;
  /** Resume the MediaRecorder. */
  resume: () => void;
  /** The underlying MediaStream (for level meters, etc.). */
  stream: MediaStream;
  /** The MIME type the recorder is using. */
  mimeType: string;
}

// ─── Main entry point ───────────────────────────────────────────────────────

/**
 * Request microphone access, create a MediaRecorder, and start recording.
 *
 * THROWS if:
 *  - getUserMedia fails (permission denied, no mic, etc.)
 *  - MediaRecorder constructor fails
 *  - No audio tracks on the stream
 *
 * The returned handle's `stop()` resolves ONLY after `recorder.onstop` fires
 * and a non-empty blob has been assembled from all chunks.
 */
export async function startAudioRecording(
  timeslice = 250
): Promise<RecordingHandle> {
  // ── 1. Request microphone ─────────────────────────────────────────────
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (err: any) {
    let message = "Could not access microphone.";
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
      message =
        "Microphone permission is blocked. Enable it in your browser settings and retry.";
    else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError")
      message = "No microphone found. Please connect a microphone and try again.";
    else if (err.name === "NotReadableError" || err.name === "TrackStartError")
      message =
        "Your microphone is in use by another application. Please close other apps using the microphone.";
    else if (err.name === "SecurityError")
      message =
        "Microphone access is blocked in this context (iframe security restriction).";
    throw new Error(message);
  }

  // ── 2. Verify audio tracks exist ──────────────────────────────────────
  if (stream.getAudioTracks().length === 0) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("No audio tracks available from microphone.");
  }

  console.log(
    "[AudioRecorder] Mic stream acquired —",
    stream.getAudioTracks().length,
    "audio track(s)"
  );

  // ── 3. Get MIME type ──────────────────────────────────────────────────
  const mimeType = getSupportedMimeType();

  // ── 4. Create MediaRecorder ───────────────────────────────────────────
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType: mimeType || undefined,
      audioBitsPerSecond: 128000,
    });
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error(
      "MediaRecorder could not be created. Your browser may not support audio recording."
    );
  }

  // ── 5. Chunk collection ───────────────────────────────────────────────
  const chunks: Blob[] = [];
  const chunkSizes: number[] = [];
  const startTs = Date.now();
  let stopPromiseSettled = false;

  recorder.ondataavailable = (e: BlobEvent) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
      chunkSizes.push(e.data.size);
      console.log(
        `[AudioRecorder] chunk #${chunks.length}: ${e.data.size} bytes`
      );
    }
  };

  // ── 6. Start with timeslice ───────────────────────────────────────────
  recorder.start(timeslice);
  console.log(
    `[AudioRecorder] STARTED — state=${recorder.state}, timeslice=${timeslice}ms, mime=${recorder.mimeType}`
  );

  // ── 7. Build and return handle ────────────────────────────────────────
  const effectiveMime = recorder.mimeType || mimeType || "audio/webm";

  const handle: RecordingHandle = {
    stream,
    mimeType: effectiveMime,

    stop: () =>
      new Promise<RecordingResult>((resolve, reject) => {
        // Guard: already stopped (double-call)
        if (recorder.state === "inactive") {
          if (stopPromiseSettled) {
            reject(new Error("Recording already stopped."));
            return;
          }
          // Assemble what we have
          const blob = new Blob(chunks, { type: effectiveMime });
          stream.getTracks().forEach((t) => t.stop());
          stopPromiseSettled = true;
          if (blob.size === 0) {
            reject(new Error("empty_blob"));
          } else {
            resolve({
              blob,
              durationMs: Date.now() - startTs,
              mimeType: effectiveMime,
              chunkCount: chunks.length,
              chunkSizes,
            });
          }
          return;
        }

        // Wire onstop to resolve the promise AFTER final dataavailable
        recorder.onstop = () => {
          const endTs = Date.now();
          const finalMime = recorder.mimeType || effectiveMime;
          console.log(
            `[AudioRecorder] STOPPED — ${chunks.length} chunks, sizes:`,
            chunkSizes
          );
          const blob = new Blob(chunks, { type: finalMime });
          console.log(
            `[AudioRecorder] Blob assembled: ${blob.size} bytes, type=${blob.type}`
          );

          stream.getTracks().forEach((t) => t.stop());
          stopPromiseSettled = true;

          if (blob.size === 0) {
            reject(new Error("empty_blob"));
          } else {
            resolve({
              blob,
              durationMs: endTs - startTs,
              mimeType: finalMime,
              chunkCount: chunks.length,
              chunkSizes,
            });
          }
        };

        recorder.onerror = () => {
          stream.getTracks().forEach((t) => t.stop());
          stopPromiseSettled = true;
          reject(new Error("MediaRecorder error during stop."));
        };

        // Actually stop — this triggers final dataavailable then onstop
        try {
          recorder.stop();
        } catch {
          stream.getTracks().forEach((t) => t.stop());
          stopPromiseSettled = true;
          reject(new Error("Failed to call recorder.stop()."));
        }
      }),

    pause: () => {
      if (recorder.state === "recording") {
        recorder.pause();
        console.log("[AudioRecorder] PAUSED");
      }
    },

    resume: () => {
      if (recorder.state === "paused") {
        recorder.resume();
        console.log("[AudioRecorder] RESUMED");
      }
    },
  };

  return handle;
}

// ─── Validation helper ──────────────────────────────────────────────────────

export function validateAudioBlob(
  blob: Blob,
  _minDuration: number = 1
): { valid: boolean; reason?: string } {
  if (!blob) return { valid: false, reason: "No audio data" };
  if (blob.size === 0) return { valid: false, reason: "Audio file is empty" };
  if (blob.size < 1024)
    return { valid: false, reason: "Audio file is too small (likely corrupted)" };
  return { valid: true };
}
