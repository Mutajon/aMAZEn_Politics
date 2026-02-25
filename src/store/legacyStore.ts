// src/store/legacyStore.ts
// Legacy Bar store for Free Play mode.
//
// Manages:
// - Legacy Points (LP): Cumulative score from daily support shifts
// - Star milestones: 4 thresholds with perk rewards
// - Perk pool: Available perks that shrink as player picks
// - Active perks: Chosen perks that modify gameplay
// - Difficulty reaction multiplier
//
// Connected to:
// - src/data/perks.ts: Perk definitions and thresholds
// - src/lib/eventDataPresenter.ts: Reads active perks to modify support shifts
// - src/components/event/LegacyStarBar.tsx: UI display
// - src/components/event/PerkSelectionOverlay.tsx: Perk selection UI

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
    STANDARD_PERKS,
    ULTIMATE_PERK,
    STAR_THRESHOLDS,
    type PerkDefinition,
    type PerkEffectType,
} from "../data/perks";
import { useDilemmaStore } from "./dilemmaStore";

// ============================================================================
// TYPES
// ============================================================================

export type StarState = {
    reached: boolean;     // Has threshold been crossed at least once?
    perkChosen: boolean;  // Has player already picked a perk for this star?
    active: boolean;      // Currently at or above threshold?
};

export type ActivePerk = {
    id: string;
    nameKey: string;
    descKey: string;
    icon: string;
    effectType: PerkEffectType;
};

type LegacyState = {
    legacyPoints: number;
    stars: [StarState, StarState, StarState, StarState];
    perkPool: PerkDefinition[];
    activePerks: ActivePerk[];
    reactionMultiplier: number;       // 0.8 / 1.0 / 1.5
    pendingStarIndex: number | null;  // Star index awaiting perk selection
    perkChoices: PerkDefinition[] | null; // 2 random perks to choose from (null if not pending)

    // Actions
    applyDailyChange: (deltas: { people: number; middle: number; mom: number }) => number;
    choosePerk: (perkId: string) => void;
    initForDifficulty: (difficulty: "easy" | "normal" | "hard") => void;
    reset: () => void;
};

// ============================================================================
// HELPERS
// ============================================================================

function createDefaultStars(): [StarState, StarState, StarState, StarState] {
    return [
        { reached: false, perkChosen: false, active: false },
        { reached: false, perkChosen: false, active: false },
        { reached: false, perkChosen: false, active: false },
        { reached: false, perkChosen: false, active: false },
    ];
}

/**
 * Pick N random items from array without replacement.
 * Returns a NEW array (does not mutate input).
 */
function pickRandom<T>(arr: T[], n: number): T[] {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
}

/**
 * Check if a specific perk effect is active.
 */
export function hasPerk(activePerks: ActivePerk[], effectType: PerkEffectType): boolean {
    return activePerks.some(p => p.effectType === effectType);
}

/**
 * Get the active perk for a specific effect type, if any.
 */
export function getActivePerk(activePerks: ActivePerk[], effectType: PerkEffectType): ActivePerk | undefined {
    return activePerks.find(p => p.effectType === effectType);
}

// ============================================================================
// STORE
// ============================================================================

