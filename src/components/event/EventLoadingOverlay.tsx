// src/components/event/EventLoadingOverlay.tsx
// Enhanced loading overlay for day progression with multi-phase states.
// Shows rotating hourglass, days remaining bar, and analysis progress.

import React, { useMemo } from "react";
import { Hourglass } from "lucide-react";
import { motion } from "framer-motion";
import { bgStyleWithRoleImage } from "../../lib/ui";
import { useRoleStore } from "../../store/roleStore";

type Props = {
  show?: boolean; // when true, blocks the UI
  showDayProgression?: boolean; // when true, shows day progression UI
  currentDay?: number;
  totalDays?: number;
  isAnimatingCounter?: boolean;
  analysisComplete?: {
    support: boolean;
    compass: boolean;
    dynamic: boolean;
    mirror: boolean;
    news: boolean;
    contextualDilemma: boolean;
  };
};

export default function EventLoadingOverlay({
  show = false,
  showDayProgression = false,
  currentDay = 1,
  totalDays = 30,
  isAnimatingCounter = false,
  analysisComplete
}: Props) {
  const roleBackgroundImage = useRoleStore((s) => s.roleBackgroundImage);
  const roleBgStyle = useMemo(() => bgStyleWithRoleImage(roleBackgroundImage), [roleBackgroundImage]);

  if (!show) return null;

  // Calculate progress for day progression
  const daysRemaining = totalDays - currentDay;
  const daysProgress = ((totalDays - daysRemaining) / totalDays) * 100;

  // Count completed analyses
  const completedAnalyses = analysisComplete
    ? Object.values(analysisComplete).filter(Boolean).length
    : 0;
  const totalAnalyses = 6;
  const analysisProgress = Math.round((completedAnalyses / totalAnalyses) * 100);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[998] flex items-center justify-center"
      style={roleBgStyle}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 22 }}
        className="flex flex-col items-center gap-6 rounded-2xl border-slate-700/50 bg-black/60 backdrop-blur-sm ring-1 ring-amber-400/40 p-8 shadow-xl max-w-sm w-80"
      >
        {showDayProgression ? (
          <>
            {/* Rotating hourglass at top */}
            <div className="p-4 rounded-full bg-purple-700 ring-1 ring-white/20">
              <Hourglass className="h-10 w-10 animate-spin text-yellow-400" aria-hidden="true" />
            </div>

            {/* Light blue loading bar for days remaining */}
            <div className="w-full space-y-2">
              <div className="w-full bg-neutral-700/50 rounded-full h-2">
                <motion.div
                  className="bg-gradient-to-r from-sky-400 to-sky-300 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${daysProgress}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Days left text */}
            <p className="text-sm text-white/85 -mt-2">
              Days left: {daysRemaining}
            </p>

            {/* Analysis progress with percentage counter */}
            {analysisComplete && (
              <div className="text-center space-y-1">
                <p className="text-sm text-white/70">Analyzing situation</p>
                <p className="text-lg font-mono text-white/90">{analysisProgress}%</p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Default loading state */}
            <div className="p-4 rounded-full bg-purple-700 ring-1 ring-white/20">
              <Hourglass className="h-10 w-10 animate-spin text-yellow-400" aria-hidden="true" />
            </div>
            <p className="text-sm text-white/85">time is passing</p>
          </>
        )}
      </motion.div>
    </div>
  );
}
