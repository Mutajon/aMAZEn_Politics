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

/** Individual decision analysis from AI */
export type DecisionAnalysis = {
  title: string; // ≤12 words
  reflection: string; // one line judging autonomy/liberalism
};

/** Response from /api/aftermath */
export type AftermathResponse = {
  intro: string; // "After X years, [leader] died of Z."
  remembrance: string; // 3-4 sentences on legacy
  rank: string; // fictional title like "The Gentle Iron Fist"
  decisions: DecisionAnalysis[]; // one per day
  ratings: {
    autonomy: "very-low" | "low" | "medium" | "high" | "very-high";
    liberalism: "very-low" | "low" | "medium" | "high" | "very-high";
  };
  valuesSummary: string; // one sentence summary
  haiku: string; // 3-line poetic summary
};
