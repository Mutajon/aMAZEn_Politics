// src/store/mirrorQuizStore.ts
// Centralizes Mirror Quiz progress so navigating away/back doesn't restart the flow.
import { create } from "zustand";
import type { MirrorQA } from "../data/mirror-quiz-pool";

type Phase = "quiz" | "waiting-ai" | "typing-summary" | "typing-epilogue" | "final";

type MirrorQuizState = {
  quiz: MirrorQA[];
  idx: number;
  done: boolean;

  // verdict/epilogue
  summary: string;          // full summary text once we have it (from generateMirrorSummary)
  epilogueShown: boolean;   // have we already revealed the epilogue once?

  phase: Phase;

  // actions
  init: (qs: MirrorQA[]) => void;
  advance: () => void;
  setDone: () => void;
  setSummary: (s: string) => void;
  markEpilogueShown: () => void;
  resetAll: () => void;     // not used in normal flow; handy for debugging
};

export const useMirrorQuizStore = create<MirrorQuizState>((set, get) => ({
  quiz: [],
  idx: 0,
  done: false,
  summary: "",
  epilogueShown: false,
  phase: "quiz",

  init: (qs) => set({ quiz: qs, idx: 0, done: qs.length === 0, phase: qs.length ? "quiz" : "waiting-ai", summary: "", epilogueShown: false }),
  advance: () => {
    const { idx, quiz } = get();
    if (idx + 1 >= quiz.length) set({ done: true, phase: "waiting-ai" });
    else set({ idx: idx + 1 });
  },
  setDone: () => set({ done: true, phase: "waiting-ai" }),
  setSummary: (s) => set({ summary: s }),
  markEpilogueShown: () => set({ epilogueShown: true, phase: "final" }),
  resetAll: () => set({ quiz: [], idx: 0, done: false, summary: "", epilogueShown: false, phase: "quiz" }),
}));
