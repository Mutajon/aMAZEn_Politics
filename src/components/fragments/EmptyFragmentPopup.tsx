/**
 * src/components/fragments/EmptyFragmentPopup.tsx
 *
 * Simple modal popup shown when user clicks an empty fragment slot
 * Guides users on how to collect fragments
 */

import { motion, AnimatePresence } from "framer-motion";
import { X, Puzzle } from "lucide-react";
import { useEffect } from "react";

interface EmptyFragmentPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EmptyFragmentPopup({
  isOpen,
  onClose,
}: EmptyFragmentPopupProps) {
  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleEsc);
      return () => window.removeEventListener("keydown", handleEsc);
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-start justify-center px-4 pt-32 pointer-events-auto">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Popup Card - Properly Centered */}
          <motion.div
            className="relative w-full max-w-sm mx-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 shadow-2xl relative">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-700 transition-colors z-10"
                aria-label="Close popup"
              >
                <X className="w-5 h-5 text-white/80" />
              </button>

              {/* Puzzle Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center">
                  <Puzzle className="w-8 h-8 text-gray-400" />
                </div>
              </div>

              {/* Message */}
              <div className="text-center">
                <h2 className="text-lg font-bold text-white mb-3">
                  Missing Fragment
                </h2>
                <p className="text-sm text-gray-300 leading-relaxed">
                  Play a game to collect a fragment and learn about yourself!
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
