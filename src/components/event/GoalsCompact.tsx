// src/components/event/GoalsCompact.tsx
// Compact goals display for ResourceBar - shows 2 separate goal pills with status
//
// Features:
// - Displays 2 selected goals as individual pills
// - Each pill shows: icon, title, and status (emoji + label)
// - Click pill to open detailed modal
// - Real-time status updates from dilemmaStore
// - Dynamic middle entity substitution
//
// Connected to:
// - src/store/dilemmaStore.ts: Reads selectedGoals
// - src/store/roleStore.ts: Reads middle entity name
// - src/components/event/ResourceBar.tsx: Rendered inside ResourceBar
// - src/components/event/GoalDetailModal.tsx: Shows detailed view

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { useDilemmaStore, type GoalStatusChange } from "../../store/dilemmaStore";
import { useRoleStore } from "../../store/roleStore";
import { getStatusDisplay } from "../../lib/goalEvaluation";
import { getGoalBgClass } from "../../lib/goalHelpers";
import GoalDetailModal from "./GoalDetailModal";
import type { SelectedGoal } from "../../data/goals";

/**
 * Get Lucide icon component by name
 * Fallback to Target icon if not found
 */
function getIconComponent(iconName: string) {
  const Icon = (LucideIcons as any)[iconName];
  return Icon || LucideIcons.Target;
}

/**
 * Individual Goal Pill Component
 */
function GoalPill({
  goal,
  onClick,
  isFlashing,
}: {
  goal: SelectedGoal;
  onClick: () => void;
  isFlashing: boolean;
}) {
  const Icon = getIconComponent(goal.icon);
  const bgClass = getGoalBgClass(goal.color);
  const statusDisplay = getStatusDisplay(goal.status);

  // Determine flash color based on new status
  const flashColor = goal.status === 'met'
    ? 'rgba(34, 197, 94, 0.4)' // green-500
    : goal.status === 'failed'
    ? 'rgba(239, 68, 68, 0.4)' // red-500
    : 'rgba(251, 191, 36, 0.4)'; // amber-500

  return (
    <motion.button
      onClick={onClick}
      className={[
        "shrink-0",
        "px-2.5 py-2 rounded-2xl",
        "bg-orange-500/10 border border-orange-400/20 shadow-sm",
        "backdrop-blur-sm",
        "text-white",
        "hover:bg-orange-500/15 hover:border-orange-400/30",
        "transition-all duration-200",
        "cursor-pointer",
        "focus:outline-none focus:ring-2 focus:ring-orange-400/30",
        "flex flex-col justify-center", // Vertical layout, centered
      ].join(" ")}
      style={{ width: "140px", height: "60px" }}
      aria-label={`View details for ${goal.title}`}
      // Flash animation: scale + shadow pulse
      animate={isFlashing ? {
        scale: [1, 1.08, 1.08, 1],
        boxShadow: [
          "0 1px 3px rgba(0, 0, 0, 0.1)",
          `0 0 20px ${flashColor}`,
          `0 0 20px ${flashColor}`,
          "0 1px 3px rgba(0, 0, 0, 0.1)",
        ]
      } : {}}
      transition={{
        duration: 2,
        times: [0, 0.1, 0.9, 1],
        ease: "easeInOut"
      }}
    >
      {/* Top row: Icon + Title (horizontal) */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`rounded-lg ${bgClass} p-1 inline-flex shrink-0`}>
          <Icon className="w-3.5 h-3.5" style={{ color: "inherit" }} />
        </div>
        <div className="text-[10px] leading-tight font-medium text-white/90 truncate flex-1 min-w-0">
          {goal.title}
        </div>
      </div>

      {/* Bottom row: Status (icon + label) */}
      <div className="flex items-center gap-1">
        <span className="text-xs">{statusDisplay.icon}</span>
        <span className={`text-[9px] font-semibold ${statusDisplay.color}`}>
          {statusDisplay.label}
        </span>
      </div>
    </motion.button>
  );
}

export default function GoalsCompact() {
  const selectedGoals = useDilemmaStore((s) => s.selectedGoals);

  // Get middle entity name for dynamic substitution in modal
  const analysis = useRoleStore((s) => s.analysis);
  const playerIndex = analysis?.playerIndex ?? 0;
  const middleEntity = analysis?.holders?.[playerIndex + 1]?.name ?? "Power Holders";

  // Modal state
  const [selectedGoal, setSelectedGoal] = useState<SelectedGoal | null>(null);

  // Track which goals are currently flashing
  const [flashingGoals, setFlashingGoals] = useState<Set<string>>(new Set());

  // Listen for goal status changes and trigger flash animation
  useEffect(() => {
    const handleGoalStatusChange = (event: Event) => {
      const customEvent = event as CustomEvent<GoalStatusChange>;
      const change = customEvent.detail;

      console.log('[GoalsCompact] 🎯 Goal status changed:', change);

      // Add goal to flashing set
      setFlashingGoals(prev => new Set(prev).add(change.goalId));

      // Remove from flashing set after 2 seconds
      setTimeout(() => {
        setFlashingGoals(prev => {
          const next = new Set(prev);
          next.delete(change.goalId);
          return next;
        });
      }, 2000);
    };

    window.addEventListener('goal-status-changed', handleGoalStatusChange);

    return () => {
      window.removeEventListener('goal-status-changed', handleGoalStatusChange);
    };
  }, []);

  // Don't render if no goals selected
  if (selectedGoals.length === 0) {
    return null;
  }

  return (
    <>
      {/* Goals Section */}
      <div className="flex flex-col gap-1">
        {/* Label with orange tint */}
        <div className="text-[10px] text-orange-400/70 uppercase tracking-wide px-1">
          Goals
        </div>

        {/* Goal pills directly, no container */}
        <div className="flex items-stretch gap-2">
          {selectedGoals.map((goal) => (
            <GoalPill
              key={goal.id}
              goal={goal}
              onClick={() => setSelectedGoal(goal)}
              isFlashing={flashingGoals.has(goal.id)}
            />
          ))}
        </div>
      </div>

      {/* Detail Modal */}
      <GoalDetailModal
        goal={selectedGoal}
        middleEntity={middleEntity}
        onClose={() => setSelectedGoal(null)}
      />
    </>
  );
}
