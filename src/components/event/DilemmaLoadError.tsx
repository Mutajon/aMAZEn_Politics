// src/components/event/DilemmaLoadError.tsx
// Error display component when dilemma fails to load
//
// Shows:
// - Error message
// - "Try Again" button to retry collection
// - Debug details in debug mode
//
// Used by: EventScreen3
// Props: error (string), onRetry (function)

import { AlertTriangle } from "lucide-react";
import { useSettingsStore } from "../../store/settingsStore";
import { bgStyle } from "../../lib/ui";

type Props = {
  error: string;
  onRetry: () => void;
};

export default function DilemmaLoadError({ error, onRetry }: Props) {
  const debugMode = useSettingsStore(s => s.debugMode);

  return (
    <div className="min-h-screen" style={bgStyle}>
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-8 text-center">
          {/* Error Icon */}
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-red-500/20 p-4">
              <AlertTriangle className="w-12 h-12 text-red-400" />
            </div>
          </div>

          {/* Error Heading */}
          <h2 className="text-2xl font-bold text-white mb-3">
            Failed to Load Dilemma
          </h2>

          {/* Error Message */}
          <p className="text-white/70 mb-6">
            {error}
          </p>

          {/* Debug Details (only in debug mode) */}
          {debugMode && (
            <details className="mb-6 text-left">
              <summary className="text-sm text-white/50 cursor-pointer hover:text-white/70 mb-2">
                Technical Details
              </summary>
              <pre className="text-xs text-white/60 bg-black/20 p-3 rounded overflow-auto max-h-32">
                {error}
              </pre>
            </details>
          )}

          {/* Try Again Button */}
          <button
            onClick={onRetry}
            className="
              px-6 py-3
              bg-gradient-to-r from-indigo-500 to-purple-600
              hover:from-indigo-600 hover:to-purple-700
              text-white font-medium rounded-lg
              transition-all duration-200
              shadow-lg hover:shadow-xl
              transform hover:scale-105
            "
          >
            Try Again
          </button>

          {/* Helper Text */}
          <p className="text-sm text-white/50 mt-4">
            Check your internet connection and try again.
          </p>
        </div>
      </div>
    </div>
  );
}
