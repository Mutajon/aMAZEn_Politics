// src/lib/aftermath.ts
// Type definitions for the Aftermath screen
//
// Connects to:
// - server/index.mjs: /api/aftermath endpoint consumes AftermathRequest, returns AftermathResponse
// - src/hooks/useAftermathData.ts: uses these types for data collection
// - src/screens/AftermathScreen.tsx: renders data from AftermathResponse

import type { PropKey } from "../data/compass-data";
import type { DilemmaHistoryEntry } from "./dilemma";

/** Top compass value for a dimension (top 2 per dimension sent to API) */
export type TopCompassValue = {
  dimension: PropKey; // what|whence|how|whither
  componentName: string; // e.g., "Liberty/Agency"
  value: number; // 0-10
};

/** Request payload for /api/aftermath */
export type AftermathRequest = {
  gameId?: string; // optional gameId to retrieve conversation history from backend
  playerName: string; // from roleStore.character.name
  role: string; // from roleStore.selectedRole
  systemName: string; // from roleStore.analysis.systemName
  dilemmaHistory: DilemmaHistoryEntry[]; // full game history (7 days)
  finalSupport: {
    people: number; // 0-100
    middle: number; // 0-100
    mom: number; // 0-100
  };
  topCompassValues: TopCompassValue[]; // top 2 per dimension (8 total)
  debug?: boolean;
};

/** Rating level for autonomy and liberalism */
export type RatingLevel = "very-low" | "low" | "medium" | "high" | "very-high";

/** Individual decision analysis from AI */
export type DecisionAnalysis = {
  title: string; // ≤12 words
  reflection: string; // short explanatory sentence (~15-25 words) explaining WHY the decision demonstrates autonomy/heteronomy and liberalism/totalism
  autonomy: RatingLevel; // AI rating for this specific decision
  liberalism: RatingLevel; // AI rating for this specific decision
  democracy: RatingLevel; // AI rating for this specific decision (HIDDEN from UI - for internal analysis only)
};

/** Response from /api/aftermath */
export type AftermathResponse = {
  intro: string; // "After X years, [leader] died of Z."
  remembrance: string; // 3-4 sentences on legacy
  rank: string; // fictional title like "The Gentle Iron Fist"
  decisions: DecisionAnalysis[]; // one per day (7 decisions with per-decision ratings)
  ratings: {
    // FRONTEND-CALCULATED: Averaged from per-decision ratings (not from AI)
    autonomy: RatingLevel;
    liberalism: RatingLevel;
  };
  valuesSummary: string; // one sentence summary
  haiku: string; // 3-line poetic summary
};

/**
 * Convert rating string to numeric value (1-5)
 * very-low=1, low=2, medium=3, high=4, very-high=5
 */
export function ratingToNumber(rating: RatingLevel): number {
  const map: Record<RatingLevel, number> = {
    "very-low": 1,
    "low": 2,
    "medium": 3,
    "high": 4,
    "very-high": 5
  };
  return map[rating] ?? 3; // Default to medium if invalid
}

/**
 * Convert numeric value (1-5) back to rating string
 * Rounds to nearest integer: 1→very-low, 2→low, 3→medium, 4→high, 5→very-high
 */
export function numberToRating(value: number): RatingLevel {
  const rounded = Math.round(Math.max(1, Math.min(5, value)));
  const map: Record<number, RatingLevel> = {
    1: "very-low",
    2: "low",
    3: "medium",
    4: "high",
    5: "very-high"
  };
  return map[rounded] ?? "medium";
}

/**
 * Calculate overall rating by averaging individual decision ratings
 * @param decisions - Array of decisions with autonomy/liberalism/democracy ratings
 * @returns Object with calculated autonomy, liberalism, and democracy ratings
 */
export function calculateOverallRatings(
  decisions: DecisionAnalysis[]
): { autonomy: RatingLevel; liberalism: RatingLevel; democracy: RatingLevel } {
  // Edge case: no decisions
  if (!decisions || decisions.length === 0) {
    return { autonomy: "medium", liberalism: "medium", democracy: "medium" };
  }

  // Convert all decision ratings to numbers
  const autonomyValues = decisions.map(d => ratingToNumber(d.autonomy));
  const liberalismValues = decisions.map(d => ratingToNumber(d.liberalism));
  const democracyValues = decisions.map(d => ratingToNumber(d.democracy));

  // Calculate averages
  const autonomyAvg = autonomyValues.reduce((sum, val) => sum + val, 0) / autonomyValues.length;
  const liberalismAvg = liberalismValues.reduce((sum, val) => sum + val, 0) / liberalismValues.length;
  const democracyAvg = democracyValues.reduce((sum, val) => sum + val, 0) / democracyValues.length;

  // Convert back to ratings
  return {
    autonomy: numberToRating(autonomyAvg),
    liberalism: numberToRating(liberalismAvg),
    democracy: numberToRating(democracyAvg)
  };
}
