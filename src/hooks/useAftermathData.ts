// src/hooks/useAftermathData.ts
// Hook for fetching aftermath data from the API with automatic retry on fallback
//
// Connects to:
// - server/index.mjs: POST /api/aftermath
// - src/screens/AftermathScreen.tsx: uses this hook to load data
// - src/store/*: extracts game state from roleStore, dilemmaStore, compassStore
// - src/lib/aftermath.ts: uses AftermathRequest/AftermathResponse types

import { useState, useCallback } from "react";
import { useRoleStore } from "../store/roleStore";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useCompassStore } from "../store/compassStore";
import { useSettingsStore } from "../store/settingsStore";
import { COMPONENTS, type PropKey } from "../data/compass-data";
import type { AftermathRequest, AftermathResponse, TopCompassValue } from "../lib/aftermath";
import { calculateOverallRatings } from "../lib/aftermath";
import { useLanguage } from "../i18n/LanguageContext";
import { getPrefetchedAftermathData, clearAftermathPrefetch } from "./useAftermathPrefetch";

// Retry configuration - ENHANCED for critical data reliability
const MAX_RETRIES = 5; // Up from 3 - aftermath is critical
const INITIAL_RETRY_DELAY_MS = 2000; // Start at 2s

/**
 * Calculate exponential backoff delay
 * Returns: 2s, 4s, 8s, 16s for attempts 2-5
 */
function getRetryDelay(attempt: number): number {
  // Exponential backoff: 2s, 4s, 8s, 16s
  return INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 2);
}

/**
 * Extract top 2 compass values per dimension
 * Returns array of TopCompassValue (8 total: 2 per dimension)
 */
function extractTopCompassValues(): TopCompassValue[] {
  const { values } = useCompassStore.getState();
  const result: TopCompassValue[] = [];

  for (const dimension of ["what", "whence", "how", "whither"] as PropKey[]) {
    const dimensionValues = values[dimension] || [];
    const components = COMPONENTS[dimension];

    // Create array of {index, value, name} for this dimension
    const indexed = dimensionValues
      .map((value, index) => ({
        index,
        value,
        componentName: components[index]?.short || `${dimension}${index}`
      }))
      .filter(item => item.value > 0); // Only include non-zero values

    // Sort by value descending, take top 2
    const top2 = indexed
      .sort((a, b) => b.value - a.value)
      .slice(0, 2);

    // Add to result array
    top2.forEach(item => {
      result.push({
        dimension,
        componentName: item.componentName,
        value: item.value
      });
    });
  }

  return result;
}

/** Progress callback type for retry attempts */
export type RetryProgressCallback = (attempt: number, maxAttempts: number) => void;

/**
 * Build aftermath request from current game state
 */
function buildAftermathRequest(language: string): AftermathRequest {
  const { character, selectedRole, analysis, roleTitle, roleDescription } = useRoleStore.getState();
  const { gameId, dilemmaHistory, supportPeople, supportMiddle, supportMom, aiModelOverride } = useDilemmaStore.getState();
  const { debugMode } = useSettingsStore.getState();

  return {
    gameId: gameId || undefined,
    playerName: character?.name || "Leader",
    role: roleDescription || selectedRole || "Unknown Role",
    setting: roleTitle || selectedRole || "Unknown Setting",
    systemName: analysis?.systemName || "Unknown System",
    dilemmaHistory: dilemmaHistory || [],
    finalSupport: {
      people: supportPeople,
      middle: supportMiddle,
      mom: supportMom
    },
    topCompassValues: extractTopCompassValues(),
    debug: debugMode,
    model: aiModelOverride,
    language
  };
}

/**
 * Process API result into AftermathResponse with calculated ratings
 */
function processApiResult(apiResult: any): AftermathResponse {
  const calculatedRatings = calculateOverallRatings(apiResult.decisions || []);

  // Store globally for console access
  (window as any).__democracyRating = calculatedRatings.democracy;
  (window as any).__allRatings = calculatedRatings;

  return {
    ...apiResult,
    isFallback: apiResult.isFallback || false,
    ratings: {
      democracy: calculatedRatings.democracy,
      autonomy: calculatedRatings.autonomy,
      liberalism: calculatedRatings.liberalism
    }
  };
}

