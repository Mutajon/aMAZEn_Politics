// src/store/dilemmaStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Dilemma, DilemmaAction, DilemmaHistoryEntry, SubjectStreak, DilemmaScope, ScopeStreak, LightDilemmaRequest, LightDilemmaResponse } from "../lib/dilemma";
import type { ScoreBreakdown } from "../lib/scoring";
import type { Goal, SelectedGoal } from "../data/goals";
import type { CompassPill } from "../hooks/useEventDataCollector";
import { evaluateAllGoals } from "../lib/goalEvaluation";
import { useSettingsStore } from "./settingsStore";
import { useRoleStore } from "./roleStore";
import { useCompassStore } from "./compassStore"; // <-- A) use compass values (0..10)
import { COMPONENTS } from "../data/compass-data"; // <-- B) component definitions for value names
import { getTreatmentConfig, type TreatmentType } from "../data/experimentConfig"; // <-- Inquiry system config

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

  // Hosted state conversation tracking
  gameId: string | null;           // Unique ID for this playthrough (persists conversation)
  conversationActive: boolean;     // True when using hosted state API
  narrativeMemory: {               // Dynamic Story Spine: Narrative scaffold for 7-day arc
    threads: string[];
    climaxCandidates: string[];
    thematicEmphasis: {
      coreConflict: string;
      emotionalTone: string;
      stakes: string;
    };
    threadDevelopment: Array<{
      day: number;
      thread: number | null;
      summary: string;
    }>;
  } | null;

  // Inquiry System (Treatment-based feature for player questions about dilemmas)
  inquiryHistory: Map<number, Array<{ question: string; answer: string; timestamp: number }>>;
  inquiryCreditsRemaining: number;  // Resets each dilemma based on treatment config

  // Reasoning System (Treatment-based feature for player to explain decisions)
  reasoningHistory: Array<{
    day: number;
    actionId: string;
    actionTitle: string;
    actionDescription: string;
    reasoningText: string;
    timestamp: number;
  }>;

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
  finalScoreSubmitted: boolean; // Prevent duplicate highscore submissions

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

  // Crisis state tracking (NEW)
  crisisMode: "people" | "challenger" | "caring" | "downfall" | null;
  crisisEntity: string | null; // Name of the entity in crisis
  previousSupportValues: {
    people: number;
    middle: number;
    mom: number;
  } | null;

  // Corruption tracking (mirrors crisis pattern)
  corruptionLevel: number;                    // Current 0-100
  previousCorruptionValue: number | null;     // For animation
  corruptionHistory: Array<{
    day: number;
    score: number;      // AI's 0-10 judgment
    reason: string;
    level: number;      // Resulting 0-100 level
  }>;

  // Pending compass pills (applied in cleaner phase, displayed in EventScreen)
  pendingCompassPills: CompassPill[] | null;

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
  markScoreSubmitted: () => void;

  // Dilemma history methods
  addHistoryEntry: (entry: DilemmaHistoryEntry) => void;
  clearHistory: () => void;

  // Goals system methods
  setGoals: (goals: Goal[]) => void;
  evaluateGoals: () => GoalStatusChange[];
  incrementCustomActions: () => void;
  updateMinimumValues: () => void;

  // Hosted state conversation methods
  initializeGame: () => void;      // Generate gameId and prepare for new game
  endConversation: () => void;     // Cleanup after game ends
  setNarrativeMemory: (memory: DilemmaState['narrativeMemory']) => void; // Store narrative scaffold

  // Inquiry system methods (Treatment-based feature)
  resetInquiryCredits: () => void;                             // Reset credits for new dilemma
  addInquiry: (question: string, answer: string) => void;      // Store Q&A pair
  getInquiriesForCurrentDay: () => Array<{question: string, answer: string, timestamp: number}>;  // Retrieve current day inquiries
  canInquire: () => boolean;                                   // Check if inquiries are available

  // Reasoning system methods (Treatment-based feature)
  addReasoningEntry: (entry: {
    day: number;
    actionId: string;
    actionTitle: string;
    actionDescription: string;
    reasoningText: string;
  }) => void;                                                   // Store reasoning entry

  // Crisis detection methods (NEW)
  detectAndSetCrisis: () => "downfall" | "people" | "challenger" | "caring" | null;  // Detect crisis after support updates, returns crisis mode
  clearCrisis: () => void;          // Clear crisis state after handling
  savePreviousSupport: () => void;  // Store support values before updates

  // Corruption tracking methods (mirrors support pattern)
  setCorruptionLevel: (n: number) => void;
  savePreviousCorruption: () => void;
  clearCorruptionHistory: () => void;
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

  // Hosted state conversation
  gameId: null,
  conversationActive: false,
  narrativeMemory: null, // Will be populated during BackgroundIntroScreen

  // Inquiry system (initialized with 0 credits, reset per dilemma based on treatment)
  inquiryHistory: new Map(),
  inquiryCreditsRemaining: 0,

  // Reasoning system (initialized empty, populated as player provides reasoning)
  reasoningHistory: [],

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
  finalScoreSubmitted: false,

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

  // Crisis state tracking (NEW)
  crisisMode: null,
  crisisEntity: null,
  previousSupportValues: null,

  // Corruption tracking (start clean, increases only with corrupt actions)
  corruptionLevel: 0,
  previousCorruptionValue: null,
  corruptionHistory: [],
  pendingCompassPills: null,

  async loadNext() {
    // If something is already loading, bail early
    if (get().loading || loadNextInFlight) {
      dlog("loadNext: skipped (already in flight)");
      return;
    }

    loadNextInFlight = true;
    set({ loading: true, error: null });

    try {
      console.log("[dilemmaStore.loadNext] Calling light API via loadNextLight()");
      dlog("loadNext: using light API");
      const d = await loadNextLight();

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
      gameId: null,
      conversationActive: false,
      current: null,
      history: [],
      loading: false,
      error: null,
      lastChoice: null,
      dilemmaHistory: [],
      reasoningHistory: [],
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
      finalScoreSubmitted: false,
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
      crisisMode: null,
      crisisEntity: null,
      previousSupportValues: null,
      corruptionLevel: 0,
      previousCorruptionValue: null,
      corruptionHistory: [],
      pendingCompassPills: null,
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

    // Check if budget system is enabled
    const { showBudget } = useSettingsStore.getState();

    // Apply support modifiers (add percentage points, clamped to 0-100)
    // Only apply budget modifier if budget system is enabled
    set({
      supportPeople: Math.max(0, Math.min(100, 50 + mod.supportMod)),
      supportMiddle: Math.max(0, Math.min(100, 50 + mod.supportMod)),
      supportMom: Math.max(0, Math.min(100, 50 + mod.supportMod)),
      budget: showBudget ? 1500 + mod.budgetMod : 1500, // Default budget if disabled
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
      finalScoreSubmitted: false,
    });
  },

  markScoreSubmitted() {
    dlog("markScoreSubmitted -> marking score as submitted to highscores");
    set({
      finalScoreSubmitted: true,
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

  // ========================================================================
  // HOSTED STATE CONVERSATION METHODS
  // ========================================================================

  initializeGame() {
    // Generate unique gameId for this playthrough
    // Format: timestamp + random string for uniqueness
    const gameId = `game-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    dlog("initializeGame -> gameId:", gameId);

    set({
      gameId,
      conversationActive: true
    });
  },

  endConversation() {
    const { gameId } = get();

    if (gameId) {
      // Call backend to cleanup conversation
      fetch("/api/game-turn/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId })
      }).catch(err => {
        console.warn("[dilemmaStore] Failed to cleanup conversation:", err);
      });

      dlog("endConversation -> gameId:", gameId);
    }

    set({
      gameId: null,
      conversationActive: false
    });
  },

  setNarrativeMemory(memory) {
    dlog("setNarrativeMemory ->", memory);
    set({ narrativeMemory: memory });
  },

  // ========================================================================
  // INQUIRY SYSTEM METHODS
  // ========================================================================

  resetInquiryCredits() {
    // Get treatment config from settings store
    const treatment = useSettingsStore.getState().treatment as TreatmentType;
    const config = getTreatmentConfig(treatment);

    dlog("resetInquiryCredits ->", config.inquiryTokensPerDilemma);

    set({
      inquiryCreditsRemaining: config.inquiryTokensPerDilemma
    });
  },

  addInquiry(question, answer) {
    const { day, inquiryHistory, inquiryCreditsRemaining } = get();

    // Get or create array for current day
    if (!inquiryHistory.has(day)) {
      inquiryHistory.set(day, []);
    }

    // Add new inquiry
    const dayInquiries = inquiryHistory.get(day)!;
    dayInquiries.push({
      question,
      answer,
      timestamp: Date.now()
    });

    // Decrement credits
    const newCredits = Math.max(0, inquiryCreditsRemaining - 1);

    dlog("addInquiry -> day", day, "remaining credits:", newCredits);

    set({
      inquiryHistory: new Map(inquiryHistory), // Create new Map to trigger reactivity
      inquiryCreditsRemaining: newCredits
    });
  },

  getInquiriesForCurrentDay() {
    const { day, inquiryHistory } = get();
    return inquiryHistory.get(day) || [];
  },

  canInquire() {
    const { inquiryCreditsRemaining } = get();
    const treatment = useSettingsStore.getState().treatment as TreatmentType;
    const config = getTreatmentConfig(treatment);

    // Feature available if treatment allows it AND player has credits
    return config.inquiryTokensPerDilemma > 0 && inquiryCreditsRemaining > 0;
  },

  // ========================================================================
  // REASONING SYSTEM METHODS
  // ========================================================================

  addReasoningEntry(entry) {
    const { reasoningHistory } = get();

    // Add timestamp to entry
    const entryWithTimestamp = {
      ...entry,
      timestamp: Date.now()
    };

    // Append to history
    const newHistory = [...reasoningHistory, entryWithTimestamp];

    dlog("addReasoningEntry -> day", entry.day, "action:", entry.actionTitle, "length:", entry.reasoningText.length);

    set({ reasoningHistory: newHistory });
  },

  // ========================================================================
  // CRISIS DETECTION METHODS
  // ========================================================================

  savePreviousSupport() {
    const { supportPeople, supportMiddle, supportMom } = get();

    dlog("savePreviousSupport ->", {
      people: supportPeople,
      middle: supportMiddle,
      mom: supportMom
    });

    set({
      previousSupportValues: {
        people: supportPeople,
        middle: supportMiddle,
        mom: supportMom
      }
    });
  },

  detectAndSetCrisis() {
    const { supportPeople, supportMiddle, supportMom } = get();
    const CRISIS_THRESHOLD = 20;

    // Check if any track is below threshold
    const peopleInCrisis = supportPeople < CRISIS_THRESHOLD;
    const challengerInCrisis = supportMiddle < CRISIS_THRESHOLD;
    const caringInCrisis = supportMom < CRISIS_THRESHOLD;

    // Determine crisis mode (priority: downfall > people > challenger > caring)
    let crisisMode: typeof get extends () => infer S ? S extends { crisisMode: infer C } ? C : never : never = null;
    let crisisEntity: string | null = null;

    if (peopleInCrisis && challengerInCrisis && caringInCrisis) {
      crisisMode = "downfall";
      crisisEntity = "ALL";
      dlog(`detectAndSetCrisis -> DOWNFALL: All three tracks below ${CRISIS_THRESHOLD}%`);
    } else if (peopleInCrisis) {
      crisisMode = "people";
      crisisEntity = "The People";
      dlog(`detectAndSetCrisis -> PEOPLE CRISIS: ${supportPeople}%`);
    } else if (challengerInCrisis) {
      crisisMode = "challenger";

      // Get challenger name from roleStore if available
      const roleState = useRoleStore.getState();
      crisisEntity = roleState.analysis?.challengerSeat?.name || "Institutional Opposition";
      dlog(`detectAndSetCrisis -> CHALLENGER CRISIS: ${supportMiddle}% (${crisisEntity})`);
    } else if (caringInCrisis) {
      crisisMode = "caring";
      crisisEntity = "Personal Anchor";
      dlog(`detectAndSetCrisis -> CARING CRISIS: ${supportMom}%`);
    } else {
      dlog("detectAndSetCrisis -> No crisis detected");
    }

    set({ crisisMode, crisisEntity });

    return crisisMode;
  },

  clearCrisis() {
    dlog("clearCrisis -> Clearing crisis state");
    set({
      crisisMode: null,
      crisisEntity: null,
      previousSupportValues: null
    });
  },

  // Corruption tracking methods (mirror support pattern)
  setCorruptionLevel(n) {
    const clamped = Math.max(0, Math.min(100, Number(n) || 50));
    dlog("setCorruptionLevel:", clamped);
    set({ corruptionLevel: clamped });
  },

  savePreviousCorruption() {
    const { corruptionLevel } = get();
    dlog("savePreviousCorruption:", corruptionLevel);
    set({ previousCorruptionValue: corruptionLevel });
  },

  clearCorruptionHistory() {
    dlog("clearCorruptionHistory");
    set({ corruptionHistory: [] });
  },
    }),
    {
      name: "amaze-politics-game-state-v2", // Updated version to include gameId
      partialize: (state) => ({
        gameId: state.gameId, // Persist gameId for conversation continuity
        conversationActive: state.conversationActive,
        difficulty: state.difficulty,
        selectedGoals: state.selectedGoals,
        finalScoreSubmitted: state.finalScoreSubmitted
      })
    }
  )
);

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
  const { day, totalDays, lastChoice, current, subjectStreak, scopeStreak, recentScopes, recentDilemmaTitles, dilemmaHistory } = useDilemmaStore.getState();
  const roleState = useRoleStore.getState();

  // Calculate days left (for epic finale and game conclusion)
  const daysLeft = totalDays - day + 1;

  // Extract recent topics from dilemma history for forbidden list (last 4 days)
  const recentTopics = dilemmaHistory
    .slice(-4)
    .map(entry => entry.topic)
    .filter(Boolean) as string[];

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

  // Get top 2 "what" values on Days 1, 3, 5 for personalized dilemmas
  let topWhatValues: string[] | undefined = undefined;
  if (day === 1 || day === 3 || day === 5) {
    topWhatValues = getTop2WhatValues();
    if (debugMode) {
      console.log(`[buildLightSnapshot] Day ${day} - Top what values:`, topWhatValues);
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
    day, // NEW: Current day (1-7) for day-based variety logic
    daysLeft,
    subjectStreak: subjectStreak || null,
    scopeStreak: scopeStreak || null, // NEW: Scope streak tracking
    recentScopes: recentScopes || [], // NEW: Last 5 scopes for diversity checking
    recentDilemmaTitles: recentDilemmaTitles.slice(0, 2), // NEW: Last 2 titles for semantic variety (2-2-2-1 pattern)
    recentTopics, // NEW: Last 4 broad topics for forbidden list (Days 3 & 5)
    previous,
    topWhatValues, // Only defined on Days 1, 3, 5
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
      console.log('[loadNextLight] 📝 Storing dilemma title:', raw.title);
      addDilemmaTitle(raw.title);
      console.log('[loadNextLight] ✅ Title stored. Current titles:', useDilemmaStore.getState().recentDilemmaTitles);
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
