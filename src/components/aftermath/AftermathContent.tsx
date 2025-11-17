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
import IntroSection from "./IntroSection";
import SnapshotSection from "./SnapshotSection";
import FinalScoresSection from "./FinalScoresSection";
import DecisionBreakdownSection from "./DecisionBreakdownSection";
import ReflectionSection from "./ReflectionSection";
import TombstoneSection from "./TombstoneSection";
import { useLogger } from "../../hooks/useLogger";

type TopValue = {
  short: string;
};

type Props = {
  data: AftermathResponse;
  avatarUrl?: string;
  top3ByDimension: Record<PropKey, TopValue[]>;
  onRevealScoreClick: () => void;
};

export default function AftermathContent({
  data,
  avatarUrl,
  top3ByDimension,
  onRevealScoreClick,
}: Props) {
  const logger = useLogger();

  // Log when snapshot pills are displayed
  useEffect(() => {
    if (data.snapshot && data.snapshot.length > 0) {
      logger.logSystem(
        "snapshot_pills_displayed",
        { count: data.snapshot.length },
        `Snapshot pills displayed: ${data.snapshot.length} events`
      );
    }
  }, [data.snapshot, logger]);

  // Log when final scores are displayed
  useEffect(() => {
    if (data.ratings) {
      logger.logSystem(
        "final_scores_displayed",
        {
          democracy: data.ratings.democracy,
          autonomy: data.ratings.autonomy,
          liberalism: data.ratings.liberalism
        },
        `Final scores displayed: D=${data.ratings.democracy}, A=${data.ratings.autonomy}, L=${data.ratings.liberalism}`
      );
    }
  }, [data.ratings, logger]);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Intro Section - Just title */}
      <IntroSection />

      {/* Snapshot Section - Avatar + death text + event pills */}
      <SnapshotSection
        intro={data.intro}
        snapshot={data.snapshot}
        avatarUrl={avatarUrl}
        legacy={data.legacy}
      />

      {/* Final Scores Section - Democracy/Autonomy/Liberalism pills */}
      <FinalScoresSection ratings={data.ratings} />

      {/* Decision Breakdown Section - Collapsible */}
      <DecisionBreakdownSection decisions={data.decisions} />

      {/* Reflection Section */}
      <ReflectionSection
        top3ByDimension={top3ByDimension}
        valuesSummary={data.valuesSummary}
      />

      {/* Tombstone Section */}
      <TombstoneSection haiku={data.haiku} />

      {/* Reveal Final Score Button */}
      <div className="pt-4">
        <button
          onClick={onRevealScoreClick}
          className="w-full px-6 py-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-lg font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-amber-500/50"
        >
          Reveal final score
        </button>
      </div>
    </div>
  );
}
