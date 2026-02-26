// src/data/perks.ts
// Perk definitions for the Free Play Legacy Bar system.
//
// Each perk has:
// - id: Unique identifier
// - nameKey / descKey: i18n keys for localized name and description
// - effectType: Discriminated union tag for runtime logic
// - effectParams: Type-safe parameters for the effect
//
// Connected to:
// - src/store/legacyStore.ts: Pool management, activation
// - src/components/event/PerkSelectionOverlay.tsx: UI display
// - src/lib/eventDataPresenter.ts: Shift-modifying perks

// ============================================================================
// TYPES
// ============================================================================

export type PerkEffectType =
    | "mom_floor_zero"           // Mom support can't drop below 0
    | "halve_negative_people"    // Negative Community shifts halved
    | "rival_floor_10"           // Rival support can't drop below 10%
    | "instant_lp_and_daily_boost" // +10 LP now, +2 LP/day
    | "conditional_mom_bonus"    // +3 LP/day if Mom > 50%
    | "flat_daily_lp"            // +5 LP/day
    | "boost_positive_shifts"    // All positive support shifts +3
    | "boost_mom_gains"          // All positive Mom gains x1.5
    | "hero_rivalry_halve"       // If Community liked it, Rival negative halved
    | "ignore_rival_negatives"   // Negative Rival shifts don't subtract from LP
    | "ultimate";                // All gains x2, all negatives ignored

export interface PerkDefinition {
    id: string;
    nameKey: string;
    descKey: string;
    icon: string;
    effectType: PerkEffectType;
    targetEntity: "people" | "middle" | "mom" | "global";
    isUltimate?: boolean;
}

// ============================================================================
// PERK POOL (Stars 1-3: pick 2, choose 1)
// ============================================================================

export const STANDARD_PERKS: PerkDefinition[] = [
    {
        id: "unconditional_love",
        nameKey: "PERK_UNCONDITIONAL_LOVE",
        descKey: "PERK_UNCONDITIONAL_LOVE_DESC",
        icon: "💖",
        effectType: "mom_floor_zero",
        targetEntity: "mom",
    },
    {
        id: "vox_populi",
        nameKey: "PERK_VOX_POPULI",
        descKey: "PERK_VOX_POPULI_DESC",
        icon: "📢",
        effectType: "halve_negative_people",
        targetEntity: "people",
    },
    {
        id: "keep_enemies_closer",
        nameKey: "PERK_KEEP_ENEMIES_CLOSER",
        descKey: "PERK_KEEP_ENEMIES_CLOSER_DESC",
        icon: "🤝",
        effectType: "rival_floor_10",
        targetEntity: "middle",
    },
    {
        id: "early_momentum",
        nameKey: "PERK_EARLY_MOMENTUM",
        descKey: "PERK_EARLY_MOMENTUM_DESC",
        icon: "🚀",
        effectType: "instant_lp_and_daily_boost",
        targetEntity: "global",
    },
    {
        id: "home_cooked_meals",
        nameKey: "PERK_HOME_COOKED_MEALS",
        descKey: "PERK_HOME_COOKED_MEALS_DESC",
        icon: "🍲",
        effectType: "conditional_mom_bonus",
        targetEntity: "mom",
    },
    {
        id: "public_works",
        nameKey: "PERK_PUBLIC_WORKS",
        descKey: "PERK_PUBLIC_WORKS_DESC",
        icon: "🏗️",
        effectType: "flat_daily_lp",
        targetEntity: "global",
    },
    {
        id: "golden_era",
        nameKey: "PERK_GOLDEN_ERA",
        descKey: "PERK_GOLDEN_ERA_DESC",
        icon: "✨",
        effectType: "boost_positive_shifts",
        targetEntity: "global",
    },
    {
        id: "mother_knows_best",
        nameKey: "PERK_MOTHER_KNOWS_BEST",
        descKey: "PERK_MOTHER_KNOWS_BEST_DESC",
        icon: "👩‍🍳",
        effectType: "boost_mom_gains",
        targetEntity: "mom",
    },
    {
        id: "hero_of_people",
        nameKey: "PERK_HERO_OF_PEOPLE",
        descKey: "PERK_HERO_OF_PEOPLE_DESC",
        icon: "🦸",
        effectType: "hero_rivalry_halve",
        targetEntity: "middle",
    },
    {
        id: "iron_fist",
        nameKey: "PERK_IRON_FIST",
        descKey: "PERK_IRON_FIST_DESC",
        icon: "✊",
        effectType: "ignore_rival_negatives",
        targetEntity: "middle",
    },
];

// ============================================================================
// ULTIMATE PERK (Star 4: auto-granted)
// ============================================================================

export const ULTIMATE_PERK: PerkDefinition = {
    id: "sun_king",
    nameKey: "PERK_SUN_KING",
    descKey: "PERK_SUN_KING_DESC",
    icon: "👑",
    effectType: "ultimate",
    targetEntity: "global",
    isUltimate: true,
};

// ============================================================================
// STAR THRESHOLDS
// ============================================================================

export const STAR_THRESHOLDS = [20, 40, 60, 80] as const;
export const STAR_COUNT = 4;
