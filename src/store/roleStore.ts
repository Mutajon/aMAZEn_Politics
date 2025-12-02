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
  roleScope?: string | null;
  storyThemes?: string[] | null;
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
  /** Player's real name (entered in DreamScreen) - separate from character name */
  playerName: string | null;
  /** Player's self-identified defining trait (entered in DreamScreen) */
  playerTrait: string | null;
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
  /** Role description displayed to player (e.g., "Governor in Florence", "Farmer in Haiti") */
  roleDescription: string | null;
  /** Baseline support profiles for People + Challenger (optional) */
  supportProfiles: RoleSupportProfiles | null;
  /** Narrative scope for prompts */
  roleScope: string | null;
  /** Core story themes to rotate through */
  storyThemes: string[] | null;
  /** Compressed avatar thumbnail for fragment storage (~5-10KB WebP) - temporary until fragment collected */
  pendingAvatarThumbnail: string | null;

  setRole: (r: string | null) => void;
  setAnalysis: (a: AnalysisResult | null) => void;
  setSupportProfiles: (profiles: RoleSupportProfiles | null) => void;
  setRoleScope: (scope: string | null) => void;
  setStoryThemes: (themes: string[] | null) => void;

  /** Replace the whole character object (e.g., from Name screen) */
  setCharacter: (c: Character | null) => void;

  /** Merge a partial patch into the current character (safe even if null) */
  updateCharacter: (patch: Partial<Character>) => void;

  /** Set the role's background image path */
  setRoleBackgroundImage: (path: string | null) => void;

  /** Set role context fields (title, intro, year) - used for predefined roles */
  setRoleContext: (title: string | null, intro: string | null, year: string | null) => void;

  /** Set role description (e.g., "Governor in Florence") */
  setRoleDescription: (description: string | null) => void;

  /** Set player's real name (from DreamScreen) */
  setPlayerName: (name: string | null) => void;

  /** Set player's defining trait (from DreamScreen) */
  setPlayerTrait: (trait: string | null) => void;

  /** Set pending avatar thumbnail for fragment collection */
  setPendingAvatarThumbnail: (thumbnail: string | null) => void;

  reset: () => void;
};

export const useRoleStore = create<RoleState>()(
  persist(
    (set, get) => ({
      playerName: null,
      playerTrait: null,
      selectedRole: null,
      analysis: null,
      character: null,
      roleBackgroundImage: null,
      roleTitle: null,
      roleIntro: null,
      roleYear: null,
      roleDescription: null,
      supportProfiles: null,
      roleScope: null,
      storyThemes: null,
      pendingAvatarThumbnail: null,

      setRole: (r) => set({ selectedRole: r }),
      setAnalysis: (a) => set((state) => ({
        analysis: a,
        supportProfiles: a?.supportProfiles ?? state.supportProfiles ?? null,
        roleScope: a?.roleScope ?? state.roleScope ?? null,
        storyThemes: a?.storyThemes ?? state.storyThemes ?? null
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
      setRoleDescription: (description) => set({ roleDescription: description }),
      setSupportProfiles: (profiles: RoleSupportProfiles | null) => set({ supportProfiles: profiles }),
      setRoleScope: (scope) => set({ roleScope: scope }),
      setStoryThemes: (themes) => set({ storyThemes: themes }),
      setPlayerName: (name) => set({ playerName: name }),
      setPlayerTrait: (trait) => set({ playerTrait: trait }),
      setPendingAvatarThumbnail: (thumbnail) => set({ pendingAvatarThumbnail: thumbnail }),

      reset: () => set({
        playerName: null,
        playerTrait: null,
        selectedRole: null,
        analysis: null,
        character: null,
        roleBackgroundImage: null,
        roleTitle: null,
        roleIntro: null,
        roleYear: null,
        roleDescription: null,
        supportProfiles: null,
        roleScope: null,
        storyThemes: null,
        pendingAvatarThumbnail: null
      }),
    }),
    {
      name: "amaze-politics-role-store", // localStorage key
    }
  )
);
