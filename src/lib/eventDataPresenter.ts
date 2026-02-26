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
import { useSettingsStore } from "../store/settingsStore";
import { useLegacyStore, hasPerk } from "../store/legacyStore";
import type { CollectedData } from "../hooks/useEventDataCollector";
import type { SupportEffect } from "../hooks/useEventDataCollector";
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

// ============================================================================
// PERK MODIFIER LAYER (Free Play Only)
// ============================================================================

/**
 * Apply active perk modifiers to support deltas BEFORE they reach the store.
 * This modifies the actual support shift values based on earned perks.
 *
 * Perks that modify shifts:
 * - "halve_negative_people": Negative Community shifts halved
 * - "boost_positive_shifts": All positive support shifts +3
 * - "boost_mom_gains": All positive Mom gains ×1.5
 * - "hero_rivalry_halve": If Community liked choice, Rival negative halved
 * - "mom_floor_zero": (applied as post-clamp floor, not delta modification)
 * - "rival_floor_10": (applied as post-clamp floor, not delta modification)
 * - "ultimate": All gains ×2, all negatives ignored
 */
function applyPerkModifiers(effects: SupportEffect[]): SupportEffect[] {
  const { activePerks } = useLegacyStore.getState();
  if (activePerks.length === 0) return effects;

  const isUltimate = hasPerk(activePerks, "ultimate");
  const halveNegPeople = hasPerk(activePerks, "halve_negative_people");
  const boostPositive = hasPerk(activePerks, "boost_positive_shifts");
  const boostMomGains = hasPerk(activePerks, "boost_mom_gains");
  const heroRivalHalve = hasPerk(activePerks, "hero_rivalry_halve");
  const momFloorZero = hasPerk(activePerks, "mom_floor_zero");

  // Check if Community liked the choice (positive delta)
  const communityLiked = effects.find(e => e.id === "people")?.delta ?? 0;
  const communityIsPositive = communityLiked > 0;

  return effects.map(effect => {
    let { delta } = effect;

    if (isUltimate) {
      // Ultimate: double positives, ignore negatives
      delta = delta > 0 ? delta * 2 : 0;
    } else {
      // Standard perk processing
      if (delta < 0) {
        // Negative shift modifiers
        if (effect.id === "people" && halveNegPeople) {
          delta = Math.round(delta / 2);
        }
        if (effect.id === "middle" && heroRivalHalve && communityIsPositive) {
          delta = Math.round(delta / 2);
        }
        if (effect.id === "mom" && momFloorZero) {
          delta = 0; // Prevent negative shift for mom
        }
      } else if (delta > 0) {
        // Positive shift modifiers
        if (boostPositive) {
          delta += 3;
        }
        if (effect.id === "mom" && boostMomGains) {
          delta = Math.round(delta * 1.5);
        }
        if (isUltimate) {
          delta *= 2;
        }
      }
    }

    return { ...effect, delta };
  });
}

/**
 * Apply support deltas to the dilemmaStore.
 * In Free Play mode, perks are applied first and Legacy Bar is updated after.
 */
