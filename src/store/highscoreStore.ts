// src/store/highscoreStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_HIGHSCORES,
  type HighscoreEntry,
} from "../data/highscores-default";

/** Zustand store for highscores (keeps all fields incl. `period` and `avatarUrl`). */
type HighscoreState = {
  entries: HighscoreEntry[];
  /** Insert a new entry (keeps all props, including period and avatarUrl if provided). */
  addEntry: (e: HighscoreEntry) => void;
  /** Replace the entire list (e.g., after loading/persisting). */
  setEntries: (list: HighscoreEntry[]) => void;
  /** Reset to built-in defaults. */
  reset: () => void;
};

export const useHighscoreStore = create<HighscoreState>()(
  persist(
    (set, get) => ({
      entries: [...DEFAULT_HIGHSCORES],

      addEntry: (e) => {
        const next = [...get().entries, e];
        // Keep it sorted by score (desc) but do NOT drop any fields
        next.sort((a, b) => b.score - a.score);

        // Keep top 50 entries
        const trimmed = next.slice(0, 50);

        // Storage optimization: Keep avatars only for top 20 (Hall of Fame)
        // Ranks 21-50 will use default placeholder image
        const withManagedAvatars = trimmed.map((entry, idx) => {
          if (idx >= 20 && entry.avatarUrl) {
            // Strip avatars from entries outside Hall of Fame to save storage
            return { ...entry, avatarUrl: undefined };
          }
          return entry;
        });

        set({ entries: withManagedAvatars });
      },

      setEntries: (list) => {
        // Trust the caller — preserve all fields
        const next = [...list];
        next.sort((a, b) => b.score - a.score);
        set({ entries: next });
      },

      reset: () => set({ entries: [...DEFAULT_HIGHSCORES] }),
    }),
    {
      name: "amaze-politics-highscores-v1", // localStorage key
      // Only persist top 50 entries to avoid storage issues
      partialize: (state) => ({
        entries: state.entries.slice(0, 50),
      }),
    }
  )
);
