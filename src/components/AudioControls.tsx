// src/components/AudioControls.tsx
/**
 * Semi-transparent audio control buttons for music and sound effects.
 * Displays at top-left of screen, persists across all game screens.
 *
 * Features:
 * - Music toggle (left button)
 * - SFX toggle (right button)
 * - Icons change based on mute state
 * - Hover effects and smooth transitions
 */

import { Music, Volume2, VolumeX } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useNarrator } from '../hooks/useNarrator';
import { useLogger } from '../hooks/useLogger';

export default function AudioControls() {
  const musicEnabled = useSettingsStore((s) => s.musicEnabled);
  const sfxEnabled = useSettingsStore((s) => s.sfxEnabled);
  const toggleMusicEnabled = useSettingsStore((s) => s.toggleMusicEnabled);
  const toggleSfxEnabled = useSettingsStore((s) => s.toggleSfxEnabled);
  const setNarrationEnabled = useSettingsStore((s) => s.setNarrationEnabled);

  const narrator = useNarrator();
  const logger = useLogger();

  // Handle music toggle
  const handleMusicToggle = () => {
    const newMusicState = !musicEnabled;
    logger.log(
      'button_click_music_toggle',
      newMusicState ? 'unmute' : 'mute',
      `User ${newMusicState ? 'unmuted' : 'muted'} music`
    );

    toggleMusicEnabled();
  };

  // Handle SFX toggle - also controls narration
  const handleSfxToggle = () => {
    const newSfxState = !sfxEnabled;

    logger.log(
      'button_click_sfx_toggle',
      newSfxState ? 'unmute' : 'mute',
      `User ${newSfxState ? 'unmuted' : 'muted'} sound effects`
    );

    toggleSfxEnabled();

    // Mirror SFX state to narration (prevents TTS API requests when muted)
    setNarrationEnabled(newSfxState);

    // Stop playing narration immediately when muting
    if (!newSfxState) {
      narrator.stop();
    }
  };

  return (
    <div className="fixed top-4 left-4 z-50 flex flex-col items-center gap-2">
      {/* Music Toggle Button */}
      <button
        type="button"
        onClick={handleMusicToggle}
        className="
          group
          flex items-center justify-center
          w-10 h-10
          rounded-lg
          bg-gray-900/60 backdrop-blur-sm
          border border-white/20
          hover:bg-gray-900/80 hover:border-white/30
          transition-all duration-200
          shadow-lg hover:shadow-xl
        "
        aria-label={musicEnabled ? 'Mute music' : 'Unmute music'}
        title={musicEnabled ? 'Mute music' : 'Unmute music'}
      >
        {musicEnabled ? (
          <Music className="w-5 h-5 text-amber-400 group-hover:text-amber-300 transition-colors" />
        ) : (
          <Music className="w-5 h-5 text-gray-500 group-hover:text-gray-400 transition-colors opacity-50" />
        )}
      </button>

      {/* SFX Toggle Button */}
      <button
        type="button"
        onClick={handleSfxToggle}
        className="
          group
          flex items-center justify-center
          w-10 h-10
          rounded-lg
          bg-gray-900/60 backdrop-blur-sm
          border border-white/20
          hover:bg-gray-900/80 hover:border-white/30
          transition-all duration-200
          shadow-lg hover:shadow-xl
        "
        aria-label={sfxEnabled ? 'Mute sound effects & narration' : 'Unmute sound effects & narration'}
        title={sfxEnabled ? 'Mute sound effects & narration' : 'Unmute sound effects & narration'}
      >
        {sfxEnabled ? (
          <Volume2 className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
        ) : (
          <VolumeX className="w-5 h-5 text-gray-500 group-hover:text-gray-400 transition-colors" />
        )}
      </button>
    </div>
  );
}
