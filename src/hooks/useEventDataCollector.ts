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
import { translatePoliticalSystem } from '../i18n/translateGameData';
import { useDilemmaStore, type PhilosophicalPole } from '../store/dilemmaStore';
import { useRoleStore } from "../store/roleStore";
import { useCompassStore } from "../store/compassStore";
import { useSettingsStore } from "../store/settingsStore";
import { COMPONENTS, type PropKey } from "../data/compass-data";
import type { Dilemma } from "../lib/dilemma";
import type { TickerItem } from "../components/event/NewsTicker";
import { audioManager } from "../lib/audioManager";
import { calculateLiveScoreBreakdown } from "../lib/scoring";
import { shouldGenerateAIOptions, type TreatmentType } from "../data/experimentConfig";
import { useAIOutputLogger } from "./useAIOutputLogger";
import { getConfidantByLegacyKey } from "../data/confidants";
import { useLanguage } from "../i18n/LanguageContext";
import { useLang } from "../i18n/lang";

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
  text: string; // Narrative text (e.g., "12,000 soldiers mobilized")
};

// PHASE 1: Critical data - must load before showing anything
export type Phase1Data = {
  dilemma: Dilemma;
  supportEffects: SupportEffect[] | null; // Included in dilemma response on Day 2+
  newsItems: TickerItem[]; // Empty array (disabled)
  valueTargeted?: string; // The compass value being tested by this dilemma (for trap context)
  axisExplored?: string;  // The political axis being explored
  scopeUsed?: string;     // The situation scope being used
};

