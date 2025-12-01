// src/screens/DreamScreen.tsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PushFn } from "../lib/router";
import { useLogger } from "../hooks/useLogger";
import { useLang } from "../i18n/lang";
import { useRoleStore } from "../store/roleStore";

// Background style using etherPlace.jpg (same as IntroScreen)
const etherPlaceBackground = {
  backgroundImage: "url('/assets/images/BKGs/etherPlace.jpg')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
};

// Simple profanity list for validation
const PROFANITY_LIST = [
  "fuck",
  "shit",
  "ass",
  "damn",
  "bitch",
  "crap",
  "dick",
  "cock",
  "pussy",
  "bastard",
];

/**
 * Validate player name
 * Returns error key for i18n, or null if valid
 */
function validateName(name: string): string | null {
  const trimmed = name.trim();

  // Too short
  if (trimmed.length < 2) {
    return "DREAM_NAME_ERROR_TOO_SHORT";
  }

  // All same character (e.g., "aaaa")
  const uniqueChars = new Set(trimmed.toLowerCase().replace(/\s/g, ""));
  if (uniqueChars.size === 1 && trimmed.length > 2) {
    return "DREAM_NAME_ERROR_REPEATED";
  }

  // Simple profanity check
  const lowerName = trimmed.toLowerCase();
  if (PROFANITY_LIST.some((word) => lowerName.includes(word))) {
    return "DREAM_NAME_ERROR_PROFANITY";
  }

  return null;
}

type Phase = "intro" | "name";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function DreamScreen({ push }: { push: PushFn }) {
  // Note: `push` is not used yet - will be used in future step to navigate after name input
  const logger = useLogger();
  const lang = useLang();
  const setPlayerName = useRoleStore((s) => s.setPlayerName);

  const [phase, setPhase] = useState<Phase>("intro");
  const [showArrow, setShowArrow] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [nameAccepted, setNameAccepted] = useState(false);

  // Show arrow after intro text appears
  const handleIntroTextComplete = () => {
    setTimeout(() => setShowArrow(true), 500);
  };

  // Handle click on arrow to transition to name phase
  const handleArrowClick = () => {
    logger.log("dream_arrow_click", true, "Player clicked arrow to continue");
    setPhase("name");
  };

  // Handle name submission
  const handleNameSubmit = () => {
    const trimmed = name.trim();
    const validationError = validateName(trimmed);

    if (validationError) {
      setError(validationError);
      logger.log("dream_name_invalid", { name: trimmed, error: validationError }, "Player entered invalid name");
      return;
    }

    // Name is valid - save it
    setPlayerName(trimmed);
    setNameAccepted(true);
    setError(null);
    logger.log("dream_name_accepted", trimmed, "Player name accepted and saved");
  };

  // Handle Enter key in input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !nameAccepted) {
      handleNameSubmit();
    }
  };

  return (
    <div
      className="relative min-h-[100dvh] flex items-center justify-center"
      style={etherPlaceBackground}
    >
      {/* Intro phase - no black overlay, content displayed over background */}
      <AnimatePresence>
        {phase === "intro" && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center z-10"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          >
            {/* Intro text */}
            <motion.p
              className="text-white/90 text-2xl sm:text-3xl font-serif italic text-center px-8 max-w-2xl leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.5 }}
              onAnimationComplete={handleIntroTextComplete}
              style={{
                textShadow: "0 2px 20px rgba(0,0,0,0.8)",
              }}
            >
              {lang("DREAM_INTRO_TEXT")}
            </motion.p>

            {/* Click to continue arrow */}
            <AnimatePresence>
              {showArrow && (
                <motion.button
                  className="mt-12 flex flex-col items-center gap-2 text-white/60 hover:text-white/90 transition-colors cursor-pointer"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  onClick={handleArrowClick}
                >
                  <span className="text-sm">{lang("DREAM_CLICK_CONTINUE")}</span>
                  <motion.span
                    className="text-2xl"
                    animate={{ y: [0, 6, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    ↓
                  </motion.span>
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Name input phase */}
      <AnimatePresence>
        {phase === "name" && !nameAccepted && (
          <motion.div
            className="flex flex-col items-center justify-center px-6 max-w-md w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            {/* Name prompt - same font style as intro dream text */}
            <motion.p
              className="text-white/90 text-2xl sm:text-3xl font-serif italic text-center mb-8 max-w-2xl leading-relaxed"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              style={{
                textShadow: "0 2px 20px rgba(0,0,0,0.8)",
              }}
            >
              {lang("DREAM_NAME_PROMPT")}
            </motion.p>

            {/* Input field */}
            <motion.div
              className="w-full space-y-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.0 }}
            >
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null); // Clear error on new input
                }}
                onKeyPress={handleKeyPress}
                placeholder={lang("DREAM_NAME_PLACEHOLDER")}
                className={[
                  "w-full px-5 py-4 rounded-2xl text-lg",
                  "bg-white/95 text-[#0b1335] placeholder:text-[#0b1335]/50",
                  "focus:outline-none focus:ring-2 focus:ring-amber-300/60",
                  "shadow-lg transition-all",
                ].join(" ")}
                autoFocus
              />

              {/* Error message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    className="text-center px-4 py-3 rounded-xl bg-red-900/30 border border-red-400/40 text-red-200 text-sm"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {lang(error)}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Confirm button */}
              <motion.button
                onClick={handleNameSubmit}
                disabled={!name.trim()}
                className={[
                  "w-full py-4 rounded-2xl font-semibold text-lg transition-all",
                  name.trim()
                    ? "bg-gradient-to-r from-amber-300 to-amber-500 text-[#0b1335] shadow-lg hover:shadow-xl active:scale-[0.98]"
                    : "bg-white/20 text-white/40 cursor-not-allowed",
                ].join(" ")}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
              >
                {lang("DREAM_NAME_CONFIRM")}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
