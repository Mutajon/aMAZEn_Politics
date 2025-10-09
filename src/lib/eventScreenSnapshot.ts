// src/lib/eventScreenSnapshot.ts
/**
 * EventScreen snapshot system for seamless navigation to/from MirrorScreen.
 * Preserves phase, presentation step, and collected data in sessionStorage
 * so the player can return to the exact same state without re-loading.
 *
 * Connected files:
 * - Used by: src/screens/EventScreen3.tsx (save/restore on navigation)
 * - Used by: src/screens/MirrorScreen.tsx (check if snapshot exists)
 */

export type EventScreenSnapshot = {
  phase: 'collecting' | 'presenting' | 'interacting' | 'cleaning';
  presentationStep: number;
  collectedData: any; // Full CollectedData object from useEventDataCollector
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
