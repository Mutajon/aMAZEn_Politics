/**
 * src/components/fragments/FragmentPopup.tsx
 *
 * Modal popup showing details of a collected fragment
 * Displays player name, setting, legacy, and snapshot pills
 */

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { PastGameEntry } from "../../lib/types/pastGames";
import { useEffect } from "react";

interface FragmentPopupProps {
  isOpen: boolean;
  fragment: PastGameEntry | null;
  onClose: () => void;
}

export default function FragmentPopup({
  isOpen,
  fragment,
  onClose,
}: FragmentPopupProps) {
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

  if (!fragment) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Popup Card */}
          <motion.div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-[90vw] max-w-md"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 shadow-2xl relative">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-700 transition-colors"
                aria-label="Close popup"
              >
                <X className="w-5 h-5 text-white/80" />
              </button>

              {/* Player Name */}
              <h2 className="text-2xl font-bold text-white mb-2 pr-8">
                {fragment.playerName}
              </h2>

              {/* Setting */}
              <p className="text-sm text-gray-400 mb-4">{fragment.roleTitle}</p>

              {/* Legacy */}
              <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <p className="text-sm text-white/90 italic leading-relaxed">
                  "{fragment.legacy}"
                </p>
              </div>

              {/* Snapshot Pills */}
              {fragment.snapshotHighlights.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    Key Events
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {fragment.snapshotHighlights.map((snapshot, index) => (
                      <SnapshotPill
                        key={index}
                        icon={snapshot.icon}
                        text={snapshot.text}
                        type={snapshot.type}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Score Badge */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Final Score</span>
                  <span className="text-white font-bold text-lg">
                    {fragment.finalScore.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface SnapshotPillProps {
  icon: string;
  text: string;
  type: "positive" | "negative";
}

function SnapshotPill({ icon, text, type }: SnapshotPillProps) {
  const bgColor =
    type === "positive"
      ? "bg-emerald-900/30 border-emerald-700/50"
      : "bg-red-900/30 border-red-700/50";

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5
        rounded-full border
        ${bgColor}
      `}
    >
      <span className="text-sm">{icon}</span>
      <span className="text-xs text-white/90">{text}</span>
    </div>
  );
}
