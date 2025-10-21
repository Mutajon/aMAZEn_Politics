// src/lib/eventDataCleaner.ts
// EventDataCleaner: Handles post-action cleanup and day advancement
//
// Responsibilities:
// - Save player's choice to store
// - Update budget immediately
// - Trigger coin flight animation
// - Wait for animation to complete
// - Clear coin flights
// - Advance to next day
//
// Used by: EventScreen3 (handleConfirm)
// Dependencies: dilemmaStore

import { useDilemmaStore } from "../store/dilemmaStore";
import { useSettingsStore } from "../store/settingsStore";
import type { ActionCard } from "../components/event/ActionDeck";

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
 * @returns Promise that resolves when cleanup is complete
 */
export async function cleanAndAdvanceDay(
  selectedAction: ActionCard,
  clearFlights: () => void
): Promise<void> {
  console.log('[Cleaner] Starting cleanup for action:', selectedAction.id, selectedAction.title);

  // ========================================================================
  // STEP 1: Save choice to store (convert ActionCard back to DilemmaAction)
  // ========================================================================
  const { setLastChoice } = useDilemmaStore.getState();

  // Convert ActionCard back to DilemmaAction format for storage
  const dilemmaAction = {
    id: selectedAction.id as 'a' | 'b' | 'c',
    title: selectedAction.title,
    summary: selectedAction.summary,
    cost: selectedAction.cost
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
    const newBudget = budget + selectedAction.cost;
    setBudget(newBudget);

    const costDisplay = selectedAction.cost >= 0 ? `+${selectedAction.cost}` : `${selectedAction.cost}`;
    console.log(`[Cleaner] Budget updated: ${budget} → ${newBudget} (${costDisplay})`);
  } else {
    console.log('[Cleaner] Budget system disabled - skipping budget update');
  }

  // ========================================================================
  // STEP 2A: Update minimum values tracking (for continuous goals)
  // ========================================================================
  const { updateMinimumValues } = useDilemmaStore.getState();
  updateMinimumValues();
  console.log('[Cleaner] Minimum values updated for goal tracking');

  // ========================================================================
  // STEP 3: Wait for coin animation (triggered by ActionDeck internally)
  // ========================================================================
  // Note: ActionDeck's confirmation flow already triggers coin flight
  // We just need to wait for it to complete (1200ms standard duration)
  console.log('[Cleaner] Waiting for coin animation to complete (1200ms)...');
  await delay(1200);

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
