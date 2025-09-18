// src/store/settingsStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

type SettingsState = {
  generateImages: boolean;                 // default OFF
  setGenerateImages: (v: boolean) => void;
  toggleGenerateImages: () => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      generateImages: false,
      setGenerateImages: (v) => set({ generateImages: v }),
      toggleGenerateImages: () => set({ generateImages: !get().generateImages }),
    }),
    {
      name: "settings-v1",
      partialize: (s) => ({ generateImages: s.generateImages }),
    }
  )
);
