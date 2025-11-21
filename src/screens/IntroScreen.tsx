// src/screens/IntroScreen.tsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { PushFn } from "../lib/router";
import { useLogger } from "../hooks/useLogger";
import Gatekeeper from "../components/Gatekeeper";
import FragmentSlots from "../components/fragments/FragmentSlots";
import FragmentPopup from "../components/fragments/FragmentPopup";
import EmptyFragmentPopup from "../components/fragments/EmptyFragmentPopup";
import { useFragmentsStore } from "../store/fragmentsStore";
import type { PastGameEntry } from "../lib/types/pastGames";
import { audioManager, type VoKey } from "../lib/audioManager";

const dialogLines = [
  "Oh! Another one. Lost.",
  "I can see it in your eyes. The blank confusion of a soul Name-Washed.",
  "You don't remember where you are, or who you were. That's a problem.",
  "Let me save us both some time: I am the Gatekeeper, and this is the Crossroad of Consciousness.",
  "A place Where people transition from the world of the living to their eternal rest.",
  "Yes, you are dead. My condolences.",
  "But your bigger issue is the Amnesia of the Self. You cannot proceed to rest until you recall your true nature.",
  "That's where I come in.",
  "I offer you a short trip back to the world of the living. Seven days. Be whoever you want.",
  "A chance to test your values, remember who you are.",
  "Each venture will give you a fragment of yourself.",
  "Gather three such Fragments, and your true Name will be woven.",
  "Your self will be complete, and you'll be ready to move on.",
  "What's the catch?",
  "I come with you. Every decision you make, every motive you hide, I will observe and collect.",
  "I need it to pay an old debt, so that I too can finally leave this place.",
  "So, Interested?",
  "Good. Because you don't really have a choice.",
  "Let me know when you are ready.",
];

// Find fragment reveal line by text content (resilient to dialog changes)
const FRAGMENT_LINE_INDEX = dialogLines.findIndex(
  (line) => line.includes("Gather") && line.includes("Fragments")
);

