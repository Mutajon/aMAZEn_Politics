// src/store/dilemmaStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Dilemma, DilemmaRequest, DilemmaAction } from "../lib/dilemma";
import { useSettingsStore } from "./settingsStore";
import { useRoleStore } from "./roleStore";
import { useCompassStore } from "./compassStore"; // <-- A) use compass values (0..10)

// Prevent duplicate fetches (React StrictMode or fast double click)
let loadNextInFlight = false;

// gated debug logger
function dlog(...args: any[]) {
  if (useSettingsStore.getState().debugMode) {
    // eslint-disable-next-line no-console
    console.log("[dilemmaStore]", ...args);
  }
}

type DayProgressionState = {
  isProgressing: boolean;
  progressingToDay: number;
  analysisComplete: {
    support: boolean;
    compass: boolean;
    dynamic: boolean;
    mirror: boolean;
    news: boolean;
    contextualDilemma: boolean;
  };
};

type DilemmaState = {
  day: number;
  totalDays: number;

  current: Dilemma | null;
  history: Dilemma[];
  loading: boolean;
  error: string | null;

  // Track last choice for dynamic parameters
  lastChoice: DilemmaAction | null;

  // Day progression state (NewDilemmaLogic.md integration)
  dayProgression: DayProgressionState;

  // Topic tracking for diversity (Rule #9)
  recentTopics: string[];
  topicCounts: Record<string, number>;

  // Game resources and support (0-100 for support)
  budget: number;
  supportPeople: number;
  supportMiddle: number;
  supportMom: number;
  score: number;

  // Difficulty level
  difficulty: "baby-boss" | "freshman" | "tactician" | "old-fox" | null;
  setDifficulty: (level: "baby-boss" | "freshman" | "tactician" | "old-fox") => void;

  loadNext: () => Promise<void>;
  nextDay: () => void;
  setTotalDays: (n: number) => void;
  applyChoice: (id: "a" | "b" | "c") => void;
  reset: () => void;

  // Resource and support setters
  setBudget: (n: number) => void;
  setSupportPeople: (n: number) => void;
  setSupportMiddle: (n: number) => void;
  setSupportMom: (n: number) => void;
  setScore: (n: number) => void;

  // Day progression methods
  startDayProgression: () => void;
  setAnalysisComplete: (analysis: keyof DayProgressionState['analysisComplete']) => void;
  endDayProgression: () => void;

  // Topic tracking methods
  addDilemmaTopic: (topic: string) => void;
};

