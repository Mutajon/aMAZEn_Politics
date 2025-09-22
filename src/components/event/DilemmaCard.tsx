// DilemmaCard.tsx
// Compact text card for the current dilemma/event.
// - Title + short description (2–3 sentences).
// - Matches your glassy card aesthetic (rounded + subtle ring).
// - Small entrance animation (fade+slide) for polish.
//
// 🔧 Easy knobs (edit these first):
const TITLE_CLASS = "text-base font-semibold text-white/95";
const DESC_CLASS  = "text-[13px] leading-snug text-white/85";
const CARD_PAD    = "px-3 py-3"; // overall padding
const CARD_TONE   = "bg-white/6 border border-white/10 rounded-2xl shadow-sm backdrop-blur-sm";

import React from "react";
import { motion } from "framer-motion";

export type DilemmaProps = {
  title: string;
  description: string; // keep it ~2–3 sentences
};

export default function DilemmaCard({ title, description }: DilemmaProps) {
  return (
    <motion.div
      className={`${CARD_TONE} ${CARD_PAD}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "tween", duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      aria-label="Current dilemma"
    >
      <div className={TITLE_CLASS}>{title}</div>
      <p className={`mt-1 ${DESC_CLASS}`}>{description}</p>
    </motion.div>
  );
}

/* ------------ Demo helper for quick testing ------------- */
// You can replace this with real data later.
export function demoDilemma(): DilemmaProps {
  return {
    title: "Midnight March at the Capitol",
    description:
      "Overnight, thousands gathered outside the legislature demanding swift action. Advisors warn that any move could escalate tensions; doing nothing might look weak. Cameras are rolling, and your next decision will set the tone for the week.",
  };
}
