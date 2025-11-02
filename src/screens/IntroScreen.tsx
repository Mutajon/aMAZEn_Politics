// src/screens/IntroScreen.tsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { bgStyleWithMaze } from "../lib/ui";
import type { PushFn } from "../lib/router";
import { lang } from "../i18n/lang";
import { useLogger } from "../hooks/useLogger";

// Animated word component for cycling through synonyms
function AnimatedWord() {
  const words = [
    "shifting",
    "drifting",
    "transitioning",
    "evolving",
    "morphing",
    "emerging",
    "flowing",
    "unfolding",
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % words.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-block relative mx-1" style={{ minWidth: "120px" }}>
      <AnimatePresence mode="wait">
        <motion.span
          key={currentIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 text-amber-300"
        >
          {words[currentIndex]}
        </motion.span>
      </AnimatePresence>
      {/* Invisible placeholder to maintain width */}
      <span className="invisible">{words[0]}</span>
    </span>
  );
}

export default function IntroScreen({ push }: { push: PushFn }) {
  const logger = useLogger();
  const paragraphs = [
    lang("INTRO_READY_TO_BE_AMAZED"),
    lang("INTRO_LIFE_BRANCHING"),
    lang("INTRO_MAZE_POLITICS"),
    lang("INTRO_KNOW_YOURSELF"),
    lang("INTRO_READY_TO_PICK"),
  ];

  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount < paragraphs.length) {
      const t = setTimeout(() => setVisibleCount((c) => c + 1), 1500);
      return () => clearTimeout(t);
    }
  }, [visibleCount, paragraphs.length]);

  const allShown = visibleCount >= paragraphs.length;

  // Helper to render text with animated "shifting" word
  const renderTextWithAnimation = (text: string, index: number) => {
    // Only apply animation to the maze politics paragraph
    if (index === 2 && text.includes("shifting")) {
      const parts = text.split("shifting");
      return (
        <>
          {parts[0]}
          <AnimatedWord />
          {parts[1]}
        </>
      );
    }
    return text;
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-5" style={bgStyleWithMaze}>
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
            {renderTextWithAnimation(text, i)}
          </motion.p>
        ))}

        <div className="mt-8 flex justify-center min-h-[60px]">
          {allShown && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20
              }}
              onClick={() => {
                logger.log('button_click', 'Yes!', 'User clicked Yes! button to proceed to role selection');
                push("/role");
              }}
              className="rounded-full px-6 py-2 font-bold text-lg bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335] shadow-lg"
            >
              {lang("YES!")}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
