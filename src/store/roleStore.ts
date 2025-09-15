// src/store/roleStore.ts
import { create } from "zustand";

export interface PowerHolder {
  name: string;
  percent: number;
  note?: string;
  icon?: string;
}

export interface SystemInfo {
  name: string;
  description: string;
  flavor: string;
}

export interface AnalysisResult {
  isRealOrHistoric: boolean;
  system: SystemInfo;
  holders: PowerHolder[];       // length 5, sums to 100
  playerIndex: number | null;   // which holder best matches player, or null
}

export type GenderKey = "male" | "female" | "neutral";

export interface Character {
  gender: GenderKey;
  name: string;
  description: string;
  avatarDataUrl?: string;
}

interface RoleState {
  selectedRole: string | null;
  analysis: AnalysisResult | null;
  character: Character | null;

  setRole: (r: string) => void;
  setAnalysis: (a: AnalysisResult | null) => void;
  setCharacter: (c: Character | null) => void;
  reset: () => void;
}

export const useRoleStore = create<RoleState>((set) => ({
  selectedRole: null,
  analysis: null,
  character: null,

  setRole: (r: string) => set({ selectedRole: r, analysis: null, character: null }),
  setAnalysis: (a: AnalysisResult | null) => set({ analysis: a }),
  setCharacter: (c: Character | null) => set({ character: c }),
  reset: () => set({ selectedRole: null, analysis: null, character: null }),
}));
