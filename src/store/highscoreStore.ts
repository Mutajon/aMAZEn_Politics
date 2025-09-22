// src/store/highscoreStore.ts
import { create } from "zustand";
import {
  DEFAULT_HIGHSCORES,
  type HighscoreEntry,
} from "../data/highscores-default";

/** Zustand store for highscores (keeps all fields incl. `period`). */
type HighscoreState = {
  entries: HighscoreEntry[];
  /** Insert a new entry (keeps all props, including period if provided). */
  addEntry: (e: HighscoreEntry) => void;
  /** Replace the entire list (e.g., after loading/persisting). */
  setEntries: (list: HighscoreEntry[]) => void;
  /** Reset to built-in defaults. */
  reset: () => void;
};

export const useHighscoreStore = create<HighscoreState>((set, get) => ({
  entries: [...DEFAULT_HIGHSCORES],

  addEntry: (e) => {
    const next = [...get().entries, e];
    // Keep it sorted by score (desc) but do NOT drop any fields
    next.sort((a, b) => b.score - a.score);
    set({ entries: next });
  },

  setEntries: (list) => {
    // Trust the caller — preserve all fields
    const next = [...list];
    next.sort((a, b) => b.score - a.score);
    set({ entries: next });
  },

  reset: () => set({ entries: [...DEFAULT_HIGHSCORES] }),
}));
