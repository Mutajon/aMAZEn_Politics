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

      if (!debugMode) {
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

      if (!debugMode || !sessionStartTime.current) {
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

      if (!debugMode) {
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
   * Set up visibility tracking
   * Automatically logs when user leaves/returns to tab
   */
  useEffect(() => {
    const { debugMode } = useSettingsStore.getState();

    if (!debugMode || visibilityListenerAdded.current) {
      return;
    }

    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;

      if (isVisible) {
        logger.log(
          'player_returned',
          {
            hidden: false,
            screen: currentScreen.current || window.location.hash
          },
          'Player returned to tab'
        );
      } else {
        logger.log(
          'player_left',
          {
            hidden: true,
            screen: currentScreen.current || window.location.hash
          },
          'Player left tab'
        );
      }
    };

    const handleWindowBlur = () => {
      logger.log(
        'window_blur',
        {
          screen: currentScreen.current || window.location.hash
        },
        'Window lost focus'
      );
    };

    const handleWindowFocus = () => {
      logger.log(
        'window_focus',
        {
          screen: currentScreen.current || window.location.hash
        },
        'Window gained focus'
      );
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    visibilityListenerAdded.current = true;

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      visibilityListenerAdded.current = false;
    };
  }, [logger]);

  return {
    start,
    end,
    logScreenChange,
    getSessionDuration
  };
}
