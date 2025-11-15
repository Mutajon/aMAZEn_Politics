// src/hooks/useStateChangeLogger.ts
// React hook for automatic state change logging
//
// Features:
// - Auto-subscribes to Zustand store changes
// - Logs compass and support snapshots on Days 1, 4, 8 (end of day)
// - Tracks goal status changes
// - Non-invasive: no manual logging needed in store setters
//
// Optimization Notes:
// - Support, budget, corruption, score, crisis mode, and custom action count
//   logging REMOVED - 100% redundant with AI output logs that include explanations
// - Compass/support logging changed from continuous tracking to 3 snapshots per game
// - Reduces ~8-36 redundant events per game while preserving key milestone data
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

export function useStateChangeLogger() {
  const logger = useLogger();
  const isSubscribed = useRef(false);

  // Track which snapshot days have been logged (to prevent duplicates)
  const loggedSnapshotsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (isSubscribed.current) {
      return;
    }

    console.log('[StateChangeLogger] ✅ Subscribing to store changes');
    isSubscribed.current = true;

    // ============================================================================
    // DILEMMA STORE SUBSCRIPTION
    // Tracks: goal status changes, day progression (for snapshots)
    // ============================================================================
    // NOTE: Support, budget, corruption, score, crisis mode, and custom action count
    // logging REMOVED - 100% redundant with AI output logs (support_shifts_summary,
    // corruption_shift_generated, etc.) which include explanations and context.
    // This reduces ~71 redundant events per game with ZERO research impact.

    const unsubDilemma = useDilemmaStore.subscribe(
      (state, prevState) => {
        // Day progression - used to trigger snapshot logging on Days 1, 4, 8
        if (state.day !== prevState.day) {
          const snapshotDays = [1, 4, 8];

          // Check if we should log a snapshot for the PREVIOUS day (end of day timing)
          // This ensures we capture state AFTER the player's action on that day
          if (snapshotDays.includes(prevState.day) && !loggedSnapshotsRef.current.has(prevState.day)) {
            loggedSnapshotsRef.current.add(prevState.day);

            // Get current compass and support values
            const compassState = useCompassStore.getState();
            const supportState = {
              people: state.supportPeople,
              middle: state.supportMiddle,
              mom: state.supportMom
            };

            // Log compass snapshot
            logger.logSystem(
              'compass_snapshot',
              {
                day: prevState.day,
                values: compassState.values
              },
              `Compass snapshot at end of Day ${prevState.day}`
            );

            // Log support snapshot
            logger.logSystem(
              'support_snapshot',
              {
                day: prevState.day,
                people: supportState.people,
                middle: supportState.middle,
                mom: supportState.mom
              },
              `Support snapshot at end of Day ${prevState.day}: People=${supportState.people}, Middle=${supportState.middle}, MoM=${supportState.mom}`
            );
          }
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
    // ============================================================================
    // NOTE: Compass logging now done via snapshots (Days 1, 4, 8) in dilemma store
    // subscription above. No need to subscribe to compass store directly.
    // This approach reduces events from ~7-8 daily summaries to 3 snapshots per game.

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
      unsubSettings();
      isSubscribed.current = false;
    };
  }, [logger]);
}
