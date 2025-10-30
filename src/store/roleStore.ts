// src/store/roleStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RoleSupportProfiles } from "../data/supportProfiles";

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
  challengerSeat?: { // NEW: Primary institutional opponent (top non-player structured seat)
    name: string;
    percent: number;
    index: number | null;
  };
  supportProfiles?: RoleSupportProfiles | null;
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
  /** Full scenario title (e.g., "Athens — The Day Democracy Died (-404)") - for predefined roles only */
  roleTitle: string | null;
  /** Historical context paragraph describing the scenario - for predefined roles only */
  roleIntro: string | null;
  /** Year/era of the scenario (e.g., "-404", "1791", "2179") - for predefined roles only */
  roleYear: string | null;
  /** Baseline support profiles for People + Challenger (optional) */
  supportProfiles: RoleSupportProfiles | null;

  setRole: (r: string | null) => void;
  setAnalysis: (a: AnalysisResult | null) => void;
  setSupportProfiles: (profiles: RoleSupportProfiles | null) => void;

  /** Replace the whole character object (e.g., from Name screen) */
  setCharacter: (c: Character | null) => void;

  /** Merge a partial patch into the current character (safe even if null) */
  updateCharacter: (patch: Partial<Character>) => void;

  /** Set the role's background image path */
  setRoleBackgroundImage: (path: string | null) => void;

  /** Set role context fields (title, intro, year) - used for predefined roles */
  setRoleContext: (title: string | null, intro: string | null, year: string | null) => void;

  reset: () => void;
};

export const useRoleStore = create<RoleState>()(
  persist(
    (set, get) => ({
      selectedRole: null,
      analysis: null,
      character: null,
      roleBackgroundImage: null,
      roleTitle: null,
      roleIntro: null,
      roleYear: null,
      supportProfiles: null,

      setRole: (r) => set({ selectedRole: r }),
      setAnalysis: (a) => set((state) => ({
        analysis: a,
        supportProfiles: a?.supportProfiles ?? state.supportProfiles ?? null
      })),

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

      setRoleContext: (title, intro, year) => set({
        roleTitle: title,
        roleIntro: intro,
        roleYear: year
      }),
      setSupportProfiles: (profiles: RoleSupportProfiles | null) => set({ supportProfiles: profiles }),

      reset: () => set({
        selectedRole: null,
        analysis: null,
        character: null,
        roleBackgroundImage: null,
        roleTitle: null,
        roleIntro: null,
        roleYear: null,
        supportProfiles: null
      }),
    }),
    {
      name: "amaze-politics-role-store", // localStorage key
    }
  )
);
