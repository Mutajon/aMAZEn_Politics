// src/components/event/ReasoningModal.tsx
// Modal for reasoning prompts (treatment-based feature)
//
// Features:
// - Treatment-gated (fullAutonomy: 3 mandatory + 2 optional, semiAutonomy: 2 mandatory + 2 optional, noAutonomy: 0)
// - Mandatory prompts: No skip button, must provide valid reasoning
// - Optional prompts: Skip button available
// - Client-side validation (min 10 chars, not gibberish)
// - Static acknowledgment after submission
// - Reasoning stored and sent to AI for future context
//
// Connected to:
// - src/hooks/useReasoning.ts: Schedule logic and validation
// - src/store/dilemmaStore.ts: Reasoning history tracking
// - src/data/experimentConfig.ts: Treatment-based schedule
//
// Design inspired by InquiringModal with MirrorCard styling

import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Loader2 } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { useTimingLogger } from "../../hooks/useTimingLogger";
import { useLogger } from "../../hooks/useLogger";
import { validateReasoningText } from "../../hooks/useReasoning";
import { useDilemmaStore } from "../../store/dilemmaStore";
import { MirrorImage, MirrorReflection } from "../MirrorWithReflection";
import CompassPillsOverlay from "./CompassPillsOverlay";
import type { CompassPill } from "../../hooks/useEventDataCollector";
import type { CompassEffectPing } from "../MiniCompass";
import { lang } from "../../i18n/lang";

// Mirror shimmer effect tunables (matching MirrorQuizScreen)
const MIRROR_SHIMMER_MIN_INTERVAL = 5000;   // 5 seconds minimum
const MIRROR_SHIMMER_MAX_INTERVAL = 10000;  // 10 seconds maximum
const MIRROR_SHIMMER_DURATION = 1500;       // 1.5 second sweep duration
const MIRROR_SHIMMER_COLOR = "rgba(94, 234, 212, 0.6)";  // Cyan/teal, semi-transparent

// Speaker avatar constants
const AVATAR_SIZE_PX = 120; // Sized to show full face and upper body

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reasoningText: string) => Promise<{ pills: CompassPill[]; message: string } | null>;
  onSkip?: () => void;
  actionTitle: string;
  actionSummary: string;
  day: number;
  isOptional: boolean;
  avatarUrl?: string;          // Player avatar URL for mirror reflection
  isSubmitting: boolean;
};

