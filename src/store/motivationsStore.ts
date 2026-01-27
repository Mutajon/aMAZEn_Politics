// src/store/motivationsStore.ts
// Manages personal motivations questionnaire state (10 values from "What" dimension)

import { create } from "zustand";
import { persist } from "zustand/middleware";

type MotivationsState = {
    // Distribution (10 values corresponding to what dimension in compass-data.ts)
    distribution: number[];

    // Actions
    setDistribution: (values: number[]) => void;
    reset: () => void;
};

// Default: all zeros (player must manually distribute 20 points)
const DEFAULT_DISTRIBUTION = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

export const useMotivationsStore = create<MotivationsState>()(
    persist(
        (set) => ({
            distribution: [...DEFAULT_DISTRIBUTION],

            setDistribution: (values) =>
                set({ distribution: values }),

            reset: () =>
                set({
                    distribution: [...DEFAULT_DISTRIBUTION],
                }),
        }),
        {
            name: "personal-motivations",
            partialize: (s) => ({
                distribution: s.distribution,
            }),
        }
    )
);
