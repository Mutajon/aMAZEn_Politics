// src/store/settingsStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

type SettingsState = {
  // --- Image generation ---
  generateImages: boolean;
  setGenerateImages: (v: boolean) => void;
  toggleGenerateImages: () => void;

  // --- Narration ---
  narrationEnabled: boolean;
  narrationVoice: string | null;
  setNarrationEnabled: (v: boolean) => void;
  toggleNarrationEnabled: () => void;
  setNarrationVoice: (name?: string | null) => void;

  // --- Budget flag ---
  showBudget: boolean;
  setShowBudget: (v: boolean) => void;
  toggleShowBudget: () => void;

  // --- NEW: Debug mode (default OFF) ---
  debugMode: boolean;
  setDebugMode: (v: boolean) => void;
  toggleDebugMode: () => void;

  // --- NEW: Dilemmas subject (default OFF + value) ---
  dilemmasSubjectEnabled: boolean;
  setDilemmasSubjectEnabled: (v: boolean) => void;
  toggleDilemmasSubjectEnabled: () => void;
  dilemmasSubject: string;                 // the chosen theme
  setDilemmasSubject: (s: string) => void;

  // --- NEW: Enable modifiers ---
  enableModifiers: boolean;
  setEnableModifiers: (v: boolean) => void;
  toggleEnableModifiers: () => void;

  // --- NEW: Use Anthropic (Claude) for light dilemma API ---
  useLightDilemmaAnthropic: boolean;
  setUseLightDilemmaAnthropic: (v: boolean) => void;
  toggleUseLightDilemmaAnthropic: () => void;

  // --- NEW: In-game narration mute (separate from global toggle) ---
  narrationMutedInGame: boolean;
  setNarrationMutedInGame: (v: boolean) => void;
  toggleNarrationMutedInGame: () => void;

  // --- NEW: Background music ---
  musicEnabled: boolean;
  setMusicEnabled: (v: boolean) => void;
  toggleMusicEnabled: () => void;
  musicVolume: number;
  setMusicVolume: (v: number) => void;

  // --- NEW: Sound effects ---
  sfxEnabled: boolean;
  setSfxEnabled: (v: boolean) => void;
  toggleSfxEnabled: () => void;
  sfxVolume: number;
  setSfxVolume: (v: number) => void;

  // --- DEBUG: Skip previous context on Day 2+ (for debugging AI failures) ---
  skipPreviousContext: boolean;
  setSkipPreviousContext: (v: boolean) => void;
  toggleSkipPreviousContext: () => void;

  // --- NEW: Data collection (for research) ---
  dataCollectionEnabled: boolean;
  setDataCollectionEnabled: (v: boolean) => void;
  toggleDataCollectionEnabled: () => void;

  // --- NEW: Treatment assignment (for research variants) ---
  treatment: 'fullAutonomy' | 'semiAutonomy' | 'noAutonomy';
  setTreatment: (v: 'fullAutonomy' | 'semiAutonomy' | 'noAutonomy') => void;

  // --- NEW: Experiment mode gate ---
  experimentMode: boolean;
  setExperimentMode: (v: boolean) => void;
  toggleExperimentMode: () => void;

  // --- NEW: Corruption tracking (default OFF) ---
  corruptionTrackingEnabled: boolean;
  setCorruptionTrackingEnabled: (v: boolean) => void;
  toggleCorruptionTrackingEnabled: () => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Image generation
      generateImages: true,
      setGenerateImages: (v) => set({ generateImages: v }),
      toggleGenerateImages: () => set({ generateImages: !get().generateImages }),

      // Narration
      narrationEnabled: false,
      narrationVoice: null,
      setNarrationEnabled: (v) => set({ narrationEnabled: v }),
      toggleNarrationEnabled: () => set({ narrationEnabled: !get().narrationEnabled }),
      setNarrationVoice: (name) => set({ narrationVoice: name ?? null }),

      // Budget
      showBudget: false, // default OFF
      setShowBudget: (v) => set({ showBudget: v }),
      toggleShowBudget: () => set({ showBudget: !get().showBudget }),

      // NEW: Debug
      debugMode: false,
      setDebugMode: (v) => set({ debugMode: v }),
      toggleDebugMode: () => set({ debugMode: !get().debugMode }),

      // NEW: Dilemmas subject
      dilemmasSubjectEnabled: false,
      setDilemmasSubjectEnabled: (v) => set({ dilemmasSubjectEnabled: v }),
      toggleDilemmasSubjectEnabled: () =>
        set({ dilemmasSubjectEnabled: !get().dilemmasSubjectEnabled }),
      dilemmasSubject: "Personal freedom",
      setDilemmasSubject: (s) => set({ dilemmasSubject: s }),

      // NEW: Enable modifiers
      enableModifiers: true,
      setEnableModifiers: (v) => set({ enableModifiers: v }),
      toggleEnableModifiers: () => set({ enableModifiers: !get().enableModifiers }),

      // NEW: Use Anthropic (Claude) for light dilemma API (default OFF)
      useLightDilemmaAnthropic: false,
      setUseLightDilemmaAnthropic: (v) => set({ useLightDilemmaAnthropic: v }),
      toggleUseLightDilemmaAnthropic: () => set({ useLightDilemmaAnthropic: !get().useLightDilemmaAnthropic }),

      // NEW: In-game narration mute (default OFF - respects global setting)
      narrationMutedInGame: false,
      setNarrationMutedInGame: (v) => set({ narrationMutedInGame: v }),
      toggleNarrationMutedInGame: () => set({ narrationMutedInGame: !get().narrationMutedInGame }),

      // NEW: Background music (default ON at 21% volume)
      musicEnabled: true,
      setMusicEnabled: (v) => set({ musicEnabled: v }),
      toggleMusicEnabled: () => set({ musicEnabled: !get().musicEnabled }),
      musicVolume: 0.21,
      setMusicVolume: (v) => set({ musicVolume: Math.max(0, Math.min(1, v)) }),

      // NEW: Sound effects (default ON at 100% volume)
      sfxEnabled: true,
      setSfxEnabled: (v) => set({ sfxEnabled: v }),
      toggleSfxEnabled: () => set({ sfxEnabled: !get().sfxEnabled }),
      sfxVolume: 1.0,
      setSfxVolume: (v) => set({ sfxVolume: Math.max(0, Math.min(1, v)) }),

      // DEBUG: Skip previous context (default OFF)
      skipPreviousContext: false,
      setSkipPreviousContext: (v) => set({ skipPreviousContext: v }),
      toggleSkipPreviousContext: () => set({ skipPreviousContext: !get().skipPreviousContext }),

      // NEW: Data collection (default OFF - requires consent)
      dataCollectionEnabled: false,
      setDataCollectionEnabled: (v) => set({ dataCollectionEnabled: v }),
      toggleDataCollectionEnabled: () => set({ dataCollectionEnabled: !get().dataCollectionEnabled }),

      // NEW: Treatment assignment (default "semiAutonomy" - current balanced behavior)
      treatment: "semiAutonomy",
      setTreatment: (v) => set({ treatment: v }),

      // NEW: Experiment mode gate (default OFF)
      experimentMode: false,
      setExperimentMode: (v) => set({ experimentMode: v }),
      toggleExperimentMode: () => set({ experimentMode: !get().experimentMode }),

      // NEW: Corruption tracking (default OFF)
      corruptionTrackingEnabled: false,
      setCorruptionTrackingEnabled: (v) => set({ corruptionTrackingEnabled: v }),
      toggleCorruptionTrackingEnabled: () => set({ corruptionTrackingEnabled: !get().corruptionTrackingEnabled }),
    }),
    {
      // Bump key so no stale objects hide the new fields
      name: "settings-v14",
      partialize: (s) => ({
        generateImages: s.generateImages,
        narrationEnabled: s.narrationEnabled,
        narrationVoice: s.narrationVoice,
        showBudget: s.showBudget,
        debugMode: s.debugMode,
        dilemmasSubjectEnabled: s.dilemmasSubjectEnabled,
        dilemmasSubject: s.dilemmasSubject,
        enableModifiers: s.enableModifiers,
        useLightDilemmaAnthropic: s.useLightDilemmaAnthropic,
        narrationMutedInGame: s.narrationMutedInGame,
        musicEnabled: s.musicEnabled,
        musicVolume: s.musicVolume,
        sfxEnabled: s.sfxEnabled,
        sfxVolume: s.sfxVolume,
        skipPreviousContext: s.skipPreviousContext,
        dataCollectionEnabled: s.dataCollectionEnabled,
        treatment: s.treatment,
        experimentMode: s.experimentMode,
        corruptionTrackingEnabled: s.corruptionTrackingEnabled,
      }),
    }
  )
);
