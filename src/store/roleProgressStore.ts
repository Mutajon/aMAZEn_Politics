// src/store/roleProgressStore.ts
// Persists goal progress for predefined roles (score targets and completion status).

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  PREDEFINED_ROLES_ARRAY,
  type RoleGoalStatus,
} from "../data/predefinedRoles";

type RoleGoal = {
  goal: number;
  status: RoleGoalStatus;
  bestScore: number;
};

type RoleProgressState = {
  goals: Record<string, RoleGoal>;
  setRoleGoalStatus: (roleKey: string, status: RoleGoalStatus) => void;
  setRoleBestScore: (roleKey: string, score: number) => void;
  resetRoleGoals: () => void;
};

const defaultGoals = (): Record<string, RoleGoal> =>
  PREDEFINED_ROLES_ARRAY.reduce<Record<string, RoleGoal>>((acc, role) => {
    acc[role.legacyKey] = {
      goal: role.scoreGoal,
      status: role.defaultGoalStatus,
      bestScore: role.defaultHighScore,
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
      }),
      version: 2,
      migrate: (persistedState, version) => {
        const stored = (persistedState as RoleProgressState | undefined)?.goals;
        const overwriteGoals = version === undefined || version < 2;
        return {
          goals: mergeWithDefaults(stored, overwriteGoals),
        };
      },
    }
  )
);

export function getRoleGoal(roleKey: string | null | undefined): RoleGoal | null {
  if (!roleKey) return null;
  const { goals } = useRoleProgressStore.getState();
  return goals[roleKey] ?? null;
}
