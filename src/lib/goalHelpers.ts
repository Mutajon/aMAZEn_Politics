// src/lib/goalHelpers.ts
// Helper functions for goal system
//
// Provides utilities for:
// - Calculating difficulty-aware starting values
// - Goal filtering and categorization
// - Goal description formatting
//
// Connected to:
// - src/data/goals.ts: Goal types and pool
// - src/screens/GoalsSelectionScreen.tsx: Uses helpers for display
// - src/components/event/GoalsPanel.tsx: Uses formatting helpers

import type { Goal, GoalCategory } from "../data/goals";

// ========================================================================
// DIFFICULTY HELPERS
// ========================================================================

/**
 * Get starting budget based on difficulty level
 * Matches difficulty modifiers from game
 */
export function getStartingBudget(difficulty: string | null): number {
  const modifiers: Record<string, number> = {
    "baby-boss": 1750,    // 1500 + 250
    "freshman": 1500,      // 1500 + 0
    "tactician": 1250,     // 1500 - 250
    "old-fox": 1000,       // 1500 - 500
  };

  return modifiers[difficulty || "freshman"] || 1500;
}

/**
 * Get starting support level based on difficulty
 * Matches difficulty modifiers from game
 */
export function getStartingSupport(difficulty: string | null): number {
  const modifiers: Record<string, number> = {
    "baby-boss": 60,      // 50 + 10
    "freshman": 50,       // 50 + 0
    "tactician": 40,      // 50 - 10
    "old-fox": 30,        // 50 - 20
  };

  return modifiers[difficulty || "freshman"] || 50;
}

// ========================================================================
// GOAL FILTERING
// ========================================================================

/**
 * Filter goals that are appropriate for difficulty level
 * Some goals may be too hard/easy for certain difficulties
 * @param goals Array of goals
 * @param difficulty Current difficulty level
 * @returns Filtered goals
 */
export function filterGoalsByDifficulty(goals: Goal[], difficulty: string | null): Goal[] {
  // For now, all goals are available at all difficulties
  // Future: Could filter out goals that are impossible/trivial at certain difficulties
  return goals;
}

/**
 * Categorize goals by type for display
 * @param goals Array of goals
 * @returns Goals grouped by category
 */
export function categorizeGoals(goals: Goal[]): Record<GoalCategory, Goal[]> {
  const categorized: Record<GoalCategory, Goal[]> = {
    'end-state-support': [],
    'end-state-budget': [],
    'continuous-support': [],
    'continuous-budget': [],
    'behavioral': [],
  };

  goals.forEach(goal => {
    categorized[goal.category].push(goal);
  });

  return categorized;
}

// ========================================================================
// FORMATTING HELPERS
// ========================================================================

/**
 * Format goal category for display
 * @param category Goal category
 * @returns Human-readable category name
 */
export function formatGoalCategory(category: GoalCategory): string {
  switch (category) {
    case 'end-state-support':
      return 'Final Support Goal';
    case 'end-state-budget':
      return 'Final Budget Goal';
    case 'continuous-support':
      return 'Continuous Support Goal';
    case 'continuous-budget':
      return 'Continuous Budget Goal';
    case 'behavioral':
      return 'Behavioral Goal';
    default:
      return 'Goal';
  }
}

/**
 * Get icon color class based on goal color
 * @param color Goal color name
 * @returns Tailwind color class
 */
export function getGoalColorClass(color: string): string {
  const colorMap: Record<string, string> = {
    'blue': 'text-blue-400',
    'green': 'text-green-400',
    'purple': 'text-purple-400',
    'pink': 'text-pink-400',
    'teal': 'text-teal-400',
    'gold': 'text-yellow-400',
    'indigo': 'text-indigo-400',
    'rose': 'text-rose-400',
    'red': 'text-red-400',
    'yellow': 'text-yellow-400',
  };

  return colorMap[color] || 'text-white';
}

/**
 * Get background color class based on goal color
 * @param color Goal color name
 * @returns Tailwind background color class
 */
export function getGoalBgClass(color: string): string {
  const colorMap: Record<string, string> = {
    'blue': 'bg-blue-500/10',
    'green': 'bg-green-500/10',
    'purple': 'bg-purple-500/10',
    'pink': 'bg-pink-500/10',
    'teal': 'bg-teal-500/10',
    'gold': 'bg-yellow-500/10',
    'indigo': 'bg-indigo-500/10',
    'rose': 'bg-rose-500/10',
    'red': 'bg-red-500/10',
    'yellow': 'bg-yellow-500/10',
  };

  return colorMap[color] || 'bg-white/5';
}

/**
 * Get border color class based on goal color
 * @param color Goal color name
 * @returns Tailwind border color class
 */
export function getGoalBorderClass(color: string): string {
  const colorMap: Record<string, string> = {
    'blue': 'border-blue-400/30',
    'green': 'border-green-400/30',
    'purple': 'border-purple-400/30',
    'pink': 'border-pink-400/30',
    'teal': 'border-teal-400/30',
    'gold': 'border-yellow-400/30',
    'indigo': 'border-indigo-400/30',
    'rose': 'border-rose-400/30',
    'red': 'border-red-400/30',
    'yellow': 'border-yellow-400/30',
  };

  return colorMap[color] || 'border-white/10';
}

/**
 * Format points value with + sign for display
 * @param points Points value
 * @returns Formatted string (e.g., "+150")
 */
export function formatPoints(points: number): string {
  return points >= 0 ? `+${points}` : `${points}`;
}

/**
 * Get difficulty label for display
 * @param difficulty Difficulty level
 * @returns Formatted difficulty name
 */
export function formatDifficulty(difficulty: string | null): string {
  if (!difficulty) return 'None';

  const labels: Record<string, string> = {
    'baby-boss': 'Baby Boss',
    'freshman': 'Freshman',
    'tactician': 'Tactician',
    'old-fox': 'Old Fox',
  };

  return labels[difficulty] || difficulty;
}

// ========================================================================
// TEXT SUBSTITUTION
// ========================================================================

/**
 * Replace {middleEntity} placeholder with actual entity name from power distribution
 * Used to dynamically display the correct middle entity name in goal descriptions
 * @param text Text with placeholder (e.g., "Never let {middleEntity} support drop...")
 * @param middleEntity Actual middle entity name (e.g., "Military", "Council", "Clergy")
 * @returns Text with placeholder replaced
 */
export function substituteGoalText(text: string, middleEntity: string): string {
  return text.replace(/{middleEntity}/g, middleEntity);
}
