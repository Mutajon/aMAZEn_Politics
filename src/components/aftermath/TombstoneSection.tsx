// src/components/aftermath/TombstoneSection.tsx
// Tombstone with haiku overlay
//
// Shows:
// - Tombstone image
// - Haiku text overlaid on the tombstone
//
// Connects to:
// - src/components/aftermath/AftermathContent.tsx: main content orchestration

import { motion } from "framer-motion";

type Props = {
  haiku: string;
};

const FADE_DURATION_S = 0.5;

export default function TombstoneSection({ haiku }: Props) {
  return (
    <motion.div
      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: FADE_DURATION_S }}
    >
      <div className="relative max-w-[300px] mx-auto">
        <img
          src="/assets/images/tombStone.png"
          alt="Tombstone"
          className="w-full opacity-80"
        />
        {/* Haiku Overlay */}
        <div className="absolute inset-0 flex items-center justify-center px-12">
          <p className="text-gray-900 text-center font-serif italic text-sm whitespace-pre-line max-w-[200px]">
            {haiku}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
