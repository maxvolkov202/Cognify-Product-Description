import { AlertCircle } from "lucide-react";

interface RetryWarningBannerProps {
  message?: string;
}

export function RetryWarningBanner({ 
  message = "Last rep didn't process. Please try again." 
}: RetryWarningBannerProps) {
  return (
    <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
      <p className="text-sm font-medium text-yellow-900 flex-1">
        {message}
      </p>
    </div>
  );
}
