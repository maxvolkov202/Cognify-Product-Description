import { useState, useEffect } from "react";
import { X, Play, Pause, RotateCcw, SkipBack, SkipForward, Download, CheckCircle2, XCircle, ArrowRight, Volume2 } from "lucide-react";
import { Rep, FRAMEWORKS } from "../../types/rep";

interface RepDetailModalProps {
  rep: Rep;
  onClose: () => void;
}

export function RepDetailModal({ rep, onClose }: RepDetailModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioElement] = useState<HTMLAudioElement | null>(null);

  const framework = FRAMEWORKS.find(f => f.id === rep.framework);
  const overallScore = rep.detailedScores ? 
    Math.round(
      (rep.detailedScores.clarity * 0.2) +
      (rep.detailedScores.structure * 0.25) +
      (rep.detailedScores.specificity * 0.25) +
      (rep.detailedScores.pacing * 0.15) +
      (rep.detailedScores.presence * 0.15)
    ) : rep.clarityScore;

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

  const getBorderColor = (score: number) => {
    if (score >= 90) return "border-green-200";
    if (score >= 75) return "border-blue-200";
    if (score >= 60) return "border-yellow-200";
    return "border-red-200";
  };

  const dimensionIcons = {
    clarity: "💎",
    structure: "🏗️",
    specificity: "🎯",
    pacing: "⚡",
    presence: "👔"
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 rounded-t-2xl px-6 py-4 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">Rep Detail</p>
            <h2 className="text-xl font-bold text-gray-900 truncate">{rep.scenario}</h2>
            <p className="text-sm text-gray-600">{formatDate(rep.completedAt)}</p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Rep Summary Card */}
          <div className="bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-xl p-[2px]">
            <div className="bg-white rounded-[10px] p-5">
              <div className="flex items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="font-medium">Scenario:</span>
                      <span>{rep.scenarioCategory}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="font-medium">Framework:</span>
                      <span>{framework?.name || rep.framework}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="font-medium">Audience:</span>
                      <span>{rep.audience}</span>
                    </div>
                  </div>
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

          {/* Audio Playback - Note: Historical reps may not have audio */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
            <div className="flex items-start gap-3">
              <Volume2 className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">Audio Playback</p>
                <p className="text-xs text-gray-600">
                  Audio playback is available for recently completed reps. Historical reps are stored without audio to save space.
                </p>
              </div>
            </div>
          </div>

          {/* Core Scores */}
          {rep.detailedScores && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Core Scores</h3>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {Object.entries(rep.detailedScores).map(([dimension, score]) => (
                  <div key={dimension} className={`bg-white rounded-lg border-2 ${getBorderColor(score)} p-3`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{dimensionIcons[dimension as keyof typeof dimensionIcons]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 capitalize truncate">{dimension}</p>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-xl font-bold ${getScoreColor(score)}`}>
                            {score}
                          </span>
                          <span className="text-xs text-gray-500">/100</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full transition-all ${
                          score >= 90 ? 'bg-green-500' :
                          score >= 75 ? 'bg-blue-500' :
                          score >= 60 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transcript */}
          {rep.transcript && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Transcript</h3>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {rep.transcript}
                </p>
              </div>
            </div>
          )}

          {/* Next Rep Focus (from that time) */}
          {rep.primaryFocus && (
            <div className="bg-[#9D7BF5] bg-opacity-10 border-2 border-[#9D7BF5] rounded-xl p-5">
              <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                <ArrowRight className="w-5 h-5 text-[#9D7BF5]" />
                Next Rep Focus (from this session)
              </h3>
              <div className="bg-white rounded-lg p-4 border border-[#9D7BF5]/30">
                <p className="text-sm font-semibold text-[#9D7BF5] mb-1">
                  {rep.primaryFocus.title}
                </p>
                <p className="text-sm text-gray-700">
                  {rep.primaryFocus.nextStep}
                </p>
              </div>
            </div>
          )}

          {/* Performance Metrics */}
          {rep.analysisMetrics && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Performance Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 rounded-xl border border-gray-200 p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{rep.analysisMetrics.fillerWordCount}</p>
                  <p className="text-xs text-gray-600 mt-0.5">Filler words</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{rep.analysisMetrics.wordCount}</p>
                  <p className="text-xs text-gray-600 mt-0.5">Total words</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {rep.analysisMetrics.hasStrongOpening ? '✓' : '✗'}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">Strong opening</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.round(rep.analysisMetrics.frameworkCoveragePercentage)}%
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">Framework coverage</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 rounded-b-2xl px-6 py-4">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-xl font-bold text-base hover:shadow-xl hover:shadow-purple-500/30 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
