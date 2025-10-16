// src/lib/goalEvaluation.ts
// Goal evaluation engine - evaluates goals and builds evaluation state
//
// Responsibilities:
// - Build evaluation state from current game state
// - Evaluate individual goals using their evaluate functions
// - Provide display helpers for goal status
//
// Connected to:
// - src/data/goals.ts: Goal definitions and types
// - src/store/dilemmaStore.ts: Reads game state for evaluation
// - src/components/event/GoalsPanel.tsx: Uses status display helpers

import type { Goal, GoalStatus, GoalEvaluationState, SelectedGoal } from "../data/goals";
import { useDilemmaStore } from "../store/dilemmaStore";

// ========================================================================
// EVALUATION STATE BUILDER
// ========================================================================

/**
 * Build evaluation state from current game state
 * Called before evaluating goals
 */
export function buildEvaluationState(): GoalEvaluationState {
  const state = useDilemmaStore.getState();

  return {
    // Current values
    day: state.day,
    totalDays: state.totalDays,
    budget: state.budget,
    supportPeople: state.supportPeople,
    supportMiddle: state.supportMiddle,
    supportMom: state.supportMom,
    customActionCount: state.customActionCount,

    // Minimum tracking (for continuous goals)
    minBudget: state.minBudget,
    minSupportPeople: state.minSupportPeople,
    minSupportMiddle: state.minSupportMiddle,
    minSupportMom: state.minSupportMom,

    // Context
    difficulty: state.difficulty,
    isGameComplete: state.day > state.totalDays,
  };
}

// ========================================================================
// EVALUATION FUNCTIONS
// ========================================================================

/**
 * Evaluate a single goal
 * @param goal Goal to evaluate
 * @param state Current evaluation state
 * @returns Goal status (met, unmet, failed)
 */
export function evaluateGoal(goal: Goal, state: GoalEvaluationState): GoalStatus {
  try {
    return goal.evaluate(state);
  } catch (error) {
    console.error(`[GoalEvaluation] Error evaluating goal ${goal.id}:`, error);
    return 'unmet'; // Default to unmet on error
  }
}

/**
 * Evaluate all selected goals and update their status
 * @param goals Array of selected goals
 * @returns Updated goals with new status
 */
export function evaluateAllGoals(goals: SelectedGoal[]): SelectedGoal[] {
  const state = buildEvaluationState();

  return goals.map(goal => ({
    ...goal,
    status: evaluateGoal(goal, state),
    lastEvaluatedDay: state.day,
  }));
}

// ========================================================================
// DISPLAY HELPERS
// ========================================================================

/**
 * Get display info for a goal status
 * @param status Goal status
 * @returns Display information (icon, color, label)
 */
export function getStatusDisplay(status: GoalStatus): {
  icon: string;
  color: string;
  label: string;
} {
  switch (status) {
    case 'met':
      return {
        icon: '✅',
        color: 'text-green-400',
        label: 'Completed',
      };
    case 'failed':
      return {
        icon: '❌',
        color: 'text-red-400',
        label: 'Failed',
      };
    case 'unmet':
    default:
      return {
        icon: '⏳',
        color: 'text-yellow-400',
        label: 'In Progress',
      };
  }
}

/**
 * Get border color class for goal status
 * @param status Goal status
 * @returns Tailwind border color class
 */
export function getStatusBorderColor(status: GoalStatus): string {
  switch (status) {
    case 'met':
      return 'border-green-400/50';
    case 'failed':
      return 'border-red-400/50';
    case 'unmet':
    default:
      return 'border-yellow-400/30';
  }
}

/**
 * Get background color class for goal status
 * @param status Goal status
 * @returns Tailwind background color class
 */
export function getStatusBgColor(status: GoalStatus): string {
  switch (status) {
    case 'met':
      return 'bg-green-500/10';
    case 'failed':
      return 'bg-red-500/10';
    case 'unmet':
    default:
      return 'bg-yellow-500/5';
  }
}

/**
 * Check if player is at risk of failing a goal
 * Returns true if within 10% of failure threshold
 * @param goal Selected goal
 * @param state Current evaluation state
 * @returns True if at risk
 */
export function isGoalAtRisk(goal: SelectedGoal, state: GoalEvaluationState): boolean {
  // Already failed or met
  if (goal.status === 'failed' || goal.status === 'met') return false;

  // Check specific goal types for "at risk" conditions
  switch (goal.id) {
    case 'never-broke':
      return state.budget < 600; // Within 100 of 500 threshold

    case 'peoples-champion':
      return state.supportPeople < 60; // Within 10% of 50% threshold

    case 'power-broker':
      return state.supportMiddle < 50; // Within 10% of 40% threshold

    case 'loyal-allies':
      return state.supportMom < 50; // Within 10% of 40% threshold

    case 'pure-strategist':
      // Always at risk if not failed yet (one custom action fails it)
      return state.customActionCount === 0;

    case 'creative-maverick':
      // At risk if player hasn't used custom action yet on current day
      const expectedActions = state.day - 1; // Day 1 = 0 actions taken yet
      return state.customActionCount < expectedActions;

    default:
      return false;
  }
}

/**
 * Get progress percentage for a goal (0-100)
 * Returns null if goal doesn't have meaningful progress
 * @param goal Selected goal
 * @param state Current evaluation state
 * @returns Progress percentage or null
 */
export function getGoalProgress(goal: SelectedGoal, state: GoalEvaluationState): number | null {
  // Failed goals show 0%
  if (goal.status === 'failed') return 0;

  // Met goals show 100%
  if (goal.status === 'met') return 100;

  // Calculate progress based on goal type
  switch (goal.id) {
    case 'balanced-leader':
      // Average of how close each support is to 60%
      const peopleProgress = Math.min(100, (state.supportPeople / 60) * 100);
      const middleProgress = Math.min(100, (state.supportMiddle / 60) * 100);
      const momProgress = Math.min(100, (state.supportMom / 60) * 100);
      return Math.round((peopleProgress + middleProgress + momProgress) / 3);

    case 'wealthy-leader':
      return Math.min(100, Math.round((state.budget / 500) * 100));

    case 'popular-leader':
      return Math.min(100, Math.round((state.supportPeople / 85) * 100));

    case 'loyal-inner-circle':
      return Math.min(100, Math.round((state.supportMom / 90) * 100));

    case 'consensus-builder': {
      const max = Math.max(state.supportPeople, state.supportMiddle, state.supportMom);
      const min = Math.min(state.supportPeople, state.supportMiddle, state.supportMom);
      const spread = max - min;
      // 0 spread = 100%, 15 spread = 100%, >15 spread = less
      return Math.max(0, Math.min(100, Math.round(((30 - spread) / 30) * 100)));
    }

    case 'pure-strategist':
      return state.customActionCount === 0 ? 100 : 0;

    case 'creative-maverick': {
      const expectedActions = state.day - 1; // Day 1 = 0 actions taken
      if (expectedActions === 0) return 100; // No actions expected yet
      return Math.round((state.customActionCount / expectedActions) * 100);
    }

    // Continuous goals don't show progress (just met/unmet/failed)
    case 'never-broke':
    case 'peoples-champion':
    case 'power-broker':
    case 'loyal-allies':
    default:
      return null;
  }
}
