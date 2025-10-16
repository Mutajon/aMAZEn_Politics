// src/screens/GoalsSelectionScreen.tsx
// Goal selection screen - players choose 2 out of 3 randomly presented goals
//
// Features:
// - Shows 3 random goals from the pool
// - Player selects exactly 2
// - Displays current game state for context
// - Validates selection before proceeding
// - Saves selected goals to dilemmaStore
//
// Connected to:
// - src/data/goals.ts: Goal pool and types
// - src/store/dilemmaStore.ts: Saves selected goals
// - src/lib/goalHelpers.ts: Helper functions for display
// - src/screens/BackgroundIntroScreen.tsx: Navigates here
// - src/screens/EventScreen3.tsx: Navigates to event screen after selection

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { bgStyle } from "../lib/ui";
import { getRandomGoals, type Goal } from "../data/goals";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useRoleStore } from "../store/roleStore";
import {
  getGoalColorClass,
  getGoalBgClass,
  getGoalBorderClass,
  formatPoints,
  formatDifficulty,
  getStartingBudget,
  getStartingSupport,
  substituteGoalText,
} from "../lib/goalHelpers";
import type { PushFn } from "../lib/router";

type Props = {
  push: PushFn;
};

/**
 * Get Lucide icon component by name
 * Fallback to Target icon if not found
 */
function getIconComponent(iconName: string) {
  const Icon = (LucideIcons as any)[iconName];
  return Icon || LucideIcons.Target;
}

/**
 * Goal Card Component
 */
