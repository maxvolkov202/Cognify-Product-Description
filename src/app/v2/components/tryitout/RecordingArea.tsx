import { useState, useEffect, useCallback, useRef } from "react";
import {
  Mic,
  Square,
  Pause,
  Play,
  BookOpen,
  Target,
  Loader2,
  AlertCircle,
  MicOff,
} from "lucide-react";
import { FRAMEWORKS } from "../../../types/rep";
import { FrameworkWorkspace } from "../../components/tryitout/FrameworkWorkspace";
import { useAudioRecorder } from "../../hooks/useAudioRecorder";
import { supabase } from "../../../../lib/supabase";

interface RecordingAreaProps {
  vertical: string;
  scenario: string;
  audience: string;
  framework: string;
  timeConstraint: number;
  repNumber: number;
  onComplete: (repId: string) => void;
  onProcessingStateChange: (
    state: "uploading" | "analyzing" | "completed"
  ) => void;
  onFailure: (
    reason:
      | "too-short"
      | "upload-failed"
      | "transcription-failed"
      | "processing-failed"
  ) => void;
  showRetryWarning?: boolean;
  nextRepFocus?: { title: string; nextStep: string } | null;
  preRepIntent?: string;
}

type RecordingState =
  | "ready"
  | "countdown"
  | "recording"
  | "paused"
  | "stopping";

const MIN_RECORDING_DURATION = 15;

