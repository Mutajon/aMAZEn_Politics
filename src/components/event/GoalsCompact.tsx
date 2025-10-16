// src/components/event/GoalsCompact.tsx
// Compact goals display for ResourceBar - shows status icons and tooltips
//
// Features:
// - Displays 2 selected goals with status icons (✅/⏳/❌)
// - Compact pill format matching ResourceBar style
// - Shows goal titles in tooltip on hover
// - Positioned left of avatar in ResourceBar
//
// Connected to:
// - src/store/dilemmaStore.ts: Reads selectedGoals
// - src/components/event/ResourceBar.tsx: Rendered inside ResourceBar

import { Target } from "lucide-react";
import { useDilemmaStore } from "../../store/dilemmaStore";
import { useRoleStore } from "../../store/roleStore";
import { getStatusDisplay } from "../../lib/goalEvaluation";
import { substituteGoalText } from "../../lib/goalHelpers";

export default function GoalsCompact() {
  const selectedGoals = useDilemmaStore((s) => s.selectedGoals);

  // Get middle entity name for dynamic substitution
  const analysis = useRoleStore((s) => s.analysis);
  const playerIndex = analysis?.playerIndex ?? 0;
  const middleEntity = analysis?.holders?.[playerIndex + 1]?.name ?? "Power Holders";

  // Don't render if no goals selected
  if (selectedGoals.length === 0) {
    return null;
  }

  return (
    <div
      className={[
        "shrink-0",
        "px-3 py-3 rounded-2xl",
        "bg-white/10 border border-white/15 shadow-sm",
        "backdrop-blur-sm",
        "text-white",
      ].join(" ")}
      style={{ minWidth: 120, maxWidth: 140 }}
    >
      <div className="flex items-center gap-2">
        {/* Icon */}
        <span className="inline-flex items-center justify-center shrink-0 rounded-lg p-1 bg-orange-500/20 text-orange-200">
          <Target className="w-4 h-4" />
        </span>

        {/* Goals status */}
        <div className="flex-1 min-w-0">
          <div className="text-[11px] leading-none text-white/80 mb-0.5">Goals</div>
          <div className="flex items-center gap-1">
            {selectedGoals.map(goal => {
              const statusDisplay = getStatusDisplay(goal.status);
              // Apply dynamic substitution to goal descriptions
              const displayDescription = substituteGoalText(goal.shortDescription, middleEntity);
              return (
                <span
                  key={goal.id}
                  className="text-sm"
                  title={`${goal.title}: ${displayDescription} (${statusDisplay.label})`}
                >
                  {statusDisplay.icon}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