export const useDilemmaStore = create<DilemmaState>()((set, get) => ({
  day: 1,
  totalDays: 7,

  current: null,
  history: [],
  loading: false,
  error: null,
  lastChoice: null,

  // Day progression state
  dayProgression: {
    isProgressing: false,
    progressingToDay: 1,
    analysisComplete: {
      support: false,
      compass: false,
      dynamic: false,
      mirror: false,
      news: false,
      contextualDilemma: false,
    },
  },

  // Topic tracking
  recentTopics: [],
  topicCounts: {},

  // Game resources and support
  budget: 1500,
  supportPeople: 50,
  supportMiddle: 50,
  supportMom: 50,
  score: 0,

  // Difficulty level
  difficulty: null,

  async loadNext() {
    // If something is already loading, bail early
    if (get().loading || loadNextInFlight) {
      dlog("loadNext: skipped (already in flight)");
      return;
    }
  
    loadNextInFlight = true;
    set({ loading: true, error: null });
  
    try {
      const snapshot = buildSnapshot(); // buildSnapshot already logs
      // dlog("snapshot ->", snapshot); // ← remove this to avoid duplicate logs
  
      let d: Dilemma | null = null;
      try {
        const r = await fetch("/api/dilemma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(snapshot),
        });
        if (r.ok) {
            const raw = await r.json();
            // Keep the public fields the component expects:
            d = { title: raw.title, description: raw.description, actions: raw.actions } as Dilemma;
            // Carry a private marker for UI gating (no type change required):
            (d as any)._isFallback = !!raw.isFallback;
            dlog("server /api/dilemma ->", raw);
          } else {
          
          const t = await r.text();
          dlog("server /api/dilemma FAILED:", r.status, t);
        }
      } catch (e: any) {
        dlog("server /api/dilemma network error:", e?.message || e);
      }
  
      if (!d) {
        d = localMock(snapshot.day);
        dlog("fallback mock ->", d);
      }
  
      const prev = get().current;
      set((s) => ({
        current: d!,
        history: prev ? [...s.history, prev] : s.history,
        loading: false,
      }));
    } catch (err: any) {
      const msg = err?.message || "Failed to load dilemma";
      set({ loading: false, error: msg });
      dlog("ERROR:", msg);
    } finally {
      loadNextInFlight = false;
    }
  },
  

  nextDay() {
    const { day, totalDays } = get();
    const v = Math.min(totalDays, day + 1);
    dlog("nextDay ->", v);
    // Reset lastChoice when moving to next day (dynamic parameters should reset)
    set({ day: v, lastChoice: null });
  },

  setTotalDays(n) {
    const v = Math.max(1, Math.round(Number(n) || 1));
    dlog("setTotalDays ->", v);
    set({ totalDays: v });
  },

  applyChoice(id) {
    const { current } = get();
    if (!current) {
      dlog("applyChoice: no current dilemma");
      return;
    }

    const choice = current.actions.find(action => action.id === id);
    if (!choice) {
      dlog("applyChoice: choice not found ->", id);
      return;
    }

    dlog("applyChoice ->", id, choice.title);
    set({ lastChoice: choice });
  },

  reset() {
    dlog("reset dilemmas");
    set({
      day: 1,
      current: null,
      history: [],
      loading: false,
      error: null,
      lastChoice: null,
      dayProgression: {
        isProgressing: false,
        progressingToDay: 1,
        analysisComplete: {
          support: false,
          compass: false,
          dynamic: false,
          mirror: false,
          news: false,
          contextualDilemma: false,
        },
      },
      recentTopics: [],
      topicCounts: {},
      budget: 1500,
      supportPeople: 50,
      supportMiddle: 50,
      supportMom: 50,
      score: 0,
      difficulty: null,
    });
  },

  // Resource and support setters
  setBudget(n) {
    const v = Math.round(Number(n) || 0);
    dlog("setBudget ->", v);
    set({ budget: v });
  },

  setSupportPeople(n) {
    const v = Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
    dlog("setSupportPeople ->", v);
    set({ supportPeople: v });
  },

  setSupportMiddle(n) {
    const v = Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
    dlog("setSupportMiddle ->", v);
    set({ supportMiddle: v });
  },

  setSupportMom(n) {
    const v = Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
    dlog("setSupportMom ->", v);
    set({ supportMom: v });
  },

  setScore(n) {
    const v = Math.round(Number(n) || 0);
    dlog("setScore ->", v);
    set({ score: v });
  },

  setDifficulty(level) {
    dlog("setDifficulty ->", level);
    set({ difficulty: level });

    // Apply difficulty modifiers
    const modifiers = {
      "baby-boss": { supportMod: 10, budgetMod: 250, scoreMod: -200 },
      "freshman": { supportMod: 0, budgetMod: 0, scoreMod: 0 },
      "tactician": { supportMod: -10, budgetMod: -250, scoreMod: 200 },
      "old-fox": { supportMod: -20, budgetMod: -500, scoreMod: 500 },
    };

    const mod = modifiers[level];

    // Apply support modifiers (add percentage points, clamped to 0-100)
    set({
      supportPeople: Math.max(0, Math.min(100, 50 + mod.supportMod)),
      supportMiddle: Math.max(0, Math.min(100, 50 + mod.supportMod)),
      supportMom: Math.max(0, Math.min(100, 50 + mod.supportMod)),
      budget: 1500 + mod.budgetMod,
      score: mod.scoreMod,
    });
  },

  // Day progression methods
  startDayProgression() {
    const { day } = get();
    dlog("startDayProgression ->", day + 1);
    set({
      dayProgression: {
        isProgressing: true,
        progressingToDay: day + 1,
        analysisComplete: {
          support: false,
          compass: false,
          dynamic: false,
          mirror: false,
          news: false,
          contextualDilemma: false,
        },
      },
    });
  },

  setAnalysisComplete(analysis) {
    const { dayProgression } = get();
    dlog("setAnalysisComplete ->", analysis);
    set({
      dayProgression: {
        ...dayProgression,
        analysisComplete: {
          ...dayProgression.analysisComplete,
          [analysis]: true,
        },
      },
    });
  },

  endDayProgression() {
    const { dayProgression } = get();
    dlog("endDayProgression -> day:", dayProgression.progressingToDay);
    set({
      day: dayProgression.progressingToDay,
      lastChoice: null, // Reset for new day
      dayProgression: {
        isProgressing: false,
        progressingToDay: dayProgression.progressingToDay,
        analysisComplete: {
          support: false,
          compass: false,
          dynamic: false,
          mirror: false,
          news: false,
          contextualDilemma: false,
        },
      },
    });
  },

  // Topic tracking methods (Rule #9)
  addDilemmaTopic(topic) {
    const { recentTopics, topicCounts } = get();
    const newRecentTopics = [topic, ...recentTopics.slice(0, 2)]; // Keep last 3
    const newTopicCounts = {
      ...topicCounts,
      [topic]: (topicCounts[topic] || 0) + 1,
    };
    dlog("addDilemmaTopic ->", topic, "recent:", newRecentTopics);
    set({
      recentTopics: newRecentTopics,
      topicCounts: newTopicCounts,
    });
  },
}));

