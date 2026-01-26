// PostGameQuestionnaireScreen.tsx
// Single-question questionnaire for ideal power distribution after 3 games
// Appears after shard preference selection in DreamScreen
// All sliders start at 0%, followed by reasoning modal, then ThankYouScreen

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X } from "lucide-react";
import { bgStyleSplash } from "../lib/ui";
import { useLang } from "../i18n/lang";
import { useLanguage } from "../i18n/LanguageContext";
import { useQuestionnaireStore } from "../store/questionnaireStore";
import { useLoggingStore } from "../store/loggingStore";
import { useSettingsStore } from "../store/settingsStore";
import { POWER_ENTITIES } from "../data/powerEntities";
import PowerReasoningModal from "../components/PowerReasoningModal";

type Phase = "sliders" | "reasoning";

type PowerHolder = {
  id: string;
  percent: number;
};

export default function PostGameQuestionnaireScreen({ push }: { push: (route: string) => void }) {
  const lang = useLang();
  const { language } = useLanguage();
  const isRTL = language === "he";
  const isMobile = useSettingsStore((s) => s.isMobileDevice);

  // Store
  const {
    setPostGameIdealDistribution,
    setPostGameIdealReasoning,
    markPostGameCompleted,
  } = useQuestionnaireStore();
  const userId = useLoggingStore((s) => s.userId);

  // Local state - all start at 0%
  const [phase, setPhase] = useState<Phase>("sliders");
  const [holders, setHolders] = useState<PowerHolder[]>(() =>
    POWER_ENTITIES.map((e) => ({ id: e.id, percent: 0 }))
  );
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  // Refs for scrolling
  const containerRef = useRef<HTMLDivElement>(null);

  const total = holders.reduce((s, h) => s + h.percent, 0);

  // Handle slider change - only adjust others when total > 100
  const handleSliderChange = useCallback(
    (idx: number, newValue: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(newValue)));

      setHolders((prev) => {
        const newHolders = prev.map((h, i) =>
          i === idx ? { ...h, percent: clamped } : { ...h }
        );

        const newTotal = newHolders.reduce((s, h) => s + h.percent, 0);

        if (newTotal > 100) {
          const excess = newTotal - 100;
          const othersSum = newTotal - clamped;

          if (othersSum > 0) {
            const factor = (othersSum - excess) / othersSum;
            for (let i = 0; i < newHolders.length; i++) {
              if (i !== idx) {
                newHolders[i] = {
                  ...newHolders[i],
                  percent: Math.max(0, Math.round(newHolders[i].percent * factor))
                };
              }
            }

            const finalTotal = newHolders.reduce((s, h) => s + h.percent, 0);
            if (finalTotal !== 100) {
              const diff = 100 - finalTotal;
              for (let i = 0; i < newHolders.length; i++) {
                if (i !== idx && newHolders[i].percent + diff >= 0 && newHolders[i].percent + diff <= 100) {
                  newHolders[i] = { ...newHolders[i], percent: newHolders[i].percent + diff };
                  break;
                }
              }
            }
          }
        }

        return newHolders;
      });
    },
    []
  );

  // Handle next button - show reasoning modal
  const handleNext = async () => {
    if (total !== 100) {
      setShowWarning(true);
      return;
    }

    // Save distribution and show reasoning modal
    setPostGameIdealDistribution(holders.map((h) => h.percent));
    setPhase("reasoning");
  };

  // Handle reasoning submission
  const handleReasoningSubmit = async (text: string) => {
    setPostGameIdealReasoning(text);
    setIsSubmitting(true);

    // Submit to backend
    const entities = POWER_ENTITIES.map((e, i) => ({
      id: e.id,
      name: lang(e.titleKey),
      ideal: holders[i].percent,
    }));

    try {
      const response = await fetch("/api/power-questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          timestamp: Date.now(),
          type: "post-game",
          entities,
          idealReasoning: text,
        }),
      });
      if (!response.ok) {
        console.error("Failed to submit post-game questionnaire:", response.statusText);
      }
    } catch (err) {
      console.error("Error submitting post-game questionnaire:", err);
    }

    markPostGameCompleted();
    setIsSubmitting(false);
    push("/personal-motivations?type=post-game");
  };

  // Tooltip handlers
  const handleTooltipClick = (idx: number) => {
    setActiveTooltip(idx);
  };

  // Build reasoning prompt with emphasis on "should"
  const reasoningPrompt = (
    <>
      {lang("POWER_REASONING_Q2_PROMPT_PART1")}
      <span className="text-yellow-400 font-black">{lang("POWER_REASONING_Q2_PROMPT_EMPHASIS")}</span>
      {lang("POWER_REASONING_Q2_PROMPT_PART2")}
    </>
  );

  return (
    <motion.div
      ref={containerRef}
      className="fixed inset-0 flex flex-col overflow-y-auto"
      style={bgStyleSplash}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Semi-transparent overlay */}
      <div className="fixed inset-0 bg-black/60 pointer-events-none" />

      {/* Content - Limited width on desktop */}
      {phase === "sliders" && (
        <div className="relative z-10 flex flex-col min-h-full px-4 py-6 sm:px-8 w-full md:w-1/2 md:mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6"
          >
            <h1
              className="text-xl sm:text-2xl font-bold text-white mb-3 leading-relaxed"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {lang("POST_GAME_Q_HEADER")}
            </h1>
            <p className="text-sm sm:text-base text-gray-300">
              {lang("POST_GAME_Q_SUBHEADER")}
            </p>
          </motion.div>

          {/* Power Entities List */}
          <div className="flex-1 space-y-3 mb-6">
            {holders.map((holder, idx) => {
              const entity = POWER_ENTITIES[idx];
              if (!entity) return null;

              return (
                <motion.div
                  key={entity.id}
                  initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="bg-white/10 backdrop-blur-sm rounded-lg p-3 sm:p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm sm:text-base">
                        {lang(entity.titleKey)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTooltipClick(idx);
                        }}
                        className="text-gray-400 hover:text-white transition-colors p-1"
                        aria-label="More info"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-white font-bold text-lg min-w-[3rem] text-center">
                      {holder.percent}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={holder.percent}
                    onChange={(e) => handleSliderChange(idx, Number(e.target.value))}
                    className="w-full h-2 accent-violet-500 cursor-pointer"
                    style={{ direction: "ltr" }}
                  />
                </motion.div>
              );
            })}
          </div>

          {/* Total display */}
          <div className="text-center mb-4">
            <span className={`text-sm ${total === 100 ? 'text-green-400' : 'text-gray-400'}`}>
              {lang("POWER_Q_TOTAL_LABEL")}: <span className="text-white font-bold">{total}%</span>
              {total !== 100 && <span className="text-yellow-400 ml-2">({100 - total} {lang("POWER_Q_REMAINING")})</span>}
            </span>
          </div>

          {/* Submit Button */}
          <motion.button
            onClick={handleNext}
            disabled={isSubmitting}
            className={`
              w-full py-4 rounded-lg font-bold text-lg
              bg-violet-600 hover:bg-violet-500 text-white
              transition-colors cursor-pointer
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {lang("POWER_Q_BUTTON_SUBMIT")}
          </motion.button>
        </div>
      )}

      {/* Reasoning Modal */}
      <PowerReasoningModal
        isOpen={phase === "reasoning"}
        onClose={() => { }} // Cannot close without submitting
        onSubmit={handleReasoningSubmit}
        promptText={reasoningPrompt}
        isSubmitting={isSubmitting}
      />

      {/* Tooltip Portal */}
      <AnimatePresence>
        {activeTooltip !== null && POWER_ENTITIES[activeTooltip] && (
          <motion.div
            key={`tooltip-${activeTooltip}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setActiveTooltip(null)}
          >
            <div className="absolute inset-0 bg-black/40" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 bg-gray-900/95 backdrop-blur-sm rounded-lg p-4 border border-white/20 shadow-xl max-w-md w-full"
              dir={isRTL ? "rtl" : "ltr"}
            >
              <button
                onClick={() => setActiveTooltip(null)}
                className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} text-gray-400 hover:text-white p-1`}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-white font-bold mb-2">
                {lang(POWER_ENTITIES[activeTooltip].titleKey)}
              </h3>
              <p className="text-gray-200 text-sm leading-relaxed">
                {lang(POWER_ENTITIES[activeTooltip].descKey)}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Warning Modal - Total must equal 100 */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowWarning(false)}
          >
            <div className="absolute inset-0 bg-black/50" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 bg-gray-800 rounded-lg p-6 border border-white/20 shadow-xl max-w-sm w-full text-center"
              dir={isRTL ? "rtl" : "ltr"}
            >
              <p className="text-white text-lg mb-4">
                {language === "he"
                  ? `הסכום חייב להיות 100 נקודות (כרגע: ${total})`
                  : `Total must equal 100 points (currently: ${total})`}
              </p>
              <button
                onClick={() => setShowWarning(false)}
                className="bg-violet-600 hover:bg-violet-500 text-white font-bold py-2 px-6 rounded-lg transition-colors"
              >
                {lang("OK")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
