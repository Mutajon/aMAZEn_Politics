// src/hooks/useEventDataCollector.ts
// EventDataCollector: Gathers ALL data needed for a dilemma screen
//
// Handles:
// - Day 1 vs Day 2+ differences
// - API dependencies (dilemma before mirror)
// - Fallbacks for optional data
// - Errors for required data (dilemma)
//
// Used by: EventScreen3
// Dependencies: dilemmaStore, roleStore, compassStore

import { useState, useCallback, useRef } from "react";
import { useDilemmaStore, buildLightSnapshot } from "../store/dilemmaStore";
import type { GoalStatusChange } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";
import { useCompassStore } from "../store/compassStore";
import { useSettingsStore } from "../store/settingsStore";
import { COMPONENTS, type PropKey } from "../data/compass-data";
import type { Dilemma, DilemmaAction, LightDilemmaResponse } from "../lib/dilemma";
import type { TickerItem } from "../components/event/NewsTicker";
import { audioManager } from "../lib/audioManager";

// ============================================================================
// TYPES
// ============================================================================

export type SupportEffect = {
  id: "people" | "middle" | "mom";
  delta: number;
  explain: string;
};

export type CompassPill = {
  prop: "what" | "whence" | "how" | "whither";
  idx: number;
  delta: number;
};

export type DynamicParam = {
  id: string;
  icon: string;
  text: string;
  tone: "up" | "down" | "neutral";
};

// PHASE 1: Critical data - must load before showing anything
export type Phase1Data = {
  dilemma: Dilemma;
  supportEffects: SupportEffect[] | null; // Included in dilemma response on Day 2+
  newsItems: TickerItem[]; // Empty array (disabled)
};

// PHASE 2: Secondary data - loads in background while user reads
export type Phase2Data = {
  compassPills: CompassPill[] | null;
  dynamicParams: DynamicParam[] | null;
};

// PHASE 3: Tertiary data - loads in background while user reads
export type Phase3Data = {
  mirrorText: string;
};