// ---- helpers ----

// flatten 0..10 arrays into a flat map like what0..what9, whence0..9, how0..9, whither0..9
function flattenCompass(vals: any): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of ["what", "whence", "how", "whither"] as const) {
    const arr = Array.isArray(vals?.[k]) ? vals[k] : [];
    for (let i = 0; i < 10; i++) {
      const v = Math.max(0, Math.min(10, Math.round(arr[i] ?? 0)));
      out[`${k}${i}`] = v;
    }
  }
  return out;
}

function buildSnapshot(): DilemmaRequest {
    const { debugMode, dilemmasSubjectEnabled, dilemmasSubject } =
      useSettingsStore.getState();
    const { day, totalDays } = useDilemmaStore.getState();
  
    // --- role/system from the role store (trimmed) ---
    const roleState = useRoleStore.getState();
  
    const roleText =
      typeof roleState.selectedRole === "string" && roleState.selectedRole.trim()
        ? roleState.selectedRole.trim()
        : null;
  
    const systemText =
      typeof roleState.analysis?.systemName === "string" && roleState.analysis.systemName.trim()
        ? roleState.analysis.systemName.trim()
        : null;
  
    // holders: map store's {name, percent} -> API snapshot {name, weight}
    const holders = Array.isArray(roleState.analysis?.holders)
      ? roleState.analysis!.holders.map((h) => ({
          name: String(h?.name ?? "Group"),
          // map percent -> weight; default to 0 when missing
          weight: Number((h as any)?.percent ?? 0),
        }))
      : [];
  
    const playerIndex =
      typeof roleState.analysis?.playerIndex === "number"
        ? roleState.analysis!.playerIndex
        : null;
  
    // Compass values (flattened 0..10 map)
    const compassRaw = useCompassStore.getState().values;
    const compassValues = flattenCompass(compassRaw);
  
    const snap: DilemmaRequest = {
      // DilemmaRequest expects string, so never undefined.
      // The server will treat "" as “no value” and apply its own fallback.
      role: roleText,
      systemName: systemText,
  
      holders,
      playerIndex,
      compassValues,
  
      settings: { dilemmasSubjectEnabled, dilemmasSubject },
      day,
      totalDays,
      previous: { isFirst: day === 1, isLast: day === totalDays },
  
      supports: {}, // unchanged
      debug: debugMode,
    };
  
    
    return snap;
  }
  
  

function localMock(day: number): Dilemma {
  return {
    title:
      day === 1 ? "First Night in the Palace" : "Crowds Swell Outside the Palace",
    description:
      day === 1
        ? "As the seals change hands, a restless city watches. Advisors split: display resolve now, or earn trust with patience."
        : "Rumors spiral as barricades appear along the market roads. Decide whether to project strength or show empathy before things harden.",
    actions: [
      {
        id: "a",
        title: "Impose Curfew",
        summary: "Restrict movement after dusk with visible patrols.",
        cost: -150,
        iconHint: "security",
      },
      {
        id: "b",
        title: "Address the Nation",
        summary: "Speak live tonight to calm fears and set the tone.",
        cost: -50,
        iconHint: "speech",
      },
      {
        id: "c",
        title: "Open Negotiations",
        summary: "Invite opposition figures for mediated talks.",
        cost: +50,
        iconHint: "diplomacy",
      },
    ],
  };
}
