// src/hooks/useRoleCarousel.ts
// Custom hook for role selection carousel navigation
//
// Manages:
// - Carousel state (current index, direction)
// - Navigation logic (next/prev/goto)
// - Keyboard event handlers (arrow keys, enter)
// - Touch/swipe gesture detection
// - Experiment mode filtering (3 roles + 2 special items)
// - Locked role logic

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { PREDEFINED_ROLES_ARRAY, getRoleImagePaths, EXPERIMENT_PREDEFINED_ROLE_KEYS } from "../data/predefinedRoles";
import type { PredefinedRoleData } from "../data/predefinedRoles";
import { useSettingsStore } from "../store/settingsStore";
import { useLoggingStore } from "../store/loggingStore";
import { useRoleProgressStore } from "../store/roleProgressStore";
import { useLang } from "../i18n/lang";
import { useLogger } from "./useLogger";

const EXPERIMENT_ROLE_KEY_SET = new Set(EXPERIMENT_PREDEFINED_ROLE_KEYS);
const SWIPE_THRESHOLD = 50; // Minimum pixels to trigger swipe

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
  highScore?: number;
}

interface TouchPosition {
  x: number;
  y: number;
  time: number;
}

export const useRoleCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const touchStartRef = useRef<TouchPosition | null>(null);
  const touchMoveRef = useRef<TouchPosition | null>(null);

  const lang = useLang();
  const logger = useLogger();
  const experimentMode = useSettingsStore((s) => s.experimentMode);
  const experimentProgress = useLoggingStore((s) => s.experimentProgress);
  const roleGoals = useRoleProgressStore((s) => s.goals);

  // Build carousel items based on experiment mode
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

    // Add role items
    rolesToShow.forEach((roleData) => {
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
        highScore: roleGoals[roleData.legacyKey]?.bestScore ?? roleData.defaultHighScore,
      });
    });

    // Add "Suggest your own role" item (NOT in experiment mode)
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

    // Note: "Suggest a scenario" item removed - hidden for now

    return items;
  }, [experimentMode, experimentProgress, roleGoals, lang]);

  const currentItem = carouselItems[currentIndex];
  // Carousel is loopable - navigation always enabled
  const canNavigateNext = true;
  const canNavigatePrev = true;

  // Navigation functions with looping support
  const navigateToIndex = useCallback((newIndex: number, navDirection?: 'left' | 'right') => {
    if (carouselItems.length === 0) return;
    if (newIndex === currentIndex) return;

    // Wrap index around for looping
    let wrappedIndex = newIndex;
    if (newIndex < 0) {
      wrappedIndex = carouselItems.length - 1;
    } else if (newIndex >= carouselItems.length) {
      wrappedIndex = 0;
    }

    const dir = navDirection ?? (wrappedIndex > currentIndex ? 'right' : 'left');
    setDirection(dir);
    setCurrentIndex(wrappedIndex);

    // Log navigation
    const fromItem = carouselItems[currentIndex];
    const toItem = carouselItems[wrappedIndex];
    logger.log('role_carousel_navigate', {
      direction: dir,
      fromIndex: currentIndex,
      toIndex: wrappedIndex,
      fromId: fromItem.id,
      toId: toItem.id,
      fromType: fromItem.type,
      toType: toItem.type,
    }, `Carousel navigate ${dir}: ${fromItem.title} → ${toItem.title}`);
  }, [currentIndex, carouselItems, logger]);

  const navigateNext = useCallback(() => {
    // Loop to start when at end
    const nextIndex = currentIndex + 1 >= carouselItems.length ? 0 : currentIndex + 1;
    navigateToIndex(nextIndex, 'right');
  }, [currentIndex, carouselItems.length, navigateToIndex]);

  const navigatePrev = useCallback(() => {
    // Loop to end when at start
    const prevIndex = currentIndex - 1 < 0 ? carouselItems.length - 1 : currentIndex - 1;
    navigateToIndex(prevIndex, 'left');
  }, [currentIndex, carouselItems.length, navigateToIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigatePrev();
        logger.log('role_carousel_keyboard', { key: 'ArrowLeft', index: currentIndex }, 'Keyboard navigation: left arrow');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateNext();
        logger.log('role_carousel_keyboard', { key: 'ArrowRight', index: currentIndex }, 'Keyboard navigation: right arrow');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateNext, navigatePrev, currentIndex, logger]);

  // Touch/swipe handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    touchMoveRef.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    touchMoveRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current || !touchMoveRef.current) {
      touchStartRef.current = null;
      touchMoveRef.current = null;
      return;
    }

    const deltaX = touchMoveRef.current.x - touchStartRef.current.x;
    const deltaY = touchMoveRef.current.y - touchStartRef.current.y;
    const deltaTime = touchMoveRef.current.time - touchStartRef.current.time;
    const distance = Math.abs(deltaX);

    // Check if horizontal swipe (not vertical scroll)
    if (Math.abs(deltaX) > Math.abs(deltaY) && distance >= SWIPE_THRESHOLD) {
      const swipeDirection = deltaX > 0 ? 'right' : 'left';

      // Swipe right = navigate left (previous), swipe left = navigate right (next)
      if (swipeDirection === 'right') {
        navigatePrev();
        logger.log('role_carousel_swipe', {
          direction: 'right',
          distance,
          duration: deltaTime,
          action: 'previous',
        }, `Swipe right: navigate to previous (${distance}px, ${deltaTime}ms)`);
      } else if (swipeDirection === 'left') {
        navigateNext();
        logger.log('role_carousel_swipe', {
          direction: 'left',
          distance,
          duration: deltaTime,
          action: 'next',
        }, `Swipe left: navigate to next (${distance}px, ${deltaTime}ms)`);
      }
    }

    touchStartRef.current = null;
    touchMoveRef.current = null;
  }, [navigateNext, navigatePrev, logger]);

  return {
    currentIndex,
    currentItem,
    carouselItems,
    direction,
    navigateNext,
    navigatePrev,
    navigateToIndex,
    canNavigateNext,
    canNavigatePrev,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
};
