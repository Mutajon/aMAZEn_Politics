// src/components/event/CollectorLoadingOverlay.tsx
// Loading overlay for EventDataCollector
//
// Shows:
// - Video background (role-specific)
// - Minimal loading indicator at bottom:
//   * Spinner + percentage
//   * Rotating gameplay tips
//
// Used by: EventScreen3 during data collection
// Props: progress

import { useMemo, useEffect, useRef } from "react";
import { useRoleStore } from "../../store/roleStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useRotatingTips } from "../../hooks/useRotatingTips";
import { VideoBackground } from "./VideoBackground";
import { getRoleVideoPath } from "../../data/predefinedRoles";
import { motion } from "framer-motion";
import { audioManager } from "../../lib/audioManager";

type Props = {
  message?: string; // Kept for backwards compatibility, not displayed
};

export default function CollectorLoadingOverlay({ }: Props) {
  const { currentTip, fadeState } = useRotatingTips();
  const soundPlayedRef = useRef(false);
  const isMobileDevice = useSettingsStore((s) => s.isMobileDevice);

  // Play zoom woosh sound when overlay appears
  useEffect(() => {
    if (!soundPlayedRef.current) {
      soundPlayedRef.current = true;
      audioManager.playSfx('zoom-woosh');
    }
  }, []);

  // Get role background image from store
  const roleBackgroundImage = useRoleStore((s) => s.roleBackgroundImage);

  // Extract imageId from background path to determine video path
  // Example: "/assets/images/BKGs/Roles/greeceFull.jpg" → "greece"
  const imageId = useMemo(() => {
    if (!roleBackgroundImage) return null;
    const filename = roleBackgroundImage.split('/').pop(); // "greeceFull.jpg"
    return filename?.replace('Full.jpg', ''); // "greece"
  }, [roleBackgroundImage]);

  // Get video path based on imageId
  const videoPath = useMemo(() => {
    return imageId ? getRoleVideoPath(imageId) : '';
  }, [imageId]);

  // Opacity values for fade transitions
  const tipOpacity = fadeState === 'in' || fadeState === 'out' ? 0 : 1;

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex items-end justify-center relative pb-20"
    >
      {/* Background: Video on mobile, static image on desktop/tablet */}
      {isMobileDevice ? (
        <VideoBackground videoPath={videoPath} imagePath={roleBackgroundImage} />
      ) : (
        <div
          className="fixed inset-0 z-0"
          style={{
            backgroundImage: roleBackgroundImage ? `url(${roleBackgroundImage})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}

      {/* Minimal loading indicator - positioned at lower part */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        {/* Sleek Spinning "Thinking" Animation in Purple Hues */}
        <div className="relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 mb-2">
          {/* Subtle slow pulsing purple glow behind */}
          <motion.div
            className="absolute inset-0 bg-purple-600/20 rounded-full blur-xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          {/* Outer ring: thin, spinning */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-500/80 border-r-purple-400/80"
            animate={{ rotate: 360 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear"
            }}
          />
          {/* Inner ring: counter-spinning, thicker but more transparent */}
          <motion.div
            className="absolute inset-2 rounded-full border-[3px] border-transparent border-l-indigo-500/50 border-b-fuchsia-500/50"
            animate={{ rotate: -360 }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear"
            }}
          />
          {/* Core: solid breathing dot */}
          <motion.div
            className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-400 shadow-[0_0_15px_rgba(168,85,247,0.6)]"
            animate={{
              scale: [0.8, 1.1, 0.8],
              opacity: [0.7, 1, 0.7]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </div>

        {/* Rotating Tips with Radial Gradient Background */}
        <motion.div
          animate={{ opacity: tipOpacity }}
          transition={{ duration: 0.5 }}
          className="relative px-8 py-3 max-w-md text-center"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.4) 50%, transparent 100%)',
          }}
        >
          <p className="text-sm text-white/90 leading-relaxed">
            {currentTip}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
