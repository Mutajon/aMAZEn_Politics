// src/hooks/useRoleCarousel.ts
// Custom hook for role selection data and logic
//
// Manages:
// - Role list generation based on data
// - Experiment mode filtering (3 roles + 2 special items)
// - Locked role logic

import { useMemo } from "react";
import { PREDEFINED_ROLES_ARRAY, getRoleImagePaths, EXPERIMENT_PREDEFINED_ROLE_KEYS } from "../data/predefinedRoles";
import type { PredefinedRoleData } from "../data/predefinedRoles";
import { useSettingsStore } from "../store/settingsStore";
import { useLoggingStore } from "../store/loggingStore";
import { useRoleProgressStore } from "../store/roleProgressStore";
import { useLang } from "../i18n/lang";

const EXPERIMENT_ROLE_KEY_SET = new Set(EXPERIMENT_PREDEFINED_ROLE_KEYS);

export type CarouselItemType = 'role' | 'customRole' | 'scenario';

export interface CarouselItem {
  type: CarouselItemType;
  id: string;
  title: string;
  subtitle?: string;
  intro?: string;
  youAre?: string;
  year?: string;
  backgroundImage: string;
  bannerImage?: string;
  isLocked: boolean;
  lockReason?: string;
  role?: PredefinedRoleData;
  roleKey?: string;
  scoreGoal?: number;
  goalStatus?: string;
}

export const useRoleCarousel = () => {
  const lang = useLang();
  const experimentMode = useSettingsStore((s) => s.experimentMode);
  const experimentProgress = useLoggingStore((s) => s.experimentProgress);
  const roleGoals = useRoleProgressStore((s) => s.goals);

  // Build items based on experiment mode
  const carouselItems = useMemo<CarouselItem[]>(() => {
    const items: CarouselItem[] = [];

    // Filter roles based on experiment mode
    const rolesToShow = experimentMode
      ? PREDEFINED_ROLES_ARRAY.filter((role) => EXPERIMENT_ROLE_KEY_SET.has(role.legacyKey))
      : PREDEFINED_ROLES_ARRAY;

    // Calculate experiment progress
    const experimentCompletedRoles = experimentProgress.completedRoles;
    const experimentCompletedCount = EXPERIMENT_PREDEFINED_ROLE_KEYS.reduce(
      (count, key) => count + (experimentCompletedRoles?.[key] ? 1 : 0),
      0
    );
    const experimentAllCompleted = experimentCompletedCount >= EXPERIMENT_PREDEFINED_ROLE_KEYS.length;

    // Determine if a role is unlocked in experiment mode
    const isExperimentRoleUnlocked = (roleKey: string) => {
      if (!experimentMode) {
        return true;
      }
      if (!EXPERIMENT_ROLE_KEY_SET.has(roleKey)) {
        return false;
      }
      if (experimentAllCompleted) {
        return false;
      }
      if (experimentCompletedRoles?.[roleKey]) {
        return false;
      }
      const roleIndex = EXPERIMENT_PREDEFINED_ROLE_KEYS.indexOf(roleKey);
      if (roleIndex === -1) {
        return false;
      }
      return roleIndex === experimentCompletedCount;
    };

    // Get lock reason for a role
    const getLockReason = (roleKey: string): string => {
      if (experimentCompletedRoles?.[roleKey]) {
        return "Already completed";
      }
      if (experimentAllCompleted) {
        return "All roles completed";
      }
      // Find previous role in sequence
      const roleIndex = EXPERIMENT_PREDEFINED_ROLE_KEYS.indexOf(roleKey);
      if (roleIndex > 0) {
        const prevRoleKey = EXPERIMENT_PREDEFINED_ROLE_KEYS[roleIndex - 1];
        const prevRole = PREDEFINED_ROLES_ARRAY.find(r => r.legacyKey === prevRoleKey);
        if (prevRole) {
          return `Complete ${lang(prevRole.titleKey)} to unlock`;
        }
      }
      return "Locked";
    };

    // Add "Suggest your own role" item (NOT in experiment mode) - MOVE TO TOP
    if (!experimentMode) {
      items.push({
        type: 'customRole',
        id: 'custom-role',
        title: '❓',
        subtitle: undefined,
        backgroundImage: '/assets/images/BKGs/mainBKG.jpg',
        isLocked: false,
      });
    }

    // Add role items
    rolesToShow.forEach((roleData) => {
      // Filter out Tel Aviv and Planet Namek
      if (roleData.id === 'telaviv_2025' || roleData.id === 'namek_2099') {
        return;
      }

      const images = getRoleImagePaths(roleData.imageId);
      const isLocked = !isExperimentRoleUnlocked(roleData.legacyKey);

      items.push({
        type: 'role',
        id: roleData.legacyKey,
        roleKey: roleData.legacyKey,
        title: lang(roleData.titleKey),
        subtitle: lang(roleData.subtitleKey),
        intro: lang(roleData.introKey),
        youAre: lang(roleData.youAreKey),
        year: roleData.year,
        backgroundImage: images.full,
        bannerImage: images.banner,
        isLocked,
        lockReason: isLocked ? getLockReason(roleData.legacyKey) : undefined,
        role: roleData,
        scoreGoal: roleData.scoreGoal,
        goalStatus: roleGoals[roleData.legacyKey]?.status ?? roleData.defaultGoalStatus,
      });
    });

    return items;
  }, [experimentMode, experimentProgress, roleGoals, lang]);

  return {
    carouselItems,
  };
};