/**
 * Hook for loading aftermath data with automatic retry on fallback
 * Collects all game state and calls /api/aftermath
 */
export function useAftermathData() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AftermathResponse | null>(null);

  const fetchAftermathData = useCallback(async (onRetryProgress?: RetryProgressCallback) => {
    setLoading(true);
    setError(null);

    const { debugMode } = useSettingsStore.getState();

    // Check for prefetched data first
    // Check for prefetched data first
    const prefetched = getPrefetchedAftermathData();
    const currentGameId = useDilemmaStore.getState().gameId;

    if (prefetched) {
      // VALIDATE: Only use prefetched data if it matches the current game ID
      // This prevents stale data from appearing after skipping Screens with debug tools
      if (prefetched._validationGameId && prefetched._validationGameId !== currentGameId) {
        console.warn(`[useAftermathData] ⚠️ Stale prefetch detected! (Prefetch: ${prefetched._validationGameId}, Current: ${currentGameId}). Discarding.`);
        clearAftermathPrefetch();
      } else {
        console.log('[useAftermathData] Using prefetched data', prefetched.isFallback ? '(fallback)' : '(success)');
        clearAftermathPrefetch();

        const result = processApiResult(prefetched);
        setData(result);
        setLoading(false);
        return;
      }
    }

    // Build request
    const request = buildAftermathRequest(language);

    if (debugMode) {
      console.log("[useAftermathData] Request:", request);
    }

    let lastError: string | null = null;

    // Retry loop
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Notify progress callback (for attempts 2+)
        if (attempt > 1 && onRetryProgress) {
          onRetryProgress(attempt, MAX_RETRIES);
        }

        console.log(`[useAftermathData] Attempt ${attempt}/${MAX_RETRIES}...`);

        // Call API
        const response = await fetch("/api/aftermath", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request)
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const apiResult = await response.json();

        // Check if this is fallback data - retry if not the last attempt
        if (apiResult.isFallback && attempt < MAX_RETRIES) {
          const delay = getRetryDelay(attempt);
          console.log(`[useAftermathData] Attempt ${attempt}/${MAX_RETRIES}: Received fallback, retrying in ${delay}ms...`);
          lastError = "Received fallback response";
          await new Promise(r => setTimeout(r, delay)); // Use exponential backoff
          continue;
        }

        // Success (or final attempt with fallback)
        const result = processApiResult(apiResult);

        if (debugMode) {
          console.log("[useAftermathData] API Response:", apiResult);
          console.log("[useAftermathData] Calculated Ratings:", result.ratings);
          console.log("[useAftermathData] Is Fallback:", result.isFallback);
        }

        if (result.isFallback) {
          console.log(`[useAftermathData] Final result is fallback after ${attempt} attempts`);
        }

        setData(result);
        setLoading(false);
        return;

      } catch (err: any) {
        lastError = err?.message || "Failed to load aftermath data";
        console.error(`[useAftermathData] Attempt ${attempt}/${MAX_RETRIES} failed:`, lastError);

        if (attempt < MAX_RETRIES) {
          const delay = getRetryDelay(attempt);
          console.log(`[useAftermathData] Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay)); // Use exponential backoff
        }
      }
    }

    // All retries exhausted
    console.error("[useAftermathData] All retries exhausted:", lastError);
    setError(lastError);
    setLoading(false);
  }, [language]);

  // Method to restore data from snapshot (bypasses API call)
  const restoreData = useCallback((restoredData: AftermathResponse) => {
    console.log('[useAftermathData] 🔄 Restoring data from snapshot');
    setData(restoredData);
    setLoading(false);
    setError(null);
  }, []);

  return {
    loading,
    error,
    data,
    fetchAftermathData,
    restoreData
  };
}
