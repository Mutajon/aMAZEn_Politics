/**
 * src/store/fragmentsStore.ts
 *
 * Zustand store for fragment collection tracking
 * Manages the "collect 3 fragments" progression system
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_FRAGMENTS = 3;

export interface FragmentsState {
  firstIntro: boolean; // true on first visit, false after completing intro
  fragmentGameIds: string[]; // Array of gameIds from pastGamesStore (max 3)

  // Actions
  markIntroCompleted: () => void;
  addFragment: (gameId: string) => void;
  getFragmentCount: () => number;
  getFragmentByIndex: (index: number) => string | null;
  hasCompletedThreeFragments: () => boolean;
  clearFragments: () => void; // For testing/reset
  resetIntro: () => void; // Reset firstIntro flag for testing
}

export const useFragmentsStore = create<FragmentsState>()(
  persist(
    (set, get) => ({
      firstIntro: true,
      fragmentGameIds: [],

      markIntroCompleted: () => {
        console.log("[Fragments] Marking intro as completed");
        set({ firstIntro: false });
      },

      addFragment: (gameId: string) => {
        const current = get().fragmentGameIds;

        // Check if fragment already exists
        if (current.includes(gameId)) {
          console.warn(`[Fragments] Fragment ${gameId} already collected. Skipping.`);
          return;
        }

        // Check if we already have 3 fragments
        if (current.length >= MAX_FRAGMENTS) {
          console.warn(`[Fragments] Already have ${MAX_FRAGMENTS} fragments. Cannot add more.`);
          return;
        }

        // Add the fragment
        const updated = [...current, gameId];
        set({ fragmentGameIds: updated });

        console.log(
          `[Fragments] Added fragment ${gameId}. Total: ${updated.length}/${MAX_FRAGMENTS}`
        );

        // Log if all fragments collected
        if (updated.length === MAX_FRAGMENTS) {
          console.log("[Fragments] 🎉 All 3 fragments collected!");
        }
      },

      getFragmentCount: () => {
        return get().fragmentGameIds.length;
      },

      getFragmentByIndex: (index: number) => {
        const fragments = get().fragmentGameIds;
        if (index < 0 || index >= fragments.length) {
          return null;
        }
        return fragments[index];
      },

      hasCompletedThreeFragments: () => {
        return get().fragmentGameIds.length >= MAX_FRAGMENTS;
      },

      clearFragments: () => {
        set({ fragmentGameIds: [] });
        console.log("[Fragments] Cleared all fragments");
      },

      resetIntro: () => {
        set({ firstIntro: true });
        console.log("[Fragments] Reset firstIntro flag to true");
      },
    }),
    {
      name: "amaze-politics-fragments-v1", // localStorage key
      partialize: (state) => ({
        firstIntro: state.firstIntro,
        fragmentGameIds: state.fragmentGameIds.slice(0, MAX_FRAGMENTS),
      }),
    }
  )
);
