// src/hooks/useLogger.ts
// React hook for logging user events
//
// Usage:
//   const logger = useLogger();
//   logger.log('button_click', 'Start Game', 'User clicked start button');
//
// Automatically includes metadata (screen, day, role) from application state

import { useCallback, useMemo } from 'react';
import { useLoggingStore } from '../store/loggingStore';
import { useDilemmaStore } from '../store/dilemmaStore';
import { useRoleStore } from '../store/roleStore';
import { loggingService } from '../lib/loggingService';

/**
 * Get current route without creating event listeners
 * (prevents duplicate navigation logging)
 */
function getCurrentRoute(): string {
  if (typeof window === 'undefined') return '/';
  const hash = window.location.hash.replace(/^#/, '');
  return hash || '/';
}

export function useLogger() {
  const enabled = useLoggingStore((s) => s.enabled);
  const day = useDilemmaStore((s) => s.day);
  const selectedRole = useRoleStore((s) => s.selectedRole);

  /**
   * Log an event with automatic metadata
   *
   * @param action - Action name (e.g., "button_click", "role_confirm")
   * @param value - Simple value (string, number, or boolean)
   * @param comments - Optional human-readable description
   */
  const log = useCallback(
    (action: string, value: string | number | boolean, comments?: string) => {
      if (!enabled) {
        return;
      }

      // Automatically attach metadata from application state
      const metadata = {
        screen: getCurrentRoute(),  // Read directly without creating listener
        day: day || undefined,
        role: selectedRole || undefined,
      };

      loggingService.log(action, value, comments, metadata);
    },
    [enabled, day, selectedRole]  // Removed currentRoute dependency
  );

  /**
   * Log a system event with automatic metadata
   * Used for logging game events not directly triggered by player actions
   *
   * @param action - Action name (e.g., "mirror_question_1", "dilemma_presented")
   * @param value - Simple value (string, number, or boolean)
   * @param comments - Optional human-readable description
   */
  const logSystem = useCallback(
    (action: string, value: string | number | boolean, comments?: string) => {
      if (!enabled) {
        return;
      }

      // Automatically attach metadata from application state
      const metadata = {
        screen: getCurrentRoute(),
        day: day || undefined,
        role: selectedRole || undefined,
      };

      loggingService.logSystem(action, value, comments, metadata);
    },
    [enabled, day, selectedRole]
  );

  // Stabilize object reference to prevent unnecessary effect re-triggers
  return useMemo(() => ({ log, logSystem }), [log, logSystem]);
}

/**
 * Convenience hook for logging button clicks
 * Returns a click handler that logs and executes a callback
 *
 * Usage:
 *   const handleClick = useLoggedClick('button_click_start', { buttonId: 'start' }, () => {
 *     // Your click handler code
 *   });
 *   <button onClick={handleClick}>Start</button>
 */
export function useLoggedClick(
  action: string,
  value: any = {},
  comments?: string,
  onClick?: () => void
) {
  const logger = useLogger();

  return useCallback(
    (e?: React.MouseEvent) => {
      logger.log(action, value, comments);
      if (onClick) {
        onClick();
      }
    },
    [logger, action, value, comments, onClick]
  );
}
