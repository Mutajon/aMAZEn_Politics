// src/components/AudioControls.tsx
/**
 * Semi-transparent audio control buttons for music and sound effects.
 * Displays at top-left of screen, persists across all game screens.
 *
 * Features:
 * - Music icon with volume slider (top button)
 * - SFX toggle (bottom button)
 * - Icons change based on mute state
 * - Hover effects and smooth transitions
 */

import { useState, useRef, useEffect } from 'react';
import { Music, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '../store/settingsStore';
import { useNarrator } from '../hooks/useNarrator';
import { useLogger } from '../hooks/useLogger';
import { lang } from '../i18n/lang';

export default function AudioControls() {
  const musicEnabled = useSettingsStore((s) => s.musicEnabled);
  const musicVolume = useSettingsStore((s) => s.musicVolume);
  const setMusicVolume = useSettingsStore((s) => s.setMusicVolume);
  const sfxEnabled = useSettingsStore((s) => s.sfxEnabled);
  const toggleSfxEnabled = useSettingsStore((s) => s.toggleSfxEnabled);
  const setNarrationEnabled = useSettingsStore((s) => s.setNarrationEnabled);
  const isMobile = useSettingsStore((s) => s.isMobileDevice);

  const [showMusicSlider, setShowMusicSlider] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const narrator = useNarrator();
  const logger = useLogger();

  // Close slider when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sliderRef.current && !sliderRef.current.contains(event.target as Node)) {
        setShowMusicSlider(false);
      }
    };

    if (showMusicSlider) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMusicSlider]);

  // Handle music icon click - toggle slider visibility
  const handleMusicClick = () => {
    const newSliderState = !showMusicSlider;
    logger.log(
      'button_click_music_icon',
      newSliderState ? 'open_slider' : 'close_slider',
      `User ${newSliderState ? 'opened' : 'closed'} music volume slider`
    );
    setShowMusicSlider(newSliderState);
  };

  // Handle music volume change
  const handleVolumeChange = (newVolume: number) => {
    logger.log(
      'slider_music_volume_change',
      { oldVolume: musicVolume, newVolume },
      `User adjusted music volume from ${Math.round(musicVolume * 100)}% to ${Math.round(newVolume * 100)}%`
    );
    setMusicVolume(newVolume);
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
    <div className="fixed bottom-4 ltr:left-4 rtl:right-4 z-50 flex flex-row items-center gap-2" ref={sliderRef}>
      {/* Music Volume Slider - positioned to the left of buttons */}
      <AnimatePresence>
        {showMusicSlider && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="
              w-40
              p-3
              rounded-lg
              bg-gray-900/90 backdrop-blur-md
              border border-white/30
              shadow-2xl
            "
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-gray-300">
                <span className="font-medium">{lang("MUSIC_VOLUME")}</span>
                <span className="text-amber-400">{Math.round(musicVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={musicVolume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="
                  w-full h-2 
                  rounded-lg 
                  appearance-none 
                  bg-gray-700/50
                  cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:h-4
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-amber-400
                  [&::-webkit-slider-thumb]:hover:bg-amber-300
                  [&::-webkit-slider-thumb]:transition-colors
                  [&::-webkit-slider-thumb]:shadow-lg
                  [&::-moz-range-thumb]:w-4
                  [&::-moz-range-thumb]:h-4
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:bg-amber-400
                  [&::-moz-range-thumb]:hover:bg-amber-300
                  [&::-moz-range-thumb]:transition-colors
                  [&::-moz-range-thumb]:border-0
                  [&::-moz-range-thumb]:shadow-lg
                "
                aria-label="Music volume"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-row items-center gap-2">
        {/* Music Icon Button (Now on the Left) */}
        <button
          type="button"
          onClick={handleMusicClick}
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
          aria-label="Adjust music volume"
          title="Adjust music volume"
        >
          <Music
            className={`w-5 h-5 transition-colors ${musicVolume > 0
              ? 'text-amber-400 group-hover:text-amber-300'
              : 'text-gray-500 group-hover:text-gray-400 opacity-50'
              }`}
          />
        </button>

        {/* SFX Toggle Button (Now on the Right) */}
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
    </div>
  );
}

/**
 * Inline audio buttons for mobile ResourceBar
 * Horizontal layout, smaller buttons, no fixed positioning
 */
export function AudioButtonsInline() {
  const musicVolume = useSettingsStore((s) => s.musicVolume);
  const setMusicVolume = useSettingsStore((s) => s.setMusicVolume);
  const sfxEnabled = useSettingsStore((s) => s.sfxEnabled);
  const toggleSfxEnabled = useSettingsStore((s) => s.toggleSfxEnabled);
  const setNarrationEnabled = useSettingsStore((s) => s.setNarrationEnabled);

  const [showMusicSlider, setShowMusicSlider] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const narrator = useNarrator();
  const logger = useLogger();

  // Close slider when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sliderRef.current && !sliderRef.current.contains(event.target as Node)) {
        setShowMusicSlider(false);
      }
    };

    if (showMusicSlider) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMusicSlider]);

  const handleMusicClick = () => {
    const newSliderState = !showMusicSlider;
    logger.log(
      'button_click_music_icon',
      newSliderState ? 'open_slider' : 'close_slider',
      `User ${newSliderState ? 'opened' : 'closed'} music volume slider`
    );
    setShowMusicSlider(newSliderState);
  };

  const handleVolumeChange = (newVolume: number) => {
    logger.log(
      'slider_music_volume_change',
      { oldVolume: musicVolume, newVolume },
      `User adjusted music volume from ${Math.round(musicVolume * 100)}% to ${Math.round(newVolume * 100)}%`
    );
    setMusicVolume(newVolume);
  };

  const handleSfxToggle = () => {
    const newSfxState = !sfxEnabled;

    logger.log(
      'button_click_sfx_toggle',
      newSfxState ? 'unmute' : 'mute',
      `User ${newSfxState ? 'unmuted' : 'muted'} sound effects`
    );

    toggleSfxEnabled();
    setNarrationEnabled(newSfxState);

    if (!newSfxState) {
      narrator.stop();
    }
  };

  return (
    <div className="relative flex flex-col items-center gap-1" ref={sliderRef}>
      <div className="flex flex-col items-center gap-1">
        {/* Music Icon Button - smaller for inline */}
        <button
          type="button"
          onClick={handleMusicClick}
          className="
            group
            flex items-center justify-center
            w-8 h-8
            rounded-lg
            bg-gray-900/60 backdrop-blur-sm
            border border-white/20
            hover:bg-gray-900/80 hover:border-white/30
            transition-all duration-200
            shadow-lg
          "
          aria-label="Adjust music volume"
          title="Adjust music volume"
        >
          <Music
            className={`w-4 h-4 transition-colors ${musicVolume > 0
              ? 'text-amber-400 group-hover:text-amber-300'
              : 'text-gray-500 group-hover:text-gray-400 opacity-50'
              }`}
          />
        </button>

        {/* SFX Toggle Button - smaller for inline */}
        <button
          type="button"
          onClick={handleSfxToggle}
          className="
            group
            flex items-center justify-center
            w-8 h-8
            rounded-lg
            bg-gray-900/60 backdrop-blur-sm
            border border-white/20
            hover:bg-gray-900/80 hover:border-white/30
            transition-all duration-200
            shadow-lg
          "
          aria-label={sfxEnabled ? 'Mute sound effects' : 'Unmute sound effects'}
          title={sfxEnabled ? 'Mute sound effects' : 'Unmute sound effects'}
        >
          {sfxEnabled ? (
            <Volume2 className="w-4 h-4 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
          ) : (
            <VolumeX className="w-4 h-4 text-gray-500 group-hover:text-gray-400 transition-colors" />
          )}
        </button>
      </div>

      {/* Music Volume Slider Popup - positioned below buttons */}
      {showMusicSlider && (
        <div
          className="
            absolute top-full mt-1 left-1/2 -translate-x-1/2
            w-32
            p-2
            rounded-lg
            bg-gray-900/90 backdrop-blur-md
            border border-white/30
            shadow-2xl
            animate-in fade-in slide-in-from-top-2
            duration-200
            z-50
          "
        >
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] text-gray-300">
              <span className="font-medium">{lang("MUSIC_VOLUME")}</span>
              <span className="text-amber-400">{Math.round(musicVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={musicVolume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="
                w-full h-1.5
                rounded-lg
                appearance-none
                bg-gray-700/50
                cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-3
                [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-amber-400
                [&::-webkit-slider-thumb]:hover:bg-amber-300
                [&::-webkit-slider-thumb]:transition-colors
                [&::-webkit-slider-thumb]:shadow-lg
                [&::-moz-range-thumb]:w-3
                [&::-moz-range-thumb]:h-3
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-amber-400
                [&::-moz-range-thumb]:hover:bg-amber-300
                [&::-moz-range-thumb]:transition-colors
                [&::-moz-range-thumb]:border-0
                [&::-moz-range-thumb]:shadow-lg
              "
              aria-label="Music volume"
            />
          </div>
        </div>
      )}
    </div>
  );
}
