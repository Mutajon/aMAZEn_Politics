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
import { useDilemmaStore, buildSnapshot, buildLightSnapshot } from "../store/dilemmaStore";
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
 * Fetch dilemma from API (uses light or heavy API based on settings)
 * REQUIRED - throws error if fails (no fallback)
 */
async function fetchDilemma(): Promise<Dilemma> {
  const { useLightDilemma } = useSettingsStore.getState();
  const { day, supportPeople, supportMiddle, supportMom, setSupportPeople, setSupportMiddle, setSupportMom, updateSubjectStreak } = useDilemmaStore.getState();

  if (useLightDilemma) {
    // ===== LIGHT API =====
    const snapshot = buildLightSnapshot();

    const response = await fetch("/api/dilemma-light", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot)
    });

    if (!response.ok) {
      throw new Error(`Light Dilemma API failed: ${response.status}`);
    }

    const data: LightDilemmaResponse = await response.json();

    // Validate required fields
    if (!data.title || !data.description || !Array.isArray(data.actions)) {
      throw new Error("Invalid dilemma response: missing required fields");
    }

    // Allow empty actions array ONLY when isGameEnd is true
    if (!data.isGameEnd && data.actions.length !== 3) {
      throw new Error("Invalid dilemma response: expected 3 actions for normal dilemma");
    }

    // Game end must have empty actions
    if (data.isGameEnd && data.actions.length !== 0) {
      throw new Error("Invalid dilemma response: game end must have empty actions array");
    }

    // Apply support shifts if they exist (Day 2+)
    if (data.supportShift && day > 1) {
      const { people, mom, holders } = data.supportShift;

      const newPeople = Math.max(0, Math.min(100, supportPeople + people.delta));
      const newMom = Math.max(0, Math.min(100, supportMom + mom.delta));
      const newMiddle = Math.max(0, Math.min(100, supportMiddle + holders.delta));

      setSupportPeople(newPeople);
      setSupportMom(newMom);
      setSupportMiddle(newMiddle);

      // CRITICAL: Update minimum values for continuous goal tracking
      // This must happen after support shifts to capture new lows
      const { updateMinimumValues, evaluateGoals } = useDilemmaStore.getState();
      updateMinimumValues();
      console.log('[fetchDilemma] ✅ Minimum values updated after support shifts');

      // Re-evaluate goals to check if any just failed/completed
      const goalChanges = evaluateGoals();
      console.log('[fetchDilemma] ✅ Goals re-evaluated after support shifts');

      // Play achievement sound if any goal status changed
      if (goalChanges.length > 0) {
        console.log('[fetchDilemma] 🎵 Goal status changed, playing achievement sound:', goalChanges);
        audioManager.playSfx('achievement');

        // TODO: Trigger visual feedback (flash goal pills) - handled in GoalsCompact
        // We'll emit the changes through a custom event
        goalChanges.forEach(change => {
          window.dispatchEvent(new CustomEvent('goal-status-changed', {
            detail: change
          }));
        });
      }

      // Store support effects in the dilemma object for the collector
      (data as any).supportEffects = [
        { id: "people", delta: people.delta, explain: people.why },
        { id: "mom", delta: mom.delta, explain: mom.why },
        { id: "middle", delta: holders.delta, explain: holders.why }
      ];
    }

    // Update subject streak
    if (data.topic) {
      updateSubjectStreak(data.topic);
    }

    return data;

  } else {
    // ===== HEAVY API =====
    const snapshot = buildSnapshot();

    const response = await fetch("/api/dilemma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot)
    });

    if (!response.ok) {
      throw new Error(`Dilemma API failed: ${response.status}`);
    }

    const data = await response.json();

    // Validate required fields
    if (!data.title || !data.description || !Array.isArray(data.actions)) {
      throw new Error("Invalid dilemma response: missing required fields");
    }

    // Allow empty actions array ONLY when isGameEnd is true
    if (!data.isGameEnd && data.actions.length !== 3) {
      throw new Error("Invalid dilemma response: expected 3 actions for normal dilemma");
    }

    // Game end must have empty actions
    if (data.isGameEnd && data.actions.length !== 0) {
      throw new Error("Invalid dilemma response: game end must have empty actions array");
    }

    // Return the full response to preserve supportEffects for Day 2+
    return data;
  }
}

/**
 * Analyze support changes from previous action (Day 2+ only)
 * Fallback: [] (empty array)
 */
async function fetchSupportAnalysis(lastChoice: DilemmaAction): Promise<SupportEffect[]> {
  const { day, totalDays } = useDilemmaStore.getState();
  const { selectedRole, analysis } = useRoleStore.getState();
  const { values: compassValues } = useCompassStore.getState();

  const text = `${lastChoice.title}. ${lastChoice.summary}`;

  const politicalContext = {
    role: selectedRole,
    systemName: analysis?.systemName,
    day,
    totalDays,
    compassValues
  };

  try {
    const response = await fetch("/api/support-analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, politicalContext })
    });

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (error) {
    console.error("[Collector] Support analysis failed:", error);
    return [];
  }
}

/**
 * Analyze compass changes from previous action (Day 2+ only)
 * Fallback: [] (empty array)
 */
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

