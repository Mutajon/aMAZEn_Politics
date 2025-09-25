// src/components/event/EventLoadingOverlay.tsx
// Full-screen loading overlay tailored for the Event screen.
// Visuals: purple circle background, golden yellow hourglass, caption "time is passing".

import React from "react";
import { Hourglass } from "lucide-react";
import { motion } from "framer-motion";

type Props = {
  show?: boolean; // when true, blocks the UI
};

export default function EventLoadingOverlay({ show = false }: Props) {
  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[998] flex items-center justify-center bg-black/65 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 22 }}
        className="flex flex-col items-center gap-4 rounded-2xl bg-neutral-900/85 p-6 ring-1 ring-white/10 shadow-xl"
      >
        <div className="p-4 rounded-full bg-purple-700 ring-1 ring-white/20">
          {/* Rotating hourglass: golden stroke */}
          <Hourglass className="h-10 w-10 animate-spin text-yellow-400" aria-hidden="true" />
        </div>
        <p className="text-sm text-white/85">time is passing</p>
      </motion.div>
    </div>
  );
}
