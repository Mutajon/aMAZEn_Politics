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
import { useSettingsStore } from "../store/settingsStore";
import {
  calculateSupportScore,
  calculateBudgetScore,
  calculateIdeologyScore,
  calculateGoalsScore,
  calculateBonusScore,
  calculateDifficultyScore,
  calculateFinalScore,
  type AftermathRating,
  type ScoreBreakdown,
} from "../lib/scoring";

type UseScoreCalculationProps = {
  liberalismRating?: AftermathRating;
  autonomyRating?: AftermathRating;
};

/**
 * Calculate complete score breakdown from game state
 *
 * @param liberalismRating - Liberalism rating from aftermath AI analysis
 * @param autonomyRating - Autonomy rating from aftermath AI analysis
 * @returns Complete score breakdown with all categories
 */
export function useScoreCalculation({
  liberalismRating = "medium",
  autonomyRating = "medium",
}: UseScoreCalculationProps): ScoreBreakdown {
  // Read game state from store
  const supportPeople = useDilemmaStore((s) => s.supportPeople);
  const supportMiddle = useDilemmaStore((s) => s.supportMiddle);
  const supportMom = useDilemmaStore((s) => s.supportMom);
  const budget = useDilemmaStore((s) => s.budget);
  const difficulty = useDilemmaStore((s) => s.difficulty);
  const selectedGoals = useDilemmaStore((s) => s.selectedGoals);
  const showBudget = useSettingsStore((s) => s.showBudget);

  // Calculate all score categories (memoized for performance)
  const breakdown = useMemo<ScoreBreakdown>(() => {
    // Calculate each category
    const support = calculateSupportScore(supportPeople, supportMiddle, supportMom);
    // Only calculate budget score if budget system is enabled
    const budgetScore = showBudget
      ? calculateBudgetScore(budget)
      : { budgetAmount: budget, points: 0 };
    const ideology = calculateIdeologyScore(liberalismRating, autonomyRating);
    const goals = calculateGoalsScore(selectedGoals);
    const bonus = calculateBonusScore();
    const difficultyScore = calculateDifficultyScore(difficulty);

    // Build partial breakdown for final calculation
    const partial: ScoreBreakdown = {
      support,
      budget: budgetScore,
      ideology,
      goals,
      bonus,
      difficulty: difficultyScore,
      final: 0, // Calculate below
    };

    // Calculate final score
    partial.final = calculateFinalScore(partial);

    return partial;
  }, [supportPeople, supportMiddle, supportMom, budget, liberalismRating, autonomyRating, difficulty, selectedGoals, showBudget]);

  return breakdown;
}
