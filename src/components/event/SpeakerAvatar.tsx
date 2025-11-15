// src/components/event/SpeakerAvatar.tsx
// Displays the confidant/speaker avatar next to dilemmas

import { motion } from "framer-motion";
import { getAdvisorImagePath, getDefaultAdvisorImagePath } from "../../data/confidants";

export type SpeakerAvatarProps = {
  speakerName: string;
  imageId?: string; // For predefined roles, maps to advisor image
  onClick: () => void; // Open speaker description modal
  size?: number; // Optional size in pixels for maxHeight (defaults to 180px)
};

export function SpeakerAvatar({ speakerName, imageId, onClick, size = 180 }: SpeakerAvatarProps) {
  // Determine image path
  const imagePath = imageId
    ? getAdvisorImagePath(imageId)
    : getDefaultAdvisorImagePath();

  return (
    <motion.div
      className="relative cursor-pointer group"
      initial={{ opacity: 0, x: -20 }}
      animate={{
        opacity: 1,
        x: 0,
        y: [0, -5, 0] // Subtle floating animation
      }}
      transition={{
        opacity: { duration: 0.5, ease: "easeOut" },
        x: { duration: 0.5, ease: "easeOut" },
        y: {
          repeat: Infinity,
          duration: 3.5,
          ease: "easeInOut",
          times: [0, 0.5, 1]
        }
      }}
      onClick={onClick}
    >
      {/* Avatar Image - Non-circular, preserves aspect ratio */}
      <div className="relative overflow-hidden rounded-lg shadow-lg transition-transform duration-300 group-hover:scale-105">
        <img
          src={imagePath}
          alt={speakerName}
          className="w-auto h-full object-contain"
          style={{
            maxHeight: `${size}px`,
            minWidth: "100px"
          }}
          onError={(e) => {
            // Fallback to default image if specific image fails to load
            const target = e.target as HTMLImageElement;
            if (target.src !== getDefaultAdvisorImagePath()) {
              target.src = getDefaultAdvisorImagePath();
            }
          }}
        />

        {/* Subtle overlay on hover to indicate clickability */}
        <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
      </div>
    </motion.div>
  );
}
