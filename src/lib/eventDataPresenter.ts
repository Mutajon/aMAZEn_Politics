// src/lib/eventDataPresenter.ts
// EventDataPresenter: Sequentially reveals all collected event data with proper timing
//
// Handles:
// - Progressive revelation (one component at a time)
// - Day 1 vs Day 2+ differences (support/compass analysis)
// - Applying state updates at correct moments
// - Timing and animation coordination
//
// Used by: EventScreen3
// Dependencies: dilemmaStore, compassStore, useRoleStore

import { useDilemmaStore } from "../store/dilemmaStore";
import { useCompassStore } from "../store/compassStore";
import { useRoleStore } from "../store/roleStore";
import type { CollectedData } from "../hooks/useEventDataCollector";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Simple delay utility
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Capitalize first letter (for building setter names)
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Apply support deltas to the dilemmaStore
 * This is where support values actually change in the global state
 */
function applySupportDeltas(supportEffects: CollectedData['supportEffects']): void {
  if (!supportEffects || supportEffects.length === 0) return;

  const store = useDilemmaStore.getState();

  supportEffects.forEach(effect => {
    const { id, delta } = effect;

    // Get current value and setter
    const currentValue = store[`support${capitalize(id)}` as keyof typeof store] as number;
    const setter = store[`setSupport${capitalize(id)}` as keyof typeof store] as (v: number) => void;

    // Calculate new value (clamped 0-100)
    const newValue = Math.max(0, Math.min(100, currentValue + delta));

    console.log(`[Presenter] Applying support delta: ${id} ${currentValue} → ${newValue} (${delta >= 0 ? '+' : ''}${delta})`);
    setter(newValue);
  });
}

/**
 * Apply compass deltas to the compassStore
 * This is where compass values actually change in the global state
 */
function applyCompassDeltas(compassPills: CollectedData['compassPills']): void {
  if (!compassPills || compassPills.length === 0) return;

  const store = useCompassStore.getState();

  // Convert compassPills to Effect[] format expected by applyEffects
  const effects = compassPills.map(pill => ({
    prop: pill.prop,
    idx: pill.idx,
    delta: pill.delta
  }));

  console.log(`[Presenter] Applying ${effects.length} compass deltas`);

  // Use the store's built-in applyEffects method (handles clamping 0-10)
  const appliedEffects = store.applyEffects(effects);

  // Log each applied delta
  appliedEffects.forEach(eff => {
    console.log(`[Presenter] Applied compass delta: ${eff.prop}[${eff.idx}] (${eff.delta >= 0 ? '+' : ''}${eff.delta})`);
  });
}

// ============================================================================
// MAIN PRESENTER FUNCTION
// ============================================================================

/**
 * Present collected event data sequentially with proper timing
 *
 * @param collectedData - All data collected by EventDataCollector
 * @param setPresentationStep - Callback to update presentation step (controls what's visible)
 * @returns Promise that resolves when presentation is complete
 */
