import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
//import { Navigation } from "../components/Navigation";
import { ScenarioLibrary, scenarioCategories } from "./components/tryitout/ScenarioLibrary";
import { CustomScenarioBuilder } from "./components/tryitout/CustomScenarioBuilder";
import { ScenarioSelection } from "./components/tryitout/ScenarioSelection";
import { RecordingArea } from "./components/tryitout/RecordingArea";
import { RecordingConfirmationScreen } from "./components/tryitout/RecordingConfirmationScreen";
import { SubmittingScreen } from "./components/tryitout/SubmittingScreen";
import { AnalyzingScreen } from "./components/tryitout/AnalyzingScreen";
import { ResultsScreen, type RepRow } from "./components/tryitout/ResultsScreen";
import { RepHistory } from "./components/tryitout/RepHistory";
import { RepHistoryPage } from "./components/tryitout/RepHistoryPage";
import { ImprovementReminder } from "./components/tryitout/ImprovementReminder";
import { RepCounter } from "./components/tryitout/RepCounter";
import { SessionProgress } from "./components/tryitout/SessionProgress";
import { RepTypeIndicator } from "./components/tryitout/RepTypeIndicator";
import { RepFailedModal } from "./components/tryitout/RepFailedModal";
import { supabase } from "../../lib/supabase";


type ViewState =
  | "browse"
  | "custom"
  | "configure"
  | "recording"
  | "confirmation"
  | "submitting"
  | "analyzing"
  | "results"
  | "history"
  ;

