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
import { Loader2 } from "lucide-react";
import { useRoleStore } from "../../store/roleStore";
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
      {/* Video background (with fallback to static image) */}
      <VideoBackground videoPath={videoPath} imagePath={roleBackgroundImage} />

      {/* Minimal loading indicator - positioned at lower part */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        {/* Spinner + Percentage */}
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
          <p className="text-xl font-medium text-white/95 tabular-nums">
            {Math.round(progress)}%
          </p>
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
