// src/components/event/CompassPillsOverlay.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
        <AnimatePresence mode="wait">
          {expanded ? (
            // Expanded stack of pills (clicking any pill collapses)
            <motion.div
              key="pills-expanded"
              className="pointer-events-auto flex flex-col items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {effectPills.map((p, index) => {
                const label = COMPONENTS[p.prop][p.idx]?.short ?? "";
                const bg = (PALETTE as any)[p.prop]?.base ?? "#fff";
                return (
                  <motion.button
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
                    // Staggered spring animation - each pill appears in quick succession
                    initial={{ opacity: 0, scale: 0.3, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 10 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 25,
                      delay: index * 0.08, // 80ms stagger between pills
                    }}
                  >
                    {`${p.delta > 0 ? "+" : ""}${p.delta} ${label}`}
                  </motion.button>
                );
              })}
            </motion.div>
          ) : (
            // Collapsed small "+" button (re-expands) — top-center, aligned with MirrorCard top edge
            <motion.button
              key="pills-collapsed"
              type="button"
              onClick={() => setExpanded(true)}
              className="
                pointer-events-auto
                absolute left-1/2 -translate-x-1/2 -translate-y-1/2
                inline-flex items-center justify-center
                w-7 h-7 rounded-full
                text-white text-sm font-bold
                focus:outline-none
                border border-white/30
              "
              aria-label="Show effects"
              title="Show effects"
              style={{
                // Position at MirrorCard's top edge (accounting for its my-2 margin = 0.5rem = 8px)
                top: "8px",
                // Fallback gradient (in case conic isn't supported)
                background: "linear-gradient(135deg, #ef4444, #3b82f6)",
                // Four quadrants: red, green, blue, yellow
                backgroundImage:
                  "conic-gradient(#ef4444 0 90deg, #10b981 90deg 180deg, #3b82f6 180deg 270deg, #f59e0b 270deg 360deg)",
                boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
              }}
              // Spring animation for collapse button appearance
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{
                type: "spring",
                stiffness: 350,
                damping: 20,
              }}
              // Subtle hover animation
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              +
            </motion.button>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