export function RecordingArea({
  vertical,
  scenario,
  audience,
  framework,
  timeConstraint,
  onComplete,
  onProcessingStateChange,
  onFailure,
  showRetryWarning = false,
  nextRepFocus,
  preRepIntent,
}: RecordingAreaProps) {
  const [recordingState, setRecordingState] =
    useState<RecordingState>("ready");
  const [countdown, setCountdown] = useState(3);
  const [timeRemaining, setTimeRemaining] =
    useState(timeConstraint);
  const [totalPausedTime, setTotalPausedTime] = useState(0);
  const [pauseStartTime, setPauseStartTime] =
    useState<number | null>(null);
  const [permissionError, setPermissionError] =
    useState<string | null>(null);

  const timeRemainingRef = useRef(timeRemaining);
  timeRemainingRef.current = timeRemaining;

  const totalPausedTimeRef = useRef(totalPausedTime);
  totalPausedTimeRef.current = totalPausedTime;

  const isStoppingRef = useRef(false);

  const {
    state: recorderState,
    error: recorderError,
    isSupported,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
  } = useAudioRecorder();

  const selectedFrameworkObj = FRAMEWORKS.find(
    (f) => f.id === framework
  );

  // Sync recorder errors
  useEffect(() => {
    if (recorderError) setPermissionError(recorderError);
  }, [recorderError]);

  // Countdown
  useEffect(() => {
    if (recordingState === "countdown" && countdown > 0) {
      const timer = setTimeout(
        () => setCountdown(countdown - 1),
        1000
      );
      return () => clearTimeout(timer);
    }

    if (recordingState === "countdown" && countdown === 0) {
      startRecording()
        .then(() => {
          setRecordingState("recording");
          setTimeRemaining(timeConstraint);
        })
        .catch(() => setRecordingState("ready"));
    }
  }, [recordingState, countdown, startRecording, timeConstraint]);

  // Timer
  useEffect(() => {
    if (recordingState === "recording" && timeRemaining > 0) {
      const timer = setTimeout(
        () => setTimeRemaining(timeRemaining - 1),
        1000
      );
      return () => clearTimeout(timer);
    }

    if (recordingState === "recording" && timeRemaining === 0) {
      handleStopRecording();
    }
  }, [recordingState, timeRemaining]);

  const handleStartRecording = () => {
    if (!isSupported) {
      setPermissionError(
        "Audio recording not supported in this browser."
      );
      return;
    }
    clearRecording();
    setPermissionError(null);
    setCountdown(3);
    setRecordingState("countdown");
  };

  const handlePauseRecording = () => {
    pauseRecording();
    setPauseStartTime(Date.now());
    setRecordingState("paused");
  };

  const handleResumeRecording = () => {
    if (pauseStartTime) {
      const pauseDuration = Math.floor(
        (Date.now() - pauseStartTime) / 1000
      );
      setTotalPausedTime((prev) => prev + pauseDuration);
      setPauseStartTime(null);
    }
    resumeRecording();
    setRecordingState("recording");
  };

  const handleStopRecording = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    setRecordingState("stopping");

    const blob = await stopRecording();
    isStoppingRef.current = false;

    if (!blob || blob.size === 0) {
      setPermissionError("No audio captured.");
      setRecordingState("ready");
      return;
    }

    const actualDuration =
      timeConstraint - timeRemainingRef.current;

    if (actualDuration < MIN_RECORDING_DURATION) {
      clearRecording();
      onFailure("too-short");
      setRecordingState("ready");
      return;
    }

    try {
      onProcessingStateChange("uploading");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id) {
        onFailure("upload-failed");
        setRecordingState("ready");
        return;
      }

      const storagePath = `${session.user.id}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("rep-audio")
        .upload(storagePath, blob, {
          contentType: "audio/webm",
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        onFailure("upload-failed");
        setRecordingState("ready");
        return;
      }


      const { data: insertedRep, error: insertError } = await supabase
        .from("reps")
        .insert({
          user_id: session.user.id,
          audio_url: storagePath,
          status: "pending",
          vertical,
          scenario,
          audience,
          framework,
          time_limit: timeConstraint,
        })
        .select("id")
        .single();

      if (insertError || !insertedRep?.id) {
        console.error("Rep insert error:", insertError);
        onFailure("upload-failed");
        setRecordingState("ready");
        return;
      }

      onProcessingStateChange("analyzing");

      const { error: functionError } = await supabase.functions.invoke(
        "score-rep",
        { body: { repId: insertedRep.id } }
      );

      if (functionError) {
        console.error("score-rep error:", functionError);
        onFailure("processing-failed");
        setRecordingState("ready");
        return;
      }

      onProcessingStateChange("completed");
      onComplete(insertedRep.id);
      setRecordingState("ready");
    } catch (err) {
      console.error(err);
      onFailure("processing-failed");
      setRecordingState("ready");
    }
  }, [
    stopRecording,
    timeConstraint,
    clearRecording,
    onComplete,
    onFailure,
    onProcessingStateChange,
  ]);

  return (
    <section className="py-8 px-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-2xl font-bold mb-2">{scenario}</h2>
          <div className="text-sm text-gray-600 flex gap-4">
            <span><strong>Audience:</strong> {audience}</span>
            <span><strong>Framework:</strong> {selectedFrameworkObj?.name}</span>
            <span><strong>Time:</strong> {timeConstraint}s</span>
          </div>
        </div>

        {/* Framework Prep */}
        {recordingState === "ready" &&
          selectedFrameworkObj && (
            <div className="bg-white rounded-xl border p-6">
              <FrameworkWorkspace
                frameworkName={selectedFrameworkObj.name}
                frameworkSteps={
                  selectedFrameworkObj.structure
                }
                isRecording={false}
                isLocked={false}
              />
            </div>
          )}

        {/* Intent */}
        {recordingState === "ready" &&
          preRepIntent && (
            <div className="bg-gray-50 border rounded-xl p-5">
              <p className="text-xs font-bold uppercase mb-2">
                Your Intent
              </p>
              <p className="text-sm whitespace-pre-wrap">
                {preRepIntent}
              </p>
            </div>
          )}

        {nextRepFocus && (
          <div className="mb-6 bg-yellow-50 border border-yellow-300 rounded-lg p-4">
            <p className="text-xs font-semibold text-yellow-800 mb-1 uppercase tracking-wide">
              Focus for This Rep
            </p>
            <p className="text-sm font-medium text-gray-900">
              {nextRepFocus.nextStep}
            </p>
          </div>
        )}

        {/* Recording UI */}
        <div className="bg-white rounded-xl border p-6 text-center">

          {recordingState === "ready" && (
            <>
              <Mic className="w-12 h-12 mx-auto mb-4 text-[#9D7BF5]" />
              <button
                onClick={handleStartRecording}
                className="px-8 py-3 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-lg font-semibold"
              >
                Start Recording
              </button>
            </>
          )}

          {recordingState === "countdown" && (
            <div className="text-6xl font-bold animate-pulse">
              {countdown}
            </div>
          )}

          {recordingState === "recording" && (
            <>
              <div className="text-3xl font-bold mb-6">
                {Math.floor(timeRemaining / 60)}:
                {(timeRemaining % 60)
                  .toString()
                  .padStart(2, "0")}
              </div>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handlePauseRecording}
                  className="px-6 py-3 bg-yellow-500 text-white rounded-lg"
                >
                  <Pause /> Pause
                </button>
                <button
                  onClick={handleStopRecording}
                  className="px-6 py-3 bg-gray-900 text-white rounded-lg"
                >
                  <Square /> Stop
                </button>
              </div>
            </>
          )}

          {recordingState === "paused" && (
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleResumeRecording}
                className="px-6 py-3 bg-green-600 text-white rounded-lg"
              >
                <Play /> Resume
              </button>
              <button
                onClick={handleStopRecording}
                className="px-6 py-3 bg-gray-900 text-white rounded-lg"
              >
                <Square /> Stop
              </button>
            </div>
          )}

          {recordingState === "stopping" && (
            <>
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-[#9D7BF5]" />
              <p>Analyzing your rep...</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}