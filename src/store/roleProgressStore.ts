// src/store/roleProgressStore.ts
// Persists goal progress for predefined roles (score targets and completion status).

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  PREDEFINED_ROLES_ARRAY,
  type RoleGoalStatus,
} from "../data/predefinedRoles";
import { useFragmentsStore } from "./fragmentsStore";

// ============================================================================
// EXPERIMENT ROUND VERSION
// Increment this when starting a new experiment round to reset all player progress.
// ============================================================================
const CURRENT_EXPERIMENT_ROUND = 3;

type RoleGoal = {
  goal: number;
  status: RoleGoalStatus;
  bestScore: number;
};

type RoleProgressState = {
  goals: Record<string, RoleGoal>;
  experimentRound: number; // Tracks which experiment round the player is on
  setRoleGoalStatus: (roleKey: string, status: RoleGoalStatus) => void;
  setRoleBestScore: (roleKey: string, score: number) => void;
  resetRoleGoals: () => void;
};

const defaultGoals = (): Record<string, RoleGoal> =>
  PREDEFINED_ROLES_ARRAY.reduce<Record<string, RoleGoal>>((acc, role) => {
    acc[role.legacyKey] = {
      goal: role.scoreGoal,
      status: role.defaultGoalStatus,
      bestScore: (role as { defaultHighScore?: number }).defaultHighScore ?? 0,
    };
    return acc;
  }, {});

function mergeWithDefaults(
  existing: Record<string, RoleGoal> | undefined,
  overwriteGoals = false
) {
  const base = defaultGoals();
  if (!existing) return base;

  for (const [key, value] of Object.entries(base)) {
    const stored = existing[key];
    if (stored) {
      base[key] = {
        goal: overwriteGoals ? value.goal : stored.goal ?? value.goal,
        status: stored.status,
        bestScore: Math.max(value.bestScore, stored.bestScore || 0),
      };
    }
  }
  return base;
}

export const useRoleProgressStore = create<RoleProgressState>()(
  persist(
    (set) => ({
      goals: mergeWithDefaults(undefined),
      experimentRound: CURRENT_EXPERIMENT_ROUND,
      setRoleGoalStatus: (roleKey, status) =>
        set((state) => {
          const current = mergeWithDefaults(state.goals);
          if (!current[roleKey]) {
            return state;
          }
          current[roleKey] = {
            goal: current[roleKey].goal,
            status,
            bestScore: current[roleKey].bestScore,
          };
          return { goals: current };
        }),
      setRoleBestScore: (roleKey, score) =>
        set((state) => {
          const current = mergeWithDefaults(state.goals);
          const existing = current[roleKey];
          if (!existing) return state;
          if (score <= existing.bestScore) return state;
          current[roleKey] = {
            ...existing,
            bestScore: score,
          };
          return { goals: current };
        }),
      resetRoleGoals: () => set({ goals: mergeWithDefaults(undefined) }),
    }),
    {
      name: "role-progress-v2",
      partialize: (state) => ({
        goals: state.goals,
        experimentRound: state.experimentRound,
      }),
      version: 2,
      migrate: (persistedState, version) => {
        const stored = (persistedState as RoleProgressState | undefined)?.goals;
        const overwriteGoals = version === undefined || version < 2;
        return {
          goals: mergeWithDefaults(stored, overwriteGoals),
        };
      },
      // Merge defaults after hydration to ensure new roles are always added
      // Also check for experiment round change and reset if needed
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Check for experiment round change
          const storedRound = state.experimentRound || 1;
          if (storedRound < CURRENT_EXPERIMENT_ROUND) {
            console.log(`[RoleProgress] 🔄 Experiment round changed (${storedRound} → ${CURRENT_EXPERIMENT_ROUND}). Resetting progress...`);

            // Reset role goals
            state.goals = mergeWithDefaults(undefined);
            state.experimentRound = CURRENT_EXPERIMENT_ROUND;

            // Also reset fragments store (clears shards)
            const fragmentsStore = useFragmentsStore.getState();
            fragmentsStore.clearFragments();
            fragmentsStore.resetIntro();

            console.log(`[RoleProgress] ✅ Progress reset complete for Round ${CURRENT_EXPERIMENT_ROUND}`);
          } else {
            // Normal hydration - just merge defaults
            state.goals = mergeWithDefaults(state.goals, false);
          }
        }
      },
    }
  )
);

export function getRoleGoal(roleKey: string | null | undefined): RoleGoal | null {
  if (!roleKey) return null;
  const { goals } = useRoleProgressStore.getState();
  return goals[roleKey] ?? null;
}
