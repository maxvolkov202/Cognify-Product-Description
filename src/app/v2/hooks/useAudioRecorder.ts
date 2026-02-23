import { useState, useRef, useCallback, useEffect } from "react";

export type RecorderState = "idle" | "recording" | "paused" | "stopped" | "error";

export interface UseAudioRecorderReturn {
  state: RecorderState;
  recordedBlob: Blob | null;
  audioURL: string;
  error: string | null;
  isSupported: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  clearRecording: () => void;
}

/**
 * Dead simple audio recorder.
 * No permission pre-checks. No caching. No storage.
 * Requests mic ONLY when startRecording() is called.
 */
export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<RecorderState>("idle");
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [audioURL, setAudioURL] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const urlRef = useRef("");

  const isSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator?.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  // ────────────────────────────────────────────────────────────
  // START RECORDING
  // ────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!isSupported) {
      const msg = "Audio recording is not supported in this browser.";
      setError(msg);
      setState("error");
      throw new Error(msg);
    }

    // Don't allow starting if already recording
    if (recorderRef.current && recorderRef.current.state === "recording") {
      return;
    }

    setError(null);

    // Request microphone access
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (err: any) {
      let msg = "Microphone access required. Please allow access and try again.";
      if (err.name === "NotFoundError") {
        msg = "No microphone found. Please connect one and try again.";
      } else if (err.name === "NotReadableError") {
        msg = "Microphone is in use by another app.";
      } else if (err.name === "SecurityError") {
        msg = "Microphone blocked by browser security policy.";
      }
      setError(msg);
      setState("error");
      throw new Error(msg);
    }

    streamRef.current = stream;

    // Create new MediaRecorder
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch {
      // Stop all tracks if MediaRecorder fails
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      const msg = "MediaRecorder not available.";
      setError(msg);
      setState("error");
      throw new Error(msg);
    }

    recorderRef.current = recorder;
    chunksRef.current = [];

    // Collect audio chunks
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    // Start recording
    recorder.start(250);
    setState("recording");
  }, [isSupported]);

  // ────────────────────────────────────────────────────────────
  // STOP RECORDING
  // ────────────────────────────────────────────────────────────
  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;

      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        return;
      }

      // Set up onstop handler BEFORE calling stop()
      recorder.onstop = () => {
        const finalMime = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalMime });

        // CRITICAL: Stop all audio tracks to release microphone
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        recorderRef.current = null;

        if (blob.size > 0) {
          // Revoke old URL if exists
          if (urlRef.current) {
            URL.revokeObjectURL(urlRef.current);
          }

          // Create new URL
          const url = URL.createObjectURL(blob);
          urlRef.current = url;

          setRecordedBlob(blob);
          setAudioURL(url);
          setState("stopped");
          resolve(blob);
        } else {
          setError("No audio captured. Check your microphone.");
          setState("error");
          resolve(null);
        }
      };

      // Now call stop()
      try {
        recorder.stop();
      } catch {
        // If stop() fails, clean up manually
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        recorderRef.current = null;
        resolve(null);
      }
    });
  }, []);

  // ────────────────────────────────────────────────────────────
  // PAUSE / RESUME
  // ────────────────────────────────────────────────────────────
  const pauseRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause();
      setState("paused");
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (recorderRef.current?.state === "paused") {
      recorderRef.current.resume();
      setState("recording");
    }
  }, []);

  // ────────────────────────────────────────────────────────────
  // CLEAR RECORDING
  // ────────────────────────────────────────────────────────────
  const clearRecording = useCallback(() => {
    // Stop active recorder
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {}
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Revoke URL
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = "";
    }

    // Reset state
    recorderRef.current = null;
    chunksRef.current = [];
    setRecordedBlob(null);
    setAudioURL("");
    setError(null);
    setState("idle");
  }, []);

  // ────────────────────────────────────────────────────────────
  // CLEANUP ON UNMOUNT
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
      }
    };
  }, []);

  return {
    state,
    recordedBlob,
    audioURL,
    error,
    isSupported,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
  };
}
