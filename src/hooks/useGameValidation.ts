import { useState, useCallback } from 'react';

/**
 * Game validation hook for V3 prompt tracking
 *
 * Tracks usage counts for:
 * - Values (max 2 per value per game)
 * - Axes (max 3 per axis per game)
 * - Tension clusters (max 2 per cluster per game)
 *
 * Returns reprompt instructions when limits are violated
 */

interface GameTracking {
  valueCounts: Record<string, number>;
  axisCounts: Record<string, number>;
  clusterCounts: Record<string, number>;
}

interface GameTurnResponse {
  valueTargeted?: string;
  axisExplored?: string;
  dilemma?: {
    tensionCluster?: string;
  };
}

export function useGameValidation() {
  const [tracking, setTracking] = useState<GameTracking>({
    valueCounts: {},
    axisCounts: {},
    clusterCounts: {}
  });

  /**
   * Update tracking counts with new response data
   */
  const updateTracking = useCallback((response: GameTurnResponse) => {
    setTracking(prev => {
      const updated = { ...prev };

      // Update value counts
      if (response.valueTargeted && response.valueTargeted !== 'Unknown' && response.valueTargeted !== 'N/A') {
        updated.valueCounts = {
          ...prev.valueCounts,
          [response.valueTargeted]: (prev.valueCounts[response.valueTargeted] || 0) + 1
        };
      }

      // Update axis counts
      if (response.axisExplored && response.axisExplored !== 'Unknown' && response.axisExplored !== 'N/A') {
        updated.axisCounts = {
          ...prev.axisCounts,
          [response.axisExplored]: (prev.axisCounts[response.axisExplored] || 0) + 1
        };
      }

      // Update cluster counts
      const cluster = response.dilemma?.tensionCluster;
      if (cluster && cluster !== 'N/A') {
        updated.clusterCounts = {
          ...prev.clusterCounts,
          [cluster]: (prev.clusterCounts[cluster] || 0) + 1
        };
      }

      return updated;
    });
  }, []);

  /**
   * Validate response against limits and return reprompt instruction if needed
   *
   * Validation rules:
   * - Value: max 2 uses per value
   * - Axis: max 3 uses per axis
   * - Cluster: max 2 uses per cluster
   *
   * @returns Reprompt instruction string if limit violated, null if valid
   */
  const validateAndGetReprompt = useCallback((response: GameTurnResponse): string | null => {
    // Check value limit (max 2)
    if (response.valueTargeted && response.valueTargeted !== 'Unknown' && response.valueTargeted !== 'N/A') {
      if (tracking.valueCounts[response.valueTargeted] >= 2) {
        const avoidValues = Object.keys(tracking.valueCounts)
          .filter(v => tracking.valueCounts[v] >= 2);
        return `Please choose a DIFFERENT value from the player's top 8 values. You have already used these values twice: ${avoidValues.join(', ')}. Choose from the remaining values.`;
      }
    }

    // Check axis limit (max 3)
    if (response.axisExplored && response.axisExplored !== 'Unknown' && response.axisExplored !== 'N/A') {
      if (tracking.axisCounts[response.axisExplored] >= 3) {
        const avoidAxes = Object.keys(tracking.axisCounts)
          .filter(a => tracking.axisCounts[a] >= 3);
        return `Please choose a DIFFERENT axis. You have already explored ${avoidAxes.join(', ')} three times. Choose from the remaining axes.`;
      }
    }

    // Check cluster limit (max 2)
    const cluster = response.dilemma?.tensionCluster;
    if (cluster && cluster !== 'N/A') {
      if (tracking.clusterCounts[cluster] >= 2) {
        const avoidClusters = Object.keys(tracking.clusterCounts)
          .filter(c => tracking.clusterCounts[c] >= 2);
        return `Please choose a DIFFERENT tension cluster. You have already used these clusters twice: ${avoidClusters.join(', ')}. Choose from the remaining clusters.`;
      }
    }

    return null; // Valid
  }, [tracking]);

  /**
   * Reset all tracking (for new game)
   */
  const resetTracking = useCallback(() => {
    setTracking({
      valueCounts: {},
      axisCounts: {},
      clusterCounts: {}
    });
  }, []);

  /**
   * Get current tracking state (for debugging)
   */
  const getTrackingState = useCallback(() => {
    return { ...tracking };
  }, [tracking]);

  return {
    tracking,
    updateTracking,
    validateAndGetReprompt,
    resetTracking,
    getTrackingState
  };
}
