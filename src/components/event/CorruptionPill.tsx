// src/components/event/CorruptionPill.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudioManager } from "../../hooks/useAudioManager";

type Props = {
  delta: number;
  reason: string;
  newLevel: number; // Current corruption level (0-100)
};

/** Single corruption pill displayed to the LEFT of compass pills.
 *  - Purple/magenta for increased corruption (+delta)
 *  - Green/yellow for decreased corruption (-delta)
 *  - Shows pill for ~2s, then collapses to a small "🔸" button.
 *  - Clicking button expands; clicking pill collapses again. */
export default function CorruptionPill({ delta, reason, newLevel: _newLevel }: Props) {
  const { playSfx } = useAudioManager();

  // Track expand/collapse
  const [expanded, setExpanded] = useState<boolean>(true);

  // Auto-collapse ~2s after appearing
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    // New pill: show expanded then collapse after 2s
    setExpanded(true);

    // Play achievement sound when pill appears
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
  }, [delta, reason]); // Re-trigger when corruption changes

  // Styling based on delta
  const isNegative = delta < 0; // Negative = less corrupt (good)

  // Purple/magenta gradient for +corruption, green/yellow for -corruption
  const bgGradient = isNegative
    ? "linear-gradient(135deg, #10b981, #f59e0b)" // Green → Yellow
    : "linear-gradient(135deg, #9333ea, #db2777)"; // Purple → Magenta

  const label = useMemo(() => {
    const sign = delta >= 0 ? "+" : "";
    return `${sign}${delta.toFixed(1)} Corruption`;
  }, [delta]);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <AnimatePresence mode="popLayout">
        {expanded ? (
          // Expanded pill with reason tooltip
          <motion.div
            key="corruption-expanded"
            className="pointer-events-auto absolute"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <motion.button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold focus:outline-none shadow-lg relative group"
              style={{
                background: bgGradient,
                color: "#ffffff",
                border: "1.5px solid rgba(255,255,255,0.9)",
                boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                whiteSpace: "nowrap",
              }}
              aria-label={label}
              title="Hide"
              initial={{ opacity: 0, scale: 0.1, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.1, y: 20 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 25,
              }}
            >
              {label}

              {/* Tooltip showing reason */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-normal max-w-xs text-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                {reason}
              </div>
            </motion.button>
          </motion.div>
        ) : (
          // Collapsed button with corruption icon (🔸)
          <motion.button
            key="corruption-collapsed"
            type="button"
            onClick={() => setExpanded(true)}
            className="
              pointer-events-auto
              absolute top-1/2 -translate-y-1/2 -translate-x-1/2
              inline-flex items-center justify-center
              w-7 h-7 rounded-full
              text-white text-sm font-bold
              focus:outline-none
              border border-white/30
            "
            aria-label="Show corruption"
            title="Show corruption"
            style={{
              // Position at LEFT edge (mirror of compass pills on right)
              left: "0px",
              background: bgGradient,
              boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
              opacity: 1,
              scale: [0.5, 1.15, 1], // Pulse up briefly when appearing
            }}
            exit={{
              opacity: 0,
              scale: [1, 1.2, 0.5], // Pulse up before disappearing
            }}
            transition={{
              opacity: { duration: 0.2 },
              scale: {
                duration: 0.4,
                times: [0, 0.5, 1],
                ease: "easeOut",
              },
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            🔸
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
