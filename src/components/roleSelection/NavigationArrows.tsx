// src/components/roleSelection/NavigationArrows.tsx
// Navigation arrows for role carousel
//
// Features:
// - Left/right arrows for carousel navigation
// - Continuous ping-pong scale animation (0.95 ↔ 1.05, 2s loop)
// - Hover state (scale 1.1, pauses ping-pong)
// - Disabled state when at bounds
// - Amber gradient styling

import { motion } from "framer-motion";
import { audioManager } from "../../lib/audioManager";

interface NavigationArrowsProps {
  onPrev: () => void;
  onNext: () => void;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
}

export default function NavigationArrows({
  onPrev,
  onNext,
  canNavigatePrev,
  canNavigateNext,
}: NavigationArrowsProps) {
  return (
    <>
      {/* Left Arrow */}
      <motion.button
        onClick={() => {
          audioManager.playSfx('role-switch');
          onPrev();
        }}
        disabled={!canNavigatePrev}
        className={`
          fixed left-4 md:left-8 top-[35%] -translate-y-1/2 z-30
          w-14 h-14 md:w-16 md:h-16
          rounded-full
          flex items-center justify-center
          transition-all duration-300
          ${
            canNavigatePrev
              ? 'bg-gradient-to-br from-amber-500/40 to-amber-600/40 hover:from-amber-400/60 hover:to-amber-500/60 backdrop-blur-sm border border-amber-400/50 cursor-pointer'
              : 'bg-gray-800/20 backdrop-blur-sm border border-gray-600/30 cursor-not-allowed opacity-40'
          }
        `}
        whileHover={canNavigatePrev ? { scale: 1.1 } : {}}
        whileTap={canNavigatePrev ? { scale: 0.95 } : {}}
        animate={
          canNavigatePrev
            ? {
                scale: [0.95, 1.05, 0.95],
              }
            : {}
        }
        transition={
          canNavigatePrev
            ? {
                scale: {
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                },
              }
            : {}
        }
        aria-label="Previous role"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          stroke="currentColor"
          className={`w-7 h-7 md:w-8 md:h-8 ${
            canNavigatePrev ? 'text-amber-200' : 'text-gray-500'
          }`}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5L8.25 12l7.5-7.5"
          />
        </svg>
      </motion.button>

      {/* Right Arrow */}
      <motion.button
        onClick={() => {
          audioManager.playSfx('role-switch');
          onNext();
        }}
        disabled={!canNavigateNext}
        className={`
          fixed right-4 md:right-8 top-[35%] -translate-y-1/2 z-30
          w-14 h-14 md:w-16 md:h-16
          rounded-full
          flex items-center justify-center
          transition-all duration-300
          ${
            canNavigateNext
              ? 'bg-gradient-to-br from-amber-500/40 to-amber-600/40 hover:from-amber-400/60 hover:to-amber-500/60 backdrop-blur-sm border border-amber-400/50 cursor-pointer'
              : 'bg-gray-800/20 backdrop-blur-sm border border-gray-600/30 cursor-not-allowed opacity-40'
          }
        `}
        whileHover={canNavigateNext ? { scale: 1.1 } : {}}
        whileTap={canNavigateNext ? { scale: 0.95 } : {}}
        animate={
          canNavigateNext
            ? {
                scale: [0.95, 1.05, 0.95],
              }
            : {}
        }
        transition={
          canNavigateNext
            ? {
                scale: {
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                },
              }
            : {}
        }
        aria-label="Next role"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          stroke="currentColor"
          className={`w-7 h-7 md:w-8 md:h-8 ${
            canNavigateNext ? 'text-amber-200' : 'text-gray-500'
          }`}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 4.5l7.5 7.5-7.5 7.5"
          />
        </svg>
      </motion.button>
    </>
  );
}
