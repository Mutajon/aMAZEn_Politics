// src/hooks/usePartialSummaryLogger.ts
// Hook to log partial session summaries when user closes tab or navigates away
//
// Handles:
// - Window beforeunload event (tab close, browser close, navigation away)
// - Sends partial summary with incomplete=true flag
// - Uses navigator.sendBeacon for guaranteed delivery
//
// Usage: Call once in App.tsx - automatically handles cleanup

import { useEffect } from 'react';
import { useDilemmaStore } from '../store/dilemmaStore';
import { useRoleStore } from '../store/roleStore';
import { useLoggingStore } from '../store/loggingStore';
import { collectSessionSummary } from './useSessionSummary';

export function usePartialSummaryLogger() {
  useEffect(() => {
    const handleBeforeUnload = () => {
      const dilemmaState = useDilemmaStore.getState();
      const roleState = useRoleStore.getState();
      const loggingState = useLoggingStore.getState();

      const { day, gameId } = dilemmaState;
      const { selectedRole } = roleState;
      const { sessionId, sessionStartTime } = loggingState;

      // Guard 1: Game not started or already ended naturally
      if (day === 0 || day > 7) return;

      // Guard 2: No game session ID = not actually in an active game
      if (!gameId) return;

      // Guard 3: No role selected = user hasn't progressed past role selection
      if (!selectedRole) return;

      // Guard 4: No valid session = logging not properly initialized
      if (!sessionId || sessionId === 'unknown') return;

      try {
        // Calculate actual session duration instead of passing null
        const sessionDuration = sessionStartTime
          ? Date.now() - sessionStartTime
          : null;

        const summary = collectSessionSummary(null, true, sessionDuration);

        // Convert to JSON
        const payload = JSON.stringify(summary);

        // Use sendBeacon for guaranteed delivery even during unload
        // sendBeacon is designed for analytics and works during page unload
        const url = `${window.location.origin}/api/log/summary`;
        const success = navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));

        if (success) {
          console.log('[PartialSummaryLogger] ✅ Partial summary queued for delivery');
        } else {
          console.warn('[PartialSummaryLogger] ⚠️ Failed to queue partial summary');
        }
      } catch (error) {
        console.error('[PartialSummaryLogger] ❌ Error logging partial summary:', error);
        // Don't throw - we're in beforeunload, can't block
      }
    };

    // Add beforeunload listener
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
}
