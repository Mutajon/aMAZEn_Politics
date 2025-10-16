// src/lib/scoring.ts
// Score calculation formulas, types, and highscore helpers for the final score screen
//
// Implements the scoring system defined in CLAUDE.md:
// - Support: 1500 max (500 per track)
// - Budget: 400 max
// - Ideology: 500 max (250 per axis based on aftermath ratings)
// - Goals: ±300 (not implemented yet)
// - Bonus: ±200 (not implemented yet)
// - Difficulty: ±500 (flat modifiers)
// - Total: Clamped [0, 3000]
//
// Connects to:
// - src/hooks/useScoreCalculation.ts: Uses these formulas to calculate scores
// - src/screens/FinalScoreScreen.tsx: Displays animated score breakdown
// - src/store/highscoreStore.ts: Builds entries for Hall of Fame

import type { HighscoreEntry } from "../data/highscores-default";

// ========================================================================
// TYPES
// ========================================================================

/**
 * Aftermath rating levels (from AI aftermath analysis)
 */
export type AftermathRating = "very-low" | "low" | "medium" | "high" | "very-high";

/**
 * Complete score breakdown with all categories
 */
export type ScoreBreakdown = {
  support: {
    people: number;      // 0-500 points
    middle: number;      // 0-500 points
    mom: number;         // 0-500 points
    total: number;       // Sum (max 1500)
  };
  budget: {
    budgetAmount: number; // Raw budget value
    points: number;       // 0-400 points
  };
  ideology: {
    liberalism: {
      rating: AftermathRating;
      points: number;     // 0-250 points
    };
    autonomy: {
      rating: AftermathRating;
      points: number;     // 0-250 points
    };
    total: number;        // Sum (max 500)
  };
  goals: {
    completed: number;    // Number of goals completed (0-2)
    bonusPoints: number;  // Total bonus from completed goals
    total: number;        // Total goal points (max 300)
  };
  bonus: {
    points: number;       // ±200 points (not implemented)
  };
  difficulty: {
    level: string;        // Difficulty name
    points: number;       // ±500 points
  };
  final: number;          // Total clamped [0, 3500]
};

// ========================================================================
// CORE SCORING FORMULAS
// ========================================================================

/**
 * Calculate support score (max 1500)
 * Formula: (value/100) × 500 per track
 */
export function calculateSupportScore(
  people: number,
  middle: number,
  mom: number
): ScoreBreakdown["support"] {
  const peoplePoints = Math.round((people / 100) * 500);
  const middlePoints = Math.round((middle / 100) * 500);
  const momPoints = Math.round((mom / 100) * 500);

  return {
    people: peoplePoints,
    middle: middlePoints,
    mom: momPoints,
    total: peoplePoints + middlePoints + momPoints,
  };
}

/**
 * Calculate budget score (max 400)
 * Formula: min(400, (budget/1200) × 400)
 */
export function calculateBudgetScore(budget: number): ScoreBreakdown["budget"] {
  const points = Math.min(400, Math.round((budget / 1200) * 400));
  return {
    budgetAmount: budget,
    points: Math.max(0, points), // Clamp to 0 minimum
  };
}

/**
 * Calculate ideology score (max 500)
 * Formula: 250 per axis based on rating
 * Rating → Points: very-low: 50, low: 112, medium: 175, high: 212, very-high: 250
 */
export function calculateIdeologyScore(
  liberalismRating: AftermathRating,
  autonomyRating: AftermathRating
): ScoreBreakdown["ideology"] {
  const ratingToPoints = (rating: AftermathRating): number => {
    switch (rating) {
      case "very-high": return 250;
      case "high": return 212;
      case "medium": return 175;
      case "low": return 112;
      case "very-low": return 50;
      default: return 175; // Default to medium
    }
  };

  const liberalismPoints = ratingToPoints(liberalismRating);
  const autonomyPoints = ratingToPoints(autonomyRating);

  return {
    liberalism: {
      rating: liberalismRating,
      points: liberalismPoints,
    },
    autonomy: {
      rating: autonomyRating,
      points: autonomyPoints,
    },
    total: liberalismPoints + autonomyPoints,
  };
}

