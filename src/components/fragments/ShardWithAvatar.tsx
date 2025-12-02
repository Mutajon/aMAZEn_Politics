/**
 * src/components/fragments/ShardWithAvatar.tsx
 *
 * Renders a mirror shard with an optional avatar overlay.
 * Used in DreamScreen to display collected fragments with player avatars.
 *
 * Shard States:
 * - Completed (isCompleted): Has avatar, clickable to show popup summary
 * - Playable (isPlayable): No avatar, clickable to start new game, shows 👆
 * - Locked (isLocked): Shows lock overlay, not clickable
 */

import { motion } from "framer-motion";

interface ShardWithAvatarProps {
  /** Compressed avatar thumbnail URL (base64 WebP) */
  avatarUrl?: string | null;
  /** Shard has been completed - shows avatar, click opens popup */
  isCompleted: boolean;
  /** Shard is next to play - no avatar, click starts game */
  isPlayable: boolean;
  /** Shard is locked - shows lock overlay */
  isLocked: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Shard index (0, 1, or 2) for animation delay */
  index: number;
}

export function ShardWithAvatar({
  avatarUrl,
  isCompleted,
  isPlayable,
  isLocked,
  onClick,
  index,
}: ShardWithAvatarProps) {
  // Shard is clickable if completed (for popup) or playable (to start game)
  const isClickable = isCompleted || isPlayable;

  return (
    <motion.div
      key={index}
      className={`relative ${!isClickable ? "pointer-events-none" : "cursor-pointer"}`}
      initial={{ y: -200, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        type: "spring",
        damping: 20,
        stiffness: 300,
        delay: index * 0.15,
      }}
      onClick={() => isClickable && onClick?.()}
    >
      {/* Base shard image */}
      <img
        src="/assets/images/mirrorShard.png"
        alt="Mirror shard"
        className={`w-20 sm:w-24 md:w-28 h-auto ${
          isClickable ? "hover:scale-105 transition-transform" : ""
        }`}
      />

      {/* Avatar overlay for completed shards (70% opacity, circular mask) */}
      {isCompleted && avatarUrl && (
        <div
          className="absolute pointer-events-none"
          style={{
            width: "55%",
            height: "55%",
            borderRadius: "50%",
            opacity: 0.7,
            overflow: "hidden",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <img
            src={avatarUrl}
            alt="Your character"
            className="w-full h-full object-cover"
            style={{ objectPosition: "center 25%" }}
          />
        </div>
      )}

      {/* Lock overlay for locked shards */}
      {isLocked && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center rounded-lg">
          <motion.span
            className="text-3xl sm:text-4xl"
            animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🔒
          </motion.span>
        </div>
      )}

      {/* Hand click indicator ONLY for playable shards (not completed) */}
      {isPlayable && !isCompleted && (
        <motion.div
          className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-3xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, y: [0, 5, 0] }}
          transition={{
            opacity: { duration: 0.3 },
            y: { duration: 1, repeat: Infinity },
          }}
        >
          👆
        </motion.div>
      )}
    </motion.div>
  );
}
