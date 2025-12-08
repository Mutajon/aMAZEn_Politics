// src/components/PowerReasoningModal.tsx
// Simplified reasoning modal for power distribution questionnaire
// No mirror image, no compass pills - just text input with validation

import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { validateReasoningText } from "../hooks/useReasoning";
import { useLang } from "../i18n/lang";
import { useLanguage } from "../i18n/LanguageContext";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reasoningText: string) => void;
  isSubmitting?: boolean;
  // Prompt can be a simple string or JSX for emphasis
  promptText: React.ReactNode;
};

export default function PowerReasoningModal({
  isOpen,
  onClose: _onClose, // Intentionally unused - modal cannot be closed without submitting
  onSubmit,
  isSubmitting = false,
  promptText,
}: Props) {
  const lang = useLang();
  const { language } = useLanguage();
  const isRTL = language === "he";

  const [reasoningText, setReasoningText] = useState("");
  const [validationError, setValidationError] = useState<string>("");

  // Validate reasoning text
  const validation = validateReasoningText(reasoningText);
  const canSubmit = validation.isValid && !isSubmitting;

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setReasoningText("");
      setValidationError("");
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!canSubmit) return;

    // Validate before submission
    const validation = validateReasoningText(reasoningText);
    if (!validation.isValid) {
      setValidationError(validation.message || "Invalid reasoning text");
      return;
    }

    onSubmit(reasoningText);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.shiftKey && canSubmit) {
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
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative w-full max-w-lg mx-3 sm:mx-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-white/20 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          dir={isRTL ? "rtl" : "ltr"}
        >
          {/* Header */}
          <div className="relative px-4 pt-4 pb-3 md:px-6 md:pt-6 md:pb-4 border-b border-white/10">
            <h2
              className="text-lg md:text-xl font-bold text-white leading-relaxed"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {promptText}
            </h2>
          </div>

          {/* Content */}
          <div className="px-4 py-4 md:px-6 md:py-6 space-y-4">
            {/* Input Section */}
            <div className="space-y-3">
              <textarea
                value={reasoningText}
                onChange={(e) => {
                  setReasoningText(e.target.value);
                  setValidationError("");
                }}
                onKeyPress={handleKeyPress}
                placeholder={lang("POWER_REASONING_PLACEHOLDER")}
                className="w-full h-32 px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all resize-none"
                disabled={isSubmitting}
                autoFocus
                dir={isRTL ? "rtl" : "ltr"}
              />

              {/* Character Count & Validation */}
              <div className="flex items-center justify-between text-xs">
                {validationError ? (
                  <span className="text-red-400">{validationError}</span>
                ) : !validation.isValid && reasoningText.length > 0 ? (
                  <span className="text-yellow-400">{validation.message}</span>
                ) : (
                  <span className="text-white/40">{lang("POWER_REASONING_MIN_CHARS")}</span>
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
                      ? "bg-violet-600 hover:bg-violet-500 text-white hover:shadow-lg cursor-pointer"
                      : "bg-gray-600 text-gray-400 cursor-not-allowed"
                  }
                `}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>{lang("POWER_REASONING_SUBMIT")}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
