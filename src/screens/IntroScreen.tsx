// src/screens/IntroScreen.tsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { bgStyle } from "../lib/ui";
import type { PushFn } from "../lib/router";
import { useLogger } from "../hooks/useLogger";

export default function IntroScreen({ push }: { push: PushFn }) {
  const logger = useLogger();
  const paragraphs = [
    "Ready to be aMAZEd?",
    "Life is a branching journey where every choice reflects yourself and leads to a different outcome.",
    "In aMaze’n Politics you travel a constantly shifting maze, where private choices intersect with public life.",
    "Know yourself—and become your best!",
    "Ready to pick your path?",
  ];

  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount < paragraphs.length) {
      const t = setTimeout(() => setVisibleCount((c) => c + 1), 1500);
      return () => clearTimeout(t);
    }
  }, [visibleCount, paragraphs.length]);

  const allShown = visibleCount >= paragraphs.length;

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-5" style={bgStyle}>
      <div className="w-full max-w-md text-center space-y-5">
        {paragraphs.map((text, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: i < visibleCount ? 1 : 0 }}
            transition={{ duration: 0.8 }}
            className={
              i === 0
                ? "text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent"
                : i === paragraphs.length - 1
                ? "text-lg sm:text-xl bg-gradient-to-r from-indigo-200 via-violet-200 to-amber-200 bg-clip-text text-transparent"
                : "text-lg sm:text-xl text-white/90"
            }
          >
            {text}
          </motion.p>
        ))}

        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center min-h-[104px]">
          {allShown && (
            <>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                onClick={() => {
                  logger.log('button_click_free_play', { mode: 'free-play' }, 'User clicked Free Play button');
                  push("/role");
                }}
                className="w-[14rem] rounded-2xl px-5 py-3 font-semibold text-lg bg-gradient-to-r from-indigo-400 to-purple-500 text-white shadow-lg hover:scale-[1.02] active:scale-[0.98] mx-auto sm:mx-0"
              >
                Free Play
              </motion.button>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                onClick={() => {/* Coming soon - do nothing */}}
                className="w-[14rem] rounded-2xl px-5 py-3 font-semibold text-lg bg-gradient-to-r from-amber-400 to-yellow-500 text-[#0b1335] shadow-lg hover:scale-[1.02] active:scale-[0.98] mx-auto sm:mx-0 opacity-60 cursor-default"
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span>Campaign Mode</span>
                  <span className="text-xs font-normal">(Coming soon)</span>
                </div>
              </motion.button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
