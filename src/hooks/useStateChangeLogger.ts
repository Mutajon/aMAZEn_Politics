// src/hooks/useStateChangeLogger.ts
// React hook for automatic state change logging
//
// Features:
// - Auto-subscribes to Zustand store changes
// - Logs compass changes as daily summaries (consolidated to reduce redundancy)
// - Tracks goal status changes
// - Non-invasive: no manual logging needed in store setters
//
// Optimization Notes:
// - Support, budget, corruption, score, day, crisis mode, and custom action count
//   logging REMOVED - 100% redundant with AI output logs that include explanations
// - Compass logging changed from individual events (50+) to daily summaries (7-8)
// - Reduces ~113 redundant events per game with ZERO research data loss
//
// Usage:
//   // In a top-level component (e.g., App.tsx or EventScreen3)
//   useStateChangeLogger();
//
// Note: This hook should only be instantiated once per application to avoid
// duplicate subscriptions

import { useEffect, useRef } from 'react';
import { useDilemmaStore } from '../store/dilemmaStore';
import { useCompassStore } from '../store/compassStore';
import { useSettingsStore } from '../store/settingsStore';
import { useLogger } from './useLogger';
import { COMPONENTS, type PropKey } from '../data/compass-data';

export function useStateChangeLogger() {
  const logger = useLogger();
  const isSubscribed = useRef(false);

  // Accumulator for compass changes per day
  const compassChangesRef = useRef<Array<{
    dimension: string;
    component: string;
    from: number;
    to: number;
    delta: number;
  }>>([]);
  const currentDayRef = useRef<number | null>(null);

  useEffect(() => {
    if (isSubscribed.current) {
      return;
    }

    console.log('[StateChangeLogger] ✅ Subscribing to store changes');
    isSubscribed.current = true;

    // ============================================================================
    // DILEMMA STORE SUBSCRIPTION
    // Tracks: goal status changes, day progression (for compass summary)
    // ============================================================================
    // NOTE: Support, budget, corruption, score, crisis mode, and custom action count
    // logging REMOVED - 100% redundant with AI output logs (support_shifts_summary,
    // corruption_shift_generated, etc.) which include explanations and context.
    // This reduces ~71 redundant events per game with ZERO research impact.

    const unsubDilemma = useDilemmaStore.subscribe(
      (state, prevState) => {
        // Day progression - used to trigger compass summary logging
        if (state.day !== prevState.day) {
          // Log compass summary for previous day (if any changes accumulated)
          if (compassChangesRef.current.length > 0 && currentDayRef.current !== null) {
            logger.logSystem(
              'compass_changes_daily_summary',
              {
                day: currentDayRef.current,
                totalChanges: compassChangesRef.current.length,
                changes: compassChangesRef.current
              },
              `Day ${currentDayRef.current}: ${compassChangesRef.current.length} compass changes`
            );
          }

          // Reset accumulator for new day
          compassChangesRef.current = [];
          currentDayRef.current = state.day;
        }

        // Goal status changes (keep - not redundant, important for goal tracking)
        if (state.selectedGoals.length > 0) {
          state.selectedGoals.forEach((goal, idx) => {
            const prevGoal = prevState.selectedGoals[idx];
            if (prevGoal && goal.status !== prevGoal.status) {
              logger.logSystem(
                'state_goal_status_changed',
                {
                  goalId: goal.id,
                  goalTitle: goal.title,
                  from: prevGoal.status,
                  to: goal.status
                },
                `Goal "${goal.title}": ${prevGoal.status} → ${goal.status}`
              );
            }
          });
        }
      }
    );

    // ============================================================================
    // COMPASS STORE SUBSCRIPTION
    // Accumulates compass changes for daily summary logging
    // ============================================================================
    // NOTE: Changed from individual logging (50+ events) to daily summaries (7-8 events)
    // to reduce redundancy while preserving all compass data. Saves ~42 events per game.

    const unsubCompass = useCompassStore.subscribe(
      (state, prevState) => {
        // Initialize current day if not set
        if (currentDayRef.current === null) {
          currentDayRef.current = useDilemmaStore.getState().day;
        }

        // Check if any compass dimension changed
        const dimensions = ['what', 'whence', 'how', 'whither'] as const;

        dimensions.forEach(dim => {
          const newValues = state.values[dim];
          const oldValues = prevState.values[dim];

          if (!newValues || !oldValues) return;

          // Get component names for this dimension
          const components = COMPONENTS[dim as PropKey];

          // Check each component in dimension
          newValues.forEach((newVal, idx) => {
            const oldVal = oldValues[idx];
            if (newVal !== oldVal) {
              const delta = newVal - oldVal;
              const componentName = components[idx]?.short || `unknown[${idx}]`;

              // Accumulate change instead of logging immediately
              compassChangesRef.current.push({
                dimension: dim,
                component: componentName,
                from: oldVal,
                to: newVal,
                delta
              });
            }
          });
        });
      }
    );

    // ============================================================================
    // SETTINGS STORE SUBSCRIPTION
    // Tracks: treatment changes
    // ============================================================================

    const unsubSettings = useSettingsStore.subscribe(
      (state, prevState) => {
        // Treatment changes (important for experiment tracking)
        if (state.treatment !== prevState.treatment) {
          logger.logSystem(
            'state_treatment_changed',
            {
              from: prevState.treatment,
              to: state.treatment
            },
            `Treatment assigned: ${state.treatment}`
          );
        }

        // Difficulty changes
        if (state.debugMode !== prevState.debugMode) {
          logger.logSystem(
            'state_debug_mode_changed',
            {
              enabled: state.debugMode
            },
            `Debug mode: ${state.debugMode ? 'enabled' : 'disabled'}`
          );
        }
      }
    );

    // Cleanup subscriptions on unmount
    return () => {
      console.log('[StateChangeLogger] Unsubscribing from store changes');
      unsubDilemma();
      unsubCompass();
      unsubSettings();
      isSubscribed.current = false;
    };
  }, [logger]);
}