// Voiceover mapping: line index → audio key
// Returns voiceover key if audio exists for this line, null otherwise
const getVoiceoverKey = (lineIndex: number): VoKey | null => {
  const mapping: Record<number, VoKey> = {
    0: 'gatekeeper-0',
    1: 'gatekeeper-1',
    2: 'gatekeeper-2',
    3: 'gatekeeper-3',
    4: 'gatekeeper-4',
    5: 'gatekeeper-5',
    6: 'gatekeeper-6',
    7: 'gatekeeper-7',
    8: 'gatekeeper-8',
    9: 'gatekeeper-9',
    10: 'gatekeeper-10',
    11: 'gatekeeper-11',
    12: 'gatekeeper-12',
    13: 'gatekeeper-13',
    14: 'gatekeeper-14',
    15: 'gatekeeper-15',
    16: 'gatekeeper-16',
    17: 'gatekeeper-17',
    18: 'gatekeeper-18', // Last line: "Let me know when you're ready"
  };
  return mapping[lineIndex] || null;
};

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

  // Fragment state
  const firstIntro = useFragmentsStore((s) => s.firstIntro);
  const fragmentCount = useFragmentsStore((s) => s.getFragmentCount());
  const hasAllFragments = useFragmentsStore((s) => s.hasCompletedThreeFragments());
  const markIntroCompleted = useFragmentsStore((s) => s.markIntroCompleted);
  const setPreferredFragment = useFragmentsStore((s) => s.setPreferredFragment);
  const hasSelectedPreferred = useFragmentsStore((s) => s.hasSelectedPreferred());
  const [selectedFragment, setSelectedFragment] = useState<PastGameEntry | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isEmptySlotPopupOpen, setIsEmptySlotPopupOpen] = useState(false);

  // Final fragment selection flow state
  const [showWhichVersionMessage, setShowWhichVersionMessage] = useState(false);
  const [showFinalRestMessage, setShowFinalRestMessage] = useState(hasSelectedPreferred);

  // Fragment reveal pause state
  const [isFragmentPause, setIsFragmentPause] = useState(false);
  const [fragmentsRevealed, setFragmentsRevealed] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);

  // Determine gatekeeper message based on first visit and fragment count
  const getGatekeeperMessage = () => {
    if (firstIntro) {
      return dialogLines[currentLineIndex];
    }

    // Returning visit with all fragments - special flow
    if (hasAllFragments) {
      // Already selected preferred → final rest message
      if (showFinalRestMessage) {
        return "Thank you! You can now go to rest, finally knowing who you are.";
      }
      // Clicked once → show "which version" message
      if (showWhichVersionMessage) {
        return "Now explore your fragments by clicking on them. Which version of yourself do you like the most?";
      }
      // Initial message
      return "You have collected all the required fragments. You are ready to move on to your eternal rest.";
    }

    return "Ready for another trip to the world of the living?";
  };

  const shouldShowFragments = firstIntro
    ? (currentLineIndex >= FRAGMENT_LINE_INDEX && fragmentsRevealed)
    : true;

  // Determine if gatekeeper should be interactive (always interactive on return visits)
  const isGatekeeperInteractive = true; // Allow immediate interaction

  // Show gatekeeper after 1 second delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowGatekeeper(true);

      // Play appropriate voiceover based on visit type
      if (firstIntro) {
        // First visit - play line 0
        const voKey = getVoiceoverKey(0);
        if (voKey) {
          audioManager.playVoiceover(voKey);
          logger.logSystem(
            "gatekeeper_voiceover_started",
            { lineIndex: 0, voiceoverKey: voKey },
            "Started voiceover for line 0"
          );
        }
      } else {
        // Returning visit - play appropriate message
        const voKey: VoKey = hasAllFragments
          ? 'gatekeeper-return-complete'
          : 'gatekeeper-return-incomplete';
        audioManager.playVoiceover(voKey);
        logger.logSystem(
          "gatekeeper_voiceover_started",
          { visitType: 'returning', fragmentCount, voiceoverKey: voKey },
          `Started voiceover for returning visit (${fragmentCount} fragments)`
        );
      }

      logger.logSystem(
        "intro_gatekeeper_shown",
        { delay: 1000 },
        "Gatekeeper appeared on intro screen after 1 second delay"
      );
    }, 1000);
    return () => clearTimeout(timer);
  }, [logger, firstIntro, fragmentCount, hasAllFragments]);

  // Handle animation completion
  const handleAnimationComplete = () => {
    setAnimationComplete(true);
    logger.log(
      "fragment_animation_completed",
      { fragmentCount, hasAllFragments },
      "Fragment fall-in and bob animation completed"
    );
  };

  // Handle gatekeeper dismissal (click to advance)
  const handleGatekeeperClick = () => {
    // Returning visit
    if (!firstIntro) {
      // All fragments collected - special flow
      if (hasAllFragments) {
        // Already showing final rest message - do nothing
        if (showFinalRestMessage) {
          return;
        }
        // First click - transition to "which version" message
        if (!showWhichVersionMessage) {
          setShowWhichVersionMessage(true);
          audioManager.playVoiceover('gatekeeper-which-version');
          logger.log(
            "intro_which_version_shown",
            { fragmentCount },
            "Showing 'which version' message - waiting for fragment selection"
          );
          return;
        }
        // Already in "which version" mode - do nothing (wait for selection)
        return;
      }
      // Not all fragments - show ready button
      setIsLastLine(true);
      logger.log(
        "intro_return_visit",
        { fragmentCount, hasAllFragments },
        "Returning visit - showing ready button"
      );
      return;
    }

    // First visit - check for fragment reveal line
    if (currentLineIndex === FRAGMENT_LINE_INDEX && !fragmentsRevealed) {
      // PAUSE for fragment reveal
      setFragmentsRevealed(true);
      setIsFragmentPause(true);
      logger.log(
        "fragment_reveal_started",
        { fragmentLineIndex: FRAGMENT_LINE_INDEX, lineText: dialogLines[FRAGMENT_LINE_INDEX] },
        "Fragment reveal sequence started - dialog paused"
      );
      // Don't advance line yet - will auto-advance after timer
      return;
    }

    // First visit - advance through dialog
    if (currentLineIndex < dialogLines.length - 1) {
      const nextIndex = currentLineIndex + 1;
      setCurrentLineIndex(nextIndex);

      // Play voiceover for next line if available
      const voKey = getVoiceoverKey(nextIndex);
      if (voKey) {
        audioManager.playVoiceover(voKey);
        logger.logSystem(
          "gatekeeper_voiceover_started",
          { lineIndex: nextIndex, voiceoverKey: voKey },
          `Started voiceover for line ${nextIndex}`
        );
      }

      logger.log(
        "intro_dialog_advanced",
        { lineIndex: nextIndex, lineText: dialogLines[nextIndex] },
        `Advanced to dialog line ${nextIndex + 1}/${dialogLines.length}`
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
    if (isFragmentPause) {
      setIsFragmentPause(false); // Cancel pause
    }

    // Stop current voiceover
    audioManager.stopVoiceover();
    logger.logSystem(
      "gatekeeper_voiceover_stopped",
      { lineIndex: currentLineIndex, reason: "skip" },
      "Stopped voiceover (user skipped)"
    );

    // Play last line voiceover (line 18)
    const lastLineIndex = dialogLines.length - 1; // Line 18
    const voKey = getVoiceoverKey(lastLineIndex);
    if (voKey) {
      audioManager.playVoiceover(voKey);
      logger.logSystem(
        "gatekeeper_voiceover_started",
        { lineIndex: lastLineIndex, voiceoverKey: voKey },
        `Started voiceover for last line ${lastLineIndex}`
      );
    }

    setFragmentsRevealed(true); // Mark as revealed
    setCurrentLineIndex(lastLineIndex);
    setIsLastLine(true);
    logger.log(
      "intro_dialog_skipped",
      { skippedFrom: currentLineIndex, totalLines: dialogLines.length },
      `User skipped dialog from line ${currentLineIndex + 1} to last line`
    );
  };

  // Handle "I'm ready" button
  const handleReady = () => {
    // Play click sound
    audioManager.playSfx('click-soft');

    // Mark intro as completed on first visit
    if (firstIntro) {
      markIntroCompleted();
      logger.log(
        "intro_first_visit_completed",
        { screen: "/intro" },
        "User completed first intro visit"
      );
    }

    logger.log(
      "button_click_im_ready",
      { screen: "/intro", firstIntro, fragmentCount },
      "User clicked 'I'm ready' button to proceed to role selection"
    );
    push("/role");
  };

  // Handle fragment click
  const handleFragmentClick = (fragment: PastGameEntry, index: number) => {
    setSelectedFragment(fragment);
    setIsPopupOpen(true);
    logger.log(
      "fragment_popup_opened",
      { gameId: fragment.gameId, index, playerName: fragment.playerName },
      `Opened fragment popup for ${fragment.playerName}`
    );
  };

  // Handle popup close
  const handlePopupClose = () => {
    setIsPopupOpen(false);
    setSelectedFragment(null);
  };

  // Handle preferred fragment selection
  const handleSelectPreferred = (gameId: string) => {
    setPreferredFragment(gameId);
    setIsPopupOpen(false);
    setSelectedFragment(null);
    setShowFinalRestMessage(true);
    audioManager.playVoiceover('gatekeeper-rest');
    logger.log(
      "preferred_fragment_selected",
      { gameId, fragmentCount },
      `User selected preferred fragment: ${gameId}`
    );
  };

  // Handle empty slot click
  const handleEmptySlotClick = () => {
    setIsEmptySlotPopupOpen(true);
    logger.log(
      "empty_fragment_clicked",
      { fragmentCount, hasAllFragments },
      "User clicked empty fragment slot"
    );
  };

  // Handle empty slot popup close
  const handleEmptySlotPopupClose = () => {
    setIsEmptySlotPopupOpen(false);
    logger.log(
      "empty_fragment_popup_closed",
      {},
      "User closed empty fragment popup"
    );
  };

  // Auto-advance after fragment animation completes (first visit only)
  useEffect(() => {
    if (isFragmentPause && animationComplete) {
      setCurrentLineIndex((prev) => prev + 1); // Advance to next line
      setIsFragmentPause(false);

      // Play voiceover for next line
      const nextIndex = currentLineIndex + 1;
      const voKey = getVoiceoverKey(nextIndex);
      if (voKey) {
        audioManager.playVoiceover(voKey);
        logger.logSystem(
          "gatekeeper_voiceover_started",
          { lineIndex: nextIndex, voiceoverKey: voKey },
          `Started voiceover for line ${nextIndex}`
        );
      }

      logger.log(
        "fragment_reveal_completed",
        { fragmentLineIndex: FRAGMENT_LINE_INDEX, nextLine: currentLineIndex + 1 },
        "Fragment reveal completed, dialog continuing"
      );
    }
  }, [isFragmentPause, animationComplete, currentLineIndex, logger]);

  // Fallback: Auto-advance if animation callback doesn't fire within 3 seconds
  useEffect(() => {
    if (isFragmentPause && !animationComplete) {
      const fallbackTimer = setTimeout(() => {
        // Only trigger if still paused
        setAnimationComplete(true);
        logger.logSystem(
          "fragment_animation_fallback",
          { fragmentLineIndex: FRAGMENT_LINE_INDEX },
          "Fragment animation fallback triggered after 3s timeout"
        );
      }, 3000);
      return () => clearTimeout(fallbackTimer);
    }
  }, [isFragmentPause, animationComplete, logger]);

  // Cleanup: Stop voiceover on unmount
  useEffect(() => {
    return () => {
      audioManager.stopVoiceover();
      console.log('🎤 IntroScreen unmounted - voiceover stopped');
    };
  }, []);

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center px-5 relative"
      style={etherPlaceBackground}
    >
      {/* Fragment Slots - shown when fragments mentioned or on returning visits */}
      {shouldShowFragments && (
        <FragmentSlots
          onFragmentClick={handleFragmentClick}
          onEmptySlotClick={handleEmptySlotClick}
          onAnimationComplete={handleAnimationComplete}
          playAppearSound={firstIntro}
        />
      )}

      {/* Fragment Popup */}
      <FragmentPopup
        isOpen={isPopupOpen}
        fragment={selectedFragment}
        onClose={handlePopupClose}
        showSelectionButton={hasAllFragments && !hasSelectedPreferred && showWhichVersionMessage}
        onSelectPreferred={handleSelectPreferred}
      />

      {/* Empty Fragment Popup */}
      <EmptyFragmentPopup
        isOpen={isEmptySlotPopupOpen}
        onClose={handleEmptySlotPopupClose}
      />

      {/* Gatekeeper with dialog */}
      {showGatekeeper && (
        <Gatekeeper
          text={getGatekeeperMessage()}
          isVisible={true}
          onDismiss={
            isFragmentPause
              ? () => {}
              : handleGatekeeperClick
          }
          showHint={firstIntro && currentLineIndex === 0}
        />
      )}

      {/* Skip button - shown only on first visit until last line is reached */}
      {showGatekeeper && !isLastLine && firstIntro && (
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

      {/* "I'm ready" button - shown when last line is reached, but NOT when all fragments collected */}
      {isLastLine && !hasAllFragments && (
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
