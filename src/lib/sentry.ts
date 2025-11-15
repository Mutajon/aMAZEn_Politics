/**
 * Sentry Error Monitoring Configuration
 *
 * Initialized at app startup to capture errors for production monitoring.
 * Integrates with React Error Boundary for comprehensive error tracking.
 */

import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry error monitoring
 *
 * Environment Variables Required:
 * - VITE_SENTRY_DSN: Sentry project DSN from sentry.io
 * - VITE_ENVIRONMENT: Deployment environment (production/development/staging)
 *
 * @returns {boolean} True if Sentry was initialized successfully
 */
export function initSentry(): boolean {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_ENVIRONMENT || 'development';

  // Only initialize if DSN is configured
  if (!dsn) {
    console.log('[Sentry] DSN not configured - error monitoring disabled');
    return false;
  }

  try {
    Sentry.init({
      dsn,
      environment,

      // Enable performance monitoring (optional)
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          // Only capture replays for errors (not all sessions)
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],

      // Performance Monitoring
      tracesSampleRate: environment === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev

      // Session Replay
      replaysSessionSampleRate: 0, // Don't capture regular sessions
      replaysOnErrorSampleRate: 1.0, // Capture 100% of error sessions

      // Release tracking
      release: `amaze-politics@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,

      // Filter out errors we don't care about
      beforeSend(event, hint) {
        // Don't send errors in debug mode (researchers testing)
        const debugMode = localStorage.getItem('debugMode') === 'true';
        if (debugMode) {
          console.log('[Sentry] Debug mode - not sending error:', hint.originalException);
          return null;
        }

        // Filter out network errors from ad blockers
        const error = hint.originalException as Error;
        if (error?.message?.includes('Failed to fetch')) {
          // Could be network issue or ad blocker - don't clutter Sentry
          return null;
        }

        return event;
      },

      // Send user context (anonymous userId from logging system)
      beforeSendTransaction(event) {
        try {
          const userId = localStorage.getItem('userId');
          if (userId) {
            event.user = { id: userId };
          }
        } catch (e) {
          // Ignore localStorage errors
        }
        return event;
      },
    });

    console.log(`[Sentry] Initialized for ${environment} environment`);
    return true;
  } catch (error) {
    console.error('[Sentry] Initialization failed:', error);
    return false;
  }
}

/**
 * Manually capture an error to Sentry
 *
 * @param error - Error object to capture
 * @param context - Additional context for debugging
 */
export function captureError(error: Error, context?: Record<string, unknown>): void {
  if (context) {
    Sentry.setContext('additional', context);
  }
  Sentry.captureException(error);
}

/**
 * Set user context for error tracking
 *
 * @param userId - Anonymous user ID
 * @param metadata - Additional user metadata
 */
export function setUserContext(userId: string, metadata?: Record<string, unknown>): void {
  Sentry.setUser({
    id: userId,
    ...metadata,
  });
}

/**
 * Add breadcrumb for debugging context
 *
 * @param message - Breadcrumb message
 * @param category - Event category
 * @param level - Severity level
 */
export function addBreadcrumb(
  message: string,
  category: string = 'custom',
  level: Sentry.SeverityLevel = 'info'
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    timestamp: Date.now() / 1000,
  });
}

// Export Sentry for use in error boundaries
export { Sentry };
