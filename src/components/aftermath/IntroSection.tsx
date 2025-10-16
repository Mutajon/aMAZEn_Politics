// src/components/aftermath/IntroSection.tsx
// Title and intro section with typewriter effect
//
// Shows:
// - Title: "Your time has passed..."
// - Intro paragraph with typewriter effect
//
// Connects to:
// - src/screens/AftermathScreen.tsx: main screen
// - src/hooks/useAftermathSequence.ts: controls visibility

import { motion } from "framer-motion";
import { useMemo, useEffect } from "react";

type Props = {
  intro: string;
  skipTypewriter: boolean;
  onComplete: () => void;
};

const TYPEWRITER_DURATION_S = 1.5;

export default function IntroSection({ intro, skipTypewriter, onComplete }: Props) {
  const words = useMemo(() => intro.split(/(\s+)/).filter(Boolean), [intro]);

  // Call onComplete when typewriter finishes or immediately if skipped
  useEffect(() => {
    if (skipTypewriter) {
      // If skipped, complete immediately
      onComplete();
    } else {
      // Wait for typewriter to finish
      const timer = setTimeout(() => {
        console.log('[IntroSection] Typewriter complete');
        onComplete();
      }, TYPEWRITER_DURATION_S * 1000);

      return () => clearTimeout(timer);
    }
  }, [skipTypewriter, onComplete]);

  return (
    <>
      {/* Title: "Your time has passed..." */}
      <h1 className="text-3xl font-extrabold text-center bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent mb-8">
        Your time has passed...
      </h1>

      {/* Intro Section with typewriter */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <p className="text-white/90 text-lg leading-relaxed">
          {skipTypewriter ? (
            intro
          ) : (
            <TypewriterText words={words} totalWords={words.length} />
          )}
        </p>
      </div>
    </>
  );
}

/** Typewriter effect component */
function TypewriterText({ words, totalWords }: { words: string[]; totalWords: number }) {
  return (
    <span>
      {words.map((word, i) => {
        // Handle whitespace - render directly
        if (/^\s+$/.test(word)) return <span key={`space-${i}`}>{word}</span>;

        // Typewriter: reveal word by word
        const delay = (i / totalWords) * TYPEWRITER_DURATION_S;

        return (
          <motion.span
            key={`word-${i}`}
            className="inline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.05, delay }}
          >
            {word}
          </motion.span>
        );
      })}
    </span>
  );
}
