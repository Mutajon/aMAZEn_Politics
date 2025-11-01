// src/data/goals.ts
// Game goals system - defines all available goals players can pursue
//
// Goals are selected at game start (2 out of 3 random options) and affect final scoring.
// Three types of goals:
// - End-State: Evaluated only on game completion (e.g., "End with 85%+ support")
// - Continuous: Can permanently fail during gameplay (e.g., "Never drop below 50%")
// - Behavioral: Track player actions (e.g., "Never use custom actions")
//
// Connected to:
// - src/lib/goalEvaluation.ts: Evaluation engine
// - src/store/dilemmaStore.ts: Stores selected goals and tracking state
// - src/lib/scoring.ts: Calculates goal bonuses for final score

import { lang } from "../i18n/lang";

// ========================================================================
// TYPES
// ========================================================================

export type GoalStatus = 'met' | 'unmet' | 'failed';

export type GoalCategory =
  | 'end-state-support'    // Check final support values
  | 'end-state-budget'     // Check final budget value
  | 'continuous-support'   // Track minimum support throughout
  | 'continuous-budget'    // Track minimum budget throughout
  | 'behavioral';          // Track player behavior patterns

/**
 * Evaluation state passed to goal evaluate functions
 */
export interface GoalEvaluationState {
  // Current values
  day: number;
  totalDays: number;
  budget: number;
  supportPeople: number;
  supportMiddle: number;
  supportMom: number;
  customActionCount: number;

  // Minimum values (for "never drop below" goals)
  minBudget: number;
  minSupportPeople: number;
  minSupportMiddle: number;
  minSupportMom: number;

  // Context
  difficulty: string | null;
  isGameComplete: boolean;
}

/**
 * Base goal definition
 */
export interface Goal {
  id: string;
  category: GoalCategory;
  title: string;                           // Short title (e.g., "Popular Leader")
  description: string;                     // Full description for selection screen
  shortDescription: string;                // Compact description for in-game panel

  // Evaluation function - called after each day
  evaluate: (state: GoalEvaluationState) => GoalStatus;

  // Scoring
  scoreBonusOnCompletion: number;         // Bonus points if completed

  // Visual
  icon: string;                            // Lucide icon name
  color: string;                           // Color theme for the goal
}

/**
 * Selected goal with runtime state
 */
export interface SelectedGoal extends Goal {
  status: GoalStatus;           // Current status
  lastEvaluatedDay: number;     // When last evaluated
}

// ========================================================================
// GOAL POOL
// ========================================================================

/**
 * All available goals in the game
 * Players select 2 from a random set of 3
 * Now returns translated goals based on current language
 */
