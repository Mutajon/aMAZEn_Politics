// src/store/roleStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

/* ---------- Types ---------- */
export type PowerHolder = {
  name: string;
  percent: number;
  icon?: string;
  note?: string; // witty description
  role?: { A: boolean; E: boolean }; // NEW: Author/Eraser flags
  stype?: { // NEW: Subject-Type classification
    t: "Author" | "Eraser" | "Agent" | "Actor" | "Acolyte" | "Dictator";
    i: "-" | "•" | "+"; // intensity
  };
};

export type AnalysisResult = {
  systemName: string;
  systemDesc: string;
  flavor: string;
  holders: PowerHolder[];
  playerIndex: number | null;
  e12?: { // NEW: Exception-12 analysis
    tierI: string[];
    tierII: string[];
    tierIII: string[];
    stopA: boolean;
    stopB: boolean;
    decisive: string[];
  };
  grounding?: { // NEW: Setting context
    settingType: "real" | "fictional" | "unclear";
    era: string;
  };
};

export type Character = {
  gender: "male" | "female" | "any";
  name: string;
  /** Physical description only (what the player edits) */
  description: string;
  /** Persisted avatar url if already generated */
  avatarUrl?: string;
  /** Full, combined prompt sent to image generation (built on Name screen) */
  imagePrompt?: string;
  /** AI-chosen background object (e.g., "red pagoda") */
  bgObject?: string;
  avatarMirrored?: boolean;
};

/* ---------- Store ---------- */
type RoleState = {
  selectedRole: string | null;
  analysis: AnalysisResult | null;
  character: Character | null;
  /** Path to role's background image (full image for predefined roles, splash for custom) */
  roleBackgroundImage: string | null;

  setRole: (r: string | null) => void;
  setAnalysis: (a: AnalysisResult | null) => void;

  /** Replace the whole character object (e.g., from Name screen) */
  setCharacter: (c: Character | null) => void;

  /** Merge a partial patch into the current character (safe even if null) */
  updateCharacter: (patch: Partial<Character>) => void;

  /** Set the role's background image path */
  setRoleBackgroundImage: (path: string | null) => void;

  reset: () => void;
};

export const useRoleStore = create<RoleState>()(
  persist(
    (set, get) => ({
      selectedRole: null,
      analysis: null,
      character: null,
      roleBackgroundImage: null,

      setRole: (r) => set({ selectedRole: r }),
      setAnalysis: (a) => set({ analysis: a }),

      setCharacter: (c) => set({ character: c }),

      updateCharacter: (patch) => {
        const prev = get().character ?? {
          gender: "any" as const,
          name: "",
          description: "",
          avatarUrl: undefined,
          imagePrompt: undefined,
          bgObject: undefined,
        };
        set({ character: { ...prev, ...patch } });
      },

      setRoleBackgroundImage: (path) => set({ roleBackgroundImage: path }),

      reset: () => set({ selectedRole: null, analysis: null, character: null, roleBackgroundImage: null }),
    }),
    {
      name: "amaze-politics-role-store", // localStorage key
    }
  )
);
