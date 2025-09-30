/**
 * CoinFlightSystem.tsx
 *
 * Handles animated coin flight effects between action cards and budget display.
 * Creates portal-based overlay with physics-like arc animations for visual feedback.
 *
 * Used by: ActionDeck.tsx
 * Uses: framer-motion for animations, lucide-react for coin icons
 */

import React from "react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import { Coins } from "lucide-react";

export type Point = { x: number; y: number };
export type CoinFlight = {
  id: number;
  start: Point;
  end: Point;
  count?: number;
  duration?: number;
};

interface CoinFlightOverlayProps {
  flights: CoinFlight[];
  onAllDone: () => void;
}

export function CoinFlightOverlay({ flights, onAllDone }: CoinFlightOverlayProps) {
  // Compute total max duration for auto-dispose
  const maxDuration = Math.max(
    0,
    ...flights.map((f) => (f.duration ?? 0.9) + 0.2) // +max stagger
  );

  React.useEffect(() => {
    const t = setTimeout(onAllDone, (maxDuration + 0.1) * 1000);
    return () => clearTimeout(t);
  }, [flights, onAllDone, maxDuration]);

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      {flights.map((f) => {
        const count = f.count ?? 9;
        const baseDur = f.duration ?? 0.9;
        return Array.from({ length: count }).map((_, i) => {
          const id = `${f.id}-${i}`;
          const dx = f.end.x - f.start.x;
          const dy = f.end.y - f.start.y;
          // Midpoint arc offset
          const midX = f.start.x + dx * 0.5 + (Math.random() * 40 - 20);
          const midY = f.start.y + dy * 0.5 - (Math.random() * 60 + 20);
          const delay = Math.random() * 0.2;
          const dur = baseDur + Math.random() * 0.2;

          return (
            <motion.div
              key={id}
              className="fixed"
              initial={{ x: f.start.x, y: f.start.y, rotate: 0, scale: 0.9, opacity: 0.9 }}
              animate={{
                x: [f.start.x, midX, f.end.x],
                y: [f.start.y, midY, f.end.y],
                rotate: [0, Math.random() * 90 - 45, Math.random() * 30],
                scale: [0.9, 1, 0.9],
                opacity: [0.9, 1, 0.0],
              }}
              transition={{ duration: dur, ease: "easeOut", times: [0, 0.5, 1], delay }}
            >
              <Coins className="w-4 h-4 text-amber-300 drop-shadow-[0_0_6px_rgba(255,200,0,0.35)]" />
            </motion.div>
          );
        });
      })}
    </div>,
    document.body
  );
}

// Utility functions for coin flight system
export function getCenterRect(el: Element | null): Point | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function getBudgetAnchorRect(): Point | null {
  const anchor = document.querySelector('[data-budget-anchor="true"]') as HTMLElement | null;
  return getCenterRect(anchor);
}

// Launch coins + budget update together at the first moment both endpoints are measurable.
// If points aren't ready this frame, retry once on the next frame; otherwise proceed without coins.
export function syncCoinAndBudget(
  getFrom: () => Point | null,
  getTo: () => Point | null,
  launchBudgetUpdate: () => void,
  onTriggerFlight: (from: Point, to: Point) => void,
  debugLog: (...args: any[]) => void
) {
  const attempt = (retries: number) => {
    const from = getFrom();
    const to = getTo();
    if (from && to) {
      onTriggerFlight(from, to);
      launchBudgetUpdate();
    } else if (retries > 0) {
      requestAnimationFrame(() => attempt(retries - 1));
    } else {
      debugLog("coinFlight: skipped (missing points)", { from, to });
      launchBudgetUpdate();
    }
  };
  attempt(1); // try now, then once more next frame if needed
}

// Hook for managing coin flight state
export function useCoinFlights() {
  const [flights, setFlights] = React.useState<CoinFlight[]>([]);
  const flightSeq = React.useRef(1);

  const triggerCoinFlight = React.useCallback((from: Point, to: Point) => {
    const id = flightSeq.current++;
    setFlights((prev) => [...prev, { id, start: from, end: to }]);
  }, []);

  const clearFlights = React.useCallback(() => {
    setFlights([]);
  }, []);

  return {
    flights,
    triggerCoinFlight,
    clearFlights,
  };
}