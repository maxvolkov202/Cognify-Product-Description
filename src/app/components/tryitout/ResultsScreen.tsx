import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, SkipBack, SkipForward, Download, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Edit3, Users, Clock, Volume2, FileText } from "lucide-react";
import { FRAMEWORKS } from "../../types/rep";
import { analyzeTranscript, analyzeFrameworkCoverage } from "../../../../app/utils/transcriptAnalyzer";
import { evaluateExecutiveCommunication } from "../../../../app/utils/executiveEvaluator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../app/components/ui/tabs";

interface ResultsScreenProps {
  repNumber: number;
  scenario: string;
  transcript: string;
  framework: string;
  audience: string;
  timeConstraint: number;
  audioBlob?: Blob;
  onDoAnotherRep: () => void;
  onChangePrompt: () => void;
  onChangeFramework: () => void;
  onChangeAudience: () => void;
  onFeedbackGenerated?: (score: number, focus: { title: string; nextStep: string }, detailedScores: any, analysisMetrics: any) => void;
  preRepIntent?: string;
}

export function ResultsScreen({
  repNumber,
  scenario,
  transcript,
  framework,
  audience,
  timeConstraint,
  audioBlob,
  onDoAnotherRep,
  onChangePrompt,
  onChangeFramework,
  onChangeAudience,
  onFeedbackGenerated,
  preRepIntent
}: ResultsScreenProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Generate audio URL from blob
  useEffect(() => {
    if (audioBlob && audioBlob.size > 0) {
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      const audio = new Audio(url);
      
      audio.addEventListener('error', (e) => {
        console.warn('Audio playback error:', e);
        setAudioUrl(null);
      });
      
      audio.addEventListener('loadedmetadata', () => {
        if (isFinite(audio.duration)) {
          setDuration(audio.duration);
        }
      });

      audio.addEventListener('durationchange', () => {
        if (isFinite(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
        }
      });
      
      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime);
      });
      
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
      });
      
      setAudioElement(audio);

      return () => {
        URL.revokeObjectURL(url);
        audio.pause();
        audio.src = '';
      };
    }
  }, [audioBlob]);

  const handlePlayPause = () => {
    if (!audioElement) return;
    
    if (isPlaying) {
      audioElement.pause();
    } else {
      audioElement.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    if (!audioElement) return;
    audioElement.currentTime = 0;
    audioElement.play();
    setIsPlaying(true);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioElement) return;
    const time = parseFloat(e.target.value);
    audioElement.currentTime = time;
    setCurrentTime(time);
  };

  const handleSkip = (seconds: number) => {
    if (!audioElement) return;
    audioElement.currentTime = Math.max(0, Math.min(duration, audioElement.currentTime + seconds));
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `rep-${repNumber}-${Date.now()}.webm`;
    a.click();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Analyze transcript with fallback
  let analysis, feedback, frameworkCoverage, selectedFramework;
  let overallScore = 0;
  let detailedScores = {
    clarity: 0,
    structure: 0,
    specificity: 0,
    pacing: 0,
    presence: 0
  };
  let analysisMetrics = {
    fillerWordCount: 0,
    wordCount: 0,
    hasStrongOpening: false,
    hasActionableClosing: false,
    frameworkCoveragePercentage: 0
  };
  let hasValidAnalysis = false;

  try {
    if (transcript && transcript.length > 0) {
      analysis = analyzeTranscript(transcript);
      feedback = evaluateExecutiveCommunication(analysis, transcript, framework);
      frameworkCoverage = analyzeFrameworkCoverage(transcript, framework);
      selectedFramework = FRAMEWORKS.find(f => f.id === framework);

      overallScore = feedback?.overallScore || 0;

      detailedScores = {
        clarity: feedback?.clarity?.score || 0,
        structure: feedback?.structure?.score || 0,
        specificity: feedback?.specificity?.score || 0,
        pacing: feedback?.pacing?.score || 0,
        presence: feedback?.presence?.score || 0
      };

      analysisMetrics = {
        fillerWordCount: analysis?.fillerWordCount || 0,
        wordCount: analysis?.wordCount || 0,
        hasStrongOpening: analysis?.hasStrongOpening || false,
        hasActionableClosing: analysis?.hasActionableClosing || false,
        frameworkCoveragePercentage: frameworkCoverage?.coveragePercentage || 0
      };

      hasValidAnalysis = true;
    }
  } catch (error) {
    console.error("Error analyzing transcript:", error);
    hasValidAnalysis = false;
  }

  // Notify parent
  useEffect(() => {
    if (onFeedbackGenerated && hasValidAnalysis && feedback?.primaryFocus) {
      onFeedbackGenerated(overallScore, {
        title: feedback.primaryFocus.dimension,
        nextStep: feedback.primaryFocus.instruction
      }, detailedScores, analysisMetrics);
    }
  }, []);

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Elite";
    if (score >= 75) return "Strong";
    if (score >= 60) return "Developing";
    return "Needs Work";
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 75) return "text-blue-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 75) return "bg-blue-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const dimensionIcons = {
    clarity: "💎",
    structure: "🏗️",
    specificity: "🎯",
    pacing: "⚡",
    presence: "👔"
  };

  // Generate content feedback (clarity, structure, specificity)
  const getContentFeedback = () => {
    const didWell: string[] = [];
    const hurtScore: string[] = [];
    
    // Content = clarity + structure + specificity
    if (feedback?.clarity?.strength) didWell.push(feedback.clarity.strength);
    if (feedback?.structure?.strength) didWell.push(feedback.structure.strength);
    if (feedback?.specificity?.strength) didWell.push(feedback.specificity.strength);
    
    if (feedback?.clarity?.weakness) hurtScore.push(feedback.clarity.weakness);
    if (feedback?.structure?.weakness) hurtScore.push(feedback.structure.weakness);
    if (feedback?.specificity?.weakness) hurtScore.push(feedback.specificity.weakness);
    
    const adjustments = [];
    if (detailedScores.clarity < 70) adjustments.push(feedback?.clarity?.reasoning || "Improve message clarity");
    if (detailedScores.structure < 70) adjustments.push(feedback?.structure?.reasoning || "Follow framework structure");
    if (detailedScores.specificity < 70) adjustments.push(feedback?.specificity?.reasoning || "Add concrete examples");
    
    return { didWell, hurtScore, adjustments };
  };

  // Generate delivery feedback (pacing, presence)
  const getDeliveryFeedback = () => {
    const didWell: string[] = [];
    const hurtScore: string[] = [];
    
    if (feedback?.pacing?.strength) didWell.push(feedback.pacing.strength);
    if (feedback?.presence?.strength) didWell.push(feedback.presence.strength);
    
    if (feedback?.pacing?.weakness) hurtScore.push(feedback.pacing.weakness);
    if (feedback?.presence?.weakness) hurtScore.push(feedback.presence.weakness);
    
    const adjustments = [];
    if (detailedScores.pacing < 70) adjustments.push(feedback?.pacing?.reasoning || "Improve time management");
    if (detailedScores.presence < 70) adjustments.push(feedback?.presence?.reasoning || "Reduce filler words");
    if (analysis?.fillerWordCount > 3) adjustments.push(`Eliminate filler word "${analysis.fillerWords[0]}" — pause instead`);
    
    return { didWell, hurtScore, adjustments };
  };

  // Calculate words per minute
  const wordsPerMinute = duration > 0 ? Math.round((analysis?.wordCount || 0) / (duration / 60)) : 0;
  const avgPauseLength = "N/A"; // Would need pause detection
  const timeUsedPercent = duration > 0 ? Math.round((duration / timeConstraint) * 100) : 0;

  // Show fallback if no valid analysis
  if (!hasValidAnalysis || !transcript || transcript.length === 0) {
    return (
      <section className="py-8 px-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-xl p-6 border border-[#9D7BF5]/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Rep {repNumber} Complete</p>
                <h2 className="text-2xl font-bold text-gray-900">{scenario}</h2>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Rep didn't save</h3>
                <p className="text-sm text-gray-700 mb-4">
                  That recording was too short to score. Try again and aim for at least 15 seconds of actual speaking.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={onDoAnotherRep}
              className="w-full py-4 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-xl font-bold text-base hover:shadow-xl hover:shadow-purple-500/30 transition-all flex items-center justify-center gap-2"
            >
              Try Again
              <ArrowRight className="w-5 h-5" />
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onChangePrompt}
                className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Back to setup
              </button>
              <button
                onClick={onChangeFramework}
                className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Change prompt
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const contentFeedback = getContentFeedback();
  const deliveryFeedback = getDeliveryFeedback();

  return (
    <section className="py-6 px-4 md:px-6">
      <div className="max-w-4xl mx-auto space-y-5">
        
        {/* 1️⃣ Top Section – Rep Summary Card */}
        <div className="bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl p-[2px]">
          <div className="bg-white rounded-[10px] p-5">
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Rep Complete</p>
                <h2 className="text-2xl font-bold text-gray-900">{scenario}</h2>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className={`text-5xl font-bold ${getScoreColor(overallScore)}`}>
                    {overallScore}
                  </span>
                  <span className="text-xl text-gray-500">/100</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getScoreBadgeColor(overallScore)}`} />
                  <p className={`text-sm font-semibold ${getScoreColor(overallScore)}`}>
                    {getScoreLabel(overallScore)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2️⃣ Audio Playback Section */}
        {audioBlob && audioUrl ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-900 mb-4">Listen to Your Rep</p>
            
            {/* Custom Audio Player */}
            <div className="space-y-4">
              {/* Waveform Background + Controls */}
              <div className="relative bg-gradient-to-r from-[#5CB3FF]/5 via-[#9D7BF5]/5 to-[#E86DE1]/5 rounded-xl p-6 border border-[#9D7BF5]/20">
                {/* Decorative waveform background */}
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                  <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
                    <path d="M0,50 Q10,20 20,50 T40,50 T60,50 T80,50 T100,50 T120,50 T140,50 T160,50 T180,50 T200,50 T220,50 T240,50 T260,50 T280,50 T300,50 T320,50 T340,50 T360,50 T380,50 T400,50" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          className="text-[#9D7BF5]" />
                  </svg>
                </div>

                <div className="relative flex items-center gap-4">
                  {/* Large Play/Pause Button */}
                  <button
                    onClick={handlePlayPause}
                    className="w-14 h-14 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full flex items-center justify-center hover:shadow-lg hover:scale-105 transition-all flex-shrink-0"
                  >
                    {isPlaying ? (
                      <Pause className="w-7 h-7 text-white fill-current" />
                    ) : (
                      <Play className="w-7 h-7 text-white fill-current ml-0.5" />
                    )}
                  </button>

                  {/* Secondary Controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSkip(-15)}
                      className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-[#9D7BF5] transition-colors"
                      title="15s back"
                    >
                      <SkipBack className="w-5 h-5" />
                    </button>

                    <button
                      onClick={handleRestart}
                      className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-[#9D7BF5] transition-colors"
                      title="Replay"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => handleSkip(15)}
                      className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-[#9D7BF5] transition-colors"
                      title="15s forward"
                    >
                      <SkipForward className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex-1" />

                  {/* Volume & Download */}
                  <Volume2 className="w-5 h-5 text-gray-400" />
                  <button
                    onClick={handleDownload}
                    className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-[#9D7BF5] transition-colors"
                    title="Download"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Progress Bar with Time */}
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#9D7BF5]"
                  style={{
                    background: `linear-gradient(to right, #9D7BF5 0%, #9D7BF5 ${(currentTime / duration) * 100}%, #e5e7eb ${(currentTime / duration) * 100}%, #e5e7eb 100%)`
                  }}
                />
                <div className="flex items-center justify-between text-xs text-gray-600 font-mono">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              Use playback to catch pacing issues, filler words, and delivery patterns.
            </p>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-[#5CB3FF]/5 via-[#9D7BF5]/5 to-[#E86DE1]/5 rounded-xl border border-[#9D7BF5]/20 p-4">
            <p className="text-sm text-gray-700">Audio playback would appear here in a live session.</p>
          </div>
        )}

        {/* 3️⃣ Core Score Breakdown - Compact 2-Row Grid */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Core Scores</h3>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {Object.entries(detailedScores).map(([dimension, score]) => (
              <div key={dimension} className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                <div className="text-2xl mb-1">{dimensionIcons[dimension as keyof typeof dimensionIcons]}</div>
                <p className={`text-2xl font-bold ${getScoreColor(score)} mb-0.5`}>
                  {score}
                </p>
                <p className="text-xs text-gray-600 capitalize">{dimension}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 4️⃣ Deep Feedback Section - Tabbed */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <h3 className="text-base font-bold text-gray-900">Detailed Performance Breakdown</h3>
          </div>
          
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="w-full grid grid-cols-2 bg-gray-50 rounded-none border-b border-gray-200 p-0">
              <TabsTrigger 
                value="content" 
                className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-[#9D7BF5] py-3 font-semibold"
              >
                Content
              </TabsTrigger>
              <TabsTrigger 
                value="delivery" 
                className="rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-[#9D7BF5] py-3 font-semibold"
              >
                Delivery
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="p-5 m-0 space-y-4">
              {/* What You Did Well */}
              {contentFeedback.didWell.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">What You Did Well</h4>
                  <div className="space-y-1.5">
                    {contentFeedback.didWell.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* What Hurt Your Score */}
              {contentFeedback.hurtScore.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">What Hurt Your Score</h4>
                  <div className="space-y-1.5">
                    {contentFeedback.hurtScore.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Specific Adjustments */}
              {contentFeedback.adjustments.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Specific Adjustments</h4>
                  <div className="space-y-1.5">
                    {contentFeedback.adjustments.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-sm font-bold text-[#9D7BF5] flex-shrink-0">{idx + 1}.</span>
                        <p className="text-sm text-gray-700">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="delivery" className="p-5 m-0 space-y-4">
              {/* What You Did Well */}
              {deliveryFeedback.didWell.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">What You Did Well</h4>
                  <div className="space-y-1.5">
                    {deliveryFeedback.didWell.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* What Hurt Your Score */}
              {deliveryFeedback.hurtScore.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">What Hurt Your Score</h4>
                  <div className="space-y-1.5">
                    {deliveryFeedback.hurtScore.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Specific Adjustments */}
              {deliveryFeedback.adjustments.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Specific Adjustments</h4>
                  <div className="space-y-1.5">
                    {deliveryFeedback.adjustments.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-sm font-bold text-[#9D7BF5] flex-shrink-0">{idx + 1}.</span>
                        <p className="text-sm text-gray-700">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* 5️⃣ Filler Word & Delivery Insights Panel */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{wordsPerMinute}</p>
              <p className="text-xs text-gray-600 mt-0.5">Words/min</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{analysis?.fillerWordCount || 0}</p>
              <p className="text-xs text-gray-600 mt-0.5">Filler words</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{avgPauseLength}</p>
              <p className="text-xs text-gray-600 mt-0.5">Avg pause</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{timeUsedPercent}%</p>
              <p className="text-xs text-gray-600 mt-0.5">Time used</p>
            </div>
          </div>
        </div>

        {/* 6️⃣ Next Rep Focus Section */}
        {feedback?.primaryFocus && (
          <div className="bg-[#9D7BF5] bg-opacity-10 border-2 border-[#9D7BF5] rounded-xl p-5">
            <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-[#9D7BF5]" />
              Next Rep Focus
            </h3>
            <div className="space-y-2 bg-white rounded-lg p-4 border border-[#9D7BF5]/30">
              <p className="text-sm font-semibold text-[#9D7BF5]">
                {feedback.primaryFocus.instruction}
              </p>
              {/* Add 1-2 specific directives based on dimension */}
              {feedback.primaryFocus.dimension === "clarity" && (
                <p className="text-sm text-gray-700">
                  Lead with your main point in the first 10 seconds.
                </p>
              )}
              {feedback.primaryFocus.dimension === "pacing" && (
                <p className="text-sm text-gray-700">
                  Slow down during transitions to avoid rushed middle sections.
                </p>
              )}
              {feedback.primaryFocus.dimension === "presence" && (
                <p className="text-sm text-gray-700">
                  Replace "{analysis?.fillerWords[0] || 'um'}" with a 2-second pause.
                </p>
              )}
              {feedback.primaryFocus.dimension === "structure" && (
                <p className="text-sm text-gray-700">
                  State each framework component out loud before delivering it.
                </p>
              )}
              {feedback.primaryFocus.dimension === "specificity" && (
                <p className="text-sm text-gray-700">
                  Add one concrete example with numbers in the middle 30 seconds.
                </p>
              )}
            </div>
          </div>
        )}

        {/* 7️⃣ Bottom Actions */}
        <div className="space-y-3 pt-2">
          <button
            onClick={onDoAnotherRep}
            className="w-full py-4 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-xl font-bold text-base hover:shadow-xl hover:shadow-purple-500/30 transition-all flex items-center justify-center gap-2"
          >
            Do Another Rep
            <ArrowRight className="w-5 h-5" />
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onChangePrompt}
              className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Change Prompt
            </button>
            <button
              onClick={onChangeFramework}
              className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Change Framework
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}