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
import { collectSessionSummary } from './useSessionSummary';

export function usePartialSummaryLogger() {
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Check if session is active (day > 0 means game started)
      const { day } = useDilemmaStore.getState();
      if (day === 0 || day > 7) {
        // Game not started or already ended naturally
        return;
      }

      try {
        // Collect partial summary (aftermathData = null, incomplete = true)
        const summary = collectSessionSummary(null, true);

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
