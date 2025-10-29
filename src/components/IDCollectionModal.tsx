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
  // Trim whitespace
  const trimmed = id.trim();

  // Check length
  if (trimmed.length === 0) {
    return null; // Empty is not an error, just not submittable
  }

  if (trimmed.length < 9) {
    return "ID_VALIDATION_LENGTH";
  }

  if (trimmed.length > 9) {
    return "ID_VALIDATION_LENGTH";
  }

  // Check all numeric
  if (!/^\d{9}$/.test(trimmed)) {
    return "ID_VALIDATION_NUMERIC";
  }

  // Check not all same digit (e.g., 111111111, 222222222)
  if (/^(\d)\1{8}$/.test(trimmed)) {
    return "ID_VALIDATION_PATTERN";
  }

  // Valid!
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
    const error = validateID(idInput);
    if (error === null && idInput.trim().length === 9) {
      onSubmit(idInput.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  const isValid = validationError === null && idInput.trim().length === 9;

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
                type="text"
                inputMode="numeric"
                maxLength={9}
                value={idInput}
                onChange={(e) => setIdInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={lang("ID_COLLECTION_PLACEHOLDER")}
                className={[
                  "w-full px-4 py-3 rounded-xl text-center text-xl font-mono tracking-wider",
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

              {/* Character Count */}
              <div className="text-center text-xs text-white/40">
                {idInput.length}/9 {idInput.length === 1 ? "digit" : "digits"}
              </div>

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

            {/* Privacy Notice */}
            <div className="mt-6 p-3 rounded-lg bg-white/5 border border-white/10">
              <p className="text-xs text-white/50 text-center">
                🔒 Your ID will be stored securely and used only for research
                purposes. All data is anonymized and confidential.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
