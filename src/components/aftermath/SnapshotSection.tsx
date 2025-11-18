// src/components/aftermath/SnapshotSection.tsx
// Snapshot section showing avatar, death text, and extreme event pills
//
// Replaces the old RemembranceSection with a more compact layout:
// - Avatar + death text in top row
// - "Snapshot of Your Time" header + event pills below
//
// Connects to:
// - src/components/aftermath/SnapshotPill.tsx: individual event pills
// - src/components/aftermath/AftermathContent.tsx: section orchestration
// - src/lib/aftermath.ts: SnapshotEvent type

import { motion } from "framer-motion";
import type { SnapshotEvent } from "../../lib/aftermath";
import SnapshotPill from "./SnapshotPill";
import { useLang } from "../../i18n/lang";

type Props = {
  intro: string; // Death text ("After X years, [leader] died of Z.")
  snapshot: SnapshotEvent[]; // 6-10 extreme events
  avatarUrl?: string; // Player avatar
  legacy: string; // How the player will be remembered ("You will be remembered as...")
};

export default function SnapshotSection({ intro, snapshot, avatarUrl, legacy }: Props) {
  const lang = useLang();

  return (
    <motion.div
      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Avatar + Death Text Row */}
      <div className="flex gap-6 items-start mb-6">
        {/* Left: Avatar */}
        {avatarUrl && (
          <motion.img
            src={avatarUrl}
            alt="Player portrait"
            className="w-[120px] h-[120px] rounded-lg object-cover border border-white/20 flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          />
        )}

        {/* Right: Death Text */}
        <motion.p
          className="text-white/90 text-lg leading-relaxed flex-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {intro}
        </motion.p>
      </div>

      {/* Snapshot Pills Section */}
      <div className="border-t border-white/10 pt-6">
        <motion.h3
          className="text-white/80 text-sm uppercase tracking-wide mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          {lang("SNAPSHOT_OF_YOUR_TIME")}
        </motion.h3>

        {/* Pills Grid */}
        <div className="flex flex-wrap gap-3">
          {snapshot.map((event, i) => (
            <SnapshotPill key={i} event={event} delay={0.6 + i * 0.1} />
          ))}
        </div>

        {/* Legacy Sentence */}
        <motion.div
          className="mt-8 pt-6 border-t border-white/10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 + snapshot.length * 0.1 + 0.2 }}
        >
          <p className="text-amber-400 text-xl font-semibold text-center italic leading-relaxed">
            {legacy}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
