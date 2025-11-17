/**
 * src/store/pastGamesStore.ts
 *
 * Zustand store for past games storage
 * Saves completed game data to localStorage for future gallery/comparison screens
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PastGameEntry, PastGamesState } from "../lib/types/pastGames";

const MAX_GAMES = 10; // Maximum number of games to store (auto-prune oldest)

export const usePastGamesStore = create<PastGamesState>()(
  persist(
    (set, get) => ({
      games: [],

      addGame: (entry: PastGameEntry) => {
        const existing = get().games;

        // Check if this game already exists (avoid duplicates)
        const alreadyExists = existing.some((g) => g.gameId === entry.gameId);
        if (alreadyExists) {
          console.warn(
            `[PastGames] Game ${entry.gameId} already saved. Skipping duplicate.`
          );
          return;
        }

        // Add new game at the end (most recent)
        let next = [...existing, entry];

        // Sort by timestamp (newest first)
        next.sort((a, b) => b.timestamp - a.timestamp);

        // Keep only the most recent MAX_GAMES games (auto-prune oldest)
        if (next.length > MAX_GAMES) {
          const removed = next.slice(MAX_GAMES);
          next = next.slice(0, MAX_GAMES);
          console.log(
            `[PastGames] Auto-pruned ${removed.length} old game(s). Kept ${MAX_GAMES} most recent.`
          );
        }

        set({ games: next });

        console.log(
          `[PastGames] Saved game: "${entry.playerName}" in ${entry.roleTitle}. Total games: ${next.length}/${MAX_GAMES}`
        );
      },

      getGames: () => {
        return get().games;
      },

      removeGame: (gameId: string) => {
        const existing = get().games;
        const filtered = existing.filter((g: PastGameEntry) => g.gameId !== gameId);

        if (filtered.length === existing.length) {
          console.warn(`[PastGames] Game ${gameId} not found. Nothing removed.`);
          return;
        }

        set({ games: filtered });
        console.log(
          `[PastGames] Removed game ${gameId}. Remaining: ${filtered.length}/${MAX_GAMES}`
        );
      },

      clearAll: () => {
        set({ games: [] });
        console.log("[PastGames] Cleared all past games.");
      },
    }),
    {
      name: "amaze-politics-past-games-v1", // localStorage key
      // Keep full avatars (user requested full base64 avatars)
      // Warning: This will use ~500-800KB of localStorage quota for 10 games
      partialize: (state) => ({
        games: state.games.slice(0, MAX_GAMES), // Keep only MAX_GAMES
      }),
    }
  )
);