export default function ReasoningModal({
  isOpen,
  onClose,
  onSubmit,
  onSkip,
  actionTitle,
  actionSummary,
  day,
  isOptional,
  isSubmitting,
  avatarUrl,
}: Props) {
  const [reasoningText, setReasoningText] = useState("");
  const [showAcknowledgment, setShowAcknowledgment] = useState(false);
  const [validationError, setValidationError] = useState<string>("");
  const [compassPills, setCompassPills] = useState<CompassPill[]>([]);
  const [thankYouMessage, setThankYouMessage] = useState<string>("");

  // Mirror shimmer state (triggers animation restart)
  const [mirrorShimmerTrigger, setMirrorShimmerTrigger] = useState(0);

  // Logging hooks
  const timingLogger = useTimingLogger();
  const logger = useLogger();

  // Timing tracker: typing duration
  const typingTimingIdRef = useRef<string | null>(null);
  const modalOpenTimeRef = useRef<number>(0);

  // Validate reasoning text
  const validation = validateReasoningText(reasoningText);
  const canSubmit = validation.isValid && !isSubmitting;

  // Stable pill IDs to prevent re-expansion on every render
  // Only regenerate when compassPills actually changes (by reference)
  const stablePillIds = useMemo(() => {
    const timestamp = Date.now();
    return compassPills.map((_, i) => `reasoning-${timestamp}-${i}`);
  }, [compassPills]);

  // Start timing when modal opens
  useEffect(() => {
    if (isOpen && !typingTimingIdRef.current) {
      modalOpenTimeRef.current = Date.now();

      typingTimingIdRef.current = timingLogger.start("reasoning_typing_duration", {
        day,
        actionTitle,
        promptType: isOptional ? "optional" : "mandatory",
      });

      logger.log(
        "reasoning_modal_opened",
        {
          day,
          actionTitle,
          promptType: isOptional ? "optional" : "mandatory",
        },
        `Reasoning modal opened (${isOptional ? "optional" : "mandatory"})`
      );
    }
  }, [isOpen, timingLogger, logger, day, actionTitle, isOptional]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setReasoningText("");
      setShowAcknowledgment(false);
      setValidationError("");
      setCompassPills([]);
      setThankYouMessage("");
      if (typingTimingIdRef.current) {
        timingLogger.cancel(typingTimingIdRef.current);
        typingTimingIdRef.current = null;
      }
      modalOpenTimeRef.current = 0;
    }
  }, [isOpen, timingLogger]);

  // Random interval shimmer effect for mirror image
  useEffect(() => {
    if (!isOpen) return;

    const scheduleNextShimmer = () => {
      const randomInterval =
        MIRROR_SHIMMER_MIN_INTERVAL +
        Math.random() * (MIRROR_SHIMMER_MAX_INTERVAL - MIRROR_SHIMMER_MIN_INTERVAL);

      return setTimeout(() => {
        setMirrorShimmerTrigger(prev => prev + 1);
        scheduleNextShimmer();
      }, randomInterval);
    };

    const timerId = scheduleNextShimmer();
    return () => clearTimeout(timerId);
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    // Validate before submission
    const validation = validateReasoningText(reasoningText);
    if (!validation.isValid) {
      setValidationError(validation.message || "Invalid reasoning text");

      logger.log(
        "reasoning_validation_failed",
        {
          day,
          actionTitle,
          reasoningText: reasoningText.substring(0, 50), // Only log first 50 chars for privacy
          charCount: reasoningText.length,
          reason: validation.reason,
        },
        `Reasoning validation failed: ${validation.reason}`
      );
      return;
    }

    // End typing timing
    const typingDuration = typingTimingIdRef.current
      ? timingLogger.end(typingTimingIdRef.current, {
          charCount: reasoningText.length,
          wordCount: reasoningText.trim().split(/\s+/).length,
        })
      : null;

    typingTimingIdRef.current = null;

    // Store reasoning duration for session summary
    if (typingDuration !== null) {
      const { addReasoningTime } = useDilemmaStore.getState();
      addReasoningTime(typingDuration);
    }

    // Log submission
    logger.log(
      "reasoning_submitted",
      {
        day,
        actionTitle,
        reasoningText,
        charCount: reasoningText.length,
        wordCount: reasoningText.trim().split(/\s+/).length,
        typingDuration,
        promptType: isOptional ? "optional" : "mandatory",
      },
      `Reasoning submitted (${reasoningText.length} chars, ${typingDuration}ms)`
    );

    // Submit reasoning and get pills + message
    const result = await onSubmit(reasoningText);

    // Increment reasoning submission counter for session summary
    const { incrementReasoningCount } = useDilemmaStore.getState();
    incrementReasoningCount();

    // Set pills and message from result
    if (result) {
      setCompassPills(result.pills);
      setThankYouMessage(result.message);

      // Log pills display
      if (result.pills.length > 0) {
        logger.log(
          "reasoning_compass_pills_displayed",
          {
            day,
            actionTitle,
            pillsCount: result.pills.length,
            dimensions: result.pills.map(p => `${p.prop}:${p.idx}`)
          },
          `Compass pills displayed (${result.pills.length} pills)`
        );
      }
    } else {
      // Fallback message if analysis failed
      setThankYouMessage(lang("REASONING_MODAL_THANK_YOU"));
      setCompassPills([]);
    }

    // Show acknowledgment
    setShowAcknowledgment(true);

    // Log acknowledgment
    logger.logSystem(
      "reasoning_acknowledgment_shown",
      {
        day,
        actionTitle,
        acknowledgmentText: thankYouMessage || lang("REASONING_MODAL_THANK_YOU"),
        hasPills: result ? result.pills.length > 0 : false
      },
      "Acknowledgment displayed to player with compass pills"
    );
  };

  const handleSkip = () => {
    if (!isOptional || !onSkip) return;

    // Log skip
    const totalDuration = Date.now() - modalOpenTimeRef.current;

    logger.log(
      "reasoning_skipped",
      {
        day,
        actionTitle,
        promptType: "optional",
      },
      "Player skipped optional reasoning prompt"
    );

    logger.log(
      "reasoning_modal_closed",
      {
        day,
        actionTitle,
        outcome: "skipped",
        totalDuration,
      },
      `Reasoning modal closed (skipped, ${totalDuration}ms)`
    );

    onSkip();
    onClose();
  };

  const handleCloseAfterAcknowledgment = () => {
    const totalDuration = Date.now() - modalOpenTimeRef.current;

    logger.log(
      "reasoning_modal_closed",
      {
        day,
        actionTitle,
        outcome: "submitted",
        totalDuration,
      },
      `Reasoning modal closed (submitted, ${totalDuration}ms)`
    );

    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && canSubmit) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={showAcknowledgment ? handleCloseAfterAcknowledgment : undefined}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative w-full max-w-2xl mx-4 max-h-[85vh] bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-white/20 shadow-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4 border-b border-white/10">
            {/* Close Button (only shown after submission) */}
            {showAcknowledgment && (
              <button
                onClick={handleCloseAfterAcknowledgment}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            )}

            {/* Icon and Title */}
            <div className="flex items-start gap-4">
              {/* Mirror with Avatar Reflection */}
              <div
                className="relative flex-shrink-0"
                style={{ width: AVATAR_SIZE_PX, height: AVATAR_SIZE_PX }}
              >
                {/* Shimmer wrapper - only contains the mirror image */}
                <motion.div
                  key={mirrorShimmerTrigger}
                  className="pointer-events-none select-none"
                  style={{
                    width: AVATAR_SIZE_PX,
                    height: AVATAR_SIZE_PX,
                    opacity: 0.95,
                  }}
                  animate={{
                    filter: [
                      "drop-shadow(0px 0px 0px transparent)",
                      `drop-shadow(-8px -8px 12px ${MIRROR_SHIMMER_COLOR})`,
                      `drop-shadow(0px 0px 16px ${MIRROR_SHIMMER_COLOR})`,
                      `drop-shadow(8px 8px 12px ${MIRROR_SHIMMER_COLOR})`,
                      "drop-shadow(0px 0px 0px transparent)",
                    ],
                  }}
                  transition={{
                    duration: MIRROR_SHIMMER_DURATION / 1000,
                    ease: "easeInOut",
                    times: [0, 0.25, 0.5, 0.75, 1],
                  }}
                >
                  <MirrorImage mirrorSize={AVATAR_SIZE_PX} mirrorAlt="Mystic mirror" />
                </motion.div>

                {/* Reflection overlay - outside shimmer wrapper to avoid filter interference */}
                <MirrorReflection
                  mirrorSize={AVATAR_SIZE_PX}
                  avatarUrl={avatarUrl}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "Georgia, serif" }}>
                  {lang("REASONING_MODAL_TITLE")}
                </h2>
                <p className="text-xs text-white/50 uppercase tracking-wide mb-1">{lang("REASONING_MODAL_YOUR_DECISION")}</p>
                <p className="text-sm font-semibold text-white/90 mb-1">{actionTitle}</p>
                <p className="text-xs text-white/60 line-clamp-3">{actionSummary}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            {!showAcknowledgment ? (
              <>
                {/* Input Section */}
                <div className="space-y-3">
                  <p className="text-sm text-purple-400/70 mb-2" dir="rtl">
                    {lang("REASONING_MODAL_CAN_TYPE_HEBREW")}
                  </p>

                  <textarea
                    value={reasoningText}
                    onChange={(e) => {
                      setReasoningText(e.target.value);
                      setValidationError("");
                      // Ensure cursor stays visible while typing
                      requestAnimationFrame(() => {
                        const pos = e.target.selectionStart;
                        e.target.setSelectionRange(pos, pos);
                      });
                    }}
                    onKeyPress={handleKeyPress}
                    placeholder={lang("REASONING_MODAL_PLACEHOLDER")}
                    className="w-full h-32 px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all resize-none"
                    disabled={isSubmitting}
                    autoFocus
                  />

                  {/* Character Count & Validation */}
                  <div className="flex items-center justify-between text-xs">
                    {validationError ? (
                      <span className="text-red-400">{validationError}</span>
                    ) : !validation.isValid && reasoningText.length > 0 ? (
                      <span className="text-yellow-400">{validation.message}</span>
                    ) : (
                      <span className="text-white/40">{lang("REASONING_MODAL_MIN_CHARS")}</span>
                    )}
                    <span
                      className={`${
                        reasoningText.length >= 10 ? "text-green-400" : "text-white/40"
                      }`}
                    >
                      {reasoningText.length} {lang("REASONING_MODAL_CHARACTERS")}
                    </span>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`
                      w-full px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2
                      ${
                        canSubmit
                          ? "bg-purple-500 hover:bg-purple-400 text-white hover:shadow-lg"
                          : "bg-gray-600 text-gray-400 cursor-not-allowed"
                      }
                    `}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{lang("REASONING_MODAL_SUBMITTING")}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        <span>{lang("REASONING_MODAL_SUBMIT")}</span>
                      </>
                    )}
                  </button>

                  {/* Skip Button (only for optional prompts) */}
                  {isOptional && onSkip && (
                    <button
                      onClick={handleSkip}
                      disabled={isSubmitting}
                      className="w-full px-6 py-2 rounded-lg font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all duration-200"
                    >
                      {lang("REASONING_MODAL_SKIP")}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Acknowledgment Section */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-6"
                >
                  <p
                    className="text-white leading-relaxed italic"
                    style={{ fontFamily: "Georgia, serif", fontSize: "15px" }}
                  >
                    {thankYouMessage || "Thank you for sharing your thoughts with me."}
                  </p>
                </motion.div>

                {/* Compass Pills Display */}
                {compassPills.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
                    className="mt-4"
                  >
                    <CompassPillsOverlay
                      effectPills={compassPills.map((pill, i) => ({
                        id: stablePillIds[i],
                        prop: pill.prop,
                        idx: pill.idx,
                        delta: pill.delta
                      }) as CompassEffectPing)}
                      loading={false}
                      color="purple"
                    />
                  </motion.div>
                )}

                {/* Close Button */}
                <button
                  onClick={handleCloseAfterAcknowledgment}
                  className="w-full px-6 py-3 rounded-lg font-semibold bg-purple-500 hover:bg-purple-400 text-white transition-all duration-200 mt-4"
                >
                  {lang("REASONING_MODAL_CLOSE")}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
