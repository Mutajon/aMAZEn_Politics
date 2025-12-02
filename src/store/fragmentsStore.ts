/**
 * src/store/fragmentsStore.ts
 *
 * Zustand store for fragment collection tracking
 * Manages the "collect 3 fragments" progression system
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const MAX_FRAGMENTS = 3;

/** Fragment data with avatar thumbnail for display on shards */
export interface Fragment {
  gameId: string;
  avatarThumbnail: string | null; // Compressed 64x64 WebP (~5-10KB)
}

export interface FragmentsState {
  firstIntro: boolean; // true on first visit, false after completing intro
  fragments: Fragment[]; // Array of fragments with avatars (max 3)
  hasClickedFragment: boolean; // true after user clicks a fragment for the first time
  preferredFragmentId: string | null; // gameId of preferred fragment (final selection)

  // Actions
  markIntroCompleted: () => void;
  addFragment: (gameId: string, avatarThumbnail: string | null) => void;
  getFragmentCount: () => number;
  getFragmentByIndex: (index: number) => Fragment | null;
  getFragmentGameIds: () => string[]; // Helper to get just gameIds for compatibility
  hasCompletedThreeFragments: () => boolean;
  clearFragments: () => void; // For testing/reset
  resetIntro: () => void; // Reset firstIntro flag for testing
  markFragmentClicked: () => void; // Mark that user has clicked a fragment
  setPreferredFragment: (gameId: string) => void; // Set preferred fragment
  hasSelectedPreferred: () => boolean; // Check if preferred fragment selected
}

export const useFragmentsStore = create<FragmentsState>()(
  persist(
    (set, get) => ({
      firstIntro: true,
      fragments: [],
      hasClickedFragment: false,
      preferredFragmentId: null,

      markIntroCompleted: () => {
        console.log("[Fragments] Marking intro as completed");
        set({ firstIntro: false });
      },

      addFragment: (gameId: string, avatarThumbnail: string | null) => {
        const current = get().fragments;

        // Check if fragment already exists
        if (current.some(f => f.gameId === gameId)) {
          console.warn(`[Fragments] Fragment ${gameId} already collected. Skipping.`);
          return;
        }

        // Check if we already have 3 fragments
        if (current.length >= MAX_FRAGMENTS) {
          console.warn(`[Fragments] Already have ${MAX_FRAGMENTS} fragments. Cannot add more.`);
          return;
        }

        // Add the fragment with avatar thumbnail
        const newFragment: Fragment = { gameId, avatarThumbnail };
        const updated = [...current, newFragment];
        set({ fragments: updated });

        const thumbnailSize = avatarThumbnail
          ? `${(avatarThumbnail.length / 1024).toFixed(1)}KB`
          : 'none';
        console.log(
          `[Fragments] Added fragment ${gameId} (avatar: ${thumbnailSize}). Total: ${updated.length}/${MAX_FRAGMENTS}`
        );

        // Log if all fragments collected
        if (updated.length === MAX_FRAGMENTS) {
          console.log("[Fragments] 🎉 All 3 fragments collected!");
        }
      },

      getFragmentCount: () => {
        return get().fragments.length;
      },

      getFragmentByIndex: (index: number) => {
        const fragments = get().fragments;
        if (index < 0 || index >= fragments.length) {
          return null;
        }
        return fragments[index];
      },

      getFragmentGameIds: () => {
        return get().fragments.map(f => f.gameId);
      },

      hasCompletedThreeFragments: () => {
        return get().fragments.length >= MAX_FRAGMENTS;
      },

      clearFragments: () => {
        set({ fragments: [] });
        console.log("[Fragments] Cleared all fragments");
      },

      resetIntro: () => {
        set({ firstIntro: true });
        console.log("[Fragments] Reset firstIntro flag to true");
      },

      markFragmentClicked: () => {
        if (!get().hasClickedFragment) {
          set({ hasClickedFragment: true });
          console.log("[Fragments] Marked fragment as clicked (first time)");
        }
      },

      setPreferredFragment: (gameId: string) => {
        set({ preferredFragmentId: gameId });
        console.log(`[Fragments] Set preferred fragment: ${gameId}`);
      },

      hasSelectedPreferred: () => {
        return get().preferredFragmentId !== null;
      },
    }),
    {
      name: "amaze-politics-fragments-v2", // Bumped version for migration
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        firstIntro: state.firstIntro,
        fragments: state.fragments.slice(0, MAX_FRAGMENTS),
        hasClickedFragment: state.hasClickedFragment,
        preferredFragmentId: state.preferredFragmentId,
      }),
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;

        // Migrate from v1 (fragmentGameIds) to v2 (fragments with avatars)
        if (version < 2 && state.fragmentGameIds && Array.isArray(state.fragmentGameIds)) {
          console.log("[Fragments] Migrating from v1 to v2 (adding avatar support)");
          const migratedFragments: Fragment[] = (state.fragmentGameIds as string[]).map(gameId => ({
            gameId,
            avatarThumbnail: null, // No thumbnails for old data
          }));
          return {
            ...state,
            fragments: migratedFragments,
            fragmentGameIds: undefined, // Remove old field
          };
        }

        return state;
      },
    }
  )
);
