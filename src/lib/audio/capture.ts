export type RecordingResult = {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  url: string;
};

export type RecordingController = {
  stop: () => Promise<RecordingResult>;
  cancel: () => void;
  getLevel: () => number;
  getElapsedMs: () => number;
};

const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
] as const;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const type of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "audio/webm";
}

const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

let prewarmedStream: MediaStream | null = null;
let prewarmedAt = 0;
// If a pre-warmed stream hasn't been consumed within 60s, release it to
// free the mic. Browsers may revoke getUserMedia permission otherwise.
const PREWARM_TTL_MS = 60_000;

/**
 * Eagerly request microphone permission and cache the stream so the first
 * tap of the record button starts capturing instantly. Pattern adopted from
 * CTO's v1 hook (cognify-v1-cto/src/app/v2/hooks/useAudioRecorder.ts).
 *
 * Safe to call from a useEffect on mount. Silently no-ops in SSR and on
 * browsers without getUserMedia. Subsequent calls within TTL reuse the
 * existing stream.
 */
export async function prewarmMicrophone(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return;
  }
  if (prewarmedStream && Date.now() - prewarmedAt < PREWARM_TTL_MS) return;
  releasePrewarmedStream();
  try {
    prewarmedStream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
    prewarmedAt = Date.now();
    // Auto-release after TTL so the mic indicator goes away if the user
    // never actually records.
    setTimeout(() => {
      if (prewarmedStream && Date.now() - prewarmedAt >= PREWARM_TTL_MS) {
        releasePrewarmedStream();
      }
    }, PREWARM_TTL_MS + 100);
  } catch {
    // User denied permission or device unavailable — fall back to the
    // synchronous getUserMedia call when they tap record.
    prewarmedStream = null;
  }
}

function releasePrewarmedStream() {
  if (prewarmedStream) {
    prewarmedStream.getTracks().forEach((t) => t.stop());
    prewarmedStream = null;
    prewarmedAt = 0;
  }
}

export async function startRecording(): Promise<RecordingController> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone access is not supported in this browser.");
  }

  // Consume the pre-warmed stream if fresh. Otherwise request one now.
  let stream: MediaStream;
  if (prewarmedStream && Date.now() - prewarmedAt < PREWARM_TTL_MS) {
    stream = prewarmedStream;
    prewarmedStream = null;
    prewarmedAt = 0;
  } else {
    releasePrewarmedStream();
    stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
  }

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];
  const startedAt = performance.now();

  recorder.addEventListener("dataavailable", (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  });

  const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);

  const levels = new Uint8Array(analyser.frequencyBinCount);

  recorder.start(100);

  const cleanup = () => {
    stream.getTracks().forEach((track) => track.stop());
    audioContext.close().catch(() => undefined);
  };

  return {
    async stop() {
      return new Promise<RecordingResult>((resolve, reject) => {
        recorder.addEventListener(
          "stop",
          () => {
            try {
              const durationMs = Math.round(performance.now() - startedAt);
              const blob = new Blob(chunks, { type: mimeType });
              const url = URL.createObjectURL(blob);
              cleanup();
              resolve({ blob, mimeType, durationMs, url });
            } catch (error) {
              cleanup();
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          { once: true },
        );
        if (recorder.state !== "inactive") recorder.stop();
      });
    },
    cancel() {
      if (recorder.state !== "inactive") recorder.stop();
      cleanup();
    },
    getLevel() {
      analyser.getByteFrequencyData(levels);
      let sum = 0;
      for (let i = 0; i < levels.length; i++) sum += levels[i] ?? 0;
      return sum / (levels.length * 255);
    },
    getElapsedMs() {
      return performance.now() - startedAt;
    },
  };
}
