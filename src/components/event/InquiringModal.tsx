// src/components/event/InquiringModal.tsx
// Modal for player inquiries about current dilemma (treatment-based feature)
//
// Features:
// - Treatment-gated (fullAutonomy: 2 tokens, semiAutonomy: 1 token, noAutonomy: 0)
// - Shows previous Q&A pairs for current dilemma
// - Text input with validation (5-200 chars, must contain letters)
// - Natural language AI responses (2 sentences max, no jargon)
// - Inquiry history stored in conversation for consequence analysis
// - Credits reset each new dilemma
//
// Connected to:
// - src/hooks/useInquiring.ts: State management and API integration
// - src/store/dilemmaStore.ts: Inquiry history and credit tracking
// - src/data/experimentConfig.ts: Treatment-based token allocation
// - server/index.mjs /api/inquire: Backend endpoint

import { motion, AnimatePresence } from "framer-motion";
import { X, MessageCircle, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTimingLogger } from "../../hooks/useTimingLogger";
import { useLogger } from "../../hooks/useLogger";

type InquiryEntry = {
  question: string;
  answer: string;
  timestamp: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  dilemmaTitle: string;
  dilemmaDescription: string;
  onSubmitInquiry: (question: string) => Promise<void>;
  previousInquiries: InquiryEntry[];
  remainingCredits: number;
  isLoading: boolean;
  latestAnswer: string;
  error: string;
};

/**
 * Validate inquiry question
 * Rules: 5-200 chars, must contain at least 3 letters
 */
function validateQuestion(q: string): { valid: boolean; message: string } {
  const trimmed = q.trim();

  if (trimmed.length < 5) {
    return { valid: false, message: "Question must be at least 5 characters" };
  }

  if (trimmed.length > 200) {
    return { valid: false, message: "Question must be 200 characters or less" };
  }

  const letterCount = (trimmed.match(/[a-zA-Z]/g) || []).length;
  if (letterCount < 3) {
    return { valid: false, message: "Question must contain at least 3 letters" };
  }

  return { valid: true, message: "" };
}