function applySupportDeltas(supportEffects: CollectedData['supportEffects']): void {
  if (!supportEffects || supportEffects.length === 0) return;

  const { isFreePlay } = useSettingsStore.getState();
  const store = useDilemmaStore.getState();

  // In Free Play, apply perk modifiers to the deltas first
  const modifiedEffects = isFreePlay ? applyPerkModifiers(supportEffects) : supportEffects;

  modifiedEffects.forEach(effect => {
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
    let newValue = Math.max(0, Math.min(100, currentValue + delta));

    // Perk floor effects (Free Play)
    if (isFreePlay) {
      const { activePerks } = useLegacyStore.getState();

      // "mom_floor_zero": Mom support can't drop below 0 (already enforced by clamp, but semantic)
      // "rival_floor_10": Rival support can't drop below 10%
      if (id === "middle" && hasPerk(activePerks, "rival_floor_10")) {
        newValue = Math.max(10, newValue);
      }
    }

    console.log(`[Presenter] Applying support delta: ${id} ${currentValue} → ${newValue} (${delta >= 0 ? '+' : ''}${delta})${isFreePlay ? ' [FP]' : ''}`);
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
  await delay(1500); // Standard wait to let user see initial support values

  // ========== STEP 2: Support Changes Animation (Day 2+ only) ==========
  if (!isFirstDay && collectedData.supportEffects && collectedData.supportEffects.length > 0) {
    console.log(`[Presenter] 📊 Day ${day}: Applying support shifts...`, collectedData.supportEffects);

    // Apply deltas to store FIRST - updates global state
    applySupportDeltas(collectedData.supportEffects);

    // Small delay to ensure Zustand store updates propagate
    await delay(50);

    // Advance step to 2 - triggers EventScreen3 re-render with animated counters
    setPresentationStep(2);

    // ========== LEGACY UPDATE (CONCURRENT) ==========
    // We now fire this AT THE SAME TIME as support shifts start counting up
    const { isFreePlay } = useSettingsStore.getState();
    if (isFreePlay) {
      const modifiedEffects = applyPerkModifiers(collectedData.supportEffects);
      const lpDeltas = { people: 0, middle: 0, mom: 0 };

      modifiedEffects.forEach(effect => {
        if (effect.id === "people" || effect.id === "middle" || effect.id === "mom") {
          lpDeltas[effect.id] = effect.delta;
        }
      });

      console.log(`[Presenter] 🏆 Day ${day}: Triggering Legacy progress sync with support shifts`, lpDeltas);
      useLegacyStore.getState().applyDailyChange(lpDeltas);
    }

    // Wait for animations to complete (counter, delta pill, trend arrow, note text)
    // Support count-up takes ~1000ms, Legacy tween takes 2000ms.
    // We wait for the longer one (Legacy) to finish before proceeding to perk checks.
    await delay(2500);

    // ========== PERK REVEAL (SEQUENTIAL) ==========
    if (isFreePlay) {
      // Reveal the perk selection modal if a star was earned
      const hasQueuedStar = useLegacyStore.getState().queuedPendingStarIndex !== null;
      if (hasQueuedStar) {
        console.log(`[Presenter] ⭐ Star threshold reached! Revealing perk modal...`);
        useLegacyStore.getState().revealPendingStar();

        // Wait for user to pick a perk before continuing
        while (useLegacyStore.getState().pendingStarIndex !== null) {
          await delay(250);
        }
      }
    }
  } else if (!isFirstDay) {
    console.warn(`[Presenter] ⚠️ Day ${day}: Missing support effects or supportEffects empty`, collectedData);
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
  const { isFreePlay } = useSettingsStore.getState();

  // Helper function to translate holder name (standard roles)
  const translateChallengerName = (name: string): string => {
    // 1. If name is already a likely translation key (uppercase with underscores), try translating it directly
    if (/^[A-Z0-9_]+$/.test(name)) {
      const directTranslation = lang(name);
      if (directTranslation !== name) return directTranslation;
    }

    // 2. Check all predefined role translations for a matching holder name
    for (const roleTranslations of Object.values(POWER_DISTRIBUTION_TRANSLATIONS)) {
      const holderTranslation = roleTranslations.holders[name];
      if (holderTranslation) return lang(holderTranslation.name);
    }

    return name;
  };

  // Get dynamic entity info for Free Play
  let populationInfo = { name: lang("SUPPORT_THE_PEOPLE"), icon: "👥" };
  let oppositionInfo = { name: lang("COUNCIL"), icon: "🏛️" };

  if (isFreePlay && analysis?.holders && analysis.holders.length >= 3) {
    // In Free Play Lobby: [0]=Player, [1]=Opposition, [2]=Population
    const oppHolder = analysis.holders[1];
    const popHolder = analysis.holders[2];

    if (oppHolder) {
      oppositionInfo = {
        name: oppHolder.name,
        icon: oppHolder.icon || "🏛️"
      };
    }
    if (popHolder) {
      populationInfo = {
        name: popHolder.name,
        icon: popHolder.icon || "👥"
      };
    }
  } else {
    // Normal assess/experiment flow
    const challengerSeat = analysis?.challengerSeat;
    if (challengerSeat) {
      oppositionInfo = {
        name: translateChallengerName(challengerSeat.name),
        icon: "🏛️"
      };
    }
  }

  // Show deltas only after Step 2 (presentationStep >= 2)
  const showDeltas = presentationStep >= 2;
  const rawSupportEffects = showDeltas && collectedData?.supportEffects ? collectedData.supportEffects : null;
  const supportEffects = rawSupportEffects && isFreePlay ? applyPerkModifiers(rawSupportEffects) : rawSupportEffects;

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
  const peopleEffect = getEffectData("people");
  const middleEffect = getEffectData("middle");
  const momEffect = getEffectData("mom");

  const allItems = [
    {
      id: "people",
      name: populationInfo.name,
      percent: supportPeople,
      initialPercent: initialValues?.people,
      delta: peopleEffect.delta,
      trend: peopleEffect.trend,
      note: peopleEffect.note,
      icon: populationInfo.icon as any,
      accentClass: "bg-emerald-600",
      moodVariant: "civic" as const,
    },
    {
      id: "middle",
      name: oppositionInfo.name,
      percent: supportMiddle,
      initialPercent: initialValues?.middle,
      delta: middleEffect.delta,
      trend: middleEffect.trend,
      note: middleEffect.note,
      icon: oppositionInfo.icon as any,
      accentClass: "bg-amber-600",
      moodVariant: "civic" as const,
    },
    {
      id: "mom",
      name: (isFreePlay && analysis?.momName) ? analysis.momName : lang("MOM"),
      percent: momAlive ? supportMom : 0, // Force 0 if dead
      initialPercent: initialValues?.mom, // Animation starts from this value
      delta: momAlive ? momEffect.delta : null, // No delta if dead
      trend: momAlive ? momEffect.trend : null, // No trend if dead
      note: momAlive ? momEffect.note : null, // No note if dead
      icon: analysis?.momIcon as any, // AI-generated icon for Mom in Free Play
      accentClass: "bg-rose-600",
      moodVariant: "empathetic" as const,
      isDeceased: !momAlive, // NEW: Pass deceased flag to UI
    }
  ];


  return allItems;
}
