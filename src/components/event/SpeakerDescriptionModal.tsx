// src/components/event/SpeakerDescriptionModal.tsx
// Modal displaying confidant/speaker description and portrait

import { motion, AnimatePresence } from "framer-motion";
import { X, User } from "lucide-react";
import { getAdvisorImagePath, getDefaultAdvisorImagePath } from "../../data/confidants";
import { useLogger } from "../../hooks/useLogger";
import { useEffect } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  speakerName: string;
  speakerDescription: string;
  imageId?: string; // For predefined roles
  roleTitle?: string; // Optional: display which scenario this confidant serves
};

export function SpeakerDescriptionModal({
  isOpen,
  onClose,
  speakerName,
  speakerDescription,
  imageId,
  roleTitle
}: Props) {
  const logger = useLogger();

  // Log modal opened
  useEffect(() => {
    if (isOpen) {
      logger.log('speaker_modal_opened', {
        speakerName,
        hasImage: !!imageId,
        roleTitle: roleTitle || 'custom'
      }, `User opened speaker description modal for ${speakerName}`);
    }
  }, [isOpen, speakerName, imageId, roleTitle, logger]);

  if (!isOpen) return null;

  // Determine image path
  const imagePath = imageId
    ? getAdvisorImagePath(imageId)
    : getDefaultAdvisorImagePath();

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
              <div className="rounded-2xl bg-blue-500/10 p-4 text-blue-500">
                <User className="h-8 w-8" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-white mb-1">
                  {speakerName}
                </h2>
                {roleTitle && (
                  <p className="text-sm text-white/50">
                    Your Confidant in {roleTitle}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-6">
              {/* Speaker Portrait */}
              <div className="flex justify-center">
                <div className="relative overflow-hidden rounded-lg shadow-2xl border border-white/10">
                  <img
                    src={imagePath}
                    alt={speakerName}
                    className="w-auto h-auto object-contain max-h-80"
                    onError={(e) => {
                      // Fallback to default image if specific image fails to load
                      const target = e.target as HTMLImageElement;
                      if (target.src !== getDefaultAdvisorImagePath()) {
                        target.src = getDefaultAdvisorImagePath();
                      }
                    }}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white/90">Who They Are</h3>
                <p className="text-white/70 leading-relaxed">
                  {speakerDescription}
                </p>
              </div>

              {/* Optional: Additional Context */}
              <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
                <p className="text-sm text-white/60 italic">
                  This confidant delivers dilemmas and reports to you throughout the game,
                  providing trusted counsel from their unique perspective.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/10 bg-black/20">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
