/**
 * src/components/fragments/FragmentPopup.tsx
 *
 * Modal popup showing details of a collected fragment
 * Displays player avatar, name, setting, and snapshot pills
 * Uses flex centering pattern matching other working modals
 */

import { motion, AnimatePresence } from "framer-motion";
import { X, Puzzle } from "lucide-react";
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
        <div className="fixed inset-0 z-[150] flex items-center justify-center px-4 pointer-events-auto">
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
            className="relative w-full max-w-md max-h-[85vh] overflow-y-auto mx-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 md:p-6 shadow-2xl relative">
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-700 transition-colors z-10"
                aria-label="Close popup"
              >
                <X className="w-5 h-5 text-white/80" />
              </button>

              {/* Avatar + Name Section (Horizontal Layout) */}
              <div className="flex items-center gap-4 mb-6 pr-8">
                {/* Avatar / Background Image */}
                <div className="flex-shrink-0 w-20 h-20 rounded-full overflow-hidden bg-gray-800/50 flex items-center justify-center">
                  {fragment.roleImageId ? (
                    // Use role background banner for predefined roles (99.9% storage savings!)
                    <img
                      src={`/assets/images/BKGs/Roles/banners/${fragment.roleImageId}Banner.png`}
                      alt={fragment.roleTitle}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to puzzle icon if banner fails to load
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : fragment.avatarUrl ? (
                    // Use custom avatar for custom roles (backward compatibility)
                    <img
                      src={fragment.avatarUrl}
                      alt={fragment.playerName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to puzzle icon if image fails
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    // Default: Puzzle icon
                    <Puzzle className="w-10 h-10 text-gray-400" />
                  )}
                </div>

                {/* Name + Setting */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg md:text-xl font-bold text-white mb-1 truncate">
                    {fragment.playerName}
                  </h2>
                  <p className="text-xs md:text-sm text-gray-400 line-clamp-2">
                    {fragment.roleTitle}
                  </p>
                </div>
              </div>

              {/* Snapshot Pills */}
              {fragment.snapshotHighlights.length > 0 && (
                <div className="space-y-2 mb-4">
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

              {/* Self-Judgment */}
              {fragment.selfJudgment && (
                <div className="mb-4">
                  <div className="bg-purple-900/20 border border-purple-700/40 rounded-lg px-4 py-3">
                    <p className="text-sm text-purple-200">
                      <span className="font-semibold">Self judgment:</span> {fragment.selfJudgment}
                    </p>
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
        </div>
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
