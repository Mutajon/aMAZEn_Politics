// src/hooks/useMirrorTop3.ts
/**
 * Custom hook that processes compass values to extract top 3 components per dimension.
 * Used by MirrorScreen to display the player's most prominent political values.
 *
 * Connected files:
 * - Used by: src/screens/MirrorScreen.tsx
 * - Reads from: src/store/compassStore.ts
 * - References: src/data/compass-data.ts (COMPONENTS, PropKey)
 */

import { useMemo } from "react";
import { useCompassStore } from "../store/compassStore";
import { COMPONENTS, PROPERTIES, type PropKey } from "../data/compass-data";

export type Top3Component = {
  idx: number;
  short: string;
  full: string;
  value: number;
};

export type Top3ByDimension = {
  [K in PropKey]: Top3Component[];
};

/**
 * Returns top 3 components for each dimension, sorted by value (descending).
 * If multiple components have the same value, maintains original order.
 */
export function useMirrorTop3(): Top3ByDimension {
  const values = useCompassStore((s) => s.values);

  return useMemo(() => {
    const result = {} as Top3ByDimension;

    // Process each dimension
    (PROPERTIES.map((p) => p.key) as PropKey[]).forEach((propKey) => {
      const componentsForDimension = values[propKey];
      const definitions = COMPONENTS[propKey];

      // Create array of { idx, short, full, value }
      const withMetadata = componentsForDimension.map((val, idx) => ({
        idx,
        short: definitions[idx]?.short ?? "",
        full: definitions[idx]?.full ?? "",
        value: Math.max(0, Math.min(10, Math.round(val))), // clamp to 0-10
      }));

      // Sort by value descending, take top 3
      const sorted = withMetadata
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);

      result[propKey] = sorted;
    });

    return result;
  }, [values]);
}
