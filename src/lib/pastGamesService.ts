/**
 * src/lib/pastGamesService.ts
 *
 * Helper functions for building PastGameEntry from game state
 * Used by AftermathScreen to save completed game data to localStorage
 */

import type { AftermathResponse } from "./aftermath";
import type {
  CompassHighlight,
  PastGameEntry,
  SnapshotHighlight,
} from "./types/pastGames";
import { COMPONENTS, type PropKey } from "../data/compass-data";
import { useRoleStore } from "../store/roleStore";
import { useCompassStore } from "../store/compassStore";
import { useDilemmaStore } from "../store/dilemmaStore";
import { getPredefinedRole } from "../data/predefinedRoles";

/**
 * Extract top 2-3 compass values per dimension
 * Returns array of 8-12 CompassHighlight objects (top 2-3 per dimension)
 */
export function getTopCompassValues(
  compassValues: Record<PropKey, number[]>,
  topN: number = 2
): CompassHighlight[] {
  const highlights: CompassHighlight[] = [];

  const dimensions: PropKey[] = ["what", "whence", "how", "whither"];

  dimensions.forEach((dimension) => {
    const values = compassValues[dimension];
    const components = COMPONENTS[dimension];

    // Create array of { index, value, componentName }
    const indexed = values.map((value, index) => ({
      index,
      value,
      componentName: components[index].short,
    }));

    // Sort by value descending
    indexed.sort((a, b) => b.value - a.value);

    // Take top N
    const topValues = indexed.slice(0, topN);

    // Convert to CompassHighlight
    topValues.forEach((item) => {
      highlights.push({
        dimension,
        componentName: item.componentName,
        value: item.value,
      });
    });
  });

  return highlights;
}

/**
 * Select most dramatic snapshot events from aftermath
 * Prioritizes events with estimates, then by type balance
 * Returns 3-6 highlights (balanced positive/negative if possible)
 */
export function selectSnapshotHighlights(
  snapshot: AftermathResponse["snapshot"],
  maxCount: number = 6
): SnapshotHighlight[] {
  if (!snapshot || snapshot.length === 0) {
    return [];
  }

  // Copy array to avoid mutating original
  const events = [...snapshot];

  // Sort by priority:
  // 1. Events with estimates (more impactful)
  // 2. Keep original order (AI already prioritized them)
  events.sort((a, b) => {
    const aHasEstimate = a.estimate !== undefined;
    const bHasEstimate = b.estimate !== undefined;

    if (aHasEstimate && !bHasEstimate) return -1;
    if (!aHasEstimate && bHasEstimate) return 1;
    return 0; // Maintain original order
  });

  // Take top maxCount events
  const selected = events.slice(0, Math.min(maxCount, events.length));

  // Convert to SnapshotHighlight (same structure, but explicit type)
  return selected.map((event) => ({
    type: event.type,
    icon: event.icon,
    text: event.text,
    estimate: event.estimate,
  }));
}

/**
 * Build a complete PastGameEntry from current game state and aftermath data
 * Call this from AftermathScreen after aftermath data is loaded
 */
export function buildPastGameEntry(
  aftermathData: AftermathResponse
): PastGameEntry {
  // Get data from stores
  const roleStore = useRoleStore.getState();
  const compassStore = useCompassStore.getState();
  const dilemmaStore = useDilemmaStore.getState();

  // Extract player info
  const playerName = roleStore.character?.name || "Leader";
  const avatarUrl = roleStore.character?.avatarUrl;

  // Extract role/setting info
  const selectedRole = roleStore.selectedRole;
  const roleTitle = roleStore.roleTitle || selectedRole || "Unknown";
  const roleDescription = roleStore.roleDescription || "Unknown Role";
  const systemName = roleStore.analysis?.systemName || "Unknown System";

  // Extract imageId from predefined role (if applicable)
  let roleImageId: string | undefined;
  if (selectedRole) {
    const predefinedRole = getPredefinedRole(selectedRole);
    if (predefinedRole) {
      roleImageId = predefinedRole.imageId;
    }
  }

  // Extract final results
  const finalScore = dilemmaStore.score || 0;
  const supportPeople = dilemmaStore.supportPeople;
  const supportMiddle = dilemmaStore.supportMiddle;
  const supportMom = dilemmaStore.supportMom;

  // Extract aftermath highlights
  const legacy = aftermathData.legacy;
  const snapshotHighlights = selectSnapshotHighlights(aftermathData.snapshot);

  // Extract top compass values
  const topCompassValues = getTopCompassValues(compassStore.values);

  // Extract ratings
  const ratings = aftermathData.ratings;

  // Extract self-judgment
  const selfJudgment = dilemmaStore.selfJudgment || null;

  // Build the entry
  const entry: PastGameEntry = {
    // Identifiers
    gameId: dilemmaStore.gameId || `game-${Date.now()}`,
    timestamp: Date.now(),

    // Player Info
    playerName,
    avatarUrl: roleImageId ? undefined : avatarUrl, // Only store avatar if no imageId (custom roles)

    // Role/Setting
    roleImageId, // Image reference for predefined roles (replaces 68KB avatar with ~50 bytes)
    roleTitle,
    roleDescription,
    systemName,

    // Final Results
    finalScore,
    supportPeople,
    supportMiddle,
    supportMom,

    // Aftermath Highlights
    legacy,
    snapshotHighlights,

    // Compass Top Values
    topCompassValues,

    // Self-Assessment
    selfJudgment,

    // Ratings
    ratings,
  };

  return entry;
}
