// src/lib/eventScreenSnapshot.ts
/**
 * EventScreen snapshot system for seamless navigation to/from MirrorScreen.
 * Preserves phase, presentation step, and collected data in sessionStorage
 * so the player can return to the exact same state without re-loading.
 *
 * Also includes AftermathScreen snapshot system for similar navigation.
 *
 * Connected files:
 * - Used by: src/screens/EventScreen3.tsx (save/restore on navigation)
 * - Used by: src/screens/AftermathScreen.tsx (save/restore on navigation)
 * - Used by: src/screens/MirrorScreen.tsx (check if snapshot exists)
 */

import type { AftermathResponse } from "./aftermath";

export type EventScreenSnapshot = {
  phase: 'collecting' | 'presenting' | 'interacting' | 'cleaning';
  presentationStep: number;
  collectedData: any; // Full CollectedData object from useEventDataCollector
  timestamp: number;
};

export type AftermathScreenSnapshot = {
  data: AftermathResponse; // Full aftermath response from API
  timestamp: number;
};

const STORAGE_KEY = 'event-screen-snapshot';
const SNAPSHOT_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Save current EventScreen state to sessionStorage.
 * Used when navigating to MirrorScreen.
 */
export function saveEventScreenSnapshot(snapshot: EventScreenSnapshot): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    console.log('[EventScreenSnapshot] 📸 Saved snapshot:', {
      phase: snapshot.phase,
      step: snapshot.presentationStep,
      timestamp: new Date(snapshot.timestamp).toLocaleTimeString()
    });
  } catch (error) {
    console.error('[EventScreenSnapshot] ❌ Failed to save snapshot:', error);
  }
}

/**
 * Load EventScreen state from sessionStorage.
 * Returns null if no snapshot exists or if expired.
 */
export function loadEventScreenSnapshot(): EventScreenSnapshot | null {
  try {
    const json = sessionStorage.getItem(STORAGE_KEY);
    if (!json) return null;

    const snapshot = JSON.parse(json) as EventScreenSnapshot;

    // Check if snapshot is expired (> 30 minutes old)
    const age = Date.now() - snapshot.timestamp;
    if (age > SNAPSHOT_TTL_MS) {
      console.log('[EventScreenSnapshot] ⏰ Snapshot expired, clearing');
      clearEventScreenSnapshot();
      return null;
    }

    console.log('[EventScreenSnapshot] 📥 Loaded snapshot:', {
      phase: snapshot.phase,
      step: snapshot.presentationStep,
      age: `${Math.round(age / 1000)}s ago`
    });

    return snapshot;
  } catch (error) {
    console.error('[EventScreenSnapshot] ❌ Failed to load snapshot:', error);
    clearEventScreenSnapshot();
    return null;
  }
}

/**
 * Clear snapshot from sessionStorage.
 * Used after restoration or when snapshot expires.
 */
export function clearEventScreenSnapshot(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if a valid snapshot exists.
 * Useful for conditional UI (e.g., "Back to Event" vs "Back").
 */
export function hasEventScreenSnapshot(): boolean {
  return loadEventScreenSnapshot() !== null;
}

// ============================================================================
// RETURN ROUTE TRACKING (for MirrorQuizScreen → MirrorScreen navigation)
// ============================================================================

const RETURN_ROUTE_KEY = 'mirror-return-route';

/**
 * Save the route to return to after viewing MirrorScreen
 * Used when navigating from MirrorQuizScreen to MirrorScreen
 */
export function saveMirrorReturnRoute(route: string): void {
  sessionStorage.setItem(RETURN_ROUTE_KEY, route);
  console.log('[MirrorReturnRoute] 📍 Saved return route:', route);
}

/**
 * Get the route to return to after viewing MirrorScreen
 * Returns null if no return route is saved
 */
export function getMirrorReturnRoute(): string | null {
  return sessionStorage.getItem(RETURN_ROUTE_KEY);
}

/**
 * Clear the saved return route
 */
export function clearMirrorReturnRoute(): void {
  sessionStorage.removeItem(RETURN_ROUTE_KEY);
}

// ============================================================================
// AFTERMATH RETURN ROUTE TRACKING (for AftermathScreen → MirrorScreen)
// ============================================================================

const AFTERMATH_RETURN_ROUTE_KEY = 'aftermath-return-route';

/**
 * Save the route to return to after viewing MirrorScreen from AftermathScreen
 * Used when navigating from AftermathScreen to MirrorScreen
 */
export function saveAftermathReturnRoute(route: string): void {
  sessionStorage.setItem(AFTERMATH_RETURN_ROUTE_KEY, route);
  console.log('[AftermathReturnRoute] 📍 Saved return route:', route);
}

/**
 * Get the route to return to after viewing MirrorScreen from AftermathScreen
 * Returns null if no return route is saved
 */
export function getAftermathReturnRoute(): string | null {
  return sessionStorage.getItem(AFTERMATH_RETURN_ROUTE_KEY);
}

/**
 * Clear the saved aftermath return route
 */
export function clearAftermathReturnRoute(): void {
  sessionStorage.removeItem(AFTERMATH_RETURN_ROUTE_KEY);
}

// ============================================================================
// AFTERMATH SCREEN SNAPSHOT (for AftermathScreen → MirrorScreen navigation)
// ============================================================================

const AFTERMATH_SNAPSHOT_KEY = 'aftermath-screen-snapshot';

/**
 * Save current AftermathScreen data to sessionStorage.
 * Used when navigating to MirrorScreen from AftermathScreen.
 */
export function saveAftermathScreenSnapshot(snapshot: AftermathScreenSnapshot): void {
  try {
    sessionStorage.setItem(AFTERMATH_SNAPSHOT_KEY, JSON.stringify(snapshot));
    console.log('[AftermathScreenSnapshot] 📸 Saved snapshot:', {
      timestamp: new Date(snapshot.timestamp).toLocaleTimeString()
    });
  } catch (error) {
    console.error('[AftermathScreenSnapshot] ❌ Failed to save snapshot:', error);
  }
}

/**
 * Load AftermathScreen data from sessionStorage.
 * Returns null if no snapshot exists or if expired.
 */
export function loadAftermathScreenSnapshot(): AftermathScreenSnapshot | null {
  try {
    const json = sessionStorage.getItem(AFTERMATH_SNAPSHOT_KEY);
    if (!json) return null;

    const snapshot = JSON.parse(json) as AftermathScreenSnapshot;

    // Check if snapshot is expired (> 30 minutes old)
    const age = Date.now() - snapshot.timestamp;
    if (age > SNAPSHOT_TTL_MS) {
      console.log('[AftermathScreenSnapshot] ⏰ Snapshot expired, clearing');
      clearAftermathScreenSnapshot();
      return null;
    }

    console.log('[AftermathScreenSnapshot] 📥 Loaded snapshot:', {
      age: `${Math.round(age / 1000)}s ago`
    });

    return snapshot;
  } catch (error) {
    console.error('[AftermathScreenSnapshot] ❌ Failed to load snapshot:', error);
    clearAftermathScreenSnapshot();
    return null;
  }
}

/**
 * Clear aftermath snapshot from sessionStorage.
 * Used after restoration or when snapshot expires.
 */
export function clearAftermathScreenSnapshot(): void {
  sessionStorage.removeItem(AFTERMATH_SNAPSHOT_KEY);
}

/**
 * Check if a valid aftermath snapshot exists.
 * Useful for conditional UI.
 */
export function hasAftermathScreenSnapshot(): boolean {
  return loadAftermathScreenSnapshot() !== null;
}
