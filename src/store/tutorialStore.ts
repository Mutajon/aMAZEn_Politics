import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Tutorial Store
 *
 * Manages first-time player tutorial state with localStorage persistence.
 * Tutorial shows two tips: Day 1 (avatar) and Day 2 (support values).
 *
 * Once marked as "has played before", tutorial will never show again.
 */

interface TutorialState {
  /** True if player has ever started a game (persisted) */
  hasPlayedBefore: boolean;

  /** True if Day 1 avatar tip has been shown (persisted) */
  day1TipShown: boolean;

  /** True if Day 2 support tip has been shown (persisted) */
  day2TipShown: boolean;

  /** Mark Day 1 tip as shown */
  markDay1TipShown: () => void;

  /** Mark Day 2 tip as shown */
  markDay2TipShown: () => void;

  /** Mark player as having played before (called on first game start) */
  markHasPlayedBefore: () => void;

  /** Reset tutorial state (for testing only) */
  resetTutorial: () => void;
}

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set) => ({
      hasPlayedBefore: false,
      day1TipShown: false,
      day2TipShown: false,

      markDay1TipShown: () => set({ day1TipShown: true }),

      markDay2TipShown: () => set({ day2TipShown: true }),

      markHasPlayedBefore: () => set({ hasPlayedBefore: true }),

      resetTutorial: () => set({
        hasPlayedBefore: false,
        day1TipShown: false,
        day2TipShown: false,
      }),
    }),
    {
      name: 'tutorial-v1', // localStorage key
    }
  )
);

// Expose resetTutorial globally for browser console testing
if (typeof window !== 'undefined') {
  (window as any).resetTutorial = () => {
    useTutorialStore.getState().resetTutorial();
    console.log('Tutorial reset! Refresh the page and start a new game to see tutorial again.');
  };
}