export default function InquiringModal({
  isOpen,
  onClose,
  dilemmaTitle,
  dilemmaDescription,
  onSubmitInquiry,
  previousInquiries,
  remainingCredits,
  isLoading,
  latestAnswer,
  error
}: Props) {
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [showPreviousInquiries, setShowPreviousInquiries] = useState(false);

  // Logging hooks
  const timingLogger = useTimingLogger();
  const logger = useLogger();

  // Timing tracker: typing duration
  const typingTimingIdRef = useRef<string | null>(null);

  const validation = validateQuestion(currentQuestion);
  const canSubmit = validation.valid && remainingCredits > 0 && !isLoading;

  // Start timing when modal opens
  useEffect(() => {
    if (isOpen && !typingTimingIdRef.current) {
      typingTimingIdRef.current = timingLogger.start('inquiry_typing_duration', {
        dilemmaTitle
      });
      logger.log('inquiry_modal_opened', {
        remainingCredits,
        dilemmaTitle
      }, 'User opened inquiry modal');
    }
  }, [isOpen, timingLogger, logger, dilemmaTitle, remainingCredits]);

  // Log when modal closes
  useEffect(() => {
    if (!isOpen && typingTimingIdRef.current) {
      // Cancel timing if closed without submitting
      timingLogger.cancel(typingTimingIdRef.current);
      typingTimingIdRef.current = null;

      logger.log('inquiry_modal_closed', {
        questionLength: currentQuestion.length,
        submitted: false
      }, 'User closed inquiry modal without submitting');
    }
  }, [isOpen, timingLogger, logger, currentQuestion.length]);

  // Log when answer is received
  useEffect(() => {
    if (latestAnswer) {
      logger.logSystem('inquiry_answer_received', {
        answer: latestAnswer,
        answerLength: latestAnswer.length,
        dilemmaTitle
      }, `AI answered inquiry (${latestAnswer.length} chars)`);
    }
  }, [latestAnswer, logger, dilemmaTitle]);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    // End typing timing
    const typingDuration = typingTimingIdRef.current
      ? timingLogger.end(typingTimingIdRef.current, {
          questionLength: currentQuestion.length,
          dilemmaTitle
        })
      : null;

    typingTimingIdRef.current = null;

    // Log inquiry submission
    logger.log('inquiry_submitted', {
      question: currentQuestion,
      questionLength: currentQuestion.length,
      typingDuration,
      remainingCreditsAfter: remainingCredits - 1,
      dilemmaTitle
    }, `User submitted inquiry (${currentQuestion.length} chars, ${typingDuration}ms)`);

    await onSubmitInquiry(currentQuestion);

    // Log answer received (will be logged by next useEffect when latestAnswer changes)

    setCurrentQuestion(""); // Clear input after submission

    // Restart timing for potential next inquiry
    typingTimingIdRef.current = timingLogger.start('inquiry_typing_duration', {
      dilemmaTitle
    });
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
          onClick={onClose}
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
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-white/70" />
            </button>

            {/* Icon and Title */}
            <div className="flex items-start gap-4 pr-12">
              <div className="rounded-2xl bg-yellow-500/10 p-4 text-yellow-500">
                <MessageCircle className="h-8 w-8" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white mb-1">Inquire More</h2>
                <p className="text-sm font-semibold text-white/80 mb-1">{dilemmaTitle}</p>
                <p className="text-xs text-white/60 line-clamp-3">{dilemmaDescription}</p>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Previous Inquiries Section */}
            {previousInquiries.length > 0 && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowPreviousInquiries(!showPreviousInquiries)}
                  className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
                >
                  <span>📜 Previous Inquiries ({previousInquiries.length})</span>
                  <span className="text-xs">{showPreviousInquiries ? "▼" : "▶"}</span>
                </button>

                <AnimatePresence>
                  {showPreviousInquiries && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-3 overflow-hidden"
                    >
                      {previousInquiries.map((inquiry) => (
                        <div
                          key={inquiry.timestamp}
                          className="bg-white/5 rounded-lg p-4 space-y-2 border border-white/10"
                        >
                          <div>
                            <span className="text-xs text-white/50 font-semibold uppercase">Question:</span>
                            <p className="text-sm text-white/80 mt-1">{inquiry.question}</p>
                          </div>
                          <div>
                            <span className="text-xs text-yellow-500/70 font-semibold uppercase">Answer:</span>
                            <p className="text-sm text-white mt-1">{inquiry.answer}</p>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* New Inquiry Section */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-white/80">
                Type your inquiry:
              </label>

              <p className="text-sm text-yellow-400/70 mb-2" dir="rtl">
                אפשר להקליד בעברית
              </p>

              <textarea
                value={currentQuestion}
                onChange={(e) => setCurrentQuestion(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="What would you like to know about this situation?"
                className="w-full h-24 px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all resize-none"
                disabled={isLoading || remainingCredits === 0}
              />

              {/* Validation Feedback */}
              <div className="flex items-center justify-between text-xs">
                {!validation.valid && currentQuestion.length > 0 ? (
                  <span className="text-red-400">{validation.message}</span>
                ) : (
                  <span className="text-white/40">5-200 characters</span>
                )}
                <span className={`${currentQuestion.length > 200 ? 'text-red-400' : 'text-white/40'}`}>
                  {currentQuestion.length}/200
                </span>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`
                  w-full px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2
                  ${canSubmit
                    ? 'bg-yellow-500 hover:bg-yellow-400 text-gray-900 hover:shadow-lg'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'}
                `}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Inquiring...</span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-5 h-5" />
                    <span>
                      Inquire {remainingCredits > 0 && `(${remainingCredits} remaining)`}
                    </span>
                  </>
                )}
              </button>

              {remainingCredits === 0 && (
                <p className="text-xs text-yellow-500/70 text-center">
                  No inquiry credits remaining for this dilemma
                </p>
              )}

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-lg p-3"
                >
                  <p className="text-sm text-red-400">{error}</p>
                </motion.div>
              )}

              {/* Latest Answer Display */}
              {latestAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <span className="text-lg">💡</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-yellow-500 mb-1">Answer:</p>
                      <p className="text-white leading-relaxed">{latestAnswer}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
