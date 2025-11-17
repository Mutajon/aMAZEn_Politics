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
import type { CompassValues } from "./compassStore";

// ===== DATA LOGGING VARIABLES =====

type LoggingState = {
  // --- User identification (anonymous) ---
  userId: string | null;             // Anonymous UUID (auto-generated) OR researcher-provided ID number (9 digits)
  setUserId: (id: string) => void;

  // --- Session tracking ---
  sessionId: string | null;          // Current game session UUID
  setSessionId: (id: string | null) => void;
  sessionStartTime: number | null;   // Session start timestamp (persisted to localStorage)
  setSessionStartTime: (time: number | null) => void;

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

  // --- Initial compass snapshot (for session summary) ---
  initialCompassSnapshot: CompassValues | null;  // Snapshot of initial compass values after quiz
  setInitialCompassSnapshot: (snapshot: CompassValues) => void;

  // --- Experiment mode progress (sequential role runs) ---
  experimentProgress: ExperimentProgress;
  setExperimentActiveRole: (key: string | null) => void;
  markExperimentRoleCompleted: (key: string) => void;
  resetExperimentProgress: () => void;
};

type ExperimentProgress = {
  completedRoles: Record<string, boolean>;
  activeRoleKey: string | null;
};

const defaultExperimentProgress = (): ExperimentProgress => ({
  completedRoles: {},
  activeRoleKey: null,
});

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
    (set, _get) => ({
      // --- User identification ---
      userId: null,  // Will be generated on first use
      setUserId: (id) => set({ userId: id }),

      // --- Session tracking ---
      sessionId: null,  // Generated when game starts
      setSessionId: (id) => set({ sessionId: id }),
      sessionStartTime: null,  // Session start timestamp
      setSessionStartTime: (time) => set({ sessionStartTime: time }),

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

      // --- Initial compass snapshot ---
      initialCompassSnapshot: null,
      setInitialCompassSnapshot: (snapshot) => {
        set({ initialCompassSnapshot: snapshot });
        console.log('[loggingStore] Initial compass snapshot saved (defensive persistence)');
      },

      // --- Experiment mode progress ---
      experimentProgress: defaultExperimentProgress(),
      setExperimentActiveRole: (key) =>
        set((state) => ({
          experimentProgress: {
            ...state.experimentProgress,
            activeRoleKey: key,
          },
        })),
      markExperimentRoleCompleted: (key) =>
        set((state) => ({
          experimentProgress: {
            completedRoles: {
              ...state.experimentProgress.completedRoles,
              [key]: true,
            },
            activeRoleKey: null,
          },
        })),
      resetExperimentProgress: () => set({ experimentProgress: defaultExperimentProgress() }),
    }),
    {
      name: "logging-v5",  // bumped from v4 to v5 to include initialCompassSnapshot
      partialize: (s) => ({
        // Only persist these fields
        userId: s.userId,
        gameVersion: s.gameVersion,
        treatment: s.treatment,
        consented: s.consented,
        experimentProgress: s.experimentProgress,
        sessionStartTime: s.sessionStartTime,  // Persist session start time
        initialCompassSnapshot: s.initialCompassSnapshot,  // Persist initial compass snapshot
        // DON'T persist: sessionId, isInitialized
        // NOTE: 'enabled' removed - now controlled by settingsStore.dataCollectionEnabled
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
    userId: null,
    sessionId: null,
    sessionStartTime: null,
    gameVersion: '0.0.0',
    treatment: 'control',
    consented: false,
    isInitialized: false,
    initialCompassSnapshot: null,
    experimentProgress: defaultExperimentProgress(),
  });
}
