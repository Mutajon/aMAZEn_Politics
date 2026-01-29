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

  // --- NEW: Use XAI (X.AI/Grok) for game-turn API ---
  useXAI: boolean;
  setUseXAI: (v: boolean) => void;
  toggleUseXAI: () => void;

  // --- NEW: Use Gemini (Google) for game-turn API ---
  useGemini: boolean;
  setUseGemini: (v: boolean) => void;

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

  // --- NEW: Backstage mode (session-only, bypasses email collection) ---
  backstageMode: boolean;
  setBackstageMode: (v: boolean) => void;

  // --- NEW: Treatment assignment (for research variants) ---
  treatment: 'fullAutonomy' | 'semiAutonomy' | 'noAutonomy';
  setTreatment: (v: 'fullAutonomy' | 'semiAutonomy' | 'noAutonomy') => void;

  // --- NEW: Experiment mode gate ---
  experimentMode: boolean;
  setExperimentMode: (v: boolean) => void;
  toggleExperimentMode: () => void;

  // --- NEW: Mobile device detection (session-only) ---
  isMobileDevice: boolean;
  setIsMobileDevice: (v: boolean) => void;

  // --- NEW: Lobby mode (session-only, for external website flow) ---
  lobbyMode: boolean;
  setLobbyMode: (v: boolean) => void;

  // --- NEW: Free Play Mode (session-only, lightweight Gemini prompts) ---
  isFreePlay: boolean;
  setFreePlayMode: (v: boolean) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Image generation
      generateImages: true,
      setGenerateImages: (v) => set({ generateImages: v }),
      toggleGenerateImages: () => set({ generateImages: !get().generateImages }),

      // Narration
      narrationEnabled: true,
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
      dilemmasSubject: "", // Will be set from i18n on initialization
      setDilemmasSubject: (s) => set({ dilemmasSubject: s }),

      // NEW: Enable modifiers
      enableModifiers: false,
      setEnableModifiers: (v) => set({ enableModifiers: v }),
      toggleEnableModifiers: () => set({ enableModifiers: !get().enableModifiers }),

      // NEW: Use Anthropic (Claude) for light dilemma API (default OFF)
      useLightDilemmaAnthropic: false,
      setUseLightDilemmaAnthropic: (v) => set({ useLightDilemmaAnthropic: v }),
      toggleUseLightDilemmaAnthropic: () => set({ useLightDilemmaAnthropic: !get().useLightDilemmaAnthropic }),

      // NEW: Use XAI (X.AI/Grok) for game-turn API (default OFF)
      useXAI: false,
      setUseXAI: (v) => set({ useXAI: v }),
      toggleUseXAI: () => set({ useXAI: !get().useXAI }),

      // NEW: Use Gemini (Google) for game-turn API (default ON)
      useGemini: true,
      setUseGemini: (v) => set({ useGemini: v }),

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

      // NEW: Backstage mode (default OFF, session-only - NOT persisted to localStorage)
      backstageMode: false,
      setBackstageMode: (v) => set({ backstageMode: v }),

      // NEW: Treatment assignment (default "semiAutonomy" - current balanced behavior)
      treatment: "semiAutonomy",
      setTreatment: (v) => set({ treatment: v }),

      // NEW: Experiment mode gate (default ON - experiment mode)
      experimentMode: true,
      setExperimentMode: (v) => set({ experimentMode: v }),
      toggleExperimentMode: () => set({ experimentMode: !get().experimentMode }),

      // NEW: Mobile device detection (default false, session-only - NOT persisted)
      isMobileDevice: false,
      setIsMobileDevice: (v) => set({ isMobileDevice: v }),

      // NEW: Lobby mode (default false, session-only - NOT persisted)
      // Used when game is started from external website lobby flow
      lobbyMode: false,
      setLobbyMode: (v) => set({ lobbyMode: v }),

      // NEW: Free Play Mode (default false, session-only - NOT persisted)
      isFreePlay: false,
      setFreePlayMode: (v) => set({ isFreePlay: v }),
    }),
    {
      // Bump key so no stale objects hide the new fields
      name: "settings-v15",
      partialize: (s) => ({
        generateImages: s.generateImages,
        narrationEnabled: s.narrationEnabled,
        narrationVoice: s.narrationVoice,
        showBudget: s.showBudget,
        // NOTE: debugMode is NOT persisted - session-only (always starts false)
        dilemmasSubjectEnabled: s.dilemmasSubjectEnabled,
        dilemmasSubject: s.dilemmasSubject,
        enableModifiers: s.enableModifiers,
        useLightDilemmaAnthropic: s.useLightDilemmaAnthropic,
        useGemini: s.useGemini,
        narrationMutedInGame: s.narrationMutedInGame,
        musicEnabled: s.musicEnabled,
        musicVolume: s.musicVolume,
        sfxEnabled: s.sfxEnabled,
        sfxVolume: s.sfxVolume,
        skipPreviousContext: s.skipPreviousContext,
        // NOTE: backstageMode is NOT persisted - session-only
        treatment: s.treatment,
        // NOTE: experimentMode is NOT persisted - session-only (controlled by button choice)
      }),
    }
  )
);