export function getGoalPool(): Goal[] {
  return [
  // ======================================================================
  // END-STATE GOALS (Evaluated on final day only)
  // ======================================================================

  {
    id: 'balanced-leader',
    category: 'end-state-support',
    title: lang('GOAL_BALANCED_LEADER_TITLE'),
    description: lang('GOAL_BALANCED_LEADER_DESC'),
    shortDescription: lang('GOAL_BALANCED_LEADER_SHORT'),
    evaluate: (state) => {
      if (!state.isGameComplete) return 'unmet';
      return (
        state.supportPeople > 60 &&
        state.supportMiddle > 60 &&
        state.supportMom > 60
      ) ? 'met' : 'unmet';
    },
    scoreBonusOnCompletion: 300,
    icon: 'Scale',
    color: 'blue',
  },

  {
    id: 'wealthy-leader',
    category: 'end-state-budget',
    title: lang('GOAL_WEALTHY_LEADER_TITLE'),
    description: lang('GOAL_WEALTHY_LEADER_DESC'),
    shortDescription: lang('GOAL_WEALTHY_LEADER_SHORT'),
    evaluate: (state) => {
      if (!state.isGameComplete) return 'unmet';
      return state.budget > 500 ? 'met' : 'unmet';
    },
    scoreBonusOnCompletion: 300,
    icon: 'DollarSign',
    color: 'green',
  },

  {
    id: 'popular-leader',
    category: 'end-state-support',
    title: lang('GOAL_POPULAR_LEADER_TITLE'),
    description: lang('GOAL_POPULAR_LEADER_DESC'),
    shortDescription: lang('GOAL_POPULAR_LEADER_SHORT'),
    evaluate: (state) => {
      if (!state.isGameComplete) return 'unmet';
      return state.supportPeople > 85 ? 'met' : 'unmet';
    },
    scoreBonusOnCompletion: 300,
    icon: 'Users',
    color: 'purple',
  },

  {
    id: 'loyal-inner-circle',
    category: 'end-state-support',
    title: lang('GOAL_LOVELY_CHILD_TITLE'),
    description: lang('GOAL_LOVELY_CHILD_DESC'),
    shortDescription: lang('GOAL_LOVELY_CHILD_SHORT'),
    evaluate: (state) => {
      if (!state.isGameComplete) return 'unmet';
      return state.supportMom > 90 ? 'met' : 'unmet';
    },
    scoreBonusOnCompletion: 300,
    icon: 'Heart',
    color: 'pink',
  },

  {
    id: 'consensus-builder',
    category: 'end-state-support',
    title: lang('GOAL_CONSENSUS_BUILDER_TITLE'),
    description: lang('GOAL_CONSENSUS_BUILDER_DESC'),
    shortDescription: lang('GOAL_CONSENSUS_BUILDER_SHORT'),
    evaluate: (state) => {
      if (!state.isGameComplete) return 'unmet';
      const max = Math.max(state.supportPeople, state.supportMiddle, state.supportMom);
      const min = Math.min(state.supportPeople, state.supportMiddle, state.supportMom);
      return (max - min) <= 15 ? 'met' : 'unmet';
    },
    scoreBonusOnCompletion: 300,
    icon: 'Activity',
    color: 'teal',
  },

  // ======================================================================
  // CONTINUOUS GOALS (Can fail during game)
  // ======================================================================

  {
    id: 'never-broke',
    category: 'continuous-budget',
    title: lang('GOAL_NEVER_BROKE_TITLE'),
    description: lang('GOAL_NEVER_BROKE_DESC'),
    shortDescription: lang('GOAL_NEVER_BROKE_SHORT'),
    evaluate: (state) => {
      if (state.minBudget < 650) return 'failed';
      if (state.isGameComplete && state.minBudget >= 650) return 'met';
      return 'unmet';
    },
    scoreBonusOnCompletion: 300,
    icon: 'TrendingUp',
    color: 'gold',
  },

  {
    id: 'peoples-champion',
    category: 'continuous-support',
    title: lang('GOAL_PEOPLES_CHAMPION_TITLE'),
    description: lang('GOAL_PEOPLES_CHAMPION_DESC'),
    shortDescription: lang('GOAL_PEOPLES_CHAMPION_SHORT'),
    evaluate: (state) => {
      if (state.minSupportPeople < 50) return 'failed';
      if (state.isGameComplete && state.minSupportPeople >= 50) return 'met';
      return 'unmet';
    },
    scoreBonusOnCompletion: 300,
    icon: 'Shield',
    color: 'blue',
  },

  {
    id: 'power-broker',
    category: 'continuous-support',
    title: lang('GOAL_POWER_BROKER_TITLE'),
    description: lang('GOAL_POWER_BROKER_DESC'),
    shortDescription: lang('GOAL_POWER_BROKER_SHORT'),
    evaluate: (state) => {
      if (state.minSupportMiddle < 40) return 'failed';
      if (state.isGameComplete && state.minSupportMiddle >= 40) return 'met';
      return 'unmet';
    },
    scoreBonusOnCompletion: 300,
    icon: 'Building2',
    color: 'indigo',
  },

  {
    id: 'loyal-allies',
    category: 'continuous-support',
    title: lang('GOAL_LOYAL_ALLIES_TITLE'),
    description: lang('GOAL_LOYAL_ALLIES_DESC'),
    shortDescription: lang('GOAL_LOYAL_ALLIES_SHORT'),
    evaluate: (state) => {
      if (state.minSupportMom < 40) return 'failed';
      if (state.isGameComplete && state.minSupportMom >= 40) return 'met';
      return 'unmet';
    },
    scoreBonusOnCompletion: 300,
    icon: 'Users',
    color: 'rose',
  },

  // ======================================================================
  // BEHAVIORAL GOALS
  // ======================================================================

  {
    id: 'pure-strategist',
    category: 'behavioral',
    title: lang('GOAL_PURE_STRATEGIST_TITLE'),
    description: lang('GOAL_PURE_STRATEGIST_DESC'),
    shortDescription: lang('GOAL_PURE_STRATEGIST_SHORT'),
    evaluate: (state) => {
      if (state.customActionCount > 0) return 'failed';
      if (state.isGameComplete && state.customActionCount === 0) return 'met';
      return 'unmet';
    },
    scoreBonusOnCompletion: 300,
    icon: 'Target',
    color: 'red',
  },

  {
    id: 'creative-maverick',
    category: 'behavioral',
    title: lang('GOAL_CREATIVE_MAVERICK_TITLE'),
    description: lang('GOAL_CREATIVE_MAVERICK_DESC'),
    shortDescription: lang('GOAL_CREATIVE_MAVERICK_SHORT'),
    evaluate: (state) => {
      // Each day requires one action, so totalDays custom actions = all custom
      if (state.customActionCount < state.day - 1) return 'failed'; // Day 1 = 0 actions yet
      if (state.isGameComplete && state.customActionCount === state.totalDays) return 'met';
      return 'unmet';
    },
    scoreBonusOnCompletion: 300,
    icon: 'Zap',
    color: 'yellow',
  },
];
}

// ========================================================================
// UTILITY FUNCTIONS
// ========================================================================

/**
 * Get a random selection of goals from the pool
 * @param count Number of goals to select (default 3)
 * @returns Array of randomly selected goals
 */
export function getRandomGoals(count: number = 3): Goal[] {
  // Shuffle pool using Fisher-Yates algorithm
  const shuffled = [...getGoalPool()];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Get goal by ID
 * @param id Goal ID
 * @returns Goal or undefined if not found
 */
export function getGoalById(id: string): Goal | undefined {
  return getGoalPool().find(g => g.id === id);
}

/**
 * Get all goals in a specific category
 * @param category Goal category
 * @returns Array of goals in that category
 */
export function getGoalsByCategory(category: GoalCategory): Goal[] {
  return getGoalPool().filter(g => g.category === category);
}
