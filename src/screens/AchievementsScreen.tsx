// src/screens/AchievementsScreen.tsx
// Book of Achievements screen - displays all available achievements
//
// Features:
// - Shows all achievements in a grid layout
// - Each achievement has icon, title, and description
// - Currently non-functional (no tracking implemented)
// - Displays "under construction" notice
// - Back button to return to splash screen
//
// Connected to:
// - src/data/achievements.ts: Achievement pool and types
// - src/screens/SplashScreen.tsx: Navigates here from main menu

import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { bgStyle } from "../lib/ui";
import { getAllAchievements, type Achievement } from "../data/achievements";

// Animation variants for staggered card appearance
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 260,
      damping: 20,
    },
  },
};

/**
 * Get Lucide icon component by name
 * Fallback to Award icon if not found
 */
function getIconComponent(iconName: string) {
  const Icon = (LucideIcons as any)[iconName];
  return Icon || LucideIcons.Award;
}

/**
 * Get color classes for achievement icons
 */
function getAchievementColorClasses(color: string): { bg: string; text: string; border: string } {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
    gold: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    pink: { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30' },
    red: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    blue: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
    gray: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
    green: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  };
  return colorMap[color] || colorMap.blue;
}

/**
 * Achievement Card Component
 */
function AchievementCard({ achievement }: { achievement: Achievement }) {
  const Icon = getIconComponent(achievement.icon);
  const colors = getAchievementColorClasses(achievement.color);

  return (
    <motion.div
      variants={cardVariants}
      className="relative rounded-xl border border-white/10 bg-white/5 p-6 hover:bg-white/8 transition-colors"
    >
      {/* Icon */}
      <div className="flex items-start gap-4 mb-3">
        <div className={`rounded-full ${colors.bg} ${colors.text} p-3 border ${colors.border}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          {/* Title */}
          <h3 className="text-lg font-bold text-white mb-1">
            {achievement.title}
          </h3>
          {/* Description */}
          <p className="text-white/70 text-sm leading-relaxed">
            {achievement.description}
          </p>
        </div>
      </div>

      {/* Locked indicator (placeholder for future functionality) */}
      <div className="absolute top-4 right-4">
        <div className="rounded-full bg-white/5 border border-white/20 p-1.5">
          <LucideIcons.Lock className="h-4 w-4 text-white/40" />
        </div>
      </div>
    </motion.div>
  );
}

export default function AchievementsScreen() {
  const achievements = getAllAchievements();

  return (
    <div className="min-h-screen px-5 py-8" style={bgStyle}>
      <div className="w-full max-w-5xl mx-auto space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-4xl font-extrabold bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent"
            >
              Book of Achievements
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-white/60 text-sm mt-1"
            >
              (under construction, not functional yet)
            </motion.p>
          </div>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            onClick={() => window.history.back()}
            className="rounded-xl px-4 py-2 bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-colors"
          >
            ← Back
          </motion.button>
        </div>

        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-blue-500/10 backdrop-blur-sm border border-blue-500/20 rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <LucideIcons.Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white/80 text-sm leading-relaxed">
                Achievements are currently under development. In future updates, you'll be able to unlock these
                by completing specific challenges during gameplay. Check back soon!
              </p>
            </div>
          </div>
        </motion.div>

        {/* Achievements Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {achievements.map((achievement) => (
            <AchievementCard key={achievement.id} achievement={achievement} />
          ))}
        </motion.div>
      </div>
    </div>
  );
}
