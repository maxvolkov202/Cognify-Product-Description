import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Play, Pause, CheckCircle2, Target, Loader } from "lucide-react";
import { FRAMEWORKS } from "../types/rep";

type ExecutionState = "idle" | "recording" | "processing" | "resultsReady";

interface RepPerformProps {
  config: {
    vertical: string;
    scenario: string;
    audience: string;
    framework: string;
    timeLimit: number;
  };
  onSubmit: (data: {
    preRepIntent: string;
    frameworkInputs: Record<string, string>;
    audioBlob: Blob;
    transcript: string;
    duration: number;
  }) => void;
  onBack: () => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

export function RepPerform({ config, onSubmit, onBack, onRecordingStateChange }: RepPerformProps) {
  const [state, setState] = useState<ExecutionState>("idle");
  const [preRepIntent, setPreRepIntent] = useState("");
  const [frameworkInputs, setFrameworkInputs] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(config.timeLimit);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [micError, setMicError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const framework = FRAMEWORKS.find(f => f.id === config.framework);
  const frameworkSteps = framework?.structure || [];

  useEffect(() => {
    onRecordingStateChange?.(state === "recording");
  }, [state, onRecordingStateChange]);

  // Initialize framework inputs
  useEffect(() => {
    const initial: Record<string, string> = {};
    frameworkSteps.forEach(step => {
      initial[step] = "";
    });
    setFrameworkInputs(initial);
  }, []);

  // Timer countdown
  useEffect(() => {
    if (state === "recording") {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleStopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (state === "idle") {
        setTimeRemaining(config.timeLimit);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state, config.timeLimit]);

  // Audio playback time update
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioUrl]);

  const handleStartRecording = async () => {
    setMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        
        // Clean up old URL if exists
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Move to processing
        setState("processing");
        
        // Simulate transcript generation
        setTimeout(() => {
          generateMockTranscript();
          setState("resultsReady");
        }, 1500);
      };

      mediaRecorder.start();
      setState("recording");
    } catch (err) {
      console.error("Microphone error:", err);
      setMicError("Microphone access denied. Please allow microphone access and try again.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const generateMockTranscript = () => {
    // Generate a mock transcript based on framework inputs
    const parts = frameworkSteps.map(step => {
      const input = frameworkInputs[step] || "";
      return input ? `${step}: ${input}` : "";
    }).filter(Boolean);
    
    setTranscript(parts.join(". ") + ".");
  };

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

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleReRecord = () => {
    // Clean up
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    setAudioBlob(null);
    setAudioUrl(null);
    setTranscript("");
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setState("idle");
  };

  const handleSubmitRep = () => {
    if (!audioBlob) return;

    onSubmit({
      preRepIntent,
      frameworkInputs,
      audioBlob,
      transcript,
      duration: config.timeLimit - timeRemaining
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isLocked = state === "recording" || state === "processing" || state === "resultsReady";
  const canStartRecording = preRepIntent.trim().length > 0 && Object.values(frameworkInputs).some(v => v.trim().length > 0);

  return (
    <section className="py-8 px-6 bg-gray-50 min-h-screen">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">{config.scenario}</h1>
          <p className="text-sm text-gray-600">
            {config.audience} · {framework?.name} · {config.timeLimit}s
          </p>
        </div>

        {/* Timer (when recording) */}
        {state === "recording" && (
          <div className="bg-red-50 border-2 border-red-500 rounded-xl p-4 flex items-center justify-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-2xl font-bold text-red-600">{formatTime(timeRemaining)}</span>
            <span className="text-sm text-red-600">Recording...</span>
          </div>
        )}

        {/* Pre-Rep Intent */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-[#C855E8]" />
            <h3 className="text-lg font-bold text-gray-900">Pre-Rep Intent</h3>
            {isLocked && <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />}
          </div>
          <textarea
            value={preRepIntent}
            onChange={(e) => setPreRepIntent(e.target.value)}
            disabled={isLocked}
            placeholder="• Start with the core message&#10;• Use one strong example&#10;• Avoid filler&#10;• End with a clear takeaway"
            className="w-full px-4 py-3 border-2 border-[#C855E8] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-[#C855E8] focus:border-transparent text-sm leading-relaxed disabled:bg-gray-50 disabled:text-gray-700"
            rows={4}
          />
        </div>

        {/* Framework Inputs */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-gray-900">
            {framework?.name} {isLocked && <span className="text-sm text-green-600 ml-2">✓ Locked</span>}
          </h3>
          {frameworkSteps.map((step, i) => (
            <div key={step}>
              <label className="block text-sm font-bold text-gray-900 mb-2">
                {i + 1}. {step}
                {framework?.structureDetails && framework.structureDetails[i] && (
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    {framework.structureDetails[i].split(" — ")[1]}
                  </span>
                )}
              </label>
              <textarea
                value={frameworkInputs[step] || ""}
                onChange={(e) => setFrameworkInputs(prev => ({ ...prev, [step]: e.target.value }))}
                disabled={isLocked}
                placeholder={`Key points for ${step}...`}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#9D7BF5] focus:border-transparent text-sm disabled:bg-gray-50 disabled:text-gray-700"
                rows={2}
              />
            </div>
          ))}
        </div>

        {/* Recording Controls */}
        {state === "idle" && (
          <div className="space-y-3">
            {micError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                {micError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={onBack}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleStartRecording}
                disabled={!canStartRecording}
                className="flex-1 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl text-lg font-bold hover:shadow-xl hover:shadow-red-500/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:translate-y-0 flex items-center justify-center gap-2"
              >
                <Mic className="w-5 h-5" />
                Start Recording
              </button>
            </div>
            {!canStartRecording && (
              <p className="text-xs text-gray-500 text-center">
                Fill in your intent and at least one framework point to begin
              </p>
            )}
          </div>
        )}

        {state === "recording" && (
          <button
            onClick={handleStopRecording}
            className="w-full py-4 bg-gray-900 text-white rounded-xl text-lg font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
          >
            <MicOff className="w-5 h-5" />
            Stop Recording
          </button>
        )}

        {state === "processing" && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Loader className="w-8 h-8 text-[#9D7BF5] animate-spin mx-auto mb-3" />
            <p className="text-gray-600">Processing your recording...</p>
          </div>
        )}

        {/* Results */}
        {state === "resultsReady" && audioUrl && (
          <div className="space-y-6">
            {/* Audio Playback */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Playback</h3>
              <audio ref={audioRef} src={audioUrl} className="hidden" />
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePlayPause}
                    className="w-12 h-12 rounded-full bg-[#9D7BF5] hover:bg-[#8B6BE0] text-white flex items-center justify-center transition-colors"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                  <div className="flex-1">
                    <input
                      type="range"
                      min="0"
                      max={duration || 0}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#9D7BF5]"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Transcript */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Transcript</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                {transcript || "Generating transcript..."}
              </p>
            </div>

            {/* Feedback Preview */}
            <div className="bg-gradient-to-r from-[#5CB3FF]/5 via-[#9D7BF5]/5 to-[#E86DE1]/5 border border-[#9D7BF5]/20 rounded-xl p-5">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Feedback</h3>
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#9D7BF5]">85</div>
                  <div className="text-xs text-gray-600">Clarity</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#9D7BF5]">90</div>
                  <div className="text-xs text-gray-600">Structure</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#9D7BF5]">78</div>
                  <div className="text-xs text-gray-600">Brevity</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#9D7BF5]">82</div>
                  <div className="text-xs text-gray-600">Confidence</div>
                </div>
              </div>
              <p className="text-sm text-gray-700">
                <strong>Primary Focus:</strong> Work on eliminating filler words to improve brevity and confidence.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleReRecord}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Re-record
              </button>
              <button
                onClick={handleSubmitRep}
                className="flex-1 py-4 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-xl text-lg font-bold hover:shadow-xl hover:shadow-purple-500/30 transition-all transform hover:-translate-y-0.5"
              >
                Submit Rep
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
