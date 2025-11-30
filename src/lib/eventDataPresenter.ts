// src/lib/eventDataPresenter.ts
// EventDataPresenter: Sequentially reveals all collected event data with proper timing
//
// Handles:
// - Progressive revelation (one component at a time)
// - Day 1 vs Day 2+ differences (support analysis)
// - Applying state updates at correct moments
// - Timing and animation coordination
//
// NOTE: Compass deltas are NO LONGER applied here - they're applied in eventDataCleaner.ts
// immediately after action confirmation, before day advancement.
//
// Used by: EventScreen3
// Dependencies: dilemmaStore, useRoleStore

import { useDilemmaStore } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";
import type { CollectedData } from "../hooks/useEventDataCollector";
import { lang } from "../i18n/lang";
import { POWER_DISTRIBUTION_TRANSLATIONS } from "../data/powerDistributionTranslations";

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

    // Skip mom updates if she's dead
    if (id === 'mom' && !store.momAlive) {
      console.log(`[Presenter] Skipping mom delta - Mom is deceased`);
      return;
    }

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
 * REMOVED: applyCompassDeltas() function
 *
 * Compass deltas are now applied in eventDataCleaner.ts (Step 3.5)
 * IMMEDIATELY after action confirmation, BEFORE day advancement.
 *
 * This ensures compass values are updated when pills appear visually,
 * not one day later during the next day's presentation.
 *
 * See: src/lib/eventDataCleaner.ts - Step 3.5
 */

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

  // ========== STEP 0: ResourceBar (always visible) ==========
  setPresentationStep(0);
  await delay(800); // Let resource bar settle

  // ========== STEP 1: SupportList (initial values) ==========
  setPresentationStep(1);
  await delay(1500); // Let user see initial support values

  // ========== STEP 2: Support Changes Animation (Day 2+ only) ==========
  if (!isFirstDay && collectedData.supportEffects && collectedData.supportEffects.length > 0) {
    // Apply deltas to store FIRST - updates global state
    applySupportDeltas(collectedData.supportEffects);

    // Small delay to ensure Zustand store updates propagate
    await delay(50);

    // Advance step to 2 - triggers EventScreen3 re-render with animated counters
    setPresentationStep(2);

    // Wait for animations to complete (counter, delta pill, trend arrow, note text)
    await delay(2500);
  } else if (!isFirstDay) {
    console.warn(`[Presenter] ⚠️ Day ${day}: Missing support effects (expected for Day 2+)`);
  }

  // ========== STEP 3: DynamicParameters (shows immediately with placeholder) ==========
  setPresentationStep(3);
  await delay(0); // No delay - DynamicParameters just needs to mount

  // ========== STEP 4: DilemmaCard ==========
  setPresentationStep(4);
  await delay(300); // Let DilemmaCard render and animate in

  // Trigger narration AFTER the card is visible
  if (onDilemmaRevealed) {
    onDilemmaRevealed();
  }

  await delay(1200); // Let user start reading dilemma

  // ========== STEP 4A: Compass Pills ==========
  // REMOVED - Compass deltas are now applied in eventDataCleaner.ts (Step 3.5)
  // immediately after action confirmation, BEFORE day advancement.
  //
  // Pills are still displayed by EventScreen3 from dilemmaStore.pendingCompassPills,
  // but the compass values are already updated by the time pills appear.
  //
  // This fixes the one-day delay issue where compass values weren't updated
  // until the NEXT day's presentation started.

  // ========== STEP 5: MirrorCard ==========
  setPresentationStep(5);
  await delay(1500); // Let user read mirror text

  // ========== STEP 6: ActionDeck (final) ==========
  setPresentationStep(6);
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
 * @param initialValues - Support values captured at Step 1 (before deltas applied) for animation baseline
 * @returns Array of support items
 */
export function buildSupportItems(
  presentationStep: number,
  collectedData: CollectedData | null,
  initialValues?: { people: number; middle: number; mom: number } | null
): Array<{
  id: string;
  name: string;
  percent: number;
  initialPercent?: number; // NEW: For animation start point (value before delta applied)
  delta?: number | null;
  trend?: "up" | "down" | null;
  note?: string | null;
  icon: React.ReactNode;
  accentClass: string;
  moodVariant: "civic" | "empathetic";
  isDeceased?: boolean; // NEW: True if entity is dead (mom only currently)
}> {
  const { supportPeople, supportMiddle, supportMom, momAlive } = useDilemmaStore.getState();
  const { analysis } = useRoleStore.getState();

  // Helper function to translate challenger seat name
  const translateChallengerName = (name: string): string => {
    // Check all predefined role translations for a matching holder name
    for (const roleTranslations of Object.values(POWER_DISTRIBUTION_TRANSLATIONS)) {
      const holderTranslation = roleTranslations.holders[name];
      if (holderTranslation) {
        return lang(holderTranslation.name);
      }
    }
    // If no translation found, return name as-is (for AI-generated roles)
    return name;
  };

  // Get middle entity info from challenger seat (primary institutional opponent)
  const challengerSeat = analysis?.challengerSeat;
  const middleEntity = challengerSeat
    ? { name: translateChallengerName(challengerSeat.name), icon: "🏛️" } // Translate challenger seat name
    : { name: lang("COUNCIL"), icon: "🏛️" }; // Fallback to generic "Council"

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
      name: lang("SUPPORT_THE_PEOPLE"),
      percent: supportPeople,
      initialPercent: initialValues?.people, // Animation starts from this value
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
      percent: supportMiddle,
      initialPercent: initialValues?.middle, // Animation starts from this value
      delta: middleEffect.delta,
      trend: middleEffect.trend,
      note: middleEffect.note,
      icon: null as any, // Filled in by EventScreen3
      accentClass: "bg-amber-600",
      moodVariant: "civic" as const,
    },
    {
      id: "mom",
      name: lang("MOM"),
      percent: momAlive ? supportMom : 0, // Force 0 if dead
      initialPercent: initialValues?.mom, // Animation starts from this value
      delta: momAlive ? momEffect.delta : null, // No delta if dead
      trend: momAlive ? momEffect.trend : null, // No trend if dead
      note: momAlive ? momEffect.note : null, // No note if dead
      icon: null as any, // Filled in by EventScreen3
      accentClass: "bg-rose-600",
      moodVariant: "empathetic" as const,
      isDeceased: !momAlive, // NEW: Pass deceased flag to UI
    }
  ];
}
