/**
 * Compass value helpers
 * Utilities for extracting and formatting compass component data
 */

import type { PropKey } from "../data/compass-data";
import { COMPONENTS } from "../data/compass-data";

export type CompassComponentValue = {
  short: string;
  full: string;
  value: number;
  index: number;
};

/**
 * Get top N compass values for a given dimension, sorted by value (highest first)
 * @param values - Array of 10 component values (0-10 scale)
 * @param dimension - The compass dimension (what/whence/how/whither)
 * @param count - Number of top values to return
 * @returns Array of top components with their values, sorted descending
 */
export function getTopCompassValues(
  values: number[],
  dimension: PropKey,
  count: number = 2
): CompassComponentValue[] {
  const components = COMPONENTS[dimension];

  if (!values || values.length !== 10) {
    return [];
  }

  // Create array of component data with values
  const componentData: CompassComponentValue[] = values.map((value, index) => ({
    short: components[index].short,
    full: components[index].full,
    value,
    index,
  }));

  // Sort by value descending, then by index ascending (for stability)
  const sorted = componentData.sort((a, b) => {
    if (b.value !== a.value) {
      return b.value - a.value;
    }
    return a.index - b.index;
  });

  // Filter to only include values > 0, then take top N
  const nonZero = sorted.filter((c) => c.value > 0);

  return nonZero.slice(0, count);
}

/**
 * Get all top values for all four compass dimensions
 * @param compassValues - Complete compass values object with all 4 dimensions
 * @param countPerDimension - Number of top values per dimension
 * @returns Object with top values for each dimension
 */
export function getAllTopCompassValues(
  compassValues: Record<PropKey, number[]>,
  countPerDimension: number = 2
): Record<PropKey, CompassComponentValue[]> {
  const dimensions: PropKey[] = ["what", "whence", "how", "whither"];

  return dimensions.reduce(
    (acc, dimension) => {
      acc[dimension] = getTopCompassValues(
        compassValues[dimension],
        dimension,
        countPerDimension
      );
      return acc;
    },
    {} as Record<PropKey, CompassComponentValue[]>
  );
}
