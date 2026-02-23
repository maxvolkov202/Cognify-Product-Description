import { AlertCircle, X } from "lucide-react";

interface RepFailedModalProps {
  isOpen: boolean;
  reason: "too-short" | "upload-failed" | "transcription-failed" | "processing-failed";
  minDuration?: number;
  onTryAgain: () => void;
  onCancel: () => void;
}

export function RepFailedModal({ 
  isOpen, 
  reason, 
  minDuration = 20,
  onTryAgain, 
  onCancel 
}: RepFailedModalProps) {
  if (!isOpen) return null;

  const getMessage = () => {
    switch (reason) {
      case "too-short":
        return `That rep was too short. Aim for at least ${minDuration} seconds so we can generate meaningful feedback.`;
      case "upload-failed":
        return "Audio upload failed. Please check your connection and try again.";
      case "transcription-failed":
        return "We couldn't transcribe your audio. Please try recording again.";
      case "processing-failed":
        return "Something went wrong during processing. Please try again.";
      default:
        return "That rep didn't process correctly. Please try again.";
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onCancel}
      >
        {/* Modal */}
        <div 
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Rep didn't save</h3>
            </div>
            <button
              onClick={onCancel}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-3">
            <p className="text-base text-gray-700 leading-relaxed">
              {getMessage()}
            </p>
            <p className="text-sm text-gray-600">
              Nothing was saved. Your configuration is preserved so you can retry immediately.
            </p>
          </div>

          {/* Tip */}
          {reason === "too-short" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-900">
                <strong>Tip:</strong> A valid rep needs enough content to analyze for clarity, structure, and pacing. Aim for thoughtful responses that fill most of your time limit.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onTryAgain}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] text-white rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
