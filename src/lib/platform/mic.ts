"use client";

// Phase 12 — microphone permission + capture shim.
//
// Today: dispatches to navigator.mediaDevices.getUserMedia on web.
// Tomorrow: when the Capacitor shell ships, swap the body to a runtime
// check on @capacitor/core's Capacitor.isNativePlatform() and call
// @capacitor/microphone. Signature is finalized now so callers don't
// need to change.

export type MicPermissionStatus = "granted" | "denied" | "prompt" | "unsupported";

export type MicStreamResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; reason: "denied" | "unsupported" | "error"; detail?: string };

/** Query the current mic permission state without prompting the user. */
export async function checkMicrophonePermission(): Promise<MicPermissionStatus> {
  if (typeof navigator === "undefined") return "unsupported";
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return "unsupported";
  }
  // Permissions API isn't on every browser; fall back to "prompt".
  if ("permissions" in navigator) {
    try {
      const status = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });
      return status.state as MicPermissionStatus;
    } catch {
      return "prompt";
    }
  }
  return "prompt";
}

/** Open the mic stream. Triggers the OS permission prompt if needed. */
export async function requestMicrophoneStream(): Promise<MicStreamResult> {
  if (typeof navigator === "undefined") {
    return { ok: false, reason: "unsupported" };
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return { ok: false, reason: "unsupported" };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return { ok: true, stream };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return { ok: false, reason: "denied" };
    }
    return {
      ok: false,
      reason: "error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

// TODO: when @capacitor/microphone lands, fall through to it on native:
//
//   if (isNative()) {
//     await Microphone.requestPermissions();
//     return Microphone.startRecording(); // or whatever the API exposes
//   }
//
// The current web path stays as the fallback.
