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
export const ACHIEVEMENT_POOL: Achievement[] = [
  {
    id: 'dictators-dilemma',
    title: "Dictator's Dilemma",
    description: 'Complete a full game as a dictator',
    icon: 'Crown',
    color: 'purple',
  },
  {
    id: 'role-completionist',
    title: 'Role Completionist',
    description: 'Complete the game with all pre-existing roles',
    icon: 'Trophy',
    color: 'gold',
  },
  {
    id: 'unicorn-ruler',
    title: 'Unicorn Ruler',
    description: 'Complete a game as the unicorn king',
    icon: 'Sparkles',
    color: 'pink',
  },
  {
    id: 'warmonger',
    title: 'Warmonger',
    description: 'Trigger a world war during your rule',
    icon: 'Swords',
    color: 'red',
  },
  {
    id: 'revolutionary',
    title: 'Revolutionary',
    description: 'Trigger a political system change in your game',
    icon: 'RefreshCw',
    color: 'blue',
  },
  {
    id: 'fallen-leader',
    title: 'Fallen Leader',
    description: 'Get assassinated during your rule',
    icon: 'Skull',
    color: 'gray',
  },
  {
    id: 'peacemaker',
    title: 'Peacemaker',
    description: 'Sign a peace treaty during your rule',
    icon: 'Handshake',
    color: 'green',
  },
];

// ========================================================================
// UTILITY FUNCTIONS
// ========================================================================

/**
 * Get achievement by ID
 * @param id Achievement ID
 * @returns Achievement or undefined if not found
 */
export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENT_POOL.find(a => a.id === id);
}

/**
 * Get all achievements
 * @returns Array of all achievements
 */
export function getAllAchievements(): Achievement[] {
  return [...ACHIEVEMENT_POOL];
}
