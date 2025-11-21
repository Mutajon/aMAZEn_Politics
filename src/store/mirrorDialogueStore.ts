// src/store/mirrorDialogueStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface MirrorDialogueState {
  /**
   * Tracks if this is the player's first time seeing the mirror dialogue.
   * - true: First visit, show full 5-message dialogue
   * - false: Returning visit, show abbreviated 2-message dialogue
   */
  firstMirrorDialogue: boolean;

  // Actions
  /**
   * Marks the mirror dialogue as completed.
   * Called when player clicks "Sure, let's go" button for the first time.
   */
  markMirrorDialogueCompleted: () => void;

  /**
   * Resets the mirror dialogue flag to first-time state.
   * Used for testing and by the resetAll() console command.
   */
  resetMirrorDialogue: () => void;
}

export const useMirrorDialogueStore = create<MirrorDialogueState>()(
  persist(
    (set) => ({
      // Initial state - assume first visit
      firstMirrorDialogue: true,

      // Mark dialogue as completed (first visit done)
      markMirrorDialogueCompleted: () => {
        console.log("[MirrorDialogue] Marking dialogue as completed");
        set({ firstMirrorDialogue: false });
      },

      // Reset to first-time state (for testing)
      resetMirrorDialogue: () => {
        set({ firstMirrorDialogue: true });
        console.log("[MirrorDialogue] Reset firstMirrorDialogue flag to true");
      },
    }),
    {
      name: "amaze-politics-mirror-dialogue-v1",
      // Only persist the firstMirrorDialogue flag
      partialize: (state) => ({
        firstMirrorDialogue: state.firstMirrorDialogue,
      }),
    }
  )
);
