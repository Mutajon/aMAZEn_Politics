// src/hooks/useAftermathPrefetch.ts
// Prefetch aftermath data on Day 8 to reduce load time on AftermathScreen
//
// Uses singleton pattern to ensure only one prefetch call is made,
// even if the hook is called multiple times or the button is clicked repeatedly.
//
// Connects to:
// - src/screens/EventScreen3.tsx: triggers prefetch when Day 8 modal opens
// - src/hooks/useAftermathData.ts: consumes prefetched data

import { useCallback, useRef } from "react";
import { useRoleStore } from "../store/roleStore";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useCompassStore } from "../store/compassStore";
import { useSettingsStore } from "../store/settingsStore";
import { COMPONENTS, type PropKey } from "../data/compass-data";
import type { AftermathRequest, TopCompassValue } from "../lib/aftermath";
import { useLanguage } from "../i18n/LanguageContext";

// Singleton state to prevent duplicate prefetch calls
let prefetchPromise: Promise<any> | null = null;
let prefetchResult: any = null;
let prefetchStarted = false;

/**
 * Get prefetched aftermath data (if available)
 * Call this before making a new API request
 */
export function getPrefetchedAftermathData(): any | null {
  return prefetchResult;
}

/**
 * Clear prefetched data after use
 * Call this after consuming the prefetched data
 */
export function clearAftermathPrefetch(): void {
  prefetchPromise = null;
  prefetchResult = null;
  prefetchStarted = false;
  console.log('[AftermathPrefetch] Prefetch data cleared');
}

/**
 * Extract top 2 compass values per dimension (same logic as useAftermathData)
 */
function extractTopCompassValues(): TopCompassValue[] {
  const { values } = useCompassStore.getState();
  const result: TopCompassValue[] = [];

  for (const dimension of ["what", "whence", "how", "whither"] as PropKey[]) {
    const dimensionValues = values[dimension] || [];
    const components = COMPONENTS[dimension];

    const indexed = dimensionValues
      .map((value, index) => ({
        index,
        value,
        componentName: components[index]?.short || `${dimension}${index}`
      }))
      .filter(item => item.value > 0);

    const top2 = indexed
      .sort((a, b) => b.value - a.value)
      .slice(0, 2);

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
 * Hook for prefetching aftermath data
 * Call startPrefetch() when Day 8 modal opens to begin loading in background
 */
export function useAftermathPrefetch() {
  const { language } = useLanguage();
  const localStartedRef = useRef(false);

  const startPrefetch = useCallback(async () => {
    // Prevent duplicate calls - check both singleton and local ref
    if (prefetchStarted || localStartedRef.current || prefetchPromise) {
      console.log('[AftermathPrefetch] Prefetch already in progress or completed, skipping');
      return prefetchPromise;
    }

    // Mark as started immediately to prevent race conditions
    prefetchStarted = true;
    localStartedRef.current = true;

    console.log('[AftermathPrefetch] Starting prefetch...');

    const request = buildAftermathRequest(language);

    prefetchPromise = fetch("/api/aftermath", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // Attach gameId to the result for validation in useAftermathData
        // This ensures availability even if API response doesn't include it
        prefetchResult = {
          ...data,
          _validationGameId: request.gameId
        };
        console.log('[AftermathPrefetch] Prefetch completed', data.isFallback ? '(fallback)' : '(success)', `for gameId: ${request.gameId}`);
        return data;
      })
      .catch(err => {
        console.error('[AftermathPrefetch] Prefetch failed:', err);
        // Reset state to allow retry on AftermathScreen
        prefetchPromise = null;
        prefetchResult = null;
        prefetchStarted = false;
        localStartedRef.current = false;
        return null;
      });

    return prefetchPromise;
  }, [language]);

  return { startPrefetch };
}
