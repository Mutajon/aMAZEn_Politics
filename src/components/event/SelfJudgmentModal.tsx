// src/components/event/SelfJudgmentModal.tsx
// Modal for player self-judgment after day 8
//
// Features:
// - Appears before aftermath screen
// - Mandatory self-assessment (no skip)
// - 5 radio button options
// - Shows mirror with player reflection
// - Stores answer for session summary and past games
//
// Design inspired by ReasoningModal with MirrorCard styling

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { useLogger } from "../../hooks/useLogger";
import MirrorWithReflection from "../MirrorWithReflection";
import { useRoleStore } from "../../store/roleStore";

// Speaker avatar constants
const AVATAR_SIZE_PX = 120; // Sized to show full face and upper body

// Self-judgment options (5-point scale)
const JUDGMENT_OPTIONS = [
  "A Disaster — Let's pretend that never happened.",
  "Not Great — I stumbled through it.",
  "Eh, Decent — Could've been worse.",
  "Pretty Solid — I did alright, actually.",
  "A Triumph — I surprised even myself.",
] as const;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (judgment: string) => void;
};

export default function SelfJudgmentModal({
  isOpen,
  onClose,
  onSubmit,
}: Props) {
  const [selectedJudgment, setSelectedJudgment] = useState<string | null>(null);
  const logger = useLogger();
  const character = useRoleStore((s) => s.character);

  // Log when modal opens
  useEffect(() => {
    if (isOpen) {
      logger.logSystem(
        "self_judgment_modal_opened",
        { day: 8 },
        "Self-judgment modal opened after day 8"
      );
    }
  }, [isOpen, logger]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedJudgment(null);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!selectedJudgment) return;

    // Log submission
    logger.log(
      "self_judgment_selected",
      {
        day: 8,
        judgment: selectedJudgment,
      },
      `Player selected self-judgment: ${selectedJudgment}`
    );

    onSubmit(selectedJudgment);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative w-full max-w-2xl mx-4 max-h-[85vh] bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-white/20 shadow-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4 border-b border-white/10">
            {/* Icon and Title */}
            <div className="flex items-start gap-4">
              {/* Mirror with Player Reflection */}
              <div className="flex-shrink-0">
                <MirrorWithReflection
                  mirrorSize={AVATAR_SIZE_PX}
                  avatarUrl={character?.avatarUrl}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: "Georgia, serif" }}>
                  Your time is up. Before we look at your fragment, how would you judge your own choices?
                </h2>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            {/* Radio Button Options */}
            <div className="space-y-3">
              {JUDGMENT_OPTIONS.map((option, index) => (
                <label
                  key={index}
                  className={`
                    flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all duration-200
                    ${
                      selectedJudgment === option
                        ? "bg-purple-500/20 border-purple-500/50 shadow-lg"
                        : "bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="self-judgment"
                    value={option}
                    checked={selectedJudgment === option}
                    onChange={(e) => setSelectedJudgment(e.target.value)}
                    className="w-5 h-5 text-purple-500 focus:ring-purple-500 focus:ring-2"
                  />
                  <span className="text-white text-sm flex-1">
                    {option}
                  </span>
                </label>
              ))}
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={!selectedJudgment}
              className={`
                w-full px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 mt-6
                ${
                  selectedJudgment
                    ? "bg-purple-500 hover:bg-purple-400 text-white hover:shadow-lg"
                    : "bg-gray-600 text-gray-400 cursor-not-allowed"
                }
              `}
            >
              <Sparkles className="w-5 h-5" />
              <span>Continue to Aftermath</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
