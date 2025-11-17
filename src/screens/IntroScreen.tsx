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
  "Each veunture will give you a fragment of yourself.",
  "Gather three such Fragments, and your true Name will be woven.",
  "Your self will be complete, and you'll be ready to move on.",
  "What's the catch?",
  "I come with you. Every decision you make, every motive you hide, I will observe and collect.",
  "I need it to pay an old, lingering debt and finally leave this place.",
  "So. Interested?",
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
  const [selectedFragment, setSelectedFragment] = useState<PastGameEntry | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isEmptySlotPopupOpen, setIsEmptySlotPopupOpen] = useState(false);

  // Fragment reveal pause state
  const [isFragmentPause, setIsFragmentPause] = useState(false);
  const [fragmentsRevealed, setFragmentsRevealed] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);

  // Determine gatekeeper message based on first visit and fragment count
  const getGatekeeperMessage = () => {
    if (firstIntro) {
      return dialogLines[currentLineIndex];
    }

    // Returning visit - show abbreviated message
    if (hasAllFragments) {
      return "You've collected all the required fragments. You're ready to move on to your eternal rest.";
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

      // Play first line voiceover (only on first visit)
      if (firstIntro) {
        const voKey = getVoiceoverKey(0);
        if (voKey) {
          audioManager.playVoiceover(voKey);
          logger.logSystem(
            "gatekeeper_voiceover_started",
            { lineIndex: 0, voiceoverKey: voKey },
            "Started voiceover for line 0"
          );
        }
      }

      logger.logSystem(
        "intro_gatekeeper_shown",
        { delay: 1000 },
        "Gatekeeper appeared on intro screen after 1 second delay"
      );
    }, 1000);
    return () => clearTimeout(timer);
  }, [logger, firstIntro]);

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
    // Returning visit - show "I'm ready" button immediately (don't wait for animation)
    if (!firstIntro) {
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

      logger.log(
        "fragment_reveal_completed",
        { fragmentLineIndex: FRAGMENT_LINE_INDEX, nextLine: currentLineIndex + 1 },
        "Fragment reveal completed, dialog continuing"
      );
    }
  }, [isFragmentPause, animationComplete, currentLineIndex, logger]);

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
        />
      )}

      {/* Fragment Popup */}
      <FragmentPopup
        isOpen={isPopupOpen}
        fragment={selectedFragment}
        onClose={handlePopupClose}
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
