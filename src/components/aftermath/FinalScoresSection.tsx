// src/components/aftermath/FinalScoresSection.tsx
// Final scores section showing democracy, autonomy, and liberalism ratings
//
// Connects to:
// - src/components/aftermath/RatingPill.tsx: individual rating pills
// - src/components/aftermath/AftermathContent.tsx: section orchestration
// - src/lib/aftermath.ts: RatingLevel type

import { motion } from "framer-motion";
import type { RatingLevel } from "../../lib/aftermath";
import RatingPill from "./RatingPill";
import { useLang } from "../../i18n/lang";

type Props = {
  ratings: {
    democracy: RatingLevel;
    autonomy: RatingLevel;
    liberalism: RatingLevel;
  };
};

export default function FinalScoresSection({ ratings }: Props) {
  const lang = useLang();

  return (
    <motion.div
      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.h3
        className="text-white/80 text-sm uppercase tracking-wide mb-4 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        {lang("FINAL_RATINGS")}
      </motion.h3>

      <motion.div
        className="flex gap-4 justify-center flex-wrap"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <RatingPill label={lang("DEMOCRACY")} rating={ratings.democracy} />
        <RatingPill label={lang("AUTONOMY")} rating={ratings.autonomy} />
        <RatingPill label={lang("LIBERALISM")} rating={ratings.liberalism} />
      </motion.div>
    </motion.div>
  );
}
