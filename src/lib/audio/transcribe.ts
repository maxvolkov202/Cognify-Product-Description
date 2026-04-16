import { createClient } from "@deepgram/sdk";
import { hasDeepgram } from "@/lib/db/safe";

export type WordTiming = {
  word: string;
  startMs: number;
  endMs: number;
  confidence: number;
};

export type TranscriptionResult = {
  transcript: string;
  words: WordTiming[];
  provider: "deepgram" | "placeholder";
};

export async function transcribeAudio(
  audio: Buffer,
  mimeType: string,
): Promise<TranscriptionResult> {
  if (!hasDeepgram()) {
    return {
      transcript:
        "[Transcription unavailable — set DEEPGRAM_API_KEY in .env.local to enable real speech-to-text. Scoring will proceed with the prompt and duration as context.]",
      words: [],
      provider: "placeholder",
    };
  }

  const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

  const response = await deepgram.listen.prerecorded.transcribeFile(audio, {
    model: "nova-3",
    smart_format: true,
    punctuate: true,
    utterances: false,
    diarize: false,
    mimetype: mimeType,
  });

  if (response.error) {
    throw new Error(`Deepgram error: ${response.error.message}`);
  }

  const channel = response.result?.results?.channels?.[0];
  const alternative = channel?.alternatives?.[0];
  if (!alternative) {
    throw new Error("Deepgram returned no transcription alternative.");
  }

  const words: WordTiming[] = (alternative.words ?? []).map((w) => ({
    word: w.punctuated_word ?? w.word,
    startMs: Math.round((w.start ?? 0) * 1000),
    endMs: Math.round((w.end ?? 0) * 1000),
    confidence: w.confidence ?? 0,
  }));

  return {
    transcript: alternative.transcript ?? "",
    words,
    provider: "deepgram",
  };
}
