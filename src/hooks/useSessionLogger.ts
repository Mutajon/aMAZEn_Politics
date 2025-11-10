// src/hooks/useSessionLogger.ts
// React hook for session lifecycle logging
//
// Features:
// - Session start/end logging
// - Screen navigation tracking
// - Tab visibility monitoring (player leaving/returning)
// - Session duration calculation
// - Automatic visibility event logging
//
// Usage:
//   const session = useSessionLogger();
//
//   // Start session (call once at game start)
//   session.start();
//
//   // End session (call at game end/aftermath)
//   session.end({ finalScore: 1234, ... });
//
//   // Manually log screen change (usually automatic via router)
//   session.logScreenChange('/role', '/event');

import { useCallback, useEffect, useRef } from 'react';
import { useLogger } from './useLogger';
import { useSettingsStore } from '../store/settingsStore';

export function useSessionLogger() {
  const logger = useLogger();
  const sessionStartTime = useRef<number | null>(null);
  const currentScreen = useRef<string | null>(null);
  const screenStartTime = useRef<number | null>(null);
  const visibilityListenerAdded = useRef(false);

  /**
   * Start a new session
   * Records session start time and logs session_start event
   *
   * @param metadata - Optional metadata to attach to session start
   */
  const start = useCallback(
    (metadata?: Record<string, unknown>) => {
      const { debugMode } = useSettingsStore.getState();

      if (debugMode) {
        return;
      }

      sessionStartTime.current = Date.now();

      logger.logSystem(
        'session_start',
        {
          timestamp: new Date().toISOString(),
          ...metadata
        },
        'User started new game session'
      );

      console.log('[SessionLogger] ✅ Session started');
    },
    [logger]
  );

  /**
   * End current session
   * Calculates session duration and logs session_end event with summary
   *
   * @param summary - Summary data to include (e.g., final score, inquiries made, etc.)
   */
  const end = useCallback(
    (summary?: Record<string, unknown>) => {
      const { debugMode } = useSettingsStore.getState();

      if (debugMode || !sessionStartTime.current) {
        return;
      }

      const sessionDuration = Date.now() - sessionStartTime.current;

      logger.logSystem(
        'session_end',
        {
          sessionDuration,
          ...summary
        },
        `Session ended after ${Math.round(sessionDuration / 1000)}s`
      );

      console.log('[SessionLogger] ✅ Session ended:', {
        duration: `${Math.round(sessionDuration / 1000)}s`,
        summary
      });

      sessionStartTime.current = null;
    },
    [logger]
  );

  /**
   * Log screen change (navigation event)
   *
   * @param from - Previous screen route
   * @param to - New screen route
   */
  const logScreenChange = useCallback(
    (from: string, to: string) => {
      const { debugMode } = useSettingsStore.getState();

      if (debugMode) {
        return;
      }

      // Calculate time spent on previous screen
      let timeOnScreen: number | null = null;
      if (screenStartTime.current) {
        timeOnScreen = Date.now() - screenStartTime.current;
      }

      logger.log(
        'screen_navigation',
        {
          from,
          to,
          timeOnPreviousScreen: timeOnScreen
        },
        `Navigated from ${from} to ${to}`
      );

      // Update current screen tracking
      currentScreen.current = to;
      screenStartTime.current = Date.now();
    },
    [logger]
  );

  /**
   * Get current session duration
   * @returns Duration in milliseconds, or null if session not started
   */
  const getSessionDuration = useCallback((): number | null => {
    if (!sessionStartTime.current) {
      return null;
    }

    return Date.now() - sessionStartTime.current;
  }, []);

  /**
   * REMOVED: Visibility tracking (window blur/focus, player left/returned)
   *
   * These events created excessive noise in logs:
   * - 4 events fired for simple tab switch (visibilitychange + blur + focus)
   * - Low research value (doesn't indicate gameplay decisions)
   * - Overlapping/redundant information
   *
   * If needed in future, consider adding ONLY visibilitychange (player_left/returned)
   * and remove window blur/focus entirely.
   */

  return {
    start,
    end,
    logScreenChange,
    getSessionDuration
  };
}
