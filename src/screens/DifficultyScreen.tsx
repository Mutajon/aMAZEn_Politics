// src/screens/DifficultyScreen.tsx
// Difficulty selection screen that appears after power distribution when enableModifiers is ON.
// Allows player to choose between four difficulty levels that affect initial budget, support, and score.
// Connected to dilemmaStore for persistent difficulty settings.

import { useState } from "react";
import { motion } from "framer-motion";
import { bgStyle } from "../lib/ui";
import type { PushFn } from "../lib/router";
import { useDilemmaStore } from "../store/dilemmaStore";
import { useSettingsStore } from "../store/settingsStore";
import { useTranslatedConst, createTranslatedConst } from "../i18n/useTranslatedConst";
import { useLang } from "../i18n/lang";

type DifficultyLevel = {
  id: "baby-boss" | "freshman" | "tactician" | "old-fox";
  title: string;
  image: string;
  supportMod: string;
  budgetMod: string;
  scoreMod: string;
};

const createDifficulties = createTranslatedConst((lang): DifficultyLevel[] => [
  {
    id: "baby-boss",
    title: lang("BABY_BOSS_TITLE"),
    image: "/assets/images/diffLevels/babyboss.jpg",
    supportMod: lang("SUPPORT_MOD_POS"),
    budgetMod: lang("BUDGET_MOD_POS"),
    scoreMod: lang("SCORE_MOD_NEG"),
  },
  {
    id: "freshman",
    title: lang("FRESHMAN_TITLE"),
    image: "/assets/images/diffLevels/freshman.jpg",
    supportMod: lang("SUPPORT_MOD_NORMAL"),
    budgetMod: lang("BUDGET_MOD_NORMAL"),
    scoreMod: lang("SCORE_MOD_NORMAL"),
  },
  {
    id: "tactician",
    title: lang("TACTICIAN_TITLE"),
    image: "/assets/images/diffLevels/tactician.jpg",
    supportMod: lang("SUPPORT_MOD_NEG"),
    budgetMod: lang("BUDGET_MOD_NEG"),
    scoreMod: lang("SCORE_MOD_POS"),
  },
  {
    id: "old-fox",
    title: lang("OLD_FOX_TITLE"),
    image: "/assets/images/diffLevels/oldfox.jpg",
    supportMod: lang("SUPPORT_MOD_NEG_HIGH"),
    budgetMod: lang("BUDGET_MOD_NEG_HIGH"),
    scoreMod: lang("SCORE_MOD_POS_HIGH"),
  },
]);

export default function DifficultyScreen({ push }: { push: PushFn }) {
  const lang = useLang();
  const difficulties = useTranslatedConst(createDifficulties);

  const [selected, setSelected] = useState<DifficultyLevel["id"] | null>(null);
  const setDifficulty = useDilemmaStore((s) => s.setDifficulty);
  const showBudget = useSettingsStore((s) => s.showBudget);

  const handleConfirm = () => {
    if (!selected) return;

    setDifficulty(selected);
    push("/goals");
  };

  return (
    <div className="min-h-[100dvh] px-5 py-8" style={bgStyle}>
      <div className="w-full max-w-2xl mx-auto">
        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl sm:text-4xl font-extrabold text-center mb-2 bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent"
        >
          {lang("CHOOSE_DIFFICULTY")}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center text-white/70 mb-8"
        >
          {lang("DIFFICULTY_DESC")}
        </motion.p>

        {/* Difficulty buttons */}
        <div className="space-y-4 mb-6">
          {difficulties.map((diff, index) => (
            <motion.button
              key={diff.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              onClick={() => {
                setSelected(diff.id);
              }}
              className={[
                "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all",
                "hover:scale-[1.02] active:scale-[0.99]",
                selected === diff.id
                  ? "border-amber-400 bg-amber-400/10 shadow-lg shadow-amber-500/20"
                  : "border-white/10 bg-white/5 hover:border-white/20",
              ].join(" ")}
            >
              {/* Image */}
              <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border border-white/10">
                <img
                  src={diff.image}
                  alt={diff.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Text content */}
              <div className="flex-1 text-left">
                <div className="text-xl font-bold text-white mb-1">
                  {diff.title}
                </div>
                <div className="text-sm text-white/70 space-y-0.5">
                  <div>{diff.supportMod}</div>
                  {showBudget && <div>{diff.budgetMod}</div>}
                  <div>{diff.scoreMod}</div>
                </div>
              </div>

              {/* Selection indicator */}
              {selected === diff.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center"
                >
                  <span className="text-neutral-900 text-sm">✓</span>
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>

        {/* Confirm button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: selected ? 1 : 0.3 }}
          onClick={handleConfirm}
          disabled={!selected}
          className={[
            "w-full rounded-2xl px-6 py-4 text-lg font-semibold transition-all",
            "bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335]",
            selected
              ? "shadow-lg hover:scale-[1.02] active:scale-[0.99] cursor-pointer"
              : "cursor-not-allowed opacity-30",
          ].join(" ")}
        >
          {lang("CONFIRM")}
        </motion.button>
      </div>
    </div>
  );
}
