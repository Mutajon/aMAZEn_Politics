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

        // Session optimization: Keep avatars only for top 20 during current session
        // Note: ALL avatars are stripped when persisting to localStorage (see partialize)
        // Ranks 21-50 use placeholder images even during session
        const withManagedAvatars = trimmed.map((entry, idx) => {
          if (idx >= 20 && entry.avatarUrl) {
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
      name: "amaze-politics-highscores-v2", // localStorage key (v2: strips avatars to prevent quota errors)
      // Strip avatars to prevent localStorage quota errors (base64 images are too large)
      // Avatars work during current session, but aren't persisted across sessions
      partialize: (state) => ({
        entries: state.entries.slice(0, 50).map(entry => ({
          ...entry,
          avatarUrl: undefined, // Strip all avatars to avoid storage quota
        })),
      }),
    }
  )
);
