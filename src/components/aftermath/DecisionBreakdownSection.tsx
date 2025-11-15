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
import type { DecisionAnalysis } from "../../lib/aftermath";
import RatingPill from "./RatingPill";
import { useLang } from "../../i18n/lang";
import { useLogger } from "../../hooks/useLogger";

type Props = {
  decisions: DecisionAnalysis[];
};

const EXPAND_ICON = "▼";
const COLLAPSE_ICON = "▲";

export default function DecisionBreakdownSection({ decisions }: Props) {
  const lang = useLang();
  const logger = useLogger();
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => {
    const newState = !expanded;
    setExpanded(newState);

    // Log interaction
    if (newState) {
      logger.log(
        "decision_breakdown_expanded",
        { decisionCount: decisions.length },
        "User expanded decision breakdown"
      );
    } else {
      logger.log(
        "decision_breakdown_collapsed",
        { decisionCount: decisions.length },
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
          {lang("DECISIONS_BREAKDOWN")} ({decisions.length} {lang("DECISIONS")})
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
              {decisions.map((decision, i) => (
                <motion.div
                  key={i}
                  className="border-b border-white/5 last:border-b-0 pb-4 last:pb-0"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  {/* Day label */}
                  <p className="text-white/50 text-xs uppercase tracking-wide mb-1">
                    {lang("DAY")} {i + 1}
                  </p>

                  {/* Decision title */}
                  <p className="text-white/95 font-semibold mb-2">
                    {decision.title}
                  </p>

                  {/* Reflection text */}
                  <p className="text-white/70 text-sm mb-3">
                    {decision.reflection}
                  </p>

                  {/* Per-decision rating pills */}
                  <div className="flex gap-2 flex-wrap">
                    <RatingPill mini label="D" rating={decision.democracy} />
                    <RatingPill mini label="A" rating={decision.autonomy} />
                    <RatingPill mini label="L" rating={decision.liberalism} />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
