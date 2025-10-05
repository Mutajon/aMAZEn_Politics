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
  day: number;
  totalDays: number;
  progress?: number; // 0-100 collection progress percentage
  message?: string;
};

export default function CollectorLoadingOverlay({
  day,
  totalDays,
  progress = 0,
  message = "Loading dilemma..."
}: Props) {
  const daysLeft = totalDays - day + 1;
  const daysProgressPercent = (daysLeft / totalDays) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center" style={bgStyle}>
      <div className="text-center">
        {/* Spinning Hourglass */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <Hourglass
              className="w-16 h-16 text-white/80 animate-spin"
              style={{ animationDuration: "2s" }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-transparent animate-pulse" />
          </div>
        </div>

        {/* Loading Message */}
        <p className="text-white/90 text-lg font-medium mb-2">
          {message}
        </p>

        {/* Collection Progress Percentage */}
        <div className="mb-8">
          <p className="text-5xl font-bold text-white/95 tabular-nums">
            {Math.round(progress)}%
          </p>
          <p className="text-sm text-white/50 mt-1">Collection Progress</p>
        </div>

        {/* Days Left Bar */}
        <div className="w-64 mx-auto">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-white/60">Days Remaining</span>
            <span className="text-sm font-bold text-white/90">{daysLeft}/{totalDays}</span>
          </div>

          {/* Progress Bar Container - Shows days progression */}
          <div className="relative h-3 bg-white/10 rounded-full overflow-hidden border border-white/20">
            {/* Fill */}
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500 ease-out"
              style={{ width: `${daysProgressPercent}%` }}
            />

            {/* Shimmer effect */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
              style={{
                backgroundSize: "200% 100%",
                animation: "shimmer 2s infinite"
              }}
            />
          </div>

          {/* Day Markers */}
          <div className="flex justify-between mt-1">
            {Array.from({ length: totalDays }, (_, i) => {
              const dayNum = i + 1;
              const isPast = dayNum < day;
              const isCurrent = dayNum === day;

              return (
                <div
                  key={dayNum}
                  className={`
                    w-1 h-1 rounded-full transition-all duration-300
                    ${isPast ? 'bg-white/20' :
                      isCurrent ? 'bg-purple-400 scale-150' :
                      'bg-white/40'}
                  `}
                />
              );
            })}
          </div>
        </div>

        {/* Pulsing dots */}
        <div className="flex justify-center gap-1 mt-6">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-white/60 animate-pulse"
              style={{
                animationDelay: `${i * 0.2}s`,
                animationDuration: "1.4s"
              }}
            />
          ))}
        </div>
      </div>

      {/* Shimmer keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}
