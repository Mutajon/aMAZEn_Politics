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
import { useDilemmaStore } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";
import { useCompassStore } from "../store/compassStore";
import { useSettingsStore } from "../store/settingsStore";
import { COMPONENTS, type PropKey } from "../data/compass-data";
import type { Dilemma } from "../lib/dilemma";
import type { TickerItem } from "../components/event/NewsTicker";
import { audioManager } from "../lib/audioManager";
import { calculateLiveScoreBreakdown } from "../lib/scoring";

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
  icon: string; // Emoji character (e.g., "🎨", "🔥", "💀")
  text: string; // Narrative text (e.g., "+1,723 artworks preserved")
  tone: "up" | "down" | "neutral";
};

export type CorruptionShift = {
  delta: number;       // Change from previous turn
  reason: string;      // AI's explanation
  newLevel: number;    // Updated 0-100 level
};

// PHASE 1: Critical data - must load before showing anything
export type Phase1Data = {
  dilemma: Dilemma;
  supportEffects: SupportEffect[] | null; // Included in dilemma response on Day 2+
  newsItems: TickerItem[]; // Empty array (disabled)
  corruptionShift: CorruptionShift | null; // Included in dilemma response on Day 2+
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
async function waitForNarrativeMemory(timeoutMs = 4000, pollIntervalMs = 75) {
  const deadline = Date.now() + timeoutMs;

  let memory = useDilemmaStore.getState().narrativeMemory;
  while (!memory && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    memory = useDilemmaStore.getState().narrativeMemory;
  }

  return memory;
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
  newsItems: TickerItem[];
  corruptionShift: CorruptionShift | null;
  compassPills: CompassPill[] | null;
  dynamicParams: DynamicParam[] | null;
  mirrorText: string;
}> {
  const {
    gameId,
    day,
    totalDays,
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
    let narrativeMemory = useDilemmaStore.getState().narrativeMemory;

    if (!narrativeMemory) {
      console.log("[fetchGameTurn] Narrative memory missing at Day 1 fetch. Waiting briefly...");
      narrativeMemory = await waitForNarrativeMemory();
      if (!narrativeMemory) {
        console.warn("[fetchGameTurn] Narrative memory still unavailable. Proceeding without seeded thread guidance.");
      } else {
        console.log("[fetchGameTurn] Narrative memory acquired before Day 1 generation.");
      }
    }

    payload.gameContext = {
      role: roleState.selectedRole || "Unicorn King",
      roleTitle: roleState.roleTitle || null,          // Scenario title (predefined only)
      roleIntro: roleState.roleIntro || null,          // Historical context paragraph (predefined only)
      roleYear: roleState.roleYear || null,            // Year/era (predefined only)
      systemName: roleState.analysis?.systemName || "Divine Right Monarchy",
      systemDesc: roleState.analysis?.systemDesc || "Power flows from divine mandate",
      powerHolders: roleState.analysis?.holders || [],
      challengerSeat: roleState.analysis?.challengerSeat || null,  // NEW: Primary institutional opponent
      supportProfiles: roleState.supportProfiles || roleState.analysis?.supportProfiles || null,
      roleScope: roleState.roleScope || roleState.analysis?.roleScope || null,
      storyThemes: roleState.storyThemes || roleState.analysis?.storyThemes || null,
      playerCompass: {
        what: topWhatValues.join(', '),
        whence: topKWithNames(compassValues?.whence, 'whence', 2).map(v => v.name).join(', '),
        how: topKWithNames(compassValues?.how, 'how', 2).map(v => v.name).join(', '),
        whither: topKWithNames(compassValues?.whither, 'whither', 2).map(v => v.name).join(', ')
      },
      topWhatValues,
      totalDays,
      daysLeft: totalDays - day + 1,
      thematicGuidance: dilemmasSubjectEnabled && dilemmasSubject
        ? `Focus on: ${dilemmasSubject}`
        : null,
      narrativeMemory: narrativeMemory || null  // Dynamic Story Spine: Include if available
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

  // CRISIS MODE: Use crisis state detected on PREVIOUS turn
  // (Crisis is detected AFTER support updates, so we use stored state from last turn)
  const { crisisMode: storedCrisisMode, crisisEntity, previousSupportValues } = useDilemmaStore.getState();

  if (storedCrisisMode) {
    payload.crisisMode = storedCrisisMode;

    // Build rich crisis context for AI
    const roleState = useRoleStore.getState();

    payload.crisisContext = {
      entity: crisisEntity || "Unknown",
      systemName: roleState.analysis?.systemName || "Unknown System",
      systemDesc: roleState.analysis?.systemDesc || "",
      era: roleState.analysis?.grounding?.era || "Unknown era",
      settingType: roleState.analysis?.grounding?.settingType || "unclear"
    };

    // Add entity-specific details based on crisis mode
    if (storedCrisisMode === "people") {
      // Safely find people profile (check if supportProfiles is an array)
      const peopleProfile = Array.isArray(roleState.supportProfiles)
        ? roleState.supportProfiles.find(p => p.name === "The People")
        : null;
      payload.crisisContext.entityProfile = peopleProfile?.summary || "The general population";
      payload.crisisContext.entityStances = peopleProfile?.stances || null;
      payload.crisisContext.currentSupport = supportPeople;
      payload.crisisContext.previousSupport = previousSupportValues?.people || supportPeople;
    } else if (storedCrisisMode === "challenger") {
      const challengerSeat = roleState.analysis?.challengerSeat;
      // Safely find challenger profile (check if supportProfiles is an array)
      const challengerProfile = Array.isArray(roleState.supportProfiles)
        ? roleState.supportProfiles.find(p =>
            p.name.toLowerCase().includes(challengerSeat?.name.toLowerCase() || "")
          )
        : null;
      payload.crisisContext.entityProfile = challengerProfile?.summary || "Institutional opposition";
      payload.crisisContext.entityStances = challengerProfile?.stances || null;
      payload.crisisContext.currentSupport = supportMiddle;
      payload.crisisContext.previousSupport = previousSupportValues?.middle || supportMiddle;
      payload.crisisContext.challengerName = challengerSeat?.name || "Institutional Opposition";
    } else if (storedCrisisMode === "caring") {
      // Safely find caring profile (check if supportProfiles is an array)
      const caringProfile = Array.isArray(roleState.supportProfiles)
        ? roleState.supportProfiles.find(p =>
            p.name.toLowerCase().includes("personal") || p.name.toLowerCase().includes("anchor")
          )
        : null;
      payload.crisisContext.entityProfile = caringProfile?.summary || "Personal support anchor";
      payload.crisisContext.entityStances = caringProfile?.stances || null;
      payload.crisisContext.currentSupport = supportMom;
      payload.crisisContext.previousSupport = previousSupportValues?.mom || supportMom;
    } else if (storedCrisisMode === "downfall") {
      payload.crisisContext.allSupport = {
        people: { current: supportPeople, previous: previousSupportValues?.people || supportPeople },
        middle: { current: supportMiddle, previous: previousSupportValues?.middle || supportMiddle },
        mom: { current: supportMom, previous: previousSupportValues?.mom || supportMom }
      };
    }

    // Add triggering action if available (what caused this crisis)
    if (lastChoice && day > 1) {
      payload.crisisContext.triggeringAction = {
        title: lastChoice.title,
        summary: lastChoice.summary || lastChoice.title,
        cost: lastChoice.cost
      };
    }

    console.log(`[fetchGameTurn] ⚠️ CRISIS MODE ACTIVE: ${storedCrisisMode} (${crisisEntity})`);
    console.log('[fetchGameTurn] 📋 Crisis context:', payload.crisisContext);
  }

  payload.totalDays = totalDays;
  payload.daysLeft = totalDays - day + 1;

  // Pass debug mode setting to server for verbose logging
  const debugMode = useSettingsStore.getState().debugMode;
  payload.debugMode = debugMode;

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
  if (!Array.isArray(data.actions)) {
    data.actions = [];
  }

  if (!data.isGameEnd) {
    if (data.actions.length > 3) {
      console.warn("[fetchGameTurn] ⚠️ Received more than 3 actions. Truncating to 3.");
      data.actions = data.actions.slice(0, 3);
    } else if (data.actions.length < 3) {
      console.warn("[fetchGameTurn] ⚠️ Received fewer than 3 actions. Padding with fallback choices.");
      const fallbackSource = data.actions[0] || { title: "Fallback Option", summary: "A reasonable alternative.", cost: 0, iconHint: "speech" };
      while (data.actions.length < 3) {
        const idx = data.actions.length;
        data.actions.push({
          id: ["a", "b", "c"][idx] || `opt${idx}`,
          title: `${fallbackSource.title} (${idx + 1})`,
          summary: fallbackSource.summary,
          cost: Number.isFinite(fallbackSource.cost) ? fallbackSource.cost : 0,
          iconHint: fallbackSource.iconHint || "speech"
        });
      }
    }
  } else {
    if (data.actions.length !== 0) {
      console.warn("[fetchGameTurn] ⚠️ Game-end response returned actions. Clearing array.");
      data.actions = [];
    }
  }

  // Failsafe: if the server failed to flag game end but daysLeft reached zero, enforce aftermath locally
  const daysLeft = totalDays - day + 1;
  if (!data.isGameEnd && (!Array.isArray(data.actions) || data.actions.length !== 3) && daysLeft <= 0) {
    console.warn("[fetchGameTurn] ⚠️ Server returned unexpected action count on final day — forcing aftermath mode.");
    data.isGameEnd = true;
    data.actions = [];
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

    // STEP 0: Save previous support values BEFORE updating (for crisis context)
    const { savePreviousSupport } = useDilemmaStore.getState();
    savePreviousSupport();

    // STEP 1: Calculate new values
    const newPeople = Math.max(0, Math.min(100, supportPeople + people.delta));
    const newMom = Math.max(0, Math.min(100, supportMom + mom.delta));
    const newMiddle = Math.max(0, Math.min(100, supportMiddle + holders.delta));

    // STEP 2: Apply new support values
    setSupportPeople(newPeople);
    setSupportMom(newMom);
    setSupportMiddle(newMiddle);

    console.log('[fetchGameTurn] 📊 Support values updated:', {
      people: `${supportPeople} → ${newPeople}`,
      middle: `${supportMiddle} → ${newMiddle}`,
      mom: `${supportMom} → ${newMom}`
    });

    // STEP 3: DETECT CRISIS after support updates (NEW TIMING!)
    // This fixes the one-day lag issue - crisis is detected immediately when drop occurs
    const { detectAndSetCrisis, clearCrisis } = useDilemmaStore.getState();

    // Clear previous crisis state first
    clearCrisis();

    // Detect new crisis based on updated values
    const detectedCrisis = detectAndSetCrisis();

    if (detectedCrisis) {
      console.log('[fetchGameTurn] 🚨 CRISIS DETECTED:', detectedCrisis);
    } else {
      console.log('[fetchGameTurn] ✅ No crisis - all support tracks healthy');
    }

    // STEP 4: Update minimum values for continuous goal tracking
    const { updateMinimumValues, evaluateGoals } = useDilemmaStore.getState();
    updateMinimumValues();
    console.log('[fetchGameTurn] ✅ Minimum values updated after support shifts');

    // STEP 5: Re-evaluate goals
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

  // Extract corruption shift (Day 2+ only, mirrors support pattern)
  let corruptionShift: CorruptionShift | null = null;

  if (data.corruptionShift && day > 1) {
    const { savePreviousCorruption, setCorruptionLevel, corruptionHistory } =
      useDilemmaStore.getState();

    // STEP 0: Save previous value (for animation)
    savePreviousCorruption();

    // STEP 1: Apply new corruption level
    const newLevel = Math.max(0, Math.min(100, Number(data.corruptionShift.newLevel) || 50));
    setCorruptionLevel(newLevel);

    // STEP 2: Store history entry
    useDilemmaStore.setState({
      corruptionHistory: [
        ...corruptionHistory,
        {
          day,
          score: Math.round(newLevel / 10), // Approximate reverse-calc
          reason: data.corruptionShift.reason,
          level: newLevel
        }
      ].slice(-3)  // Keep last 3
    });

    // STEP 3: Prepare for UI display
    // Recalculate delta from store values (don't trust API value)
    const previousValue = useDilemmaStore.getState().previousCorruptionValue || 0;
    const calculatedDelta = newLevel - previousValue;

    corruptionShift = {
      delta: calculatedDelta,
      reason: String(data.corruptionShift.reason || '').slice(0, 150),
      newLevel
    };

    // COMPREHENSIVE DEBUG LOGGING
    console.log('[fetchGameTurn] 🔸 Corruption shift received:');
    console.log(`   Delta: ${corruptionShift.delta >= 0 ? '+' : ''}${corruptionShift.delta.toFixed(2)}`);
    console.log(`   New Level: ${corruptionShift.newLevel.toFixed(2)}`);
    console.log(`   Reason: ${corruptionShift.reason}`);

    if (debugMode) {
      console.log(`   🐛 [DEBUG] Previous: ${useDilemmaStore.getState().previousCorruptionValue}`);
      console.log(`   🐛 [DEBUG] Current: ${useDilemmaStore.getState().corruptionLevel}`);
      console.log(`   🐛 [DEBUG] History: ${JSON.stringify(useDilemmaStore.getState().corruptionHistory)}`);
    }
  }

  // Update live score once all resource values have been applied.
  {
    const {
      supportPeople: latestPeople,
      supportMiddle: latestMiddle,
      supportMom: latestMom,
      corruptionLevel: latestCorruption,
      setScore,
    } = useDilemmaStore.getState();

    const breakdown = calculateLiveScoreBreakdown({
      supportPeople: latestPeople,
      supportMiddle: latestMiddle,
      supportMom: latestMom,
      corruptionLevel: latestCorruption,
    });

    setScore(breakdown.final);
  }

  // Update subject streak
  if (data.topic) {
    updateSubjectStreak(data.topic);
  }

  // Compass pills fetched asynchronously elsewhere
  const compassPills: CompassPill[] | null = null;

// Extract dynamic parameters (Day 2+ only)
  const dynamicParams: DynamicParam[] = Array.isArray(data.dynamicParams)
    ? data.dynamicParams
    : [];

  // Extract mirror advice
  const mirrorText = String(data.mirrorAdvice || "The mirror squints, light pooling in the glass...");

  console.log(`[fetchGameTurn] ✅ Unified response received: ${data.actions.length} actions, 0 pills (pills fetched separately), ${dynamicParams.length} params`);

  return {
    dilemma,
    supportEffects,
    newsItems: [], // Empty array (disabled)
    corruptionShift,
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

function transformCompassHints(rawHints: any): CompassPill[] {
  if (!Array.isArray(rawHints)) return [];
  const validProps = new Set<CompassPill['prop']>(["what", "whence", "how", "whither"]);
  const pills: CompassPill[] = [];

  for (const hint of rawHints) {
    const prop = String(hint?.prop || "").toLowerCase() as CompassPill['prop'];
    if (!validProps.has(prop)) continue;

    const idx = Number(hint?.idx);
    if (!Number.isFinite(idx) || idx < 0 || idx > 9) continue;

    // Accept numerical polarity directly from API
    const polarity = Number(hint?.polarity);
    if (![-2, -1, 1, 2].includes(polarity)) continue;

    pills.push({ prop, idx, delta: polarity });
  }

  return pills;
}

async function fetchCompassHintsForAction(
  gameId: string,
  action: { title: string; summary: string }
): Promise<CompassPill[]> {
  try {
    const response = await fetch("/api/compass-hints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId, action })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Compass hints API failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    return transformCompassHints(data?.compassHints);
  } catch (error) {
    console.error("[fetchGameTurn] ⚠️ Compass hints request failed:", error);
    return [];
  }
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

    const { day, lastChoice, gameId: currentGameId } = useDilemmaStore.getState();

    try {
      // ========================================================================
      // UNIFIED API CALL - Get ALL data in one request using hosted state
      // ========================================================================
      console.log(`[Collector] Day ${day}: Fetching unified game turn data...`);

      const turnData = await fetchGameTurn();

      // Extract all data from unified response
      const {
        dilemma,
        supportEffects,
        dynamicParams,
        mirrorText,
        corruptionShift,
      } = turnData;

      console.log(`[Collector] ✅ Unified data received for Day ${day}`);

      // Build Phase 1 data (critical path)
      const p1: Phase1Data = {
        dilemma,
        supportEffects,
        newsItems: [], // Disabled
        corruptionShift: corruptionShift ?? null,
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

      // Set Phase 2 data (dynamic params immediately, pills fetched separately)
      setPhase2Data({ compassPills: null, dynamicParams });

      if (day > 1 && lastChoice && currentGameId) {
        fetchCompassHintsForAction(currentGameId, {
          title: lastChoice.title,
          summary: lastChoice.summary || lastChoice.title
        })
          .then((pills) => {
            setPhase2Data(prev => ({
              compassPills: pills.length > 0 ? pills : null,
              dynamicParams: prev?.dynamicParams ?? dynamicParams
            }));
          })
          .catch((err) => {
            console.error('[Collector] ⚠️ Compass hint fetch failed:', err);
            setPhase2Data(prev => ({
              compassPills: prev?.compassPills ?? null,
              dynamicParams: prev?.dynamicParams ?? dynamicParams
            }));
          });
      }

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
      newsItems: data.newsItems || [],
      corruptionShift: data.corruptionShift || null
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
