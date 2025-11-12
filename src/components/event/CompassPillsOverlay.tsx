// src/components/event/CompassPillsOverlay.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CompassEffectPing } from "../MiniCompass";
import { COMPONENTS, PALETTE } from "../../data/compass-data";
import { useAudioManager } from "../../hooks/useAudioManager";
import { useLogger } from "../../hooks/useLogger";

type Props = {
  effectPills: CompassEffectPing[];
  loading: boolean;
  color?: string;
};

/** Spinner + stacked pills ABOVE the mirror card.
 *  - Shows pills for ~2s, then collapses to a small "+" button.
 *  - Clicking "+" expands; clicking any pill collapses again.
 *  - Container is pointer-events-none; only controls are clickable.
 *  - Pills animate from/to button position for smooth spatial transitions. */
export default function CompassPillsOverlay({ effectPills, loading, color }: Props) {
  const { playSfx } = useAudioManager();
  const logger = useLogger();

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

    // Play achievement sound when new pills appear
    playSfx('achievement');

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

  // Define button position for animation reference (right edge, vertically centered)
  // This is where pills will animate from/to
  const buttonPosition = { x: 0, y: 0 }; // Relative to container center

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      {loading && (
        <div className="flex items-center justify-center" style={{ color }}>
          <span className="inline-block w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
        </div>
      )}

      {!loading && hasPills && (
        <AnimatePresence mode="popLayout">
          {expanded ? (
            // Expanded stack of pills (clicking any pill collapses)
            <motion.div
              key="pills-expanded"
              className="pointer-events-auto absolute flex flex-col items-center gap-2"
              style={{
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}
            >
              {effectPills.map((p, index) => {
                const label = COMPONENTS[p.prop][p.idx]?.short ?? "";
                const bg = (PALETTE as any)[p.prop]?.base ?? "#fff";

                // Calculate vertical offset for stacked layout
                const stackOffset = (index - effectPills.length / 2 + 0.5) * 32; // 32px per pill (height + gap)

                return (
                  <motion.button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      logger.log('compass_pills_closed', { pillCount: effectPills.length }, 'User collapsed compass pills');
                      setExpanded(false);
                    }}
                    className="rounded-full px-2 py-1 text-xs font-semibold focus:outline-none absolute"
                    style={{
                      background: bg,
                      color: "#0b1335",
                      border: "1.5px solid rgba(255,255,255,0.9)",
                      boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
                      whiteSpace: "nowrap",
                      top: "50%",
                      left: "50%",
                    }}
                    aria-label={`${p.delta > 0 ? "+" : ""}${p.delta} ${label}`}
                    title="Hide"
                    // Burst out from button position → stacked center position
                    initial={{
                      opacity: 0,
                      scale: 0.1,
                      x: buttonPosition.x,
                      y: buttonPosition.y,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      x: -50, // Center horizontally (translate-x-1/2)
                      y: stackOffset - 12, // Stack vertically, adjust for centering
                    }}
                    // Collapse toward button position with reverse stagger (last pill first)
                    exit={{
                      opacity: 0,
                      scale: 0.1,
                      x: buttonPosition.x,
                      y: buttonPosition.y,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 25,
                      delay: expanded ? index * 0.08 : (effectPills.length - index - 1) * 0.06, // Forward stagger on expand, reverse on collapse
                    }}
                  >
                    {`${p.delta > 0 ? "+" : ""}${p.delta} ${label}`}
                  </motion.button>
                );
              })}
            </motion.div>
          ) : (
            // Collapsed small "+" button (re-expands) — right edge, centered vertically
            <motion.button
              key="pills-collapsed"
              type="button"
              onClick={() => {
                logger.log('compass_pills_opened', { pillCount: effectPills.length }, 'User expanded compass pills');
                setExpanded(true);
              }}
              className="
                pointer-events-auto
                absolute top-1/2 -translate-y-1/2 translate-x-1/2
                inline-flex items-center justify-center
                w-7 h-7 rounded-full
                text-white text-sm font-bold
                focus:outline-none
                border border-white/30
              "
              aria-label="Show effects"
              title="Show effects"
              style={{
                // Position at MirrorCard's right edge (centered vertically)
                right: "0px",
                // Fallback gradient (in case conic isn't supported)
                background: "linear-gradient(135deg, #ef4444, #3b82f6)",
                // Four quadrants: red, green, blue, yellow
                backgroundImage:
                  "conic-gradient(#ef4444 0 90deg, #10b981 90deg 180deg, #3b82f6 180deg 270deg, #f59e0b 270deg 360deg)",
                boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
              }}
              // Button appearance with "catching pills" pulse animation
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{
                opacity: 1,
                scale: [0.5, 1.15, 1], // Pulse up briefly when appearing (catching pills)
              }}
              exit={{
                opacity: 0,
                scale: [1, 1.2, 0.5], // Pulse up before disappearing (releasing pills)
              }}
              transition={{
                opacity: { duration: 0.2 },
                scale: {
                  duration: 0.4,
                  times: [0, 0.5, 1],
                  ease: "easeOut",
                },
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
