// src/components/event/CompassPillsOverlay.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CompassEffectPing } from "../MiniCompass";
import { COMPONENTS, PALETTE } from "../../data/compass-data";

type Props = {
  effectPills: CompassEffectPing[];
  loading: boolean;
  color?: string;
};

/** Spinner + stacked pills ABOVE the mirror card.
 *  - Shows pills for ~2s, then collapses to a small "+" button.
 *  - Clicking "+" expands; clicking any pill collapses again.
 *  - Container is pointer-events-none; only controls are clickable. */
export default function CompassPillsOverlay({ effectPills, loading, color }: Props) {
  // Track expand/collapse
  const [expanded, setExpanded] = useState<boolean>(true);

  // Build a stable key for "new batch" detection
  const batchKey = useMemo(() => effectPills.map((p) => p.id).join("|"), [effectPills]);

  // Auto-collapse ~2s after a new batch appears (when not loading)
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (loading || effectPills.length === 0) {
      // Hide controls when no pills; also clear any timer
      setExpanded(false);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    // New pills: show expanded then collapse after 2s
    setExpanded(true);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setExpanded(false);
      timerRef.current = null;
    }, 2000) as unknown as number;

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [batchKey, loading, effectPills.length]);

  // Nothing to render?
  const hasPills = effectPills.length > 0;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      {loading && (
        <div className="flex items-center justify-center" style={{ color }}>
          <span className="inline-block w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
        </div>
      )}

      {!loading && hasPills && (
        <>
          {expanded ? (
            // Expanded stack of pills (clicking any pill collapses)
            <div className="pointer-events-auto flex flex-col items-center gap-2">
              {effectPills.map((p) => {
                const label = COMPONENTS[p.prop][p.idx]?.short ?? "";
                const bg = (PALETTE as any)[p.prop]?.base ?? "#fff";
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setExpanded(false)}
                    className="rounded-full px-2 py-1 text-xs font-semibold focus:outline-none"
                    style={{
                      background: bg,
                      color: "#0b1335",
                      border: "1.5px solid rgba(255,255,255,0.9)",
                      boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
                      whiteSpace: "nowrap",
                    }}
                    aria-label={`${p.delta > 0 ? "+" : ""}${p.delta} ${label}`}
                    title="Hide"
                  >
                    {`${p.delta > 0 ? "+" : ""}${p.delta} ${label}`}
                  </button>
                );
              })}
            </div>
          ) : (
          // Collapsed small "+" button (re-expands) — top-center, center sits on top edge
<button
  type="button"
  onClick={() => setExpanded(true)}
  className="
    pointer-events-auto
    absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2
    inline-flex items-center justify-center
    w-7 h-7 rounded-full
    text-white text-sm font-bold
    focus:outline-none
    border border-white/30
  "
  aria-label="Show effects"
  title="Show effects"
  style={{
    // Fallback gradient (in case conic isn't supported)
    background: "linear-gradient(135deg, #ef4444, #3b82f6)",
    // Four quadrants: red, green, blue, yellow
    backgroundImage:
      "conic-gradient(#ef4444 0 90deg, #10b981 90deg 180deg, #3b82f6 180deg 270deg, #f59e0b 270deg 360deg)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
  }}
>
  +
</button>

          )}
        </>
      )}
    </div>
  );
}
