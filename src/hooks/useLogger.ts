// src/hooks/useLogger.ts
// React hook for logging user events
//
// Usage:
//   const logger = useLogger();
//   logger.log('button_click', { buttonId: 'start-game' }, 'User clicked start button');
//
// Automatically includes metadata (screen, day, role) from application state

import { useCallback } from 'react';
import { useLoggingStore } from '../store/loggingStore';
import { useDilemmaStore } from '../store/dilemmaStore';
import { useRoleStore } from '../store/roleStore';
import { useHashRoute } from '../lib/router';
import { loggingService } from '../lib/loggingService';

export function useLogger() {
  const enabled = useLoggingStore((s) => s.enabled);
  const currentRoute = useHashRoute().route;
  const day = useDilemmaStore((s) => s.day);
  const selectedRole = useRoleStore((s) => s.selectedRole);

  /**
   * Log an event with automatic metadata
   *
   * @param action - Action name (e.g., "button_click_start_game")
   * @param value - Action-specific data (object, string, number, etc.)
   * @param comments - Optional human-readable description
   */
  const log = useCallback(
    (action: string, value: any = {}, comments?: string) => {
      if (!enabled) {
        return;
      }

      // Automatically attach metadata from application state
      const metadata = {
        screen: currentRoute,
        day: day || undefined,
        role: selectedRole || undefined,
      };

      loggingService.log(action, value, comments, metadata);
    },
    [enabled, currentRoute, day, selectedRole]
  );

  return { log };
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
