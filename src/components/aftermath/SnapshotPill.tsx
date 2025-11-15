// src/components/aftermath/SnapshotPill.tsx
// Individual pill for displaying extreme events in the Snapshot section
//
// Connects to:
// - src/components/aftermath/SnapshotSection.tsx: renders array of these pills
// - src/lib/aftermath.ts: SnapshotEvent type definition

import { motion } from "framer-motion";
import type { SnapshotEvent } from "../../lib/aftermath";

type Props = {
  event: SnapshotEvent;
  delay: number; // Stagger delay for animation
};

/**
 * Single snapshot pill showing an extreme event from the player's reign.
 * - Color-coded: green for positive, red for negative
 * - Shows emoji icon + text + optional estimate
 * - Tooltip on hover showing context (which decision caused it)
 */
export default function SnapshotPill({ event, delay }: Props) {
  const isPositive = event.type === "positive";

  // Color scheme based on event type
  const bgColor = isPositive ? "#10b981" : "#ef4444"; // emerald-500 or red-500
  const borderColor = isPositive ? "#059669" : "#dc2626"; // emerald-600 or red-600

  // Format estimate if present (e.g., "12,000" or "340,000")
  const estimateText = event.estimate
    ? ` ${event.estimate.toLocaleString()}`
    : "";

  return (
    <motion.div
      className="relative group"
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay,
        type: "spring",
        stiffness: 300,
        damping: 25
      }}
    >
      <div
        className="px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-lg flex items-center gap-1.5 whitespace-nowrap"
        style={{
          backgroundColor: bgColor,
          border: `1.5px solid ${borderColor}`,
          boxShadow: "0 4px 12px rgba(0,0,0,0.25)"
        }}
      >
        <span className="text-sm">{event.icon}</span>
        <span>
          {event.text}{estimateText}
        </span>
      </div>

      {/* Tooltip showing context on hover */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded shadow-lg whitespace-normal max-w-xs text-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
        {event.context}
      </div>
    </motion.div>
  );
}
