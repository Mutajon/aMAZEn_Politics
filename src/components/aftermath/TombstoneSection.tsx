// src/components/aftermath/TombstoneSection.tsx
// Tombstone with haiku overlay
//
// Shows:
// - Tombstone image
// - Haiku text overlaid on the tombstone
//
// Connects to:
// - src/screens/AftermathScreen.tsx: main screen
// - src/hooks/useAftermathSequence.ts: controls visibility

import { motion } from "framer-motion";
import { forwardRef, useEffect } from "react";

type Props = {
  haiku: string;
  visible: boolean;
  skipAnimation: boolean;
  onComplete: () => void;
};

const FADE_DURATION_S = 0.5;

const TombstoneSection = forwardRef<HTMLDivElement, Props>(
  ({ haiku, visible, skipAnimation, onComplete }, ref) => {
    if (!visible) return null;

    // Call onComplete when fade-in finishes or immediately if skipped
    useEffect(() => {
      if (skipAnimation) {
        onComplete();
      } else {
        const timer = setTimeout(() => {
          console.log('[TombstoneSection] Fade-in complete');
          onComplete();
        }, FADE_DURATION_S * 1000);

        return () => clearTimeout(timer);
      }
    }, [skipAnimation, onComplete]);

    const AnimationWrapper = skipAnimation ? "div" : motion.div;
    const animationProps = skipAnimation
      ? {}
      : {
          initial: { opacity: 0, scale: 0.95 },
          animate: { opacity: 1, scale: 1 },
          transition: { duration: FADE_DURATION_S },
        };

    return (
      <AnimationWrapper
        ref={ref as any}
        className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
        {...animationProps}
      >
        <div className="relative max-w-[300px] mx-auto">
          <img
            src="/assets/images/tombStone.png"
            alt="Tombstone"
            className="w-full opacity-80"
          />
          {/* Haiku Overlay */}
          <div className="absolute inset-0 flex items-center justify-center px-12">
            <p
              className="text-gray-700 text-center font-serif italic text-sm whitespace-pre-line max-w-[200px]"
              style={{
                textShadow: "2px 2px 4px rgba(0, 0, 0, 0.8)"
              }}
            >
              {haiku}
            </p>
          </div>
        </div>
      </AnimationWrapper>
    );
  }
);

TombstoneSection.displayName = "TombstoneSection";

export default TombstoneSection;
