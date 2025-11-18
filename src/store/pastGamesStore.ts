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

        // Helper function to attempt saving with quota error handling
        const attemptSave = (games: PastGameEntry[]): boolean => {
          try {
            set({ games });
            return true;
          } catch (error) {
            // Detect QuotaExceededError
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
              return false;
            }
            // Re-throw non-quota errors
            throw error;
          }
        };

        // ATTEMPT 1: Try to save with normal limit (MAX_GAMES = 10)
        if (next.length > MAX_GAMES) {
          const removed = next.slice(MAX_GAMES);
          next = next.slice(0, MAX_GAMES);
          console.log(
            `[PastGames] Auto-pruned ${removed.length} old game(s). Kept ${MAX_GAMES} most recent.`
          );
        }

        if (attemptSave(next)) {
          console.log(
            `[PastGames] Saved game: "${entry.playerName}" in ${entry.roleTitle}. Total games: ${next.length}/${MAX_GAMES}`
          );
          return;
        }

        // ATTEMPT 2: Quota exceeded - aggressively prune to 5 games
        console.warn('[PastGames] ⚠️ Quota exceeded! Reducing to 5 most recent games...');
        next = next.slice(0, 5);

        if (attemptSave(next)) {
          console.log(
            `[PastGames] ✅ Saved after reducing to 5 games: "${entry.playerName}" in ${entry.roleTitle}`
          );
          return;
        }

        // ATTEMPT 3: Still failing - keep only newest game
        console.warn('[PastGames] ⚠️ Still exceeded! Keeping only newest game...');
        next = [entry];

        if (attemptSave(next)) {
          console.log(
            `[PastGames] ✅ Saved only newest game: "${entry.playerName}" in ${entry.roleTitle}`
          );
          return;
        }

        // ATTEMPT 4: Critical failure - even single game won't fit
        console.error('[PastGames] ❌ CRITICAL: Cannot save even single game - quota critically exceeded!');
        console.error('[PastGames] Run clearPastGames() in console to free space, or clear other localStorage data');
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
      name: "amaze-politics-past-games-v2", // localStorage key (v2 = strips avatars)
      // Strip avatars to save 99.9% of storage (680 KB → ~0.5 KB for 10 games)
      // Fragments display role background banners instead (thematic + space-efficient!)
      partialize: (state) => ({
        games: state.games.slice(0, MAX_GAMES).map(entry => ({
          ...entry,
          avatarUrl: undefined, // Strip base64 avatars (save ~68KB per game)
        })),
      }),
    }
  )
);
