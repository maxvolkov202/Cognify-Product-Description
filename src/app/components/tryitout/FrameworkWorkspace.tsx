import React, { useState, useEffect } from "react";
import { Layers, Lock } from "lucide-react";

interface FrameworkWorkspaceProps {
  frameworkName: string;
  frameworkSteps: string[];
  isRecording: boolean;
  isLocked: boolean;
}

interface BulletInputs {
  [key: string]: string;
}

// Placeholder text for each common framework step
const PLACEHOLDER_MAP: Record<string, string> = {
  // Problem → Impact → Solution
  "Problem": "Key issue",
  "Impact": "Who's affected & why it matters",
  "Solution": "What you recommend",
  
  // Situation → Action → Result
  "Situation": "Context & challenge",
  "Action": "What you did",
  "Result": "Measurable outcome",
  
  // Context → Insight → Recommendation
  "Context": "Background",
  "Insight": "Key finding",
  "Recommendation": "Next step",
  
  // STAR (legacy compatibility)
  "S": "Context & challenge",
  "T": "Your responsibility",
  "A": "What you did",
  "R": "Measurable outcome",
};

const MAX_CHARS = 100;

export function FrameworkWorkspace({
  frameworkName,
  frameworkSteps,
  isRecording,
  isLocked
}: FrameworkWorkspaceProps) {
  const [bulletInputs, setBulletInputs] = useState<BulletInputs>({});
  const [charCounts, setCharCounts] = useState<Record<string, number>>({});

  // Initialize empty inputs for each step
  useEffect(() => {
    if (!frameworkSteps || frameworkSteps.length === 0) return;
    const initialInputs: BulletInputs = {};
    frameworkSteps.forEach(step => {
      initialInputs[step] = "";
    });
    setBulletInputs(initialInputs);
  }, [frameworkSteps]);

  const handleInputChange = (step: string, value: string) => {
    if (isLocked) return;
    
    // Enforce character limit
    if (value.length <= MAX_CHARS) {
      setBulletInputs(prev => ({
        ...prev,
        [step]: value
      }));
      setCharCounts(prev => ({
        ...prev,
        [step]: value.length
      }));
    }
  };

  const getPlaceholder = (step: string): string => {
    return PLACEHOLDER_MAP[step] || "Keywords only";
  };

  if (!frameworkSteps || frameworkSteps.length === 0) {
    return null; // Don't show for free-form
  }

  return (
    <div className={`bg-white rounded-xl border-2 p-5 transition-all duration-300 ${
      isRecording 
        ? 'border-[#9D7BF5] shadow-lg shadow-[#9D7BF5]/20' 
        : 'border-[#9D7BF5]/30'
    }`}>
      {/* Header - Compact */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-lg flex items-center justify-center flex-shrink-0">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-600 font-medium">Framework</p>
            <p className="text-sm font-bold text-gray-900 leading-tight">{frameworkName}</p>
          </div>
        </div>
        
        {isLocked && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md">
            <Lock className="w-3 h-3" />
            <span>Locked</span>
          </div>
        )}
      </div>

      {/* Optional guidance hint - Compact */}
      {!isRecording && !isLocked && (
        <div className="mb-3 p-2.5 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-gray-700 leading-relaxed">
            <strong className="text-[#9D7BF5]">Optional:</strong> Add keywords to guide your thinking. Locks when recording starts.
          </p>
        </div>
      )}

      {/* Framework Steps with Bullet Inputs - Compact */}
      <div className="space-y-2.5 relative">
        {frameworkSteps.map((step, index) => (
          <div key={step} className="relative">
            {/* Vertical Connector Line */}
            {index < frameworkSteps.length - 1 && (
              <div className="absolute left-2 top-full w-0.5 h-2.5 bg-gradient-to-b from-[#9D7BF5]/40 to-transparent z-0"></div>
            )}
            
            <div 
              className={`rounded-lg border p-3 transition-all duration-300 relative ${
                isLocked 
                  ? 'border-gray-200 bg-gray-50/50' 
                  : 'border-[#9D7BF5]/20 bg-white hover:border-[#9D7BF5]/40 hover:shadow-sm'
              }`}
            >
            {/* Step Label - Compact */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 transition-colors ${
                isLocked 
                  ? 'bg-gray-200 text-gray-600'
                  : 'bg-[#9D7BF5]/10 text-[#9D7BF5]'
              }`}>
                {index + 1}
              </span>
              <label 
                htmlFor={`bullet-${step}`}
                className={`text-xs font-bold transition-colors ${
                  isLocked ? 'text-gray-600' : 'text-gray-900'
                }`}
              >
                {step}
              </label>
            </div>

            {/* Input Field - Compact */}
            <div className="relative">
              <input
                id={`bullet-${step}`}
                type="text"
                value={bulletInputs[step] || ""}
                onChange={(e) => handleInputChange(step, e.target.value)}
                placeholder={getPlaceholder(step)}
                disabled={isLocked}
                maxLength={MAX_CHARS}
                className={`w-full px-2.5 py-1.5 text-xs border rounded-md transition-all ${
                  isLocked
                    ? 'bg-gray-50 border-gray-200 text-gray-600 cursor-not-allowed'
                    : 'bg-white border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#9D7BF5]/50 focus:border-[#9D7BF5]'
                } placeholder:text-gray-400`}
              />
              
              {/* Character Count */}
              {!isLocked && charCounts[step] > 0 && (
                <div className={`absolute right-2 top-1 text-[10px] transition-colors ${
                  charCounts[step] >= MAX_CHARS 
                    ? 'text-orange-600 font-semibold' 
                    : 'text-gray-400'
                }`}>
                  {charCounts[step]}/{MAX_CHARS}
                </div>
              )}
            </div>
          </div>
          </div>
        ))}
      </div>

      {/* Bottom Reminder - Compact */}
      {isRecording && isLocked && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-[10px] text-gray-500 text-center leading-relaxed">
            Mental cue cards—not a script
          </p>
        </div>
      )}
    </div>
  );
}
