/**
 * TypeScript types for Past Games Storage System
 *
 * This module defines types for storing and retrieving completed game data
 * from localStorage for display in future gallery/comparison screens.
 */

import type { PropKey } from "../../data/compass-data";
import type { RatingLevel } from "../aftermath";

/**
 * Snapshot highlight - a dramatic event from the aftermath screen
 */
export interface SnapshotHighlight {
  type: "positive" | "negative";
  icon: string; // emoji (e.g., ⚔️ 🏥 💀 🏛️)
  text: string; // 3-7 words, dramatic and concise
  estimate?: number; // optional numeric estimate
}

/**
 * Compass highlight - a top compass value from the player's profile
 */
export interface CompassHighlight {
  dimension: PropKey; // "what" | "whence" | "how" | "whither"
  componentName: string; // e.g., "Liberty/Agency", "Care/Solidarity"
  value: number; // 0-10
}

/**
 * Past game entry - all data saved for a completed game
 */
export interface PastGameEntry {
  // Identifiers
  gameId: string; // Unique game identifier
  timestamp: number; // Game completion timestamp (Date.now())

  // Player Info
  playerName: string; // Character name
  avatarUrl?: string; // Base64 data URL for avatar image

  // Role/Setting
  roleTitle: string; // e.g., "Athens — Shadows of War (-431)"
  roleDescription: string; // e.g., "Citizen in Athens"
  systemName: string; // e.g., "Democracy", "Stratocracy"

  // Final Results
  finalScore: number; // Total score
  supportPeople: number; // 0-100
  supportMiddle: number; // 0-100
  supportMom: number; // 0-100 (Men of Means)
  corruptionLevel: number; // 0-100

  // Aftermath Highlights
  legacy: string; // "You will be remembered as..." sentence
  snapshotHighlights: SnapshotHighlight[]; // 3-6 most dramatic events

  // Compass Top Values
  topCompassValues: CompassHighlight[]; // Top 2-3 per dimension (8-12 total)

  // Ratings
  ratings: {
    democracy: RatingLevel;
    autonomy: RatingLevel;
    liberalism: RatingLevel;
  };
}

/**
 * Past games store state
 */
export interface PastGamesState {
  games: PastGameEntry[]; // Stored games (max 10)

  // Actions
  addGame: (entry: PastGameEntry) => void;
  getGames: () => PastGameEntry[];
  removeGame: (gameId: string) => void;
  clearAll: () => void;
}
