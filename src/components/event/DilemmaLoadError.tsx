// src/components/event/DilemmaLoadError.tsx
// Error display component when dilemma fails to load
//
// Shows:
// - Error message explaining AI generation failure
// - "Start New Game" button to clear state and restart
// - Debug details in debug mode
//
// Used by: EventScreen3
// Props: error (string), onStartNew (function)

import { AlertTriangle } from "lucide-react";
import { useSettingsStore } from "../../store/settingsStore";
import { useDilemmaStore } from "../../store/dilemmaStore";
import { useCompassStore } from "../../store/compassStore";
import { useRoleStore } from "../../store/roleStore";
import { bgStyle } from "../../lib/ui";

type Props = {
  error: string;
  onStartNew: () => void; // Navigate to role selection
  onRetry?: () => void;   // Retry loading current dilemma
};

export default function DilemmaLoadError({ error, onStartNew, onRetry }: Props) {
  const debugMode = useSettingsStore(s => s.debugMode);

  const handleStartNewGame = () => {
    // Clear all game state
    useDilemmaStore.getState().reset();
    useCompassStore.getState().reset();
    useRoleStore.getState().reset();

    // Navigate to role selection
    onStartNew();
  };

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
            Unable to Generate Challenge
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

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            {/* Try Again Button (if retry handler provided) */}
            {onRetry && (
              <button
                onClick={onRetry}
                className="
                  px-6 py-3
                  bg-gradient-to-r from-emerald-500 to-teal-600
                  hover:from-emerald-600 hover:to-teal-700
                  text-white font-medium rounded-lg
                  transition-all duration-200
                  shadow-lg hover:shadow-xl
                  transform hover:scale-105
                "
              >
                Try Again
              </button>
            )}

            {/* Start New Game Button */}
            <button
              onClick={handleStartNewGame}
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
              Start New Game
            </button>
          </div>

          {/* Helper Text */}
          <p className="text-sm text-white/50 mt-4">
            {onRetry
              ? "The AI service failed after 8 attempts. Wait a moment and try again, or start a new game."
              : "The AI service failed after 8 attempts. Please start a new game to continue."
            }
          </p>
        </div>
      </div>
    </div>
  );
}