/**
 * Calculate goals score from selected goals
 * Sums bonus points from all completed goals (max 2 goals)
 * @param selectedGoals Array of selected goals with status
 * @returns Goals score breakdown
 */
export function calculateGoalsScore(
  selectedGoals: Array<{ status: string; scoreBonusOnCompletion: number }> = []
): ScoreBreakdown["goals"] {
  const completedGoals = selectedGoals.filter(g => g.status === 'met');
  const bonusPoints = completedGoals.reduce((sum, g) => sum + g.scoreBonusOnCompletion, 0);

  return {
    completed: completedGoals.length,
    bonusPoints,
    total: bonusPoints, // Total is sum of bonuses (capped at 300 in final calculation)
  };
}

/**
 * Calculate bonus score (not implemented yet)
 * Placeholder: returns 0
 */
export function calculateBonusScore(): ScoreBreakdown["bonus"] {
  return {
    points: 0, // TODO: Implement bonus conditions
  };
}

/**
 * Calculate difficulty score (flat modifiers)
 * baby-boss: -200, freshman: 0, tactician: +200, old-fox: +500
 */
export function calculateDifficultyScore(
  difficulty: "baby-boss" | "freshman" | "tactician" | "old-fox" | null
): ScoreBreakdown["difficulty"] {
  const modifiers = {
    "baby-boss": -200,
    "freshman": 0,
    "tactician": 200,
    "old-fox": 500,
  };

  const points = difficulty ? modifiers[difficulty] : 0;
  const level = difficulty || "none";

  return {
    level,
    points,
  };
}

/**
 * Calculate final score (sum all categories, clamp [0, 3500])
 */
export function calculateFinalScore(breakdown: ScoreBreakdown): number {
  const sum =
    breakdown.support.total +
    breakdown.budget.points +
    breakdown.ideology.total +
    breakdown.goals.total +
    breakdown.bonus.points +
    breakdown.difficulty.points;

  return Math.max(0, Math.min(3500, sum));
}

// ========================================================================
// HELPER FUNCTIONS
// ========================================================================

/**
 * Format aftermath rating for display
 * Example: "very-high" → "Very High"
 */
export function formatRating(rating: string): string {
  return rating
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Format compass values for highscore entry
 * Example: "What: Liberty/Agency; Whence: Evidence; How: Law/Std.; Whither: Self"
 */
export function formatCompassValuesForHighscore(
  top3ByDimension: Record<string, Array<{ short: string }>>
): string {
  const parts: string[] = [];

  // Format: "What: X; Whence: Y; How: Z; Whither: W"
  for (const dim of ["what", "whence", "how", "whither"]) {
    const dimName = dim.charAt(0).toUpperCase() + dim.slice(1);
    const topValue = top3ByDimension[dim]?.[0]?.short || "—";
    parts.push(`${dimName}: ${topValue}`);
  }

  return parts.join("; ");
}

/**
 * Build highscore entry from score breakdown and game data
 */
export function buildHighscoreEntry(
  breakdown: ScoreBreakdown,
  character: { name: string; aboutRole?: string; avatarUrl?: string } | null,
  analysis: { systemName?: string } | null,
  ratings: { liberalism: AftermathRating; autonomy: AftermathRating } | null,
  top3ByDimension: Record<string, Array<{ short: string }>>
): HighscoreEntry {
  // Map AftermathRating to DemocracyLevel (same type, different name)
  const mapRating = (rating: AftermathRating): HighscoreEntry["democracy"] => {
    switch (rating) {
      case "very-high": return "Very High";
      case "high": return "High";
      case "medium": return "Medium";
      case "low": return "Low";
      case "very-low": return "Very Low";
      default: return "Medium";
    }
  };

  return {
    name: character?.name || "Unknown Leader",
    about: character?.aboutRole || "A leader who shaped their era.",
    democracy: ratings ? mapRating(ratings.liberalism) : "Medium",
    autonomy: ratings ? mapRating(ratings.autonomy) : "Medium",
    values: formatCompassValuesForHighscore(top3ByDimension),
    score: breakdown.final,
    politicalSystem: analysis?.systemName || "Unknown System",
  };
}
