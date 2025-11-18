// src/components/roleSelection/PositionIndicator.tsx
// Position indicator for role carousel
//
// Shows:
// - Current position / total count (e.g., "3 / 12")
// - Dot navigation with current position highlighted

import { motion } from "framer-motion";

interface PositionIndicatorProps {
  currentIndex: number;
  totalCount: number;
  onNavigateToIndex?: (index: number) => void;
}

export default function PositionIndicator({
  currentIndex,
  totalCount,
  onNavigateToIndex,
}: PositionIndicatorProps) {
  return (
    <div className="fixed top-5 sm:top-6 md:top-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3">
      {/* Counter */}
      <div className="bg-black/40 backdrop-blur-sm border border-amber-400/30 rounded-full px-5 py-2">
        <p className="text-amber-200 font-semibold text-sm md:text-base">
          <span className="text-amber-400 text-lg md:text-xl">{currentIndex + 1}</span>
          <span className="text-amber-300/60 mx-1.5">/</span>
          <span className="text-amber-300/80">{totalCount}</span>
        </p>
      </div>

      {/* Dot Navigation */}
      {totalCount <= 15 && (
        <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm border border-amber-400/20 rounded-full px-4 py-2">
          {Array.from({ length: totalCount }).map((_, index) => {
            const isCurrent = index === currentIndex;
            return (
              <motion.button
                key={index}
                onClick={() => onNavigateToIndex?.(index)}
                className={`
                  w-2 h-2 rounded-full transition-all duration-300
                  ${isCurrent ? 'bg-amber-400 w-3 h-3' : 'bg-amber-300/30 hover:bg-amber-300/50'}
                `}
                whileHover={{ scale: 1.3 }}
                whileTap={{ scale: 0.9 }}
                aria-label={`Go to item ${index + 1}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
