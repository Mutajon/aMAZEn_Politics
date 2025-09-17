// src/store/compassStore.ts
import { create } from "zustand";
import { COMPONENTS, PROPERTIES, type PropKey } from "../data/compass-data";

/** Values are integers 0..10 per component, per property */
export type CompassValues = Record<PropKey, number[]>;

function emptyValues(): CompassValues {
  const v: CompassValues = { what: [], whence: [], how: [], whither: [] } as any;
  (PROPERTIES.map(p => p.key) as PropKey[]).forEach(k => {
    v[k] = Array(10).fill(0);
  });
  return v;
}

/** Editable rules in one place */
export const VALUE_RULES = {
  strongPositive: +2,
  mildPositive: +1,
  mildNegative: -1,
  strongNegative: -2,
} as const;

type Effect = { prop: PropKey; idx: number; delta: number };

type CompassStore = {
  values: CompassValues;
  reset: () => void;
  /** Set to an exact integer 0..10 */
  setValue: (prop: PropKey, idx: number, value: number) => void;
  /** Apply deltas; clamps to 0..10; returns the actually applied (clamped) deltas */
  applyEffects: (effects: Effect[]) => Effect[];
};

export const useCompassStore = create<CompassStore>((set, get) => ({
  values: emptyValues(),
  reset: () => set({ values: emptyValues() }),
  setValue: (prop, idx, value) =>
    set(state => {
      const next = { ...state.values, [prop]: [...state.values[prop]] };
      next[prop][idx] = Math.max(0, Math.min(10, Math.round(value)));
      return { values: next };
    }),
  applyEffects: (effects) => {
    const applied: Effect[] = [];
    set(state => {
      const next: CompassValues = {
        what: [...state.values.what],
        whence: [...state.values.whence],
        how: [...state.values.how],
        whither: [...state.values.whither],
      };
      for (const eff of effects) {
        const before = next[eff.prop][eff.idx] ?? 0;
        const after = Math.max(0, Math.min(10, Math.round(before + eff.delta)));
        next[eff.prop][eff.idx] = after;
        applied.push({ ...eff, delta: after - before });
      }
      return { values: next };
    });
    return applied;
  },
}));
