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
 * @param onDilemmaRevealed - Optional callback to trigger when dilemma card is shown (e.g., start narration)
 * @returns Promise that resolves when presentation is complete
 */
export async function presentEventData(
  collectedData: CollectedData,
  setPresentationStep: (step: number) => void,
  onDilemmaRevealed?: () => void
): Promise<void> {
  const { day } = useDilemmaStore.getState();
  const isFirstDay = day === 1;

  console.log(`[Presenter] Starting presentation for Day ${day}${isFirstDay ? ' (first day - no analysis)' : ''}`);

  // ========== STEP 0: ResourceBar (always visible) ==========
  setPresentationStep(0);
  console.log("[Presenter] Step 0: ResourceBar");
  await delay(800); // Increased from 300ms - let resource bar settle

  // ========== STEP 1: SupportList (initial values) ==========
  setPresentationStep(1);
  console.log("[Presenter] Step 1: SupportList (initial)");
  await delay(1500); // Increased from 500ms - let user see initial support values

  // ========== STEP 2: Support Changes Animation (Day 2+ only) ==========
  // This step applies support deltas FIRST, then advances presentation step
  // When step advances, SupportList re-renders with new percent values from store
  // SupportList animates counter from old → new values (1000ms RAF animation)
  // Delta pills, trend arrows, and explanation notes appear simultaneously
  if (!isFirstDay && collectedData.supportEffects && collectedData.supportEffects.length > 0) {
    console.log(`[Presenter] Step 2: Support effects found - ${collectedData.supportEffects.length} deltas to apply`);
    console.log("[Presenter] Step 2: Applying support deltas and triggering animation (Day 2+)");

    // 1. Apply deltas to store FIRST - updates global state (supportPeople, supportMiddle, supportMom)
    applySupportDeltas(collectedData.supportEffects);

    // 2. Small delay to ensure Zustand store updates propagate before re-render
    //    Without this, setPresentationStep might trigger re-render before store fully updates
    //    This ensures buildSupportItems() reads fresh values (e.g., 35% instead of 50%)
    await delay(50);

    // 3. Advance step to 2 - triggers EventScreen3 re-render
    //    buildSupportItems() now reads updated values from store + adds delta/trend/note
    //    SupportList receives new percent prop and animates from old → new value
    setPresentationStep(2);

    // 4. Wait for animations to complete:
    //    - Counter animates from old to new percent (1000ms)
    //    - Delta pill scales in (250ms)
    //    - Trend arrow starts bobbing
    //    - Note text appears
    //    Total: 2500ms to see counter animation + read notes
    await delay(2500); // Increased from 1200ms - give user time to see counter animation and read explanation
  } else if (isFirstDay) {
    console.log("[Presenter] Step 2: SKIPPED (Day 1 - no previous choice)");
  } else {
    console.warn(`[Presenter] Step 2: SKIPPED - Missing support effects! Has effects: ${!!collectedData.supportEffects}, Length: ${collectedData.supportEffects?.length || 0}`);
  }

  // ========== STEP 3: NewsTicker ==========
  setPresentationStep(3);
  console.log("[Presenter] Step 3: NewsTicker");
  await delay(2000); // Increased from 800ms - let user read news items

  // ========== STEP 4: PlayerStatusStrip ==========
  setPresentationStep(4);
  console.log("[Presenter] Step 4: PlayerStatusStrip");
  await delay(2000); // Increased from 300ms - let user see dynamic parameters

  // ========== STEP 5: DilemmaCard ==========
  setPresentationStep(5);
  console.log("[Presenter] Step 5: DilemmaCard");

  // Small delay to let DilemmaCard render and animate in
  await delay(300);

  // Trigger narration AFTER the card is visible (EventScreen3 passes startNarrationIfReady)
  if (onDilemmaRevealed) {
    console.log("[Presenter] Triggering dilemma narration");
    onDilemmaRevealed();
  }

  await delay(1200); // Let user start reading dilemma

  // ========== STEP 5A: Compass Pills (Day 2+ only) ==========
  // Pills overlay on top of existing content, no step advancement needed
  if (!isFirstDay && collectedData.compassPills && collectedData.compassPills.length > 0) {
    console.log("[Presenter] Step 5A: Compass pills (Day 2+)");

    // Apply deltas to store
    applyCompassDeltas(collectedData.compassPills);

    // Pills overlay appears automatically via CompassPillsOverlay component
    // No need to advance step - it overlays on top of existing content
    // Wait for pills to appear and auto-collapse (they collapse after 2s)
    await delay(2500); // Increased from 300ms - let user see compass pills
  } else if (isFirstDay) {
    console.log("[Presenter] Step 5A: SKIPPED (Day 1 - no previous choice)");
  }

  // ========== STEP 6: MirrorCard ==========
  setPresentationStep(6);
  console.log("[Presenter] Step 6: MirrorCard");
  await delay(1500); // Increased from 400ms - let user read mirror text

  // ========== STEP 7: ActionDeck (final) ==========
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
  trend?: "up" | "down" | null;
  note?: string | null;
  icon: React.ReactNode;
  accentClass: string;
  moodVariant: "civic" | "empathetic";
}> {
  const { analysis } = useRoleStore.getState();

  // Use snapshot from collectedData (captured BEFORE deltas applied)
  // This shows the "before" values; deltas show change; store has "after" values
  const supportSnapshot = collectedData?.currentSupport || {
    people: 50,
    middle: 50,
    mom: 50
  };

  console.log(`[buildSupportItems] Step: ${presentationStep}, Snapshot values: people=${supportSnapshot.people}, middle=${supportSnapshot.middle}, mom=${supportSnapshot.mom}`);

  // Get middle entity info from analysis
  const playerIndex = typeof analysis?.playerIndex === "number" ? analysis.playerIndex : 0;
  const middleEntity = Array.isArray(analysis?.holders) && analysis.holders.length > playerIndex + 1
    ? analysis.holders[playerIndex + 1]
    : { name: "Council", icon: "🏛️" };

  // Show deltas only after Step 2 (presentationStep >= 2)
  const showDeltas = presentationStep >= 2;
  const supportEffects = showDeltas && collectedData?.supportEffects ? collectedData.supportEffects : null;

  // Helper to get effect data for an entity
  const getEffectData = (id: string) => {
    const effect = supportEffects?.find(e => e.id === id);
    return {
      delta: effect?.delta || null,
      trend: effect && effect.delta > 0 ? "up" as const : effect && effect.delta < 0 ? "down" as const : null,
      note: effect?.explain || null,
    };
  };

  // Import icons (these need to be imported at component level, so we'll use React.createElement)
  // For now, return simple structure - EventScreen3 will add icons
  const peopleEffect = getEffectData("people");
  const middleEffect = getEffectData("middle");
  const momEffect = getEffectData("mom");

  return [
    {
      id: "people",
      name: "The People",
      percent: supportSnapshot.people + (peopleEffect.delta || 0), // Target = snapshot + delta for animation
      delta: peopleEffect.delta,
      trend: peopleEffect.trend,
      note: peopleEffect.note,
      icon: null as any, // Filled in by EventScreen3
      accentClass: "bg-emerald-600",
      moodVariant: "civic" as const,
    },
    {
      id: "middle",
      name: middleEntity.name,
      percent: supportSnapshot.middle + (middleEffect.delta || 0), // Target = snapshot + delta for animation
      delta: middleEffect.delta,
      trend: middleEffect.trend,
      note: middleEffect.note,
      icon: null as any, // Filled in by EventScreen3
      accentClass: "bg-amber-600",
      moodVariant: "civic" as const,
    },
    {
      id: "mom",
      name: "Mom",
      percent: supportSnapshot.mom + (momEffect.delta || 0), // Target = snapshot + delta for animation
      delta: momEffect.delta,
      trend: momEffect.trend,
      note: momEffect.note,
      icon: null as any, // Filled in by EventScreen3
      accentClass: "bg-rose-600",
      moodVariant: "empathetic" as const,
    }
  ];
}