function GoalCard({
  goal,
  selected,
  disabled,
  onToggle,
  middleEntity,
}: {
  goal: Goal;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
  middleEntity: string;
}) {
  const Icon = getIconComponent(goal.icon);
  const colorClass = getGoalColorClass(goal.color);
  const bgClass = getGoalBgClass(goal.color);
  const borderClass = getGoalBorderClass(goal.color);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: disabled && !selected ? 0.5 : 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={disabled && !selected ? undefined : onToggle}
      className={`
        relative rounded-xl border p-6 cursor-pointer transition-all
        ${selected ? `${borderClass} border-2 ${bgClass}` : 'border-white/10 bg-white/5'}
        ${disabled && !selected ? 'cursor-not-allowed' : 'hover:border-white/30 hover:bg-white/10'}
      `}
    >
      {/* Selection Indicator */}
      <div className="absolute top-4 right-4">
        {selected ? (
          <div className={`w-8 h-8 rounded-full ${bgClass} border-2 ${borderClass} flex items-center justify-center`}>
            <LucideIcons.Check className={`h-5 w-5 ${colorClass}`} />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full border-2 border-white/20" />
        )}
      </div>

      {/* Icon and Title */}
      <div className="flex items-start gap-4 mb-3 pr-12">
        <div className={`rounded-full ${bgClass} p-3 ${colorClass}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">{goal.title}</h3>
          <p className="text-sm text-white/60 mt-1">{goal.category.replace(/-/g, ' ')}</p>
        </div>
      </div>

      {/* Description */}
      <p className="text-white/80 mb-4 leading-relaxed">
        {substituteGoalText(goal.description, middleEntity)}
      </p>

      {/* Bonus Points */}
      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <span className="text-white/60 text-sm">Bonus if completed:</span>
        <span className={`text-lg font-bold ${colorClass}`}>
          {formatPoints(goal.scoreBonusOnCompletion)} points
        </span>
      </div>
    </motion.div>
  );
}

export default function GoalsSelectionScreen({ push }: Props) {
  // State
  const [availableGoals, setAvailableGoals] = useState<Goal[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set());

  // Store access
  const difficulty = useDilemmaStore((s) => s.difficulty);
  const budget = useDilemmaStore((s) => s.budget);
  const supportPeople = useDilemmaStore((s) => s.supportPeople);
  const supportMiddle = useDilemmaStore((s) => s.supportMiddle);
  const supportMom = useDilemmaStore((s) => s.supportMom);
  const setGoalsInStore = useDilemmaStore((s) => s.setGoals);

  // Get middle entity name dynamically from power distribution
  const analysis = useRoleStore((s) => s.analysis);
  const playerIndex = analysis?.playerIndex ?? 0;
  const middleEntity = analysis?.holders?.[playerIndex + 1]?.name ?? "Power Holders";

  // Initialize goals on mount
  useEffect(() => {
    const goals = getRandomGoals(3);
    setAvailableGoals(goals);
    console.log("[GoalsSelectionScreen] Generated 3 random goals:", goals.map(g => g.id));
  }, []);

  // Toggle goal selection
  const toggleGoal = (goalId: string) => {
    setSelectedGoals(prev => {
      const next = new Set(prev);
      if (next.has(goalId)) {
        next.delete(goalId);
      } else {
        // Only allow 2 selections
        if (next.size < 2) {
          next.add(goalId);
        }
      }
      return next;
    });
  };

  // Confirm selection
  const handleConfirm = () => {
    if (selectedGoals.size !== 2) {
      console.warn("[GoalsSelectionScreen] Must select exactly 2 goals");
      return;
    }

    const goalsToSave = availableGoals.filter(g => selectedGoals.has(g.id));
    console.log("[GoalsSelectionScreen] Saving goals:", goalsToSave.map(g => g.id));
    setGoalsInStore(goalsToSave);

    // Navigate to compass intro (continue normal game flow)
    push("/compass-intro");
  };

  // Calculate starting values based on difficulty
  const startingBudget = getStartingBudget(difficulty);
  const startingSupport = getStartingSupport(difficulty);

  // Determine if confirm button should be enabled
  const canConfirm = selectedGoals.size === 2;

  return (
    <div className="min-h-screen px-5 py-8" style={bgStyle}>
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-extrabold text-center bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent mb-2">
            Choose Your Goals
          </h1>
          <p className="text-center text-white/70 text-lg">
            Select exactly <span className="font-bold text-white">2 out of 3</span> goals to pursue during your rule
          </p>
        </motion.div>

        {/* Current State Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <LucideIcons.Info className="h-5 w-5" />
            Your Starting State
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-white/60 text-sm">Difficulty</div>
              <div className="text-white font-bold">{formatDifficulty(difficulty)}</div>
            </div>
            <div>
              <div className="text-white/60 text-sm">Budget</div>
              <div className="text-white font-bold">{budget}</div>
            </div>
            <div className="col-span-2">
              <div className="text-white/60 text-sm">Initial Support Levels</div>
              <div className="text-white font-bold">
                Public: {supportPeople}% | {middleEntity}: {supportMiddle}% | Mom: {supportMom}%
              </div>
            </div>
          </div>
        </motion.div>

        {/* Goal Selection */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="space-y-4"
        >
          {availableGoals.map((goal, idx) => (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.3 + idx * 0.1 }}
            >
              <GoalCard
                goal={goal}
                selected={selectedGoals.has(goal.id)}
                disabled={!selectedGoals.has(goal.id) && selectedGoals.size >= 2}
                onToggle={() => toggleGoal(goal.id)}
                middleEntity={middleEntity}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Selection Counter */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="text-center"
        >
          <div className="text-white/60">
            Selected: <span className={`font-bold ${selectedGoals.size === 2 ? 'text-green-400' : 'text-white'}`}>
              {selectedGoals.size} / 2
            </span>
          </div>
        </motion.div>

        {/* Confirm Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.7 }}
        >
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`
              w-full py-4 px-6 rounded-xl font-bold text-lg transition-all
              ${canConfirm
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-lg hover:shadow-amber-500/50'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
              }
            `}
          >
            {canConfirm ? 'Confirm Selection & Begin' : 'Select 2 Goals to Continue'}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
