// src/screens/IntroScreen.tsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { PushFn } from "../lib/router";
import { useLogger } from "../hooks/useLogger";
import Gatekeeper from "../components/Gatekeeper";

const dialogLines = [
  "Oh, Another one. Lost.",
  "I can see it in your eyes. The blank confusion of a soul Name-Washed.",
  "You don't remember where you are, or who you were. That's a problem.",
  "I am the Gatekeeper, and this is the Crossroad of Consciousness. Where the people transition from the world of the living to their eternal rest.",
  "Yes, you are dead. My condolences.",
  "But your bigger issue is the Amnesia of the Self. You cannot proceed to rest until you recall your true nature.",
  "That's where I come in.",
  "I offer you a short trip back to the world of the living. Seven days. Be whoever you want.",
  "A chance to test your values, remember who you are.",
  "Each life gives you a fragment of who you truly were.",
  "Gather three such Fragments, and your true Name will be woven. Your self will be complete.",
  "What's the catch?",
  "I come with you. Every decision you make, every motive you hide, I will observe and collect.",
  "I need it to pay an old, lingering debt and finally leave this place.",
  "So. Interested?",
  "Good. Because you don't really have a choice.",
  "Let me know when you're ready.",
];

// Background style using etherplace.jpg
const etherPlaceBackground = {
  backgroundImage: "url('/assets/images/BKGs/etherPlace.jpg')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
};

export default function IntroScreen({ push }: { push: PushFn }) {
  const logger = useLogger();
  const [showGatekeeper, setShowGatekeeper] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isLastLine, setIsLastLine] = useState(false);

  // Show gatekeeper after 1 second delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowGatekeeper(true);
      logger.logSystem(
        "intro_gatekeeper_shown",
        { delay: 1000 },
        "Gatekeeper appeared on intro screen after 1 second delay"
      );
    }, 1000);
    return () => clearTimeout(timer);
  }, [logger]);

  // Handle gatekeeper dismissal (click to advance)
  const handleGatekeeperClick = () => {
    if (currentLineIndex < dialogLines.length - 1) {
      setCurrentLineIndex((prev) => prev + 1);
      logger.log(
        "intro_dialog_advanced",
        { lineIndex: currentLineIndex + 1, lineText: dialogLines[currentLineIndex + 1] },
        `Advanced to dialog line ${currentLineIndex + 2}/${dialogLines.length}`
      );
    } else {
      // Reached last line - show "I'm ready" button
      setIsLastLine(true);
      logger.log(
        "intro_dialog_completed",
        { totalLines: dialogLines.length },
        "User reached last dialog line"
      );
    }
  };

  // Handle skip button
  const handleSkip = () => {
    setCurrentLineIndex(dialogLines.length - 1);
    setIsLastLine(true);
    logger.log(
      "intro_dialog_skipped",
      { skippedFrom: currentLineIndex, totalLines: dialogLines.length },
      `User skipped dialog from line ${currentLineIndex + 1} to last line`
    );
  };

  // Handle "I'm ready" button
  const handleReady = () => {
    logger.log(
      "button_click_im_ready",
      { screen: "/intro" },
      "User clicked 'I'm ready' button to proceed to role selection"
    );
    push("/role");
  };

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center px-5 relative"
      style={etherPlaceBackground}
    >
      {/* Gatekeeper with dialog */}
      {showGatekeeper && (
        <Gatekeeper
          text={dialogLines[currentLineIndex]}
          isVisible={true}
          onDismiss={handleGatekeeperClick}
          showHint={currentLineIndex === 0}
        />
      )}

      {/* Skip button - shown until last line is reached */}
      {showGatekeeper && !isLastLine && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.5 }}
          onClick={(e) => {
            e.stopPropagation();
            handleSkip();
          }}
          className="fixed bottom-8 left-8 px-4 py-2 text-sm font-medium text-white/70 hover:text-white/90 underline underline-offset-2 transition-colors"
          style={{ zIndex: 40 }}
        >
          Skip
        </motion.button>
      )}

      {/* "I'm ready" button - shown when last line is reached */}
      {isLastLine && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 20,
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleReady();
          }}
          className="fixed bottom-8 left-8 rounded-full px-8 py-3 font-bold text-lg bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335] shadow-lg"
          style={{ zIndex: 150 }}
        >
          I'm ready
        </motion.button>
      )}
    </div>
  );
}
