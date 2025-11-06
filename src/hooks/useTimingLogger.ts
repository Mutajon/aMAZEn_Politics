// src/hooks/useTimingLogger.ts
// React hook for timing measurements
//
// Usage:
//   const timing = useTimingLogger();
//
//   // Start timing an event
//   const timingId = timing.start('decision_time');
//
//   // End timing (automatically logs duration)
//   timing.end(timingId, { additionalData: 'value' });
//
// Features:
// - Automatic duration calculation
// - Millisecond precision
// - Support for additional metadata
// - Integration with useLogger

import { useCallback, useRef } from 'react';
import { useLogger } from './useLogger';

type TimingEntry = {
  eventName: string;
  startTime: number;
  metadata?: Record<string, unknown>;
};

export function useTimingLogger() {
  const logger = useLogger();
  const timingsRef = useRef<Map<string, TimingEntry>>(new Map());

  /**
   * Start timing an event
   * Returns a unique timing ID that must be used to end the timing
   *
   * @param eventName - Name of the event being timed (e.g., "decision_time", "typing_duration")
   * @param metadata - Optional metadata to attach to the timing
   * @returns Timing ID (UUID) to be used when calling end()
   */
  const start = useCallback((eventName: string, metadata?: Record<string, unknown>): string => {
    const timingId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    timingsRef.current.set(timingId, {
      eventName,
      startTime: performance.now(),
      metadata
    });

    return timingId;
  }, []);

  /**
   * End timing an event and automatically log the duration
   *
   * @param timingId - Timing ID returned from start()
   * @param additionalData - Optional additional data to include in log
   * @returns Duration in milliseconds, or null if timing not found
   */
  const end = useCallback(
    (timingId: string, additionalData?: Record<string, unknown>): number | null => {
      const timing = timingsRef.current.get(timingId);

      if (!timing) {
        console.warn(`[TimingLogger] Timing ID not found: ${timingId}`);
        return null;
      }

      const endTime = performance.now();
      const duration = Math.round(endTime - timing.startTime);

      // Build log data
      const logData = {
        duration,
        ...timing.metadata,
        ...additionalData
      };

      // Log the timing event
      logger.log(
        `timing_${timing.eventName}`,
        logData,
        `Duration: ${duration}ms`
      );

      // Clean up
      timingsRef.current.delete(timingId);

      return duration;
    },
    [logger]
  );

  /**
   * Cancel a timing without logging
   * Useful when user abandons an action
   *
   * @param timingId - Timing ID to cancel
   */
  const cancel = useCallback((timingId: string): void => {
    timingsRef.current.delete(timingId);
  }, []);

  /**
   * Get elapsed time without ending the timing
   * Useful for showing live duration to user
   *
   * @param timingId - Timing ID
   * @returns Elapsed time in milliseconds, or null if timing not found
   */
  const elapsed = useCallback((timingId: string): number | null => {
    const timing = timingsRef.current.get(timingId);

    if (!timing) {
      return null;
    }

    const now = performance.now();
    return Math.round(now - timing.startTime);
  }, []);

  /**
   * Get all active timings (for debugging)
   */
  const getActiveTimings = useCallback((): Array<{ id: string; eventName: string; elapsed: number }> => {
    const now = performance.now();
    const active: Array<{ id: string; eventName: string; elapsed: number }> = [];

    timingsRef.current.forEach((timing, id) => {
      active.push({
        id,
        eventName: timing.eventName,
        elapsed: Math.round(now - timing.startTime)
      });
    });

    return active;
  }, []);

  return {
    start,
    end,
    cancel,
    elapsed,
    getActiveTimings
  };
}
