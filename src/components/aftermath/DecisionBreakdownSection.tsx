// src/components/aftermath/DecisionBreakdownSection.tsx
// Decision breakdown with sequential reveal of each decision and its analysis
//
// Shows:
// - Each decision (title + reflection) appearing one by one
// - Final Liberalism/Autonomy rating pills after all decisions
//
// Connects to:
// - src/screens/AftermathScreen.tsx: main screen
// - src/hooks/useAftermathSequence.ts: controls which decisions are visible

import { motion } from "framer-motion";
import { forwardRef, useEffect } from "react";
import type { DecisionAnalysis } from "../../lib/aftermath";
import { useLang } from "../../i18n/lang";

type Props = {
  decisions: DecisionAnalysis[];
  ratings: {
    autonomy: "very-low" | "low" | "medium" | "high" | "very-high";
    liberalism: "very-low" | "low" | "medium" | "high" | "very-high";
  };
  currentDecisionIndex: number; // -1 means none visible, decisions.length means show ratings
  showFinalRatings: boolean;
  skipAnimation: boolean;
  onComplete: () => void;
};

const DECISION_DURATION_S = 0.6;
const RATINGS_DURATION_S = 0.5;

/** Get color for rating level */
function getRatingColor(level: string): string {
  switch (level) {
    case "very-high": return "#10b981"; // green
    case "high": return "#84cc16"; // light green
    case "medium": return "#eab308"; // yellow
    case "low": return "#f97316"; // orange
    case "very-low": return "#ef4444"; // red
    default: return "#6b7280"; // gray
  }
}

/** Format rating text with translation support */
function formatRating(level: string, lang: (key: string) => string): string {
  const keyMap: Record<string, string> = {
    "very-high": "DEMOCRACY_LEVEL_VERY_HIGH",
    "high": "DEMOCRACY_LEVEL_HIGH",
    "medium": "DEMOCRACY_LEVEL_MEDIUM",
    "low": "DEMOCRACY_LEVEL_LOW",
    "very-low": "DEMOCRACY_LEVEL_VERY_LOW",
  };
  
  const key = keyMap[level];
  if (key) {
    return lang(key);
  }
  
  // Fallback to capitalization
  return level
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const DecisionBreakdownSection = forwardRef<HTMLDivElement, Props>(
  ({ decisions, ratings, currentDecisionIndex, showFinalRatings, skipAnimation, onComplete }, ref) => {
    const lang = useLang();
    
    // Call onComplete when animation finishes after a decision or ratings appear
    useEffect(() => {
      if (skipAnimation) {
        // If skipped, don't call onComplete here (parent handles it)
        return;
      }

      // If ratings are showing, wait for ratings animation to complete
      if (showFinalRatings) {
        const timer = setTimeout(() => {
          console.log('[DecisionBreakdownSection] Ratings animation complete');
          onComplete();
        }, RATINGS_DURATION_S * 1000);
        return () => clearTimeout(timer);
      }

      // If a decision is visible, wait for decision animation to complete
      if (currentDecisionIndex >= 0) {
        const timer = setTimeout(() => {
          console.log('[DecisionBreakdownSection] Decision', currentDecisionIndex, 'animation complete');
          onComplete();
        }, DECISION_DURATION_S * 1000);
        return () => clearTimeout(timer);
      }
    }, [currentDecisionIndex, showFinalRatings, skipAnimation, onComplete]);

    const AnimationWrapper = skipAnimation ? "div" : motion.div;

    return (
      <>
        {/* Decision Breakdown Section */}
        <div
          ref={ref}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
        >
          <h2 className="text-xl font-bold text-amber-400 mb-4">
            Decision breakdown
          </h2>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {decisions.map((decision, i) => {
              const isVisible = skipAnimation || i <= currentDecisionIndex;
              if (!isVisible) return null;

              const animationProps = skipAnimation
                ? {}
                : {
                    initial: { opacity: 0, y: 10 },
                    animate: { opacity: 1, y: 0 },
                    transition: { duration: 0.4 },
                  };

              return (
                <AnimationWrapper
                  key={i}
                  className="border-b border-white/5 last:border-b-0 pb-3 last:pb-0"
                  {...animationProps}
                >
                  <p className="text-white/95 font-semibold mb-1">
                    {decision.title}
                  </p>
                  <p className="text-white/70 text-sm">
                    {decision.reflection}
                  </p>
                </AnimationWrapper>
              );
            })}
          </div>
        </div>

        {/* Rating Pills Section - appears after all decisions */}
        {showFinalRatings && (
          <AnimationWrapper
            className="flex gap-4 justify-center"
            {...(skipAnimation
              ? {}
              : {
                  initial: { opacity: 0, scale: 0.9 },
                  animate: { opacity: 1, scale: 1 },
                  transition: { duration: 0.5 },
                })}
          >
            {/* Liberalism Pill */}
            <div
              className="px-4 py-2 rounded-lg font-semibold uppercase text-sm tracking-wide"
              style={{
                backgroundColor: `${getRatingColor(ratings.liberalism)}20`,
                borderColor: getRatingColor(ratings.liberalism),
                borderWidth: "1px",
                color: getRatingColor(ratings.liberalism)
              }}
            >
              {lang("LIBERALISM")}: {formatRating(ratings.liberalism, lang)}
            </div>

            {/* Autonomy Pill */}
            <div
              className="px-4 py-2 rounded-lg font-semibold uppercase text-sm tracking-wide"
              style={{
                backgroundColor: `${getRatingColor(ratings.autonomy)}20`,
                borderColor: getRatingColor(ratings.autonomy),
                borderWidth: "1px",
                color: getRatingColor(ratings.autonomy)
              }}
            >
              {lang("AUTONOMY")}: {formatRating(ratings.autonomy, lang)}
            </div>
          </AnimationWrapper>
        )}
      </>
    );
  }
);

DecisionBreakdownSection.displayName = "DecisionBreakdownSection";

export default DecisionBreakdownSection;
