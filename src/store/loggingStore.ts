// src/store/loggingStore.ts
// Zustand store for data logging system state
//
// Manages:
// - User ID (anonymous UUID, persisted to localStorage)
// - Session ID (regenerated per game session)
// - Treatment condition
// - Logging enabled/disabled state
// - Consent status

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ===== DATA LOGGING VARIABLES =====

type LoggingState = {
  // --- Logging enabled/disabled ---
  enabled: boolean;                  // Is data collection active?
  setEnabled: (v: boolean) => void;
  toggleEnabled: () => void;

  // --- User identification (anonymous) ---
  userId: string | null;             // Anonymous UUID (persisted)
  setUserId: (id: string) => void;

  // --- Session tracking ---
  sessionId: string | null;          // Current game session UUID
  setSessionId: (id: string | null) => void;

  // --- Game version (from package.json) ---
  gameVersion: string;               // Semantic version string
  setGameVersion: (v: string) => void;

  // --- Treatment condition (for A/B testing) ---
  treatment: string;                 // Treatment group (e.g., "control", "experimental_a")
  setTreatment: (t: string) => void;

  // --- Consent status ---
  consented: boolean;                // Has user given consent?
  setConsented: (v: boolean) => void;

  // --- Initialization ---
  isInitialized: boolean;            // Has logging service been initialized?
  setInitialized: (v: boolean) => void;
};

/**
 * Generate a random UUID v4
 * Used for anonymous user identification
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export const useLoggingStore = create<LoggingState>()(
  persist(
    (set, get) => ({
      // --- Logging enabled/disabled ---
      enabled: false,  // Default: disabled (user must consent)
      setEnabled: (v) => set({ enabled: v }),
      toggleEnabled: () => set({ enabled: !get().enabled }),

      // --- User identification ---
      userId: null,  // Will be generated on first use
      setUserId: (id) => set({ userId: id }),

      // --- Session tracking ---
      sessionId: null,  // Generated when game starts
      setSessionId: (id) => set({ sessionId: id }),

      // --- Game version ---
      gameVersion: '0.0.0',  // Will be set from package.json
      setGameVersion: (v) => set({ gameVersion: v }),

      // --- Treatment ---
      treatment: 'control',  // Default treatment
      setTreatment: (t) => set({ treatment: t }),

      // --- Consent ---
      consented: false,  // Default: not consented
      setConsented: (v) => set({ consented: v }),

      // --- Initialization ---
      isInitialized: false,
      setInitialized: (v) => set({ isInitialized: v }),
    }),
    {
      name: "logging-v1",  // localStorage key
      partialize: (s) => ({
        // Only persist these fields
        enabled: s.enabled,
        userId: s.userId,
        gameVersion: s.gameVersion,
        treatment: s.treatment,
        consented: s.consented,
        // DON'T persist: sessionId, isInitialized
      }),
    }
  )
);

/**
 * Get or create user ID
 * Generates UUID if not already set
 */
export function ensureUserId(): string {
  const { userId, setUserId } = useLoggingStore.getState();

  if (userId) {
    return userId;
  }

  // Generate new UUID
  const newUserId = generateUUID();
  setUserId(newUserId);
  console.log('[Logging] Generated new userId:', newUserId);
  return newUserId;
}

/**
 * Reset logging state (for testing)
 */
export function resetLoggingStore() {
  useLoggingStore.setState({
    enabled: false,
    userId: null,
    sessionId: null,
    gameVersion: '0.0.0',
    treatment: 'control',
    consented: false,
    isInitialized: false,
  });
}
