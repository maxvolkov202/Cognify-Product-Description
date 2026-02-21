import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface SubmitFeedbackBannerProps {
  show: boolean;
  type: "success" | "warning";
  message: string;
  submessage?: string;
}

export function SubmitFeedbackBanner({
  show,
  type,
  message,
  submessage
}: SubmitFeedbackBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      // Trigger animation after render
      setTimeout(() => setIsVisible(true), 10);
      
      // Auto-hide after 3 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        // Remove from DOM after animation
        setTimeout(() => setShouldRender(false), 300);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!shouldRender) return null;

  const bgColor = type === "success" 
    ? "bg-gradient-to-r from-green-500 to-emerald-500" 
    : "bg-gradient-to-r from-amber-500 to-orange-500";

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 transform ${
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      }`}
    >
      <div className={`${bgColor} text-white py-4 px-6 shadow-lg`}>
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          {type === "success" ? (
            <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
          )}
          <div className="flex-1">
            <p className="font-bold text-base">{message}</p>
            {submessage && (
              <p className="text-sm opacity-90 mt-0.5">{submessage}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
