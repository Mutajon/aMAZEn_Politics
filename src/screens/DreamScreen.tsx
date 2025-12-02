// src/screens/DreamScreen.tsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PushFn } from "../lib/router";
import { useLogger } from "../hooks/useLogger";
import { useLang, getCurrentLanguage } from "../i18n/lang";
import { useRoleStore } from "../store/roleStore";
import { useFragmentsStore } from "../store/fragmentsStore";
import { useDilemmaStore } from "../store/dilemmaStore";
import { usePastGamesStore } from "../store/pastGamesStore";
import { PREDEFINED_ROLES_ARRAY, getRoleImagePaths } from "../data/predefinedRoles";
import { audioManager } from "../lib/audioManager";
import { ShardWithAvatar } from "../components/fragments/ShardWithAvatar";
import { ThreeShardComparison } from "../components/fragments/ThreeShardComparison";

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

// Keyboard patterns to detect random key mashing
const KEYBOARD_PATTERNS = [
  "qwerty", "asdf", "zxcv", "qwer", "asdfgh", "zxcvbn",
  "hjkl", "yuiop", "ghjkl", "bnm", "fghj", "vbnm"
];

/**
 * Check if a word looks like gibberish
 * Returns true if the word appears to be random characters
 */
function isGibberishWord(word: string): boolean {
  const lowerWord = word.toLowerCase();

  // Skip short words (2 chars or less) - could be valid abbreviations
  if (lowerWord.length <= 2) return false;

  // Check for keyboard patterns
  for (const pattern of KEYBOARD_PATTERNS) {
    if (lowerWord.includes(pattern)) return true;
  }

  // Count vowels (English vowels - Hebrew text passes through)
  const vowels = lowerWord.match(/[aeiou]/gi) || [];
  const vowelRatio = vowels.length / lowerWord.length;

  // Real English words typically have 20-50% vowels
  // Gibberish like "xzqwk" has 0% vowels
  // Only apply this check to words that look like they're trying to be English (Latin chars)
  const isLatinWord = /^[a-z]+$/i.test(lowerWord);
  if (isLatinWord && vowelRatio < 0.1 && lowerWord.length > 3) return true;

  // Check for 4+ consonants in a row (rare in real English words)
  if (/[bcdfghjklmnpqrstvwxyz]{4,}/i.test(lowerWord)) return true;

  return false;
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

  // Split into words
  const words = trimmed.split(/\s+/);

  // Check each word for gibberish patterns
  const gibberishWords = words.filter(isGibberishWord);

  // If more than half the words are gibberish, reject
  if (gibberishWords.length > words.length / 2) {
    return "DREAM_TRAIT_ERROR_GIBBERISH";
  }

  // Check for repeated characters (original check)
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

type Phase = "intro" | "name" | "trait" | "mirror" | "mirrorBroken" | "grandpaDialogue" | "returnVisitor";

// Grandpa dialogue lines
const GRANDPA_DIALOGUES = [
  "DREAM_GRANDPA_1",
  "DREAM_GRANDPA_2",
  "DREAM_GRANDPA_3",
  "DREAM_GRANDPA_4",
  "DREAM_GRANDPA_5",
  "DREAM_GRANDPA_6",
];

// Typewriter speed in ms per character
const TYPEWRITER_SPEED = 25;

// Shard to role mapping: Athens (index 0), North America (index 3), Mars (index 9)
const SHARD_ROLES = [
  PREDEFINED_ROLES_ARRAY[0],  // Shard 0 → Athens
  PREDEFINED_ROLES_ARRAY[3],  // Shard 1 → North America (locked)
  PREDEFINED_ROLES_ARRAY[9],  // Shard 2 → Mars (locked)
];

export default function DreamScreen({ push }: { push: PushFn }) {
  const logger = useLogger();
  const lang = useLang();

  // Role store actions
  const setPlayerName = useRoleStore((s) => s.setPlayerName);
  const setPlayerTrait = useRoleStore((s) => s.setPlayerTrait);
  const setRole = useRoleStore((s) => s.setRole);
  const setAnalysis = useRoleStore((s) => s.setAnalysis);
  const setRoleBackgroundImage = useRoleStore((s) => s.setRoleBackgroundImage);
  const setRoleContext = useRoleStore((s) => s.setRoleContext);
  const setRoleDescription = useRoleStore((s) => s.setRoleDescription);
  const setSupportProfiles = useRoleStore((s) => s.setSupportProfiles);
  const setRoleScope = useRoleStore((s) => s.setRoleScope);
  const setStoryThemes = useRoleStore((s) => s.setStoryThemes);

  // Fragment store - for avatar thumbnails on shards
  const fragments = useFragmentsStore((s) => s.fragments);
  const firstIntro = useFragmentsStore((s) => s.firstIntro);
  const markIntroCompleted = useFragmentsStore((s) => s.markIntroCompleted);

  // Dilemma store - for return visitor detection
  const justFinishedGame = useDilemmaStore((s) => s.justFinishedGame);
  const lastGameScore = useDilemmaStore((s) => s.lastGameScore);
  const clearJustFinishedGame = useDilemmaStore((s) => s.clearJustFinishedGame);

  // Past games store - for three-way comparison popup
  const pastGames = usePastGamesStore((s) => s.getGames());

  // Determine if this is a return visitor
  const isReturnVisitor = !firstIntro || justFinishedGame;
  const fragmentCount = fragments.length;

  // Phase state - start with return visitor phase if applicable
  const [phase, setPhase] = useState<Phase>(() => {
    if (isReturnVisitor) return "returnVisitor";
    return "intro";
  });
  const [showArrow, setShowArrow] = useState(false);

  // Name state
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  // Trait state
  const [traitAccepted, setTraitAccepted] = useState(false);
  const [showTraitModal, setShowTraitModal] = useState(false);
  const [customTraitText, setCustomTraitText] = useState("");
  const [traitError, setTraitError] = useState<string | null>(null);
  const [shortTrait, setShortTrait] = useState<string | null>(null);
  const [_shortTraitHe, setShortTraitHe] = useState<string | null>(null); // Kept for logging, display always uses English
  const [extractingTrait, setExtractingTrait] = useState(false);

  // Grandpa dialogue state
  const [dialogueStep, setDialogueStep] = useState(0); // 0-5 for 6 bubbles
  const [showShards, setShowShards] = useState(false);
  const [typingComplete, setTypingComplete] = useState(false);
  const [displayedText, setDisplayedText] = useState("");

  // Return visitor state
  const [returnGrandpaVisible, setReturnGrandpaVisible] = useState(false);
  const [returnDialogueKey, setReturnDialogueKey] = useState<string | null>(null);
  const [returnTypingComplete, setReturnTypingComplete] = useState(false);
  const [returnDisplayedText, setReturnDisplayedText] = useState("");

  // Three-way comparison popup state
  const [showThreeWayComparison, setShowThreeWayComparison] = useState(false);
  const [showPreferenceButtons, setShowPreferenceButtons] = useState(false);

  // Build games array with games in their correct shard positions (Athens=0, North America=1, Mars=2)
  const getGamesInShardOrder = () => {
    const gamesInOrder: (typeof pastGames[0] | undefined)[] = [undefined, undefined, undefined];
    fragments.forEach((fragment, index) => {
      const game = pastGames.find(g => g.gameId === fragment.gameId);
      if (game && index < 3) {
        gamesInOrder[index] = game;
      }
    });
    return gamesInOrder.filter((g): g is typeof pastGames[0] => g !== undefined);
  };

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
    setPlayerTrait(traitText);  // Keep full text for logging
    setShortTrait(traitKey);    // Use key as short trait: "smartest", "charismatic", etc.
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
  const handleConfirmCustomTrait = async () => {
    const trimmed = customTraitText.trim();
    const validationError = validateTrait(trimmed);

    if (validationError) {
      setTraitError(validationError);
      logger.log("dream_trait_invalid", { trait: trimmed, error: validationError }, "Player entered invalid custom trait");
      return;
    }

    // Custom trait is valid - call AI to extract short trait (bilingual)
    setExtractingTrait(true);
    try {
      const response = await fetch("/api/extract-trait", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: trimmed,
          language: getCurrentLanguage(),
        }),
      });
      const data = await response.json();

      setPlayerTrait(trimmed);                              // Keep full text for logging
      setShortTrait(data.trait || trimmed);                 // English trait
      setShortTraitHe(data.traitHe || data.trait || trimmed); // Hebrew trait
      setTraitAccepted(true);
      setShowTraitModal(false);
      setTraitError(null);
      logger.log("dream_trait_selected", { trait: "custom", traitText: trimmed, shortTrait: data.trait, shortTraitHe: data.traitHe }, "Player submitted custom trait");
    } catch (error) {
      // Fallback: use first word or trimmed text
      setPlayerTrait(trimmed);
      const fallback = trimmed.split(/\s+/)[0] || trimmed;
      setShortTrait(fallback);
      setShortTraitHe(fallback);
      setTraitAccepted(true);
      setShowTraitModal(false);
      setTraitError(null);
      logger.log("dream_trait_selected", { trait: "custom", traitText: trimmed, shortTrait: fallback }, "Player submitted custom trait (AI fallback)");
    } finally {
      setExtractingTrait(false);
    }
  };

  // Handle Enter key in custom trait input
  const handleTraitKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleConfirmCustomTrait();
    }
  };

  // Transition to mirror phase when trait is accepted
  useEffect(() => {
    if (traitAccepted && shortTrait) {
      // Small delay for fade out, then transition
      setTimeout(() => setPhase("mirror"), 500);
    }
  }, [traitAccepted, shortTrait]);

  // Handler for mirror continue button
  const handleMirrorContinue = () => {
    // Play glass break sound
    const audio = new Audio("/assets/sounds/glassBreak.mp3");
    audio.play().catch(() => {}); // Ignore autoplay errors
    setPhase("mirrorBroken");
    logger.log("dream_mirror_continue", true, "Player continued past mirror");
  };

  // Handler for broken mirror continue - transition to grandpa dialogue
  const handleBrokenMirrorContinue = () => {
    logger.log("dream_broken_mirror_continue", true, "Player continued after mirror break");
    setPhase("grandpaDialogue");
    setDialogueStep(0);
    setTypingComplete(false);
    setDisplayedText("");
  };

  // Typewriter effect for grandpa dialogue
  useEffect(() => {
    if (phase !== "grandpaDialogue") return;

    const fullText = lang(GRANDPA_DIALOGUES[dialogueStep]);
    if (!fullText) return;

    setTypingComplete(false);
    setDisplayedText("");

    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < fullText.length) {
        setDisplayedText(fullText.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(interval);
        setTypingComplete(true);
      }
    }, TYPEWRITER_SPEED);

    return () => clearInterval(interval);
  }, [phase, dialogueStep, lang]);

  // Effect for return visitor phase - determine dialogue and animate grandpa
  useEffect(() => {
    if (phase !== "returnVisitor") return;

    // Determine dialogue message based on context
    let dialogueKey: string;

    if (justFinishedGame && fragmentCount === 3) {
      // Just finished 3rd shard - ask which version they prefer
      dialogueKey = "GRANDPA_ALL_COMPLETE";
      setShowPreferenceButtons(true);
    } else if (justFinishedGame && lastGameScore !== null) {
      // Just finished a game - show score-based message
      const goalScore = 1000; // Target score for comparison
      const percentage = (lastGameScore / goalScore) * 100;

      if (percentage <= 30) dialogueKey = "GRANDPA_SCORE_TERRIBLE";
      else if (percentage <= 50) dialogueKey = "GRANDPA_SCORE_POOR";
      else if (percentage <= 70) dialogueKey = "GRANDPA_SCORE_OK";
      else if (percentage <= 90) dialogueKey = "GRANDPA_SCORE_GOOD";
      else if (percentage <= 100) dialogueKey = "GRANDPA_SCORE_EXCELLENT";
      else dialogueKey = "GRANDPA_SCORE_INCREDIBLE";

      setShowPreferenceButtons(false);
    } else if (fragmentCount === 3) {
      // Returning from splash with all 3 collected
      dialogueKey = "GRANDPA_ALREADY_COLLECTED";
      setShowPreferenceButtons(false);
    } else {
      // Returning with < 3 collected
      dialogueKey = "GRANDPA_READY_NEXT";
      setShowPreferenceButtons(false);
    }

    setReturnDialogueKey(dialogueKey);

    // Animate grandpa in after short delay
    const timer = setTimeout(() => {
      setReturnGrandpaVisible(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [phase, justFinishedGame, lastGameScore, fragmentCount]);

  // Typewriter effect for return visitor dialogue
  useEffect(() => {
    if (phase !== "returnVisitor" || !returnDialogueKey || !returnGrandpaVisible) return;

    const fullText = lang(returnDialogueKey);
    if (!fullText) return;

    // Wait for grandpa tween to complete (~600ms) before starting typewriter
    const startDelay = setTimeout(() => {
      setReturnTypingComplete(false);
      setReturnDisplayedText("");

      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex < fullText.length) {
          setReturnDisplayedText(fullText.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          clearInterval(interval);
          setReturnTypingComplete(true);
        }
      }, TYPEWRITER_SPEED);

      return () => clearInterval(interval);
    }, 600);

    return () => clearTimeout(startDelay);
  }, [phase, returnDialogueKey, returnGrandpaVisible, lang]);

  // Handler for return visitor dialogue click (skip typing)
  const handleReturnDialogueClick = () => {
    if (!returnTypingComplete && returnDialogueKey) {
      const fullText = lang(returnDialogueKey);
      setReturnDisplayedText(fullText);
      setReturnTypingComplete(true);
    }
  };

  // Handler for dialogue bubble click
  const handleDialogueClick = () => {
    if (!typingComplete) {
      // Skip to end of typing
      const fullText = lang(GRANDPA_DIALOGUES[dialogueStep]);
      setDisplayedText(fullText);
      setTypingComplete(true);
      return;
    }

    // Move to next dialogue step
    if (dialogueStep < GRANDPA_DIALOGUES.length - 1) {
      // After step 3 (4th bubble), show shards
      if (dialogueStep === 3) {
        setShowShards(true);
        // Play fragments appear sound
        const audio = new Audio("/assets/sounds/fragmentsAppear.mp3");
        audio.play().catch(() => {});
      }

      setDialogueStep(dialogueStep + 1);
      setTypingComplete(false);
      setDisplayedText("");
      logger.log("dream_grandpa_dialogue", { step: dialogueStep + 1 }, "Player advanced to next dialogue");
    } else {
      // After final dialogue (step 5), enable shard clicking
      // dialogueStep stays at 5, but typingComplete enables clicking
      logger.log("dream_grandpa_dialogue_complete", true, "Grandpa dialogue complete, shards clickable");
    }
  };

  // Handler for shard click - behavior depends on shard state
  const handleShardClick = (shardIndex: number) => {
    // Play click sound
    audioManager.playSfx("click-soft");

    // If all 3 fragments collected, any click opens three-way comparison
    if (fragmentCount === 3) {
      logger.log("dream_shard_clicked_comparison", { shard: shardIndex }, "Player clicked shard, opening three-way comparison");
      setShowThreeWayComparison(true);
      return;
    }

    // Completed shard (shardIndex < fragmentCount) → open three-way comparison showing all earned games
    if (shardIndex < fragmentCount) {
      logger.log("dream_shard_clicked_completed", { shard: shardIndex }, "Player clicked completed shard");
      setShowThreeWayComparison(true);
      return;
    }

    // Playable shard (shardIndex === fragmentCount) → start new game with that role
    if (shardIndex === fragmentCount) {
      const roleData = SHARD_ROLES[shardIndex];
      if (!roleData) return;

      // Mark intro as complete (only matters on first visit)
      if (firstIntro) {
        markIntroCompleted();
      }

      // Clear the justFinishedGame flag
      clearJustFinishedGame();

      // Set all role data in store (same as RoleSelectionScreen)
      setRole(roleData.legacyKey);
      setAnalysis(roleData.powerDistribution);
      setRoleBackgroundImage(getRoleImagePaths(roleData.imageId).full);
      setRoleContext(lang(roleData.titleKey), lang(roleData.introKey), roleData.year);
      setRoleDescription(lang(roleData.youAreKey));
      setSupportProfiles(roleData.powerDistribution.supportProfiles ?? null);
      setRoleScope(roleData.roleScope);
      setStoryThemes(roleData.storyThemes);

      logger.log("dream_shard_clicked_playable", { shard: shardIndex, role: roleData.legacyKey }, "Player clicked playable shard, starting new game");

      // Navigate to role intro screen
      push("/role-intro");
      return;
    }

    // Locked shard → do nothing (shouldn't reach here due to isLocked prop)
    logger.log("dream_shard_clicked_locked", { shard: shardIndex }, "Player clicked locked shard (ignored)");
  };

  // Handler for preference selection in three-way comparison
  const handlePreferenceSelected = (gameId: string) => {
    logger.log("dream_preference_selected", { gameId }, "Player selected preferred game version");
    // TODO: Store preference in fragmentsStore
    setShowThreeWayComparison(false);
    setShowPreferenceButtons(false);
    clearJustFinishedGame();
  };

  // Close three-way comparison
  const handleCloseComparison = () => {
    setShowThreeWayComparison(false);
    clearJustFinishedGame();
  };

  // Render text with emphasis for *text* patterns (black + bold on white background)
  const renderDialogueText = (text: string) => {
    const parts = text.split(/(\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={i} className="text-black font-bold not-italic">{part.slice(1, -1)}</em>;
      }
      return part;
    });
  };

  return (
    <div
      className="relative min-h-[100dvh] flex items-center justify-center"
      style={etherPlaceBackground}
    >
      {/* All phases in single AnimatePresence with mode="wait" for sequential transitions */}
      <AnimatePresence mode="wait">
        {/* Intro phase */}
        {phase === "intro" && (
          <motion.div
            key="intro"
            className="absolute inset-0 flex flex-col items-center justify-center z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
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
              {/* Highlight "dreaming" / "חולם" with golden gradient */}
              {(() => {
                const text = lang("DREAM_INTRO_TEXT");
                // Match "dreaming?" in English or "חולם?" in Hebrew
                const dreamMatch = text.match(/(dreaming\?|חולם\?)/i);
                if (dreamMatch) {
                  const index = text.indexOf(dreamMatch[0]);
                  return (
                    <>
                      {text.slice(0, index)}
                      <span
                        className="bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 bg-clip-text text-transparent"
                        style={{ textShadow: "none" }}
                      >
                        {dreamMatch[0]}
                      </span>
                    </>
                  );
                }
                return text;
              })()}
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

        {/* Name input phase */}
        {phase === "name" && (
          <motion.div
            key="name"
            className="flex flex-col items-center justify-center px-6 max-w-md w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Name prompt - same font style as intro dream text */}
            <motion.p
              className="text-white/90 text-2xl sm:text-3xl font-serif italic text-center mb-8 max-w-2xl leading-relaxed"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
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
              transition={{ duration: 0.6, delay: 0.5 }}
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
                transition={{ delay: 0.7 }}
              >
                {lang("DREAM_NAME_CONFIRM")}
              </motion.button>
            </motion.div>
          </motion.div>
        )}

        {/* Trait selection phase */}
        {phase === "trait" && !traitAccepted && (
          <motion.div
            key="trait"
            className="flex flex-col items-center justify-center px-6 max-w-lg w-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Trait prompt text - same font style as intro */}
            <motion.div
              className="text-center mb-10"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <p
                className="text-white/90 text-2xl sm:text-3xl font-serif italic leading-relaxed mb-2"
                style={{ textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}
              >
                {/* Split around {name} to apply golden gradient */}
                {(() => {
                  const text = lang("DREAM_TRAIT_PROMPT_1");
                  const parts = text.split("{name}");
                  return (
                    <>
                      {parts[0]}
                      <span
                        className="bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 bg-clip-text text-transparent"
                        style={{ textShadow: "none" }}
                      >
                        {name}
                      </span>
                      {parts[1]}
                    </>
                  );
                })()}
              </p>
              <p
                className="text-white/90 text-2xl sm:text-3xl font-serif italic leading-relaxed mb-4"
                style={{ textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}
              >
                {/* Highlight "trait" with golden gradient */}
                {(() => {
                  const text = lang("DREAM_TRAIT_PROMPT_2");
                  // Match "trait" in English or "תכונה" in Hebrew
                  const traitMatch = text.match(/(trait|תכונה)/i);
                  if (traitMatch) {
                    const index = text.indexOf(traitMatch[0]);
                    return (
                      <>
                        {text.slice(0, index)}
                        <span
                          className="bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 bg-clip-text text-transparent"
                          style={{ textShadow: "none" }}
                        >
                          {traitMatch[0]}
                        </span>
                        {text.slice(index + traitMatch[0].length)}
                      </>
                    );
                  }
                  return text;
                })()}
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
                show: { transition: { staggerChildren: TRAIT_STAGGER, delayChildren: 0.5 } },
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

        {/* Mirror phase */}
        {phase === "mirror" && (
          <motion.div
            key="mirror"
            className="flex flex-col items-center justify-center px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Mirror image */}
            <motion.img
              src="/assets/images/mirror.png"
              alt="Ancient mirror"
              className="w-48 h-auto mb-8"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            />

            {/* Mirror text */}
            <motion.p
              className="text-white/90 text-2xl sm:text-3xl font-serif italic text-center px-4 max-w-xl leading-relaxed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              style={{ textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}
            >
              {/* Split around {trait} to apply golden gradient - always use English trait */}
              {(() => {
                const text = lang("DREAM_MIRROR_TEXT");
                const parts = text.split("{trait}");
                const displayTrait = shortTrait;  // Always English, even when UI is Hebrew
                return (
                  <>
                    {parts[0]}
                    <span
                      className="bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 bg-clip-text text-transparent"
                      style={{ textShadow: "none" }}
                    >
                      {displayTrait || ""}
                    </span>
                    {parts[1]}
                  </>
                );
              })()}
            </motion.p>

            {/* Continue arrow */}
            <motion.button
              className="mt-12 flex flex-col items-center gap-2 text-white/60 hover:text-white/90 transition-colors cursor-pointer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              onClick={handleMirrorContinue}
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
          </motion.div>
        )}

        {/* Mirror broken phase */}
        {phase === "mirrorBroken" && (
          <motion.div
            key="mirrorBroken"
            className="flex flex-col items-center justify-center px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Broken mirror image - same layout as mirror phase */}
            <img
              src="/assets/images/mirrorBroken.png"
              alt="Shattered mirror"
              className="w-48 h-auto mb-8"
            />

            {/* Broken mirror text */}
            <motion.div
              className="text-white/90 text-2xl sm:text-3xl font-serif italic text-center px-4 max-w-xl leading-relaxed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              style={{ textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}
            >
              {/* Split text: main text + "It shatters." on new line with purple gradient */}
              {(() => {
                const text = lang("DREAM_MIRROR_BROKEN_TEXT");
                // Match "It shatters." in English or "היא מתנפצת." in Hebrew
                const shatterMatch = text.match(/(It shatters\.|היא מתנפצת\.)/i);
                if (shatterMatch) {
                  const index = text.indexOf(shatterMatch[0]);
                  const mainText = text.slice(0, index).trim();
                  const shatterText = shatterMatch[0];
                  // Extract "shatters" or "מתנפצת" for gradient
                  const wordMatch = shatterText.match(/(shatters|מתנפצת)/i);
                  return (
                    <>
                      <p>{mainText}</p>
                      <p className="mt-4">
                        {shatterText.split(wordMatch?.[0] || "")[0]}
                        <span
                          className="bg-gradient-to-r from-purple-300 via-purple-500 to-purple-700 bg-clip-text text-transparent"
                          style={{ textShadow: "none" }}
                        >
                          {wordMatch?.[0]}
                        </span>
                        {shatterText.split(wordMatch?.[0] || "")[1]}
                      </p>
                    </>
                  );
                }
                return <p>{text}</p>;
              })()}
            </motion.div>

            {/* Continue arrow */}
            <motion.button
              className="mt-12 flex flex-col items-center gap-2 text-white/60 hover:text-white/90 transition-colors cursor-pointer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
              onClick={handleBrokenMirrorContinue}
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
          </motion.div>
        )}

        {/* Grandpa dialogue phase */}
        {phase === "grandpaDialogue" && (
          <motion.div
            key="grandpaDialogue"
            className="absolute inset-0 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Centered content area - broken mirror or shards */}
            <div className="flex-1 flex items-center justify-center">
              {!showShards ? (
                /* Broken mirror - centered */
                <img
                  src="/assets/images/mirrorBroken.png"
                  alt="Shattered mirror"
                  className="w-48 h-auto"
                />
              ) : (
                /* Shards - shown after dialogue step 3 */
                <motion.div
                  key="shards"
                  className="flex gap-4 sm:gap-6 justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {[0, 1, 2].map((index) => {
                    const shardsClickable = dialogueStep >= 5 && typingComplete;
                    const fragment = fragments[index];
                    // First intro: only shard 0 is playable, rest are locked
                    const isCompleted = false; // No completed shards on first intro
                    const isPlayable = index === 0 && shardsClickable;
                    const isLocked = index > 0;
                    return (
                      <ShardWithAvatar
                        key={index}
                        avatarUrl={fragment?.avatarThumbnail}
                        isCompleted={isCompleted}
                        isPlayable={isPlayable}
                        isLocked={isLocked}
                        onClick={() => handleShardClick(index)}
                        index={index}
                      />
                    );
                  })}
                </motion.div>
              )}
            </div>

            {/* Grandpa sprite - bottom left, flipped horizontally */}
            <motion.img
              src="/assets/images/grandpa.png"
              alt="Grandpa"
              className="absolute bottom-0 left-2 sm:left-6 md:left-10 w-28 sm:w-36 md:w-44 h-auto z-10"
              initial={{ y: "100%", opacity: 0, scaleX: -1 }}
              animate={{ y: 0, opacity: 1, scaleX: -1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.3 }}
            />

            {/* Speech bubble with tail - positioned to the RIGHT of Grandpa (who is on the left) */}
            <motion.div
              className="absolute bottom-32 sm:bottom-40 left-24 sm:left-36 md:left-48 max-w-[65%] sm:max-w-[55%] z-20 cursor-pointer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.6 }}
              onClick={handleDialogueClick}
            >
              {/* Bubble - white background, gray text */}
              <div
                className="relative px-5 py-4 rounded-2xl text-gray-700 text-base sm:text-lg leading-relaxed"
                style={{
                  background: "white",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                }}
              >
                {/* Tail pointing LEFT toward Grandpa */}
                <svg
                  className="absolute -left-3 bottom-4 w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M24 0 L0 12 L24 24 Z"
                    fill="white"
                  />
                </svg>

                {/* Dialogue text with typewriter effect */}
                <span>{renderDialogueText(displayedText)}</span>
                {!typingComplete && (
                  <span className="inline-block w-0.5 h-5 bg-gray-500 ml-1 animate-pulse" />
                )}
              </div>

              {/* Click to continue prompt - only shown for first bubble */}
              {dialogueStep === 0 && typingComplete && (
                <motion.p
                  className="text-gray-500 text-sm mt-2 text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {lang("DREAM_CLICK_CONTINUE_BUBBLE")}
                </motion.p>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Return visitor phase - grandpa tween in with dialogue and shards */}
        {phase === "returnVisitor" && (
          <motion.div
            key="returnVisitor"
            className="absolute inset-0 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Centered content area - shards with proper states */}
            <div className="flex-1 flex items-center justify-center">
              <motion.div
                className="flex gap-4 sm:gap-6 justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {[0, 1, 2].map((index) => {
                  const fragment = fragments[index];
                  // Shard states based on fragment count
                  const isCompleted = index < fragmentCount;
                  const isPlayable = index === fragmentCount && returnTypingComplete;
                  const isLocked = index > fragmentCount;
                  return (
                    <ShardWithAvatar
                      key={index}
                      avatarUrl={fragment?.avatarThumbnail}
                      isCompleted={isCompleted}
                      isPlayable={isPlayable}
                      isLocked={isLocked}
                      onClick={() => handleShardClick(index)}
                      index={index}
                    />
                  );
                })}
              </motion.div>
            </div>

            {/* Grandpa sprite - tweens in from left */}
            {returnGrandpaVisible && (
              <motion.img
                src="/assets/images/grandpa.png"
                alt="Grandpa"
                className="absolute bottom-0 left-2 sm:left-6 md:left-10 w-28 sm:w-36 md:w-44 h-auto z-10"
                initial={{ x: "-100%", opacity: 0, scaleX: -1 }}
                animate={{ x: 0, opacity: 1, scaleX: -1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
              />
            )}

            {/* Speech bubble with tail - only shown after grandpa is visible */}
            {returnGrandpaVisible && returnDisplayedText && (
              <motion.div
                className="absolute bottom-32 sm:bottom-40 left-24 sm:left-36 md:left-48 max-w-[65%] sm:max-w-[55%] z-20 cursor-pointer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.3 }}
                onClick={handleReturnDialogueClick}
              >
                {/* Bubble - white background, gray text */}
                <div
                  className="relative px-5 py-4 rounded-2xl text-gray-700 text-base sm:text-lg leading-relaxed"
                  style={{
                    background: "white",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                  }}
                >
                  {/* Tail pointing LEFT toward Grandpa */}
                  <svg
                    className="absolute -left-3 bottom-4 w-6 h-6"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M24 0 L0 12 L24 24 Z"
                      fill="white"
                    />
                  </svg>

                  {/* Dialogue text with typewriter effect */}
                  <span>{renderDialogueText(returnDisplayedText)}</span>
                  {!returnTypingComplete && (
                    <span className="inline-block w-0.5 h-5 bg-gray-500 ml-1 animate-pulse" />
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Three-way comparison popup - shows all earned games in fixed positions */}
      {showThreeWayComparison && (
        <ThreeShardComparison
          games={getGamesInShardOrder()}
          onClose={handleCloseComparison}
          showPreferenceButtons={showPreferenceButtons}
          onPreferenceSelected={handlePreferenceSelected}
        />
      )}

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
                  disabled={extractingTrait}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 ring-1 ring-white/15 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {lang("CANCEL")}
                </button>
                <button
                  onClick={handleConfirmCustomTrait}
                  disabled={!customTraitText.trim() || extractingTrait}
                  className={[
                    "px-4 py-2 rounded-xl text-sm font-semibold transition-all min-w-[80px]",
                    customTraitText.trim() && !extractingTrait
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow hover:shadow-emerald-500/30 active:scale-[0.98]"
                      : "bg-white/10 text-white/30 cursor-not-allowed",
                  ].join(" ")}
                >
                  {extractingTrait ? "..." : lang("CONFIRM")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
