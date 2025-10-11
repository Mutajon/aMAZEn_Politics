// src/components/event/LeaderProfileCard.tsx
// Leader profile card for Hall of Fame carousel in loading overlay
//
// Displays:
// - Leader image (60x60, rounded)
// - Name and score (top row)
// - Period (year range)
// - About text (2-line clamp)
//
// Used by: CollectorLoadingOverlay
// Dependencies: framer-motion, HighscoreEntry type

import { motion } from "framer-motion";
import type { HighscoreEntry } from "../../data/highscores-default";
import type { FadeState } from "../../hooks/useRotatingLeader";

type Props = {
  leader: HighscoreEntry | null;
  fadeState: FadeState;
};

/**
 * Helper to get leader image path
 * Extracts first name and looks up in /assets/images/leaders/
 */
function imgForLeader(name: string) {
  const first = name.split(" ")[0];
  return `/assets/images/leaders/${first}.jpg`;
}

/**
 * Leader profile card with fade animation
 *
 * Layout:
 * ┌─────────────────────────────────────┐
 * │  ┌──────┐  Name                     │
 * │  │ img  │  Period                   │
 * │  │120px │  Rank: X (Score: XXXX)    │
 * │  └──────┘                           │
 * │                                     │
 * │  Description                        │
 * │  (full text, no clamp)              │
 * └─────────────────────────────────────┘
 */
export default function LeaderProfileCard({ leader, fadeState }: Props) {
  if (!leader) return null;

  // Calculate opacity based on fade state
  const opacity = fadeState === 'out' ? 0 : 1;

  // Calculate rank (assuming entries are sorted by score in store)
  // For display purposes, we'll use a simplified rank calculation
  // Note: This is approximate since we don't have access to the full sorted list here
  const rank = leader.score >= 3200 ? 1 : leader.score >= 3000 ? 2 : leader.score >= 2900 ? 3 : 4;

  return (
    <motion.div
      animate={{ opacity }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="max-w-lg mx-auto px-4"
    >
      {/* Top Section: Image + Name/Period/Rank */}
      <div className="flex items-start gap-4 mb-4">
        {/* Leader Image - Doubled size */}
        <img
          src={imgForLeader(leader.name)}
          alt={leader.name}
          width={120}
          height={120}
          className="w-[120px] h-[120px] rounded-lg object-cover border border-white/10 flex-shrink-0"
          onError={(ev) => {
            (ev.currentTarget as HTMLImageElement).src =
              "/assets/images/leaders/placeholder.jpg";
          }}
        />

        {/* Text Content - Name, Period, Rank/Score - Aligned to left of image */}
        <div className="flex flex-col justify-center">
          {/* Name */}
          <h3 className="text-xl font-semibold text-white/95 mb-1">
            {leader.name}
          </h3>

          {/* Period */}
          {leader.period && (
            <p className="text-sm text-amber-300/90 mb-2">
              {leader.period}
            </p>
          )}

          {/* Rank and Score */}
          <p className="text-base text-white/90">
            Rank: {rank} <span className="text-white/60">(Score: </span>
            <span className="font-extrabold text-amber-300 tabular-nums">
              {leader.score.toLocaleString()}
            </span>
            <span className="text-white/60">)</span>
          </p>
        </div>
      </div>

      {/* Description Section - Below image, no label */}
      <div className="text-left">
        <p className="text-sm text-white/80 leading-relaxed">
          {leader.about}
        </p>
      </div>
    </motion.div>
  );
}
