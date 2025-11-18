// src/components/event/SpeakerDescriptionModal.tsx
// Modal displaying confidant/speaker description and portrait

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
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
          className="relative w-full max-w-md sm:max-w-lg md:max-w-xl mx-4 max-h-[85vh] overflow-y-auto bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-white/20 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors z-10"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>

          {/* Content - Horizontal Layout */}
          <div className="flex gap-3 sm:gap-4 md:gap-6 p-4 sm:p-5 md:p-6">
            {/* Speaker Portrait - Left Side */}
            <div className="flex-shrink-0">
              <img
                src={imagePath}
                alt={speakerName}
                className="w-16 sm:w-32 md:w-40 h-auto object-contain rounded-lg"
                onError={(e) => {
                  // Fallback to default image if specific image fails to load
                  const target = e.target as HTMLImageElement;
                  if (target.src !== getDefaultAdvisorImagePath()) {
                    target.src = getDefaultAdvisorImagePath();
                  }
                }}
              />
            </div>

            {/* Text Content - Right Side */}
            <div className="flex-1 flex flex-col gap-3 pr-6 sm:pr-8">
              {/* Speaker Name */}
              <h2 className="text-2xl font-bold text-white">
                {speakerName}
              </h2>

              {/* Description */}
              <p className="text-white/70 leading-relaxed">
                {speakerDescription}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
