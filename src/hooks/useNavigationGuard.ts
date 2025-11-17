import { useEffect } from 'react';
import { useLogger } from './useLogger';

/**
 * Navigation Guard Hook
 *
 * Prevents browser back button navigation with optional confirmation dialog.
 * Uses history.pushState() and popstate event to create a "barrier" that
 * intercepts back button presses.
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
 */
export function useNavigationGuard(config: {
  enabled: boolean;
  confirmationMessage?: string;
  screenName: string;
}) {
  const logger = useLogger();

  useEffect(() => {
    if (!config.enabled) return;

    // Push a dummy state to create a "barrier" in browser history
    const pushBarrier = () => {
      window.history.pushState(null, '', window.location.href);
    };

    // Initial barrier
    pushBarrier();

    // Handle popstate event (triggered when user presses back button)
    const handlePopState = () => {
      // If confirmation message is provided, show confirmation dialog
      if (config.confirmationMessage) {
        const confirmed = window.confirm(config.confirmationMessage);

        // Log the back button attempt
        logger.log(
          'back_button_blocked',
          {
            screen: config.screenName,
            userConfirmed: confirmed,
            hasConfirmationDialog: true
          },
          `User ${confirmed ? 'confirmed exit' : 'canceled exit'} from ${config.screenName}`
        );

        if (!confirmed) {
          // User canceled - re-push barrier to prevent navigation
          pushBarrier();
        }
        // If confirmed, allow navigation to proceed naturally
      } else {
        // No confirmation message - silently block navigation
        logger.log(
          'back_button_blocked',
          {
            screen: config.screenName,
            userConfirmed: false,
            hasConfirmationDialog: false
          },
          `Back button silently blocked on ${config.screenName}`
        );

        // Re-push barrier to prevent navigation
        pushBarrier();
      }
    };

    // Listen for back button presses
    window.addEventListener('popstate', handlePopState);

    // Cleanup
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [config.enabled, config.confirmationMessage, config.screenName, logger]);
}
