import { ChevronDown, Mic } from "lucide-react";

export function ProductPreview() {
  return (
    <div className="space-y-4">
      {/* Label */}
      <div className="text-center space-y-1.5">
        <h3 className="text-sm font-bold text-[#9D7BF5] uppercase tracking-wide">
          The Structured Practice Loop
        </h3>
        <p className="text-sm text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Every session follows a tight sequence designed to build clarity and confidence under pressure.
        </p>
      </div>

      {/* Split Preview */}
      <div className="bg-white rounded-xl border-2 border-gray-200 shadow-2xl overflow-hidden">
        <div className="grid lg:grid-cols-[40%_60%] divide-x divide-gray-200">
          {/* LEFT: Configuration Panel */}
          <div className="bg-gray-50 p-4 space-y-4">
            {/* Scenario */}
            <div className="bg-gradient-to-r from-[#5CB3FF]/10 via-[#9D7BF5]/10 to-[#E86DE1]/10 rounded-lg p-3 border border-[#9D7BF5]/30">
              <p className="text-[10px] text-gray-600 mb-0.5 uppercase font-semibold tracking-wide">Scenario</p>
              <p className="text-sm font-bold text-gray-900 leading-tight">
                Explain a technical decision
              </p>
            </div>

            {/* Step 1: Persona */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[9px] font-bold text-[#9D7BF5] uppercase tracking-wide">
                  Step 1
                </span>
                <label className="text-xs font-bold text-gray-900">
                  Audience
                </label>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="px-2 py-1.5 rounded-md border-2 border-gray-200 bg-white text-xs text-gray-700 text-center">
                  Executive
                </div>
                <div className="px-2 py-1.5 rounded-md border-2 border-[#9D7BF5] bg-[#9D7BF5]/5 text-xs text-[#9D7BF5] font-medium text-center">
                  Team
                </div>
                <div className="px-2 py-1.5 rounded-md border-2 border-gray-200 bg-white text-xs text-gray-700 text-center">
                  Client
                </div>
                <div className="px-2 py-1.5 rounded-md border-2 border-gray-200 bg-white text-xs text-gray-700 text-center">
                  Stakeholder
                </div>
              </div>
            </div>

            {/* Step 2: Framework */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[9px] font-bold text-[#9D7BF5] uppercase tracking-wide">
                  Step 2
                </span>
                <label className="text-xs font-bold text-gray-900">
                  Framework
                </label>
              </div>
              <div className="px-2.5 py-2 rounded-md border-2 border-[#9D7BF5] bg-[#9D7BF5]/5 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-900">
                  Context → Decision → Impact
                </span>
                <ChevronDown className="w-3 h-3 text-gray-500" />
              </div>
              {/* Compact preview */}
              <div className="p-2 bg-white rounded-md border border-gray-200">
                <p className="text-[9px] font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Structure
                </p>
                <div className="flex gap-1">
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-50 border border-gray-200 rounded text-gray-700">
                    Context
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-50 border border-gray-200 rounded text-gray-700">
                    Decision
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-50 border border-gray-200 rounded text-gray-700">
                    Impact
                  </span>
                </div>
              </div>
            </div>

            {/* Step 3: Time */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[9px] font-bold text-[#9D7BF5] uppercase tracking-wide">
                  Step 3
                </span>
                <label className="text-xs font-bold text-gray-900">
                  Time
                </label>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="px-2 py-1.5 rounded-md border-2 border-gray-200 bg-white text-xs text-gray-700 text-center font-medium">
                  30s
                </div>
                <div className="px-2 py-1.5 rounded-md border-2 border-[#9D7BF5] bg-[#9D7BF5]/5 text-xs text-[#9D7BF5] text-center font-medium">
                  60s
                </div>
                <div className="px-2 py-1.5 rounded-md border-2 border-gray-200 bg-white text-xs text-gray-700 text-center font-medium">
                  90s
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Recording Cockpit */}
          <div className="bg-white p-4 space-y-4">
            {/* Framework Guide - Always Visible */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-2">
                Framework Guide
              </p>
              <div className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-[#9D7BF5] flex-shrink-0">1.</span>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Context</p>
                    <p className="text-[10px] text-gray-600 leading-tight">Set the background</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-gray-600 flex-shrink-0">2.</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-700">Decision</p>
                    <p className="text-[10px] text-gray-500 leading-tight">What was decided</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-gray-600 flex-shrink-0">3.</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-700">Impact</p>
                    <p className="text-[10px] text-gray-500 leading-tight">Consequences</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Timer - Primary Element */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-full">
                <div className="text-6xl font-bold tracking-tight text-gray-900">
                  00:47
                </div>
              </div>
              <div className="flex justify-center gap-1.5">
                <div className="h-1.5 w-16 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full"></div>
                <div className="h-1.5 w-16 bg-gray-200 rounded-full"></div>
              </div>
              <p className="text-xs text-gray-500 font-medium">47 of 60 seconds</p>
            </div>

            {/* Mic Button - Compact */}
            <div className="flex justify-center">
              <button className="w-14 h-14 bg-gradient-to-r from-[#5CB3FF] via-[#9D7BF5] to-[#E86DE1] rounded-full flex items-center justify-center shadow-lg shadow-purple-500/30 ring-4 ring-[#9D7BF5]/20">
                <Mic className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Status */}
            <div className="text-center">
              <p className="text-xs text-gray-600">
                Recording in progress
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
