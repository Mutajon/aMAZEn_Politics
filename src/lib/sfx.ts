// src/lib/sfx.ts
// Sound effects helper using centralized audioManager
// Ensures all SFX respect global mute settings

import { audioManager } from './audioManager';

/**
 * Play achievement chime for compass pills
 * Uses audioManager to respect SFX mute setting
 */
export const playPillsChime = () => {
  audioManager.playSfx('achievement', 0.7);
};
  