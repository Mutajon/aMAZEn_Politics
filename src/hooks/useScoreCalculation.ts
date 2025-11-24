// src/hooks/useScoreCalculation.ts
// Custom hook for calculating comprehensive score breakdown
//
// Reads game state from stores and applies scoring formulas from scoring.ts
// Returns complete ScoreBreakdown object with all categories calculated
//
// Connected to:
// - src/lib/scoring.ts: Score formulas and types
// - src/store/dilemmaStore.ts: Reads support, budget, difficulty
// - src/screens/FinalScoreScreen.tsx: Uses this hook to display scores

import { useMemo } from "react";
import { useDilemmaStore } from "../store/dilemmaStore";
import {
  calculateLiveScoreBreakdown,
  calculateFinalScore,
  type ScoreBreakdown,
} from "../lib/scoring";

/**
 * Calculate live score breakdown from current store values.
 * Returns memoized ScoreBreakdown used by FinalScoreScreen.
 */
export function useScoreCalculation(): ScoreBreakdown {
  const supportPeople = useDilemmaStore((s) => s.supportPeople);
  const supportMiddle = useDilemmaStore((s) => s.supportMiddle);
  const supportMom = useDilemmaStore((s) => s.supportMom);

  return useMemo(() => {
    const breakdown = calculateLiveScoreBreakdown({
      supportPeople,
      supportMiddle,
      supportMom,
    });

    // ensure final is normalized (guards against numeric drift)
    breakdown.final = calculateFinalScore(breakdown);
    return breakdown;
  }, [supportPeople, supportMiddle, supportMom]);
}
