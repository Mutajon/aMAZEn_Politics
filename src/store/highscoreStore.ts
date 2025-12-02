// src/store/highscoreStore.ts
import { create } from "zustand";
import type { HighscoreEntry } from "../data/highscores-default";

/**
 * Zustand store for highscores (DEPRECATED - transitioning to DB-only)
 * 
 * V2 Changes:
 * - Removed localStorage persistence (causing quota errors)
 * - Store now only used for session-level caching
 * - All persistence happens in MongoDB
 */
type HighscoreState = {
  entries: HighscoreEntry[];  // Session cache only
  addEntry: (e: HighscoreEntry) => void;
  setEntries: (list: HighscoreEntry[]) => void;
  reset: () => void;
};

export const useHighscoreStore = create<HighscoreState>()((set, get) => ({
  entries: [],  // No DEFAULT_HIGHSCORES - load from API instead

  addEntry: (e) => {
    const next = [...get().entries, e];
    next.sort((a, b) => b.score - a.score);
    set({ entries: next.slice(0, 50) });  // Keep top 50 in session cache
  },

  setEntries: (list) => {
    const next = [...list];
    next.sort((a, b) => b.score - a.score);
    set({ entries: next });
  },

  reset: () => set({ entries: [] }),
}));