export async function presentEventData(
  collectedData: CollectedData,
  setPresentationStep: (step: number) => void
): Promise<void> {
  const { day } = useDilemmaStore.getState();
  const isFirstDay = day === 1;

  console.log(`[Presenter] Starting presentation for Day ${day}${isFirstDay ? ' (first day - no analysis)' : ''}`);

  // ========== STEP 0: ResourceBar (always visible) ==========
  setPresentationStep(0);
  console.log("[Presenter] Step 0: ResourceBar");
  await delay(300);

  // ========== STEP 1: SupportList (initial values) ==========
  setPresentationStep(1);
  console.log("[Presenter] Step 1: SupportList (initial)");
  await delay(500);

  // ========== STEP 2A: Support Changes (Day 2+ only) ==========
  if (!isFirstDay && collectedData.supportEffects && collectedData.supportEffects.length > 0) {
    console.log("[Presenter] Step 2A: Support changes animation (Day 2+)");

    // Apply deltas to store - this updates the global state
    applySupportDeltas(collectedData.supportEffects);

    // Advance step to trigger re-render with deltas visible
    setPresentationStep(2);

    // Wait for animation to complete
    await delay(1200);
  } else if (isFirstDay) {
    console.log("[Presenter] Step 2A: SKIPPED (Day 1 - no previous choice)");
  }

  // ========== STEP 2/3: NewsTicker ==========
  setPresentationStep(3);
  console.log("[Presenter] Step 3: NewsTicker");
  await delay(800);

  // ========== STEP 3/4: PlayerStatusStrip ==========
  setPresentationStep(4);
  console.log("[Presenter] Step 4: PlayerStatusStrip");
  await delay(300);

  // ========== STEP 4/5: DilemmaCard ==========
  setPresentationStep(5);
  console.log("[Presenter] Step 5: DilemmaCard");
  await delay(500);

  // Note: Narration integration happens in EventScreen3 via useEventNarration
  // The presenter just provides the timing, the component handles narration readiness

  // ========== STEP 4A: Compass Pills (Day 2+ only) ==========
  if (!isFirstDay && collectedData.compassPills && collectedData.compassPills.length > 0) {
    console.log("[Presenter] Step 4A: Compass pills (Day 2+)");

    // Apply deltas to store
    applyCompassDeltas(collectedData.compassPills);

    // Pills overlay appears automatically via CompassPillsOverlay component
    // No need to advance step - it overlays on top of existing content
    // Wait a moment for pills to appear (they auto-collapse after 2s)
    await delay(300);
  } else if (isFirstDay) {
    console.log("[Presenter] Step 4A: SKIPPED (Day 1 - no previous choice)");
  }

  // ========== STEP 5/6: MirrorCard ==========
  setPresentationStep(6);
  console.log("[Presenter] Step 6: MirrorCard");
  await delay(400);

  // ========== STEP 6/7: ActionDeck (final) ==========
  setPresentationStep(7);
  console.log("[Presenter] Step 7: ActionDeck - presentation complete, player can interact");

  // Presentation complete - player can now choose an action
}

// ============================================================================
// SUPPORT ITEMS BUILDER
// ============================================================================

/**
 * Build support items array from current store values
 * Used by EventScreen3 to render SupportList
 *
 * @param presentationStep - Current step (affects whether deltas are shown)
 * @param collectedData - Collected data (for deltas and notes)
 * @returns Array of support items
 */
export function buildSupportItems(
  presentationStep: number,
  collectedData: CollectedData | null
): Array<{
  id: string;
  name: string;
  percent: number;
  delta?: number | null;
  note?: string | null;
  icon: React.ReactNode;
  accentClass: string;
  moodVariant: "civic" | "empathetic";
}> {
  const { supportPeople, supportMiddle, supportMom } = useDilemmaStore.getState();
  const { analysis } = useRoleStore.getState();

  // Get middle entity info from analysis
  const playerIndex = typeof analysis?.playerIndex === "number" ? analysis.playerIndex : 0;
  const middleEntity = Array.isArray(analysis?.holders) && analysis.holders.length > playerIndex + 1
    ? analysis.holders[playerIndex + 1]
    : { name: "Council", icon: "🏛️" };

  // Show deltas only after Step 2A (presentationStep >= 2)
  const showDeltas = presentationStep >= 2;
  const supportEffects = showDeltas && collectedData?.supportEffects ? collectedData.supportEffects : null;

  // Import icons (these need to be imported at component level, so we'll use React.createElement)
  // For now, return simple structure - EventScreen3 will add icons
  return [
    {
      id: "people",
      name: "The People",
      percent: supportPeople,
      delta: supportEffects?.find(e => e.id === "people")?.delta || null,
      note: supportEffects?.find(e => e.id === "people")?.explain || null,
      icon: null as any, // Filled in by EventScreen3
      accentClass: "bg-emerald-600",
      moodVariant: "civic" as const,
    },
    {
      id: "middle",
      name: middleEntity.name,
      percent: supportMiddle,
      delta: supportEffects?.find(e => e.id === "middle")?.delta || null,
      note: supportEffects?.find(e => e.id === "middle")?.explain || null,
      icon: null as any, // Filled in by EventScreen3
      accentClass: "bg-amber-600",
      moodVariant: "civic" as const,
    },
    {
      id: "mom",
      name: "Inner Circle",
      percent: supportMom,
      delta: supportEffects?.find(e => e.id === "mom")?.delta || null,
      note: supportEffects?.find(e => e.id === "mom")?.explain || null,
      icon: null as any, // Filled in by EventScreen3
      accentClass: "bg-rose-600",
      moodVariant: "empathetic" as const,
    }
  ];
}
