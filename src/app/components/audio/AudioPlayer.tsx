interface AudioPlayerProps {
  audioUrl: string;
  audioMimeType?: string;
  repId?: string | null;
}

export function AudioPlayer({ audioUrl, audioMimeType, repId }: AudioPlayerProps) {
  return (
    <audio
      controls
      className="w-full max-w-md"
      data-rep-id={repId ?? undefined}
      preload="metadata"
    >
      <source src={audioUrl} type={audioMimeType ?? "audio/webm"} />
      Your browser does not support the audio element.
    </audio>
  );
}