export default function TryItOut() {
  const location = useLocation();
  const incomingState = location.state as Record<string, unknown> | null | undefined;
  const [viewState, setViewState] = useState<ViewState>("browse");
  const [selectedScenario, setSelectedScenario] = useState("");
  const [scenarioCategory, setScenarioCategory] = useState("");
  const [selectedAudience, setSelectedAudience] = useState("");
  const [selectedFramework, setSelectedFramework] = useState("");
  const [timeConstraint, setTimeConstraint] = useState(60);
  const [transcript, setTranscript] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | undefined>(undefined);
  const [totalPausedTime, setTotalPausedTime] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [repsCompleted, setRepsCompleted] = useState(0);
  const [repHistory, setRepHistory] = useState<RepRow[]>([]);
  const [currentClarityScore, setCurrentClarityScore] = useState(0);
  const [currentPrimaryFocus, setCurrentPrimaryFocus] = useState<{ title: string; nextStep: string } | null>(null);
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [failureReason, setFailureReason] = useState<"too-short" | "upload-failed" | "transcription-failed" | "processing-failed">("too-short");
  const [showRetryWarning, setShowRetryWarning] = useState(false);
  const [currentRepId, setCurrentRepId] = useState<string | null>(null);
  const [carriedFocus, setCarriedFocus] = useState<string | null>(null);

  // Pre-Rep Intent state
  const [preRepIntent, setPreRepIntent] = useState("");
  const [analysis, setAnalysis] = useState<any>(null);
  const [feedback, setFeedback] = useState<any>(null);

  const isContinuation = !!carriedFocus;

  useEffect(() => {
    if (!incomingState) return;

    if (incomingState.vertical) {
      setScenarioCategory(incomingState.vertical as string);
    }

    if (incomingState.audience) {
      setSelectedAudience(incomingState.audience as string);
    }

    if (incomingState.framework) {
      setSelectedFramework(incomingState.framework as string);
    }

    if (incomingState.time_limit != null) {
      setTimeConstraint(Number(incomingState.time_limit));
    }

    if (incomingState.carryFocus) {
      setCarriedFocus(incomingState.carryFocus as string);
    }

    setViewState("configure");
  }, []);

  useEffect(() => {
    if (!incomingState?.scenario) return;
    if (!scenarioCategory) return;

    const category = scenarioCategories.find((cat) => cat.name === scenarioCategory);
    const scenariosForCategory = (category?.scenarios ?? []).map((s) => ({ id: s, label: s }));
    const match = scenariosForCategory.find(
      (s) =>
        s.id === (incomingState.scenario as string) ||
        s.label === (incomingState.scenario as string)
    );

    if (match) {
      setSelectedScenario(match.id);
    }
  }, [scenarioCategory]);

  useEffect(() => {
    const loadRepHistory = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
  
      if (!session?.user?.id) return;
  
      const { data, error } = await supabase
        .from("reps")
        .select(`
          *,
          delivery_scores (*)
        `)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
  
      if (!error && data) setRepHistory(data as RepRow[]);
    };
    loadRepHistory();
  }, []);

  const handleSelectScenario = (scenario: string, category: string) => {
    setSelectedScenario(scenario);
    setScenarioCategory(category);
    setViewState("configure");
  };

  const handleCreateCustom = () => {
    setViewState("custom");
  };

  const handleCustomConfirm = (scenario: string, context: string) => {
    setSelectedScenario(scenario);
    setScenarioCategory("Custom");
    setViewState("configure");
  };

  const handleBackToBrowse = () => {
    setViewState("browse");
    setSelectedScenario("");
    setScenarioCategory("");
  };

  const handleStartRecording = () => {
    // Prevent starting if currently in other states
    if (viewState === "submitting" || viewState === "analyzing") {
      return;
    }
    setShowRetryWarning(false); // Clear retry warning when starting fresh
    setViewState("recording");
  };

  const handleProcessingStateChange = (state: "uploading" | "analyzing" | "completed") => {
    // Transition to submitting view
    if (state === "uploading") {
      setViewState("submitting");
    }
    
    // Transition to analyzing view
    if (state === "analyzing") {
      setViewState("analyzing");
    }
    
    // When completed, move to results
    if (state === "completed") {
      setViewState("results");
    }
  };

  const handleRecordingComplete = (repId: string) => {
    setCurrentRepId(repId);
    setViewState("results");
  };

  const handleSubmitFromConfirmation = () => {
    // Trigger processing flow
    setViewState("submitting");
    
    // Simulate processing delays
    setTimeout(() => {
      setViewState("analyzing");
    }, 1500);
    
    setTimeout(() => {
      setViewState("results");
    }, 3000);
  };

  const handleReRecordFromConfirmation = () => {
    // Clear recording data and return to recording state
    setTranscript("");
    setAudioBlob(undefined);
    setTotalPausedTime(0);
    setRecordingDuration(0);
    setViewState("recording");
  };

  const handleFeedbackGenerated = (
    score: number,
    focus: { title: string; nextStep: string },
    _detailedScores?: any,
    _analysisMetrics?: any
  ) => {
    setCurrentClarityScore(score);
    setCurrentPrimaryFocus(focus);
    setRepsCompleted(repsCompleted + 1);
  };

  const handleRunItBack = () => {
    setViewState("browse");
    setTranscript("");
    setAudioBlob(undefined);
    setTotalPausedTime(0);
    setRecordingDuration(0);
    setCurrentRepId(null);
    setSelectedScenario("");
    setScenarioCategory("");
    setShowRetryWarning(false);
    setCurrentPrimaryFocus(null);
    setPreRepIntent("");
  };

  const handleRecordingFailure = (reason: "too-short" | "upload-failed" | "transcription-failed" | "processing-failed") => {
    setFailureReason(reason);
    setShowFailedModal(true);
  };

  const handleTryAgain = () => {
    setShowFailedModal(false);
    setShowRetryWarning(true);
    setViewState("recording"); // Return directly to recording with preserved config
  };

  const handleCancelRetry = () => {
    setShowFailedModal(false);
    setShowRetryWarning(false);
    setViewState("configure"); // Return to configure screen
  };

  const handleDoAnotherRep = async () => {
    if (currentRepId) {
      try {
        const { data } = await supabase
          .from("reps")
          .select("next_focus")
          .eq("id", currentRepId)
          .single();
        setCarriedFocus((data as { next_focus?: string | null } | null)?.next_focus ?? null);
      } catch {
        setCarriedFocus(null);
      }
    } else {
      setCarriedFocus(null);
    }
    setTranscript("");
    setAudioBlob(undefined);
    setTotalPausedTime(0);
    setRecordingDuration(0);
    setCurrentRepId(null);
    setShowRetryWarning(false);
    setViewState("recording");
  };

  const handleChangePrompt = () => {
    setViewState("browse");
    setTranscript("");
    setAudioBlob(undefined);
    setTotalPausedTime(0);
    setRecordingDuration(0);
    setCurrentRepId(null);
    setSelectedScenario("");
    setScenarioCategory("");
    setPreRepIntent("");
  };

  const handleChangeFramework = () => {
    setViewState("configure");
    setTranscript("");
    setAudioBlob(undefined);
    setTotalPausedTime(0);
    setRecordingDuration(0);
    setCurrentRepId(null);
  };

  const handleChangeAudience = () => {
    setViewState("configure");
    setTranscript("");
    setAudioBlob(undefined);
    setTotalPausedTime(0);
    setRecordingDuration(0);
    setCurrentRepId(null);
  };

  const handleReturnToSetup = () => {
    setViewState("configure");
  };

  return (
    <div className="min-h-screen bg-white">
     
      
      {viewState === "browse" && (
  <section className="py-12 px-6">
    <div className="max-w-5xl mx-auto">
      <ScenarioLibrary
        onSelectScenario={handleSelectScenario}
        onCreateCustom={handleCreateCustom}
      />
    </div>
  </section>
)}

      {viewState === "custom" && (
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <CustomScenarioBuilder
              onBack={handleBackToBrowse}
              onConfirm={handleCustomConfirm}
            />
          </div>
        </section>
      )}

{viewState === "configure" && (
  <>
    <section className="py-8 px-6">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Rep Counter - Show for reps 2+ */}
        {repsCompleted > 0 && (
          <div className="flex justify-center">
            <RepCounter repNumber={repsCompleted + 1} variant="compact" />
          </div>
        )}

        {/* Previous Rep Improvement Reminder */}
        {repsCompleted > 0 && currentPrimaryFocus && (
          <ImprovementReminder previousFocus={currentPrimaryFocus} />
        )}

        {/* Rep Type Indicator */}
        <RepTypeIndicator
          repType={isContinuation ? "continuation" : "cold-start"}
        />

        {/* Selected Scenario Card */}
        <div className="bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-xl p-4 border border-[#9D7BF5]/30">
          <p className="text-xs text-gray-600 mb-0.5">
            Selected scenario:
          </p>
          <p className="text-lg font-bold leading-tight">
            {selectedScenario}
          </p>
          <div className="mt-2">
            <button
              onClick={handleBackToBrowse}
              className="text-xs text-[#9D7BF5] hover:text-[#8B6BE0] transition-colors font-medium"
            >
              ← Change scenario
            </button>
          </div>
        </div>

        {/* Scenario Selection */}
        <ScenarioSelection
          selectedScenario={selectedScenario}
          setSelectedScenario={setSelectedScenario}
          selectedAudience={selectedAudience}
          setSelectedAudience={setSelectedAudience}
          selectedFramework={selectedFramework}
          setSelectedFramework={setSelectedFramework}
          timeConstraint={timeConstraint}
          setTimeConstraint={setTimeConstraint}
        />

        {/* Begin Recording Button */}
        <div className="pt-3">
          <button
            onClick={handleStartRecording}
            disabled={!selectedAudience || !selectedFramework}
            className="w-full py-4 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-xl text-base font-bold hover:shadow-xl hover:shadow-purple-500/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:translate-y-0"
          >
            Begin Rep Setup
          </button>

          {!selectedAudience || !selectedFramework ? (
            <p className="text-xs text-gray-500 text-center mt-2">
              Complete all steps to begin
            </p>
          ) : null}
        </div>
      </div>
    </section>
  </>
)}


      {viewState === "recording" && (
        <RecordingArea
          vertical={scenarioCategory}
          scenario={selectedScenario}
          audience={selectedAudience}
          framework={selectedFramework}
          timeConstraint={timeConstraint}
          repNumber={repsCompleted + 1}
          onComplete={handleRecordingComplete}
          onProcessingStateChange={handleProcessingStateChange}
          onFailure={handleRecordingFailure}
          showRetryWarning={showRetryWarning}
          nextRepFocus={
            carriedFocus
              ? { title: "Primary Focus", nextStep: carriedFocus }
              : null
          }
          preRepIntent={preRepIntent}
        />
      )}

      {viewState === "confirmation" && (
        <RecordingConfirmationScreen
          audioBlob={audioBlob}
          transcript={transcript}
          duration={recordingDuration}
          onSubmit={handleSubmitFromConfirmation}
          onReRecord={handleReRecordFromConfirmation}
        />
      )}

      {viewState === "submitting" && (
        <SubmittingScreen
          repNumber={repsCompleted + 1}
          scenario={selectedScenario}
        />
      )}

      {viewState === "analyzing" && (
        <AnalyzingScreen
          repNumber={repsCompleted + 1}
          scenario={selectedScenario}
          onReturnToSetup={handleReturnToSetup}
        />
      )}

{viewState === "results" && (
  <ResultsScreen
    scenario={selectedScenario}
    repId={currentRepId}
    nextRepFocus={currentPrimaryFocus}
    onDoAnotherRep={handleDoAnotherRep}
    onChangePrompt={handleChangePrompt}
    onChangeFramework={handleChangeFramework}
    onChangeAudience={handleChangeAudience}
  />
)}

      {viewState === "history" && (
        <RepHistoryPage
          reps={repHistory}
          onBack={() => setViewState("browse")}
        />
      )}

      {/* Rep Failed Modal */}
      <RepFailedModal
        isOpen={showFailedModal}
        reason={failureReason}
        minDuration={15}
        onTryAgain={handleTryAgain}
        onCancel={handleCancelRetry}
      />
    </div>
  );
}
