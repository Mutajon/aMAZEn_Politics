/**
 * IDCollectionModal.tsx
 *
 * Modal for collecting 9-digit ID number from participants when data logging is enabled.
 * Blocks game start until valid ID is provided.
 *
 * Validation rules:
 * - Exactly 9 digits
 * - Only numeric characters (0-9)
 * - Cannot be same digit repeated 9 times (e.g., 111111111)
 *
 * Used by: SplashScreen.tsx
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "../i18n/lang";

interface IDCollectionModalProps {
  isOpen: boolean;
  onSubmit: (id: string) => void;
}

/**
 * Validate ID number according to rules
 * Returns error key for i18n, or null if valid
 */
function validateID(id: string): string | null {
  const trimmed = id.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return "ID_VALIDATION_EMAIL";
  }

  if (!trimmed.toLowerCase().endsWith("@tau.ac.il")) {
    return "ID_VALIDATION_DOMAIN";
  }

  const localPart = trimmed.split("@")[0];
  const sanitizedLocal = localPart.replace(/[^a-z0-9]/gi, "");

  if (sanitizedLocal.length < 3) {
    return "ID_VALIDATION_LOCAL_LENGTH";
  }

  const uniqueChars = new Set(sanitizedLocal.toLowerCase());
  if (uniqueChars.size < 3) {
    return "ID_VALIDATION_LOCAL_VARIETY";
  }

  return null;
}

export default function IDCollectionModal({
  isOpen,
  onSubmit,
}: IDCollectionModalProps) {
  const lang = useLang();
  const [idInput, setIdInput] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Validate on every change
  useEffect(() => {
    const error = validateID(idInput);
    setValidationError(error);
  }, [idInput]);

  const handleSubmit = () => {
    const trimmed = idInput.trim();
    const error = validateID(trimmed);
    if (error === null && trimmed.length > 0) {
      onSubmit(trimmed);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  const trimmedInput = idInput.trim();
  const isValid = validationError === null && trimmedInput.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop (non-dismissible) */}
          <div className="absolute inset-0 bg-black/70" />

          {/* Modal Content */}
          <motion.div
            className="relative z-10 w-full max-w-md rounded-3xl border border-purple-400/20 bg-gradient-to-b from-[#1b1f3b] to-[#261c4a] p-8 shadow-2xl"
            initial={{ scale: 0.94, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, y: 6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="id-collection-title"
          >
            {/* Header */}
            <div className="mb-6 text-center">
              <div className="mb-2 text-4xl">🔐</div>
              <h2
                id="id-collection-title"
                className="text-2xl font-extrabold bg-gradient-to-r from-purple-200 via-purple-300 to-pink-400 bg-clip-text text-transparent"
              >
                {lang("ID_COLLECTION_TITLE")}
              </h2>
              <p className="text-sm text-white/60 mt-2 leading-relaxed">
                {lang("ID_COLLECTION_DESC")}
              </p>
            </div>

            {/* Input Section */}
            <div className="space-y-4">
              {/* Label */}
              <label
                htmlFor="id-input"
                className="block text-sm font-medium text-white/80"
              >
                {lang("ID_COLLECTION_LABEL")}
              </label>

              {/* Input Field */}
              <input
                ref={inputRef}
                id="id-input"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={idInput}
                onChange={(e) => setIdInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={lang("ID_COLLECTION_PLACEHOLDER")}
                className={[
                  "w-full px-4 py-3 rounded-xl text-base",
                  "bg-white/10 border-2 text-white placeholder-white/30",
                  "focus:outline-none focus:ring-2 focus:ring-purple-400/50",
                  "transition-colors",
                  validationError
                    ? "border-red-400/50"
                    : idInput.length > 0
                    ? "border-emerald-400/50"
                    : "border-white/20",
                ].join(" ")}
                aria-invalid={validationError !== null}
                aria-describedby={validationError ? "id-error" : undefined}
              />

              {/* Validation Error Message */}
              {validationError && (
                <motion.div
                  id="id-error"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-red-300 text-center bg-red-900/20 border border-red-400/30 rounded-lg px-3 py-2"
                  role="alert"
                >
                  {lang(validationError)}
                </motion.div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!isValid}
                className={[
                  "w-full py-3 rounded-xl font-semibold transition-all",
                  isValid
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-lg hover:shadow-emerald-500/30 active:scale-[0.98]"
                    : "bg-white/10 text-white/30 cursor-not-allowed",
                ].join(" ")}
              >
                {lang("ID_COLLECTION_SUBMIT")}
              </button>
            </div>

            <div className="mt-6 space-y-3 text-xs leading-relaxed">
              <p className="text-white/55">
                {lang("ID_COLLECTION_CONSENT")}
              </p>
              <div className="border border-amber-400/40 bg-amber-900/15 text-amber-100 rounded-lg px-3 py-2">
                {lang("ID_COLLECTION_WARNING")}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
