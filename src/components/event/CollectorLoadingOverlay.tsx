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
  progress: number; // 0-100 real-time progress percentage (REQUIRED)
  message?: string; // Kept for backwards compatibility, not displayed
};

export default function CollectorLoadingOverlay({
  progress,
}: Props) {
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
        {/* Progress Bar Container */}
        <div className="w-64 sm:w-80 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 50, damping: 20 }}
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
