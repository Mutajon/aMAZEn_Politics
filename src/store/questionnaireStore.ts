// questionnaireStore.ts
// Manages power distribution questionnaire state
// Initial questionnaire: Q1 = current distribution, Q2 = ideal distribution
// Post-game questionnaire: After 3 games, asks ideal distribution again

import { create } from "zustand";
import { persist } from "zustand/middleware";

type QuestionnaireState = {
  // Initial questionnaire completion
  hasCompleted: boolean;
  completedAt: number | null;

  // Q1: Current distribution (10 values, sum = 20)
  currentDistribution: number[];
  currentReasoning: string | null;

  // Q2: Ideal distribution (10 values, sum = 20)
  idealDistribution: number[];
  idealReasoning: string | null;

  // Post-game questionnaire (after 3 games + shard selection)
  hasCompletedPostGame: boolean;
  postGameCompletedAt: number | null;
  postGameIdealDistribution: number[];
  postGameIdealReasoning: string | null;

  // Actions - Initial questionnaire
  setCurrentDistribution: (values: number[]) => void;
  setCurrentReasoning: (text: string) => void;
  setIdealDistribution: (values: number[]) => void;
  setIdealReasoning: (text: string) => void;
  markCompleted: () => void;

  // Actions - Post-game questionnaire
  setPostGameIdealDistribution: (values: number[]) => void;
  setPostGameIdealReasoning: (text: string) => void;
  markPostGameCompleted: () => void;

  // Reset
  reset: () => void;
};

// Default: all zeros (player must manually distribute 20 points)
const DEFAULT_DISTRIBUTION = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

export const useQuestionnaireStore = create<QuestionnaireState>()(
  persist(
    (set) => ({
      // Initial questionnaire state
      hasCompleted: false,
      completedAt: null,
      currentDistribution: [...DEFAULT_DISTRIBUTION],
      currentReasoning: null,
      idealDistribution: [...DEFAULT_DISTRIBUTION],
      idealReasoning: null,

      // Post-game questionnaire state
      hasCompletedPostGame: false,
      postGameCompletedAt: null,
      postGameIdealDistribution: [...DEFAULT_DISTRIBUTION],
      postGameIdealReasoning: null,

      // Initial questionnaire actions
      setCurrentDistribution: (values) =>
        set({ currentDistribution: values }),

      setCurrentReasoning: (text) =>
        set({ currentReasoning: text }),

      setIdealDistribution: (values) =>
        set({ idealDistribution: values }),

      setIdealReasoning: (text) =>
        set({ idealReasoning: text }),

      markCompleted: () =>
        set({
          hasCompleted: true,
          completedAt: Date.now(),
        }),

      // Post-game questionnaire actions
      setPostGameIdealDistribution: (values) =>
        set({ postGameIdealDistribution: values }),

      setPostGameIdealReasoning: (text) =>
        set({ postGameIdealReasoning: text }),

      markPostGameCompleted: () =>
        set({
          hasCompletedPostGame: true,
          postGameCompletedAt: Date.now(),
        }),

      // Full reset
      reset: () =>
        set({
          hasCompleted: false,
          completedAt: null,
          currentDistribution: [...DEFAULT_DISTRIBUTION],
          currentReasoning: null,
          idealDistribution: [...DEFAULT_DISTRIBUTION],
          idealReasoning: null,
          hasCompletedPostGame: false,
          postGameCompletedAt: null,
          postGameIdealDistribution: [...DEFAULT_DISTRIBUTION],
          postGameIdealReasoning: null,
        }),
    }),
    {
      name: "questionnaire-v2",
      partialize: (s) => ({
        hasCompleted: s.hasCompleted,
        completedAt: s.completedAt,
        currentDistribution: s.currentDistribution,
        currentReasoning: s.currentReasoning,
        idealDistribution: s.idealDistribution,
        idealReasoning: s.idealReasoning,
        hasCompletedPostGame: s.hasCompletedPostGame,
        postGameCompletedAt: s.postGameCompletedAt,
        postGameIdealDistribution: s.postGameIdealDistribution,
        postGameIdealReasoning: s.postGameIdealReasoning,
      }),
    }
  )
);
