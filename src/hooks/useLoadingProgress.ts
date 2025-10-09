// src/hooks/useLoadingProgress.ts
// Progressive loading progress hook with auto-increment and smooth catch-up animation
//
// Features:
// - Auto-increments progress from 0→100% at 1% per second
// - Detects server readiness and smoothly animates remaining distance over 1 second
// - Resets cleanly for reuse across multiple loading cycles
//
// Used by: EventScreen3 via CollectorLoadingOverlay
// Dependencies: React hooks

import { useState, useEffect, useRef, useCallback } from "react";

export type LoadingProgressState = {
  progress: number;           // Current progress percentage (0-100)
  isAnimatingCatchup: boolean; // True during final catchup animation
};

export type LoadingProgressControls = {
  start: () => void;           // Start progress from 0%
  reset: () => void;           // Reset to 0% without starting
  notifyReady: () => void;     // Signal server ready - triggers catchup animation
};

/**
 * Progressive loading progress hook with auto-increment and smooth catch-up
 *
 * Usage:
 * ```tsx
 * const { progress, isAnimatingCatchup, start, reset, notifyReady } = useLoadingProgress();
 *
 * // Start loading
 * useEffect(() => {
 *   start();
 * }, []);
 *
 * // Notify when server responds
 * useEffect(() => {
 *   if (serverReady) {
 *     notifyReady();
 *   }
 * }, [serverReady]);
 * ```
 */
export function useLoadingProgress(): LoadingProgressState & LoadingProgressControls {
  const [progress, setProgress] = useState(0);
  const [isAnimatingCatchup, setIsAnimatingCatchup] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const incrementTimerRef = useRef<number | null>(null);
  const catchupTimerRef = useRef<number | null>(null);
  const catchupStartTimeRef = useRef<number | null>(null);
  const catchupStartProgressRef = useRef<number>(0);

  // Auto-increment progress at 1% per second
  useEffect(() => {
    if (!isRunning || isAnimatingCatchup) {
      return;
    }

    // Clear any existing timer
    if (incrementTimerRef.current !== null) {
      window.clearInterval(incrementTimerRef.current);
    }

    // Start incrementing at 1% per second (1000ms interval)
    incrementTimerRef.current = window.setInterval(() => {
      setProgress(prev => {
        const next = prev + 1;
        // Cap at 99% - never reach 100% via auto-increment
        if (next >= 99) {
          if (incrementTimerRef.current !== null) {
            window.clearInterval(incrementTimerRef.current);
            incrementTimerRef.current = null;
          }
          return 99;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (incrementTimerRef.current !== null) {
        window.clearInterval(incrementTimerRef.current);
        incrementTimerRef.current = null;
      }
    };
  }, [isRunning, isAnimatingCatchup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (incrementTimerRef.current !== null) {
        window.clearInterval(incrementTimerRef.current);
      }
      if (catchupTimerRef.current !== null) {
        window.cancelAnimationFrame(catchupTimerRef.current);
      }
    };
  }, []);

  const start = useCallback(() => {
    setProgress(0);
    setIsAnimatingCatchup(false);
    setIsRunning(true);
  }, []);

  const reset = useCallback(() => {
    // Clear all timers
    if (incrementTimerRef.current !== null) {
      window.clearInterval(incrementTimerRef.current);
      incrementTimerRef.current = null;
    }
    if (catchupTimerRef.current !== null) {
      window.cancelAnimationFrame(catchupTimerRef.current);
      catchupTimerRef.current = null;
    }

    setProgress(0);
    setIsAnimatingCatchup(false);
    setIsRunning(false);
  }, []);

  const notifyReady = useCallback(() => {
    // Stop auto-increment
    if (incrementTimerRef.current !== null) {
      window.clearInterval(incrementTimerRef.current);
      incrementTimerRef.current = null;
    }

    setIsAnimatingCatchup(true);

    // Record starting progress for animation
    setProgress(currentProgress => {
      catchupStartProgressRef.current = currentProgress;
      catchupStartTimeRef.current = Date.now();

      const distance = 100 - currentProgress;

      // Animate from current → 100% over 1 second
      const animate = () => {
        const elapsed = Date.now() - (catchupStartTimeRef.current || Date.now());
        const duration = 1000; // 1 second
        const t = Math.min(elapsed / duration, 1); // Clamp to [0, 1]

        // Ease-out cubic for smooth deceleration
        const eased = 1 - Math.pow(1 - t, 3);

        const newProgress = catchupStartProgressRef.current + (distance * eased);

        setProgress(Math.round(newProgress));

        if (t < 1) {
          catchupTimerRef.current = window.requestAnimationFrame(animate);
        } else {
          // Animation complete - reached 100%
          setProgress(100);
          setIsAnimatingCatchup(false);
          setIsRunning(false);
        }
      };

      animate();

      return currentProgress; // Return current value to avoid immediate state update
    });
  }, []);

  return {
    progress,
    isAnimatingCatchup,
    start,
    reset,
    notifyReady
  };
}
