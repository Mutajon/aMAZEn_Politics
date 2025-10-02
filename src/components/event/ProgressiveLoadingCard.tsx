// src/components/event/ProgressiveLoadingCard.tsx
// Small floating loading card that moves down the screen as content is progressively revealed
// Replaces the full-screen overlay with a compact, unobtrusive loading indicator

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hourglass } from "lucide-react";
import type { ProgressiveStage } from "../../hooks/useProgressiveLoading";

interface ProgressiveLoadingCardProps {
  show: boolean;
  currentStage: ProgressiveStage;
  position: number; // Y position from top in pixels
  currentDay?: number;
  totalDays?: number;
}

// Stage descriptions for user feedback
const stageMessages: Record<ProgressiveStage, string> = {
  hidden: "",
  support: "Analyzing support changes...",
  news: "Updating news ticker...",
  parameters: "Calculating consequences...",
  dilemma: "Generating new dilemma...",
  mirror: "Updating political compass...",
  actions: "Preparing action cards...",
  complete: "Analysis complete"
};

export default function ProgressiveLoadingCard({
  show,
  currentStage,
  position,
  currentDay = 1,
  totalDays = 7
}: ProgressiveLoadingCardProps) {
  if (!show) return null;

  const daysLeft = totalDays - currentDay + 1;
  const progressPercentage = Math.round(((currentDay - 1) / totalDays) * 100);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: position - 20, scale: 0.95 }}
          animate={{
            opacity: 1,
            y: position,
            scale: 1,
            transition: {
              duration: 0.4,
              ease: "easeOut"
            }
          }}
          exit={{
            opacity: 0,
            scale: 0.95,
            transition: { duration: 0.3 }
          }}
          className="fixed left-1/2 transform -translate-x-1/2 z-50"
          style={{ top: `${position}px` }}
        >
          {/* Small compact card */}
          <div className="bg-black/90 backdrop-blur-md rounded-2xl border border-white/20 px-4 py-3 shadow-2xl">
            <div className="flex items-center space-x-3">
              {/* Rotating hourglass */}
              <motion.div
                animate={{
                  rotate: 360,
                  transition: {
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear"
                  }
                }}
                className="flex-shrink-0"
              >
                <Hourglass
                  className="w-4 h-4 text-blue-400"
                  strokeWidth={2.5}
                />
              </motion.div>

              {/* Content */}
              <div className="flex flex-col min-w-0">
                {/* Days remaining bar */}
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-xs text-white/70 font-medium">
                    Days left: {daysLeft}
                  </span>
                  <div className="flex-1 bg-white/20 rounded-full h-1.5 min-w-16">
                    <motion.div
                      className="bg-gradient-to-r from-blue-400 to-purple-400 h-full rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: `${progressPercentage}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>

                {/* Stage message */}
                <motion.p
                  key={currentStage}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-white font-medium truncate"
                >
                  {stageMessages[currentStage]}
                </motion.p>
              </div>
            </div>

            {/* Subtle glow effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 -z-10 blur-xl opacity-50" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}