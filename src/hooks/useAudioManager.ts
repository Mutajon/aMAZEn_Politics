// src/hooks/useAudioManager.ts
/**
 * React hook wrapper for audioManager with settings store integration.
 * Provides convenient access to audio playback and volume controls.
 *
 * Usage:
 *   const { playMusic, playSfx } = useAudioManager();
 *   playMusic('background', true); // Start background music
 *   playSfx('click-soft'); // Play click sound
 */

import { useCallback, useEffect } from 'react';
import { audioManager, type MusicKey, type SfxKey } from '../lib/audioManager';
import { useSettingsStore } from '../store/settingsStore';

export function useAudioManager() {
  const musicEnabled = useSettingsStore((s) => s.musicEnabled);
  const musicVolume = useSettingsStore((s) => s.musicVolume);
  const sfxEnabled = useSettingsStore((s) => s.sfxEnabled);
  const sfxVolume = useSettingsStore((s) => s.sfxVolume);

  // Sync music mute state with audio manager
  useEffect(() => {
    audioManager.setMusicMuted(!musicEnabled);
  }, [musicEnabled]);

  // Sync music volume with audio manager
  useEffect(() => {
    audioManager.setMusicVolume(musicVolume);
  }, [musicVolume]);

  // Play music track (memoized to avoid unnecessary re-creation)
  const playMusic = useCallback((name: MusicKey, loop = true, volumeOverride?: number) => {
    audioManager.playMusic(name, loop, volumeOverride);
  }, []);

  // Play sound effect (memoized to avoid unnecessary re-creation)
  const playSfx = useCallback((name: SfxKey, volumeOverride?: number) => {
    audioManager.playSfx(name, volumeOverride);
  }, []);

  // Stop music
  const stopMusic = useCallback(() => {
    audioManager.stopMusic();
  }, []);

  return {
    playMusic,
    playSfx,
    stopMusic,
    musicEnabled,
    sfxEnabled,
    musicVolume,
    sfxVolume,
  };
}

export type { MusicKey, SfxKey };
