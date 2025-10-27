// src/data/achievements.ts
// Achievements system - defines all available achievements players can unlock
//
// NOTE: This is currently non-functional (under construction)
// Achievements are displayed in the Book of Achievements screen but not tracked
//
// Future functionality:
// - Track achievement progress in store
// - Unlock achievements based on game events
// - Display locked/unlocked states
// - Add achievement notifications during gameplay
//
// Connected to:
// - src/screens/AchievementsScreen.tsx: Display screen

import { createTranslatedConst } from '../i18n/useTranslatedConst';

// ========================================================================
// TYPES
// ========================================================================

/**
 * Achievement definition
 */
export interface Achievement {
  id: string;
  title: string;           // Achievement name (e.g., "Dictator's Dilemma")
  description: string;     // How to unlock (e.g., "Finish a game as a dictator")
  icon: string;            // Lucide icon name
  color: string;           // Color theme for the achievement
}

// ========================================================================
// ACHIEVEMENT POOL
// ========================================================================

/**
 * All available achievements in the game
 * Currently for display only (tracking not implemented)
 */
export const ACHIEVEMENT_POOL = createTranslatedConst((lang) => [
  {
    id: 'dictators-dilemma',
    title: lang("ACHIEVEMENT_DICTATORS_DILEMMA_TITLE"),
    description: lang("ACHIEVEMENT_DICTATORS_DILEMMA_DESC"),
    icon: 'Crown',
    color: 'purple',
  },
  {
    id: 'role-completionist',
    title: lang("ACHIEVEMENT_ROLE_COMPLETIONIST_TITLE"),
    description: lang("ACHIEVEMENT_ROLE_COMPLETIONIST_DESC"),
    icon: 'Trophy',
    color: 'gold',
  },
  {
    id: 'unicorn-ruler',
    title: lang("ACHIEVEMENT_UNICORN_RULER_TITLE"),
    description: lang("ACHIEVEMENT_UNICORN_RULER_DESC"),
    icon: 'Sparkles',
    color: 'pink',
  },
  {
    id: 'warmonger',
    title: lang("ACHIEVEMENT_WARMONGER_TITLE"),
    description: lang("ACHIEVEMENT_WARMONGER_DESC"),
    icon: 'Swords',
    color: 'red',
  },
  {
    id: 'revolutionary',
    title: lang("ACHIEVEMENT_REVOLUTIONARY_TITLE"),
    description: lang("ACHIEVEMENT_REVOLUTIONARY_DESC"),
    icon: 'RefreshCw',
    color: 'blue',
  },
  {
    id: 'fallen-leader',
    title: lang("ACHIEVEMENT_FALLEN_LEADER_TITLE"),
    description: lang("ACHIEVEMENT_FALLEN_LEADER_DESC"),
    icon: 'Skull',
    color: 'gray',
  },
  {
    id: 'peacemaker',
    title: lang("ACHIEVEMENT_PEACEMAKER_TITLE"),
    description: lang("ACHIEVEMENT_PEACEMAKER_DESC"),
    icon: 'Handshake',
    color: 'green',
  },
]);

// ========================================================================
// UTILITY FUNCTIONS
// ========================================================================

/**
 * Get achievement by ID
 * @param id Achievement ID
 * @param lang Language function
 * @returns Achievement or undefined if not found
 */
export function getAchievementById(id: string, lang: (key: string) => string): Achievement | undefined {
  const achievements = ACHIEVEMENT_POOL(lang);
  return achievements.find(a => a.id === id);
}

/**
 * Get all achievements
 * @param lang Language function
 * @returns Array of all achievements
 */
export function getAllAchievements(lang: (key: string) => string): Achievement[] {
  return [...ACHIEVEMENT_POOL(lang)];
}
