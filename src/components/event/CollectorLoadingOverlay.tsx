// src/components/event/CollectorLoadingOverlay.tsx
// Loading overlay for EventDataCollector
//
// Shows:
// - Spinning hourglass animation
// - Days left bar (starts at totalDays, empties with each day)
// - Loading message
//
// Used by: EventScreen3 during data collection
// Props: day, totalDays

import { useMemo } from "react";
import { Hourglass } from "lucide-react";
import { useRoleStore } from "../../store/roleStore";
import { useRotatingLeader } from "../../hooks/useRotatingLeader";
import LeaderProfileCard from "./LeaderProfileCard";
import { VideoBackground } from "./VideoBackground";
import { getRoleVideoPath } from "../../data/predefinedRoles";
import { motion } from "framer-motion";

type Props = {
  progress: number; // 0-100 real-time progress percentage (REQUIRED)
  message?: string;
};

export default function CollectorLoadingOverlay({
  progress,
  message = "Gathering political intelligence..."
}: Props) {
  const { currentLeader, currentRank, fadeState } = useRotatingLeader();

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

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex items-center justify-center relative"
    >
      {/* Video background (with fallback to static image) */}
      <VideoBackground videoPath={videoPath} imagePath={roleBackgroundImage} />
      {/* Golden frame container wrapping all loading content - positioned above video */}
      <div className="rounded-2xl border-slate-700/50 bg-black/60 backdrop-blur-sm ring-1 ring-amber-400/40 p-8 shadow-xl max-w-2xl relative z-10">
        <div className="text-center">
          {/* Spinning Hourglass - Golden Yellow */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Hourglass
                className="w-16 h-16 text-amber-400 animate-spin"
                style={{ animationDuration: "2s" }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-300/10 to-transparent animate-pulse" />
            </div>
          </div>

          {/* Loading Message */}
          <p className="text-white/90 text-lg font-medium mb-4">
            {message}
          </p>

          {/* Collection Progress Percentage */}
          <div className="mb-10">
            <p className="text-6xl font-bold text-white/95 tabular-nums">
              {Math.round(progress)}%
            </p>
          </div>

          {/* Hall of Fame Section */}
          <div className="mb-6 mt-8">
            {/* Title */}
            <h3 className="text-lg uppercase tracking-wide text-amber-300/90 mb-6">
              Top Hall of Famers:
            </h3>

            {/* Leader Profile Card */}
            <div className="min-h-[160px] flex items-center justify-center">
              <LeaderProfileCard leader={currentLeader} rank={currentRank} fadeState={fadeState} />
            </div>
          </div>

          {/* Pulsing dots */}
          <div className="flex justify-center gap-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-amber-400/60 animate-pulse"
                style={{
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: "1.4s"
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
