// src/hooks/useCompassFX.ts
import { useCallback, useRef, useState } from "react";
import { useCompassStore } from "../store/compassStore";
import type { PropKey } from "../data/compass-data";
import type { CompassEffectPing } from "../components/MiniCompass";

export type FXEffect = { prop: PropKey; idx: number; delta: number };

/**
 * Reusable compass effects helper:
 * - applyWithPings(effects): updates the store and flashes +N pills
 * - flashPings(applied): only show pills (if something else already applied)
 * - pings: pass to <MiniCompass effectPills={pings} />
 * - clear(): hide pills immediately
 */
export function useCompassFX(ttlMs: number = 1200) {
  const applyEffects = useCompassStore((s) => s.applyEffects);
  const [pings, setPings] = useState<CompassEffectPing[]>([]);
  const timerRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPings([]);
  }, []);

  /** Just show pills (no store write). */
  const flashPings = useCallback(
    (effects: FXEffect[]) => {
      clear();
      const batch: CompassEffectPing[] = effects
        .filter((e) => e.delta !== 0)
        .map((e, i) => ({ id: `${Date.now()}-${i}`, prop: e.prop, idx: e.idx, delta: e.delta }));
      if (batch.length) {
        setPings(batch);
        timerRef.current = window.setTimeout(() => setPings([]), ttlMs) as unknown as number;
      }
    },
    [clear, ttlMs]
  );

  /** Apply to store, then show pills for the *actually applied* (clamped) deltas. */
  const applyWithPings = useCallback(
    (effects: FXEffect[]) => {
      const applied = applyEffects(effects);
      flashPings(applied as FXEffect[]);
      return applied;
    },
    [applyEffects, flashPings]
  );

  return { pings, flashPings, applyWithPings, clear };
}

// also export default for convenience
export default useCompassFX;
