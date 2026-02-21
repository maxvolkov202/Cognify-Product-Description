import { Target, ArrowRight } from "lucide-react";

interface ImprovementReminderProps {
  previousFocus: {
    title: string;
    nextStep: string;
  };
}

export function ImprovementReminder({ previousFocus }: ImprovementReminderProps) {
  return (
    <div className="bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-xl p-4 border-2 border-[#9D7BF5]/40">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-lg flex items-center justify-center flex-shrink-0">
          <Target className="w-5 h-5 text-white" />
        </div>
        
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-[10px] text-[#9D7BF5] font-bold uppercase tracking-wide mb-0.5">
              From your last rep
            </p>
            <h3 className="text-base font-bold text-gray-900 leading-tight">
              {previousFocus.title}
            </h3>
          </div>

          <div className="bg-white rounded-lg p-3 border border-[#9D7BF5]/30">
            <div className="flex items-start gap-2">
              <ArrowRight className="w-4 h-4 text-[#9D7BF5] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-600 mb-0.5">
                  Apply this now:
                </p>
                <p className="text-sm font-bold text-gray-900 leading-tight">
                  {previousFocus.nextStep}
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-600 leading-relaxed">
            Progress is built rep by rep. Focus on one improvement.
          </p>
        </div>
      </div>
    </div>
  );
}
