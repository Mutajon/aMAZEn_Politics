/**
 * Corruption level definitions and helpers
 * Maps normalized corruption scores (0-10) to descriptive tiers with flavor text
 */

export type CorruptionTier = {
  label: string;
  flavor: string;
  color: string;
  maxLevel: number;
};

export const CORRUPTION_TIERS: CorruptionTier[] = [
  {
    label: "Unblemished",
    flavor: "Integrity beyond reproach.",
    color: "#10b981", // emerald-500
    maxLevel: 1,
  },
  {
    label: "Very Low Corruption",
    flavor: "Small stains appear on your virtue.",
    color: "#84cc16", // lime-500
    maxLevel: 2.5,
  },
  {
    label: "Low Corruption",
    flavor: "Rumors of impropriety circulate quietly.",
    color: "#eab308", // yellow-500
    maxLevel: 4.5,
  },
  {
    label: "Corrupted",
    flavor: "The people doubt your honesty.",
    color: "#f97316", // orange-500
    maxLevel: 6.5,
  },
  {
    label: "Very Corrupted",
    flavor: "Your rule reeks of self-interest.",
    color: "#ef4444", // red-500
    maxLevel: 8.5,
  },
  {
    label: "Extremely Corrupt",
    flavor: "Power has devoured your conscience.",
    color: "#991b1b", // red-900
    maxLevel: 10,
  },
];

/**
 * Get corruption tier info based on normalized level (0-10 scale)
 * @param normalizedLevel - Corruption level on 0-10 scale
 * @returns Corruption tier with label, flavor text, and color
 */
export function getCorruptionInfo(normalizedLevel: number): CorruptionTier {
  // Clamp to valid range
  const clamped = Math.max(0, Math.min(10, normalizedLevel));

  // Find matching tier
  const tier = CORRUPTION_TIERS.find((t) => clamped <= t.maxLevel);

  // Fallback to highest tier if somehow not found
  return tier || CORRUPTION_TIERS[CORRUPTION_TIERS.length - 1];
}
