// src/components/roleSelection/RoleInfoBox.tsx
// Bottom information panel for role carousel
//
// Displays:
// - Role title, year, subtitle
// - Intro paragraph
// - "You are:" description
// - Score goal badge
// - Confirm button (or lock indicator for locked roles)
// - Special CTAs for custom role and scenario items

import { motion, AnimatePresence } from "framer-motion";
import type { CarouselItem } from "../../hooks/useRoleCarousel";
import { useLang } from "../../i18n/lang";
import { useRoleStore } from "../../store/roleStore";
import { Trophy, Crown } from "lucide-react";

interface RoleInfoBoxProps {
  item: CarouselItem;
  onConfirm: () => void;
  onOpenCustomRole?: () => void;
  onOpenScenario?: () => void;
  userBestScore?: number | null;
  globalBestScore?: number | null;
}

export default function RoleInfoBox({
  item,
  onConfirm,
  onOpenCustomRole,
  onOpenScenario,
  userBestScore,
  globalBestScore,
}: RoleInfoBoxProps) {
  const lang = useLang();
  const character = useRoleStore((s) => s.character);
  const playerName = character?.name;
  
  // Determine goal color based on score goal
  const goalColorClass = (() => {
    if (!item.scoreGoal) return "text-white";
    switch (item.scoreGoal) {
      case 1000:
        return "text-white";
      case 1100:
        return "text-yellow-200";
      case 1200:
        return "text-orange-200";
      case 1300:
        return "text-orange-300";
      case 1400:
        return "text-rose-200";
      default:
        return "text-white";
    }
  })();

  const highScoreDisplay = item.highScore && item.highScore > 0 ? item.highScore.toLocaleString() : "-";

  const statusCompleted = item.goalStatus === "completed";
  const statusClasses = statusCompleted
    ? "bg-gradient-to-r from-emerald-400/40 via-emerald-500/40 to-emerald-400/40 text-emerald-100 border border-emerald-300/40 shadow-[0_0_8px_rgba(16,185,129,0.25)]"
    : "bg-slate-800/60 text-slate-300 border border-slate-600/60";

  // Render different content based on item type
  const renderContent = () => {
    if (item.type === 'customRole') {
      return (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-xl sm:text-2xl md:text-3xl font-cinzel font-bold bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
              {item.title}
            </h3>
          </div>
          <button
            onClick={onOpenCustomRole}
            className="w-full rounded-xl px-4 sm:px-6 py-3 sm:py-4 font-semibold text-base shadow-lg bg-gradient-to-r from-purple-500 to-purple-700 text-white hover:from-purple-400 hover:to-purple-600 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            Suggest Your Own Role
          </button>
        </div>
      );
    }

    if (item.type === 'scenario') {
      return (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-xl sm:text-2xl md:text-3xl font-cinzel font-bold bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
              {item.title}
            </h3>
          </div>
          <button
            onClick={onOpenScenario}
            className="w-full rounded-xl px-4 sm:px-6 py-3 sm:py-4 font-semibold text-base shadow-lg bg-gradient-to-r from-blue-500 to-blue-700 text-white hover:from-blue-400 hover:to-blue-600 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            Suggest a Scenario
          </button>
        </div>
      );
    }

    // Role type
    return (
      <div className="space-y-4">
        {/* Title and year */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg sm:text-xl md:text-2xl font-cinzel font-bold text-white tracking-wide drop-shadow-md">
              {item.title}
            </h3>
          </div>
          <div className="flex flex-col items-end gap-2">
            {item.year && (
              <div className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-amber-400/30">
                <span className="text-[10px] uppercase tracking-wider text-amber-300/80">{lang("YEAR")}</span>
                <span className="text-sm text-amber-300 font-light tracking-wider drop-shadow-md">{item.year}</span>
              </div>
            )}
            {item.goalStatus && (
              <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-medium ${statusClasses}`}>
                {statusCompleted ? lang("ROLE_GOAL_COMPLETED") : lang("ROLE_GOAL_UNCOMPLETED")}
              </span>
            )}
          </div>
        </div>

        {/* Intro paragraph */}
        {item.intro && (
          <p className="text-sm text-white/90 leading-relaxed">
            {item.intro}
          </p>
        )}

        {/* Player name and highscore */}
        {(playerName || (item.highScore && item.highScore > 0)) && (
          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-700/40">
            {playerName && (
              <div className="flex items-center gap-2">
                <span className="text-white/70">{lang("PLAYER_NAME")}:</span>
                <span className="font-semibold text-amber-200">{playerName}</span>
              </div>
            )}
            {item.highScore && item.highScore > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-white/70">{lang("FINAL_SCORE_HIGH_SCORE")}:</span>
                <span className="font-semibold text-amber-300">{highScoreDisplay}</span>
              </div>
            )}
          </div>
        )}

        {/* Score goal badge with User Best & Global Best on same row */}
        {item.scoreGoal && (
          <div className="flex flex-wrap items-center gap-2 text-xs pt-2 border-t border-slate-700/40">
            {/* Score Goal */}
            <div className="flex items-center gap-2">
              <span className="text-white/70">{lang("ROLE_GOAL_TARGET_LABEL")}:</span>
              <span className={`font-bold ${goalColorClass}`}>
                {item.scoreGoal.toLocaleString()}
              </span>
            </div>

            {/* User's Personal Best */}
            {userBestScore && userBestScore > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gradient-to-r from-amber-500/20 via-yellow-400/20 to-amber-500/20 border border-amber-400/30">
                <Trophy className="w-3 h-3 flex-shrink-0 text-amber-300" />
                <span className="text-white/70">{lang("ROLE_YOUR_BEST")}</span>
                <span className="font-bold text-amber-300">{userBestScore.toLocaleString()}</span>
              </div>
            )}
            
            {/* Global Best */}
            {globalBestScore && globalBestScore > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gradient-to-r from-purple-500/20 via-violet-400/20 to-purple-500/20 border border-purple-400/30">
                <Crown className="w-3 h-3 flex-shrink-0 text-purple-300" />
                <span className="text-white/70">{lang("ROLE_GLOBAL_BEST")}</span>
                <span className="font-bold text-purple-300">{globalBestScore.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Confirm button or lock message */}
        {item.isLocked ? (
          <div className="w-full rounded-xl px-4 py-3 font-semibold text-sm bg-slate-700/60 text-white/60 text-center border border-slate-600/40">
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl">🔒</span>
              <span>{item.lockReason || "Locked"}</span>
            </div>
          </div>
        ) : (
          <button
            onClick={onConfirm}
            className="w-full rounded-xl px-4 sm:px-6 py-3 sm:py-4 font-semibold text-base shadow-lg bg-gradient-to-r from-amber-400 to-amber-600 text-gray-900 hover:from-amber-300 hover:to-amber-500 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            {lang("CONFIRM_ROLE")}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 pb-4 md:pb-6">
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="bg-black/70 backdrop-blur-md border border-amber-400/30 rounded-2xl shadow-2xl shadow-black/50 p-6 md:p-8"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
