// src/components/aftermath/RemembranceSection.tsx
// "You are remembered as" section with portrait, rank, and remembrance text
//
// Shows:
// - Player portrait
// - Rank badge (e.g., "The Gentle Iron Fist")
// - Remembrance text (narrated)
//
// Connects to:
// - src/screens/AftermathScreen.tsx: main screen
// - src/hooks/useAftermathSequence.ts: controls visibility and scrolling
// - src/hooks/useAftermathNarration.ts: narration control

import { motion } from "framer-motion";
import { forwardRef, useEffect } from "react";

type Props = {
  avatarUrl?: string;
  rank: string;
  remembrance: string;
  visible: boolean;
  skipAnimation: boolean;
  onComplete: () => void;
};

const FADE_DURATION_S = 0.5;

const RemembranceSection = forwardRef<HTMLDivElement, Props>(
  ({ avatarUrl, rank, remembrance, visible, skipAnimation, onComplete }, ref) => {
    if (!visible) return null;

    // Call onComplete when fade-in finishes or immediately if skipped
    useEffect(() => {
      if (skipAnimation) {
        onComplete();
      } else {
        const timer = setTimeout(() => {
          console.log('[RemembranceSection] Fade-in complete');
          onComplete();
        }, FADE_DURATION_S * 1000);

        return () => clearTimeout(timer);
      }
    }, [skipAnimation, onComplete]);

    const AnimationWrapper = skipAnimation ? "div" : motion.div;
    const animationProps = skipAnimation
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: FADE_DURATION_S },
        };

    return (
      <AnimationWrapper
        ref={ref as any}
        className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
        {...animationProps}
      >
        <h2 className="text-xl font-bold text-amber-400 mb-4">
          You are remembered as
        </h2>
        <div className="flex gap-6 items-start">
          {/* Left: Portrait + Rank */}
          <div className="flex flex-col items-center gap-3 flex-shrink-0">
            {avatarUrl && (
              <img
                src={avatarUrl}
                alt="Player portrait"
                className="w-[160px] h-[160px] rounded-lg object-cover border border-white/20"
                onError={(e) => {
                  // Hide on error
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <div className="px-3 py-1 rounded-md bg-amber-900/30 border border-amber-500/30">
              <p className="text-amber-300 text-sm font-semibold text-center">
                {rank}
              </p>
            </div>
          </div>

          {/* Right: Remembrance Text */}
          <p className="text-white/90 text-base leading-relaxed whitespace-pre-wrap flex-1">
            {remembrance}
          </p>
        </div>
      </AnimationWrapper>
    );
  }
);

RemembranceSection.displayName = "RemembranceSection";

export default RemembranceSection;
