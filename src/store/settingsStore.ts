// src/store/settingsStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

type SettingsState = {
  // --- Existing ---
  generateImages: boolean;                          // default OFF
  setGenerateImages: (v: boolean) => void;
  toggleGenerateImages: () => void;

  // --- New: Narration ---
  narrationEnabled: boolean;                        // default ON
  narrationVoice: string | null;                    // voice name (from Web Speech), null/"" = auto
  setNarrationEnabled: (v: boolean) => void;
  toggleNarrationEnabled: () => void;
  setNarrationVoice: (name?: string) => void;       // persist a specific voice by name
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // --- Existing ---
      generateImages: false,
      setGenerateImages: (v) => set({ generateImages: v }),
      toggleGenerateImages: () => set({ generateImages: !get().generateImages }),

      // --- New: Narration ---
      narrationEnabled: true,
      narrationVoice: null,
      setNarrationEnabled: (v) => set({ narrationEnabled: v }),
      toggleNarrationEnabled: () => set({ narrationEnabled: !get().narrationEnabled }),
      setNarrationVoice: (name) => set({ narrationVoice: name ?? null }),
    }),
    {
      name: "settings-v2", // bump key because we added fields
      partialize: (s) => ({
        generateImages: s.generateImages,
        narrationEnabled: s.narrationEnabled,
        narrationVoice: s.narrationVoice,
      }),
    }
  )
);
