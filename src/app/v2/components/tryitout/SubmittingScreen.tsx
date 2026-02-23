import { Upload } from "lucide-react";

interface SubmittingScreenProps {
  repNumber: number;
  scenario: string;
}

export function SubmittingScreen({ repNumber, scenario }: SubmittingScreenProps) {
  return (
    <section className="py-8 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <div className="space-y-6">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-white" />
              </div>
            </div>

            {/* Title */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">Submitting your rep...</h2>
              <p className="text-gray-600">Saving audio + preparing analysis</p>
            </div>

            {/* Progress Indicator */}
            <div className="flex justify-center py-4">
              <div className="w-12 h-12 border-4 border-[#9D7BF5]/30 border-t-[#9D7BF5] rounded-full animate-spin"></div>
            </div>

            {/* Step indicator */}
            <div className="text-center">
              <p className="text-xs text-gray-500">Step 1 of 2: Uploading...</p>
            </div>

            {/* Rep Info */}
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600">
                Rep {repNumber}: {scenario}
              </p>
            </div>

            {/* Notice */}
            <div className="text-center">
              <p className="text-xs text-gray-500">
                Please wait — this usually takes 3-5 seconds
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
