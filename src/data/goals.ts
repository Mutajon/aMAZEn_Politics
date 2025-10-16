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
 */
export const GOAL_POOL: Goal[] = [
  // ======================================================================
  // END-STATE GOALS (Evaluated on final day only)
  // ======================================================================

  {
    id: 'balanced-leader',
    category: 'end-state-support',
    title: 'Balanced Leader',
    description: 'End the game with over 60% support from all three groups (public, {middleEntity}, and Mom)',
    shortDescription: 'All support >60%',
    evaluate: (state) => {
      if (!state.isGameComplete) return 'unmet';
      return (
        state.supportPeople > 60 &&
        state.supportMiddle > 60 &&
        state.supportMom > 60
      ) ? 'met' : 'unmet';
    },
    scoreBonusOnCompletion: 150,
    icon: 'Scale',
    color: 'blue',
  },

  {
    id: 'wealthy-leader',
    category: 'end-state-budget',
    title: 'Wealthy Leader',
    description: 'End the game with a budget above 500',
    shortDescription: 'Budget >500',
    evaluate: (state) => {
      if (!state.isGameComplete) return 'unmet';
      return state.budget > 500 ? 'met' : 'unmet';
    },
    scoreBonusOnCompletion: 100,
    icon: 'DollarSign',
    color: 'green',
  },

  {
    id: 'popular-leader',
    category: 'end-state-support',
    title: 'Popular Leader',
    description: 'End the game with public support over 85%',
    shortDescription: 'Public >85%',
    evaluate: (state) => {
      if (!state.isGameComplete) return 'unmet';
      return state.supportPeople > 85 ? 'met' : 'unmet';
    },
    scoreBonusOnCompletion: 150,
    icon: 'Users',
    color: 'purple',
  },

  {
    id: 'loyal-inner-circle',
    category: 'end-state-support',
    title: 'Lovely Child',
    description: 'End the game with Mom support over 90%',
    shortDescription: 'Mom >90%',
    evaluate: (state) => {
      if (!state.isGameComplete) return 'unmet';
      return state.supportMom > 90 ? 'met' : 'unmet';
    },
    scoreBonusOnCompletion: 150,
    icon: 'Heart',
    color: 'pink',
  },

  {
    id: 'consensus-builder',
    category: 'end-state-support',
    title: 'Consensus Builder',
    description: 'End with all three support levels within 15% of each other',
    shortDescription: 'All support ±15%',
    evaluate: (state) => {
      if (!state.isGameComplete) return 'unmet';
      const max = Math.max(state.supportPeople, state.supportMiddle, state.supportMom);
      const min = Math.min(state.supportPeople, state.supportMiddle, state.supportMom);
      return (max - min) <= 15 ? 'met' : 'unmet';
    },
    scoreBonusOnCompletion: 150,
    icon: 'Activity',
    color: 'teal',
  },

  // ======================================================================
  // CONTINUOUS GOALS (Can fail during game)
  // ======================================================================

  {
    id: 'never-broke',
    category: 'continuous-budget',
    title: 'Never Broke',
    description: 'Never let your budget drop below 650 at any point during the game',
    shortDescription: 'Budget never <650',
    evaluate: (state) => {
      if (state.minBudget < 650) return 'failed';
      if (state.isGameComplete && state.minBudget >= 650) return 'met';
      return 'unmet';
    },
    scoreBonusOnCompletion: 150,
    icon: 'TrendingUp',
    color: 'gold',
  },

  {
    id: 'peoples-champion',
    category: 'continuous-support',
    title: "People's Champion",
    description: 'Never let public support drop below 50% at any point',
    shortDescription: 'Public never <50%',
    evaluate: (state) => {
      if (state.minSupportPeople < 50) return 'failed';
      if (state.isGameComplete && state.minSupportPeople >= 50) return 'met';
      return 'unmet';
    },
    scoreBonusOnCompletion: 150,
    icon: 'Shield',
    color: 'blue',
  },

  {
    id: 'power-broker',
    category: 'continuous-support',
    title: 'Power Broker',
    description: 'Never let {middleEntity} support drop below 40% at any point',
    shortDescription: '{middleEntity} never <40%',
    evaluate: (state) => {
      if (state.minSupportMiddle < 40) return 'failed';
      if (state.isGameComplete && state.minSupportMiddle >= 40) return 'met';
      return 'unmet';
    },
    scoreBonusOnCompletion: 150,
    icon: 'Building2',
    color: 'indigo',
  },

  {
    id: 'loyal-allies',
    category: 'continuous-support',
    title: 'Loyal Allies',
    description: 'Never let Mom support drop below 40% at any point',
    shortDescription: 'Mom never <40%',
    evaluate: (state) => {
      if (state.minSupportMom < 40) return 'failed';
      if (state.isGameComplete && state.minSupportMom >= 40) return 'met';
      return 'unmet';
    },
    scoreBonusOnCompletion: 150,
    icon: 'Users',
    color: 'rose',
  },

  // ======================================================================
  // BEHAVIORAL GOALS
  // ======================================================================

  {
    id: 'pure-strategist',
    category: 'behavioral',
    title: 'Pure Strategist',
    description: 'Complete the game without using the "Suggest Your Own" option even once',
    shortDescription: 'No custom actions',
    evaluate: (state) => {
      if (state.customActionCount > 0) return 'failed';
      if (state.isGameComplete && state.customActionCount === 0) return 'met';
      return 'unmet';
    },
    scoreBonusOnCompletion: 150,
    icon: 'Target',
    color: 'red',
  },

  {
    id: 'creative-maverick',
    category: 'behavioral',
    title: 'Creative Maverick',
    description: 'Complete the game using ONLY the "Suggest Your Own" option (every single day)',
    shortDescription: 'Only custom actions',
    evaluate: (state) => {
      // Each day requires one action, so totalDays custom actions = all custom
      if (state.customActionCount < state.day - 1) return 'failed'; // Day 1 = 0 actions yet
      if (state.isGameComplete && state.customActionCount === state.totalDays) return 'met';
      return 'unmet';
    },
    scoreBonusOnCompletion: 150,
    icon: 'Zap',
    color: 'yellow',
  },
];

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
  const shuffled = [...GOAL_POOL];
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
  return GOAL_POOL.find(g => g.id === id);
}

/**
 * Get all goals in a specific category
 * @param category Goal category
 * @returns Array of goals in that category
 */
export function getGoalsByCategory(category: GoalCategory): Goal[] {
  return GOAL_POOL.filter(g => g.category === category);
}
