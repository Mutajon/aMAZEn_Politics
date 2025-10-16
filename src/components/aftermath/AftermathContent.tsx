// src/components/aftermath/AftermathContent.tsx
// Main content component that orchestrates all aftermath sections with counter-based sequencing
//
// Manages:
// - Section visibility based on counter
// - Narration triggering for remembrance
// - onComplete callbacks to advance counter
// - Skip button display
//
// Connects to:
// - src/screens/AftermathScreen.tsx: main screen
// - src/hooks/useAftermathSequence.ts: counter control
// - src/hooks/useAftermathNarration.ts: narration control
// - All section components

import { useEffect } from "react";
import type { AftermathResponse } from "../../lib/aftermath";
import type { PropKey } from "../../data/compass-data";
import { useAftermathNarration } from "../../hooks/useAftermathNarration";
import { FastForward } from "lucide-react";
import IntroSection from "./IntroSection";
import RemembranceSection from "./RemembranceSection";
import DecisionBreakdownSection from "./DecisionBreakdownSection";
import ReflectionSection from "./ReflectionSection";
import TombstoneSection from "./TombstoneSection";

type TopValue = {
  short: string;
};

type Props = {
  data: AftermathResponse;
  avatarUrl?: string;
  top3ByDimension: Record<PropKey, TopValue[]>;
  counter: number;
  steps: {
    intro: number;
    remembrance: number;
    narration: number;
    decisionsStart: number;
    ratingsStep: number;
    reflectionStep: number;
    tombstoneStep: number;
    completeStep: number;
  };
  isSkipped: boolean;
  hasReached: (step: number) => boolean;
  isAtStep: (step: number) => boolean;
  advanceToNext: () => void;
  skipToEnd: () => void;
  showSkipButton: boolean;
  registerRef: (key: string, element: HTMLElement | null) => void;
  onExploreClick: () => void;
  onRevealScoreClick: () => void;
};

export default function AftermathContent({
  data,
  avatarUrl,
  top3ByDimension,
  counter,
  steps,
  isSkipped,
  hasReached,
  isAtStep,
  advanceToNext,
  skipToEnd,
  showSkipButton,
  registerRef,
  onExploreClick,
  onRevealScoreClick,
}: Props) {
  // Narration hook
  const { startNarration, stopNarration } = useAftermathNarration(data.remembrance);

  // Handle narration step specially
  useEffect(() => {
    if (isAtStep(steps.narration) && !isSkipped) {
      console.log('[AftermathContent] Starting narration...');
      startNarration(() => {
        console.log('[AftermathContent] Narration completed, advancing');
        advanceToNext();
      });
    }
  }, [isAtStep, steps.narration, isSkipped, startNarration, advanceToNext]);

  // Stop narration if skipped
  useEffect(() => {
    if (isSkipped) {
      stopNarration();
    }
  }, [isSkipped, stopNarration]);

  // Calculate which decision is currently being shown
  const getCurrentDecisionIndex = (): number => {
    if (isSkipped) return data.decisions.length - 1;

    // Counter is in the decisions range
    if (counter >= steps.decisionsStart && counter < steps.ratingsStep) {
      return counter - steps.decisionsStart;
    }

    // If we've reached ratings or beyond, show all decisions
    if (counter >= steps.ratingsStep) {
      return data.decisions.length - 1;
    }

    return -1; // None visible yet
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Skip Button */}
      {showSkipButton && (
        <button
          onClick={skipToEnd}
          className="fixed top-4 right-4 z-50 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-lg"
        >
          <FastForward className="w-4 h-4" />
          <span>Skip</span>
        </button>
      )}

      {/* Intro Section */}
      {hasReached(steps.intro) && (
        <IntroSection
          intro={data.intro}
          skipTypewriter={isSkipped}
          onComplete={advanceToNext}
        />
      )}

      {/* Remembrance Section */}
      {hasReached(steps.remembrance) && (
        <RemembranceSection
          ref={(el) => registerRef("remembrance", el)}
          avatarUrl={avatarUrl}
          rank={data.rank}
          remembrance={data.remembrance}
          visible={true}
          skipAnimation={isSkipped}
          onComplete={advanceToNext}
        />
      )}

      {/* Decision Breakdown Section */}
      {hasReached(steps.decisionsStart) && (
        <DecisionBreakdownSection
          ref={(el) => registerRef("decisions", el)}
          decisions={data.decisions}
          ratings={data.ratings}
          currentDecisionIndex={getCurrentDecisionIndex()}
          showFinalRatings={hasReached(steps.ratingsStep)}
          skipAnimation={isSkipped}
          onComplete={advanceToNext}
        />
      )}

      {/* Reflection Section */}
      {hasReached(steps.reflectionStep) && (
        <ReflectionSection
          ref={(el) => registerRef("reflection", el)}
          top3ByDimension={top3ByDimension}
          valuesSummary={data.valuesSummary}
          visible={true}
          skipAnimation={isSkipped}
          onExploreClick={onExploreClick}
          onComplete={advanceToNext}
        />
      )}

      {/* Tombstone Section */}
      {hasReached(steps.tombstoneStep) && (
        <TombstoneSection
          ref={(el) => registerRef("tombstone", el)}
          haiku={data.haiku}
          visible={true}
          skipAnimation={isSkipped}
          onComplete={advanceToNext}
        />
      )}

      {/* Reveal Final Score Button */}
      {hasReached(steps.completeStep) && (
        <div className="pt-4">
          <button
            onClick={onRevealScoreClick}
            className="w-full px-6 py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-amber-500/50"
          >
            Reveal final score
          </button>
        </div>
      )}
    </div>
  );
}
