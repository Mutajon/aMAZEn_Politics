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

  // --- NEW: Use light dilemma API (faster, minimal payload) ---
  useLightDilemma: boolean;
  setUseLightDilemma: (v: boolean) => void;
  toggleUseLightDilemma: () => void;

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
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Image generation
      generateImages: false,
      setGenerateImages: (v) => set({ generateImages: v }),
      toggleGenerateImages: () => set({ generateImages: !get().generateImages }),

      // Narration
      narrationEnabled: true,
      narrationVoice: null,
      setNarrationEnabled: (v) => set({ narrationEnabled: v }),
      toggleNarrationEnabled: () => set({ narrationEnabled: !get().narrationEnabled }),
      setNarrationVoice: (name) => set({ narrationVoice: name ?? null }),

      // Budget
      showBudget: true, // default ON
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
      enableModifiers: false,
      setEnableModifiers: (v) => set({ enableModifiers: v }),
      toggleEnableModifiers: () => set({ enableModifiers: !get().enableModifiers }),

      // NEW: Use light dilemma API (default ON for faster gameplay)
      useLightDilemma: true,
      setUseLightDilemma: (v) => set({ useLightDilemma: v }),
      toggleUseLightDilemma: () => set({ useLightDilemma: !get().useLightDilemma }),

      // NEW: Use Anthropic (Claude) for light dilemma API (default OFF)
      useLightDilemmaAnthropic: false,
      setUseLightDilemmaAnthropic: (v) => set({ useLightDilemmaAnthropic: v }),
      toggleUseLightDilemmaAnthropic: () => set({ useLightDilemmaAnthropic: !get().useLightDilemmaAnthropic }),

      // NEW: In-game narration mute (default OFF - respects global setting)
      narrationMutedInGame: false,
      setNarrationMutedInGame: (v) => set({ narrationMutedInGame: v }),
      toggleNarrationMutedInGame: () => set({ narrationMutedInGame: !get().narrationMutedInGame }),

      // NEW: Background music (default ON at 30% volume)
      musicEnabled: true,
      setMusicEnabled: (v) => set({ musicEnabled: v }),
      toggleMusicEnabled: () => set({ musicEnabled: !get().musicEnabled }),
      musicVolume: 0.3,
      setMusicVolume: (v) => set({ musicVolume: Math.max(0, Math.min(1, v)) }),
    }),
    {
      // Bump key so no stale objects hide the new fields
      name: "settings-v9",
      partialize: (s) => ({
        generateImages: s.generateImages,
        narrationEnabled: s.narrationEnabled,
        narrationVoice: s.narrationVoice,
        showBudget: s.showBudget,
        debugMode: s.debugMode,
        dilemmasSubjectEnabled: s.dilemmasSubjectEnabled,
        dilemmasSubject: s.dilemmasSubject,
        enableModifiers: s.enableModifiers,
        useLightDilemma: s.useLightDilemma,
        useLightDilemmaAnthropic: s.useLightDilemmaAnthropic,
        narrationMutedInGame: s.narrationMutedInGame,
        musicEnabled: s.musicEnabled,
        musicVolume: s.musicVolume,
      }),
    }
  )
);
