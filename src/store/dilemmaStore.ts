// src/store/dilemmaStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Dilemma, DilemmaRequest, DilemmaAction, DilemmaHistoryEntry, SubjectStreak, DilemmaScope, ScopeStreak, LightDilemmaRequest, LightDilemmaResponse } from "../lib/dilemma";
import type { ScoreBreakdown } from "../lib/scoring";
import type { Goal, SelectedGoal } from "../data/goals";
import { evaluateAllGoals } from "../lib/goalEvaluation";
import { useSettingsStore } from "./settingsStore";
import { useRoleStore } from "./roleStore";
import { useCompassStore } from "./compassStore"; // <-- A) use compass values (0..10)
import { COMPONENTS } from "../data/compass-data"; // <-- B) component definitions for value names

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

  // Dilemma history for AI context (full game history)
  dilemmaHistory: DilemmaHistoryEntry[];

  // Day progression state (NewDilemmaLogic.md integration)
  dayProgression: DayProgressionState;

  // Topic tracking for diversity (Rule #9)
  recentTopics: string[];
  topicCounts: Record<string, number>;

  // Subject streak tracking (Light API)
  subjectStreak: SubjectStreak | null;

  // Recent dilemma titles for semantic variety checking (Light API)
  recentDilemmaTitles: string[];

  // Scope streak tracking (Light API)
  scopeStreak: ScopeStreak | null;
  recentScopes: DilemmaScope[];

  // Final score persistence (prevent recalculation on revisit)
  finalScoreCalculated: boolean;
  finalScoreBreakdown: ScoreBreakdown | null;

  // Game resources and support (0-100 for support)
  budget: number;
  supportPeople: number;
  supportMiddle: number;
  supportMom: number;
  score: number;

  // Difficulty level
  difficulty: "baby-boss" | "freshman" | "tactician" | "old-fox" | null;
  setDifficulty: (level: "baby-boss" | "freshman" | "tactician" | "old-fox") => void;

  // Goals system
  selectedGoals: SelectedGoal[];
  customActionCount: number;
  minBudget: number;
  minSupportPeople: number;
  minSupportMiddle: number;
  minSupportMom: number;

  loadNext: () => Promise<void>;
  nextDay: () => void;
  setTotalDays: (n: number) => void;
  applyChoice: (id: "a" | "b" | "c") => void;
  setLastChoice: (action: DilemmaAction) => void;
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

  // Subject streak tracking methods (Light API)
  updateSubjectStreak: (topic: string) => void;

  // Recent dilemma titles tracking methods (Light API)
  addDilemmaTitle: (title: string) => void;

  // Scope streak tracking methods (Light API)
  updateScopeStreak: (scope: DilemmaScope) => void;

  // Final score persistence methods
  saveFinalScore: (breakdown: ScoreBreakdown) => void;
  clearFinalScore: () => void;

  // Dilemma history methods
  addHistoryEntry: (entry: DilemmaHistoryEntry) => void;
  clearHistory: () => void;

  // Goals system methods
  setGoals: (goals: Goal[]) => void;
  evaluateGoals: () => GoalStatusChange[];
  incrementCustomActions: () => void;
  updateMinimumValues: () => void;
};

// Type for goal status changes (used for audio/visual feedback)
export type GoalStatusChange = {
  goalId: string;
  goalTitle: string;
  oldStatus: import("../data/goals").GoalStatus;
  newStatus: import("../data/goals").GoalStatus;
};

