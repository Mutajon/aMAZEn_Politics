// src/components/event/DayCounterAnimation.tsx
// Rotating day counter animation for day progression

import { motion } from "framer-motion";

interface DayCounterAnimationProps {
  currentDay: number;
  targetDay: number;
  isAnimating: boolean;
  totalDays: number;
}

export default function DayCounterAnimation({
  currentDay,
  targetDay,
  isAnimating,
  totalDays
}: DayCounterAnimationProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      {/* Main day counter */}
      <div className="relative">
        {/* Background circle */}
        <div className="w-32 h-32 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center">
          {/* Animated day number */}
          <motion.div
            className="text-6xl font-bold text-white"
            animate={isAnimating ? {
              rotateY: [0, 180, 360],
              scale: [1, 0.8, 1],
            } : {}}
            transition={{
              duration: 2,
              ease: [0.25, 0.46, 0.45, 0.94], // easeOutQuart
              times: [0, 0.5, 1]
            }}
          >
            {isAnimating ? (
              <motion.span
                key={targetDay}
                initial={{ opacity: 0, rotateY: 180 }}
                animate={{ opacity: 1, rotateY: 0 }}
                transition={{ duration: 1, delay: 1 }}
              >
                {targetDay}
              </motion.span>
            ) : (
              currentDay
            )}
          </motion.div>
        </div>

        {/* Rotating ring indicator */}
        {isAnimating && (
          <motion.div
            className="absolute inset-0 w-32 h-32 rounded-full border-4 border-transparent border-t-amber-400"
            animate={{ rotate: 360 }}
            transition={{
              duration: 2,
              ease: "linear",
              repeat: 0
            }}
          />
        )}
      </div>

      {/* Day label and progress */}
      <div className="mt-4 text-center">
        <motion.p
          className="text-xl font-semibold text-white/90 mb-2"
          animate={isAnimating ? { opacity: [1, 0.5, 1] } : {}}
          transition={{ duration: 2 }}
        >
          Day {isAnimating ? targetDay : currentDay}
        </motion.p>

        {/* Progress bar */}
        <div className="w-48 h-2 bg-white/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full"
            initial={{ width: `${(currentDay / totalDays) * 100}%` }}
            animate={{ width: `${(targetDay / totalDays) * 100}%` }}
            transition={{ duration: 2, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        </div>

        <p className="text-sm text-white/70 mt-2">
          {totalDays - targetDay} days remaining
        </p>
      </div>
    </div>
  );
}
