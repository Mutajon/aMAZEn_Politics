// src/hooks/useAftermathData.ts
// Hook for fetching aftermath data from the API
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

/**
 * Hook for loading aftermath data
 * Collects all game state and calls /api/aftermath
 */
export function useAftermathData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AftermathResponse | null>(null);

  const fetchAftermathData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Collect data from stores
      const { character } = useRoleStore.getState();
      const { selectedRole, analysis } = useRoleStore.getState();
      const {
        dilemmaHistory,
        supportPeople,
        supportMiddle,
        supportMom
      } = useDilemmaStore.getState();
      const { debugMode } = useSettingsStore.getState();

      // Extract player name (fallback to "Leader" if not set)
      const playerName = character?.name || "Leader";

      // Extract role and system (fallback to generic values)
      const role = selectedRole || "Unknown Role";
      const systemName = analysis?.systemName || "Unknown System";

      // Extract top compass values (top 2 per dimension)
      const topCompassValues = extractTopCompassValues();

      // Build request
      const request: AftermathRequest = {
        playerName,
        role,
        systemName,
        dilemmaHistory: dilemmaHistory || [],
        finalSupport: {
          people: supportPeople,
          middle: supportMiddle,
          mom: supportMom
        },
        topCompassValues,
        debug: debugMode
      };

      if (debugMode) {
        console.log("[useAftermathData] Request:", request);
      }

      // Call API
      const response = await fetch("/api/aftermath", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const result: AftermathResponse = await response.json();

      if (debugMode) {
        console.log("[useAftermathData] Response:", result);
      }

      setData(result);
      setLoading(false);

    } catch (err: any) {
      const message = err?.message || "Failed to load aftermath data";
      console.error("[useAftermathData] Error:", message);
      setError(message);
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    data,
    fetchAftermathData
  };
}
