import { useEffect } from 'react';
import { useLogger } from './useLogger';

/**
 * Navigation Guard Hook
 *
 * Prevents browser back button navigation with optional confirmation dialog.
 * Uses popstate event detection with history length tracking to identify
 * BACK navigation specifically, while allowing forward navigation to proceed.
 *
 * @param config Configuration object
 * @param config.enabled - Whether to enable the navigation guard
 * @param config.confirmationMessage - Optional message to show in confirmation dialog
 * @param config.screenName - Screen name for logging purposes
 *
 * @example
 * ```tsx
 * // In EventScreen3.tsx
 * useNavigationGuard({
 *   enabled: true,
 *   confirmationMessage: t("CONFIRM_EXIT_GAMEPLAY"),
 *   screenName: "event_screen"
 * });
 * ```
 *
 * @note Only blocks BACK navigation (browser back button). Forward navigation
 * via programmatic push() or UI buttons is allowed without interruption.
 */
export function useNavigationGuard(config: {
  enabled: boolean;
  confirmationMessage?: string;
  screenName: string;
}) {
  const logger = useLogger();

  useEffect(() => {
    if (!config.enabled) return;

    // Track current history length to detect navigation direction
    let currentHistoryLength = window.history.length;

    // Handle popstate event (triggered when user presses back/forward button)
    const handlePopState = () => {
      const newHistoryLength = window.history.length;

      // Detect BACK navigation
      // When going back, history.length typically stays the same
      // We detect back by comparing against our tracked value before any state changes
      const isBackNavigation = newHistoryLength <= currentHistoryLength;

      // Only block BACK navigation, allow forward navigation
      if (isBackNavigation) {
        // If confirmation message is provided, show confirmation dialog
        if (config.confirmationMessage) {
          const confirmed = window.confirm(config.confirmationMessage);

          // Log the back button attempt
          logger.log(
            'back_button_blocked',
            {
              screen: config.screenName,
              userConfirmed: confirmed,
              hasConfirmationDialog: true,
              direction: 'back'
            },
            `User ${confirmed ? 'confirmed exit' : 'canceled exit'} from ${config.screenName}`
          );

          if (!confirmed) {
            // User canceled - push a new state to prevent navigation
            window.history.pushState(null, '', window.location.href);
          }
          // If confirmed, allow navigation to proceed naturally
        } else {
          // No confirmation message - silently block navigation
          logger.log(
            'back_button_blocked',
            {
              screen: config.screenName,
              userConfirmed: false,
              hasConfirmationDialog: false,
              direction: 'back'
            },
            `Back button silently blocked on ${config.screenName}`
          );

          // Push a new state to prevent navigation
          window.history.pushState(null, '', window.location.href);
        }
      }

      // Update tracked length after handling navigation
      currentHistoryLength = window.history.length;
    };

    // Listen for back/forward button presses
    window.addEventListener('popstate', handlePopState);

    // Cleanup
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [config.enabled, config.confirmationMessage, config.screenName, logger]);
}
