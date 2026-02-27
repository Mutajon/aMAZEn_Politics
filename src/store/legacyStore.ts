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
    targetEntity: "people" | "middle" | "mom" | "global";
};

type LegacyState = {
    legacyPoints: number;
    stars: [StarState, StarState, StarState, StarState];
    perkPool: PerkDefinition[];
    activePerks: ActivePerk[];
    reactionMultiplier: number;       // 0.8 / 1.0 / 1.5
    difficultyLevel: "easy" | "normal" | "hard"; // string tracking for Final Score
    pendingStarIndex: number | null;  // Star index awaiting perk selection *currently active*
    queuedPendingStarIndex: number | null; // Earned but waiting for tween
    perkChoices: PerkDefinition[] | null; // 2 random perks to choose from (null if not pending)
    lastLpChange: number;                 // The most recent LP delta applied
    hasStartingBonus: boolean;            // Tracks if starting bonus was collected

    // Actions
    applyDailyChange: (deltas: { people: number; middle: number; mom: number }) => number;
    revealPendingStar: () => void;
    triggerStartingBonus: () => void;
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
            difficultyLevel: "normal",
            pendingStarIndex: null,
            queuedPendingStarIndex: null,
            perkChoices: null,
            lastLpChange: 0,
            hasStartingBonus: false,

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

                // Check perk: "ultimate" — all negatives halved
                const halveAllNegatives = hasPerk(activePerks, "ultimate");
                const ignoreRivalNegatives = hasPerk(activePerks, "ignore_rival_negatives");

                for (const { id, delta } of entityDeltas) {
                    if (delta >= 0) {
                        positiveComponent += delta;
                    } else {
                        // Check if this negative should be modified
                        if (halveAllNegatives) {
                            negativeComponent += (delta / 2);
                        } else if (ignoreRivalNegatives && id === "middle") {
                            // Skip
                        } else {
                            negativeComponent += delta;
                        }
                    }
                }

                // --- Step 3: Apply reaction multiplier to negatives ---
                const scaledNegative = negativeComponent * reactionMultiplier;

                // --- Step 4: Apply perk-based LP modifiers ---
                let lpChange = positiveComponent + scaledNegative;

                // Perk: "ultimate" — all gains doubled (negatives already halved above)
                if (hasPerk(activePerks, "ultimate")) {
                    lpChange = (positiveComponent * 2) + scaledNegative;
                }

                // Perk: "flat_daily_lp" — +3 Legacy Points/day
                if (hasPerk(activePerks, "flat_daily_lp")) {
                    lpChange += 3;
                }

                // Perk: "instant_lp_and_daily_boost" — +2 LP to daily gains (instant +10 applied on activation)
                if (hasPerk(activePerks, "instant_lp_and_daily_boost")) {
                    lpChange += 2;
                }

                // Perk: "conditional_mom_bonus" — +4 Legacy Points/day if Mom > 50%
                if (hasPerk(activePerks, "conditional_mom_bonus")) {
                    const momSupport = useDilemmaStore.getState().supportMom;
                    if (momSupport > 50) {
                        lpChange += 4;
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

                // Prepare perk choices AFTER animation (in revealPendingStar)

                console.log(`[LegacyStore] Daily LP change: ${lpChange >= 0 ? '+' : ''}${lpChange.toFixed(1)} | LP: ${legacyPoints} → ${newLP} | Stars: ${newStars.map(s => s.active ? '★' : '☆').join('')}`);

                set({
                    legacyPoints: Math.round(newLP * 10) / 10, // Round to 1 decimal
                    stars: newStars,
                    queuedPendingStarIndex: newPendingStarIndex, // Wait for tween before activating
                    lastLpChange: Math.round((newLP - legacyPoints) * 10) / 10, // Actual applied delta
                });

                return newLP;
            },

            /**
             * Reveal the star modal after the progress tween completes.
             */
            revealPendingStar() {
                const state = get();
                const { queuedPendingStarIndex, perkPool } = state;

                if (queuedPendingStarIndex === null) return;

                let perkChoices: PerkDefinition[] | null = null;
                if (queuedPendingStarIndex === 3) {
                    perkChoices = [ULTIMATE_PERK];
                } else {
                    perkChoices = pickRandom(perkPool, Math.min(2, perkPool.length));
                }

                set({
                    pendingStarIndex: queuedPendingStarIndex,
                    queuedPendingStarIndex: null,
                    perkChoices,
                });
            },

            /**
             * Trigger the starting bonus perk selection.
             */
            triggerStartingBonus() {
                const state = get();
                const { hasStartingBonus, pendingStarIndex, queuedPendingStarIndex, perkPool } = state;

                // Don't trigger if already got it, or currently selecting a star perk
                if (hasStartingBonus || pendingStarIndex !== null || queuedPendingStarIndex !== null) {
                    return;
                }

                console.log("[LegacyStore] Triggering starting bonus perk selection");
                set({
                    pendingStarIndex: -1, // Use -1 to represent starting bonus
                    perkChoices: pickRandom(perkPool, Math.min(2, perkPool.length)),
                });
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
                    targetEntity: chosenPerk.targetEntity || "global",
                };

                // Remove from pool (standard perks only)
                const newPool = perkPool.filter(p => p.id !== perkId);

                // Mark star as perk-chosen (only if it's a real star, not starting bonus)
                const newStars = [...state.stars] as [StarState, StarState, StarState, StarState];
                if (pendingStarIndex >= 0 && pendingStarIndex < 4) {
                    newStars[pendingStarIndex] = {
                        ...newStars[pendingStarIndex],
                        perkChosen: true,
                    };
                }

                // Retroactive floor perk upgrades (if values are already below the new minimum)
                if (chosenPerk.id === "keep_enemies_closer") {
                    const { supportMiddle, setSupportMiddle } = useDilemmaStore.getState();
                    if (supportMiddle < 20) {
                        console.log(`[LegacyStore] Retroactive perk boost: Middle Support ${supportMiddle} -> 20`);
                        setSupportMiddle(20);
                    }
                } else if (chosenPerk.id === "unconditional_love") {
                    // Mom can't drop below 0: if accidentally negative, fix it
                    const { supportMom, setSupportMom } = useDilemmaStore.getState();
                    if (supportMom < 0) {
                        console.log(`[LegacyStore] Retroactive perk boost: Mom Support ${supportMom} -> 0`);
                        setSupportMom(0);
                    }
                }

                // Apply instant effects
                let lpBonus = 0;
                if (chosenPerk.effectType === "instant_lp_and_daily_boost") {
                    lpBonus = 10; // Instant +10 LP
                }

                const newLP = lpBonus > 0 ? state.legacyPoints + lpBonus : state.legacyPoints;

                // --- NEW: Check for star thresholds again if we got an instant bonus ---
                let finalPendingStarIndex: number | null = null;
                const finalStars = [...newStars] as [StarState, StarState, StarState, StarState];

                if (lpBonus > 0) {
                    for (let i = 0; i < STAR_THRESHOLDS.length; i++) {
                        const threshold = STAR_THRESHOLDS[i];
                        const isNowActive = newLP >= threshold;

                        finalStars[i] = { ...finalStars[i], active: isNowActive };

                        // First time crossing threshold upward
                        if (isNowActive && !finalStars[i].reached) {
                            finalStars[i].reached = true;

                            // Trigger perk selection if not already chosen
                            if (!finalStars[i].perkChosen) {
                                finalPendingStarIndex = i;
                                // Only trigger the FIRST unclaimed star
                                break;
                            }
                        }
                    }
                }

                console.log(`[LegacyStore] ⭐ Perk chosen: ${chosenPerk.id} (${pendingStarIndex === -1 ? "Starting Bonus" : `Star ${pendingStarIndex + 1}`})${lpBonus > 0 ? ` | Instant +${lpBonus} LP` : ''}`);

                set({
                    activePerks: [...activePerks, newActivePerk],
                    perkPool: newPool,
                    stars: finalStars,
                    pendingStarIndex: null,
                    perkChoices: null,
                    legacyPoints: Math.round(newLP * 10) / 10,
                    queuedPendingStarIndex: finalPendingStarIndex, // This will trigger the next reveal in the presenter loop
                    ...(pendingStarIndex === -1 ? { hasStartingBonus: true } : {}),
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
                    difficultyLevel: difficulty,
                    pendingStarIndex: null,
                    queuedPendingStarIndex: null,
                    perkChoices: null,
                    hasStartingBonus: false,
                    lastLpChange: 0,
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
                    difficultyLevel: "normal",
                    pendingStarIndex: null,
                    queuedPendingStarIndex: null,
                    perkChoices: null,
                    hasStartingBonus: false,
                    lastLpChange: 0,
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
                hasStartingBonus: state.hasStartingBonus,
            }),
        }
    )
);