// Legacy type for backward compatibility (deprecated)
export type CollectedData = Phase1Data & Phase2Data & Phase3Data & {
  status: {
    dilemmaReady: boolean;
    mirrorReady: boolean;
    newsReady: boolean;
    supportReady: boolean;
    compassReady: boolean;
    dynamicReady: boolean;
  };
  errors: {
    dilemma?: Error;
    mirror?: Error;
    news?: Error;
    support?: Error;
    compass?: Error;
    dynamic?: Error;
  };
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get top 3 compass values from a dimension array (for API payload optimization)
 * Sorts by value descending, returns sparse array with top 3 values at their original indices
 *
 * @param arr - Full compass dimension array (10 values)
 * @returns Sparse array with only top 3 values, rest are 0 (maintains index alignment)
 *
 * Example: [8.5, 2.1, 7.2, 1.5, 6.1, 0.5, 3.2, 1.0, 0.8, 0.3]
 *       → [8.5, 0, 7.2, 0, 6.1, 0, 0, 0, 0, 0]
 */
function getTop3CompassValues(arr: number[] | undefined): number[] {
  if (!Array.isArray(arr) || arr.length === 0) return [];

  // Create array of [value, originalIndex] pairs
  const indexed = arr.map((v, i) => ({ v: Number(v) || 0, i }));

  // Sort by value descending, take top 3
  const top3 = indexed.sort((a, b) => b.v - a.v).slice(0, 3);

  // Build sparse result array - only top 3 values at original indices
  const result = new Array(arr.length).fill(0);
  top3.forEach(({ v, i }) => { result[i] = v; });

  return result;
}

/**
 * Build optimized compass payload with top 3 values per dimension
 * Reduces token usage by ~300 tokens (40 values → 12 values)
 */
function buildOptimizedCompassPayload(compassValues: any): any {
  if (!compassValues) return { what: [], whence: [], how: [], whither: [] };

  return {
    what: getTop3CompassValues(compassValues?.what),
    whence: getTop3CompassValues(compassValues?.whence),
    how: getTop3CompassValues(compassValues?.how),
    whither: getTop3CompassValues(compassValues?.whither)
  };
}

/**
 * Get top K compass values with names and strengths (not indices)
 * Returns value names for natural language mirror recommendations
 * NO threshold filtering - just sort and take top K
 */
function topKWithNames(arr: number[] | undefined, prop: PropKey, k = 3): Array<{ name: string; strength: number }> {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((v, i) => ({
      v: Number(v) || 0,
      i,
      name: COMPONENTS[prop]?.[i]?.short || `${prop} #${i + 1}`,
    }))
    // NO threshold filter - just sort by value
    .sort((a, b) => b.v - a.v)
    .slice(0, k)
    .map(x => ({ name: x.name, strength: Math.round(x.v * 10) / 10 }));
}

/**
 * Get top overall values across all compass dimensions
 * NO threshold filtering - just sort and take top K
 */
function topOverallWithNames(compassValues: any, k = 3): Array<{ name: string; strength: number; dimension: PropKey }> {
  const allValues: Array<{ v: number; name: string; dimension: PropKey }> = [];

  (["what", "whence", "how", "whither"] as PropKey[]).forEach((prop) => {
    const arr = Array.isArray(compassValues?.[prop]) ? compassValues[prop] : [];
    arr.forEach((v: number, i: number) => {
      allValues.push({
        v: Number(v) || 0,
        name: COMPONENTS[prop]?.[i]?.short || `${prop} #${i + 1}`,
        dimension: prop,
      });
    });
  });

  return allValues
    // NO threshold filter - just sort by value
    .sort((a, b) => b.v - a.v)
    .slice(0, k)
    .map(x => ({
      name: x.name,
      strength: Math.round(x.v * 10) / 10,
      dimension: x.dimension
    }));
}

/**
 * UNIFIED GAME TURN API - Fetches ALL data in one call using hosted state
 *
 * Replaces: fetchDilemma(), fetchCompassPills(), fetchDynamicParams(), fetchMirrorText()
 *
 * Benefits:
 * - AI maintains full conversation context across all 7 days
 * - Single API call instead of 4 separate calls (~50% faster)
 * - Better narrative continuity
 * - ~50% token savings after Day 1
 */
async function fetchGameTurn(): Promise<{
  dilemma: Dilemma;
  supportEffects: SupportEffect[] | null;
  compassPills: CompassPill[] | null;
  dynamicParams: DynamicParam[] | null;
  mirrorText: string;
}> {
  const {
    gameId,
    day,
    lastChoice,
    supportPeople,
    supportMiddle,
    supportMom,
    setSupportPeople,
    setSupportMiddle,
    setSupportMom,
    updateSubjectStreak,
    initializeGame
  } = useDilemmaStore.getState();

  const { values: compassValues } = useCompassStore.getState();

  // Day 1: Initialize game if no gameId exists
  if (day === 1 && !gameId) {
    initializeGame();
  }

  const currentGameId = useDilemmaStore.getState().gameId;

  if (!currentGameId) {
    throw new Error("No gameId - unable to create conversation");
  }

  // Build request payload
  const payload: any = {
    gameId: currentGameId,
    day
  };

  // Day 1: Send full game context
  if (day === 1) {
    const roleState = useRoleStore.getState();
    const topWhatValues = getTop2WhatValues();
    const { dilemmasSubjectEnabled, dilemmasSubject } = useSettingsStore.getState();

    payload.gameContext = {
      role: roleState.selectedRole || "Unicorn King",
      roleTitle: roleState.roleTitle || null,          // Scenario title (predefined only)
      roleIntro: roleState.roleIntro || null,          // Historical context paragraph (predefined only)
      roleYear: roleState.roleYear || null,            // Year/era (predefined only)
      systemName: roleState.analysis?.systemName || "Divine Right Monarchy",
      systemDesc: roleState.analysis?.systemDesc || "Power flows from divine mandate",
      powerHolders: roleState.analysis?.holders || [],
      challengerSeat: roleState.analysis?.challengerSeat || null,  // NEW: Primary institutional opponent
      playerCompass: {
        what: topWhatValues.join(', '),
        whence: topKWithNames(compassValues?.whence, 'whence', 2).map(v => v.name).join(', '),
        how: topKWithNames(compassValues?.how, 'how', 2).map(v => v.name).join(', '),
        whither: topKWithNames(compassValues?.whither, 'whither', 2).map(v => v.name).join(', ')
      },
      topWhatValues,
      totalDays: 7,
      thematicGuidance: dilemmasSubjectEnabled && dilemmasSubject
        ? `Focus on: ${dilemmasSubject}`
        : null
    };
  }

  // Day 2+: Send player choice and compass update
  if (day > 1 && lastChoice) {
    payload.playerChoice = {
      title: lastChoice.title,
      summary: lastChoice.summary || lastChoice.title,
      cost: lastChoice.cost
    };

    payload.compassUpdate = compassValues;
  }

  // CRISIS DETECTION: Check support thresholds (<20% triggers consequences)
  // Frontend-driven crisis detection sends specialized mode to backend
  const CRISIS_THRESHOLD = 20;
  const peopleInCrisis = supportPeople < CRISIS_THRESHOLD;
  const challengerInCrisis = supportMiddle < CRISIS_THRESHOLD;
  const caringInCrisis = supportMom < CRISIS_THRESHOLD;

  if (peopleInCrisis || challengerInCrisis || caringInCrisis) {
    // Determine crisis mode (priority: downfall > people > challenger > caring)
    if (peopleInCrisis && challengerInCrisis && caringInCrisis) {
      payload.crisisMode = "downfall"; // All three < 20% → game ends
      console.log(`[fetchGameTurn] ⚠️ DOWNFALL CRISIS: All support tracks below ${CRISIS_THRESHOLD}%`);
    } else if (peopleInCrisis) {
      payload.crisisMode = "people"; // Public < 20% → mass backlash
      console.log(`[fetchGameTurn] ⚠️ PEOPLE CRISIS: Public support at ${supportPeople}%`);
    } else if (challengerInCrisis) {
      payload.crisisMode = "challenger"; // Challenger < 20% → institutional retaliation
      console.log(`[fetchGameTurn] ⚠️ CHALLENGER CRISIS: Challenger support at ${supportMiddle}%`);
    } else if (caringInCrisis) {
      payload.crisisMode = "caring"; // Caring anchor < 20% → personal crisis
      console.log(`[fetchGameTurn] ⚠️ CARING CRISIS: Caring anchor support at ${supportMom}%`);
    }
  }

  console.log(`[fetchGameTurn] Calling /api/game-turn for Day ${day}, gameId=${currentGameId}`);

  const response = await fetch("/api/game-turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Game turn API failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Validate required fields
  if (!data.title || !data.description || !Array.isArray(data.actions)) {
    throw new Error("Invalid game turn response: missing required fields");
  }

  // Allow empty actions array ONLY when isGameEnd is true
  if (!data.isGameEnd && data.actions.length !== 3) {
    throw new Error("Invalid game turn response: expected 3 actions for normal dilemma");
  }

  // Game end must have empty actions
  if (data.isGameEnd && data.actions.length !== 0) {
    throw new Error("Invalid game turn response: game end must have empty actions array");
  }

  // Extract dilemma
  const dilemma: Dilemma = {
    title: data.title,
    description: data.description,
    actions: data.actions,
    isGameEnd: data.isGameEnd
  };

  // Extract support effects (Day 2+ only)
  let supportEffects: SupportEffect[] | null = null;

  if (data.supportShift && day > 1) {
    const { people, mom, holders } = data.supportShift;

    const newPeople = Math.max(0, Math.min(100, supportPeople + people.delta));
    const newMom = Math.max(0, Math.min(100, supportMom + mom.delta));
    const newMiddle = Math.max(0, Math.min(100, supportMiddle + holders.delta));

    setSupportPeople(newPeople);
    setSupportMom(newMom);
    setSupportMiddle(newMiddle);

    // CRITICAL: Update minimum values for continuous goal tracking
    const { updateMinimumValues, evaluateGoals } = useDilemmaStore.getState();
    updateMinimumValues();
    console.log('[fetchGameTurn] ✅ Minimum values updated after support shifts');

    // Re-evaluate goals
    const goalChanges = evaluateGoals();
    console.log('[fetchGameTurn] ✅ Goals re-evaluated after support shifts');

    // Play achievement sound if any goal status changed
    if (goalChanges.length > 0) {
      console.log('[fetchGameTurn] 🎵 Goal status changed, playing achievement sound:', goalChanges);
      audioManager.playSfx('achievement');

      goalChanges.forEach(change => {
        window.dispatchEvent(new CustomEvent('goal-status-changed', {
          detail: change
        }));
      });
    }

    // Store support effects for UI
    supportEffects = [
      { id: "people", delta: people.delta, explain: people.why },
      { id: "mom", delta: mom.delta, explain: mom.why },
      { id: "middle", delta: holders.delta, explain: holders.why }
    ];
  }

  // Update subject streak
  if (data.topic) {
    updateSubjectStreak(data.topic);
  }

  // Extract compass pills (Day 2+ only)
  const compassPills: CompassPill[] = Array.isArray(data.compassHints)
    ? data.compassHints
        .map((hint: any) => {
          const prop = hint.prop;
          const idx = Number(hint.idx);
          const polarity = String(hint.polarity || "").toLowerCase();
          const strength = String(hint.strength || "").toLowerCase();

          if (!["what", "whence", "how", "whither"].includes(prop)) return null;
          if (!Number.isFinite(idx) || idx < 0 || idx > 9) return null;

          let delta = 0;
          if (polarity === "positive") {
            delta = strength === "strong" ? 2 : 1;
          } else if (polarity === "negative") {
            delta = strength === "strong" ? -2 : -1;
          }

          if (delta === 0) return null;

          return { prop: prop as any, idx, delta };
        })
        .filter(Boolean) as CompassPill[]
    : [];

  // Extract dynamic parameters (Day 2+ only)
  const dynamicParams: DynamicParam[] = Array.isArray(data.dynamicParams)
    ? data.dynamicParams
    : [];

  // Extract mirror advice
  const mirrorText = String(data.mirrorAdvice || "The mirror squints, light pooling in the glass...");

  console.log(`[fetchGameTurn] ✅ Unified response received: ${data.actions.length} actions, ${compassPills.length} pills, ${dynamicParams.length} params`);

  return {
    dilemma,
    supportEffects,
    compassPills,
    dynamicParams,
    mirrorText
  };
}

// Helper: Get top 2 "what" compass values for Day 1 personalization
function getTop2WhatValues(): string[] {
  const compassValues = useCompassStore.getState().values;
  const whatValues = compassValues?.what || [];

  return whatValues
    .map((v, i) => ({
      v: Number(v) || 0,
      i,
      name: COMPONENTS.what?.[i]?.short || `What #${i + 1}`
    }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 2)
    .map(x => x.name);
}

// ============================================================================
// DEPRECATED - These functions are replaced by fetchGameTurn()
// Kept for reference only
// ============================================================================

/**
 * @deprecated Use fetchGameTurn() instead
 *
 * OLD FUNCTIONS BELOW - COMMENTED OUT
 * These functions are replaced by the unified fetchGameTurn() API call
 * Keeping for reference only
 */

/*
// Analyze compass changes from previous action (Day 2+ only)
async function fetchCompassPills(lastChoice: DilemmaAction): Promise<CompassPill[]> {
  const text = `${lastChoice.title}. ${lastChoice.summary}`;

  try {
    const response = await fetch("/api/compass-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (!Array.isArray(data.items)) return [];

    // Convert API response to pills with delta calculation
    const pills: CompassPill[] = data.items
      .map((item: any) => {
        const prop = item.prop;
        const idx = Number(item.idx);
        const polarity = String(item.polarity || "").toLowerCase();
        const strength = String(item.strength || "").toLowerCase();

        if (!["what", "whence", "how", "whither"].includes(prop)) return null;
        if (!Number.isFinite(idx) || idx < 0 || idx > 9) return null;

        let delta = 0;
        if (polarity === "positive") {
          delta = strength === "strong" ? 2 : 1;
        } else if (polarity === "negative") {
          delta = strength === "strong" ? -2 : -1;
        }

        if (delta === 0) return null;

        return { prop: prop as any, idx, delta };
      })
      .filter(Boolean) as CompassPill[];

    return pills;
  } catch (error) {
    console.error("[Collector] Compass analysis failed:", error);
    return [];
  }
}

// Fetch dynamic parameters from previous action (Day 2+ only)
async function fetchDynamicParams(lastChoice: DilemmaAction): Promise<DynamicParam[]> {
  const { day, totalDays } = useDilemmaStore.getState();
  const { selectedRole, analysis } = useRoleStore.getState();
  const { values: compassValues } = useCompassStore.getState();

  const politicalContext = {
    role: selectedRole,
    systemName: analysis?.systemName,
    day,
    totalDays,
    compassValues
  };

  try {
    const response = await fetch("/api/dynamic-parameters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lastChoice,
        politicalContext
      })
    });

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data.parameters) ? data.parameters : [];
  } catch (error) {
    console.error("[Collector] Dynamic parameters failed:", error);
    return [];
  }
}

// Fetch mirror dialogue with dilemma context
async function fetchMirrorText(dilemma: Dilemma): Promise<string> {
  const { values: compassValues } = useCompassStore.getState();
  const { useLightDilemmaAnthropic } = useSettingsStore.getState();

  // CRITICAL: Get current "what" values and sort by strength DESCENDING
  // This ensures we ALWAYS get the top 2 strongest values at request time
  const whatArray = Array.isArray(compassValues?.what) ? compassValues.what : [];

  // Build array of [value, index, name] and sort by value descending
  const sortedWhat = whatArray
    .map((strength, idx) => ({
      strength: Number(strength) || 0,
      idx,
      name: COMPONENTS.what?.[idx]?.short || `What #${idx + 1}`
    }))
    .filter(item => item.strength > 0) // Only include non-zero values
    .sort((a, b) => b.strength - a.strength) // Sort DESCENDING by strength
    .slice(0, 2) // Take top 2
    .map(item => ({
      name: item.name,
      strength: Math.round(item.strength * 10) / 10
    }));

  // Validate we have at least 1 value
  if (sortedWhat.length < 1) {
    return "The mirror is silent—your values haven't crystallized yet...";
  }

  const payload = {
    topWhat: sortedWhat, // Already sorted, top 2 guaranteed
    dilemma: {
      title: dilemma.title,
      description: dilemma.description,
      actions: dilemma.actions.map(a => ({
        id: a.id,
        title: a.title,
        summary: a.summary
      }))
    },
    useAnthropic: useLightDilemmaAnthropic
  };

  try {
    const response = await fetch("/api/mirror-light", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return "The mirror's having a moment—try again!";
    }

    const data = await response.json();
    return data.summary || "The mirror squints… then grins mischievously.";
  } catch (error) {
    console.error("[Collector] Mirror light failed:", error);
    return "The mirror's too hyped to talk right now!";
  }
}
*/

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useEventDataCollector() {
  // Progressive state - data arrives in 3 phases
  const [phase1Data, setPhase1Data] = useState<Phase1Data | null>(null);
  const [phase2Data, setPhase2Data] = useState<Phase2Data | null>(null);
  const [phase3Data, setPhase3Data] = useState<Phase3Data | null>(null);

  const [isCollecting, setIsCollecting] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  // Progress callback - using ref to avoid re-renders
  const onReadyCallbackRef = useRef<(() => void) | null>(null);

  // Backward compatibility - reconstruct legacy CollectedData format
  const collectedData: CollectedData | null = phase1Data ? {
    ...phase1Data,
    ...(phase2Data || { compassPills: null, dynamicParams: null }),
    ...(phase3Data || { mirrorText: "The mirror squints, light pooling in the glass..." }),
    status: {
      dilemmaReady: !!phase1Data,
      mirrorReady: !!phase3Data,
      newsReady: false, // Always false (disabled)
      supportReady: !!phase1Data,
      compassReady: !!phase2Data,
      dynamicReady: !!phase2Data
    },
    errors: {}
  } : null;

  const collectData = useCallback(async () => {
    // Clear ALL state immediately
    setPhase1Data(null);
    setPhase2Data(null);
    setPhase3Data(null);
    setIsCollecting(true);
    setCollectionError(null);

    const { day } = useDilemmaStore.getState();

    try {
      // ========================================================================
      // UNIFIED API CALL - Get ALL data in one request using hosted state
      // ========================================================================
      console.log(`[Collector] Day ${day}: Fetching unified game turn data...`);

      const turnData = await fetchGameTurn();

      // Extract all data from unified response
      const { dilemma, supportEffects, compassPills, dynamicParams, mirrorText } = turnData;

      console.log(`[Collector] ✅ Unified data received for Day ${day}`);

      // Build Phase 1 data (critical path)
      const p1: Phase1Data = {
        dilemma,
        supportEffects,
        newsItems: [] // Disabled
      };

      // Set Phase 1 data immediately - triggers UI render!
      setPhase1Data(p1);

      // Update global dilemma store for narration
      useDilemmaStore.setState({ current: dilemma });

      // Mark collecting as done - UI can render!
      setIsCollecting(false);

      // Notify listeners that data is ready (for loading progress animation)
      if (onReadyCallbackRef.current) {
        onReadyCallbackRef.current();
      }

      // Set Phase 2 data (compass pills + dynamic params)
      setPhase2Data({ compassPills, dynamicParams });

      // Set Phase 3 data (mirror advice)
      setPhase3Data({ mirrorText });

      console.log(`[Collector] ✅ All 3 phases populated from unified response`)

    } catch (error: any) {
      console.error('[Collector] ❌ Collection failed:', error);
      setCollectionError(`Collection failed: ${error.message}`);
      setIsCollecting(false);
    }
  }, []);

  // Phase 1 ready check - only needs dilemma to show content!
  const phase1Ready = useCallback(() => {
    return !!phase1Data &&
           !!phase1Data.dilemma &&
           !!phase1Data.dilemma.title &&
           !!phase1Data.dilemma.description &&
           phase1Data.dilemma.actions?.length === 3;
  }, [phase1Data]);

  // Legacy check for backward compatibility (waits for all phases)
  const isFullyReady = useCallback(() => {
    if (!phase1Data) return false;
    // Phase 2/3 are optional - don't block on them
    return true;
  }, [phase1Data]);

  // Register callback for ready notification
  const registerOnReady = useCallback((callback: () => void) => {
    onReadyCallbackRef.current = callback;
  }, []);

  /**
   * Restore collected data from snapshot (for navigation preservation)
   * Bypasses collection and directly sets all phase data
   */
  const restoreCollectedData = useCallback((data: CollectedData) => {
    console.log('[Collector] 📸 Restoring from snapshot:', data);

    // Reconstruct phase data from legacy format
    setPhase1Data({
      dilemma: data.dilemma,
      supportEffects: data.supportEffects,
      newsItems: data.newsItems || []
    });

    setPhase2Data({
      compassPills: data.compassPills,
      dynamicParams: data.dynamicParams
    });

    setPhase3Data({
      mirrorText: data.mirrorText
    });

    setIsCollecting(false);
    setCollectionError(null);

    // ✅ DON'T update dilemma store - it's already there from before navigation!
    // Updating it would trigger narration re-preparation in useEventNarration
    // useDilemmaStore.setState({ current: data.dilemma });

    // Notify ready callback immediately
    if (onReadyCallbackRef.current) {
      onReadyCallbackRef.current();
    }
  }, []);

  return {
    // New progressive API
    phase1Data,
    phase2Data,
    phase3Data,
    phase1Ready: phase1Ready(),

    // Legacy API (backward compatibility)
    collectedData,
    isCollecting,
    collectionError,
    collectData,
    isReady: isFullyReady(),

    // Progress callback API
    registerOnReady,

    // Snapshot restoration API
    restoreCollectedData
  };
}