// PHASE 2: Secondary data - loads in background while user reads
export type Phase2Data = {
  compassPills: CompassPill[] | null;
  dynamicParams: DynamicParam[] | null;
  axisPills?: PhilosophicalPole[];
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

import { translatePowerDistribution } from "../data/powerDistributionTranslations";

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
async function fetchGameTurn(
  lang: (key: string) => string,
  language: string = 'he'
): Promise<{
  dilemma: Dilemma;
  supportEffects: SupportEffect[] | null;
  newsItems: TickerItem[];
  compassPills: CompassPill[] | null;
  dynamicParams: DynamicParam[] | null;
  mirrorText: string;
  valueTargeted?: string;  // The compass value being tested by this dilemma
  axisExplored?: string;   // The political axis being explored
  scopeUsed?: string;      // The situation scope being used
  axisPills?: PhilosophicalPole[]; // Philosophical poles supported by action
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
  const { isFreePlay } = useSettingsStore.getState();

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
    day,
    totalDays,
    isFirstDilemma: day === 1,
    isFollowUp: day > 1
  };

  // Day 1: Send full game context
  if (day === 1) {
    const roleState = useRoleStore.getState();
    const { dilemmasSubjectEnabled, dilemmasSubject } = useSettingsStore.getState();

    // Get confidant information for predefined roles
    const confidant = roleState.selectedRole ? getConfidantByLegacyKey(roleState.selectedRole) : undefined;

    // Extract setting from roleIntro or build from role + year
    const setting = roleState.roleIntro
      ? roleState.roleIntro.split('.')[0] // First sentence of intro
      : `${roleState.selectedRole || "Unknown role"}, ${roleState.roleYear || "Unknown era"}`;

    // Translate power distribution data if available
    // We need to use the translation helper but we need a lang function.
    // Since we can't easily pass the hook's lang function here without changing signatures everywhere,
    // we'll rely on the fact that we're mostly sending technical keys to English backend?
    // NO, the backend uses these names to Generate Hebrew text. If we send "Assembly (Ekklesia)", Gemini generates Hebrew.
    // If we send "ATHENS_HOLDER_ASSEMBLY_NAME", Gemini parrots it.
    // We MUST translate here.

    // Modification: `fetchGameTurn` now expects `lang` to be passed or we need a way to get it.
    // The previous code signature was `async function fetchGameTurn(language: string = 'he'): Promise<...>`
    // I will modify the signature to `async function fetchGameTurn(lang: (key: string) => string, language: string = 'he')`

    // ... wait, I will implement this in the `replace_file_content` below by assuming I change the call site too.

    const translatedAnalysis = roleState.selectedRole && roleState.analysis
      ? translatePowerDistribution(roleState.selectedRole, roleState.analysis, lang)
      : roleState.analysis;

    payload.gameContext = {
      role: roleState.roleScope,
      roleScope: roleState.roleScope, // Added for backend authority calculation
      // Revert to English system name for backend logic stability
      systemName: roleState.analysis?.systemName || "Divine Right Monarchy",
      setting,
      // Revert to English challenger name for backend logic stability
      challengerSeat: roleState.analysis?.challengerSeat?.name || "Unknown Opposition (Institutional Power)",
      // Keep holders translated so narrative uses Hebrew names
      powerHolders: translatedAnalysis?.holders || [],
      playerIndex: translatedAnalysis?.playerIndex ?? null,
      supportProfiles: {
        people: {
          origin: supportPeople,
          stance: Array.isArray(roleState.supportProfiles) ? roleState.supportProfiles[0]?.stances || "autonomy, equality" : "autonomy, equality"
        },
        challenger: {
          origin: supportMiddle,
          stance: Array.isArray(roleState.supportProfiles) ? roleState.supportProfiles[1]?.stances || "strength, order" : "strength, order"
        },
        mother: {
          origin: supportMom,
          stance: Array.isArray(roleState.supportProfiles) ? roleState.supportProfiles[2]?.stances || "care, peace" : "care, peace"
        }
      },
      authorityLevel: "medium", // Will be calculated from e12 in backend
      playerCompassTopValues: [
        { dimension: "what", values: topKWithNames(compassValues?.what, 'what', 2).map(v => v.name) },
        { dimension: "whence", values: topKWithNames(compassValues?.whence, 'whence', 2).map(v => v.name) },
        { dimension: "how", values: topKWithNames(compassValues?.how, 'how', 2).map(v => v.name) },
        { dimension: "whither", values: topKWithNames(compassValues?.whither, 'whither', 2).map(v => v.name) }
      ],
      confidant: confidant ? { name: confidant.name, description: confidant.description, imageId: confidant.imageId } : null,
      e12: roleState.analysis?.e12 || null,
      dilemmaEmphasis: roleState.analysis?.dilemmaEmphasis ?? null
    };

    payload.dilemmasSubjectEnabled = dilemmasSubjectEnabled || false;
    payload.dilemmasSubject = dilemmasSubject || null;
    payload.gender = roleState.character?.gender || "male";
  }

  // Day 2+: Send player choice + current compass values
  if (day > 1 && lastChoice) {
    const { dilemmasSubjectEnabled, dilemmasSubject } = useSettingsStore.getState();

    payload.playerChoice = {
      title: lastChoice.title,
      description: lastChoice.summary || lastChoice.title,
      cost: lastChoice.cost,
      iconHint: lastChoice.iconHint || "speech"
    };

    // Include CURRENT top values (may have shifted due to compass pills)
    payload.currentCompassTopValues = [
      { dimension: "what", values: topKWithNames(compassValues?.what, 'what', 2).map(v => v.name) },
      { dimension: "whence", values: topKWithNames(compassValues?.whence, 'whence', 2).map(v => v.name) },
      { dimension: "how", values: topKWithNames(compassValues?.how, 'how', 2).map(v => v.name) },
      { dimension: "whither", values: topKWithNames(compassValues?.whither, 'whither', 2).map(v => v.name) }
    ];

    // Subject focus for Day 2+
    payload.dilemmasSubjectEnabled = dilemmasSubjectEnabled || false;
    payload.dilemmasSubject = dilemmasSubject || null;

    const roleState = useRoleStore.getState();
    payload.gender = roleState.character?.gender || "male";
  }

  // Pass debug mode setting to server for verbose logging
  const debugMode = useSettingsStore.getState().debugMode;
  payload.debugMode = debugMode;

  // Pass treatment-based AI option generation flag (token optimization)
  const treatment = useSettingsStore.getState().treatment as TreatmentType;
  payload.generateActions = shouldGenerateAIOptions(treatment);

  // Pass XAI provider flag
  const useXAI = useSettingsStore.getState().useXAI;
  payload.useXAI = useXAI;

  // Pass Gemini provider flag
  const useGemini = useSettingsStore.getState().useGemini;
  payload.useGemini = useGemini;

  // Pass language setting
  payload.language = language;

  // Day 1: Initialize compass conversation with game context
  if (day === 1 && payload.gameContext) {
    try {
      console.log(`[fetchGameTurn] Initializing compass conversation for gameId=${currentGameId}`);
      const compassInitResponse = await fetch("/api/compass-conversation/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: currentGameId,
          gameContext: {
            setting: payload.gameContext.setting,
            role: payload.gameContext.role,
            systemName: payload.gameContext.systemName
          },
          debugMode
        })
      });

      if (!compassInitResponse.ok) {
        console.warn(`[fetchGameTurn] Compass conversation init failed (${compassInitResponse.status}) - will fallback to non-stateful analysis`);
      } else {
        console.log(`[fetchGameTurn] ✅ Compass conversation initialized successfully`);
      }
    } catch (error) {
      console.warn(`[fetchGameTurn] Compass conversation init error:`, error);
      // Non-fatal - compass analysis will fall back to non-stateful mode
    }
  }

  console.log(`[fetchGameTurn] Calling ${isFreePlay ? '/api/free-play/turn' : '/api/game-turn-v2'} for Day ${day}, gameId=${currentGameId}, treatment=${treatment}, generateActions=${payload.generateActions}, useXAI=${useXAI}, useGemini=${useGemini}, language=${language}`);

  // Log compass values being sent for mirror advice debugging
  if (payload.gameContext?.playerCompassTopValues) {
    console.log("[fetchGameTurn] Player compass top values:", payload.gameContext.playerCompassTopValues);
  }

  // --- FREE PLAY MODE SWITCH ---
  let response;
  if (isFreePlay) {
    // For Free Play, we use a simpler payload structure at the top level for the controller
    const roleState = useRoleStore.getState();
    response = await fetch("/api/free-play/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        // Top-level fields required by freePlayTurn and freePlayIntro controllers
        role: roleState.selectedRole || roleState.analysis?.systemName,
        setting: roleState.analysis?.systemName || "Unknown Setting",
        playerName: roleState.character?.name || roleState.playerName || "Player",
        emphasis: roleState.analysis?.dilemmaEmphasis,
        gender: roleState.character?.gender || "male",
        language: language
      })
    });
  } else {
    // Standard V2 Game Turn
    response = await fetch("/api/game-turn-v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Game turn API failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Validate required fields
  if (!data.title || !data.description || !Array.isArray(data.actions)) {
    throw new Error("Invalid game turn response: missing required fields");
  }

  // Allow empty actions array when: (1) isGameEnd is true, OR (2) generateActions is false (fullAutonomy)
  if (!Array.isArray(data.actions)) {
    data.actions = [];
  }

  if (!data.isGameEnd && payload.generateActions) {
    // Only validate action count when we actually requested AI to generate them
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

  // Extract dilemma - combine bridge with description for Days 2+
  // The bridge field contains the narrative connection from previous action to new dilemma
  const dilemma: Dilemma = {
    title: data.title,
    description: data.bridge
      ? `${data.bridge} ${data.description}`
      : data.description,
    actions: data.actions,
    isGameEnd: data.isGameEnd
  };

  // Extract support effects (Day 2+ only)
  let supportEffects: SupportEffect[] | null = null;
  let momDiedThisTurn = false;

  if (data.supportShift && day > 1) {
    const { people, mom, holders, momDied } = data.supportShift;

    // Check if mom died this turn
    if (momDied === true) {
      console.log('[fetchGameTurn] 💀 MOM DIED THIS TURN');
      momDiedThisTurn = true;
      const { setMomDead } = useDilemmaStore.getState();
      setMomDead();

      // Dispatch event for toast notification
      window.dispatchEvent(new CustomEvent('mom-died', {
        detail: { shortLine: mom?.why || "Mom has passed away" }
      }));
    }

    // STEP 0: Save previous support values BEFORE updating
    const { savePreviousSupport } = useDilemmaStore.getState();
    savePreviousSupport();

    // STEP 1: Calculate new values (only for provided tracks)
    const newPeople = people ? Math.max(0, Math.min(100, supportPeople + (people.delta || 0))) : supportPeople;
    const newMiddle = holders ? Math.max(0, Math.min(100, supportMiddle + (holders.delta || 0))) : supportMiddle;
    const newMom = mom ? Math.max(0, Math.min(100, supportMom + (mom.delta || 0))) : supportMom;

    // STEP 2: Apply new support values
    setSupportPeople(newPeople);
    setSupportMiddle(newMiddle);
    setSupportMom(newMom);

    console.log('[fetchGameTurn] 📊 Support values updated:', {
      people: `${supportPeople} → ${newPeople}`,
      middle: `${supportMiddle} → ${newMiddle}`,
      mom: `${supportMom} → ${newMom}`
    });

    // STEP 3: Detect crisis
    const { detectAndSetCrisis, clearCrisis } = useDilemmaStore.getState();
    clearCrisis();
    const detectedCrisis = detectAndSetCrisis();
    if (detectedCrisis) console.log('[fetchGameTurn] 🚨 CRISIS DETECTED:', detectedCrisis);

    // STEP 4: Update minimum values
    const { updateMinimumValues, evaluateGoals } = useDilemmaStore.getState();
    updateMinimumValues();

    // STEP 5: Re-evaluate goals
    const goalChanges = evaluateGoals();
    if (goalChanges.length > 0) {
      audioManager.playSfx('achievement');
      goalChanges.forEach(change => {
        window.dispatchEvent(new CustomEvent('goal-status-changed', { detail: change }));
      });
    }

    // Store support effects for UI
    supportEffects = [];
    if (people) supportEffects.push({ id: "people", delta: people.delta, explain: people.why });
    if (holders) supportEffects.push({ id: "middle", delta: holders.delta, explain: holders.why });
    if (mom) supportEffects.push({ id: "mom", delta: mom.delta, explain: mom.why });
  }

  // Update live score once all resource values have been applied.
  {
    const {
      supportPeople: latestPeople,
      supportMiddle: latestMiddle,
      supportMom: latestMom,
      setScore,
    } = useDilemmaStore.getState();

    const breakdown = calculateLiveScoreBreakdown({
      supportPeople: latestPeople,
      supportMiddle: latestMiddle,
      supportMom: latestMom,
      isFreePlay,
    });

    setScore(breakdown.final);
  }

  // Update subject streak
  if (data.topic) {
    updateSubjectStreak(data.topic);
  }

  // Compass pills fetched asynchronously elsewhere
  const compassPills: CompassPill[] | null = null;

  // Map keywords to emojis
  const EMOJI_MAP: Record<string, string> = {
    // Military / Force
    "military": "⚔️",
    "force": "🛡️",
    "security": "👮",
    "police": "🚔",
    "war": "💣",
    "army": "🪖",
    "weapon": "🔫",

    // Political / Institutional
    "political": "🏛️",
    "assembly": "🗣️",
    "vote": "🗳️",
    "law": "⚖️",
    "pact": "🤝",
    "diplomacy": "🕊️",
    "corruption": "💰",
    "authority": "👑",
    "office": "🏛️",

    // Social / People
    "people": "👥",
    "riot": "🔥",
    "public": "📢",
    "popularity": "⭐",
    "unrest": "💢",
    "culture": "🎭",
    "tradition": "📜",

    // Economy / Resources
    "economy": "📉",
    "money": "💵",
    "trade": "🚢",
    "debt": "💳",
    "food": "🍞",
    "resource": "💎",
    "wealth": "💰",
    "market": "📈",

    // Espionage / Secrets
    "spy": "🕵️",
    "secret": "🤫",
    "intel": "👁️",
    "plot": "🕸️",
    "betrayal": "🗡️",

    // Personal / Family
    "family": "🏠",
    "home": "🏠",
    "friend": "👥",
    "personal": "👤",
    "self": "👤",

    // Compass Values & Themes
    "truth": "⚖️",
    "trust": "🤝",
    "liberty": "🕊️",
    "agency": "🔓",
    "equality": "🤝",
    "equity": "⚖️",
    "care": "❤️",
    "solidarity": "✊",
    "create": "🎨",
    "courage": "🦁",
    "wellbeing": "🌱",
    "health": "🤒",
    "safety": "🛡️",
    "honor": "🎖️",
    "sacrifice": "🕯️",
    "sacred": "✨",
    "awe": "🌟",
    "evidence": "🔍",
    "reason": "🗣️",
    "revelation": "🌟",
    "nature": "🌿",
    "pragmatism": "🛠️",
    "utility": "🛠️",
    "aesthesis": "🎭",
    "aesthetic": "🎨",
    "fidelity": "💍",
    "loyalty": "🛡️",

    // Abstract / Consequences
    "death": "💀",
    "chaos": "🌀",
    "time": "⏳",
    "impact": "💥",
    "enemy": "👺",
    "danger": "⚠️",
    "unknown": "❓"
  };

  // Extract dynamic parameters (Day 2+ only)
  // Add id field from index (AI returns {icon, text}, we add id for React keys)
  // Also map text keywords to emojis if needed
  const dynamicParams: DynamicParam[] = Array.isArray(data.dynamicParams)
    ? data.dynamicParams.map((param: any, index: number) => {
      // Normalize icon key (strip whitespace, lowercase)
      const rawIcon = String(param.icon || "").trim().toLowerCase();

      // Check if rawIcon is already an emoji (simple check: non-ascii or short)
      // If it looks like a keyword (length > 2 and ascii), try to map it
      const isKeyword = /^[a-z]+$/.test(rawIcon) && rawIcon.length > 2;

      const emoji = isKeyword && EMOJI_MAP[rawIcon]
        ? EMOJI_MAP[rawIcon]
        : (param.icon || '📰');

      // Cleaning function to strip English words from strings if they contain Hebrew
      const cleanText = (text: string): string => {
        if (!text) return 'Unknown consequence';
        // If text contains Hebrew, strip ALL English words/punctuation/labels
        if (/[\u0590-\u05FF]/.test(text)) {
          // Remove English words (sequences of letters) but keep numbers and Hebrew
          return text.replace(/[A-Za-z][A-Za-z\s\-\/\(\)]*/g, '').trim().replace(/\s+/g, ' ');
        }
        return text;
      };

      return {
        id: `param-${day}-${index}`,
        icon: emoji,
        text: cleanText(param.text)
      };
    })
    : [];

  // Extract mirror advice
  const mirrorText = String(data.mirrorAdvice || "The mirror squints, light pooling in the glass...");

  // Extract value trap context (for compass analysis)
  const valueTargeted = data.valueTargeted || undefined;
  const axisExplored = data.axisUsed || data.axisExplored || undefined;
  const scopeUsed = data.scopeUsed || undefined;

  console.log(`[fetchGameTurn] ✅ Unified response received: ${data.actions.length} actions, 0 pills (pills fetched separately), ${dynamicParams.length} params, valueTargeted=${valueTargeted || 'N/A'}, axisExplored=${axisExplored || 'N/A'}`);

  return {
    dilemma,
    supportEffects,
    newsItems: [], // Empty array (disabled)
    compassPills,
    dynamicParams,
    mirrorText,
    valueTargeted,
    axisExplored,
    scopeUsed
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

// Trap context for compass analysis - tells the analyzer which value is being tested
export type TrapContext = {
  valueTargeted: string;           // The compass value being tested (e.g., "Truth/Trust")
  dilemmaTitle: string;            // The dilemma title for context
  dilemmaDescription?: string;     // The dilemma description for context
};

export async function fetchCompassHintsForAction(
  gameId: string,
  action: { title: string; summary: string },
  trapContext?: TrapContext,       // NEW: Pass the value trap context for better analysis
  language: string = 'he'          // NEW: Language for mirror reflection
): Promise<CompassPill[]> {
  try {
    // Get game context and debug mode from stores
    const roleState = useRoleStore.getState();
    const debugMode = useSettingsStore.getState().debugMode;

    // Build context for compass analysis
    const setting = roleState.roleIntro
      ? roleState.roleIntro.split('.')[0]
      : `${roleState.selectedRole || "Unknown role"}, ${roleState.roleYear || "Unknown era"}`;

    const gameContext = {
      setting,
      role: roleState.roleScope,
      systemName: roleState.analysis?.systemName || "Divine Right Monarchy"
    };

    console.log(`[fetchCompassHintsForAction] Calling /api/compass-conversation/analyze for gameId=${gameId}, trapContext=${trapContext?.valueTargeted || 'none'}`);

    const response = await fetch("/api/compass-conversation/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        action,
        gameContext,
        debugMode,
        trapContext,  // NEW: Include trap context for value-aware analysis
        language: language // Pass language to API
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Compass hints API failed (${response.status}): ${text}`);
    }

    const data = await response.json();
    return transformCompassHints(data?.compassHints);
  } catch (error) {
    console.error("[fetchCompassHintsForAction] ⚠️ Compass hints request failed:", error);
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
// RETRY CONFIGURATION
// ============================================================================

// Retry settings for game turn API calls
const MAX_RETRY_ATTEMPTS = 8;  // As advertised in error messages
const RETRY_DELAYS_MS = [1000, 2000, 4000, 6000, 8000, 10000, 12000, 15000]; // Exponential-ish backoff

/**
 * Helper to wait for a specified duration
 */
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useEventDataCollector() {
  // Get current language from context
  const { language } = useLanguage();
  const lang = useLang();

  // Progressive state - data arrives in 3 phases
  const [phase1Data, setPhase1Data] = useState<Phase1Data | null>(null);
  const [phase2Data, setPhase2Data] = useState<Phase2Data | null>(null);
  const [phase3Data, setPhase3Data] = useState<Phase3Data | null>(null);

  const [isCollecting, setIsCollecting] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  // Progress callback - using ref to avoid re-renders
  const onReadyCallbackRef = useRef<(() => void) | null>(null);

  // Track logged dilemmas to prevent duplicates (e.g., during hot reload)
  const loggedDilemmasRef = useRef<Set<string>>(new Set());

  // AI output logger - for logging once at source
  const aiLogger = useAIOutputLogger();

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

    // ========================================================================
    // RETRY LOOP - Try up to MAX_RETRY_ATTEMPTS times with exponential backoff
    // ========================================================================
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        // ========================================================================
        // UNIFIED API CALL - Get ALL data in one request using hosted state
        // ========================================================================
        console.log(`[Collector] Day ${day}: Fetching unified game turn data (attempt ${attempt}/${MAX_RETRY_ATTEMPTS}, language: ${language})...`);

        const turnData = await fetchGameTurn(lang, language);

        // Extract all data from unified response
        const {
          dilemma,
          supportEffects,
          dynamicParams,
          mirrorText,
          axisExplored,
          scopeUsed,
          valueTargeted,
          axisPills
        } = turnData;

        console.log(`[Collector] ✅ Unified data received for Day ${day} (attempt ${attempt})`);

        // ========================================================================
        // LOG AI OUTPUTS ONCE AT SOURCE (prevents duplication from reactive effects)
        // ========================================================================
        const { crisisMode: storedCrisisMode } = useDilemmaStore.getState();

        // Log dilemma generation (with deduplication to prevent hot reload duplicates)
        const dilemmaKey = `${day}-${dilemma.title}`;
        if (!loggedDilemmasRef.current.has(dilemmaKey)) {
          loggedDilemmasRef.current.add(dilemmaKey);
          aiLogger.logDilemma(dilemma, {
            crisisMode: storedCrisisMode
          });
        }

        console.log(`[Collector] ✅ AI outputs logged for Day ${day}`);

        // Build Phase 1 data (critical path)
        const p1: Phase1Data = {
          dilemma,
          supportEffects,
          newsItems: [], // Disabled
          axisExplored,
          scopeUsed,
          valueTargeted
        };

        // Set Phase 1 data immediately - triggers UI render!
        setPhase1Data(p1);

        // Update global dilemma store for narration
        useDilemmaStore.setState({ current: dilemma });

        // Reset inquiry credits for new dilemma (treatment-based feature)
        useDilemmaStore.getState().resetInquiryCredits();

        // Apply philosophical axis pills if in Free Play mode
        if (useSettingsStore.getState().isFreePlay && axisPills) {
          useDilemmaStore.getState().applyAxisPills(axisPills);
        }

        // Mark collecting as done - UI can render!
        setIsCollecting(false);

        // Notify listeners that data is ready (for loading progress animation)
        if (onReadyCallbackRef.current) {
          onReadyCallbackRef.current();
        }

        // Set Phase 2 data (dynamic params only)
        // NOTE: Compass pills are NO LONGER fetched here!
        // They're now fetched and applied in eventDataCleaner.ts (Step 3.5)
        // IMMEDIATELY after action confirmation, BEFORE day advancement.
        // This fixes the one-day delay where compass values weren't updated until the next day.
        setPhase2Data({ compassPills: null, dynamicParams });

        // Set Phase 3 data (mirror advice)
        setPhase3Data({ mirrorText });

        console.log(`[Collector] ✅ All 3 phases populated from unified response`);

        // SUCCESS! Exit the retry loop
        return;

      } catch (error: any) {
        lastError = error;
        console.error(`[Collector] ❌ Attempt ${attempt}/${MAX_RETRY_ATTEMPTS} failed:`, error.message);

        // Check if we have more attempts remaining
        if (attempt < MAX_RETRY_ATTEMPTS) {
          // Calculate delay with exponential backoff
          const delay = RETRY_DELAYS_MS[attempt - 1] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
          console.log(`[Collector] 🔄 Retrying in ${delay / 1000}s...`);
          await wait(delay);
          // Continue to next iteration
        }
      }
    }

    // ========================================================================
    // ALL ATTEMPTS FAILED - Show error to user
    // ========================================================================
    console.error(`[Collector] ❌ All ${MAX_RETRY_ATTEMPTS} attempts failed. Last error:`, lastError?.message);
    setCollectionError(`Collection failed after ${MAX_RETRY_ATTEMPTS} attempts: ${lastError?.message || 'Unknown error'}`);
    setIsCollecting(false);
  }, [language, aiLogger]);

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
