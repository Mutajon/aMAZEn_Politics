// src/lib/eventDataCleaner.ts
// EventDataCleaner: Handles post-action cleanup and day advancement
//
// Responsibilities:
// - Save player's choice to store
// - Update budget immediately
// - Trigger coin flight animation
// - Wait for animation to complete
// - Fetch and apply compass deltas IMMEDIATELY (Day 2+)
// - Clear coin flights
// - Advance to next day
//
// Used by: EventScreen3 (handleConfirm)
// Dependencies: dilemmaStore, compassStore

import { useDilemmaStore } from "../store/dilemmaStore";
import { useCompassStore } from "../store/compassStore";
import { useSettingsStore } from "../store/settingsStore";
import type { ActionCard } from "../components/event/ActionDeck";
import { fetchCompassHintsForAction, type TrapContext } from "../hooks/useEventDataCollector";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Simple delay utility
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// MAIN CLEANER FUNCTION
// ============================================================================

/**
 * Clean and advance after action confirmation
 *
 * This function handles ALL post-confirmation logic:
 * 1. Saves the player's choice to the store
 * 2. Updates budget immediately (for responsive UI)
 * 3. Waits for coin flight animation to complete (ActionDeck triggers it internally)
 * 4. Clears coin flights
 * 5. Advances to the next day
 *
 * After this completes, EventScreen3 should reset to 'collecting' phase
 * to fetch data for the next day.
 *
 * @param selectedAction - The ActionCard the player confirmed
 * @param clearFlights - Function to clear all coin flight animations
 * @param trapContext - Optional trap context for value-aware compass analysis
 * @returns Promise that resolves when cleanup is complete
 */
