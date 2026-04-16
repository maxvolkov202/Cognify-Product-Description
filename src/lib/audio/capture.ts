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

export async function startRecording(): Promise<RecordingController> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone access is not supported in this browser.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

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
