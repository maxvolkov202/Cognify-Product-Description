import { useState, useEffect, useRef } from "react";
import { Play, Pause, SkipBack, SkipForward, Check } from "lucide-react";

interface RepReviewPanelProps {
  transcript: string;
  duration: number;
  audioBlob?: Blob;
  onSubmit: () => void;
  onReRecord: () => void;
}

export function RepReviewPanel({
  transcript,
  duration,
  audioBlob,
  onSubmit,
  onReRecord
}: RepReviewPanelProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Create audio element from blob
  useEffect(() => {
    if (audioBlob) {
      const audio = new Audio(URL.createObjectURL(audioBlob));
      audioRef.current = audio;

      // Update current time as audio plays
      const handleTimeUpdate = () => {
        setCurrentTime(audio.currentTime);
      };

      // Handle audio end
      const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      audio.addEventListener("timeupdate", handleTimeUpdate);
      audio.addEventListener("ended", handleEnded);

      return () => {
        audio.removeEventListener("timeupdate", handleTimeUpdate);
        audio.removeEventListener("ended", handleEnded);
        audio.pause();
        URL.revokeObjectURL(audio.src);
      };
    }
  }, [audioBlob]);

  // Split transcript into sentences for highlighting
  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 0);

  // Calculate which sentence should be highlighted based on current time
  const getCurrentSentenceIndex = () => {
    if (sentences.length === 0) return -1;
    const progress = currentTime / duration;
    const index = Math.floor(progress * sentences.length);
    return Math.min(index, sentences.length - 1);
  };

  const currentSentenceIndex = getCurrentSentenceIndex();

  // Auto-scroll transcript to current sentence
  useEffect(() => {
    if (transcriptRef.current && currentSentenceIndex >= 0) {
      const sentenceElements = transcriptRef.current.querySelectorAll('[data-sentence]');
      const currentElement = sentenceElements[currentSentenceIndex] as HTMLElement;
      
      if (currentElement) {
        currentElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [currentSentenceIndex]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSkipBackward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
  };

  const handleSkipForward = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 5);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !audioRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleTimelineDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !timelineRef.current || !audioRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Mock stats (can be calculated from real transcript analysis later)
  const fillerWords = Math.floor(Math.random() * 12) + 2;
  const avgPause = (Math.random() * 1.5 + 0.8).toFixed(1);
  const clarityScore = Math.floor(Math.random() * 20) + 75;

  return (
    <div className="space-y-5">
      {/* Success Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <Check className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">Rep Recorded</h3>
          <p className="text-sm text-gray-600">Review your performance before submitting</p>
        </div>
      </div>

      {/* Audio Player */}
      <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 space-y-4">
        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleSkipBackward}
            className="w-10 h-10 rounded-full bg-white border border-gray-300 hover:bg-gray-50 transition-colors flex items-center justify-center group"
            aria-label="Skip backward 5 seconds"
          >
            <SkipBack className="w-5 h-5 text-gray-700 group-hover:text-gray-900" />
          </button>

          <button
            onClick={handlePlayPause}
            className="w-14 h-14 rounded-full bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] hover:shadow-lg transition-all flex items-center justify-center"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 text-white fill-current" />
            ) : (
              <Play className="w-6 h-6 text-white fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={handleSkipForward}
            className="w-10 h-10 rounded-full bg-white border border-gray-300 hover:bg-gray-50 transition-colors flex items-center justify-center group"
            aria-label="Skip forward 5 seconds"
          >
            <SkipForward className="w-5 h-5 text-gray-700 group-hover:text-gray-900" />
          </button>
        </div>

        {/* Timeline */}
        <div className="space-y-2">
          <div
            ref={timelineRef}
            className="relative h-2 bg-gray-200 rounded-full cursor-pointer group"
            onClick={handleTimelineClick}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onMouseMove={handleTimelineDrag}
            onMouseLeave={() => setIsDragging(false)}
          >
            {/* Progress Bar */}
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
            
            {/* Scrubber Handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-[#9D7BF5] rounded-full shadow-lg transition-all group-hover:scale-125"
              style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
            />
          </div>

          {/* Time Display */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span className="font-mono">{formatTime(currentTime)}</span>
            <span className="font-mono">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-center gap-6 pt-2 border-t border-gray-200 text-sm">
          <div className="text-center">
            <p className="text-gray-500 text-xs mb-0.5">Filler words</p>
            <p className="font-bold text-gray-900">{fillerWords}</p>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="text-center">
            <p className="text-gray-500 text-xs mb-0.5">Avg pause</p>
            <p className="font-bold text-gray-900">{avgPause}s</p>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="text-center">
            <p className="text-gray-500 text-xs mb-0.5">Clarity score</p>
            <p className="font-bold text-gray-900">{clarityScore}</p>
          </div>
        </div>
      </div>

      {/* Transcript Panel */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">
            Transcript
          </p>
          <p className="text-xs text-gray-500">
            {sentences.length} {sentences.length === 1 ? 'sentence' : 'sentences'}
          </p>
        </div>

        <div
          ref={transcriptRef}
          className="max-h-64 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
        >
          {sentences.map((sentence, index) => (
            <p
              key={index}
              data-sentence={index}
              className={`text-sm leading-relaxed transition-all ${
                index === currentSentenceIndex
                  ? 'text-gray-900 bg-[#9D7BF5]/10 px-3 py-2 rounded-lg font-medium'
                  : index < currentSentenceIndex
                  ? 'text-gray-500 opacity-70'
                  : 'text-gray-700'
              }`}
            >
              {sentence}
            </p>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-center pt-2">
        <button
          onClick={onSubmit}
          className="px-8 py-3 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-lg font-semibold hover:shadow-lg transition-all"
        >
          Submit Rep
        </button>
        <button
          onClick={onReRecord}
          className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
        >
          Re-record
        </button>
      </div>
    </div>
  );
}
