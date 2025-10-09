// src/components/event/CollectorLoadingOverlay.tsx
// Loading overlay for EventDataCollector
//
// Shows:
// - Spinning hourglass animation
// - Days left bar (starts at totalDays, empties with each day)
// - Loading message
//
// Used by: EventScreen3 during data collection
// Props: day, totalDays

import { Hourglass } from "lucide-react";
import { bgStyle } from "../../lib/ui";

type Props = {
  progress: number; // 0-100 real-time progress percentage (REQUIRED)
  message?: string;
};

export default function CollectorLoadingOverlay({
  progress,
  message = "Gathering political intelligence..."
}: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={bgStyle}>
      <div className="text-center">
        {/* Spinning Hourglass - Golden Yellow */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <Hourglass
              className="w-16 h-16 text-amber-400 animate-spin"
              style={{ animationDuration: "2s" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-300/10 to-transparent animate-pulse" />
          </div>
        </div>

        {/* Loading Message */}
        <p className="text-white/90 text-lg font-medium mb-4">
          {message}
        </p>

        {/* Collection Progress Percentage */}
        <div className="mb-6">
          <p className="text-6xl font-bold text-white/95 tabular-nums">
            {Math.round(progress)}%
          </p>
        </div>

        {/* Pulsing dots */}
        <div className="flex justify-center gap-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-amber-400/60 animate-pulse"
              style={{
                animationDelay: `${i * 0.2}s`,
                animationDuration: "1.4s"
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