export async function cleanAndAdvanceDay(
  selectedAction: ActionCard,
  clearFlights: () => void,
  trapContext?: TrapContext  // NEW: Pass trap context for value-aware compass analysis
): Promise<void> {
  console.log('[Cleaner] Starting cleanup for action:', selectedAction.id, selectedAction.title);

  // ========================================================================
  // STEP 1: Save choice to store (convert ActionCard back to DilemmaAction)
  // ========================================================================
  const { setLastChoice } = useDilemmaStore.getState();

  // Convert ActionCard back to DilemmaAction format for storage
  const actionCost = selectedAction.cost ?? 0;

  const dilemmaAction = {
    id: selectedAction.id as 'a' | 'b' | 'c',
    title: selectedAction.title,
    summary: selectedAction.summary,
    cost: actionCost
  };

  setLastChoice(dilemmaAction);
  console.log('[Cleaner] Choice saved to store:', selectedAction.id);

  // ========================================================================
  // STEP 2: Update budget IMMEDIATELY (for responsive visual feedback)
  // Only apply if budget system is enabled
  // ========================================================================
  const { showBudget } = useSettingsStore.getState();

  if (showBudget) {
    const { budget, setBudget } = useDilemmaStore.getState();
    const newBudget = budget + actionCost;
    setBudget(newBudget);

    const costDisplay = actionCost >= 0 ? `+${actionCost}` : `${actionCost}`;
    console.log(`[Cleaner] Budget updated: ${budget} → ${newBudget} (${costDisplay})`);
  } else {
    console.log('[Cleaner] Budget system disabled - skipping budget update');
  }

  // ========================================================================
  // STEP 2A: Update minimum values tracking (for continuous goals)
  // ========================================================================
  const { selectedGoals, updateMinimumValues } = useDilemmaStore.getState();
  if (selectedGoals.length > 0) {
    updateMinimumValues();
    console.log('[Cleaner] Minimum values updated for goal tracking');
  } else {
    console.log('[Cleaner] No goals selected - skipping minimum value tracking');
  }

  // ========================================================================
  // STEP 3: Wait for coin animation (triggered by ActionDeck internally)
  // ========================================================================
  // Note: ActionDeck's confirmation flow already triggers coin flight
  // We just need to wait for it to complete (1200ms standard duration)
  // Only wait if budget system is enabled (otherwise no animation plays)
  if (showBudget) {
    console.log('[Cleaner] Waiting for coin animation to complete (1200ms)...');
    await delay(1200);
  } else {
    console.log('[Cleaner] Budget disabled - skipping coin animation wait');
  }

  // ========================================================================
  // STEP 3.5: Fetch and apply compass deltas IMMEDIATELY (Day 1+ with gameId)
  // This ensures compass values are updated BEFORE day advances
  // ========================================================================
  const { day, gameId } = useDilemmaStore.getState();

  if (day >= 1 && gameId) {
    console.log('[Cleaner] Fetching compass deltas for current action...');

    try {
      // Fetch compass pills for the action just taken (with trap context for value-aware analysis)
      console.log(`[Cleaner] Fetching compass hints with trapContext: ${trapContext?.valueTargeted || 'none'}`);
      const pills = await fetchCompassHintsForAction(gameId, {
        title: selectedAction.title,
        summary: selectedAction.summary || selectedAction.title
      }, trapContext);

      if (pills.length > 0) {
        console.log(`[Cleaner] Applying ${pills.length} compass deltas immediately`);

        // Apply deltas to compass store RIGHT NOW (while still on Day N)
        const compassStore = useCompassStore.getState();
        const effects = pills.map(pill => ({
          prop: pill.prop,
          idx: pill.idx,
          delta: pill.delta
        }));

        const appliedEffects = compassStore.applyEffects(effects);

        // Log each applied delta
        appliedEffects.forEach(eff => {
          console.log(`[Cleaner] Applied compass delta: ${eff.prop}[${eff.idx}] (${eff.delta >= 0 ? '+' : ''}${eff.delta})`);
        });

        // Store pills in dilemmaStore for visual display (EventScreen3 will show overlay)
        useDilemmaStore.setState({ pendingCompassPills: pills });

        console.log('[Cleaner] Compass deltas applied successfully, pills stored for display');
      } else {
        console.log('[Cleaner] No compass changes detected for this action');
        useDilemmaStore.setState({ pendingCompassPills: null });
      }
    } catch (error) {
      console.error('[Cleaner] ⚠️ Failed to fetch/apply compass deltas:', error);
      // Non-critical error - game continues without compass feedback
      useDilemmaStore.setState({ pendingCompassPills: null });
    }
  } else {
    // No gameId - skip compass pills
    useDilemmaStore.setState({ pendingCompassPills: null });
  }

  // ========================================================================
  // STEP 4: Clear coin flights
  // ========================================================================
  clearFlights();
  console.log('[Cleaner] Coin flights cleared');

  // ========================================================================
  // STEP 5: Add history entry (BEFORE advancing day)
  // ========================================================================
  const { current, day: currentDay, addHistoryEntry } = useDilemmaStore.getState();

  if (current) {
    // Capture support values BEFORE advancing day
    const { supportPeople, supportMiddle, supportMom } = useDilemmaStore.getState();

    addHistoryEntry({
      day: currentDay,
      dilemmaTitle: current.title,
      dilemmaDescription: current.description,
      choiceId: selectedAction.id as 'a' | 'b' | 'c',
      choiceTitle: selectedAction.title,
      choiceSummary: selectedAction.summary,
      supportPeople,
      supportMiddle,
      supportMom,
      topic: current.topic || 'Unknown' // NEW: Store topic for variety tracking
    });
    console.log(`[Cleaner] History entry added for Day ${currentDay}`);
  } else {
    console.warn('[Cleaner] No current dilemma - skipping history entry');
  }

  // ========================================================================
  // STEP 6: Advance to next day
  // ========================================================================
  const { nextDay } = useDilemmaStore.getState();
  nextDay();

  const { day: newDay } = useDilemmaStore.getState();
  console.log(`[Cleaner] Day advanced: ${currentDay} → ${newDay}`);

  // ========================================================================
  // STEP 7: Evaluate goals after day advancement
  // ========================================================================
  const { evaluateGoals } = useDilemmaStore.getState();
  evaluateGoals();
  console.log('[Cleaner] Goals evaluated for day', newDay);

  // ========================================================================
  // DONE - EventScreen3 will detect day change and restart collection
  // ========================================================================
  console.log('[Cleaner] Cleanup complete - ready for next day collection');
}
