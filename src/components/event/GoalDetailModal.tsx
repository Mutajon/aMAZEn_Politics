// src/components/event/GoalDetailModal.tsx
// Modal for displaying detailed goal information when player clicks a goal pill
//
// Features:
// - Shows full goal details (icon, title, description, category, status, points)
// - Dynamic {middleEntity} substitution in description
// - Colored status badge (green/yellow/red)
// - Click outside or X button to close
// - Animated with Framer Motion
//
// Connected to:
// - src/components/event/GoalsCompact.tsx: Triggered by clicking goal pill
// - src/data/goals.ts: Goal type definitions
// - src/lib/goalHelpers.ts: Styling and text substitution helpers

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { SelectedGoal } from "../../data/goals";
import {
  substituteGoalText,
  getGoalColorClass,
  getGoalBgClass,
  formatPoints,
  formatGoalCategory
} from "../../lib/goalHelpers";
import { getStatusDisplay } from "../../lib/goalEvaluation";

type Props = {
  goal: SelectedGoal | null;
  middleEntity: string;
  onClose: () => void;
};

/**
 * Get Lucide icon component by name
 * Fallback to Target icon if not found
 */
function getIconComponent(iconName: string) {
  const Icon = (LucideIcons as any)[iconName];
  return Icon || LucideIcons.Target;
}

export default function GoalDetailModal({ goal, middleEntity, onClose }: Props) {
  if (!goal) return null;

  const Icon = getIconComponent(goal.icon);
  const colorClass = getGoalColorClass(goal.color);
  const bgClass = getGoalBgClass(goal.color);
  const statusDisplay = getStatusDisplay(goal.status);
  const displayDescription = substituteGoalText(goal.description, middleEntity);
  const categoryLabel = formatGoalCategory(goal.category);

  // Get status-specific styling
  const statusColorClass = statusDisplay.color;
  const statusBgClass = goal.status === 'met'
    ? 'bg-green-500/10'
    : goal.status === 'failed'
    ? 'bg-red-500/10'
    : 'bg-yellow-500/10';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative w-full max-w-lg mx-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-white/20 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4">
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-white/70" />
            </button>

            {/* Icon and Title */}
            <div className="flex items-start gap-4 pr-12">
              <div className={`rounded-2xl ${bgClass} p-4 ${colorClass}`}>
                <Icon className="h-8 w-8" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-white mb-1">{goal.title}</h2>
                <p className="text-sm text-white/60">{categoryLabel}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-6 space-y-4">
            {/* Description */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <p className="text-white/90 leading-relaxed">
                {displayDescription}
              </p>
            </div>

            {/* Status Badge */}
            <div className={`flex items-center justify-between p-4 rounded-xl border ${statusBgClass}`}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{statusDisplay.icon}</span>
                <div>
                  <div className="text-xs text-white/60 mb-0.5">Status</div>
                  <div className={`text-lg font-semibold ${statusColorClass}`}>
                    {statusDisplay.label}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/60 mb-0.5">Bonus</div>
                <div className={`text-lg font-bold ${colorClass}`}>
                  {formatPoints(goal.scoreBonusOnCompletion)}
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="text-center text-xs text-white/50 pt-2">
              {goal.status === 'unmet' && 'Keep playing to achieve this goal'}
              {goal.status === 'met' && 'Goal successfully completed!'}
              {goal.status === 'failed' && 'This goal can no longer be achieved'}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
