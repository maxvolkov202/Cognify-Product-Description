import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { FRAMEWORKS } from "../../../types/rep";

interface FrameworkDropdownProps {
  selectedFramework: string;
  setSelectedFramework: (framework: string) => void;
}

export function FrameworkDropdown({
  selectedFramework,
  setSelectedFramework
}: FrameworkDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const selectedFrameworkObj = FRAMEWORKS.find(f => f.id === selectedFramework);

  return (
    <div className="relative space-y-2" ref={dropdownRef}>
      <label className="block text-sm font-bold text-gray-900">
        Choose a framework
      </label>
      <p className="text-xs text-gray-600">
        Structure to guide your thinking
      </p>

      {/* Dropdown Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all ${
          isOpen 
            ? "border-[#9D7BF5] bg-white" 
            : selectedFrameworkObj 
              ? "border-[#9D7BF5] bg-[#9D7BF5]/5"
              : "border-gray-300 bg-white hover:border-gray-400"
        }`}
      >
        <span className={`text-sm ${selectedFrameworkObj ? "text-gray-900 font-medium" : "text-gray-500"}`}>
          {selectedFrameworkObj ? selectedFrameworkObj.name : "Select a framework..."}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-[420px] overflow-y-auto">
          {FRAMEWORKS.map((framework) => (
            <button
              key={framework.id}
              type="button"
              onClick={() => {
                setSelectedFramework(framework.id);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0 transition-colors ${
                selectedFramework === framework.id
                  ? "bg-[#9D7BF5]/5"
                  : "hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-1">
                  <p className={`text-sm font-bold leading-tight ${
                    selectedFramework === framework.id ? "text-[#9D7BF5]" : "text-gray-900"
                  }`}>
                    {framework.name}
                  </p>
                  <p className="text-xs text-gray-600 leading-snug">
                    {framework.description}
                  </p>
                  <p className="text-xs text-gray-500 italic">
                    {framework.whenToUse}
                  </p>
                </div>
                {selectedFramework === framework.id && (
                  <Check className="w-4 h-4 text-[#9D7BF5] flex-shrink-0 mt-0.5" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
