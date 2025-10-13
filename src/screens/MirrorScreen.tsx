// src/screens/MirrorScreen.tsx
/**
 * Mirror Screen - displays top 3 compass components for each dimension.
 * Shows player's most prominent political values with animated bars and clickable definitions.
 *
 * Connected files:
 * - Uses: src/hooks/useMirrorTop3.ts (data processing)
 * - Uses: src/data/compass-data.ts (PROPERTIES, PALETTE, PropKey)
 * - Routed from: src/App.tsx (route: /mirror)
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PushFn } from "../lib/router";
import { bgStyle } from "../lib/ui";
import { useMirrorTop3 } from "../hooks/useMirrorTop3";
import { PROPERTIES, PALETTE, type PropKey } from "../data/compass-data";
import {
  hasEventScreenSnapshot,
  getMirrorReturnRoute,
  clearMirrorReturnRoute,
  getAftermathReturnRoute,
  clearAftermathReturnRoute
} from "../lib/eventScreenSnapshot";

const MIRROR_SRC = "/assets/images/mirror.png";

type Props = { push: PushFn };

export default function MirrorScreen({ push }: Props) {
  const top3ByDimension = useMirrorTop3();
  const [selectedDef, setSelectedDef] = useState<{ prop: PropKey; short: string; full: string } | null>(null);

  // Check if we came from EventScreen (snapshot exists), AftermathScreen, or another screen (return route saved)
  const cameFromEvent = hasEventScreenSnapshot();
  const returnRoute = getMirrorReturnRoute();
  const aftermathReturnRoute = getAftermathReturnRoute();

  // Determine back button behavior
  const handleBack = () => {
    if (cameFromEvent) {
      push("/event"); // Will restore snapshot
    } else if (aftermathReturnRoute) {
      clearAftermathReturnRoute();
      // Note: Snapshot will be cleared by AftermathScreen AFTER restoration (line 74)
      push(aftermathReturnRoute); // Return to Aftermath
    } else if (returnRoute) {
      clearMirrorReturnRoute();
      push(returnRoute); // Return to saved route (e.g., /compass-quiz)
    } else {
      window.history.back(); // Fallback
    }
  };

  // Determine back button label
  const getBackButtonLabel = () => {
    if (cameFromEvent) return " to Event";
    if (aftermathReturnRoute) return " to Aftermath";
    if (returnRoute) return " to Quiz";
    return "";
  };

  // Section titles for each dimension
  const sectionTitles: Record<PropKey, string> = {
    what: "Your main motivations:",
    whence: "Your main justifications:",
    how: "Your main means of action:",
    whither: "Who mainly benefits from your actions:",
  };

  return (
    <div className="min-h-[100dvh] px-5 py-8" style={bgStyle}>
      <div className="w-full max-w-2xl mx-auto">
        {/* Back button */}
        <div className="mb-6">
          <button
            className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/20 text-white/90 transition-colors"
            onClick={handleBack}
          >
            ← Back{getBackButtonLabel()}
          </button>
        </div>

        {/* Header with mirror image and text */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-32 h-32 mb-4 rounded-full overflow-hidden shadow-2xl">
            <img
              src={MIRROR_SRC}
              alt="Magic Mirror"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-2xl font-semibold text-white/95 text-center mb-2">
            The magic mirror reflects your inner self.
          </h1>
          <p className="text-base text-white/80 text-center max-w-md">
            Your motivations and values, as they are manifested by your actions.
          </p>
          <p className="text-lg font-medium text-amber-400 italic mt-1">
            The mirror never lies
          </p>
        </div>

        {/* Four sections - one per dimension */}
        <div className="space-y-8">
          {(PROPERTIES.map((p) => p.key) as PropKey[]).map((propKey, sectionIdx) => {
            const components = top3ByDimension[propKey];
            const color = PALETTE[propKey].base;
            const sectionDelay = sectionIdx * 0.15; // stagger sections

            return (
              <motion.div
                key={propKey}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 25,
                  mass: 0.6,
                  delay: sectionDelay,
                }}
                className="rounded-2xl p-5 bg-black/20 backdrop-blur-sm border border-white/10"
                style={{
                  borderLeftWidth: "4px",
                  borderLeftColor: color,
                }}
              >
                {/* Section header */}
                <h2
                  className="text-lg font-semibold mb-4 px-3 py-2 rounded-xl inline-block"
                  style={{
                    backgroundColor: color,
                    color: "#0b1335",
                  }}
                >
                  {sectionTitles[propKey]}
                </h2>

                {/* Top 3 components */}
                <div className="space-y-3">
                  {components.map((comp, barIdx) => {
                    const widthPct = (comp.value / 10) * 100;
                    const barDelay = sectionDelay + barIdx * 0.1; // stagger bars within section

                    return (
                      <motion.button
                        key={comp.idx}
                        onClick={() => setSelectedDef({ prop: propKey, short: comp.short, full: comp.full })}
                        className="w-full text-left"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 200,
                          damping: 25,
                          mass: 0.6,
                          delay: barDelay,
                        }}
                      >
                        {/* Label and value */}
                        <div className="flex items-center justify-between text-sm mb-1.5 px-1">
                          <span className="text-white/90 font-medium">{comp.short}</span>
                          <span className="text-white/70 tabular-nums font-semibold">{comp.value}</span>
                        </div>

                        {/* Animated bar */}
                        <div className="h-6 w-full bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{
                              background: `linear-gradient(90deg, ${PALETTE[propKey].base}, ${PALETTE[propKey].lite})`,
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${widthPct}%` }}
                            transition={{
                              type: "spring",
                              stiffness: 200,
                              damping: 25,
                              mass: 0.6,
                              delay: barDelay + 0.1, // slight extra delay for bar fill
                            }}
                          />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Definition Modal */}
      <AnimatePresence>
        {selectedDef && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setSelectedDef(null)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none"
            >
              <div
                className="bg-black/90 backdrop-blur-md rounded-2xl border-2 p-6 max-w-md w-full pointer-events-auto shadow-2xl"
                style={{
                  borderColor: PALETTE[selectedDef.prop].base,
                }}
              >
                {/* Close button */}
                <div className="flex items-start justify-between mb-3">
                  <h3
                    className="text-xl font-bold"
                    style={{ color: PALETTE[selectedDef.prop].base }}
                  >
                    {selectedDef.short}
                  </h3>
                  <button
                    onClick={() => setSelectedDef(null)}
                    className="text-white/70 hover:text-white text-2xl leading-none px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    ×
                  </button>
                </div>

                {/* Full definition */}
                <p className="text-white/90 text-base leading-relaxed">
                  {selectedDef.full}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
