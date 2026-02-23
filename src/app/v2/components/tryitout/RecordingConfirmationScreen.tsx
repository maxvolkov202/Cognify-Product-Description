import { useState, useEffect, useRef } from "react";
import {
  Check,
  Play,
  Volume2,
  AlertCircle,
  MicOff,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { ReRecordConfirmationModal } from "../../../components/tryitout/ReRecordConfirmationModal";

interface RecordingConfirmationScreenProps {
  audioBlob?: Blob;
  audioUrl?: string;
  transcript: string;
  duration: number;
  onSubmit: () => void;
  onReRecord: () => void;
}

export function RecordingConfirmationScreen({
  audioBlob,
  audioUrl,
  transcript,
  duration,
  onSubmit,
  onReRecord,
}: RecordingConfirmationScreenProps) {
  const [showReRecordModal, setShowReRecordModal] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string>("");
  const [micError, setMicError] = useState<string | null>(null);

  // Stable repId that doesn't change on re-render
  const repIdRef = useRef(`recording-${Date.now()}`);

  // Generate object URL from blob when no explicit audioUrl prop
  useEffect(() => {
    if (audioBlob && !audioUrl) {
      const url = URL.createObjectURL(audioBlob);
      setGeneratedAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    if (!audioBlob) setGeneratedAudioUrl("");
  }, [audioBlob, audioUrl]);

  const finalAudioUrl = audioUrl || generatedAudioUrl;
  const hasAudio =
    (audioBlob && audioBlob.size > 0) ||
    (finalAudioUrl && finalAudioUrl.length > 0);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleConfirmReRecord = () => {
    setShowReRecordModal(false);
    onReRecord();
  };

  return (
    <section className="py-8 px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center mx-auto mb-4 animate-scale-in">
              <Check className="w-10 h-10 text-green-600 stroke-[3]" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Recording Complete
            </h2>
            <p className="text-gray-600">
              Duration: <strong>{formatDuration(duration)}</strong>
            </p>
          </div>

          {/* Static Waveform Preview */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-[#5CB3FF]/5 via-[#9D7BF5]/5 to-[#E86DE1]/5 rounded-xl p-6 border border-[#9D7BF5]/20">
              <div className="flex items-center justify-center gap-1 h-16">
                {Array.from({ length: 40 }).map((_, i) => {
                  const progress = i / 40;
                  const height =
                    Math.sin(progress * Math.PI * 3 + duration) * 0.5 + 0.5;
                  return (
                    <div
                      key={i}
                      className="w-1 bg-gradient-to-t from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full"
                      style={{
                        height: `${Math.max(20, height * 100)}%`,
                        opacity: 0.7,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Transcript Preview */}
          <div className="mb-8 bg-gray-50 rounded-xl p-5 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Transcript Preview
              </p>
              <span className="text-xs text-gray-500">
                {transcript.split(" ").length} words
              </span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">
              {transcript}
            </p>
          </div>

          {/* ── Action Buttons ─────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            {/* Submit */}
            <button
              onClick={onSubmit}
              className="px-8 py-3 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all inline-flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              Submit Rep for Feedback
            </button>

            {/* Listen */}
            <button
              onClick={() => setShowPlayer(!showPlayer)}
              disabled={!hasAudio}
              className={`px-6 py-3 rounded-lg font-medium transition-all inline-flex items-center justify-center gap-2 ${
                !hasAudio
                  ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed"
                  : showPlayer
                  ? "bg-[#9D7BF5] text-white border border-[#9D7BF5] hover:bg-[#8B6BE0]"
                  : "bg-white border-2 border-[#9D7BF5] text-[#9D7BF5] hover:bg-[#9D7BF5]/5"
              }`}
            >
              <Volume2 className="w-4 h-4" />
              {showPlayer ? "Hide Player" : "Listen"}
            </button>

            {/* Re-record */}
            <button
              onClick={() => setShowReRecordModal(true)}
              className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 hover:border-gray-400 transition-all inline-flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Re-record
            </button>
          </div>

          {/* ── No-audio error state ──────────────────────────────────── */}
          {!hasAudio && (
            <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <MicOff className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1">
                    Audio not saved
                  </h4>
                  <p className="text-xs text-gray-700 mb-2">
                    This is a recording bug — the timer ran but no audio data
                    was captured. This usually means microphone access was
                    blocked or the MediaRecorder produced empty output.
                  </p>
                  <p className="text-xs text-gray-600">
                    Please click <strong>Re-record</strong> and make sure your
                    microphone is enabled.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Microphone error */}
          {micError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <MicOff className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1">
                    Playback Error
                  </h4>
                  <p className="text-xs text-gray-700">{micError}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Toggleable Audio Player Panel ──────────────────────────── */}
          {showPlayer && (
            <div className="mt-6">
              {hasAudio && finalAudioUrl ? (
                <audio
                  controls
                  className="w-full mt-4"
                  src={finalAudioUrl}
                  onError={() => setMicError("Playback failed")}
                >
                  <source src={finalAudioUrl} type={audioBlob?.type || "audio/webm"} />
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-1">
                        Audio not available
                      </h4>
                      <p className="text-xs text-gray-700">
                        No recording data found. Please re-record to listen to
                        your rep.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Diagnostics (dev-mode) ────────────────────────────────── */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors inline-flex items-center gap-1"
            >
              Diagnostics
              {showDiagnostics ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            {showDiagnostics && (
              <div className="mt-2 bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-500 space-y-1">
                <p>
                  audioBlob prop:{" "}
                  {audioBlob
                    ? `${audioBlob.size} bytes, type=${audioBlob.type}`
                    : "null"}
                </p>
                <p>
                  finalAudioUrl:{" "}
                  {finalAudioUrl
                    ? `${finalAudioUrl.substring(0, 40)}...`
                    : "empty"}
                </p>
                <p>hasAudio: {String(!!hasAudio)}</p>
                <p>duration: {duration}s</p>
              </div>
            )}
          </div>

          {/* Helpful Tip */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-600 text-center">
              <strong>Tip:</strong> Use the Listen button to catch pacing
              issues, filler words, and delivery patterns before submitting.
            </p>
          </div>
        </div>
      </div>

      {/* Re-record Confirmation Modal */}
      <ReRecordConfirmationModal
        open={showReRecordModal}
        onConfirm={handleConfirmReRecord}
        onCancel={() => setShowReRecordModal(false)}
      />
    </section>
  );
}