export const useLegacyStore = create<LegacyState>()(
    persist(
        (set, get) => ({
            legacyPoints: 0,
            stars: createDefaultStars(),
            perkPool: [...STANDARD_PERKS],
            activePerks: [],
            reactionMultiplier: 1.0,
            pendingStarIndex: null,
            perkChoices: null,

            /**
             * Apply the daily support change to the Legacy Bar.
             *
             * Flow:
             * 1. Sum all 3 entity deltas
             * 2. Separate into positive and negative components
             * 3. Apply reactionMultiplier to negative component only
             * 4. Apply perk-based LP modifiers
             * 5. Update LP (floor at 0)
             * 6. Check star thresholds
             *
             * @returns The new LP value
             */
            applyDailyChange(deltas) {
                const state = get();
                const { activePerks, reactionMultiplier, legacyPoints, stars } = state;


                // --- Step 2: Separate positive / negative ---
                let positiveComponent = 0;
                let negativeComponent = 0;

                // Per-entity separation for perk logic
                const entityDeltas = [
                    { id: "people" as const, delta: deltas.people },
                    { id: "middle" as const, delta: deltas.middle },
                    { id: "mom" as const, delta: deltas.mom },
                ];

                // Check perk: "ignore_rival_negatives" — negative Rival shifts don't subtract from LP
                // Check perk: "ultimate" — all negatives ignored
                const ignoreAllNegatives = hasPerk(activePerks, "ultimate");
                const ignoreRivalNegatives = hasPerk(activePerks, "ignore_rival_negatives");

                for (const { id, delta } of entityDeltas) {
                    if (delta >= 0) {
                        positiveComponent += delta;
                    } else {
                        // Check if this negative should be ignored
                        if (ignoreAllNegatives) continue;
                        if (ignoreRivalNegatives && id === "middle") continue;
                        negativeComponent += delta; // delta is already negative
                    }
                }

                // --- Step 3: Apply reaction multiplier to negatives ---
                const scaledNegative = negativeComponent * reactionMultiplier;

                // --- Step 4: Apply perk-based LP modifiers ---
                let lpChange = positiveComponent + scaledNegative;

                // Perk: "ultimate" — all gains doubled
                if (hasPerk(activePerks, "ultimate")) {
                    lpChange = positiveComponent * 2; // negatives already ignored above
                }

                // Perk: "flat_daily_lp" — +5 LP/day
                if (hasPerk(activePerks, "flat_daily_lp")) {
                    lpChange += 5;
                }

                // Perk: "instant_lp_and_daily_boost" — +2 LP to daily gains (instant +10 applied on activation)
                if (hasPerk(activePerks, "instant_lp_and_daily_boost")) {
                    lpChange += 2;
                }

                // Perk: "conditional_mom_bonus" — +3 LP/day if Mom > 50%
                if (hasPerk(activePerks, "conditional_mom_bonus")) {
                    const momSupport = useDilemmaStore.getState().supportMom;
                    if (momSupport > 50) {
                        lpChange += 3;
                    }
                }

                // --- Step 5: Update LP (floor at 0) ---
                const newLP = Math.max(0, legacyPoints + lpChange);

                // --- Step 6: Check star thresholds ---
                const newStars = [...stars] as [StarState, StarState, StarState, StarState];
                let newPendingStarIndex: number | null = null;

                for (let i = 0; i < STAR_THRESHOLDS.length; i++) {
                    const threshold = STAR_THRESHOLDS[i];
                    const isNowActive = newLP >= threshold;

                    newStars[i] = { ...newStars[i], active: isNowActive };

                    // First time crossing threshold upward
                    if (isNowActive && !newStars[i].reached) {
                        newStars[i].reached = true;

                        // Trigger perk selection if not already chosen
                        if (!newStars[i].perkChosen) {
                            newPendingStarIndex = i;
                            // Only trigger the FIRST unclaimed star (process one at a time)
                            break;
                        }
                    }
                }

                // Prepare perk choices if a star was earned
                let perkChoices: PerkDefinition[] | null = null;
                if (newPendingStarIndex !== null) {
                    if (newPendingStarIndex === 3) {
                        // Star 4 — ultimate perk (auto-granted, but show overlay)
                        perkChoices = [ULTIMATE_PERK];
                    } else {
                        // Stars 1-3 — pick 2 random from pool
                        const pool = get().perkPool;
                        perkChoices = pickRandom(pool, Math.min(2, pool.length));
                    }
                }

                console.log(`[LegacyStore] Daily LP change: ${lpChange >= 0 ? '+' : ''}${lpChange.toFixed(1)} | LP: ${legacyPoints} → ${newLP} | Stars: ${newStars.map(s => s.active ? '★' : '☆').join('')}`);

                set({
                    legacyPoints: Math.round(newLP * 10) / 10, // Round to 1 decimal
                    stars: newStars,
                    pendingStarIndex: newPendingStarIndex,
                    perkChoices,
                });

                return newLP;
            },

            /**
             * Player chooses a perk from the presented options.
             * Removes it from pool and adds to active perks.
             */
            choosePerk(perkId) {
                const state = get();
                const { pendingStarIndex, perkPool, activePerks, perkChoices } = state;

                if (pendingStarIndex === null) {
                    console.warn("[LegacyStore] choosePerk called with no pending star");
                    return;
                }

                // Find the chosen perk
                let chosenPerk: PerkDefinition | undefined;

                if (pendingStarIndex === 3) {
                    // Star 4 — ultimate
                    chosenPerk = ULTIMATE_PERK;
                } else {
                    chosenPerk = perkChoices?.find(p => p.id === perkId);
                }

                if (!chosenPerk) {
                    console.error("[LegacyStore] Perk not found:", perkId);
                    return;
                }

                // Activate the perk
                const newActivePerk: ActivePerk = {
                    id: chosenPerk.id,
                    nameKey: chosenPerk.nameKey,
                    descKey: chosenPerk.descKey,
                    icon: chosenPerk.icon,
                    effectType: chosenPerk.effectType,
                };

                // Remove from pool (standard perks only)
                const newPool = perkPool.filter(p => p.id !== perkId);

                // Mark star as perk-chosen
                const newStars = [...state.stars] as [StarState, StarState, StarState, StarState];
                newStars[pendingStarIndex] = {
                    ...newStars[pendingStarIndex],
                    perkChosen: true,
                };

                // Apply instant effects
                let lpBonus = 0;
                if (chosenPerk.effectType === "instant_lp_and_daily_boost") {
                    lpBonus = 10; // Instant +10 LP
                }

                console.log(`[LegacyStore] ⭐ Perk chosen: ${chosenPerk.id} (Star ${pendingStarIndex + 1})${lpBonus > 0 ? ` | Instant +${lpBonus} LP` : ''}`);

                set({
                    activePerks: [...activePerks, newActivePerk],
                    perkPool: newPool,
                    stars: newStars,
                    pendingStarIndex: null,
                    perkChoices: null,
                    legacyPoints: lpBonus > 0 ? state.legacyPoints + lpBonus : state.legacyPoints,
                });
            },

            /**
             * Initialize the legacy system for a new Free Play game.
             */
            initForDifficulty(difficulty) {
                const multipliers = {
                    easy: 0.8,
                    normal: 1.0,
                    hard: 1.5,
                };

                console.log(`[LegacyStore] Initialized for difficulty: ${difficulty} (multiplier: ${multipliers[difficulty]})`);

                set({
                    legacyPoints: 0,
                    stars: createDefaultStars(),
                    perkPool: [...STANDARD_PERKS],
                    activePerks: [],
                    reactionMultiplier: multipliers[difficulty] ?? 1.0,
                    pendingStarIndex: null,
                    perkChoices: null,
                });
            },

            /**
             * Full reset (called on game end / new game).
             */
            reset() {
                console.log("[LegacyStore] Reset");
                set({
                    legacyPoints: 0,
                    stars: createDefaultStars(),
                    perkPool: [...STANDARD_PERKS],
                    activePerks: [],
                    reactionMultiplier: 1.0,
                    pendingStarIndex: null,
                    perkChoices: null,
                });
            },
        }),
        {
            name: "amaze-politics-legacy-v1",
            partialize: (state) => ({
                legacyPoints: state.legacyPoints,
                stars: state.stars,
                perkPool: state.perkPool,
                activePerks: state.activePerks,
                reactionMultiplier: state.reactionMultiplier,
            }),
        }
    )
);
