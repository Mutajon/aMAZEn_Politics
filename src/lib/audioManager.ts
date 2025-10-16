// src/lib/audioManager.ts
/**
 * Centralized audio management system for music and sound effects.
 * Provides separate volume controls, preloading, and mute functionality.
 *
 * Usage:
 *   audioManager.playMusic('background', true); // Loop background music
 *   audioManager.playSfx('click-soft'); // Play click sound
 *   audioManager.setMusicMuted(true); // Mute all music
 */

import { useSettingsStore } from '../store/settingsStore';

// Audio file registry
const AUDIO_FILES = {
  music: {
    'background': '/assets/sounds/tempBKGmusic.mp3',
  },
  sfx: {
    'achievement': '/assets/sounds/achievementsChimesShort.mp3',
    'coins': '/assets/sounds/coins.mp3',
    'click-soft': '/assets/sounds/click soft.mp3', // Note: filename has space
    'drumroll': '/assets/sounds/Drum Roll Medium.mp3', // Note: filename has spaces
  },
} as const;

type MusicKey = keyof typeof AUDIO_FILES.music;
type SfxKey = keyof typeof AUDIO_FILES.sfx;

class AudioManager {
  private musicTracks: Map<MusicKey, HTMLAudioElement> = new Map();
  private sfxTracks: Map<SfxKey, HTMLAudioElement> = new Map();
  private currentMusic: HTMLAudioElement | null = null;
  private initialized = false;

  /**
   * Initialize audio manager - preload all audio files
   * Call this once on app startup
   */
  init() {
    if (this.initialized) return;

    // Preload music tracks
    Object.entries(AUDIO_FILES.music).forEach(([key, path]) => {
      const audio = new Audio(path);
      audio.preload = 'auto';
      this.musicTracks.set(key as MusicKey, audio);
    });

    // Preload sound effects
    Object.entries(AUDIO_FILES.sfx).forEach(([key, path]) => {
      const audio = new Audio(path);
      audio.preload = 'auto';
      this.sfxTracks.set(key as SfxKey, audio);
    });

    this.initialized = true;
    console.log('🎵 AudioManager initialized');
  }

  /**
   * Play background music track
   * @param name - Music track name (e.g., 'background')
   * @param loop - Whether to loop the track (default: true)
   * @param volumeOverride - Optional volume override (0.0 - 1.0)
   */
  playMusic(name: MusicKey, loop = true, volumeOverride?: number) {
    const settings = useSettingsStore.getState();

    // Check if music is enabled
    if (!settings.musicEnabled) {
      console.log(`🎵 Music disabled, skipping: ${name}`);
      return;
    }

    const audio = this.musicTracks.get(name);
    if (!audio) {
      console.warn(`🎵 Music track not found: ${name}`);
      return;
    }

    // Stop current music if different track
    if (this.currentMusic && this.currentMusic !== audio) {
      this.currentMusic.pause();
      this.currentMusic.currentTime = 0;
    }

    // Set volume and loop
    audio.volume = volumeOverride ?? settings.musicVolume;
    audio.loop = loop;

    // Play (with error handling)
    audio.play().catch((err) => {
      console.warn(`🎵 Music playback failed for ${name}:`, err);
    });

    this.currentMusic = audio;
    console.log(`🎵 Playing music: ${name} (volume: ${audio.volume.toFixed(2)}, loop: ${loop})`);
  }

  /**
   * Play sound effect
   * @param name - SFX name (e.g., 'click-soft', 'coins')
   * @param volumeOverride - Optional volume override (0.0 - 1.0)
   */
  playSfx(name: SfxKey, volumeOverride?: number) {
    const settings = useSettingsStore.getState();

    // Check if SFX is enabled
    if (!settings.sfxEnabled) {
      return; // Silent fail for better UX
    }

    const audio = this.sfxTracks.get(name);
    if (!audio) {
      console.warn(`🔊 SFX not found: ${name}`);
      return;
    }

    // Clone audio node to allow overlapping sounds
    const clone = audio.cloneNode() as HTMLAudioElement;
    clone.volume = volumeOverride ?? settings.sfxVolume ?? 1.0;

    // Play (with error handling)
    clone.play().catch((err) => {
      console.warn(`🔊 SFX playback failed for ${name}:`, err);
    });
  }

  /**
   * Stop current background music
   */
  stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic.currentTime = 0;
      this.currentMusic = null;
      console.log('🎵 Music stopped');
    }
  }

  /**
   * Update music volume (affects currently playing track)
   * @param volume - Volume level (0.0 - 1.0)
   */
  setMusicVolume(volume: number) {
    const clamped = Math.max(0, Math.min(1, volume));
    if (this.currentMusic) {
      this.currentMusic.volume = clamped;
    }
    console.log(`🎵 Music volume: ${clamped.toFixed(2)}`);
  }

  /**
   * Toggle music mute state
   * @param muted - Whether to mute music
   */
  setMusicMuted(muted: boolean) {
    if (muted) {
      if (this.currentMusic && !this.currentMusic.paused) {
        this.currentMusic.pause();
        console.log('🎵 Music muted');
      }
    } else {
      if (this.currentMusic && this.currentMusic.paused) {
        this.currentMusic.play().catch((err) => {
          console.warn('🎵 Music resume failed:', err);
        });
        console.log('🎵 Music unmuted');
      }
    }
  }

  /**
   * Get list of available music tracks
   */
  getMusicTracks(): MusicKey[] {
    return Array.from(this.musicTracks.keys());
  }

  /**
   * Get list of available sound effects
   */
  getSfxTracks(): SfxKey[] {
    return Array.from(this.sfxTracks.keys());
  }
}

// Singleton instance
export const audioManager = new AudioManager();

// Auto-initialize on import (safe for hot-reload)
if (!audioManager['initialized']) {
  audioManager.init();
}

export type { MusicKey, SfxKey };
