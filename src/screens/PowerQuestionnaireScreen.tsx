// PowerQuestionnaireScreen.tsx
// Two-part questionnaire for power distribution perception (Q1: current, Q2: ideal)
// Each question followed by a reasoning modal
// Appears after email confirmation on first login only

import { useState, useCallback, useRef, useEffect } from "react";
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

type QuestionPhase = "q1" | "q1_reasoning" | "q2" | "q2_reasoning";

type PowerHolder = {
  id: string;
  percent: number;
};

export default function PowerQuestionnaireScreen({ push }: { push: (route: string) => void }) {
  const lang = useLang();
  const { language } = useLanguage();
  const isRTL = language === "he";
  const isMobile = useSettingsStore((s) => s.isMobileDevice);

  // Store
  const {
    setCurrentDistribution,
    setCurrentReasoning,
    setIdealDistribution,
    setIdealReasoning,
    markCompleted,
  } = useQuestionnaireStore();
  const userId = useLoggingStore((s) => s.userId);

  // Local state
  const [phase, setPhase] = useState<QuestionPhase>("q1");
  const [q1Holders, setQ1Holders] = useState<PowerHolder[]>(() =>
    POWER_ENTITIES.map((e) => ({ id: e.id, percent: 0 }))
  );
  const [q2Holders, setQ2Holders] = useState<PowerHolder[]>(() =>
    POWER_ENTITIES.map((e) => ({ id: e.id, percent: 0 }))
  );
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [typewriterText, setTypewriterText] = useState("");
  const [typewriterComplete, setTypewriterComplete] = useState(false);

  // Store reasoning text locally before sending to backend
  const [q1ReasoningText, setQ1ReasoningText] = useState<string>("");
  const [q2ReasoningText, setQ2ReasoningText] = useState<string>("");

  // Refs for scrolling
  const containerRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Build full Q2 text for typewriter
  const q2FullText = `${lang("POWER_Q_HEADER_Q2_PART1")}${lang("POWER_Q_HEADER_Q2_SHOULD")}${lang("POWER_Q_HEADER_Q2_PART2")}`;

  // Scroll to top and start typewriter when transitioning to Q2
  useEffect(() => {
    if (phase === "q2") {
      // Scroll to top - use timeout to ensure DOM has updated
      setTimeout(() => {
        topRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
      }, 50);

      // Reset and start typewriter
      setTypewriterText("");
      setTypewriterComplete(false);

      let index = 0;
      const interval = setInterval(() => {
        if (index < q2FullText.length) {
          setTypewriterText(q2FullText.slice(0, index + 1));
          index++;
        } else {
          setTypewriterComplete(true);
          clearInterval(interval);
        }
      }, 30);

      return () => clearInterval(interval);
    }
  }, [phase, q2FullText]);

  // Determine which sliders to show (only for q1 and q2 phases)
  const isSliderPhase = phase === "q1" || phase === "q2";
  const holders = phase === "q1" || phase === "q1_reasoning" ? q1Holders : q2Holders;
  const setHolders = phase === "q1" || phase === "q1_reasoning" ? setQ1Holders : setQ2Holders;
  const total = holders.reduce((s, h) => s + h.percent, 0);

  // Handle slider change - new logic: only adjust others when total > 100
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
    [setHolders]
  );

  // Handle next/submit button
  const handleNext = async () => {
    if (total !== 100) {
      setShowWarning(true);
      return;
    }

    if (phase === "q1") {
      // Save Q1 distribution and show reasoning modal
      setCurrentDistribution(q1Holders.map((h) => h.percent));
      setPhase("q1_reasoning");
    } else if (phase === "q2") {
      // Save Q2 distribution and show reasoning modal
      setIdealDistribution(q2Holders.map((h) => h.percent));
      setPhase("q2_reasoning");
    }
  };

  // Handle Q1 reasoning submission
  const handleQ1ReasoningSubmit = (text: string) => {
    setQ1ReasoningText(text);
    setCurrentReasoning(text);
    setPhase("q2");
  };

  // Handle Q2 reasoning submission
  const handleQ2ReasoningSubmit = async (text: string) => {
    setQ2ReasoningText(text);
    setIdealReasoning(text);

    // Submit everything to backend
    setIsSubmitting(true);

    // Need to use the text directly since state might not update in time
    const entities = POWER_ENTITIES.map((e, i) => ({
      id: e.id,
      name: lang(e.titleKey),
      current: q1Holders[i].percent,
      ideal: q2Holders[i].percent,
    }));

    try {
      const response = await fetch("/api/power-questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          timestamp: Date.now(),
          type: "initial",
          entities,
          currentReasoning: q1ReasoningText,
          idealReasoning: text,
        }),
      });
      if (!response.ok) {
        console.error("Failed to submit questionnaire:", response.statusText);
      }
    } catch (err) {
      console.error("Error submitting questionnaire:", err);
    }

    markCompleted();
    setIsSubmitting(false);
    push("/dream");
  };

  // Tooltip handlers
  const handleTooltipClick = (idx: number) => {
    setActiveTooltip(idx);
  };

  // Build Q1 reasoning prompt
  const q1ReasoningPrompt = (
    <>
      {lang("POWER_REASONING_Q1_PROMPT")}
    </>
  );

  // Build Q2 reasoning prompt with emphasis
  const q2ReasoningPrompt = (
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
      {isSliderPhase && (
        <div className="relative z-10 flex flex-col min-h-full px-4 py-6 sm:px-8 w-full md:w-1/2 md:mx-auto">
          {/* Scroll anchor */}
          <div ref={topRef} />

          {/* Header */}
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6"
          >
            {phase === "q1" ? (
              <>
                <h1 className="text-xl sm:text-2xl font-bold text-white mb-3 leading-relaxed">
                  {lang("POWER_Q_HEADER_Q1")}
                </h1>
                <p className="text-sm sm:text-base text-gray-300">
                  {lang("POWER_Q_SUBHEADER_Q1")}
                </p>
              </>
            ) : (
              <h1 className="text-xl sm:text-2xl font-bold text-white mb-3 leading-relaxed">
                {typewriterComplete ? (
                  <>
                    {lang("POWER_Q_HEADER_Q2_PART1")}
                    <span className="text-yellow-400 font-black">
                      {lang("POWER_Q_HEADER_Q2_SHOULD")}
                    </span>
                    {lang("POWER_Q_HEADER_Q2_PART2")}
                  </>
                ) : (
                  (() => {
                    const part1 = lang("POWER_Q_HEADER_Q2_PART1");
                    const emphWord = lang("POWER_Q_HEADER_Q2_SHOULD");
                    const emphStart = part1.length;
                    const emphEnd = emphStart + emphWord.length;

                    return (
                      <>
                        {typewriterText.slice(0, emphStart)}
                        {typewriterText.length > emphStart && (
                          <span className="text-yellow-400 font-black">
                            {typewriterText.slice(emphStart, Math.min(typewriterText.length, emphEnd))}
                          </span>
                        )}
                        {typewriterText.length > emphEnd && typewriterText.slice(emphEnd)}
                        <span className="animate-pulse">|</span>
                      </>
                    );
                  })()
                )}
              </h1>
            )}
          </motion.div>

          {/* Power Entities List */}
          <div className="flex-1 space-y-3 mb-6">
            {holders.map((holder, idx) => {
              const entity = POWER_ENTITIES[idx];
              if (!entity) return null;

              return (
                <motion.div
                  key={`${phase}-${entity.id}`}
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
                    style={{ direction: isRTL ? "rtl" : "ltr" }}
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

          {/* Next/Submit Button */}
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
            {isSubmitting
              ? "..."
              : phase === "q1"
                ? lang("POWER_Q_BUTTON_NEXT")
                : lang("POWER_Q_BUTTON_SUBMIT")}
          </motion.button>

          {/* Progress indicator */}
          <div className="flex justify-center gap-2 mt-4">
            <div
              className={`w-3 h-3 rounded-full transition-colors ${phase === "q1" ? "bg-violet-500" : "bg-gray-600"
                }`}
            />
            <div
              className={`w-3 h-3 rounded-full transition-colors ${phase === "q2" ? "bg-violet-500" : "bg-gray-600"
                }`}
            />
          </div>
        </div>
      )}

      {/* Q1 Reasoning Modal */}
      <PowerReasoningModal
        isOpen={phase === "q1_reasoning"}
        onClose={() => { }} // Cannot close without submitting
        onSubmit={handleQ1ReasoningSubmit}
        promptText={q1ReasoningPrompt}
        isSubmitting={false}
      />

      {/* Q2 Reasoning Modal */}
      <PowerReasoningModal
        isOpen={phase === "q2_reasoning"}
        onClose={() => { }} // Cannot close without submitting
        onSubmit={handleQ2ReasoningSubmit}
        promptText={q2ReasoningPrompt}
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
