// src/store/roleStore.ts
import { create } from "zustand";

/* ---------- Types ---------- */
export type PowerHolder = {
  name: string;
  percent: number;
  icon?: string;
  note?: string; // witty description
};

export type AnalysisResult = {
  systemName: string;
  systemDesc: string;
  flavor: string;
  holders: PowerHolder[];
  playerIndex: number | null;
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
};

/* ---------- Store ---------- */
type RoleState = {
  selectedRole: string | null;
  analysis: AnalysisResult | null;
  character: Character | null;

  setRole: (r: string | null) => void;
  setAnalysis: (a: AnalysisResult | null) => void;

  /** Replace the whole character object (e.g., from Name screen) */
  setCharacter: (c: Character | null) => void;

  /** Merge a partial patch into the current character (safe even if null) */
  updateCharacter: (patch: Partial<Character>) => void;

  reset: () => void;
};

export const useRoleStore = create<RoleState>((set, get) => ({
  selectedRole: null,
  analysis: null,
  character: null,

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

  reset: () => set({ selectedRole: null, analysis: null, character: null }),
}));
