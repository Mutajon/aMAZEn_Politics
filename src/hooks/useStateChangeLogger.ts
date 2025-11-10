// src/hooks/useStateChangeLogger.ts
// React hook for automatic state change logging
//
// Features:
// - Auto-subscribes to Zustand store changes
// - Logs support, budget, corruption, compass changes with deltas
// - Tracks goal status changes
// - Non-invasive: no manual logging needed in store setters
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

  useEffect(() => {
    const { debugMode } = useSettingsStore.getState();

    if (!debugMode || isSubscribed.current) {
      return;
    }

    console.log('[StateChangeLogger] ✅ Subscribing to store changes');
    isSubscribed.current = true;

    // ============================================================================
    // DILEMMA STORE SUBSCRIPTION
    // Tracks: support, budget, corruption, goals, day progression
    // ============================================================================

    const unsubDilemma = useDilemmaStore.subscribe(
      (state, prevState) => {
        // Support changes
        if (state.supportPeople !== prevState.supportPeople) {
          const delta = state.supportPeople - prevState.supportPeople;
          logger.logSystem(
            'state_support_people_changed',
            {
              from: prevState.supportPeople,
              to: state.supportPeople,
              delta
            },
            `Support (People): ${prevState.supportPeople} → ${state.supportPeople} (${delta >= 0 ? '+' : ''}${delta})`
          );
        }

        if (state.supportMiddle !== prevState.supportMiddle) {
          const delta = state.supportMiddle - prevState.supportMiddle;
          logger.logSystem(
            'state_support_middle_changed',
            {
              from: prevState.supportMiddle,
              to: state.supportMiddle,
              delta
            },
            `Support (Middle): ${prevState.supportMiddle} → ${state.supportMiddle} (${delta >= 0 ? '+' : ''}${delta})`
          );
        }

        if (state.supportMom !== prevState.supportMom) {
          const delta = state.supportMom - prevState.supportMom;
          logger.logSystem(
            'state_support_mom_changed',
            {
              from: prevState.supportMom,
              to: state.supportMom,
              delta
            },
            `Support (Mom): ${prevState.supportMom} → ${state.supportMom} (${delta >= 0 ? '+' : ''}${delta})`
          );
        }

        // Budget changes
        if (state.budget !== prevState.budget) {
          const delta = state.budget - prevState.budget;
          logger.logSystem(
            'state_budget_changed',
            {
              from: prevState.budget,
              to: state.budget,
              delta
            },
            `Budget: ${prevState.budget} → ${state.budget} (${delta >= 0 ? '+' : ''}${delta})`
          );
        }

        // Corruption changes
        if (state.corruptionLevel !== prevState.corruptionLevel) {
          const delta = state.corruptionLevel - prevState.corruptionLevel;
          logger.logSystem(
            'state_corruption_changed',
            {
              from: prevState.corruptionLevel,
              to: state.corruptionLevel,
              delta
            },
            `Corruption: ${prevState.corruptionLevel.toFixed(1)} → ${state.corruptionLevel.toFixed(1)} (${delta >= 0 ? '+' : ''}${delta.toFixed(1)})`
          );
        }

        // Score changes
        if (state.score !== prevState.score) {
          const delta = state.score - prevState.score;
          logger.logSystem(
            'state_score_changed',
            {
              from: prevState.score,
              to: state.score,
              delta
            },
            `Score: ${prevState.score} → ${state.score} (${delta >= 0 ? '+' : ''}${delta})`
          );
        }

        // Day progression
        if (state.day !== prevState.day) {
          logger.logSystem(
            'state_day_changed',
            {
              from: prevState.day,
              to: state.day
            },
            `Day advanced: ${prevState.day} → ${state.day}`
          );
        }

        // Goal status changes
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

        // Crisis mode changes
        if (state.crisisMode !== prevState.crisisMode) {
          logger.logSystem(
            'state_crisis_mode_changed',
            {
              from: prevState.crisisMode,
              to: state.crisisMode,
              crisisEntity: state.crisisEntity
            },
            `Crisis mode: ${prevState.crisisMode || 'none'} → ${state.crisisMode || 'none'}`
          );
        }

        // Custom action count (for goals tracking)
        if (state.customActionCount !== prevState.customActionCount) {
          logger.logSystem(
            'state_custom_action_count_changed',
            {
              from: prevState.customActionCount,
              to: state.customActionCount
            },
            `Custom actions: ${prevState.customActionCount} → ${state.customActionCount}`
          );
        }
      }
    );

    // ============================================================================
    // COMPASS STORE SUBSCRIPTION
    // Tracks: compass value changes across all dimensions
    // ============================================================================

    const unsubCompass = useCompassStore.subscribe(
      (state, prevState) => {
        // Check if any compass dimension changed
        const dimensions = ['what', 'whence', 'how', 'whither'] as const;

        dimensions.forEach(dim => {
          const newValues = state.values[dim];
          const oldValues = prevState.values[dim];

          if (!newValues || !oldValues) return;

          // Check each component in dimension
          newValues.forEach((newVal, idx) => {
            const oldVal = oldValues[idx];
            if (newVal !== oldVal) {
              const delta = newVal - oldVal;
              logger.logSystem(
                'state_compass_value_changed',
                {
                  dimension: dim,
                  index: idx,
                  from: oldVal,
                  to: newVal,
                  delta
                },
                `Compass ${dim}[${idx}]: ${oldVal.toFixed(1)} → ${newVal.toFixed(1)} (${delta >= 0 ? '+' : ''}${delta.toFixed(1)})`
              );
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
