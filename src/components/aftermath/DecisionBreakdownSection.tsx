// src/components/aftermath/DecisionBreakdownSection.tsx
// Decision breakdown with expand/collapse functionality
//
// Shows:
// - Collapsed: "Decisions Breakdown" button
// - Expanded: All 7 decisions with title + reflection + per-decision rating pills
//
// Connects to:
// - src/components/aftermath/RatingPill.tsx: per-decision rating pills
// - src/components/aftermath/AftermathContent.tsx: section orchestration

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useDilemmaStore } from "../../store/dilemmaStore";
import { ShieldCheck } from "lucide-react";
import { useLang } from "../../i18n/lang";
import { useLogger } from "../../hooks/useLogger";

const EXPAND_ICON = "▼";
const COLLAPSE_ICON = "▲";

export default function DecisionBreakdownSection() {
  const lang = useLang();
  const logger = useLogger();
  const [expanded, setExpanded] = useState(false);
  const freePlayHistory = useDilemmaStore((s) => s.freePlayHistory);

  const toggleExpand = () => {
    const newState = !expanded;
    setExpanded(newState);

    // Log interaction
    if (newState) {
      logger.log(
        "decision_breakdown_expanded",
        { decisionCount: freePlayHistory.length },
        "User expanded decision breakdown"
      );
    } else {
      logger.log(
        "decision_breakdown_collapsed",
        { decisionCount: freePlayHistory.length },
        "User collapsed decision breakdown"
      );
    }
  };

  return (
    <motion.div
      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header with expand/collapse button */}
      <button
        onClick={toggleExpand}
        className="w-full flex items-center justify-between text-left hover:bg-white/5 rounded-lg p-2 transition-colors"
      >
        <h2 className="text-xl font-bold text-amber-400">
          {lang("DECISIONS_BREAKDOWN")} ({freePlayHistory.length} {lang("DECISIONS")})
        </h2>
        <span className="text-amber-400 text-xl">
          {expanded ? COLLAPSE_ICON : EXPAND_ICON}
        </span>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 max-h-[500px] overflow-y-auto mt-4 pr-2">
              {freePlayHistory.map((decision, i) => (
                <motion.div
                  key={i}
                  className="border-b border-white/5 last:border-b-0 pb-4 last:pb-0"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  {/* Day label */}
                  <p className="text-white/50 text-xs uppercase tracking-wide mb-1">
                    {lang("DAY")} {decision.day}
                  </p>

                  {/* Decision title */}
                  <p className="text-white/95 font-semibold mb-2">
                    {decision.title === "LOBBY_ORIGINAL_SUGGESTION" ? lang(decision.title) : decision.title}
                  </p>

                  {/* Reflection & Description */}
                  {decision.description && (
                    <p className="text-white/60 mb-2 text-[14px] leading-relaxed italic">
                      {decision.description}
                    </p>
                  )}
                  {decision.axisReflection && (
                    <p className="text-green-300/80 mb-3 text-[14px] leading-relaxed my-2 p-3 bg-green-500/10 rounded-md border border-green-500/20">
                      {decision.axisReflection}
                    </p>
                  )}

                  {/* Philosophical Pills */}
                  {decision.pills && decision.pills.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-2">
                      {decision.pills.map((pill, idx) => {
                        const POLE_COLORS: Record<string, string> = {
                          democracy: '#8b5cf6', // purple
                          autonomy: '#06b6d4', // cyan-500
                          totalism: '#ec4899', // pink-500
                          oligarchy: '#6366f1', // indigo-500
                          heteronomy: '#2dd4bf', // teal-400
                          liberalism: '#f43f5e'  // rose-500
                        };
                        const color = POLE_COLORS[pill.toLowerCase()] || '#8b5cf6';
                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
                            style={{
                              backgroundColor: `${color}15`,
                              borderColor: `${color}40`,
                              color: color
                            }}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{lang(`PHILOSOPHICAL_POLE_${pill.toUpperCase()}_TITLE`)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
