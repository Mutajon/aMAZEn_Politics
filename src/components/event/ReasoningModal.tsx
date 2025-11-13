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
import { useState, useRef, useEffect } from "react";
import { useTimingLogger } from "../../hooks/useTimingLogger";
import { useLogger } from "../../hooks/useLogger";
import { validateReasoningText } from "../../hooks/useReasoning";
import { useDilemmaStore } from "../../store/dilemmaStore";

// Mirror image constants (matching MirrorCard)
const MIRROR_IMG_SRC = "/assets/images/mirror.png";
const IMG_WIDTH_PX = 65;
const IMG_OPACITY = 0.95;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reasoningText: string) => Promise<void>;
  onSkip?: () => void;
  actionTitle: string;
  actionSummary: string;
  day: number;
  isOptional: boolean;
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
}: Props) {
  const [reasoningText, setReasoningText] = useState("");
  const [showAcknowledgment, setShowAcknowledgment] = useState(false);
  const [validationError, setValidationError] = useState<string>("");

  // Logging hooks
  const timingLogger = useTimingLogger();
  const logger = useLogger();

  // Timing tracker: typing duration
  const typingTimingIdRef = useRef<string | null>(null);
  const modalOpenTimeRef = useRef<number>(0);

  // Validate reasoning text
  const validation = validateReasoningText(reasoningText);
  const canSubmit = validation.isValid && !isSubmitting;

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
      if (typingTimingIdRef.current) {
        timingLogger.cancel(typingTimingIdRef.current);
        typingTimingIdRef.current = null;
      }
      modalOpenTimeRef.current = 0;
    }
  }, [isOpen, timingLogger]);

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

    // Submit reasoning
    await onSubmit(reasoningText);

    // Increment reasoning submission counter for session summary
    const { incrementReasoningCount } = useDilemmaStore.getState();
    incrementReasoningCount();

    // Show acknowledgment
    setShowAcknowledgment(true);

    // Log acknowledgment
    logger.logSystem(
      "reasoning_acknowledgment_shown",
      {
        day,
        actionTitle,
        acknowledgmentText: "Thank you for sharing your thoughts with me.",
      },
      "Static acknowledgment displayed to player"
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
              {/* Mirror Image Icon */}
              <div className="flex-shrink-0">
                <img
                  src={MIRROR_IMG_SRC}
                  alt=""
                  style={{
                    width: `${IMG_WIDTH_PX}px`,
                    opacity: IMG_OPACITY,
                  }}
                  className="select-none"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "Georgia, serif" }}>
                  May I ask, what made you choose that?
                </h2>
                <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Your Decision:</p>
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
                  <textarea
                    value={reasoningText}
                    onChange={(e) => {
                      setReasoningText(e.target.value);
                      setValidationError("");
                    }}
                    onKeyPress={handleKeyPress}
                    placeholder="Explain why you made this decision..."
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
                      <span className="text-white/40">Minimum 10 characters</span>
                    )}
                    <span
                      className={`${
                        reasoningText.length >= 10 ? "text-green-400" : "text-white/40"
                      }`}
                    >
                      {reasoningText.length} characters
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
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        <span>Submit Reasoning</span>
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
                      Skip
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
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-purple-400" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p
                        className="text-white leading-relaxed"
                        style={{ fontFamily: "Georgia, serif", fontSize: "15px" }}
                      >
                        Thank you for sharing your thoughts with me.
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Close Button */}
                <button
                  onClick={handleCloseAfterAcknowledgment}
                  className="w-full px-6 py-3 rounded-lg font-semibold bg-purple-500 hover:bg-purple-400 text-white transition-all duration-200"
                >
                  Continue
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