export const useDilemmaStore = create<DilemmaState>()(
  persist(
    (set, get) => ({
  day: 1,
  totalDays: 7,

  current: null,
  history: [],
  loading: false,
  error: null,
  lastChoice: null,

  // Dilemma history for AI context
  dilemmaHistory: [],

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

  // Subject streak tracking (Light API)
  subjectStreak: null,

  // Recent dilemma titles tracking (Light API)
  recentDilemmaTitles: [],

  // Scope streak tracking (Light API)
  scopeStreak: null,
  recentScopes: [],

  // Final score persistence
  finalScoreCalculated: false,
  finalScoreBreakdown: null,

  // Game resources and support
  budget: 1500,
  supportPeople: 50,
  supportMiddle: 50,
  supportMom: 50,
  score: 0,

  // Difficulty level
  difficulty: null,

  // Goals system
  selectedGoals: [],
  customActionCount: 0,
  minBudget: 1500,
  minSupportPeople: 50,
  minSupportMiddle: 50,
  minSupportMom: 50,

  async loadNext() {
    // If something is already loading, bail early
    if (get().loading || loadNextInFlight) {
      dlog("loadNext: skipped (already in flight)");
      return;
    }

    loadNextInFlight = true;
    set({ loading: true, error: null });

    try {
      // Check if we should use light API (default: true)
      const { useLightDilemma } = useSettingsStore.getState();

      console.log(`[dilemmaStore.loadNext] API Mode: ${useLightDilemma ? 'LIGHT ✅' : 'HEAVY ⚠️'}`);

      let d: Dilemma | null = null;

      if (useLightDilemma) {
        // Use fast light API
        console.log("[dilemmaStore.loadNext] Calling LIGHT API via loadNextLight()");
        dlog("loadNext: using LIGHT API");
        d = await loadNextLight();
      } else {
        // Use full heavy API
        console.log("[dilemmaStore.loadNext] Calling HEAVY API");
        dlog("loadNext: using HEAVY API");
        const snapshot = buildSnapshot();

        try {
          const r = await fetch("/api/dilemma", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(snapshot),
          });
          if (r.ok) {
              const raw = await r.json();
              d = { title: raw.title, description: raw.description, actions: raw.actions } as Dilemma;
              dlog("server /api/dilemma ->", raw);
            } else {
            const t = await r.text();
            dlog("server /api/dilemma FAILED:", r.status, t);
          }
        } catch (e: any) {
          dlog("server /api/dilemma network error:", e?.message || e);
        }
      }

      // If API failed, propagate error to UI
      if (!d) {
        const errorMsg = "Unable to generate your next challenge. The AI service failed after multiple attempts. Please start a new game.";
        dlog("API failed, setting error:", errorMsg);
        set({ loading: false, error: errorMsg, current: null });
        return;
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
    const { day } = get();
    // Remove Math.min cap - allow day to exceed totalDays for conclusion screen (day 8)
    // This enables daysLeft to reach 0, triggering game conclusion mode
    const v = day + 1;
    dlog("nextDay ->", v);
    // Note: Keep lastChoice intact so EventScreen3 collector can analyze it on the next day
    // lastChoice will be naturally overwritten when the player makes their next choice
    set({ day: v });
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

  setLastChoice(action) {
    dlog("setLastChoice ->", action.id, action.title);
    set({ lastChoice: action });
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
      dilemmaHistory: [],
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
      subjectStreak: null,
      recentDilemmaTitles: [],
      scopeStreak: null,
      recentScopes: [],
      finalScoreCalculated: false,
      finalScoreBreakdown: null,
      budget: 1500,
      supportPeople: 50,
      supportMiddle: 50,
      supportMom: 50,
      score: 0,
      difficulty: null,
      selectedGoals: [],
      customActionCount: 0,
      minBudget: 1500,
      minSupportPeople: 50,
      minSupportMiddle: 50,
      minSupportMom: 50,
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

    // Apply difficulty modifiers (support and budget only - score applied in FinalScoreScreen)
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

  // Subject streak tracking (Light API)
  updateSubjectStreak(topic) {
    const { subjectStreak } = get();

    if (!subjectStreak || subjectStreak.subject !== topic) {
      // New subject - reset streak
      dlog("updateSubjectStreak -> new subject:", topic);
      set({ subjectStreak: { subject: topic, count: 1 } });
    } else {
      // Same subject - increment count
      const newCount = subjectStreak.count + 1;
      dlog("updateSubjectStreak -> increment:", topic, "count:", newCount);
      set({ subjectStreak: { subject: topic, count: newCount } });
    }
  },

  // Recent dilemma titles tracking (Light API)
  addDilemmaTitle(title) {
    const { recentDilemmaTitles } = get();
    const newTitles = [title, ...recentDilemmaTitles.slice(0, 4)]; // Keep last 5
    dlog("addDilemmaTitle ->", title, "| recent:", newTitles.length);
    set({ recentDilemmaTitles: newTitles });
  },

  // Scope streak tracking (Light API)
  updateScopeStreak(scope) {
    const { scopeStreak, recentScopes } = get();

    // Update streak
    if (!scopeStreak || scopeStreak.scope !== scope) {
      // New scope - reset streak
      dlog("updateScopeStreak -> new scope:", scope);
      set({ scopeStreak: { scope, count: 1 } });
    } else {
      // Same scope - increment count
      const newCount = scopeStreak.count + 1;
      dlog("updateScopeStreak -> increment:", scope, "count:", newCount);
      set({ scopeStreak: { scope, count: newCount } });
    }

    // Update recent list (keep last 5)
    const newRecent = [scope, ...recentScopes.slice(0, 4)];
    set({ recentScopes: newRecent });
  },

  // Final score persistence methods
  saveFinalScore(breakdown) {
    dlog("saveFinalScore -> saving breakdown with final score:", breakdown.final);
    set({
      finalScoreCalculated: true,
      finalScoreBreakdown: breakdown,
    });
  },

  clearFinalScore() {
    dlog("clearFinalScore -> clearing saved score");
    set({
      finalScoreCalculated: false,
      finalScoreBreakdown: null,
    });
  },

  // Dilemma history methods
  addHistoryEntry(entry) {
    const { dilemmaHistory } = get();
    const newHistory = [...dilemmaHistory, entry];
    dlog("addHistoryEntry -> Day", entry.day, ":", entry.dilemmaTitle, "→", entry.choiceTitle);
    set({ dilemmaHistory: newHistory });
  },

  clearHistory() {
    dlog("clearHistory -> clearing all dilemma history");
    set({ dilemmaHistory: [] });
  },

  // Goals system methods
  setGoals(goals) {
    const selectedGoals: SelectedGoal[] = goals.map(g => ({
      ...g,
      status: 'unmet' as const,
      lastEvaluatedDay: 0,
    }));
    set({ selectedGoals });
    dlog("setGoals ->", goals.map(g => g.id));
  },

  evaluateGoals() {
    const { selectedGoals } = get();
    if (selectedGoals.length === 0) {
      dlog("evaluateGoals -> no goals selected, skipping");
      return [];
    }

    const updatedGoals = evaluateAllGoals(selectedGoals);

    // Detect status changes for audio/visual feedback
    const changes: GoalStatusChange[] = [];
    selectedGoals.forEach((oldGoal, idx) => {
      const newGoal = updatedGoals[idx];
      if (oldGoal.status !== newGoal.status) {
        changes.push({
          goalId: newGoal.id,
          goalTitle: newGoal.title,
          oldStatus: oldGoal.status,
          newStatus: newGoal.status
        });
      }
    });

    set({ selectedGoals: updatedGoals });
    dlog("evaluateGoals ->", updatedGoals.map(g => `${g.id}: ${g.status}`));

    if (changes.length > 0) {
      dlog("evaluateGoals -> status changes detected:", changes.map(c => `${c.goalId}: ${c.oldStatus} → ${c.newStatus}`));
    }

    return changes;
  },

  incrementCustomActions() {
    const { customActionCount } = get();
    const newCount = customActionCount + 1;
    set({ customActionCount: newCount });
    dlog("incrementCustomActions ->", newCount);
  },

  updateMinimumValues() {
    const state = get();
    const newMinBudget = Math.min(state.minBudget, state.budget);
    const newMinPeople = Math.min(state.minSupportPeople, state.supportPeople);
    const newMinMiddle = Math.min(state.minSupportMiddle, state.supportMiddle);
    const newMinMom = Math.min(state.minSupportMom, state.supportMom);

    set({
      minBudget: newMinBudget,
      minSupportPeople: newMinPeople,
      minSupportMiddle: newMinMiddle,
      minSupportMom: newMinMom,
    });

    dlog("updateMinimumValues ->", {
      budget: newMinBudget,
      people: newMinPeople,
      middle: newMinMiddle,
      mom: newMinMom,
    });
  },
    }),
    {
      name: "amaze-politics-difficulty-v1",
      partialize: (state) => ({
        difficulty: state.difficulty,
        selectedGoals: state.selectedGoals
      })
    }
  )
);

// ---- helpers ----

// Compass component names for enhanced context
const COMPASS_NAMES = {
  what: ["Truth/Trust", "Liberty/Agency", "Equality/Equity", "Care/Solidarity", "Create/Courage", "Wellbeing", "Security/Safety", "Freedom/Responsibility", "Honor/Sacrifice", "Sacred/Awe"],
  whence: ["Evidence", "Public Reason", "Personal", "Tradition", "Revelation", "Nature", "Pragmatism", "Aesthesis", "Fidelity", "Law (Office)"],
  how: ["Law/Std.", "Deliberation", "Mobilize", "Markets", "Mutual Aid", "Ritual", "Design/UX", "Enforce", "Civic Culture", "Philanthropy"],
  whither: ["Self", "Family", "Friends", "In-Group", "Nation", "Civiliz.", "Humanity", "Earth", "Cosmos", "God"]
};

// Analyze compass, power holders, and support to create enhanced context for dilemma generation
function analyzeEnhancedContext() {
  const { values: compassRaw } = useCompassStore.getState();
  const { analysis } = useRoleStore.getState();
  const { supportPeople, supportMiddle, supportMom } = useDilemmaStore.getState();

  // Extract top compass components across all dimensions
  const allComponents: Array<{dimension: string; index: number; name: string; value: number}> = [];

  for (const dim of ["what", "whence", "how", "whither"] as const) {
    const arr = Array.isArray(compassRaw?.[dim]) ? compassRaw[dim] : [];
    arr.forEach((value: number, index: number) => {
      if (value > 0) {
        allComponents.push({
          dimension: dim,
          index,
          name: COMPASS_NAMES[dim][index] || `${dim}${index}`,
          value: Math.max(0, Math.min(10, Math.round(value)))
        });
      }
    });
  }

  // Sort by value and get top 5
  const topCompassComponents = allComponents
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Identify compass tensions (high values in potentially conflicting areas)
  const compassTensions: string[] = [];
  const highValues = allComponents.filter(c => c.value >= 6);

  // Check for common tensions
  const liberty = highValues.find(c => c.name === "Liberty/Agency");
  const security = highValues.find(c => c.name === "Security/Safety");
  const law = highValues.find(c => c.name === "Law/Std." || c.name === "Law (Office)");
  const equality = highValues.find(c => c.name === "Equality/Equity");
  const markets = highValues.find(c => c.name === "Markets");
  const self = highValues.find(c => c.name === "Self");
  const collective = highValues.find(c => c.name === "Humanity" || c.name === "Nation" || c.name === "In-Group");

  if (liberty && (security || law)) compassTensions.push("Freedom vs Order");
  if (equality && markets) compassTensions.push("Equality vs Markets");
  if (self && collective) compassTensions.push("Individual vs Collective");

  // Analyze power holders
  const holders = Array.isArray(analysis?.holders) ? analysis!.holders : [];
  const playerIndex = typeof analysis?.playerIndex === "number" ? analysis!.playerIndex : null;

  const powerHolders = holders.map((h, idx) => ({
    name: String(h?.name ?? "Group"),
    percent: Number((h as any)?.percent ?? 0),
    isPlayer: idx === playerIndex
  }));

  const playerPowerPercent = playerIndex !== null && holders[playerIndex]
    ? Number((holders[playerIndex] as any)?.percent ?? 0)
    : 0;

  // Identify support crises
  const lowSupportEntities: string[] = [];
  const criticalSupportEntities: string[] = [];

  if (supportPeople < 25) lowSupportEntities.push("people");
  if (supportPeople < 20) criticalSupportEntities.push("people");

  if (supportMiddle < 25) lowSupportEntities.push("middle");
  if (supportMiddle < 20) criticalSupportEntities.push("middle");

  if (supportMom < 25) lowSupportEntities.push("mom");
  if (supportMom < 20) criticalSupportEntities.push("mom");

  return {
    compassTensions,
    topCompassComponents,
    powerHolders,
    playerPowerPercent,
    lowSupportEntities,
    criticalSupportEntities
  };
}

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

/**
 * Flatten compass values with top 3 optimization
 * Sorts all values by magnitude, sends ONLY top 3 per dimension
 * Reduces token usage by ~300 tokens (40 keys → ~12 keys)
 *
 * Example input:  { what: [0, 0, 4, 0, 0, 2, 0, 0, 0, 0] }
 * Example output: { what2: 4, what5: 2 } (only 2 keys, not 10!)
 */
function flattenCompassOptimized(vals: any): Record<string, number> {
  const out: Record<string, number> = {};

  for (const k of ["what", "whence", "how", "whither"] as const) {
    const arr = Array.isArray(vals?.[k]) ? vals[k] : [];

    // Sort by value descending, take top 3 with their indices
    const top3 = arr
      .map((v, i) => ({ v: Number(v) || 0, i }))
      .sort((a, b) => b.v - a.v) // Highest first
      .slice(0, 3) // Take only top 3
      .filter(x => x.v > 0); // Skip zeros (optional but saves tokens)

    // Add only these 3 values to output (not all 10!)
    top3.forEach(({ v, i }) => {
      const clamped = Math.max(0, Math.min(10, Math.round(v)));
      out[`${k}${i}`] = clamped;
    });
  }

  return out; // Returns ~12 keys instead of 40!
}

export function buildSnapshot(): DilemmaRequest {
    const { debugMode, dilemmasSubjectEnabled, dilemmasSubject } =
      useSettingsStore.getState();
    const { day, totalDays, lastChoice, supportPeople, supportMiddle, supportMom, recentTopics, topicCounts, dilemmaHistory } = useDilemmaStore.getState();

    // Calculate days left (for epic finale and game conclusion)
    const daysLeft = totalDays - day + 1;

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

    // holders: map store's {name, percent} -> API snapshot {name, percent}
    const holders = Array.isArray(roleState.analysis?.holders)
      ? roleState.analysis!.holders.map((h) => ({
          name: String(h?.name ?? "Group"),
          // Send as 'percent' to match server expectation; default to 0 when missing
          percent: Number((h as any)?.percent ?? 0),
        }))
      : [];

    const playerIndex =
      typeof roleState.analysis?.playerIndex === "number"
        ? roleState.analysis!.playerIndex
        : null;

    // OPTIMIZED: Compass values with top 3 per dimension (reduces ~300 tokens)
    const compassRaw = useCompassStore.getState().values;
    const compassValues = flattenCompassOptimized(compassRaw);

    // Enhanced context for intelligent dilemma generation (NewDilemmaLogic.md compliance)
    const enhancedContext = analyzeEnhancedContext();

    const snap: DilemmaRequest = {
      // DilemmaRequest expects string, so never undefined.
      // The server will treat "" as "no value" and apply its own fallback.
      role: roleText,
      systemName: systemText,

      holders,
      playerIndex,
      compassValues,

      settings: { dilemmasSubjectEnabled, dilemmasSubject },
      day,
      totalDays,
      daysLeft,
      previous: { isFirst: day === 1, isLast: day === totalDays },

      // NEW: Send current support values for crisis detection (Rule 4d.vi, Rule 25b.ii)
      supports: {
        people: supportPeople,
        middle: supportMiddle,
        mom: supportMom
      },

      // OPTIMIZED: Trim lastChoice (only title + summary, no cost/iconHint)
      lastChoice: lastChoice ? {
        title: lastChoice.title,
        summary: lastChoice.summary
        // Omit: id, cost, iconHint (not needed by server)
      } as any : null,

      // NEW: Send topic tracking for diversity (Rule #9)
      recentTopics: recentTopics || [],
      topicCounts: topicCounts || {},

      // NEW: Send enhanced context analysis
      enhancedContext: enhancedContext || null,

      // OPTIMIZED: Only last 2 days of history (reduces ~400 tokens)
      dilemmaHistory: (dilemmaHistory || []).slice(-2),

      debug: debugMode,
    };

    // Debug: Log lastChoice being sent
    if (day > 1) {
      console.log('[buildSnapshot] Day 2+ - lastChoice being sent:', lastChoice ? { id: lastChoice.id, title: lastChoice.title } : 'NULL');
    }

    return snap;
  }

/**
 * Get top 2 "what" compass values (sorted descending by value)
 * Used on Day 1 to personalize initial dilemma generation
 * Returns array like ["Liberty/Agency", "Care/Solidarity"]
 */
function getTop2WhatValues(): string[] {
  const compassValues = useCompassStore.getState().values;
  const whatValues = compassValues.what || [];
  const whatComponents = COMPONENTS.what;

  // Create array of { idx, short, value }
  const withMetadata = whatValues.map((val, idx) => ({
    idx,
    short: whatComponents[idx]?.short ?? "",
    value: Math.max(0, Math.min(10, Math.round(val))), // clamp 0-10
  }));

  // Sort by value descending, take top 2, extract short names
  const top2 = withMetadata
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map(item => item.short);

  return top2;
}

/**
 * Build minimal snapshot for light dilemma API
 * Much simpler than buildSnapshot() - only role, system, streak, and previous choice
 */
export function buildLightSnapshot(): LightDilemmaRequest {
  const { debugMode, useLightDilemmaAnthropic, dilemmasSubjectEnabled, dilemmasSubject, skipPreviousContext } = useSettingsStore.getState();
  const { day, totalDays, lastChoice, current, subjectStreak, scopeStreak, recentScopes, recentDilemmaTitles } = useDilemmaStore.getState();
  const roleState = useRoleStore.getState();

  // Calculate days left (for epic finale and game conclusion)
  const daysLeft = totalDays - day + 1;

  // Extract role (combine role name with any setting context)
  const role = typeof roleState.selectedRole === "string" && roleState.selectedRole.trim()
    ? roleState.selectedRole.trim()
    : "Unicorn King";

  // Extract political system
  const system = typeof roleState.analysis?.systemName === "string" && roleState.analysis.systemName.trim()
    ? roleState.analysis.systemName.trim()
    : "Divine Right Monarchy";

  // Build previous choice data (only for day 2+)
  // SAFETY: Validate all fields before sending to AI
  // DEBUG: Can be disabled via skipPreviousContext setting
  let previous: LightDilemmaRequest['previous'] | undefined = undefined;
  if (day > 1 && lastChoice && current && !skipPreviousContext) {
    // Validate that we have all required data
    const hasValidTitle = current.title && typeof current.title === 'string' && current.title.trim().length > 0;
    const hasValidDescription = current.description && typeof current.description === 'string' && current.description.trim().length > 0;
    const hasValidChoiceTitle = lastChoice.title && typeof lastChoice.title === 'string' && lastChoice.title.trim().length > 0;

    if (!hasValidTitle) {
      console.error('[buildLightSnapshot] ⚠️ Day 2+ but current.title is invalid:', current.title);
      console.error('[buildLightSnapshot] Skipping previous context to avoid AI failure');
    } else if (!hasValidDescription) {
      console.error('[buildLightSnapshot] ⚠️ Day 2+ but current.description is invalid:', current.description);
      console.error('[buildLightSnapshot] Skipping previous context to avoid AI failure');
    } else if (!hasValidChoiceTitle) {
      console.error('[buildLightSnapshot] ⚠️ Day 2+ but lastChoice.title is invalid:', lastChoice.title);
      console.error('[buildLightSnapshot] Skipping previous context to avoid AI failure');
    } else {
      // All data is valid, build the previous object
      previous = {
        title: current.title,
        description: current.description,
        choiceTitle: lastChoice.title,
        // Fallback to title if summary is empty (bug workaround for AI not generating summaries)
        choiceSummary: lastChoice.summary || lastChoice.title
      };

      if (debugMode) {
        console.log('[buildLightSnapshot] ✅ Previous context validated and included');
        console.log('[buildLightSnapshot] Previous dilemma:', previous.title);
        console.log('[buildLightSnapshot] Player choice:', previous.choiceTitle);
      }
    }
  } else if (day > 1 && skipPreviousContext) {
    console.log('[buildLightSnapshot] ⚠️ Day 2+ but skipPreviousContext is enabled - treating as Day 1');
  }

  // Get top 2 "what" values on Day 1 for personalized dilemma
  let topWhatValues: string[] | undefined = undefined;
  if (day === 1) {
    topWhatValues = getTop2WhatValues();
    if (debugMode) {
      console.log('[buildLightSnapshot] Day 1 - Top what values:', topWhatValues);
    }
  }

  // Build thematic guidance (custom subject or default axes)
  let thematicGuidance: string | undefined = undefined;
  if (dilemmasSubjectEnabled && dilemmasSubject && dilemmasSubject.trim()) {
    thematicGuidance = `Focus on: ${dilemmasSubject.trim()}`;
  } else {
    thematicGuidance = "Explore issues on axes: autonomy vs heteronomy, liberalism vs totalism";
  }
  if (debugMode) {
    console.log('[buildLightSnapshot] Thematic guidance:', thematicGuidance);
  }

  const request: LightDilemmaRequest = {
    role,
    system,
    daysLeft,
    subjectStreak: subjectStreak || null,
    scopeStreak: scopeStreak || null, // NEW: Scope streak tracking
    recentScopes: recentScopes || [], // NEW: Last 5 scopes for diversity checking
    recentDilemmaTitles: recentDilemmaTitles.slice(0, 3), // NEW: Last 3 titles for semantic variety
    previous,
    topWhatValues, // Only defined on Day 1
    thematicGuidance, // Always included (custom subject or default axes)
    debug: debugMode,
    useAnthropic: useLightDilemmaAnthropic
  };

  if (debugMode) {
    console.log('[buildLightSnapshot] Built light request:', request);
  }

  return request;
}

/**
 * Load next dilemma using the light API (fast, minimal payload)
 * Includes integrated support shift analysis in the response
 */
async function loadNextLight(): Promise<Dilemma | null> {
  const { debugMode } = useSettingsStore.getState();
  const { day, supportPeople, supportMiddle, supportMom, setSupportPeople, setSupportMiddle, setSupportMom, updateSubjectStreak, updateScopeStreak, addDilemmaTitle } = useDilemmaStore.getState();

  try {
    const snapshot = buildLightSnapshot();

    const r = await fetch("/api/dilemma-light", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });

    if (!r.ok) {
      const t = await r.text();
      console.error("[loadNextLight] API failed:", r.status, t);
      return null;
    }

    const raw: LightDilemmaResponse = await r.json();

    // DIAGNOSTIC: Log what API actually returned (always visible for debugging)
    console.log('[loadNextLight] Raw API response - scope:', raw.scope, '| topic:', raw.topic);

    if (debugMode) {
      console.log("[loadNextLight] Response received:", raw);
    }

    // Store the new dilemma title for semantic variety tracking
    if (raw.title) {
      addDilemmaTitle(raw.title);
    }

    // Apply support shifts if they exist (Day 2+)
    if (raw.supportShift && day > 1) {
      const { people, mom, holders } = raw.supportShift;

      // Apply deltas with clamping to 0-100
      const newPeople = Math.max(0, Math.min(100, supportPeople + people.delta));
      const newMom = Math.max(0, Math.min(100, supportMom + mom.delta));
      const newMiddle = Math.max(0, Math.min(100, supportMiddle + holders.delta)); // KEY: holders → middle

      setSupportPeople(newPeople);
      setSupportMom(newMom);
      setSupportMiddle(newMiddle);

      if (debugMode) {
        console.log("[loadNextLight] Support shifts applied:", {
          people: `${supportPeople} → ${newPeople} (${people.delta > 0 ? '+' : ''}${people.delta})`,
          mom: `${supportMom} → ${newMom} (${mom.delta > 0 ? '+' : ''}${mom.delta})`,
          middle: `${supportMiddle} → ${newMiddle} (${holders.delta > 0 ? '+' : ''}${holders.delta})`
        });
        console.log("[loadNextLight] Support reasons:", {
          people: people.why,
          mom: mom.why,
          holders: holders.why
        });
      }
    }

    // Update subject streak tracking
    if (raw.topic) {
      updateSubjectStreak(raw.topic);
    }

    // Update scope streak tracking
    if (raw.scope) {
      updateScopeStreak(raw.scope);
    }

    // Build Dilemma object (same format as standard API)
    const dilemma: Dilemma = {
      title: raw.title,
      description: raw.description,
      actions: raw.actions
    };

    if (debugMode) {
      console.log("[loadNextLight] Dilemma created:", dilemma);
    }

    return dilemma;

  } catch (e: any) {
    console.error("[loadNextLight] Error:", e?.message || e);
    return null;
  }
}
