import { AlertCircle, RotateCcw, Mic, ArrowLeft } from "lucide-react";

interface RepErrorScreenProps {
  errorMessage: string;
  onRetry: () => void;
  onReRecord: () => void;
  onBackToGym: () => void;
  hasAudio: boolean;
}

export function RepErrorScreen({
  errorMessage,
  onRetry,
  onReRecord,
  onBackToGym,
  hasAudio
}: RepErrorScreenProps) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border-2 border-red-200 p-12 text-center">
        {/* Error Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
        </div>

        {/* Error Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Rep Processing Failed</h2>
        <p className="text-gray-700 mb-8 max-w-md mx-auto">{errorMessage}</p>

        {/* Possible Reasons */}
        <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-8 max-w-md mx-auto">
          <p className="text-sm font-semibold text-red-900 mb-2">Possible reasons:</p>
          <ul className="text-sm text-red-800 space-y-1 text-left">
            <li>• Audio too short (speak for at least 5 seconds)</li>
            <li>• Network interruption</li>
            <li>• AI evaluation timeout</li>
            <li>• Recording quality issue</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 max-w-md mx-auto">
          {hasAudio && (
            <button
              onClick={onRetry}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#5CB3FF] to-[#9D7BF5] text-white rounded-lg font-medium hover:shadow-lg transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Retry Evaluation
            </button>
          )}

          <button
            onClick={onReRecord}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:border-gray-400 hover:bg-gray-50 transition-all"
          >
            <Mic className="w-4 h-4" />
            Re-record Rep
          </button>

          <button
            onClick={onBackToGym}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Gym
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Your recording is temporarily saved. You can retry the evaluation without re-recording.
          </p>
        </div>
      </div>
    </div>
  );
}