/**
 * Fetch dynamic parameters from previous action (Day 2+ only)
 * Fallback: [] (empty array)
 */
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

/**
 * Fetch news ticker items
 * Day 1: last=null (onboarding mode)
 * Day 2+: last=lastChoice (reaction mode)
 * Fallback: [] (empty array)
 */
async function fetchNews(): Promise<TickerItem[]> {
  const { day, lastChoice } = useDilemmaStore.getState();
  const { selectedRole, analysis } = useRoleStore.getState();

  const payload = {
    day,
    role: selectedRole,
    systemName: analysis?.systemName,
    last: day === 1 ? null : lastChoice  // KEY: Day 1 vs Day 2+ logic
  };

  try {
    const response = await fetch("/api/news-ticker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch (error) {
    console.error("[Collector] News ticker failed:", error);
    return [];
  }
}

/**
 * Fetch mirror dialogue with dilemma context
 * USES MIRROR LIGHT API: Top 2 "what" values + dilemma only
 * CRITICAL: Always sorts current "what" values by strength descending before taking top 2
 * Returns: 2-3 sentence dramatic sidekick advice (Mushu/Genie personality)
 * Fallback: "The mirror squints… then grins mischievously."
 */
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

  // Validate we have at least 2 values
  if (sortedWhat.length < 2) {
    return "The mirror blinks—your values are still forming...";
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

    const { day, lastChoice } = useDilemmaStore.getState();

    try {
      // ========================================================================
      // PHASE 1: Critical Path - Dilemma ONLY
      // ========================================================================
      const dilemmaResponse = await fetchDilemma();

      // Extract dilemma data
      const dilemma: Dilemma = {
        title: dilemmaResponse.title,
        description: dilemmaResponse.description,
        actions: dilemmaResponse.actions
      };

      // Verify dilemma completeness (context-aware for game conclusion)
      const isGameEnd = dilemmaResponse.isGameEnd || false;

      if (!dilemma.title || !dilemma.description) {
        console.error('[Collector] ❌ Invalid dilemma data: missing title or description');
        setCollectionError("Invalid dilemma data received");
        setIsCollecting(false);
        return;
      }

      // Normal dilemma must have 3 actions
      if (!isGameEnd && dilemma.actions?.length !== 3) {
        console.error('[Collector] ❌ Invalid dilemma data: expected 3 actions for normal dilemma');
        setCollectionError("Invalid dilemma data received");
        setIsCollecting(false);
        return;
      }

      // Game conclusion must have 0 actions
      if (isGameEnd && dilemma.actions?.length !== 0) {
        console.error('[Collector] ❌ Invalid dilemma data: game conclusion must have empty actions');
        setCollectionError("Invalid dilemma data received");
        setIsCollecting(false);
        return;
      }

      // Extract supportEffects from dilemma response (Day 2+ only)
      const supportEffects: SupportEffect[] | null =
        (day > 1 && dilemmaResponse.supportEffects)
          ? dilemmaResponse.supportEffects
          : null;

      // Build Phase 1 data
      const p1: Phase1Data = {
        dilemma,
        supportEffects,
        newsItems: [] // Disabled
      };

      // CRITICAL: Set Phase 1 data immediately - triggers UI render!
      setPhase1Data(p1);

      // Update global dilemma store for narration
      useDilemmaStore.setState({ current: dilemma });

      // CRITICAL: Mark collecting as done NOW - UI can render!
      setIsCollecting(false);

      // Notify listeners that data is ready (for loading progress animation)
      if (onReadyCallbackRef.current) {
        onReadyCallbackRef.current();
      }

      // ========================================================================
      // PHASE 2: Secondary Data - Compass + Dynamic Params (Day 2+ only)
      // NON-BLOCKING: Runs in background after Phase 1 shows
      // ========================================================================
      if (day > 1 && lastChoice) {
        Promise.allSettled([
          fetchCompassPills(lastChoice),
          fetchDynamicParams(lastChoice)
        ])
          .then(([compassResult, dynamicResult]) => {
            const compassPills: CompassPill[] | null =
              compassResult.status === "fulfilled" ? compassResult.value : null;
            const dynamicParams: DynamicParam[] | null =
              dynamicResult.status === "fulfilled" ? dynamicResult.value : null;

            console.log(`[Collector] 💊 Phase 2: ${compassPills?.length || 0} compass pills, ${dynamicParams?.length || 0} params`);

            // Set Phase 2 data - triggers PlayerStatusStrip update
            setPhase2Data({ compassPills, dynamicParams });
          })
          .catch(error => {
            console.warn('[Collector] ⚠️ Phase 2 failed:', error);
          });
      }

      // ========================================================================
      // PHASE 3: Tertiary Data - Mirror Dialogue
      // NON-BLOCKING: Runs in background after Phase 1 shows
      // ========================================================================
      fetchMirrorText(dilemma)
        .then(mirrorText => {
          // Set Phase 3 data - triggers MirrorCard text replacement
          setPhase3Data({ mirrorText });
        })
        .catch(error => {
          console.warn('[Collector] ⚠️ Phase 3 (mirror) failed:', error);
        });

      // Function returns immediately after Phase 1 completes
      // Phase 2/3 continue running in background

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
