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

// Predefined traits
const TRAITS = [
  { key: "smartest", label: "DREAM_TRAIT_SMARTEST" },
  { key: "charismatic", label: "DREAM_TRAIT_CHARISMATIC" },
  { key: "just", label: "DREAM_TRAIT_JUST" },
  { key: "strongest", label: "DREAM_TRAIT_STRONGEST" },
];

// Animation constants
const TRAIT_STAGGER = 0.1;
const TRAIT_DURATION = 0.3;

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

/**
 * Validate custom trait
 * Returns error key for i18n, or null if valid
 */
function validateTrait(text: string): string | null {
  const trimmed = text.trim();

  // Too short
  if (trimmed.length < 5) {
    return "DREAM_TRAIT_ERROR_TOO_SHORT";
  }

  // Check for repeated characters (gibberish)
  const uniqueChars = new Set(trimmed.toLowerCase().replace(/\s/g, ""));
  if (uniqueChars.size < 3) {
    return "DREAM_TRAIT_ERROR_GIBBERISH";
  }

  // Profanity check
  const lowerText = trimmed.toLowerCase();
  if (PROFANITY_LIST.some((word) => lowerText.includes(word))) {
    return "DREAM_TRAIT_ERROR_PROFANITY";
  }

  return null;
}

type Phase = "intro" | "name" | "trait";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function DreamScreen({ push }: { push: PushFn }) {
  // Note: `push` is not used yet - will be used in future step to navigate after trait selection
  const logger = useLogger();
  const lang = useLang();
  const setPlayerName = useRoleStore((s) => s.setPlayerName);
  const setPlayerTrait = useRoleStore((s) => s.setPlayerTrait);

  // Phase state
  const [phase, setPhase] = useState<Phase>("intro");
  const [showArrow, setShowArrow] = useState(false);

  // Name state
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  // Trait state
  const [traitAccepted, setTraitAccepted] = useState(false);
  const [showTraitModal, setShowTraitModal] = useState(false);
  const [customTraitText, setCustomTraitText] = useState("");
  const [traitError, setTraitError] = useState<string | null>(null);

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
      setNameError(validationError);
      logger.log("dream_name_invalid", { name: trimmed, error: validationError }, "Player entered invalid name");
      return;
    }

    // Name is valid - save it and transition to trait phase
    setPlayerName(trimmed);
    setNameError(null);
    logger.log("dream_name_accepted", trimmed, "Player name accepted and saved");
    setPhase("trait");
  };

  // Handle Enter key in name input
  const handleNameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleNameSubmit();
    }
  };

  // Handle predefined trait selection
  const handleTraitSelect = (traitKey: string, traitLabel: string) => {
    const traitText = lang(traitLabel);
    setPlayerTrait(traitText);
    setTraitAccepted(true);
    logger.log("dream_trait_selected", { trait: traitKey, traitText }, "Player selected predefined trait");
  };

  // Handle "Suggest something else" click
  const handleOpenTraitModal = () => {
    setShowTraitModal(true);
    setTraitError(null);
    setCustomTraitText("");
    logger.log("dream_trait_modal_opened", true, "Player opened custom trait modal");
  };

  // Handle close trait modal
  const handleCloseTraitModal = () => {
    setShowTraitModal(false);
    setTraitError(null);
    logger.log("dream_trait_modal_closed", true, "Player closed custom trait modal");
  };

  // Handle confirm custom trait
  const handleConfirmCustomTrait = () => {
    const trimmed = customTraitText.trim();
    const validationError = validateTrait(trimmed);

    if (validationError) {
      setTraitError(validationError);
      logger.log("dream_trait_invalid", { trait: trimmed, error: validationError }, "Player entered invalid custom trait");
      return;
    }

    // Custom trait is valid - save it
    setPlayerTrait(trimmed);
    setTraitAccepted(true);
    setShowTraitModal(false);
    setTraitError(null);
    logger.log("dream_trait_selected", { trait: "custom", traitText: trimmed }, "Player submitted custom trait");
  };

  // Handle Enter key in custom trait input
  const handleTraitKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleConfirmCustomTrait();
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
        {phase === "name" && (
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
                  setNameError(null); // Clear error on new input
                }}
                onKeyPress={handleNameKeyPress}
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
                {nameError && (
                  <motion.div
                    className="text-center px-4 py-3 rounded-xl bg-red-900/30 border border-red-400/40 text-red-200 text-sm"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {lang(nameError)}
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

      {/* Trait selection phase */}
      <AnimatePresence>
        {phase === "trait" && !traitAccepted && (
          <motion.div
            className="flex flex-col items-center justify-center px-6 max-w-lg w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            {/* Trait prompt text - same font style as intro */}
            <motion.div
              className="text-center mb-10"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <p
                className="text-white/90 text-2xl sm:text-3xl font-serif italic leading-relaxed mb-2"
                style={{ textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}
              >
                {lang("DREAM_TRAIT_PROMPT_1").replace("{name}", name)}
              </p>
              <p
                className="text-white/90 text-2xl sm:text-3xl font-serif italic leading-relaxed mb-4"
                style={{ textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}
              >
                {lang("DREAM_TRAIT_PROMPT_2")}
              </p>
              <p
                className="text-white/90 text-2xl sm:text-3xl font-serif italic leading-relaxed"
                style={{ textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}
              >
                {lang("DREAM_TRAIT_PROMPT_3")}
              </p>
            </motion.div>

            {/* Trait buttons with staggered animation */}
            <motion.div
              className="w-full space-y-3"
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: TRAIT_STAGGER, delayChildren: 0.8 } },
              }}
            >
              {TRAITS.map((trait) => (
                <motion.button
                  key={trait.key}
                  onClick={() => handleTraitSelect(trait.key, trait.label)}
                  className="w-full py-4 px-6 rounded-2xl font-semibold text-lg bg-white/15 hover:bg-white/25 text-white border border-white/20 shadow-lg hover:shadow-xl active:scale-[0.98] transition-all"
                  variants={{
                    hidden: { opacity: 0, y: 20, scale: 0.95 },
                    show: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { type: "tween", duration: TRAIT_DURATION, ease: [0.16, 1, 0.3, 1] },
                    },
                  }}
                >
                  {lang(trait.label)}
                </motion.button>
              ))}

              {/* Suggest something else button */}
              <motion.button
                onClick={handleOpenTraitModal}
                className="w-full py-4 px-6 rounded-2xl font-semibold text-lg bg-cyan-950/50 hover:bg-cyan-950/70 text-cyan-400 border border-cyan-400/40 shadow-lg hover:shadow-xl active:scale-[0.98] transition-all"
                variants={{
                  hidden: { opacity: 0, y: 20, scale: 0.95 },
                  show: {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { type: "tween", duration: TRAIT_DURATION, ease: [0.16, 1, 0.3, 1] },
                  },
                }}
              >
                {lang("DREAM_TRAIT_SUGGEST")}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom trait modal */}
      <AnimatePresence>
        {showTraitModal && (
          <motion.div
            className="absolute inset-0 z-30 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70" onClick={handleCloseTraitModal} />

            {/* Modal content */}
            <motion.div
              className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 w-full max-w-md px-5 py-5 relative z-10 ring-1 ring-white/20 shadow-2xl"
              initial={{ y: 30, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 16, scale: 0.98 }}
              transition={{ type: "tween", duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="text-white font-semibold text-lg mb-3">
                {lang("DREAM_TRAIT_MODAL_TITLE")}
              </div>

              <p className="text-sm text-cyan-400/70 mb-3" dir="rtl">
                {lang("DREAM_TRAIT_HEBREW_HINT")}
              </p>

              <textarea
                value={customTraitText}
                onChange={(e) => {
                  setCustomTraitText(e.target.value);
                  setTraitError(null);
                }}
                onKeyDown={handleTraitKeyDown}
                placeholder={lang("DREAM_TRAIT_MODAL_PLACEHOLDER")}
                className="w-full rounded-xl bg-black/35 ring-1 ring-white/25 text-white placeholder-white/50 px-4 py-3 outline-none focus:ring-white/40 resize-none text-base"
                rows={3}
                autoFocus
              />

              {/* Error message */}
              <AnimatePresence>
                {traitError && (
                  <motion.div
                    className="mt-3 text-sm text-rose-200 bg-rose-950/30 rounded-lg px-3 py-2 border border-rose-500/30"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {lang(traitError)}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={handleCloseTraitModal}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 ring-1 ring-white/15 text-white text-sm font-medium transition-colors"
                >
                  {lang("CANCEL")}
                </button>
                <button
                  onClick={handleConfirmCustomTrait}
                  disabled={!customTraitText.trim()}
                  className={[
                    "px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                    customTraitText.trim()
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow hover:shadow-emerald-500/30 active:scale-[0.98]"
                      : "bg-white/10 text-white/30 cursor-not-allowed",
                  ].join(" ")}
                >
                  {lang("CONFIRM")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
